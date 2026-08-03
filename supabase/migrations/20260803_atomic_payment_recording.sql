begin;

create or replace function public.shab_record_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text default null,
  p_reference_number text default null,
  p_status text default 'completed',
  p_notes text default null,
  p_received_by_staff_id uuid default null
)
returns public.payments
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  target_invoice public.invoices%rowtype;
  created_payment public.payments%rowtype;
  next_paid_amount numeric;
  next_balance_amount numeric;
  next_invoice_status text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception
      'Payment amount must be greater than zero.';
  end if;

  if p_status not in (
    'completed',
    'pending',
    'failed'
  ) then
    raise exception
      'Invalid payment status.';
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
    'paid',
    'cancelled',
    'written_off'
  ) then
    raise exception
      'Payments cannot be recorded against this invoice status.';
  end if;

  if p_status in ('completed', 'pending')
    and p_amount >
      coalesce(target_invoice.balance_amount, 0)
  then
    raise exception
      'Payment cannot exceed the outstanding invoice balance.';
  end if;

  insert into public.payments (
    invoice_id,
    client_id,
    case_id,
    amount,
    currency,
    payment_date,
    payment_method,
    reference_number,
    status,
    notes,
    received_by_staff_id,
    created_by,
    paid_at
  )
  values (
    target_invoice.id,
    target_invoice.client_id,
    target_invoice.case_id,
    p_amount,
    target_invoice.currency,
    p_payment_date,
    nullif(btrim(p_payment_method), ''),
    nullif(btrim(p_reference_number), ''),
    p_status,
    nullif(btrim(p_notes), ''),
    p_received_by_staff_id,
    auth.uid(),
    case
      when p_status = 'completed'
        then now()
      else null
    end
  )
  returning *
  into created_payment;

  if p_status = 'completed' then
    next_paid_amount :=
      coalesce(target_invoice.paid_amount, 0) +
      p_amount;

    next_balance_amount :=
      greatest(
        0,
        coalesce(target_invoice.total_amount, 0) -
        next_paid_amount
      );

    next_invoice_status :=
      case
        when next_balance_amount = 0
          then 'paid'
        when next_paid_amount > 0
          then 'partially_paid'
        else 'issued'
      end;

    update public.invoices
    set
      paid_amount = next_paid_amount,
      balance_amount = next_balance_amount,
      status = next_invoice_status,
      updated_at = now()
    where id = target_invoice.id;
  end if;

  return created_payment;
end;
$$;

revoke all
on function public.shab_record_payment(
  uuid,
  numeric,
  date,
  text,
  text,
  text,
  text,
  uuid
)
from public, anon;

grant execute
on function public.shab_record_payment(
  uuid,
  numeric,
  date,
  text,
  text,
  text,
  text,
  uuid
)
to authenticated;

commit;
