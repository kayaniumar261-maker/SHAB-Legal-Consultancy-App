begin;

-- SHAB administrator-only financial security boundary.
-- Operations staff must not read or mutate finance data through tables,
-- storage policies, or privileged SECURITY DEFINER RPC functions.

do $$
declare
  configured_admins integer;
  invalid_admins integer;
begin
  select count(*) into configured_admins
  from public.access_administrator_allowlist;

  if configured_admins <> 3 then
    raise exception
      'Financial lockdown requires exactly three administrator emails; found %.',
      configured_admins;
  end if;

  select count(*) into invalid_admins
  from public.app_user_access access
  where access.access_role = 'administrator'
    and not exists (
      select 1
      from public.access_administrator_allowlist allowlist
      where allowlist.email = access.email
    );

  if invalid_admins <> 0 then
    raise exception
      'Financial lockdown found % administrator profiles outside the allowlist.',
      invalid_admins;
  end if;
end;
$$;

create or replace function public.shab_assert_financial_administrator()
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  -- Preserve trusted backend maintenance and migrations.
  if session_user in ('postgres', 'supabase_admin')
     or coalesce(auth.role(), '') = 'service_role' then
    return;
  end if;

  if not public.shab_is_administrator() then
    raise exception 'Administrator access is required for SHAB financial data.'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.shab_assert_financial_administrator()
from public, anon, authenticated;

create or replace function public.shab_guard_financial_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  perform public.shab_assert_financial_administrator();
  return null;
end;
$$;

revoke all on function public.shab_guard_financial_write()
from public, anon, authenticated;

do $$
declare
  financial_table text;
  existing_policy record;
  financial_tables constant text[] := array[
    'company_settings',
    'invoice_number_sequences',
    'payment_receipt_sequences',
    'credit_note_sequences',
    'payment_reversal_sequences',
    'fee_agreement_sequences',
    'expense_sequences',
    'invoices',
    'invoice_lifecycle_events',
    'payments',
    'credit_notes',
    'payment_reversals',
    'fee_agreements',
    'fee_installments',
    'client_fund_receipts',
    'client_fund_reversals',
    'payment_allocations',
    'payment_allocation_reversals',
    'accounting_periods',
    'expenses',
    'expense_attachments',
    'expense_activity',
    'expense_vendors',
    'expense_vendor_payments'
  ];
begin
  foreach financial_table in array financial_tables loop
    if to_regclass(format('public.%I', financial_table)) is null then
      raise exception 'Expected financial table public.% is missing.', financial_table;
    end if;

    execute format(
      'alter table public.%I enable row level security',
      financial_table
    );

    -- Remove every earlier permissive policy on this financial table.
    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = financial_table
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        existing_policy.policyname,
        financial_table
      );
    end loop;

    execute format(
      'create policy shab_administrator_financial_access on public.%I '
      'for all to authenticated '
      'using (public.shab_is_administrator()) '
      'with check (public.shab_is_administrator())',
      financial_table
    );

    -- Statement-level trigger also protects SECURITY DEFINER write RPCs,
    -- which otherwise run with the function owner's table privileges.
    execute format(
      'drop trigger if exists shab_administrator_financial_write_guard '
      'on public.%I',
      financial_table
    );

    execute format(
      'create trigger shab_administrator_financial_write_guard '
      'before insert or update or delete on public.%I '
      'for each statement execute function public.shab_guard_financial_write()',
      financial_table
    );
  end loop;
end;
$$;

-- Expense supporting documents contain financial evidence and must follow
-- the same administrator-only boundary.
drop policy if exists expense_documents_read on storage.objects;
drop policy if exists expense_documents_insert on storage.objects;
drop policy if exists expense_documents_delete_draft on storage.objects;
drop policy if exists expense_documents_administrator_access on storage.objects;

create policy expense_documents_administrator_access
on storage.objects
for all
to authenticated
using (
  bucket_id = 'expense-documents'
  and public.shab_is_administrator()
)
with check (
  bucket_id = 'expense-documents'
  and public.shab_is_administrator()
);

-- Fail the migration if any protected public table lacks the final policy or
-- the write guard. This makes a partial lockdown impossible to deploy.
do $$
declare
  financial_table text;
  financial_tables constant text[] := array[
    'company_settings',
    'invoice_number_sequences',
    'payment_receipt_sequences',
    'credit_note_sequences',
    'payment_reversal_sequences',
    'fee_agreement_sequences',
    'expense_sequences',
    'invoices',
    'invoice_lifecycle_events',
    'payments',
    'credit_notes',
    'payment_reversals',
    'fee_agreements',
    'fee_installments',
    'client_fund_receipts',
    'client_fund_reversals',
    'payment_allocations',
    'payment_allocation_reversals',
    'accounting_periods',
    'expenses',
    'expense_attachments',
    'expense_activity',
    'expense_vendors',
    'expense_vendor_payments'
  ];
begin
  foreach financial_table in array financial_tables loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = financial_table
        and policyname = 'shab_administrator_financial_access'
    ) then
      raise exception 'Administrator RLS policy missing on public.%.', financial_table;
    end if;

    if not exists (
      select 1
      from pg_trigger trigger_row
      join pg_class table_row on table_row.oid = trigger_row.tgrelid
      join pg_namespace schema_row on schema_row.oid = table_row.relnamespace
      where schema_row.nspname = 'public'
        and table_row.relname = financial_table
        and trigger_row.tgname = 'shab_administrator_financial_write_guard'
        and not trigger_row.tgisinternal
    ) then
      raise exception 'Financial write guard missing on public.%.', financial_table;
    end if;
  end loop;
end;
$$;

commit;
