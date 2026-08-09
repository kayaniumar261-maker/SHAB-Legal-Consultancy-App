begin;

-- Firm overhead is a company-level cost. Remove legacy client/matter links
-- before enforcing the rule for all future inserts and updates.
update public.expenses
set client_id = null,
    case_id = null,
    recoverable_from_client = false,
    updated_at = now()
where expense_type = 'firm_overhead'
  and (
    client_id is not null
    or case_id is not null
    or recoverable_from_client is true
  );

alter table public.expenses
  drop constraint if exists expenses_firm_overhead_company_only;

alter table public.expenses
  add constraint expenses_firm_overhead_company_only
  check (
    expense_type <> 'firm_overhead'
    or (
      client_id is null
      and case_id is null
      and recoverable_from_client is false
    )
  ) not valid;

alter table public.expenses
  validate constraint expenses_firm_overhead_company_only;

commit;
