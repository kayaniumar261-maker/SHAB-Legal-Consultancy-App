begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'shab_access_role') then
    create type public.shab_access_role as enum ('administrator', 'operations_staff');
  end if;
end;
$$;

create table if not exists public.access_administrator_allowlist (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint access_admin_email_normalized check (email = lower(trim(email)))
);

insert into public.access_administrator_allowlist(email) values
  ('umar@shabgroup.com'),
  ('haider@shabgroup.com'),
  ('siyab@shabgroup.com')
on conflict (email) do nothing;

do $$
declare
  allowed_count integer;
begin
  select count(*) into allowed_count from public.access_administrator_allowlist;
  if allowed_count <> 3 then
    raise exception 'Exactly three administrator emails must be configured; found %.', allowed_count;
  end if;
end;
$$;

create table if not exists public.app_user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  access_role public.shab_access_role not null default 'operations_staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_user_access_email_normalized check (email = lower(trim(email)))
);

create or replace function public.shab_prepare_user_access()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  normalized_email text := lower(trim(coalesce(new.email, '')));
  selected_role public.shab_access_role;
begin
  if normalized_email = '' then
    raise exception 'An email address is required for SHAB application access.';
  end if;
  selected_role := case when exists (
    select 1 from public.access_administrator_allowlist allowlist
    where allowlist.email = normalized_email
  ) then 'administrator'::public.shab_access_role else 'operations_staff'::public.shab_access_role end;

  insert into public.app_user_access(user_id, email, full_name, access_role, is_active)
  values(
    new.id,
    normalized_email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), ''),
    selected_role,
    true
  )
  on conflict (user_id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.app_user_access.full_name),
    access_role = selected_role,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists shab_auth_user_access_after_insert_update on auth.users;
create trigger shab_auth_user_access_after_insert_update
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.shab_prepare_user_access();

insert into public.app_user_access(user_id, email, full_name, access_role, is_active)
select
  account.id,
  lower(trim(account.email)),
  nullif(trim(coalesce(account.raw_user_meta_data ->> 'full_name', account.raw_user_meta_data ->> 'name', '')), ''),
  case when allowlist.email is not null
    then 'administrator'::public.shab_access_role
    else 'operations_staff'::public.shab_access_role
  end,
  true
from auth.users account
left join public.access_administrator_allowlist allowlist
  on allowlist.email = lower(trim(account.email))
where account.email is not null
on conflict (user_id) do update set
  email = excluded.email,
  full_name = coalesce(excluded.full_name, public.app_user_access.full_name),
  access_role = excluded.access_role,
  updated_at = now();

create or replace function public.shab_enforce_administrator_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  active_admin_count integer;
begin
  if new.access_role = 'administrator' and new.is_active then
    if not exists (
      select 1 from public.access_administrator_allowlist
      where email = lower(trim(new.email))
    ) then
      raise exception 'This email is not one of the three authorised administrator accounts.';
    end if;
    select count(*) into active_admin_count
    from public.app_user_access access
    where access.access_role = 'administrator'
      and access.is_active
      and access.user_id <> new.user_id;
    if active_admin_count >= 3 then
      raise exception 'SHAB permits a maximum of three active administrator accounts.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists shab_administrator_limit_before_write on public.app_user_access;
create trigger shab_administrator_limit_before_write
before insert or update of access_role, is_active, email on public.app_user_access
for each row execute function public.shab_enforce_administrator_limit();

create or replace function public.shab_is_administrator()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(exists (
    select 1 from public.app_user_access
    where user_id = auth.uid()
      and access_role = 'administrator'
      and is_active
  ), false);
$$;

create or replace function public.shab_get_my_access_profile()
returns table(
  user_id uuid,
  email text,
  full_name text,
  access_role public.shab_access_role,
  is_active boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select access.user_id, access.email, access.full_name, access.access_role, access.is_active
  from public.app_user_access access
  where access.user_id = auth.uid();
$$;

alter table public.app_user_access enable row level security;
alter table public.access_administrator_allowlist enable row level security;
drop policy if exists app_user_access_self_read on public.app_user_access;
create policy app_user_access_self_read on public.app_user_access
for select to authenticated using (user_id = auth.uid());

revoke all on public.app_user_access from public, anon, authenticated;
revoke all on public.access_administrator_allowlist from public, anon, authenticated;
grant select on public.app_user_access to authenticated;
revoke all on function public.shab_prepare_user_access() from public, anon, authenticated;
revoke all on function public.shab_enforce_administrator_limit() from public, anon, authenticated;
revoke all on function public.shab_is_administrator() from public, anon;
revoke all on function public.shab_get_my_access_profile() from public, anon;
grant execute on function public.shab_is_administrator() to authenticated;
grant execute on function public.shab_get_my_access_profile() to authenticated;

commit;
