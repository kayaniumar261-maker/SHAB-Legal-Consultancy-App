begin;

create or replace function public.shab_validate_tax_document()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  document_data jsonb := to_jsonb(new);
  expected_vat numeric(14, 2);
  expected_total numeric(14, 2);
  discount numeric(14, 2) := 0;
  accounting_date date;
begin
  if new.currency is null
    or new.currency <> upper(new.currency)
    or length(new.currency) <> 3
  then
    raise exception 'Currency must be a three-letter uppercase code.';
  end if;

  if new.vat_treatment in ('zero_rated', 'out_of_scope') then
    if new.vat_rate <> 0 or new.vat_amount <> 0 then
      raise exception 'Zero-rated and out-of-scope documents cannot contain VAT.';
    end if;
  else
    expected_vat := round(new.subtotal * new.vat_rate / 100, 2);
    if new.vat_amount <> expected_vat then
      raise exception 'VAT amount does not match the taxable subtotal and VAT rate.';
    end if;
  end if;

  discount := coalesce(nullif(document_data ->> 'discount_amount', '')::numeric, 0);
  expected_total := round(new.subtotal + new.vat_amount - discount, 2);
  if new.total_amount <> expected_total then
    raise exception 'Document total does not reconcile with subtotal, VAT and discount.';
  end if;

  accounting_date := coalesce(
    nullif(document_data ->> 'supply_date', '')::date,
    nullif(document_data ->> 'tax_point_date', '')::date,
    nullif(document_data ->> 'issue_date', '')::date
  );
  perform public.shab_assert_accounting_date_open(accounting_date);
  return new;
end;
$$;

revoke all on function public.shab_validate_tax_document()
from public, anon, authenticated;

commit;
