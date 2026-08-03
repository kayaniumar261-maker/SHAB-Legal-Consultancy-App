begin;

alter table public.invoices
  add column if not exists issued_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid
    references auth.users(id)
    on delete set null,
  add column if not exists cancellation_reason text;

update public.invoices
set issued_at = coalesce(updated_at, created_at)
where status <> 'draft'
  and issued_at is null;


create table if not exists
  public.invoice_lifecycle_events (
    id uuid primary key default gen_random_uuid(),

    invoice_id uuid
      references public.invoices(id)
      on delete set null,

    invoice_number text not null,
    event_type text not null,

    previous_status text,
    new_status text,
    reason text,

    performed_by uuid
      references auth.users(id)
      on delete set null,

    event_data jsonb not null
      default '{}'::jsonb,

    created_at timestamptz not null
      default now(),

    constraint invoice_lifecycle_event_type_check
      check (
        event_type in (
          'baseline',
          'created',
          'updated',
          'status_changed',
          'cancelled',
          'deleted'
        )
      )
  );

create index if not exists
  invoice_lifecycle_events_invoice_idx
on public.invoice_lifecycle_events (
  invoice_id,
  created_at desc
);

create index if not exists
  invoice_lifecycle_events_number_idx
on public.invoice_lifecycle_events (
  invoice_number,
  created_at desc
);

alter table public.invoice_lifecycle_events
  enable row level security;

drop policy if exists
  invoice_lifecycle_authenticated_read
on public.invoice_lifecycle_events;

create policy
  invoice_lifecycle_authenticated_read
on public.invoice_lifecycle_events
for select
to authenticated
using (true);

revoke all
on table public.invoice_lifecycle_events
from anon;

revoke insert, update, delete
on table public.invoice_lifecycle_events
from authenticated;

grant select
on table public.invoice_lifecycle_events
to authenticated;


insert into public.invoice_lifecycle_events (
  invoice_id,
  invoice_number,
  event_type,
  previous_status,
  new_status,
  reason,
  event_data,
  created_at
)
select
  i.id,
  i.invoice_number,
  'baseline',
  null,
  i.status,
  'Existing invoice recorded when lifecycle auditing was enabled.',
  jsonb_build_object(
    'total_amount', i.total_amount,
    'paid_amount', i.paid_amount,
    'balance_amount', i.balance_amount
  ),
  now()
from public.invoices i
where not exists (
  select 1
  from public.invoice_lifecycle_events e
  where e.invoice_id = i.id
    and e.event_type = 'baseline'
);


create or replace function
  public.shab_set_invoice_issued_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status <> 'draft'
    and new.issued_at is null
  then
    new.issued_at := now();
  end if;

  return new;
end;
$$;

revoke all
on function public.shab_set_invoice_issued_at()
from public, anon, authenticated;

drop trigger if exists
  shab_set_invoice_issued_at_before_insert
on public.invoices;

create trigger
  shab_set_invoice_issued_at_before_insert
before insert
on public.invoices
for each row
execute function
  public.shab_set_invoice_issued_at();


create or replace function
  public.shab_guard_invoice_lifecycle()
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

  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception
        'Only draft invoices may be permanently deleted.';
    end if;

    if exists (
      select 1
      from public.payments
      where invoice_id = old.id
    ) then
      raise exception
        'Invoices with payment records cannot be deleted.';
    end if;

    return old;
  end if;

  if old.status in (
    'paid',
    'cancelled',
    'written_off'
  )
    and internal_action = ''
  then
    raise exception
      'Finalized invoices are locked and cannot be modified.';
  end if;

  if new.status = 'cancelled'
    and old.status <> 'cancelled'
    and internal_action <> 'cancel'
  then
    raise exception
      'Use the controlled invoice cancellation function.';
  end if;

  if new.status = 'written_off'
    and old.status <> 'written_off'
    and internal_action <> 'write_off'
  then
    raise exception
      'Use the controlled invoice write-off function.';
  end if;

  if new.status in (
    'partially_paid',
    'paid'
  )
    and new.status is distinct from old.status
    and internal_action <> 'payment'
  then
    raise exception
      'Invoice payment status is managed automatically.';
  end if;

  if (
    new.paid_amount is distinct from old.paid_amount
    or
    new.balance_amount is distinct from old.balance_amount
  )
    and internal_action <> 'payment'
  then
    raise exception
      'Invoice payment balances are managed automatically.';
  end if;

  if old.status <> 'draft'
    and internal_action not in (
      'payment',
      'cancel',
      'write_off'
    )
    and (
      new.client_id is distinct from old.client_id
      or
      new.case_id is distinct from old.case_id
      or
      new.invoice_number is distinct from old.invoice_number
      or
      new.issue_date is distinct from old.issue_date
      or
      new.currency is distinct from old.currency
      or
      new.subtotal is distinct from old.subtotal
      or
      new.vat_rate is distinct from old.vat_rate
      or
      new.vat_amount is distinct from old.vat_amount
      or
      new.discount_amount is distinct from old.discount_amount
      or
      new.total_amount is distinct from old.total_amount
      or
      new.amount is distinct from old.amount
    )
  then
    raise exception
      'Financial values cannot be changed after an invoice is issued.';
  end if;

  if old.status = 'draft'
    and new.status <> 'draft'
    and new.issued_at is null
  then
    new.issued_at := now();
  end if;

  new.updated_at := now();

  return new;
end;
$$;

revoke all
on function public.shab_guard_invoice_lifecycle()
from public, anon, authenticated;

drop trigger if exists
  shab_guard_invoice_lifecycle_before_write
on public.invoices;

create trigger
  shab_guard_invoice_lifecycle_before_write
before update or delete
on public.invoices
for each row
execute function
  public.shab_guard_invoice_lifecycle();


create or replace function
  public.shab_audit_invoice_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  lifecycle_event text;
  lifecycle_reason text;
begin
  if tg_op = 'INSERT' then
    insert into public.invoice_lifecycle_events (
      invoice_id,
      invoice_number,
      event_type,
      previous_status,
      new_status,
      performed_by,
      event_data
    )
    values (
      new.id,
      new.invoice_number,
      'created',
      null,
      new.status,
      auth.uid(),
      jsonb_build_object(
        'total_amount', new.total_amount,
        'client_id', new.client_id,
        'case_id', new.case_id
      )
    );

    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.invoice_lifecycle_events (
      invoice_id,
      invoice_number,
      event_type,
      previous_status,
      new_status,
      reason,
      performed_by,
      event_data
    )
    values (
      null,
      old.invoice_number,
      'deleted',
      old.status,
      null,
      'Draft invoice permanently deleted.',
      auth.uid(),
      jsonb_build_object(
        'invoice_id', old.id,
        'total_amount', old.total_amount,
        'client_id', old.client_id,
        'case_id', old.case_id
      )
    );

    return old;
  end if;

  if new.status = 'cancelled'
    and old.status <> 'cancelled'
  then
    lifecycle_event := 'cancelled';
    lifecycle_reason :=
      new.cancellation_reason;

  elsif new.status is distinct from old.status then
    lifecycle_event := 'status_changed';
    lifecycle_reason := null;

  else
    lifecycle_event := 'updated';
    lifecycle_reason := null;
  end if;

  insert into public.invoice_lifecycle_events (
    invoice_id,
    invoice_number,
    event_type,
    previous_status,
    new_status,
    reason,
    performed_by,
    event_data
  )
  values (
    new.id,
    new.invoice_number,
    lifecycle_event,
    old.status,
    new.status,
    lifecycle_reason,
    auth.uid(),
    jsonb_build_object(
      'old_total_amount', old.total_amount,
      'new_total_amount', new.total_amount,
      'old_paid_amount', old.paid_amount,
      'new_paid_amount', new.paid_amount,
      'old_balance_amount', old.balance_amount,
      'new_balance_amount', new.balance_amount
    )
  );

  return new;
end;
$$;

revoke all
on function public.shab_audit_invoice_lifecycle()
from public, anon, authenticated;

drop trigger if exists
  shab_audit_invoice_lifecycle_after_write
on public.invoices;

create trigger
  shab_audit_invoice_lifecycle_after_write
after insert or update or delete
on public.invoices
for each row
execute function
  public.shab_audit_invoice_lifecycle();


create or replace function
  public.shab_cancel_invoice(
    p_invoice_id uuid,
    p_reason text
  )
returns public.invoices
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  target_invoice public.invoices%rowtype;
  cancelled_invoice public.invoices%rowtype;
begin
  if nullif(btrim(p_reason), '') is null
    or length(btrim(p_reason)) < 5
  then
    raise exception
      'A meaningful cancellation reason is required.';
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

  if target_invoice.status = 'draft' then
    raise exception
      'Draft invoices should be deleted rather than cancelled.';
  end if;

  if target_invoice.status in (
    'partially_paid',
    'paid'
  )
    or coalesce(
      target_invoice.paid_amount,
      0
    ) > 0
  then
    raise exception
      'Invoices with completed payments cannot be cancelled. Use a credit note or payment reversal.';
  end if;

  if target_invoice.status in (
    'cancelled',
    'written_off'
  ) then
    raise exception
      'This invoice is already finalized.';
  end if;

  if exists (
    select 1
    from public.payments
    where invoice_id = p_invoice_id
      and status in (
        'pending',
        'completed'
      )
  ) then
    raise exception
      'Resolve linked pending or completed payments before cancelling this invoice.';
  end if;

  perform set_config(
    'shab.invoice_action',
    'cancel',
    true
  );

  update public.invoices
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason =
      btrim(p_reason),
    updated_at = now()
  where id = p_invoice_id
  returning *
  into cancelled_invoice;

  return cancelled_invoice;
end;
$$;

revoke all
on function public.shab_cancel_invoice(uuid, text)
from public, anon;

grant execute
on function public.shab_cancel_invoice(uuid, text)
to authenticated;


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
  v_paid numeric(15, 2);
begin
  select
    coalesce(
      sum(amount),
      0
    )
  into v_paid
  from public.payments
  where invoice_id = p_invoice_id
    and status = 'completed';

  perform set_config(
    'shab.invoice_action',
    'payment',
    true
  );

  update public.invoices
  set
    paid_amount = v_paid,
    balance_amount =
      greatest(
        total_amount - v_paid,
        0
      ),
    status =
      case
        when total_amount > 0
          and v_paid >= total_amount
          then 'paid'

        when v_paid > 0
          then 'partially_paid'

        when status = 'draft'
          then 'draft'

        else 'issued'
      end,
    updated_at = now()
  where id = p_invoice_id;
end;
$$;

revoke all
on function public.refresh_invoice_totals(uuid)
from public, anon, authenticated;

commit;
