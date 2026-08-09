begin;

create table if not exists public.expense_sequences (
  sequence_year integer primary key,
  last_value bigint not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now()
);

alter table public.expense_sequences enable row level security;
revoke all on table public.expense_sequences from public, anon, authenticated;

create or replace function public.shab_next_expense_number(p_expense_date date)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_year integer := extract(year from coalesce(p_expense_date, current_date))::integer;
  next_value bigint;
begin
  insert into public.expense_sequences(sequence_year, last_value, updated_at)
  values(target_year, 1, now())
  on conflict(sequence_year) do update set
    last_value = public.expense_sequences.last_value + 1,
    updated_at = now()
  returning last_value into next_value;

  return 'SHAB-EXP-' || target_year::text || '-' || lpad(next_value::text, 5, '0');
end;
$$;

revoke all on function public.shab_next_expense_number(date)
from public, anon, authenticated;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_number text not null unique,
  expense_date date not null default current_date,
  expense_type text not null,
  category text not null,
  description text not null,
  vendor_name text,
  currency text not null default 'AED',
  net_amount numeric(14,2) not null default 0,
  input_vat_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) generated always as (
    round(net_amount + input_vat_amount, 2)
  ) stored,
  tax_claim_status text not null default 'not_claimed',
  client_id uuid references public.clients(id) on delete restrict,
  case_id uuid references public.cases(id) on delete restrict,
  recoverable_from_client boolean not null default false,
  reimbursement_status text not null default 'not_applicable',
  billed_invoice_id uuid references public.invoices(id) on delete restrict,
  payment_method text,
  payment_reference text,
  receipt_reference text,
  notes text,
  status text not null default 'draft',
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expenses_type_check check (
    expense_type in ('firm_overhead', 'client_disbursement')
  ),
  constraint expenses_status_check check (
    status in ('draft', 'approved', 'paid', 'void')
  ),
  constraint expenses_tax_claim_check check (
    tax_claim_status in ('not_claimed', 'pending_review', 'claimable', 'claimed', 'non_recoverable')
  ),
  constraint expenses_reimbursement_check check (
    reimbursement_status in ('not_applicable', 'unbilled', 'billed', 'recovered', 'waived')
  ),
  constraint expenses_currency_check check (
    currency = upper(currency) and length(currency) = 3
  ),
  constraint expenses_amount_check check (
    net_amount >= 0 and input_vat_amount >= 0 and net_amount + input_vat_amount > 0
  ),
  constraint expenses_recoverable_client_check check (
    not recoverable_from_client or (expense_type = 'client_disbursement' and client_id is not null)
  ),
  constraint expenses_reimbursement_consistency_check check (
    (recoverable_from_client and reimbursement_status <> 'not_applicable')
    or (not recoverable_from_client and reimbursement_status = 'not_applicable')
  ),
  constraint expenses_invoice_consistency_check check (
    (billed_invoice_id is null and reimbursement_status in ('not_applicable', 'unbilled', 'waived'))
    or (billed_invoice_id is not null and reimbursement_status in ('billed', 'recovered'))
  )
);

create index if not exists expenses_date_idx
on public.expenses(expense_date desc, status);
create index if not exists expenses_client_idx
on public.expenses(client_id, expense_date desc) where client_id is not null;
create index if not exists expenses_case_idx
on public.expenses(case_id, expense_date desc) where case_id is not null;
create index if not exists expenses_recoverable_idx
on public.expenses(reimbursement_status, expense_date)
where recoverable_from_client and status <> 'void';

create or replace function public.shab_prepare_expense()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  case_client_id uuid;
  settings public.company_settings%rowtype;
begin
  if tg_op = 'INSERT' then
    new.expense_number := public.shab_next_expense_number(new.expense_date);
    new.created_by := coalesce(new.created_by, auth.uid());
    new.status := 'draft';
  elsif new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status in ('approved', 'void'))
      or (old.status = 'approved' and new.status in ('paid', 'void'))
    ) then
      raise exception 'Invalid expense status transition from % to %.', old.status, new.status;
    end if;
  end if;

  new.category := btrim(coalesce(new.category, ''));
  new.description := btrim(coalesce(new.description, ''));
  new.vendor_name := nullif(btrim(coalesce(new.vendor_name, '')), '');
  new.currency := upper(btrim(coalesce(new.currency, 'AED')));
  new.updated_at := now();

  if new.category = '' or new.description = '' then
    raise exception 'Expense category and description are required.';
  end if;

  if new.case_id is not null then
    select client_id into case_client_id from public.cases where id = new.case_id;
    if case_client_id is null then raise exception 'The selected case was not found.'; end if;
    if new.client_id is null then new.client_id := case_client_id; end if;
    if new.client_id <> case_client_id then
      raise exception 'The expense client must match the selected case client.';
    end if;
  end if;

  if new.recoverable_from_client then
    new.expense_type := 'client_disbursement';
    if new.reimbursement_status = 'not_applicable' then new.reimbursement_status := 'unbilled'; end if;
  else
    new.reimbursement_status := 'not_applicable';
    new.billed_invoice_id := null;
  end if;

  select * into settings from public.company_settings where id = 'primary';
  if not found or not coalesce(settings.vat_registered, false) then
    if new.tax_claim_status not in ('not_claimed', 'non_recoverable') then
      raise exception 'Input VAT cannot be marked for recovery until the company is VAT registered.';
    end if;
    new.tax_claim_status := 'not_claimed';
  end if;

  if new.status = 'void' and nullif(btrim(coalesce(new.void_reason, '')), '') is null then
    raise exception 'A reason is required to void an expense.';
  end if;

  perform public.shab_assert_accounting_date_open(new.expense_date);
  return new;
end;
$$;

revoke all on function public.shab_prepare_expense()
from public, anon, authenticated;

drop trigger if exists shab_prepare_expense_before_write on public.expenses;
create trigger shab_prepare_expense_before_write
before insert or update on public.expenses
for each row execute function public.shab_prepare_expense();

alter table public.expenses enable row level security;
drop policy if exists expenses_authenticated_read on public.expenses;
drop policy if exists expenses_authenticated_insert on public.expenses;
drop policy if exists expenses_authenticated_update on public.expenses;
create policy expenses_authenticated_read on public.expenses
for select to authenticated using (true);
create policy expenses_authenticated_insert on public.expenses
for insert to authenticated with check (auth.uid() is not null);
create policy expenses_authenticated_update on public.expenses
for update to authenticated
using (auth.uid() is not null) with check (auth.uid() is not null);
revoke all on public.expenses from public, anon;
grant select, insert, update on public.expenses to authenticated;

create or replace function public.shab_change_expense_status(
  p_expense_id uuid,
  p_status text,
  p_reason text default null
)
returns public.expenses
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target public.expenses%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  select * into target from public.expenses where id = p_expense_id for update;
  if not found then raise exception 'Expense was not found.'; end if;
  if p_status not in ('approved', 'paid', 'void') then
    raise exception 'This expense status cannot be selected manually.';
  end if;
  if p_status = 'void' and length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A meaningful void reason is required.';
  end if;

  update public.expenses set
    status = p_status,
    approved_at = case when p_status = 'approved' then now() else approved_at end,
    approved_by = case when p_status = 'approved' then auth.uid() else approved_by end,
    paid_at = case when p_status = 'paid' then now() else paid_at end,
    voided_at = case when p_status = 'void' then now() else voided_at end,
    void_reason = case when p_status = 'void' then btrim(p_reason) else void_reason end
  where id = p_expense_id
  returning * into target;

  return target;
end;
$$;

revoke all on function public.shab_change_expense_status(uuid, text, text)
from public, anon;
grant execute on function public.shab_change_expense_status(uuid, text, text)
to authenticated;

commit;
