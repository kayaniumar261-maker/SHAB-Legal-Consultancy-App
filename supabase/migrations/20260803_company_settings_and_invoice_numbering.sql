begin;

create table if not exists public.company_settings (
  id text primary key,
  legal_name text not null,
  registered_address text,
  email text,
  phone text,
  tax_registration_number text,

  bank_name text,
  account_holder_name text,
  account_number text,
  iban text,
  swift_bic text,
  routing_code text,
  account_currency text not null default 'AED',

  invoice_prefix text not null default 'SHAB',
  payment_instructions text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_settings_singleton_check
    check (id = 'primary')
);

alter table public.company_settings
  enable row level security;

drop policy if exists
  company_settings_authenticated_read
  on public.company_settings;

create policy company_settings_authenticated_read
  on public.company_settings
  for select
  to authenticated
  using (id = 'primary');

revoke all
  on table public.company_settings
  from anon;

grant select
  on table public.company_settings
  to authenticated;

insert into public.company_settings (
  id,
  legal_name,
  registered_address,
  account_currency,
  invoice_prefix
)
values (
  'primary',
  'SHAB Legal Consultants FZC',
  'Business Center, COWORKING, Sharjah Publishing City Free Zone, Sharjah, United Arab Emirates',
  'AED',
  'SHAB'
)
on conflict (id) do nothing;

create table if not exists
  public.invoice_number_sequences (
    sequence_year integer primary key,
    last_value bigint not null default 0,
    updated_at timestamptz not null default now(),

    constraint invoice_number_sequence_positive
      check (last_value >= 0)
  );

alter table public.invoice_number_sequences
  enable row level security;

revoke all
  on table public.invoice_number_sequences
  from anon, authenticated;

create or replace function
  public.shab_next_invoice_number(
    p_issue_date date
  )
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_year integer;
  next_value bigint;
  prefix_value text;
begin
  target_year :=
    extract(
      year from coalesce(
        p_issue_date,
        current_date
      )
    )::integer;

  select
    coalesce(
      nullif(
        btrim(invoice_prefix),
        ''
      ),
      'SHAB'
    )
  into prefix_value
  from public.company_settings
  where id = 'primary';

  prefix_value :=
    coalesce(
      prefix_value,
      'SHAB'
    );

  insert into public.invoice_number_sequences (
    sequence_year,
    last_value,
    updated_at
  )
  values (
    target_year,
    1,
    now()
  )
  on conflict (sequence_year)
  do update set
    last_value =
      public.invoice_number_sequences.last_value + 1,
    updated_at = now()
  returning last_value
  into next_value;

  return
    prefix_value ||
    '-' ||
    target_year::text ||
    '-' ||
    lpad(
      next_value::text,
      4,
      '0'
    );
end;
$$;

revoke all
  on function public.shab_next_invoice_number(date)
  from public, anon, authenticated;

create or replace function
  public.shab_assign_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  new.invoice_number :=
    public.shab_next_invoice_number(
      coalesce(
        new.issue_date,
        current_date
      )
    );

  return new;
end;
$$;

revoke all
  on function public.shab_assign_invoice_number()
  from public, anon, authenticated;

drop trigger if exists
  shab_assign_invoice_number_before_insert
  on public.invoices;

create trigger
  shab_assign_invoice_number_before_insert
before insert
  on public.invoices
for each row
execute function
  public.shab_assign_invoice_number();

create unique index if not exists
  invoices_invoice_number_unique_idx
on public.invoices (
  invoice_number
);

commit;
