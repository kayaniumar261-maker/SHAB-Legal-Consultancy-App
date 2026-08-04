begin;

alter table public.company_settings
  add column if not exists credit_note_prefix text
    not null default 'SHAB-CN',
  add column if not exists payment_reversal_prefix text
    not null default 'SHAB-REV';

update public.company_settings
set
  credit_note_prefix =
    coalesce(
      nullif(btrim(credit_note_prefix), ''),
      'SHAB-CN'
    ),
  payment_reversal_prefix =
    coalesce(
      nullif(btrim(payment_reversal_prefix), ''),
      'SHAB-REV'
    )
where id = 'primary';


alter table public.invoices
  add column if not exists credited_amount
    numeric(14, 2) not null default 0;

alter table public.invoices
  drop constraint if exists invoices_credited_amount_check;

alter table public.invoices
  add constraint invoices_credited_amount_check
  check (
    credited_amount >= 0
    and credited_amount <= total_amount
  );

alter table public.invoices
  drop constraint if exists invoices_status_check;

alter table public.invoices
  add constraint invoices_status_check
  check (
    status in (
      'draft',
      'issued',
      'partially_paid',
      'paid',
      'overdue',
      'partially_credited',
      'credited',
      'cancelled',
      'written_off'
    )
  );


alter table public.payments
  add column if not exists reversed_amount
    numeric(14, 2) not null default 0;

alter table public.payments
  drop constraint if exists payments_reversed_amount_check;

alter table public.payments
  add constraint payments_reversed_amount_check
  check (
    reversed_amount >= 0
    and reversed_amount <= amount
  );


create table if not exists
  public.credit_note_sequences (
    sequence_year integer primary key,
    last_value bigint not null default 0,
    updated_at timestamptz not null default now(),

    constraint credit_note_sequence_positive
      check (last_value >= 0)
  );

alter table public.credit_note_sequences
  enable row level security;

revoke all
on table public.credit_note_sequences
from public, anon, authenticated;


create table if not exists
  public.payment_reversal_sequences (
    sequence_year integer primary key,
    last_value bigint not null default 0,
    updated_at timestamptz not null default now(),

    constraint payment_reversal_sequence_positive
      check (last_value >= 0)
  );

alter table public.payment_reversal_sequences
  enable row level security;

revoke all
on table public.payment_reversal_sequences
from public, anon, authenticated;


create table if not exists public.credit_notes (
  id uuid primary key default gen_random_uuid(),

  credit_note_number text not null unique,

  invoice_id uuid not null
    references public.invoices(id)
    on delete restrict,

  client_id uuid not null
    references public.clients(id)
    on delete restrict,

  case_id uuid
    references public.cases(id)
    on delete set null,

  issue_date date not null default current_date,

  subtotal numeric(14, 2) not null
    check (subtotal > 0),

  vat_rate numeric(7, 4) not null default 5
    check (
      vat_rate >= 0
      and vat_rate <= 100
    ),

  vat_amount numeric(14, 2) not null
    check (vat_amount >= 0),

  total_amount numeric(14, 2) not null
    check (total_amount > 0),

  currency text not null default 'AED',

  reason text not null
    check (length(btrim(reason)) >= 5),

  status text not null default 'issued'
    check (status in ('issued')),

  created_by uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),

  created_at timestamptz not null default now()
);

create index if not exists
  credit_notes_invoice_idx
on public.credit_notes(
  invoice_id,
  created_at desc
);

create index if not exists
  credit_notes_client_idx
on public.credit_notes(
  client_id,
  created_at desc
);

alter table public.credit_notes
  enable row level security;

drop policy if exists
  credit_notes_authenticated_read
on public.credit_notes;

create policy
  credit_notes_authenticated_read
on public.credit_notes
for select
to authenticated
using (true);

revoke all
on table public.credit_notes
from anon;

revoke insert, update, delete
on table public.credit_notes
from authenticated;

grant select
on table public.credit_notes
to authenticated;


create table if not exists public.payment_reversals (
  id uuid primary key default gen_random_uuid(),

  reversal_number text not null unique,

  payment_id uuid not null
    references public.payments(id)
    on delete restrict,

  invoice_id uuid not null
    references public.invoices(id)
    on delete restrict,

  amount numeric(14, 2) not null
    check (amount > 0),

  currency text not null default 'AED',

  reversal_date date not null default current_date,

  reason text not null
    check (length(btrim(reason)) >= 5),

  created_by uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),

  created_at timestamptz not null default now()
);

create index if not exists
  payment_reversals_payment_idx
on public.payment_reversals(
  payment_id,
  created_at desc
);

create index if not exists
  payment_reversals_invoice_idx
on public.payment_reversals(
  invoice_id,
  created_at desc
);

alter table public.payment_reversals
  enable row level security;

drop policy if exists
  payment_reversals_authenticated_read
on public.payment_reversals;

create policy
  payment_reversals_authenticated_read
on public.payment_reversals
for select
to authenticated
using (true);

revoke all
on table public.payment_reversals
from anon;

revoke insert, update, delete
on table public.payment_reversals
from authenticated;

grant select
on table public.payment_reversals
to authenticated;


create or replace function
  public.shab_next_credit_note_number(
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

  select coalesce(
    nullif(btrim(credit_note_prefix), ''),
    'SHAB-CN'
  )
  into prefix_value
  from public.company_settings
  where id = 'primary';

  prefix_value :=
    coalesce(prefix_value, 'SHAB-CN');

  insert into public.credit_note_sequences (
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
      public.credit_note_sequences.last_value + 1,
    updated_at = now()
  returning last_value
  into next_value;

  return
    prefix_value || '-' ||
    target_year::text || '-' ||
    lpad(next_value::text, 4, '0');
end;
$$;

revoke all
on function public.shab_next_credit_note_number(date)
from public, anon, authenticated;


create or replace function
  public.shab_next_payment_reversal_number(
    p_reversal_date date
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
        p_reversal_date,
        current_date
      )
    )::integer;

  select coalesce(
    nullif(
      btrim(payment_reversal_prefix),
      ''
    ),
    'SHAB-REV'
  )
  into prefix_value
  from public.company_settings
  where id = 'primary';

  prefix_value :=
    coalesce(prefix_value, 'SHAB-REV');

  insert into public.payment_reversal_sequences (
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
      public.payment_reversal_sequences.last_value + 1,
    updated_at = now()
  returning last_value
  into next_value;

  return
    prefix_value || '-' ||
    target_year::text || '-' ||
    lpad(next_value::text, 4, '0');
end;
$$;

revoke all
on function public.shab_next_payment_reversal_number(date)
from public, anon, authenticated;


create or replace function
  public.refresh_invoice_totals(
    p_invoice_id uuid
  )
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  invoice_total numeric(14, 2);
  paid_total numeric(14, 2);
  credited_total numeric(14, 2);
  net_total numeric(14, 2);
  current_status text;
begin
  select
    total_amount,
    status
  into
    invoice_total,
    current_status
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    return;
  end if;

  select coalesce(
    sum(
      greatest(
        amount -
        coalesce(reversed_amount, 0),
        0
      )
    ),
    0
  )
  into paid_total
  from public.payments
  where invoice_id = p_invoice_id
    and status in (
      'completed',
      'refunded'
    );

  select coalesce(
    sum(total_amount),
    0
  )
  into credited_total
  from public.credit_notes
  where invoice_id = p_invoice_id
    and status = 'issued';

  credited_total :=
    least(
      credited_total,
      invoice_total
    );

  net_total :=
    greatest(
      invoice_total - credited_total,
      0
    );

  perform set_config(
    'shab.invoice_action',
    'payment',
    true
  );

  update public.invoices
  set
    paid_amount = paid_total,
    credited_amount = credited_total,
    balance_amount =
      greatest(
        net_total - paid_total,
        0
      ),
    status =
      case
        when current_status = 'draft'
          then 'draft'

        when credited_total >= invoice_total
          then 'credited'

        when net_total > 0
          and paid_total >= net_total
          then 'paid'

        when paid_total > 0
          then 'partially_paid'

        when credited_total > 0
          then 'partially_credited'

        else 'issued'
      end,
    updated_at = now()
  where id = p_invoice_id;
end;
$$;

revoke all
on function public.refresh_invoice_totals(uuid)
from public, anon, authenticated;


create or replace function public.shab_issue_credit_note(
  p_invoice_id uuid,
  p_subtotal numeric,
  p_vat_rate numeric,
  p_issue_date date,
  p_reason text
)
returns public.credit_notes
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_invoice public.invoices%rowtype;
  created_note public.credit_notes%rowtype;
  calculated_vat numeric(14, 2);
  calculated_total numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;

  if p_subtotal is null
    or p_subtotal <= 0
  then
    raise exception
      'Credit-note subtotal must be greater than zero.';
  end if;

  if p_vat_rate is null
    or p_vat_rate < 0
    or p_vat_rate > 100
  then
    raise exception
      'Credit-note VAT rate is invalid.';
  end if;

  if nullif(btrim(p_reason), '') is null
    or length(btrim(p_reason)) < 5
  then
    raise exception
      'A meaningful credit-note reason is required.';
  end if;

  select *
  into target_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception
      'Invoice was not found.';
  end if;

  if target_invoice.status in (
    'draft',
    'cancelled',
    'written_off',
    'credited'
  ) then
    raise exception
      'A credit note cannot be issued against this invoice status.';
  end if;

  calculated_vat :=
    round(
      p_subtotal *
      p_vat_rate /
      100,
      2
    );

  calculated_total :=
    round(
      p_subtotal +
      calculated_vat,
      2
    );

  if calculated_total >
    coalesce(
      target_invoice.balance_amount,
      0
    )
  then
    raise exception
      'Credit note cannot exceed the outstanding invoice balance.';
  end if;

  insert into public.credit_notes (
    credit_note_number,
    invoice_id,
    client_id,
    case_id,
    issue_date,
    subtotal,
    vat_rate,
    vat_amount,
    total_amount,
    currency,
    reason,
    created_by
  )
  values (
    public.shab_next_credit_note_number(
      coalesce(p_issue_date, current_date)
    ),
    target_invoice.id,
    target_invoice.client_id,
    target_invoice.case_id,
    coalesce(p_issue_date, current_date),
    round(p_subtotal, 2),
    p_vat_rate,
    calculated_vat,
    calculated_total,
    target_invoice.currency,
    btrim(p_reason),
    auth.uid()
  )
  returning *
  into created_note;

  perform public.refresh_invoice_totals(
    target_invoice.id
  );

  return created_note;
end;
$$;

revoke all
on function public.shab_issue_credit_note(
  uuid,
  numeric,
  numeric,
  date,
  text
)
from public, anon;

grant execute
on function public.shab_issue_credit_note(
  uuid,
  numeric,
  numeric,
  date,
  text
)
to authenticated;


create or replace function public.shab_reverse_payment(
  p_payment_id uuid,
  p_amount numeric,
  p_reversal_date date,
  p_reason text
)
returns public.payment_reversals
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_payment public.payments%rowtype;
  created_reversal public.payment_reversals%rowtype;
  available_amount numeric(14, 2);
  next_reversed_amount numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;

  if p_amount is null
    or p_amount <= 0
  then
    raise exception
      'Reversal amount must be greater than zero.';
  end if;

  if nullif(btrim(p_reason), '') is null
    or length(btrim(p_reason)) < 5
  then
    raise exception
      'A meaningful reversal reason is required.';
  end if;

  select *
  into target_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception
      'Payment was not found.';
  end if;

  if target_payment.status not in (
    'completed',
    'refunded'
  ) then
    raise exception
      'Only completed payments may be reversed.';
  end if;

  available_amount :=
    target_payment.amount -
    coalesce(
      target_payment.reversed_amount,
      0
    );

  if p_amount > available_amount then
    raise exception
      'Reversal cannot exceed the unreversed payment amount.';
  end if;

  insert into public.payment_reversals (
    reversal_number,
    payment_id,
    invoice_id,
    amount,
    currency,
    reversal_date,
    reason,
    created_by
  )
  values (
    public.shab_next_payment_reversal_number(
      coalesce(
        p_reversal_date,
        current_date
      )
    ),
    target_payment.id,
    target_payment.invoice_id,
    round(p_amount, 2),
    target_payment.currency,
    coalesce(
      p_reversal_date,
      current_date
    ),
    btrim(p_reason),
    auth.uid()
  )
  returning *
  into created_reversal;

  next_reversed_amount :=
    coalesce(
      target_payment.reversed_amount,
      0
    ) +
    round(p_amount, 2);

  perform set_config(
    'shab.payment_action',
    'reverse',
    true
  );

  update public.payments
  set
    reversed_amount =
      next_reversed_amount,
    status =
      case
        when next_reversed_amount >= amount
          then 'refunded'
        else status
      end,
    updated_at = now()
  where id = target_payment.id;

  perform public.refresh_invoice_totals(
    target_payment.invoice_id
  );

  return created_reversal;
end;
$$;

revoke all
on function public.shab_reverse_payment(
  uuid,
  numeric,
  date,
  text
)
from public, anon;

grant execute
on function public.shab_reverse_payment(
  uuid,
  numeric,
  date,
  text
)
to authenticated;


create or replace function
  public.shab_guard_payment_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  internal_action text;
begin
  internal_action :=
    coalesce(
      current_setting(
        'shab.payment_action',
        true
      ),
      ''
    );

  if tg_op = 'DELETE' then
    if old.status in (
      'completed',
      'refunded'
    )
      or old.receipt_number is not null
    then
      raise exception
        'Completed payment history cannot be deleted. Use payment reversal.';
    end if;

    return old;
  end if;

  if old.status in (
    'completed',
    'refunded'
  )
    or old.receipt_number is not null
  then
    if internal_action <> 'reverse' then
      raise exception
        'Completed payment history is immutable. Use payment reversal.';
    end if;

    if
      new.invoice_id is distinct from old.invoice_id
      or new.client_id is distinct from old.client_id
      or new.case_id is distinct from old.case_id
      or new.amount is distinct from old.amount
      or new.currency is distinct from old.currency
      or new.payment_date is distinct from old.payment_date
      or new.payment_method is distinct from old.payment_method
      or new.reference_number is distinct from old.reference_number
      or new.receipt_number is distinct from old.receipt_number
      or new.receipt_issued_at is distinct from old.receipt_issued_at
    then
      raise exception
        'Original payment and receipt details cannot be changed.';
    end if;
  end if;

  if new.reversed_amount is distinct from old.reversed_amount
    and internal_action <> 'reverse'
  then
    raise exception
      'Payment reversal totals are managed automatically.';
  end if;

  return new;
end;
$$;

revoke all
on function public.shab_guard_payment_history()
from public, anon, authenticated;

drop trigger if exists
  shab_guard_payment_history_before_write
on public.payments;

create trigger
  shab_guard_payment_history_before_write
before update or delete
on public.payments
for each row
execute function
  public.shab_guard_payment_history();


create or replace function
  public.shab_guard_invoice_credit_total()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  internal_action text;
begin
  internal_action :=
    coalesce(
      current_setting(
        'shab.invoice_action',
        true
      ),
      ''
    );

  if new.credited_amount
    is distinct from old.credited_amount
    and internal_action not in (
      'payment',
      'credit_note'
    )
  then
    raise exception
      'Invoice credit totals are managed automatically through credit notes.';
  end if;

  return new;
end;
$$;

revoke all
on function public.shab_guard_invoice_credit_total()
from public, anon, authenticated;

drop trigger if exists
  shab_guard_invoice_credit_total_before_update
on public.invoices;

create trigger
  shab_guard_invoice_credit_total_before_update
before update of credited_amount
on public.invoices
for each row
execute function
  public.shab_guard_invoice_credit_total();


drop index if exists
  public.payments_active_reference_unique_idx;

create unique index
  payments_active_reference_unique_idx
on public.payments(
  lower(btrim(reference_number))
)
where nullif(btrim(reference_number), '') is not null
  and status in (
    'pending',
    'completed',
    'refunded'
  );


create or replace function
  public.shab_guard_credit_status()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  internal_action text;
begin
  internal_action :=
    coalesce(
      current_setting(
        'shab.invoice_action',
        true
      ),
      ''
    );

  if new.status in (
    'partially_credited',
    'credited'
  )
    and new.status is distinct from old.status
    and internal_action not in (
      'payment',
      'credit_note'
    )
  then
    raise exception
      'Invoice credit status is managed automatically through credit notes.';
  end if;

  if old.status = 'credited'
    and internal_action not in (
      'payment',
      'credit_note'
    )
  then
    raise exception
      'Fully credited invoices are finalized and cannot be modified.';
  end if;

  return new;
end;
$$;

revoke all
on function public.shab_guard_credit_status()
from public, anon, authenticated;

drop trigger if exists
  shab_guard_credit_status_before_update
on public.invoices;

create trigger
  shab_guard_credit_status_before_update
before update
on public.invoices
for each row
execute function
  public.shab_guard_credit_status();


create or replace function
  public.shab_prevent_credit_note_cancellation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'cancelled'
    and old.status <> 'cancelled'
    and (
      coalesce(old.credited_amount, 0) > 0
      or exists (
        select 1
        from public.credit_notes
        where invoice_id = old.id
          and status = 'issued'
      )
    )
  then
    raise exception
      'Invoices with issued credit notes cannot be cancelled.';
  end if;

  return new;
end;
$$;

revoke all
on function public.shab_prevent_credit_note_cancellation()
from public, anon, authenticated;

drop trigger if exists
  shab_prevent_credit_note_cancellation_before_update
on public.invoices;

create trigger
  shab_prevent_credit_note_cancellation_before_update
before update
on public.invoices
for each row
execute function
  public.shab_prevent_credit_note_cancellation();


commit;
