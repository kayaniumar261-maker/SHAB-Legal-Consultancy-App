begin;

-- Reconcile draft invoices already created from recoverable disbursements.
update public.invoices invoice
set description = expense.category || ' - ' || expense.description || ' (' || expense.expense_number || ')',
    notes = 'Client disbursement dated ' || to_char(expense.expense_date, 'DD Mon YYYY') ||
      '. Supplier: ' || coalesce(expense.vendor_name, 'Not specified') ||
      '. Expense reference: ' || expense.expense_number || '.',
    updated_at = now()
from public.expenses expense
where expense.billed_invoice_id = invoice.id
  and invoice.status = 'draft';

create or replace function public.shab_bill_recoverable_disbursement(
  p_expense_id uuid,
  p_issue_date date,
  p_due_date date
)
returns public.invoices
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target public.expenses%rowtype;
  settings public.company_settings%rowtype;
  created_invoice public.invoices%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if p_issue_date is null or p_due_date is null or p_due_date < p_issue_date then
    raise exception 'Enter a valid invoice issue date and due date.';
  end if;

  select * into target
  from public.expenses
  where id = p_expense_id
  for update;

  if not found then raise exception 'Expense was not found.'; end if;
  if target.status not in ('approved', 'paid') then
    raise exception 'Only approved or paid expenses can be billed.';
  end if;
  if target.expense_type <> 'client_disbursement'
     or not target.recoverable_from_client
     or target.client_id is null then
    raise exception 'Only recoverable client disbursements can be billed.';
  end if;
  if target.reimbursement_status <> 'unbilled' or target.billed_invoice_id is not null then
    raise exception 'This disbursement has already been billed or is not available for billing.';
  end if;

  select * into settings from public.company_settings where id = 'primary';
  if coalesce(settings.vat_registered, false) then
    raise exception 'VAT registration is active. Review the recharge VAT treatment before creating this invoice.';
  end if;

  perform public.shab_assert_accounting_date_open(p_issue_date);

  insert into public.invoices (
    client_id, case_id, invoice_number, issue_date, due_date, status, currency,
    subtotal, vat_rate, vat_amount, discount_amount, total_amount, paid_amount,
    credited_amount, balance_amount, description, notes, created_by, amount,
    vat_treatment, supply_date, is_tax_invoice
  ) values (
    target.client_id,
    target.case_id,
    '',
    p_issue_date,
    p_due_date,
    'draft',
    target.currency,
    target.total_amount,
    0,
    0,
    0,
    target.total_amount,
    0,
    0,
    target.total_amount,
    target.category || ' - ' || target.description || ' (' || target.expense_number || ')',
    'Client disbursement dated ' || to_char(target.expense_date, 'DD Mon YYYY') ||
      '. Supplier: ' || coalesce(target.vendor_name, 'Not specified') ||
      '. Expense reference: ' || target.expense_number || '.',
    auth.uid(),
    target.total_amount,
    'out_of_scope',
    p_issue_date,
    false
  ) returning * into created_invoice;

  update public.expenses
  set reimbursement_status = 'billed',
      billed_invoice_id = created_invoice.id,
      updated_at = now()
  where id = target.id;

  return created_invoice;
end;
$$;

revoke all on function public.shab_bill_recoverable_disbursement(uuid, date, date)
from public, anon;
grant execute on function public.shab_bill_recoverable_disbursement(uuid, date, date)
to authenticated;

commit;
