begin;

create or replace function public.shab_enforce_fee_plan_vat_registration()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  settings public.company_settings%rowtype;
  tax_date date;
begin
  if coalesce(new.vat_rate, 0) <= 0 then
    return new;
  end if;

  select * into settings
  from public.company_settings
  where id = 'primary';

  if not found
    or not coalesce(settings.vat_registered, false)
    or settings.tax_registration_number is null
    or settings.tax_registration_number !~ '^[0-9]{15}$'
  then
    raise exception 'VAT cannot be added to fee agreements or installments until the company has an active FTA registration and valid TRN.';
  end if;

  if tg_table_name = 'fee_agreements' then
    tax_date := coalesce(
      nullif(to_jsonb(new) ->> 'agreement_date', '')::date,
      current_date
    );
  else
    tax_date := coalesce(
      nullif(to_jsonb(new) ->> 'due_date', '')::date,
      current_date
    );
  end if;

  if settings.vat_effective_date is null or tax_date < settings.vat_effective_date then
    raise exception 'VAT cannot be planned before the FTA VAT effective date.';
  end if;

  return new;
end;
$$;

revoke all on function public.shab_enforce_fee_plan_vat_registration()
from public, anon, authenticated;

drop trigger if exists enforce_fee_agreement_vat_registration_before_write
on public.fee_agreements;

create trigger enforce_fee_agreement_vat_registration_before_write
before insert or update of vat_rate, agreement_date
on public.fee_agreements
for each row execute function public.shab_enforce_fee_plan_vat_registration();

drop trigger if exists enforce_fee_installment_vat_registration_before_write
on public.fee_installments;

create trigger enforce_fee_installment_vat_registration_before_write
before insert or update of vat_rate, due_date
on public.fee_installments
for each row execute function public.shab_enforce_fee_plan_vat_registration();

create or replace function public.shab_invoice_fee_installment(
  p_installment_id uuid,
  p_issue_date date default current_date
)
returns public.invoices
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  installment public.fee_installments%rowtype;
  agreement public.fee_agreements%rowtype;
  settings public.company_settings%rowtype;
  created_invoice public.invoices%rowtype;
  invoice_issue_date date := coalesce(p_issue_date, current_date);
  charge_vat boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into installment from public.fee_installments
  where id = p_installment_id for update;

  if not found then
    raise exception 'Installment was not found.';
  end if;

  if installment.invoice_id is not null or installment.status in ('invoiced', 'paid') then
    raise exception 'This installment already has an invoice.';
  end if;

  if installment.status <> 'ready' then
    raise exception 'Only ready installments can be invoiced.';
  end if;

  select * into agreement from public.fee_agreements
  where id = installment.agreement_id for update;

  if agreement.status <> 'active' then
    raise exception 'The fee agreement must be active before invoicing.';
  end if;

  select * into settings from public.company_settings where id = 'primary';
  charge_vat := coalesce(installment.vat_rate, 0) > 0;

  if charge_vat and (
    not found
    or not coalesce(settings.vat_registered, false)
    or settings.tax_registration_number is null
    or settings.tax_registration_number !~ '^[0-9]{15}$'
    or settings.vat_effective_date is null
    or invoice_issue_date < settings.vat_effective_date
  ) then
    raise exception 'VAT cannot be charged until the company FTA registration is active for the invoice date.';
  end if;

  insert into public.invoices (
    client_id, case_id, invoice_number, issue_date, supply_date, due_date,
    status, currency, subtotal, vat_treatment, vat_rate, vat_amount,
    is_tax_invoice, discount_amount, total_amount, paid_amount, credited_amount,
    balance_amount, description, notes, created_by, amount
  )
  values (
    agreement.client_id,
    agreement.case_id,
    '',
    invoice_issue_date,
    invoice_issue_date,
    installment.due_date,
    'issued',
    agreement.currency,
    installment.planned_subtotal,
    case when charge_vat then 'standard' else 'out_of_scope' end,
    case when charge_vat then installment.vat_rate else 0 end,
    case when charge_vat then installment.vat_amount else 0 end,
    charge_vat,
    0,
    case when charge_vat then installment.total_amount else installment.planned_subtotal end,
    0,
    0,
    case when charge_vat then installment.total_amount else installment.planned_subtotal end,
    installment.title,
    concat('Fee agreement ', agreement.agreement_number),
    auth.uid(),
    case when charge_vat then installment.total_amount else installment.planned_subtotal end
  )
  returning * into created_invoice;

  update public.fee_installments
  set
    invoice_id = created_invoice.id,
    status = 'invoiced',
    invoiced_at = now(),
    status_reason = null
  where id = installment.id;

  return created_invoice;
end;
$$;

revoke all on function public.shab_invoice_fee_installment(uuid, date)
from public, anon;
grant execute on function public.shab_invoice_fee_installment(uuid, date)
to authenticated;

commit;
