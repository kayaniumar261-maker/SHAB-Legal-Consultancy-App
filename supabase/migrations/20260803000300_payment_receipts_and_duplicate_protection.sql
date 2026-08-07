begin;

alter table public.company_settings
  add column if not exists receipt_prefix text
    not null default 'SHAB-RCP';

update public.company_settings
set receipt_prefix = 'SHAB-RCP'
where id = 'primary'
  and nullif(btrim(receipt_prefix), '') is null;

alter table public.payments
  add column if not exists receipt_number text,
  add column if not exists receipt_issued_at timestamptz;

create table if not exists
  public.payment_receipt_sequences (
    sequence_year integer primary key,
    last_value bigint not null default 0,
    updated_at timestamptz not null default now(),

    constraint payment_receipt_sequence_positive
      check (last_value >= 0)
  );

alter table public.payment_receipt_sequences
  enable row level security;

revoke all
on table public.payment_receipt_sequences
from public, anon, authenticated;

create or replace function
  public.shab_next_payment_receipt_number(
    p_payment_date date
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
        p_payment_date,
        current_date
      )
    )::integer;

  select
    coalesce(
      nullif(btrim(receipt_prefix), ''),
      'SHAB-RCP'
    )
  into prefix_value
  from public.company_settings
  where id = 'primary';

  prefix_value :=
    coalesce(prefix_value, 'SHAB-RCP');

  insert into public.payment_receipt_sequences (
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
      public.payment_receipt_sequences.last_value + 1,
    updated_at = now()
  returning last_value
  into next_value;

  return
    prefix_value ||
    '-' ||
    target_year::text ||
    '-' ||
    lpad(next_value::text, 4, '0');
end;
$$;

revoke all
on function public.shab_next_payment_receipt_number(date)
from public, anon, authenticated;

create or replace function
  public.shab_assign_payment_receipt_number()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'completed'
    and nullif(btrim(new.receipt_number), '') is null
  then
    new.receipt_number :=
      public.shab_next_payment_receipt_number(
        coalesce(new.payment_date, current_date)
      );

    new.receipt_issued_at :=
      coalesce(new.paid_at, now());
  end if;

  return new;
end;
$$;

revoke all
on function public.shab_assign_payment_receipt_number()
from public, anon, authenticated;

drop trigger if exists
  shab_assign_payment_receipt_before_write
on public.payments;

create trigger
  shab_assign_payment_receipt_before_write
before insert or update of status
on public.payments
for each row
execute function
  public.shab_assign_payment_receipt_number();

do $$
declare
  payment_row record;
begin
  for payment_row in
    select
      id,
      payment_date,
      paid_at,
      created_at
    from public.payments
    where status = 'completed'
      and nullif(btrim(receipt_number), '') is null
    order by
      payment_date,
      created_at,
      id
  loop
    update public.payments
    set
      receipt_number =
        public.shab_next_payment_receipt_number(
          payment_row.payment_date
        ),
      receipt_issued_at =
        coalesce(
          payment_row.paid_at,
          payment_row.created_at,
          now()
        )
    where id = payment_row.id;
  end loop;
end;
$$;

create unique index if not exists
  payments_receipt_number_unique_idx
on public.payments(receipt_number)
where receipt_number is not null;

create unique index if not exists
  payments_active_reference_unique_idx
on public.payments(
  lower(btrim(reference_number))
)
where nullif(btrim(reference_number), '') is not null
  and status in ('pending', 'completed');

commit;
