begin;
do $$
declare target text;
begin
  foreach target in array array[
    'expenses', 'expense_vendors', 'expense_attachments', 'expense_activity',
    'expense_vendor_payments', 'fee_agreements', 'fee_installments',
    'client_fund_receipts', 'client_fund_reversals', 'payment_allocations',
    'payment_allocation_reversals', 'accounting_periods', 'company_settings'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = target
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target);
    end if;
  end loop;
end;
$$;
commit;
