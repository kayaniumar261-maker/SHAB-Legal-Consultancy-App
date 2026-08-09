begin;

create table if not exists public.expense_vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  trade_license_number text,
  tax_registration_number text,
  email text,
  phone text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists expense_vendors_name_unique
on public.expense_vendors(lower(trim(name))) where is_active;

alter table public.expenses add column if not exists vendor_id uuid references public.expense_vendors(id) on delete restrict;
create index if not exists expenses_vendor_id_idx on public.expenses(vendor_id);

alter table public.expense_vendors enable row level security;
drop policy if exists expense_vendors_authenticated_read on public.expense_vendors;
create policy expense_vendors_authenticated_read on public.expense_vendors for select to authenticated using (true);
drop policy if exists expense_vendors_authenticated_insert on public.expense_vendors;
create policy expense_vendors_authenticated_insert on public.expense_vendors for insert to authenticated with check (true);
drop policy if exists expense_vendors_authenticated_update on public.expense_vendors;
create policy expense_vendors_authenticated_update on public.expense_vendors for update to authenticated using (true) with check (true);

revoke all on public.expense_vendors from public, anon;
grant select, insert, update on public.expense_vendors to authenticated;

create or replace function public.shab_prepare_expense_vendor()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  new.name := trim(new.name);
  new.updated_at := now();
  if tg_op = 'INSERT' and new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;
revoke all on function public.shab_prepare_expense_vendor() from public, anon, authenticated;
drop trigger if exists shab_prepare_expense_vendor_before_write on public.expense_vendors;
create trigger shab_prepare_expense_vendor_before_write before insert or update on public.expense_vendors
for each row execute function public.shab_prepare_expense_vendor();

create or replace function public.shab_sync_expense_vendor_name()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.vendor_id is not null then
    select name into new.vendor_name from public.expense_vendors where id = new.vendor_id and is_active;
    if new.vendor_name is null then raise exception 'Select an active expense vendor.'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.shab_sync_expense_vendor_name() from public, anon, authenticated;
drop trigger if exists shab_sync_expense_vendor_name_before_write on public.expenses;
create trigger shab_sync_expense_vendor_name_before_write before insert or update of vendor_id on public.expenses
for each row execute function public.shab_sync_expense_vendor_name();

commit;
