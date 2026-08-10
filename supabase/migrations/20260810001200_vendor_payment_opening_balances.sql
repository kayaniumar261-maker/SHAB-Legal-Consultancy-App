begin;

-- Create auditable opening-balance transactions only for the difference between
-- each legacy vendor bill's carried-forward paid amount and its recorded payments.
with payment_totals as (
  select expense_id, coalesce(sum(amount), 0)::numeric(14,2) as recorded_amount
  from public.expense_vendor_payments
  group by expense_id
), missing_opening_balances as (
  select
    expense.id as expense_id,
    coalesce(expense.paid_at::date, expense.expense_date) as payment_date,
    round(expense.paid_amount - coalesce(payment_totals.recorded_amount, 0), 2) as missing_amount,
    'OPENING-' || expense.expense_number as payment_reference,
    expense.expense_number
  from public.expenses expense
  left join payment_totals on payment_totals.expense_id = expense.id
  where expense.vendor_id is not null
    and expense.paid_amount > coalesce(payment_totals.recorded_amount, 0)
)
insert into public.expense_vendor_payments (
  expense_id,
  payment_date,
  amount,
  payment_method,
  payment_reference,
  notes,
  proof_file_name,
  proof_storage_path,
  recorded_by
)
select
  expense_id,
  payment_date,
  missing_amount,
  'Opening Balance Reconciliation',
  payment_reference,
  'System reconciliation for a vendor bill marked paid before detailed vendor-payment recording was introduced.',
  null,
  null,
  null
from missing_opening_balances
where missing_amount > 0
  and not exists (
    select 1
    from public.expense_vendor_payments payment
    where lower(trim(payment.payment_reference)) = lower(trim(missing_opening_balances.payment_reference))
  );

-- Refuse to complete if any carried-forward paid amount still lacks an equal
-- transaction history after reconciliation.
do $$
declare
  mismatch_count integer;
begin
  select count(*) into mismatch_count
  from public.expenses expense
  where expense.vendor_id is not null
    and expense.paid_amount <> coalesce((
      select sum(payment.amount)
      from public.expense_vendor_payments payment
      where payment.expense_id = expense.id
    ), 0);

  if mismatch_count > 0 then
    raise exception 'Vendor payment reconciliation failed for % bill(s).', mismatch_count;
  end if;
end;
$$;

commit;
