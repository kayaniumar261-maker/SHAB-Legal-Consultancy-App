alter table public.documents
  add column if not exists uploaded_by_name text;

create schema if not exists private;

create or replace function private.shab_set_document_uploader_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  access_record record;
begin
  if new.uploaded_by is null then
    new.uploaded_by := auth.uid();
  end if;

  select
    access_account.full_name,
    access_account.email,
    access_account.staff_id
  into access_record
  from public.app_user_access as access_account
  where access_account.user_id = new.uploaded_by
    and access_account.is_active
  limit 1;

  if new.uploaded_by_name is null or btrim(new.uploaded_by_name) = '' then
    new.uploaded_by_name := coalesce(
      nullif(btrim(access_record.full_name), ''),
      nullif(split_part(access_record.email, '@', 1), ''),
      'SHAB User'
    );
  end if;

  if new.uploaded_by_staff_id is null then
    new.uploaded_by_staff_id := access_record.staff_id;
  end if;

  return new;
end;
$$;

revoke all on function private.shab_set_document_uploader_identity()
  from public, anon, authenticated;

drop trigger if exists shab_set_document_uploader_identity
  on public.documents;

create trigger shab_set_document_uploader_identity
before insert or update of uploaded_by, uploaded_by_name, uploaded_by_staff_id
on public.documents
for each row
execute function private.shab_set_document_uploader_identity();

do $$
declare
  audit_user_id uuid;
begin
  select access_account.user_id
  into audit_user_id
  from public.app_user_access as access_account
  where lower(access_account.email) = 'umar@shabgroup.com'
    and access_account.access_role = 'administrator'
    and access_account.is_active
  limit 1;

  if audit_user_id is null then
    raise exception 'The active SHAB administrator audit identity was not found.';
  end if;

  perform set_config('request.jwt.claim.sub', audit_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

update public.documents as document
set
  uploaded_by_name = coalesce(
    nullif(btrim(access_account.full_name), ''),
    nullif(split_part(access_account.email, '@', 1), ''),
    'SHAB User'
  ),
  uploaded_by_staff_id = coalesce(
    document.uploaded_by_staff_id,
    access_account.staff_id
  )
from public.app_user_access as access_account
where access_account.user_id = document.uploaded_by
  and (
    document.uploaded_by_name is null
    or btrim(document.uploaded_by_name) = ''
    or document.uploaded_by_staff_id is null
  );

comment on column public.documents.uploaded_by_name is
  'Snapshot of the authenticated SHAB access-account name at upload time.';
