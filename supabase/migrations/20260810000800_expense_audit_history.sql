begin;

create table if not exists public.expense_activity (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  action text not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint expense_activity_action_check check (
    action in ('created', 'updated', 'approved', 'paid', 'voided', 'billed',
      'billing_released', 'attachment_added', 'attachment_removed')
  )
);

create index if not exists expense_activity_expense_idx
on public.expense_activity(expense_id, created_at desc);

alter table public.expense_activity enable row level security;
drop policy if exists expense_activity_read on public.expense_activity;
create policy expense_activity_read on public.expense_activity
for select to authenticated using (true);
revoke all on public.expense_activity from public, anon, authenticated;
grant select on public.expense_activity to authenticated;

-- Preserve available history for records created before audit logging existed.
insert into public.expense_activity(expense_id, action, actor_id, details, created_at)
select id, 'created', created_by,
  jsonb_build_object('category', category, 'total', total_amount, 'currency', currency),
  created_at
from public.expenses expense
where not exists (
  select 1 from public.expense_activity activity
  where activity.expense_id = expense.id and activity.action = 'created'
);

insert into public.expense_activity(expense_id, action, actor_id, details, created_at)
select id, 'approved', approved_by, jsonb_build_object('summary', 'Expense approved'), approved_at
from public.expenses
where approved_at is not null;

insert into public.expense_activity(expense_id, action, actor_id, details, created_at)
select id, 'paid', approved_by, jsonb_build_object('summary', 'Expense marked paid'), paid_at
from public.expenses
where paid_at is not null;

insert into public.expense_activity(expense_id, action, actor_id, details, created_at)
select id, 'voided', approved_by, jsonb_build_object('reason', void_reason), voided_at
from public.expenses
where voided_at is not null;

create or replace function public.shab_record_expense_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  activity_action text;
  activity_details jsonb := '{}'::jsonb;
  email_value text := nullif(auth.jwt() ->> 'email', '');
  invoice_number_value text;
begin
  if tg_op = 'INSERT' then
    activity_action := 'created';
    activity_details := jsonb_build_object(
      'category', new.category, 'total', new.total_amount, 'currency', new.currency
    );
  elsif new.status is distinct from old.status then
    activity_action := case new.status
      when 'approved' then 'approved'
      when 'paid' then 'paid'
      when 'void' then 'voided'
      else 'updated'
    end;
    activity_details := case when new.status = 'void'
      then jsonb_build_object('reason', new.void_reason)
      else jsonb_build_object('summary', 'Status changed from ' || old.status || ' to ' || new.status)
    end;
  elsif new.billed_invoice_id is distinct from old.billed_invoice_id then
    if new.billed_invoice_id is not null then
      activity_action := 'billed';
      select invoice_number into invoice_number_value from public.invoices where id = new.billed_invoice_id;
      activity_details := jsonb_build_object('invoice_id', new.billed_invoice_id, 'invoice_number', invoice_number_value);
    else
      activity_action := 'billing_released';
      activity_details := jsonb_build_object('summary', 'Linked invoice removed or cancelled');
    end if;
  else
    activity_action := 'updated';
    activity_details := jsonb_build_object('summary', 'Expense details updated');
  end if;

  insert into public.expense_activity(expense_id, action, actor_id, actor_email, details)
  values(new.id, activity_action, auth.uid(), email_value, activity_details);
  return new;
end;
$$;

revoke all on function public.shab_record_expense_activity()
from public, anon, authenticated;

drop trigger if exists shab_expense_activity_after_write on public.expenses;
create trigger shab_expense_activity_after_write
after insert or update on public.expenses
for each row execute function public.shab_record_expense_activity();

create or replace function public.shab_record_expense_attachment_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_expense_id uuid := case when tg_op = 'DELETE' then old.expense_id else new.expense_id end;
  target_file_name text := case when tg_op = 'DELETE' then old.file_name else new.file_name end;
begin
  insert into public.expense_activity(expense_id, action, actor_id, actor_email, details)
  values(
    target_expense_id,
    case when tg_op = 'DELETE' then 'attachment_removed' else 'attachment_added' end,
    auth.uid(),
    nullif(auth.jwt() ->> 'email', ''),
    jsonb_build_object('file_name', target_file_name)
  );
  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.shab_record_expense_attachment_activity()
from public, anon, authenticated;

drop trigger if exists shab_expense_attachment_activity_after_write on public.expense_attachments;
create trigger shab_expense_attachment_activity_after_write
after insert or delete on public.expense_attachments
for each row execute function public.shab_record_expense_attachment_activity();

commit;
