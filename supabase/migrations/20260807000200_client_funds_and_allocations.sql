begin;

create table public.client_fund_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  case_id uuid references public.cases(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  allocated_amount numeric(14,2) not null default 0 check (allocated_amount >= 0),
  reversed_amount numeric(14,2) not null default 0 check (reversed_amount >= 0),
  currency text not null default 'AED' check (currency = upper(currency) and length(currency) = 3),
  payment_date date not null,
  payment_method text,
  reference_number text,
  status text not null default 'completed' check (status in ('completed','partially_allocated','allocated','refunded')),
  notes text,
  received_by_staff_id uuid references public.staff(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (allocated_amount + reversed_amount <= amount)
);

create unique index client_fund_receipts_reference_unique_idx
on public.client_fund_receipts(lower(btrim(reference_number)))
where nullif(btrim(reference_number),'') is not null and status <> 'refunded';
create index client_fund_receipts_client_idx on public.client_fund_receipts(client_id,payment_date desc);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.client_fund_receipts(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  reversed_amount numeric(14,2) not null default 0 check (reversed_amount >= 0 and reversed_amount <= amount),
  status text not null default 'active' check (status in ('active','reversed')),
  allocation_date date not null default current_date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index payment_allocations_receipt_idx on public.payment_allocations(receipt_id,created_at);
create index payment_allocations_invoice_idx on public.payment_allocations(invoice_id,created_at);

create table public.payment_allocation_reversals (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.payment_allocations(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  reversal_date date not null default current_date,
  reason text not null check (length(btrim(reason)) >= 5),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index payment_allocation_reversals_allocation_idx on public.payment_allocation_reversals(allocation_id,created_at);

create table public.client_fund_reversals (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.client_fund_receipts(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  reversal_date date not null default current_date,
  reason text not null check (length(btrim(reason)) >= 5),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index client_fund_reversals_receipt_idx on public.client_fund_reversals(receipt_id,created_at);

alter table public.client_fund_receipts enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.payment_allocation_reversals enable row level security;
alter table public.client_fund_reversals enable row level security;
create policy client_fund_receipts_read on public.client_fund_receipts for select to authenticated using (true);
create policy payment_allocations_read on public.payment_allocations for select to authenticated using (true);
create policy payment_allocation_reversals_read on public.payment_allocation_reversals for select to authenticated using (true);
create policy client_fund_reversals_read on public.client_fund_reversals for select to authenticated using (true);
revoke all on public.client_fund_receipts,public.payment_allocations,public.payment_allocation_reversals,public.client_fund_reversals from public,anon,authenticated;
grant select on public.client_fund_receipts,public.payment_allocations,public.payment_allocation_reversals,public.client_fund_reversals to authenticated;

-- A bank reference identifies one receipt, whether it was recorded directly
-- against an invoice or first received as unallocated client funds.
create or replace function public.shab_guard_cross_payment_reference()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if nullif(btrim(new.reference_number),'') is null then return new; end if;
  if tg_table_name='payments' and new.status in ('pending','completed','refunded') and exists (
    select 1 from public.client_fund_receipts r
    where lower(btrim(r.reference_number))=lower(btrim(new.reference_number)) and r.status<>'refunded'
  ) then raise exception 'This payment reference is already used by a client funds receipt.'; end if;
  if tg_table_name='client_fund_receipts' and new.status<>'refunded' and exists (
    select 1 from public.payments p
    where lower(btrim(p.reference_number))=lower(btrim(new.reference_number)) and p.status in ('pending','completed','refunded')
  ) then raise exception 'This payment reference is already used by an invoice payment.'; end if;
  return new;
end; $$;
create trigger guard_payment_cross_reference before insert or update of reference_number,status on public.payments for each row execute function public.shab_guard_cross_payment_reference();
create trigger guard_client_fund_cross_reference before insert or update of reference_number,status on public.client_fund_receipts for each row execute function public.shab_guard_cross_payment_reference();
revoke all on function public.shab_guard_cross_payment_reference() from public,anon,authenticated;

create or replace function public.shab_refresh_client_fund_receipt(p_receipt_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.client_fund_receipts%rowtype; allocated numeric(14,2);
begin
  select * into r from public.client_fund_receipts where id=p_receipt_id for update;
  if not found then return; end if;
  select coalesce(sum(greatest(amount-reversed_amount,0)),0) into allocated from public.payment_allocations where receipt_id=p_receipt_id;
  update public.client_fund_receipts set allocated_amount=allocated,
    status=case when reversed_amount>=amount then 'refunded' when allocated>=amount-reversed_amount then 'allocated' when allocated>0 then 'partially_allocated' else 'completed' end,
    updated_at=now() where id=p_receipt_id;
end; $$;
revoke all on function public.shab_refresh_client_fund_receipt(uuid) from public,anon,authenticated;

create or replace function public.shab_record_client_funds(
  p_client_id uuid,p_case_id uuid,p_amount numeric,p_currency text,p_payment_date date,
  p_payment_method text default null,p_reference_number text default null,p_notes text default null,p_received_by_staff_id uuid default null)
returns public.client_fund_receipts language plpgsql security definer set search_path=pg_catalog,public as $$
declare created public.client_fund_receipts%rowtype; case_client uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Receipt amount must be greater than zero.'; end if;
  if p_case_id is not null then select client_id into case_client from public.cases where id=p_case_id;
    if case_client is distinct from p_client_id then raise exception 'The selected case does not belong to this client.'; end if; end if;
  insert into public.client_fund_receipts(receipt_number,client_id,case_id,amount,currency,payment_date,payment_method,reference_number,notes,received_by_staff_id,created_by)
  values(public.shab_next_payment_receipt_number(coalesce(p_payment_date,current_date)),p_client_id,p_case_id,round(p_amount,2),upper(btrim(coalesce(p_currency,'AED'))),coalesce(p_payment_date,current_date),nullif(btrim(p_payment_method),''),nullif(btrim(p_reference_number),''),nullif(btrim(p_notes),''),p_received_by_staff_id,auth.uid()) returning * into created;
  return created;
end; $$;
revoke all on function public.shab_record_client_funds(uuid,uuid,numeric,text,date,text,text,text,uuid) from public,anon;
grant execute on function public.shab_record_client_funds(uuid,uuid,numeric,text,date,text,text,text,uuid) to authenticated;

create or replace function public.shab_allocate_client_funds(p_receipt_id uuid,p_invoice_id uuid,p_amount numeric,p_allocation_date date default current_date,p_notes text default null)
returns public.payment_allocations language plpgsql security definer set search_path=pg_catalog,public as $$
declare receipt public.client_fund_receipts%rowtype; invoice public.invoices%rowtype; created public.payment_allocations%rowtype; available numeric(14,2);
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Allocation amount must be greater than zero.'; end if;
  select * into receipt from public.client_fund_receipts where id=p_receipt_id for update;
  if not found then raise exception 'Client funds receipt was not found.'; end if;
  select * into invoice from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice was not found.'; end if;
  if receipt.client_id<>invoice.client_id then raise exception 'Funds and invoice must belong to the same client.'; end if;
  if receipt.currency<>invoice.currency then raise exception 'Funds and invoice currencies must match.'; end if;
  if invoice.status in ('draft','paid','credited','cancelled','written_off') then raise exception 'This invoice cannot receive an allocation.'; end if;
  available:=receipt.amount-receipt.allocated_amount-receipt.reversed_amount;
  if p_amount>available then raise exception 'Allocation exceeds unallocated client funds.'; end if;
  if p_amount>invoice.balance_amount then raise exception 'Allocation exceeds the invoice outstanding balance.'; end if;
  insert into public.payment_allocations(receipt_id,invoice_id,amount,allocation_date,notes,created_by)
  values(receipt.id,invoice.id,round(p_amount,2),coalesce(p_allocation_date,current_date),nullif(btrim(p_notes),''),auth.uid()) returning * into created;
  perform public.shab_refresh_client_fund_receipt(receipt.id);
  perform public.refresh_invoice_totals(invoice.id);
  return created;
end; $$;
revoke all on function public.shab_allocate_client_funds(uuid,uuid,numeric,date,text) from public,anon;
grant execute on function public.shab_allocate_client_funds(uuid,uuid,numeric,date,text) to authenticated;

create or replace function public.shab_reverse_payment_allocation(p_allocation_id uuid,p_amount numeric,p_reversal_date date,p_reason text)
returns public.payment_allocation_reversals language plpgsql security definer set search_path=pg_catalog,public as $$
declare allocation public.payment_allocations%rowtype; created public.payment_allocation_reversals%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Reversal amount must be greater than zero.'; end if;
  if length(btrim(coalesce(p_reason,'')))<5 then raise exception 'A meaningful reversal reason is required.'; end if;
  select * into allocation from public.payment_allocations where id=p_allocation_id for update;
  if not found then raise exception 'Allocation was not found.'; end if;
  if p_amount>allocation.amount-allocation.reversed_amount then raise exception 'Reversal exceeds the active allocation.'; end if;
  insert into public.payment_allocation_reversals(allocation_id,amount,reversal_date,reason,created_by)
  values(allocation.id,round(p_amount,2),coalesce(p_reversal_date,current_date),btrim(p_reason),auth.uid()) returning * into created;
  update public.payment_allocations set reversed_amount=reversed_amount+round(p_amount,2),status=case when reversed_amount+round(p_amount,2)>=amount then 'reversed' else 'active' end where id=allocation.id;
  perform public.shab_refresh_client_fund_receipt(allocation.receipt_id);
  perform public.refresh_invoice_totals(allocation.invoice_id);
  return created;
end; $$;
revoke all on function public.shab_reverse_payment_allocation(uuid,numeric,date,text) from public,anon;
grant execute on function public.shab_reverse_payment_allocation(uuid,numeric,date,text) to authenticated;

create or replace function public.shab_reverse_unallocated_client_funds(p_receipt_id uuid,p_amount numeric,p_reversal_date date,p_reason text)
returns public.client_fund_reversals language plpgsql security definer set search_path=pg_catalog,public as $$
declare receipt public.client_fund_receipts%rowtype; created public.client_fund_reversals%rowtype; available numeric(14,2);
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Reversal amount must be greater than zero.'; end if;
  if length(btrim(coalesce(p_reason,'')))<5 then raise exception 'A meaningful reversal reason is required.'; end if;
  select * into receipt from public.client_fund_receipts where id=p_receipt_id for update;
  if not found then raise exception 'Client funds receipt was not found.'; end if;
  available:=receipt.amount-receipt.allocated_amount-receipt.reversed_amount;
  if p_amount>available then raise exception 'Only unallocated client funds can be reversed.'; end if;
  insert into public.client_fund_reversals(receipt_id,amount,reversal_date,reason,created_by)
  values(receipt.id,round(p_amount,2),coalesce(p_reversal_date,current_date),btrim(p_reason),auth.uid()) returning * into created;
  update public.client_fund_receipts set reversed_amount=reversed_amount+round(p_amount,2),updated_at=now() where id=receipt.id;
  perform public.shab_refresh_client_fund_receipt(receipt.id);
  return created;
end; $$;
revoke all on function public.shab_reverse_unallocated_client_funds(uuid,numeric,date,text) from public,anon;
grant execute on function public.shab_reverse_unallocated_client_funds(uuid,numeric,date,text) to authenticated;

-- Extend authoritative invoice totals with active allocations while retaining legacy payments.
create or replace function public.refresh_invoice_totals(p_invoice_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare invoice_total numeric(14,2); paid_total numeric(14,2); allocation_total numeric(14,2); credited_total numeric(14,2); net_total numeric(14,2); current_status text;
begin
  select total_amount,status into invoice_total,current_status from public.invoices where id=p_invoice_id for update;
  if not found then return; end if;
  select coalesce(sum(greatest(amount-coalesce(reversed_amount,0),0)),0) into paid_total from public.payments where invoice_id=p_invoice_id and status in ('completed','refunded');
  select coalesce(sum(greatest(amount-reversed_amount,0)),0) into allocation_total from public.payment_allocations where invoice_id=p_invoice_id;
  paid_total:=paid_total+allocation_total;
  select coalesce(sum(total_amount),0) into credited_total from public.credit_notes where invoice_id=p_invoice_id and status='issued';
  credited_total:=least(credited_total,invoice_total); net_total:=greatest(invoice_total-credited_total,0);
  perform set_config('shab.invoice_action','payment',true);
  update public.invoices set paid_amount=paid_total,credited_amount=credited_total,balance_amount=greatest(net_total-paid_total,0),
    status=case when current_status='draft' then 'draft' when credited_total>=invoice_total then 'credited' when net_total>0 and paid_total>=net_total then 'paid' when paid_total>0 then 'partially_paid' when credited_total>0 then 'partially_credited' else 'issued' end,updated_at=now() where id=p_invoice_id;
end; $$;
revoke all on function public.refresh_invoice_totals(uuid) from public,anon,authenticated;

create or replace function public.shab_guard_allocation_history() returns trigger language plpgsql as $$ begin raise exception 'Client fund and allocation history is immutable. Use controlled allocation reversal.'; end; $$;
create trigger guard_client_fund_receipts before delete on public.client_fund_receipts for each row execute function public.shab_guard_allocation_history();
create trigger guard_payment_allocations before delete on public.payment_allocations for each row execute function public.shab_guard_allocation_history();
create trigger guard_payment_allocation_reversals before update or delete on public.payment_allocation_reversals for each row execute function public.shab_guard_allocation_history();
create trigger guard_client_fund_reversals before update or delete on public.client_fund_reversals for each row execute function public.shab_guard_allocation_history();
revoke all on function public.shab_guard_allocation_history() from public,anon,authenticated;

commit;
