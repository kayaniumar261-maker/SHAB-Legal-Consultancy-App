begin;

create or replace function public.shab_update_tax_settings(
  p_vat_registered boolean,
  p_tax_registration_number text,
  p_default_vat_rate numeric,
  p_vat_effective_date date
)
returns public.company_settings
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result public.company_settings%rowtype;
  normalized_trn text := nullif(regexp_replace(coalesce(p_tax_registration_number, ''), '[^0-9]', '', 'g'), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if coalesce(p_vat_registered, false) then
    if normalized_trn is null or length(normalized_trn) <> 15 then
      raise exception 'A UAE TRN must contain exactly 15 digits.';
    end if;
    if p_vat_effective_date is null then
      raise exception 'The FTA VAT effective date is required.';
    end if;
    if p_default_vat_rate is null or p_default_vat_rate <= 0 or p_default_vat_rate > 100 then
      raise exception 'Enter a valid default VAT rate.';
    end if;
  end if;

  update public.company_settings
  set
    vat_registered = coalesce(p_vat_registered, false),
    tax_registration_number = case when p_vat_registered then normalized_trn else null end,
    default_vat_rate = case when p_vat_registered then p_default_vat_rate else 0 end,
    vat_effective_date = case when p_vat_registered then p_vat_effective_date else null end,
    updated_at = now()
  where id = 'primary'
  returning * into result;

  return result;
end;
$$;

revoke all on function public.shab_update_tax_settings(boolean, text, numeric, date)
from public, anon;
grant execute on function public.shab_update_tax_settings(boolean, text, numeric, date)
to authenticated;

create or replace function public.shab_enforce_invoice_vat_registration()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  settings public.company_settings%rowtype;
  tax_date date := coalesce(new.supply_date, new.issue_date, current_date);
  uses_vat boolean := new.vat_treatment <> 'out_of_scope'
    or coalesce(new.is_tax_invoice, false)
    or coalesce(new.vat_rate, 0) > 0
    or coalesce(new.vat_amount, 0) > 0;
begin
  if not uses_vat then
    return new;
  end if;

  select * into settings from public.company_settings where id = 'primary';

  if not found
    or not coalesce(settings.vat_registered, false)
    or settings.tax_registration_number is null
    or settings.tax_registration_number !~ '^[0-9]{15}$'
  then
    raise exception 'VAT cannot be charged until the company has an active FTA registration and valid TRN.';
  end if;

  if settings.vat_effective_date is null or tax_date < settings.vat_effective_date then
    raise exception 'VAT cannot be charged before the FTA VAT effective date.';
  end if;

  return new;
end;
$$;

revoke all on function public.shab_enforce_invoice_vat_registration()
from public, anon, authenticated;

drop trigger if exists enforce_invoice_vat_registration_before_write
on public.invoices;

create trigger enforce_invoice_vat_registration_before_write
before insert or update of vat_treatment, vat_rate, vat_amount,
  is_tax_invoice, supply_date, issue_date
on public.invoices
for each row
execute function public.shab_enforce_invoice_vat_registration();

commit;
