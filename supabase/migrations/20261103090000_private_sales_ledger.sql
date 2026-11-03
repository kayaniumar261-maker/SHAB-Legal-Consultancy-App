create table public.private_sales_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  monthly_salary numeric(12,2) not null,
  closing_rate numeric(5,4) not null,
  sourcing_rate numeric(5,4) not null,
  agreement_fee numeric(12,2) not null
);

create table public.private_sales_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.private_sales_settings(owner_id) on delete cascade default auth.uid(),
  earned_on date not null,
  reference text not null check (length(btrim(reference)) between 1 and 200),
  kind text not null check (kind in ('closing','sourcing','agreement')),
  basis numeric(12,2) not null check (basis > 0 and (kind <> 'agreement' or basis = 1)),
  paid boolean not null default false
);

create index private_sales_entries_month on public.private_sales_entries(owner_id, earned_on, id);
alter table public.private_sales_settings enable row level security;
alter table public.private_sales_entries enable row level security;
revoke all on public.private_sales_settings, public.private_sales_entries from public, anon, authenticated;
grant select on public.private_sales_settings to authenticated;
grant select, insert, update on public.private_sales_entries to authenticated;

create policy private_sales_settings_owner on public.private_sales_settings
for select to authenticated using (owner_id = (select auth.uid()));

create policy private_sales_entries_owner on public.private_sales_entries
for all to authenticated
using (owner_id = (select auth.uid()) and exists (select 1 from public.private_sales_settings s where s.owner_id = (select auth.uid())))
with check (owner_id = (select auth.uid()) and exists (select 1 from public.private_sales_settings s where s.owner_id = (select auth.uid())));
