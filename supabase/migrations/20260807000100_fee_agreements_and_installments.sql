begin;

create table if not exists public.fee_agreement_sequences (
  sequence_year integer primary key,
  last_value bigint not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now()
);

alter table public.fee_agreement_sequences enable row level security;
revoke all on table public.fee_agreement_sequences from public, anon, authenticated;

create or replace function public.shab_next_fee_agreement_number(
  p_agreement_date date
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_year integer;
  next_value bigint;
begin
  target_year := extract(
    year from coalesce(p_agreement_date, current_date)
  )::integer;

  insert into public.fee_agreement_sequences (
    sequence_year,
    last_value,
    updated_at
  )
  values (target_year, 1, now())
  on conflict (sequence_year)
  do update set
    last_value = public.fee_agreement_sequences.last_value + 1,
    updated_at = now()
  returning last_value into next_value;

  return 'SHAB-FEE-' || target_year::text || '-' ||
    lpad(next_value::text, 4, '0');
end;
$$;

revoke all on function public.shab_next_fee_agreement_number(date)
from public, anon, authenticated;

create table if not exists public.fee_agreements (
  id uuid primary key default gen_random_uuid(),
  agreement_number text not null unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  case_id uuid references public.cases(id) on delete restrict,
  title text not null,
  billing_model text not null,
  status text not null default 'draft',
  currency text not null default 'AED',
  agreed_fee numeric(14, 2) not null default 0,
  vat_rate numeric(7, 4) not null default 5,
  hourly_rate numeric(14, 2),
  success_fee_percentage numeric(7, 4),
  agreement_date date not null default current_date,
  valid_from date,
  valid_until date,
  notes text,
  cancellation_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fee_agreements_billing_model_check check (
    billing_model in (
      'fixed', 'installments', 'milestones', 'hourly',
      'retainer', 'success_fee', 'mixed'
    )
  ),
  constraint fee_agreements_status_check check (
    status in ('draft', 'active', 'completed', 'expired', 'cancelled')
  ),
  constraint fee_agreements_currency_check check (
    currency = upper(currency) and length(currency) = 3
  ),
  constraint fee_agreements_fee_check check (agreed_fee >= 0),
  constraint fee_agreements_vat_check check (vat_rate between 0 and 100),
  constraint fee_agreements_hourly_rate_check check (
    hourly_rate is null or hourly_rate >= 0
  ),
  constraint fee_agreements_success_fee_check check (
    success_fee_percentage is null or
    success_fee_percentage between 0 and 100
  ),
  constraint fee_agreements_validity_check check (
    valid_until is null or valid_from is null or valid_until >= valid_from
  ),
  constraint fee_agreements_case_client_check check (
    case_id is not null or client_id is not null
  )
);

create index if not exists fee_agreements_client_idx
on public.fee_agreements(client_id, agreement_date desc);

create index if not exists fee_agreements_case_idx
on public.fee_agreements(case_id, agreement_date desc)
where case_id is not null;

create unique index if not exists fee_agreements_one_open_case_idx
on public.fee_agreements(case_id)
where case_id is not null and status in ('draft', 'active');

create or replace function public.shab_prepare_fee_agreement()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  case_client_id uuid;
begin
  if tg_op = 'INSERT' then
    new.agreement_number := public.shab_next_fee_agreement_number(
      coalesce(new.agreement_date, current_date)
    );
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;

  new.currency := upper(btrim(coalesce(new.currency, 'AED')));
  new.title := btrim(new.title);
  new.updated_at := now();

  if new.case_id is not null then
    select client_id into case_client_id
    from public.cases
    where id = new.case_id;

    if case_client_id is null then
      raise exception 'The selected case was not found.';
    end if;

    if case_client_id <> new.client_id then
      raise exception 'The fee agreement client must match the case client.';
    end if;
  end if;

  if new.title = '' then
    raise exception 'Fee agreement title is required.';
  end if;

  if new.status = 'cancelled' and
    nullif(btrim(coalesce(new.cancellation_reason, '')), '') is null
  then
    raise exception 'A cancellation reason is required.';
  end if;

  return new;
end;
$$;

revoke all on function public.shab_prepare_fee_agreement()
from public, anon, authenticated;

drop trigger if exists shab_prepare_fee_agreement_before_write
on public.fee_agreements;

create trigger shab_prepare_fee_agreement_before_write
before insert or update on public.fee_agreements
for each row execute function public.shab_prepare_fee_agreement();

create table if not exists public.fee_installments (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null
    references public.fee_agreements(id) on delete restrict,
  sequence_number integer not null,
  title text not null,
  description text,
  milestone text,
  planned_subtotal numeric(14, 2) not null,
  vat_rate numeric(7, 4) not null,
  vat_amount numeric(14, 2) generated always as (
    round(planned_subtotal * vat_rate / 100, 2)
  ) stored,
  total_amount numeric(14, 2) generated always as (
    round(planned_subtotal + (planned_subtotal * vat_rate / 100), 2)
  ) stored,
  due_date date,
  status text not null default 'planned',
  invoice_id uuid references public.invoices(id) on delete restrict,
  ready_at timestamptz,
  invoiced_at timestamptz,
  paid_at timestamptz,
  waived_at timestamptz,
  cancelled_at timestamptz,
  status_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fee_installments_sequence_check check (sequence_number > 0),
  constraint fee_installments_subtotal_check check (planned_subtotal > 0),
  constraint fee_installments_vat_check check (vat_rate between 0 and 100),
  constraint fee_installments_status_check check (
    status in ('planned', 'ready', 'invoiced', 'paid', 'waived', 'cancelled')
  ),
  constraint fee_installments_invoice_state_check check (
    (invoice_id is null and status in ('planned', 'ready', 'waived', 'cancelled'))
    or
    (invoice_id is not null and status in ('invoiced', 'paid'))
  ),
  unique (agreement_id, sequence_number),
  unique (invoice_id)
);

create index if not exists fee_installments_agreement_idx
on public.fee_installments(agreement_id, sequence_number);

create index if not exists fee_installments_due_idx
on public.fee_installments(due_date, status)
where status in ('planned', 'ready', 'invoiced');

create or replace function public.shab_prepare_fee_installment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  agreement_record public.fee_agreements%rowtype;
  previous_status text;
begin
  if tg_op = 'UPDATE' then
    previous_status := old.status;
  end if;
  select * into agreement_record
  from public.fee_agreements
  where id = new.agreement_id;

  if not found then
    raise exception 'Fee agreement was not found.';
  end if;

  if agreement_record.status in ('completed', 'expired', 'cancelled') then
    raise exception 'Installments cannot be changed on a closed fee agreement.';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());

    if new.sequence_number is null then
      select coalesce(max(sequence_number), 0) + 1
      into new.sequence_number
      from public.fee_installments
      where agreement_id = new.agreement_id;
    end if;
  end if;

  new.title := btrim(new.title);
  new.updated_at := now();

  if new.title = '' then
    raise exception 'Installment title is required.';
  end if;

  if new.status in ('waived', 'cancelled') and
    nullif(btrim(coalesce(new.status_reason, '')), '') is null
  then
    raise exception 'A reason is required for waived or cancelled installments.';
  end if;

  if new.status = 'ready' and previous_status is distinct from 'ready' then
    new.ready_at := now();
  end if;

  if new.status = 'waived' and previous_status is distinct from 'waived' then
    new.waived_at := now();
  end if;

  if new.status = 'cancelled' and previous_status is distinct from 'cancelled' then
    new.cancelled_at := now();
  end if;

  return new;
end;
$$;

revoke all on function public.shab_prepare_fee_installment()
from public, anon, authenticated;

drop trigger if exists shab_prepare_fee_installment_before_write
on public.fee_installments;

create trigger shab_prepare_fee_installment_before_write
before insert or update on public.fee_installments
for each row execute function public.shab_prepare_fee_installment();

alter table public.fee_agreements enable row level security;
alter table public.fee_installments enable row level security;

drop policy if exists fee_agreements_authenticated_read on public.fee_agreements;
drop policy if exists fee_agreements_authenticated_insert on public.fee_agreements;
drop policy if exists fee_agreements_authenticated_update on public.fee_agreements;
drop policy if exists fee_installments_authenticated_read on public.fee_installments;
drop policy if exists fee_installments_authenticated_insert on public.fee_installments;
drop policy if exists fee_installments_authenticated_update on public.fee_installments;

create policy fee_agreements_authenticated_read
on public.fee_agreements for select to authenticated using (true);

create policy fee_agreements_authenticated_insert
on public.fee_agreements for insert to authenticated with check (auth.uid() is not null);

create policy fee_agreements_authenticated_update
on public.fee_agreements for update to authenticated
using (auth.uid() is not null) with check (auth.uid() is not null);

create policy fee_installments_authenticated_read
on public.fee_installments for select to authenticated using (true);

create policy fee_installments_authenticated_insert
on public.fee_installments for insert to authenticated with check (auth.uid() is not null);

create policy fee_installments_authenticated_update
on public.fee_installments for update to authenticated
using (auth.uid() is not null) with check (auth.uid() is not null);

revoke all on public.fee_agreements, public.fee_installments from anon;
grant select, insert, update on public.fee_agreements, public.fee_installments
to authenticated;

create or replace function public.shab_change_fee_installment_status(
  p_installment_id uuid,
  p_status text,
  p_reason text default null
)
returns public.fee_installments
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target public.fee_installments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into target from public.fee_installments
  where id = p_installment_id for update;

  if not found then
    raise exception 'Installment was not found.';
  end if;

  if target.invoice_id is not null then
    raise exception 'An invoiced installment must follow the invoice lifecycle.';
  end if;

  if p_status not in ('planned', 'ready', 'waived', 'cancelled') then
    raise exception 'This installment status cannot be selected manually.';
  end if;

  update public.fee_installments
  set status = p_status, status_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = p_installment_id
  returning * into target;

  return target;
end;
$$;

revoke all on function public.shab_change_fee_installment_status(uuid, text, text)
from public, anon;
grant execute on function public.shab_change_fee_installment_status(uuid, text, text)
to authenticated;

create or replace function public.shab_invoice_fee_installment(
  p_installment_id uuid,
  p_issue_date date default current_date
)
returns public.invoices
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  installment public.fee_installments%rowtype;
  agreement public.fee_agreements%rowtype;
  created_invoice public.invoices%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into installment from public.fee_installments
  where id = p_installment_id for update;

  if not found then
    raise exception 'Installment was not found.';
  end if;

  if installment.invoice_id is not null or installment.status in ('invoiced', 'paid') then
    raise exception 'This installment already has an invoice.';
  end if;

  if installment.status <> 'ready' then
    raise exception 'Only ready installments can be invoiced.';
  end if;

  select * into agreement from public.fee_agreements
  where id = installment.agreement_id for update;

  if agreement.status <> 'active' then
    raise exception 'The fee agreement must be active before invoicing.';
  end if;

  insert into public.invoices (
    client_id, case_id, invoice_number, issue_date, due_date,
    status, currency, subtotal, vat_rate, vat_amount,
    discount_amount, total_amount, paid_amount, credited_amount,
    balance_amount, description, notes, created_by, amount
  )
  values (
    agreement.client_id,
    agreement.case_id,
    '',
    coalesce(p_issue_date, current_date),
    installment.due_date,
    'issued',
    agreement.currency,
    installment.planned_subtotal,
    installment.vat_rate,
    installment.vat_amount,
    0,
    installment.total_amount,
    0,
    0,
    installment.total_amount,
    installment.title,
    concat('Fee agreement ', agreement.agreement_number),
    auth.uid(),
    installment.total_amount
  )
  returning * into created_invoice;

  update public.fee_installments
  set
    invoice_id = created_invoice.id,
    status = 'invoiced',
    invoiced_at = now(),
    status_reason = null
  where id = installment.id;

  return created_invoice;
end;
$$;

revoke all on function public.shab_invoice_fee_installment(uuid, date)
from public, anon;
grant execute on function public.shab_invoice_fee_installment(uuid, date)
to authenticated;

create or replace function public.shab_sync_installment_from_invoice()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.fee_installments
  set
    status = case when new.status = 'paid' then 'paid' else 'invoiced' end,
    paid_at = case when new.status = 'paid' then coalesce(paid_at, now()) else null end,
    updated_at = now()
  where invoice_id = new.id
    and status in ('invoiced', 'paid');

  return new;
end;
$$;

revoke all on function public.shab_sync_installment_from_invoice()
from public, anon, authenticated;

drop trigger if exists shab_sync_installment_after_invoice_update
on public.invoices;

create trigger shab_sync_installment_after_invoice_update
after update of status, balance_amount on public.invoices
for each row execute function public.shab_sync_installment_from_invoice();

commit;
