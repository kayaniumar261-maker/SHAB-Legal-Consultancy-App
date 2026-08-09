begin;

create or replace function public.shab_reconcile_draft_invoice_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.status = 'draft' then
    new.paid_amount := coalesce(old.paid_amount, 0);
    new.credited_amount := coalesce(old.credited_amount, 0);
    new.balance_amount := greatest(
      round(
        coalesce(new.total_amount, 0)
        - coalesce(old.paid_amount, 0)
        - coalesce(old.credited_amount, 0),
        2
      ),
      0
    );
    new.amount := new.total_amount;
    perform set_config('shab.invoice_action', 'payment', true);
  end if;
  return new;
end;
$$;

revoke all on function public.shab_reconcile_draft_invoice_update()
from public, anon, authenticated;

drop trigger if exists aaa_reconcile_draft_invoice_before_update
on public.invoices;

create trigger aaa_reconcile_draft_invoice_before_update
before update of subtotal, vat_rate, vat_amount, vat_treatment,
  discount_amount, total_amount, supply_date, is_tax_invoice
on public.invoices
for each row
execute function public.shab_reconcile_draft_invoice_update();

commit;
