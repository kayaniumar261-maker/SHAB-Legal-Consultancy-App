begin;

alter table public.expenses
  add column if not exists supplier_invoice_number text,
  add column if not exists supplier_invoice_date date,
  add column if not exists due_date date,
  add column if not exists payment_terms text;

alter table public.expenses
  add constraint expenses_supplier_due_date_check
  check (due_date is null or supplier_invoice_date is null or due_date >= supplier_invoice_date);

create unique index if not exists expenses_vendor_supplier_invoice_unique
on public.expenses(vendor_id, lower(trim(supplier_invoice_number)))
where vendor_id is not null and supplier_invoice_number is not null and trim(supplier_invoice_number) <> '';

create index if not exists expenses_open_due_date_idx
on public.expenses(due_date)
where status in ('draft', 'approved') and due_date is not null;

commit;
