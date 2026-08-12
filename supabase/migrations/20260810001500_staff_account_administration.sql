begin;

alter table public.app_user_access
  add column if not exists staff_id uuid references public.staff(id) on delete set null;

create unique index if not exists app_user_access_staff_id_unique
  on public.app_user_access(staff_id) where staff_id is not null;

update public.app_user_access access
set staff_id = staff.id,
    full_name = coalesce(access.full_name, staff.full_name),
    updated_at = now()
from public.staff staff
where access.staff_id is null
  and staff.email is not null
  and lower(trim(staff.email)) = access.email;

create table if not exists public.app_user_access_audit (
  id bigint generated always as identity primary key,
  target_user_id uuid not null,
  target_email text not null,
  action text not null,
  previous_is_active boolean,
  new_is_active boolean,
  performed_by uuid references auth.users(id) on delete set null,
  performed_by_email text,
  created_at timestamptz not null default now()
);

alter table public.app_user_access_audit enable row level security;
revoke all on public.app_user_access_audit from public, anon, authenticated;

create or replace function public.shab_admin_list_access_accounts()
returns table(user_id uuid, email text, full_name text, access_role public.shab_access_role, is_active boolean, staff_id uuid, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
begin
  if not public.shab_is_administrator() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  return query select a.user_id, a.email, a.full_name, a.access_role, a.is_active, a.staff_id, a.created_at, a.updated_at from public.app_user_access a order by a.access_role, a.full_name nulls last, a.email;
end;
$$;

create or replace function public.shab_admin_set_account_active(p_user_id uuid, p_is_active boolean)
returns void language plpgsql security definer set search_path = pg_catalog, public, auth
as $$
declare target public.app_user_access%rowtype; actor_email text;
begin
  if not public.shab_is_administrator() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  if p_user_id = auth.uid() and not p_is_active then raise exception 'You cannot suspend your own account.'; end if;
  select * into target from public.app_user_access where user_id = p_user_id for update;
  if not found then raise exception 'Access account not found.'; end if;
  if target.access_role = 'administrator' then raise exception 'Administrator accounts are protected and cannot be suspended here.'; end if;
  select email into actor_email from public.app_user_access where user_id = auth.uid();
  update public.app_user_access set is_active = p_is_active, updated_at = now() where user_id = p_user_id;
  insert into public.app_user_access_audit(target_user_id, target_email, action, previous_is_active, new_is_active, performed_by, performed_by_email)
  values(target.user_id, target.email, case when p_is_active then 'account_activated' else 'account_suspended' end, target.is_active, p_is_active, auth.uid(), actor_email);
end;
$$;

create or replace function public.shab_admin_list_access_audit(p_limit integer default 30)
returns table(id bigint, target_user_id uuid, target_email text, action text, previous_is_active boolean, new_is_active boolean, performed_by_email text, created_at timestamptz)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
begin
  if not public.shab_is_administrator() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  return query select a.id, a.target_user_id, a.target_email, a.action, a.previous_is_active, a.new_is_active, a.performed_by_email, a.created_at from public.app_user_access_audit a order by a.created_at desc limit greatest(1, least(coalesce(p_limit, 30), 100));
end;
$$;

revoke all on function public.shab_admin_list_access_accounts() from public, anon;
revoke all on function public.shab_admin_set_account_active(uuid, boolean) from public, anon;
revoke all on function public.shab_admin_list_access_audit(integer) from public, anon;
grant execute on function public.shab_admin_list_access_accounts() to authenticated;
grant execute on function public.shab_admin_set_account_active(uuid, boolean) to authenticated;
grant execute on function public.shab_admin_list_access_audit(integer) to authenticated;

do $$
declare admin_count integer;
begin
  select count(*) into admin_count from public.access_administrator_allowlist;
  if admin_count <> 3 then raise exception 'Exactly three administrator emails are required; found %.', admin_count; end if;
  if exists (select 1 from public.app_user_access where access_role = 'administrator' and email not in ('umar@shabgroup.com','haider@shabgroup.com','siyab@shabgroup.com')) then
    raise exception 'An unauthorised administrator account exists.';
  end if;
end;
$$;

commit;
