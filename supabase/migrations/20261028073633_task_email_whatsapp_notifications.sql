begin;
create schema if not exists shab_private;
revoke all on schema shab_private from public, anon;
grant usage on schema shab_private to authenticated, service_role;

create table public.task_notification_settings (
  id integer primary key default 1 check(id=1),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.task_notification_settings(id) values(1);

create table public.task_notification_contacts (
  recipient_key text primary key,
  staff_id uuid unique references public.staff(id) on delete cascade,
  administrator_user_id uuid unique references public.app_user_access(user_id) on delete cascade,
  email text,
  whatsapp_number text,
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  check ((staff_id is not null and administrator_user_id is null and recipient_key='staff:'||staff_id::text)
    or (staff_id is null and administrator_user_id is not null and recipient_key='administrator:'||administrator_user_id::text)),
  check (email is null or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  check (whatsapp_number is null or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  check (not whatsapp_enabled or whatsapp_number is not null)
);
alter table public.tasks add column notification_revision integer not null default 1;
create table public.task_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  revision integer not null,
  recipient_key text not null,
  channel text not null check(channel in ('email','whatsapp')),
  kind text not null check(kind in ('assigned','updated','due_soon','overdue','follow_up','completed')),
  period_key text not null default '',
  status text not null default 'queued' check(status in ('queued','processing','accepted','blocked','failed','unknown','cancelled')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  provider_message_id text,
  accepted_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(task_id, revision, recipient_key, channel, kind, period_key)
);
create index task_notification_due_queue on public.task_notification_deliveries(available_at,created_at) where status='queued';
create index task_notification_task_history on public.task_notification_deliveries(task_id,created_at desc);

alter table public.task_notification_settings enable row level security;
alter table public.task_notification_contacts enable row level security;
alter table public.task_notification_deliveries enable row level security;
revoke all on public.task_notification_settings, public.task_notification_contacts, public.task_notification_deliveries from public, anon, authenticated;
grant select, update on public.task_notification_settings to authenticated;
grant select, insert, update on public.task_notification_contacts to authenticated;
grant select on public.task_notification_deliveries to authenticated;
grant all on public.task_notification_settings, public.task_notification_contacts, public.task_notification_deliveries to service_role;
create policy notification_settings_admin on public.task_notification_settings for all to authenticated
  using((select public.shab_is_administrator())) with check((select public.shab_is_administrator()));
create policy notification_contacts_admin on public.task_notification_contacts for all to authenticated
  using((select public.shab_is_administrator())) with check((select public.shab_is_administrator()));
create policy notification_history_admin on public.task_notification_deliveries for select to authenticated
  using((select public.shab_is_administrator()));

-- Recipient resolution uses actual access roles, never the editable staff job title.
create function shab_private.notification_recipients()
returns table(recipient_key text, staff_id uuid, administrator_user_id uuid, name text, active boolean, default_email text, default_phone text)
language sql stable security definer set search_path=pg_catalog,public as $$
  select 'staff:'||s.id::text,s.id,null::uuid,s.full_name,s.status='active'
    and not exists(select 1 from public.app_user_access a where not a.is_active
      and (a.user_id=s.user_id or (s.user_id is null and a.email=lower(trim(s.email))))),s.email,s.phone
  from public.staff s
  union all
  select 'administrator:'||a.user_id::text,null::uuid,a.user_id,coalesce(a.full_name,a.email),a.is_active,a.email,s.phone
  from public.app_user_access a
  left join lateral (select st.phone from public.staff st where st.status='active'
    and (st.user_id=a.user_id or (st.user_id is null and lower(trim(st.email))=a.email))
    order by (st.user_id=a.user_id) desc nulls last,st.created_at,st.id limit 1) s on true
  where a.access_role='administrator';
$$;
revoke all on function shab_private.notification_recipients() from public,anon,authenticated;
grant execute on function shab_private.notification_recipients() to service_role;

create function shab_private.notification_contacts_for_admin()
returns table(recipient_key text,staff_id uuid,administrator_user_id uuid,name text,active boolean,email text,whatsapp_number text,email_enabled boolean,whatsapp_enabled boolean)
language plpgsql stable security definer set search_path=pg_catalog,public,shab_private as $$
begin
  if auth.uid() is null or not public.shab_is_administrator() then raise exception 'Administrator access required' using errcode='42501'; end if;
  return query select r.recipient_key,r.staff_id,r.administrator_user_id,r.name,r.active,
    coalesce(c.email,r.default_email),coalesce(c.whatsapp_number,r.default_phone),coalesce(c.email_enabled,true),coalesce(c.whatsapp_enabled,false)
    from shab_private.notification_recipients() r left join public.task_notification_contacts c using(recipient_key);
end;
$$;
revoke all on function shab_private.notification_contacts_for_admin() from public,anon;
grant execute on function shab_private.notification_contacts_for_admin() to authenticated;
create function public.get_task_notification_contacts()
returns table(recipient_key text,staff_id uuid,administrator_user_id uuid,name text,active boolean,email text,whatsapp_number text,email_enabled boolean,whatsapp_enabled boolean)
language sql stable security invoker set search_path=pg_catalog as $$select * from shab_private.notification_contacts_for_admin();$$;
revoke all on function public.get_task_notification_contacts() from public,anon;
grant execute on function public.get_task_notification_contacts() to authenticated;

create function public.task_notification_contact(key text)
returns table(recipient_key text,name text,email text,whatsapp_number text,email_enabled boolean,whatsapp_enabled boolean)
language sql stable security invoker set search_path=pg_catalog,public,shab_private as $$
 select c.recipient_key,r.name,c.email,c.whatsapp_number,c.email_enabled,c.whatsapp_enabled
 from public.task_notification_contacts c join shab_private.notification_recipients() r using(recipient_key)
 where c.recipient_key=key and r.active;
$$;
revoke all on function public.task_notification_contact(text) from public,anon,authenticated;
grant execute on function public.task_notification_contact(text) to service_role;

-- Invoked only by task-row triggers. Fixed task/recipient targets; no dynamic SQL or network work in the transaction.
create function shab_private.queue_task_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,shab_private as $$
declare event text;
begin
  if tg_op='UPDATE' then
    if row(new.title,new.description,new.priority,new.due_at,new.assigned_staff_id,new.status)
       is not distinct from row(old.title,old.description,old.priority,old.due_at,old.assigned_staff_id,old.status) then
      new.notification_revision:=old.notification_revision; return new;
    end if;
    new.notification_revision:=old.notification_revision+1;
    update public.task_notification_deliveries set status='cancelled',updated_at=now(),last_error='Task changed.'
      where task_id=new.id and status in ('queued','blocked','failed');
  else new.notification_revision:=1;
  end if;
  return new;
end;$$;
revoke all on function shab_private.queue_task_change() from public,anon,authenticated;
create trigger task_notification_revision before insert or update on public.tasks for each row execute function shab_private.queue_task_change();

create function shab_private.queue_task_event()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare event text;
begin
  if not (select enabled from public.task_notification_settings where id=1) then return new; end if;
  if tg_op='UPDATE' and new.notification_revision=old.notification_revision then return new; end if;
  if new.status='completed' then
    if tg_op='UPDATE' and old.status='completed' then return new; end if;
    insert into public.task_notification_deliveries(task_id,revision,recipient_key,channel,kind)
    select distinct new.id,new.notification_revision,d.recipient_key,'whatsapp','completed'
    from public.task_notification_deliveries d
    where d.task_id=new.id and d.kind in ('overdue','follow_up') and d.channel='whatsapp'
      and d.status='accepted' and d.recipient_key like 'administrator:%'
    on conflict do nothing;
  elsif new.status in ('pending','in_progress') and new.assigned_staff_id is not null then
    event:='assigned';
    if tg_op='UPDATE' and new.assigned_staff_id is not distinct from old.assigned_staff_id then event:='updated'; end if;
    insert into public.task_notification_deliveries(task_id,revision,recipient_key,channel,kind)
    select new.id,new.notification_revision,'staff:'||new.assigned_staff_id::text,ch,event from unnest(array['email','whatsapp']) ch
    on conflict do nothing;
  end if;
  return new;
end;$$;
revoke all on function shab_private.queue_task_event() from public,anon,authenticated;
create trigger task_notification_event after insert or update on public.tasks for each row execute function shab_private.queue_task_event();

create function public.plan_task_notifications()
returns void language plpgsql security invoker set search_path=pg_catalog,public,shab_private as $$
begin
  if not (select enabled from public.task_notification_settings where id=1) then return; end if;
  -- Serialize planners. Uniqueness is a second guard against repeated scheduler calls.
  perform pg_advisory_xact_lock(728031);
  insert into public.task_notification_deliveries(task_id,revision,recipient_key,channel,kind)
  select t.id,t.notification_revision,'staff:'||t.assigned_staff_id::text,ch,'due_soon'
  from public.tasks t cross join unnest(array['email','whatsapp']) ch
  where t.status in ('pending','in_progress') and t.assigned_staff_id is not null
    and t.due_at>now() and t.due_at<=now()+interval '24 hours'
  on conflict do nothing;

  insert into public.task_notification_deliveries(task_id,revision,recipient_key,channel,kind)
  select t.id,t.notification_revision,r.recipient_key,'whatsapp','overdue'
  from public.tasks t join shab_private.notification_recipients() r
    on (r.recipient_key='staff:'||t.assigned_staff_id::text or r.administrator_user_id is not null) and r.active
  where t.status in ('pending','in_progress') and t.due_at<now()
  on conflict do nothing;

  insert into public.task_notification_deliveries(task_id,revision,recipient_key,channel,kind,period_key)
  select t.id,t.notification_revision,r.recipient_key,'whatsapp','follow_up',to_char(now() at time zone 'Asia/Dubai','YYYY-MM-DD')
  from public.tasks t join shab_private.notification_recipients() r on r.administrator_user_id is not null and r.active
  where t.status in ('pending','in_progress') and t.due_at<now()
    and extract(hour from now() at time zone 'Asia/Dubai')>=9
    and exists(select 1 from public.task_notification_deliveries d where d.task_id=t.id and d.revision=t.notification_revision
      and d.recipient_key=r.recipient_key and d.kind='overdue' and d.status='accepted'
      and (d.accepted_at at time zone 'Asia/Dubai')::date < (now() at time zone 'Asia/Dubai')::date)
  on conflict do nothing;
end;$$;
revoke all on function public.plan_task_notifications() from public,anon,authenticated;
grant execute on function public.plan_task_notifications() to service_role;

create function public.claim_task_notifications(batch_size integer default 5)
returns setof public.task_notification_deliveries language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if not (select enabled from public.task_notification_settings where id=1) then return; end if;
 update public.task_notification_deliveries set status='unknown',last_error='Worker stopped; verify provider before resending.',updated_at=now()
   where status='processing' and updated_at<now()-interval '10 minutes';
 return query update public.task_notification_deliveries d set status='processing',attempts=d.attempts+1,updated_at=now()
 where d.id in (select q.id from public.task_notification_deliveries q where q.status='queued' and q.available_at<=now()
   order by q.available_at,q.created_at,q.id for update skip locked limit least(greatest(batch_size,1),5)) returning d.*;
end;$$;
revoke all on function public.claim_task_notifications(integer) from public,anon,authenticated;
grant execute on function public.claim_task_notifications(integer) to service_role;

-- Only definite failures/blocked contacts are retryable. Unknown outcomes require provider investigation.
create function shab_private.retry_task_alert(alert_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.uid() is null or not public.shab_is_administrator() then raise exception 'Administrator access required' using errcode='42501'; end if;
 update public.task_notification_deliveries set status='queued',available_at=now(),updated_at=now(),last_error=null
 where id=alert_id and status in ('blocked','failed') and attempts<5;
end;$$;
revoke all on function shab_private.retry_task_alert(uuid) from public,anon;
grant execute on function shab_private.retry_task_alert(uuid) to authenticated;
create function public.retry_task_notification(alert_id uuid) returns void language sql security invoker set search_path=pg_catalog as $$select shab_private.retry_task_alert(alert_id);$$;
revoke all on function public.retry_task_notification(uuid) from public,anon;
grant execute on function public.retry_task_notification(uuid) to authenticated;
commit;
