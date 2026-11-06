alter table public.private_sales_settings
  add column opening_month date,
  add column opening_balance numeric(12,2) not null default 0,
  add constraint private_sales_opening_first_day
    check (opening_month is null or extract(day from opening_month) = 1);
