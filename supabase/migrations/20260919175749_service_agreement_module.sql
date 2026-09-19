begin;

alter table public.fee_agreements
  add column if not exists service_category text,
  add column if not exists service_subcategory text,
  add column if not exists scope_items jsonb not null default '[]'::jsonb,
  add column if not exists payment_terms_days integer not null default 7,
  add column if not exists client_signatory_name text,
  add column if not exists client_signatory_title text,
  add column if not exists standard_terms_version text not null default 'SHAB-SA-2026-01',
  add column if not exists document_status text not null default 'draft',
  add column if not exists agreement_document_id uuid references public.documents(id) on delete set null,
  add column if not exists agreement_document_version integer not null default 0,
  add column if not exists generated_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists signed_at timestamptz;

alter table public.fee_agreements
  drop constraint if exists fee_agreements_scope_items_check,
  add constraint fee_agreements_scope_items_check check (
    jsonb_typeof(scope_items) = 'array'
  ),
  drop constraint if exists fee_agreements_payment_terms_check,
  add constraint fee_agreements_payment_terms_check check (
    payment_terms_days between 0 and 365
  ),
  drop constraint if exists fee_agreements_document_status_check,
  add constraint fee_agreements_document_status_check check (
    document_status in (
      'draft', 'generated', 'sent', 'signed', 'superseded', 'cancelled'
    )
  ),
  drop constraint if exists fee_agreements_document_version_check,
  add constraint fee_agreements_document_version_check check (
    agreement_document_version >= 0
  );

create index if not exists fee_agreements_document_status_idx
on public.fee_agreements(document_status, agreement_date desc);

create unique index if not exists fee_agreements_document_unique_idx
on public.fee_agreements(agreement_document_id)
where agreement_document_id is not null;

create or replace function public.shab_validate_service_agreement_fields()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  scope_item jsonb;
begin
  new.service_category := nullif(btrim(coalesce(new.service_category, '')), '');
  new.service_subcategory := nullif(btrim(coalesce(new.service_subcategory, '')), '');
  new.client_signatory_name := nullif(btrim(coalesce(new.client_signatory_name, '')), '');
  new.client_signatory_title := nullif(btrim(coalesce(new.client_signatory_title, '')), '');

  if jsonb_array_length(new.scope_items) > 50 then
    raise exception 'A service agreement cannot contain more than 50 scope items.';
  end if;

  for scope_item in select value from jsonb_array_elements(new.scope_items)
  loop
    if jsonb_typeof(scope_item) <> 'string'
      or nullif(btrim(scope_item #>> '{}'), '') is null
    then
      raise exception 'Every scope item must contain text.';
    end if;
  end loop;

  if new.document_status in ('generated', 'sent', 'signed')
     and new.agreement_document_id is null then
    raise exception 'A generated, sent or signed agreement must have a linked document.';
  end if;

  if new.document_status = 'signed' and new.signed_at is null then
    new.signed_at := now();
  end if;

  return new;
end;
$$;

revoke all on function public.shab_validate_service_agreement_fields()
from public, anon;
grant execute on function public.shab_validate_service_agreement_fields()
to authenticated;

drop trigger if exists shab_validate_service_agreement_fields_before_write
on public.fee_agreements;

create trigger shab_validate_service_agreement_fields_before_write
before insert or update on public.fee_agreements
for each row execute function public.shab_validate_service_agreement_fields();

commit;
