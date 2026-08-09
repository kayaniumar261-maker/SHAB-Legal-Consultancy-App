begin;

create unique index if not exists expenses_one_invoice_per_disbursement_idx
on public.expenses(billed_invoice_id)
where billed_invoice_id is not null;

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
    'Reimbursement of ' || target.expense_number || ': ' || target.description,
    'Recoverable client disbursement. Supplier: ' || coalesce(target.vendor_name, 'Not specified') || '.',
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

create or replace function public.shab_release_disbursement_invoice()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE'
     or (new.status in ('cancelled', 'written_off') and old.status not in ('cancelled', 'written_off')) then
    update public.expenses
    set reimbursement_status = 'unbilled',
        billed_invoice_id = null,
        updated_at = now()
    where billed_invoice_id = old.id
      and reimbursement_status = 'billed';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.shab_release_disbursement_invoice()
from public, anon, authenticated;

drop trigger if exists shab_release_disbursement_before_invoice_delete on public.invoices;
create trigger shab_release_disbursement_before_invoice_delete
before delete on public.invoices
for each row execute function public.shab_release_disbursement_invoice();

drop trigger if exists shab_release_disbursement_after_invoice_cancel on public.invoices;
create trigger shab_release_disbursement_after_invoice_cancel
after update of status on public.invoices
for each row execute function public.shab_release_disbursement_invoice();

commit;
