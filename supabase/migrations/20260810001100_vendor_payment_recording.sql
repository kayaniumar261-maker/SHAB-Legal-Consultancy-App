begin;

alter table public.expenses
  add column if not exists paid_amount numeric(14,2) not null default 0;

update public.expenses
set paid_amount = total_amount
where status = 'paid' and paid_amount = 0;

alter table public.expenses drop constraint if exists expenses_paid_amount_check;
alter table public.expenses add constraint expenses_paid_amount_check
check (paid_amount >= 0 and paid_amount <= total_amount);

create or replace function public.shab_enforce_vendor_bill_payment_balance()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.vendor_id is not null and new.status = 'paid' and new.paid_amount <> new.total_amount then
    raise exception 'Vendor bills can only be marked paid through an exact recorded payment balance.';
  end if;
  return new;
end;
$$;

drop trigger if exists shab_vendor_bill_payment_balance_before_write on public.expenses;
create trigger shab_vendor_bill_payment_balance_before_write
before insert or update of status, paid_amount, total_amount on public.expenses
for each row execute function public.shab_enforce_vendor_bill_payment_balance();

create table if not exists public.expense_vendor_payments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete restrict,
  payment_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null check (length(trim(payment_method)) > 0),
  payment_reference text not null check (length(trim(payment_reference)) > 0),
  notes text,
  proof_file_name text,
  proof_storage_path text unique,
  recorded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint vendor_payment_proof_pair check (
    (proof_file_name is null and proof_storage_path is null)
    or (proof_file_name is not null and proof_storage_path is not null)
  )
);

create unique index if not exists expense_vendor_payment_reference_unique
on public.expense_vendor_payments(lower(trim(payment_reference)));
create index if not exists expense_vendor_payments_expense_idx
on public.expense_vendor_payments(expense_id, payment_date desc, created_at desc);

alter table public.expense_vendor_payments enable row level security;
drop policy if exists expense_vendor_payments_read on public.expense_vendor_payments;
create policy expense_vendor_payments_read on public.expense_vendor_payments
for select to authenticated using (true);
revoke all on public.expense_vendor_payments from public, anon, authenticated;
grant select on public.expense_vendor_payments to authenticated;

create or replace function public.shab_record_vendor_payment(
  p_expense_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_method text,
  p_payment_reference text,
  p_notes text default null,
  p_proof_file_name text default null,
  p_proof_storage_path text default null
)
returns public.expense_vendor_payments
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  bill public.expenses%rowtype;
  payment public.expense_vendor_payments%rowtype;
  new_paid numeric(14,2);
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if p_amount is null or round(p_amount, 2) <= 0 then raise exception 'Payment amount must be greater than zero.'; end if;
  if p_payment_date is null then raise exception 'Payment date is required.'; end if;
  if nullif(trim(p_payment_method), '') is null then raise exception 'Payment method is required.'; end if;
  if nullif(trim(p_payment_reference), '') is null then raise exception 'Payment reference is required.'; end if;
  if (p_proof_file_name is null) <> (p_proof_storage_path is null) then raise exception 'Payment proof details are incomplete.'; end if;

  select * into bill from public.expenses where id = p_expense_id for update;
  if not found then raise exception 'Vendor bill was not found.'; end if;
  if bill.vendor_id is null then raise exception 'A vendor must be linked before recording payment.'; end if;
  if bill.status <> 'approved' then raise exception 'Only approved vendor bills can be paid.'; end if;

  new_paid := round(bill.paid_amount + p_amount, 2);
  if new_paid > bill.total_amount then raise exception 'Payment exceeds the remaining vendor bill balance.'; end if;

  insert into public.expense_vendor_payments(
    expense_id, payment_date, amount, payment_method, payment_reference, notes,
    proof_file_name, proof_storage_path, recorded_by
  ) values (
    p_expense_id, p_payment_date, round(p_amount, 2), trim(p_payment_method),
    trim(p_payment_reference), nullif(trim(p_notes), ''), p_proof_file_name,
    p_proof_storage_path, auth.uid()
  ) returning * into payment;

  update public.expenses set
    paid_amount = new_paid,
    payment_method = trim(p_payment_method),
    payment_reference = trim(p_payment_reference),
    status = case when new_paid = total_amount then 'paid' else 'approved' end,
    paid_at = case when new_paid = total_amount then now() else null end,
    updated_at = now()
  where id = p_expense_id;

  return payment;
end;
$$;

revoke all on function public.shab_record_vendor_payment(uuid,date,numeric,text,text,text,text,text)
from public, anon;
grant execute on function public.shab_record_vendor_payment(uuid,date,numeric,text,text,text,text,text)
to authenticated;

commit;
