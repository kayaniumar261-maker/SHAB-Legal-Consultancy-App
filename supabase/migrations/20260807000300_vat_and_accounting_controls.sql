begin;

alter table public.company_settings
  add column if not exists vat_registered boolean not null default false,
  add column if not exists default_vat_rate numeric(7,4) not null default 5 check (default_vat_rate between 0 and 100),
  add column if not exists vat_effective_date date;

update public.company_settings set tax_registration_number=case
  when length(regexp_replace(coalesce(tax_registration_number,''),'[^0-9]','','g'))=15
    then regexp_replace(tax_registration_number,'[^0-9]','','g')
  else null end;

alter table public.company_settings drop constraint if exists company_settings_trn_format_check;
alter table public.company_settings add constraint company_settings_trn_format_check check (
  (not vat_registered and (tax_registration_number is null or btrim(tax_registration_number) ~ '^[0-9]{15}$'))
  or (vat_registered and btrim(tax_registration_number) ~ '^[0-9]{15}$')
);

alter table public.invoices
  add column if not exists vat_treatment text not null default 'exclusive',
  add column if not exists supply_date date,
  add column if not exists is_tax_invoice boolean not null default false;
select set_config('shab.invoice_action','payment',true);
update public.invoices set
  vat_treatment=case when coalesce(vat_rate,0)>0 then 'exclusive' else 'out_of_scope' end,
  supply_date=coalesce(supply_date,issue_date),
  is_tax_invoice=coalesce(vat_rate,0)>0;
alter table public.invoices alter column supply_date set not null;
alter table public.invoices add constraint invoices_vat_treatment_check check (vat_treatment in ('exclusive','inclusive','zero_rated','out_of_scope'));

create or replace function public.shab_prepare_invoice_vat()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  new.supply_date:=coalesce(new.supply_date,new.issue_date);
  if new.vat_treatment in ('zero_rated','out_of_scope') then new.vat_rate:=0; new.vat_amount:=0; end if;
  return new;
end; $$;
create trigger prepare_invoice_vat before insert or update of issue_date,supply_date,vat_treatment on public.invoices for each row execute function public.shab_prepare_invoice_vat();
revoke all on function public.shab_prepare_invoice_vat() from public,anon,authenticated;

alter table public.credit_notes
  add column if not exists vat_treatment text not null default 'exclusive',
  add column if not exists tax_point_date date;
update public.credit_notes note set
  vat_treatment=coalesce((select invoice.vat_treatment from public.invoices invoice where invoice.id=note.invoice_id),'exclusive'),
  tax_point_date=coalesce(note.tax_point_date,note.issue_date);
alter table public.credit_notes alter column tax_point_date set not null;
alter table public.credit_notes add constraint credit_notes_vat_treatment_check check (vat_treatment in ('exclusive','inclusive','zero_rated','out_of_scope'));

create table public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open','locked')),
  locked_at timestamptz,
  locked_by uuid references auth.users(id) on delete set null,
  lock_reason text,
  created_at timestamptz not null default now(),
  check (period_end>=period_start),
  unique(period_start,period_end)
);
alter table public.accounting_periods enable row level security;
create policy accounting_periods_read on public.accounting_periods for select to authenticated using (true);
revoke all on public.accounting_periods from public,anon,authenticated;
grant select on public.accounting_periods to authenticated;

create or replace function public.shab_assert_accounting_date_open(p_date date)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if exists(select 1 from public.accounting_periods where status='locked' and coalesce(p_date,current_date) between period_start and period_end)
  then raise exception 'The accounting period containing % is locked.',coalesce(p_date,current_date); end if;
end; $$;
revoke all on function public.shab_assert_accounting_date_open(date) from public,anon,authenticated;

create or replace function public.shab_validate_tax_document()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare expected_vat numeric(14,2); expected_total numeric(14,2); discount numeric(14,2):=0;
begin
  if new.currency is null or new.currency<>upper(new.currency) or length(new.currency)<>3 then raise exception 'Currency must be a three-letter uppercase code.'; end if;
  if new.vat_treatment in ('zero_rated','out_of_scope') then
    if new.vat_rate<>0 or new.vat_amount<>0 then raise exception 'Zero-rated and out-of-scope documents cannot contain VAT.'; end if;
  else
    expected_vat:=round(new.subtotal*new.vat_rate/100,2);
    if new.vat_amount<>expected_vat then raise exception 'VAT amount does not match the taxable subtotal and VAT rate.'; end if;
  end if;
  if tg_table_name='invoices' then discount:=coalesce(new.discount_amount,0); end if;
  expected_total:=round(new.subtotal+new.vat_amount-discount,2);
  if new.total_amount<>expected_total then raise exception 'Document total does not reconcile with subtotal, VAT and discount.'; end if;
  perform public.shab_assert_accounting_date_open(case when tg_table_name='invoices' then new.supply_date else new.tax_point_date end);
  return new;
end; $$;
create trigger validate_invoice_tax before insert or update of subtotal,vat_rate,vat_amount,discount_amount,total_amount,currency,vat_treatment,supply_date on public.invoices for each row execute function public.shab_validate_tax_document();
create trigger validate_credit_note_tax before insert or update of subtotal,vat_rate,vat_amount,total_amount,currency,vat_treatment,tax_point_date on public.credit_notes for each row execute function public.shab_validate_tax_document();
revoke all on function public.shab_validate_tax_document() from public,anon,authenticated;

create or replace function public.shab_prepare_credit_note_vat()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare source public.invoices%rowtype;
begin
  select * into source from public.invoices where id=new.invoice_id;
  if not found then raise exception 'Invoice was not found.'; end if;
  if new.currency<>source.currency then raise exception 'Credit-note currency must match its invoice.'; end if;
  if new.vat_rate<>source.vat_rate then raise exception 'Credit-note VAT rate must match its invoice.'; end if;
  new.vat_treatment:=source.vat_treatment;
  new.tax_point_date:=coalesce(new.tax_point_date,new.issue_date);
  return new;
end; $$;
create trigger prepare_credit_note_vat before insert on public.credit_notes for each row execute function public.shab_prepare_credit_note_vat();
revoke all on function public.shab_prepare_credit_note_vat() from public,anon,authenticated;

create or replace function public.shab_update_tax_settings(p_vat_registered boolean,p_tax_registration_number text,p_default_vat_rate numeric,p_vat_effective_date date)
returns public.company_settings language plpgsql security definer set search_path=pg_catalog,public as $$
declare result public.company_settings%rowtype; normalized_trn text:=nullif(regexp_replace(coalesce(p_tax_registration_number,''),'[^0-9]','','g'),'');
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if p_default_vat_rate is null or p_default_vat_rate<0 or p_default_vat_rate>100 then raise exception 'Default VAT rate is invalid.'; end if;
  if p_vat_registered and (normalized_trn is null or length(normalized_trn)<>15) then raise exception 'A UAE TRN must contain exactly 15 digits.'; end if;
  update public.company_settings set vat_registered=coalesce(p_vat_registered,false),tax_registration_number=normalized_trn,default_vat_rate=p_default_vat_rate,vat_effective_date=p_vat_effective_date,updated_at=now() where id='primary' returning * into result;
  return result;
end; $$;
revoke all on function public.shab_update_tax_settings(boolean,text,numeric,date) from public,anon;
grant execute on function public.shab_update_tax_settings(boolean,text,numeric,date) to authenticated;

create or replace function public.shab_save_accounting_period(p_period_start date,p_period_end date)
returns public.accounting_periods language plpgsql security definer set search_path=pg_catalog,public as $$
declare result public.accounting_periods%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if p_period_start is null or p_period_end is null or p_period_end<p_period_start then raise exception 'Enter a valid accounting period.'; end if;
  if exists(select 1 from public.accounting_periods where daterange(period_start,period_end,'[]') && daterange(p_period_start,p_period_end,'[]')) then raise exception 'Accounting periods cannot overlap.'; end if;
  insert into public.accounting_periods(period_start,period_end) values(p_period_start,p_period_end) returning * into result; return result;
end; $$;
revoke all on function public.shab_save_accounting_period(date,date) from public,anon;
grant execute on function public.shab_save_accounting_period(date,date) to authenticated;

create or replace function public.shab_set_accounting_period_lock(p_period_id uuid,p_locked boolean,p_reason text)
returns public.accounting_periods language plpgsql security definer set search_path=pg_catalog,public as $$
declare result public.accounting_periods%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if p_locked and length(btrim(coalesce(p_reason,'')))<5 then raise exception 'A meaningful lock reason is required.'; end if;
  update public.accounting_periods set status=case when p_locked then 'locked' else 'open' end,locked_at=case when p_locked then now() else null end,locked_by=case when p_locked then auth.uid() else null end,lock_reason=case when p_locked then btrim(p_reason) else null end where id=p_period_id returning * into result;
  if not found then raise exception 'Accounting period was not found.'; end if; return result;
end; $$;
revoke all on function public.shab_set_accounting_period_lock(uuid,boolean,text) from public,anon;
grant execute on function public.shab_set_accounting_period_lock(uuid,boolean,text) to authenticated;

commit;
