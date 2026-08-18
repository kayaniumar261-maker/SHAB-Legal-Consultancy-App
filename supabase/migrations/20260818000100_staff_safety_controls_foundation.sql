begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'shab_deletion_request_status') then
    create type public.shab_deletion_request_status as enum (
      'pending',
      'approved',
      'rejected',
      'cancelled',
      'completed'
    );
  end if;
end;
$$;

create table if not exists public.staff_record_activity_audit (
  id bigint generated always as identity primary key,
  entity_type text not null,
  record_id uuid not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  previous_record jsonb,
  new_record jsonb,
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_email text,
  changed_by_role public.shab_access_role,
  requires_admin_attention boolean not null default false,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint staff_record_activity_entity_type_check check (
    entity_type in ('client', 'case', 'case_note', 'task', 'hearing', 'document')
  )
);

create index if not exists staff_record_activity_audit_created_at_idx
  on public.staff_record_activity_audit(created_at desc);

create index if not exists staff_record_activity_audit_attention_idx
  on public.staff_record_activity_audit(requires_admin_attention, reviewed_at, created_at desc)
  where requires_admin_attention;

create table if not exists public.staff_deletion_requests (
  id bigint generated always as identity primary key,
  entity_type text not null,
  record_id uuid not null,
  record_snapshot jsonb not null,
  reason text not null,
  status public.shab_deletion_request_status not null default 'pending',
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_by_email text not null,
  requested_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_by_email text,
  resolved_at timestamptz,
  resolution_note text,
  completed_at timestamptz,
  constraint staff_deletion_request_entity_type_check check (
    entity_type in ('client', 'case', 'case_note', 'task', 'hearing', 'document')
  ),
  constraint staff_deletion_request_reason_check check (char_length(trim(reason)) between 10 and 1000),
  constraint staff_deletion_request_resolution_note_check check (
    resolution_note is null or char_length(trim(resolution_note)) between 3 and 1000
  )
);

create unique index if not exists staff_deletion_requests_one_pending_per_record
  on public.staff_deletion_requests(entity_type, record_id)
  where status = 'pending';

create index if not exists staff_deletion_requests_status_idx
  on public.staff_deletion_requests(status, requested_at desc);

alter table public.staff_record_activity_audit enable row level security;
alter table public.staff_deletion_requests enable row level security;

revoke all on public.staff_record_activity_audit from public, anon, authenticated;
revoke all on public.staff_deletion_requests from public, anon, authenticated;

create or replace function public.shab_is_active_app_user()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(exists (
    select 1
    from public.app_user_access access
    where access.user_id = auth.uid()
      and access.is_active
  ), false);
$$;

create or replace function public.shab_staff_safety_table_name(p_entity_type text)
returns text
language plpgsql
immutable
security definer
set search_path = pg_catalog, public
as $$
begin
  return case p_entity_type
    when 'client' then 'clients'
    when 'case' then 'cases'
    when 'case_note' then 'case_notes'
    when 'task' then 'tasks'
    when 'hearing' then 'hearings'
    when 'document' then 'documents'
    else null
  end;
end;
$$;

create or replace function public.shab_prevent_staff_permanent_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.role() = 'service_role' or public.shab_is_administrator() then
    return old;
  end if;

  if not public.shab_is_active_app_user() then
    raise exception 'An active SHAB account is required.' using errcode = '42501';
  end if;

  raise exception 'Staff cannot permanently delete operational records. Submit a deletion request for administrator review.'
    using errcode = '42501';
end;
$$;

create or replace function public.shab_audit_operational_record_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_email text;
  actor_role public.shab_access_role;
  entity_name text := tg_argv[0];
  record_uuid uuid;
begin
  if auth.role() = 'service_role' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select access.email, access.access_role
    into actor_email, actor_role
  from public.app_user_access access
  where access.user_id = auth.uid()
    and access.is_active;

  if actor_email is null then
    raise exception 'An active SHAB account is required.' using errcode = '42501';
  end if;

  record_uuid := case when tg_op = 'DELETE' then old.id else new.id end;

  insert into public.staff_record_activity_audit(
    entity_type,
    record_id,
    action,
    previous_record,
    new_record,
    changed_by,
    changed_by_email,
    changed_by_role,
    requires_admin_attention
  ) values (
    entity_name,
    record_uuid,
    case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    auth.uid(),
    actor_email,
    actor_role,
    actor_role = 'operations_staff' and tg_op = 'UPDATE'
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.shab_request_record_deletion(
  p_entity_type text,
  p_record_id uuid,
  p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  normalized_entity text := lower(trim(coalesce(p_entity_type, '')));
  table_name text;
  snapshot jsonb;
  actor_email text;
  request_id bigint;
begin
  if not public.shab_is_active_app_user() then
    raise exception 'An active SHAB account is required.' using errcode = '42501';
  end if;

  if public.shab_is_administrator() then
    raise exception 'Administrators can use the normal delete control after confirming the action.';
  end if;

  if char_length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'A deletion reason of at least 10 characters is required.';
  end if;

  table_name := public.shab_staff_safety_table_name(normalized_entity);
  if table_name is null then
    raise exception 'Unsupported deletion request type.';
  end if;

  execute format('select to_jsonb(record) from public.%I record where id = $1', table_name)
    into snapshot using p_record_id;

  if snapshot is null then
    raise exception 'The requested record no longer exists.';
  end if;

  select access.email into actor_email
  from public.app_user_access access
  where access.user_id = auth.uid()
    and access.is_active;

  insert into public.staff_deletion_requests(
    entity_type,
    record_id,
    record_snapshot,
    reason,
    requested_by,
    requested_by_email
  ) values (
    normalized_entity,
    p_record_id,
    snapshot,
    trim(p_reason),
    auth.uid(),
    actor_email
  )
  returning id into request_id;

  return request_id;
exception
  when unique_violation then
    raise exception 'A pending deletion request already exists for this record.';
end;
$$;

create or replace function public.shab_list_my_deletion_requests(p_limit integer default 50)
returns setof public.staff_deletion_requests
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.shab_is_active_app_user() then
    raise exception 'An active SHAB account is required.' using errcode = '42501';
  end if;

  return query
  select request.*
  from public.staff_deletion_requests request
  where request.requested_by = auth.uid()
  order by request.requested_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

create or replace function public.shab_cancel_my_deletion_request(p_request_id bigint)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.shab_is_active_app_user() then
    raise exception 'An active SHAB account is required.' using errcode = '42501';
  end if;

  update public.staff_deletion_requests
  set status = 'cancelled', resolved_at = now(), resolution_note = 'Cancelled by requester.'
  where id = p_request_id
    and requested_by = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'Pending deletion request not found.';
  end if;
end;
$$;

create or replace function public.shab_admin_list_deletion_requests(
  p_status public.shab_deletion_request_status default 'pending',
  p_limit integer default 100
)
returns setof public.staff_deletion_requests
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.shab_is_administrator() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  return query
  select request.*
  from public.staff_deletion_requests request
  where p_status is null or request.status = p_status
  order by request.requested_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

create or replace function public.shab_admin_resolve_deletion_request(
  p_request_id bigint,
  p_approve boolean,
  p_resolution_note text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_email text;
begin
  if not public.shab_is_administrator() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(p_resolution_note, ''))) < 3 then
    raise exception 'A short administrator note is required.';
  end if;

  select access.email into actor_email
  from public.app_user_access access
  where access.user_id = auth.uid();

  update public.staff_deletion_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      resolved_by = auth.uid(),
      resolved_by_email = actor_email,
      resolved_at = now(),
      resolution_note = trim(p_resolution_note)
  where id = p_request_id
    and status = 'pending';

  if not found then
    raise exception 'Pending deletion request not found.';
  end if;
end;
$$;

create or replace function public.shab_admin_mark_deletion_completed(p_request_id bigint)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.shab_is_administrator() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  update public.staff_deletion_requests
  set status = 'completed', completed_at = now()
  where id = p_request_id
    and status = 'approved';

  if not found then
    raise exception 'Approved deletion request not found.';
  end if;
end;
$$;

create or replace function public.shab_admin_list_staff_activity(
  p_attention_only boolean default true,
  p_limit integer default 100
)
returns setof public.staff_record_activity_audit
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.shab_is_administrator() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  return query
  select activity.*
  from public.staff_record_activity_audit activity
  where not p_attention_only
     or (activity.requires_admin_attention and activity.reviewed_at is null)
  order by activity.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

create or replace function public.shab_admin_mark_staff_activity_reviewed(p_activity_id bigint)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.shab_is_administrator() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  update public.staff_record_activity_audit
  set reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_activity_id;

  if not found then
    raise exception 'Staff activity record not found.';
  end if;
end;
$$;

do $$
declare
  target record;
begin
  for target in
    select * from (values
      ('clients', 'client'),
      ('cases', 'case'),
      ('case_notes', 'case_note'),
      ('tasks', 'task'),
      ('hearings', 'hearing'),
      ('documents', 'document')
    ) as operational(table_name, entity_type)
  loop
    if to_regclass(format('public.%I', target.table_name)) is not null then
      execute format('drop trigger if exists shab_prevent_staff_delete on public.%I', target.table_name);
      execute format(
        'create trigger shab_prevent_staff_delete before delete on public.%I for each row execute function public.shab_prevent_staff_permanent_delete()',
        target.table_name
      );

      execute format('drop trigger if exists shab_audit_operational_change on public.%I', target.table_name);
      execute format(
        'create trigger shab_audit_operational_change after insert or update or delete on public.%I for each row execute function public.shab_audit_operational_record_change(%L)',
        target.table_name,
        target.entity_type
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.shab_is_active_app_user() from public, anon;
revoke all on function public.shab_staff_safety_table_name(text) from public, anon, authenticated;
revoke all on function public.shab_prevent_staff_permanent_delete() from public, anon, authenticated;
revoke all on function public.shab_audit_operational_record_change() from public, anon, authenticated;
revoke all on function public.shab_request_record_deletion(text, uuid, text) from public, anon;
revoke all on function public.shab_list_my_deletion_requests(integer) from public, anon;
revoke all on function public.shab_cancel_my_deletion_request(bigint) from public, anon;
revoke all on function public.shab_admin_list_deletion_requests(public.shab_deletion_request_status, integer) from public, anon;
revoke all on function public.shab_admin_resolve_deletion_request(bigint, boolean, text) from public, anon;
revoke all on function public.shab_admin_mark_deletion_completed(bigint) from public, anon;
revoke all on function public.shab_admin_list_staff_activity(boolean, integer) from public, anon;
revoke all on function public.shab_admin_mark_staff_activity_reviewed(bigint) from public, anon;

grant execute on function public.shab_is_active_app_user() to authenticated;
grant execute on function public.shab_request_record_deletion(text, uuid, text) to authenticated;
grant execute on function public.shab_list_my_deletion_requests(integer) to authenticated;
grant execute on function public.shab_cancel_my_deletion_request(bigint) to authenticated;
grant execute on function public.shab_admin_list_deletion_requests(public.shab_deletion_request_status, integer) to authenticated;
grant execute on function public.shab_admin_resolve_deletion_request(bigint, boolean, text) to authenticated;
grant execute on function public.shab_admin_mark_deletion_completed(bigint) to authenticated;
grant execute on function public.shab_admin_list_staff_activity(boolean, integer) to authenticated;
grant execute on function public.shab_admin_mark_staff_activity_reviewed(bigint) to authenticated;

commit;
