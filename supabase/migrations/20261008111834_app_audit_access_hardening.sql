begin;

-- Preserve existing shared operational access, but require an active account.
-- Restrictive policies combine with (and cannot widen) existing policies.
do $$
declare target text;
begin
  foreach target in array array['clients', 'cases', 'staff', 'hearings', 'tasks', 'documents', 'activity_logs', 'notifications']
  loop
    execute format('drop policy if exists shab_active_account_required on public.%I', target);
    execute format(
      'create policy shab_active_account_required on public.%I as restrictive for all to authenticated using ((select public.shab_is_active_app_user())) with check ((select public.shab_is_active_app_user()))',
      target
    );
  end loop;
end;
$$;

-- The staff directory is shared for assignments; changes are administrator-only.
drop policy if exists shab_staff_admin_insert on public.staff;
create policy shab_staff_admin_insert on public.staff as restrictive for insert to authenticated
with check ((select public.shab_is_administrator()));
drop policy if exists shab_staff_admin_update on public.staff;
create policy shab_staff_admin_update on public.staff as restrictive for update to authenticated
using ((select public.shab_is_administrator())) with check ((select public.shab_is_administrator()));
drop policy if exists shab_staff_admin_delete on public.staff;
create policy shab_staff_admin_delete on public.staff as restrictive for delete to authenticated
using ((select public.shab_is_administrator()));

drop policy if exists shab_legal_storage_active_account on storage.objects;
create policy shab_legal_storage_active_account on storage.objects as restrictive for all to authenticated
using (bucket_id <> 'legal-documents' or (select public.shab_is_active_app_user()))
with check (bucket_id <> 'legal-documents' or (select public.shab_is_active_app_user()));

-- Staff may clean up their own unsuccessful uploads, but not attached documents.
drop policy if exists shab_legal_storage_safe_delete on storage.objects;
create policy shab_legal_storage_safe_delete on storage.objects as restrictive for delete to authenticated
using (
  bucket_id <> 'legal-documents'
  or (select public.shab_is_administrator())
  or (
    owner_id = (select auth.uid())::text
    and not exists (
      select 1 from public.documents d
      where d.storage_bucket = objects.bucket_id and d.storage_path = objects.name
    )
  )
);

-- These helpers are called by database triggers, never by the client.
revoke execute on function public.refresh_case_next_hearing(uuid) from public, anon, authenticated;
revoke execute on function public.sync_case_next_hearing() from public, anon, authenticated;
revoke execute on function public.sync_invoice_payment_totals() from public, anon, authenticated;
alter function public.generate_shab_matter_number() set search_path = pg_catalog, public;
alter function public.shab_guard_allocation_history() set search_path = pg_catalog, public;

commit;
