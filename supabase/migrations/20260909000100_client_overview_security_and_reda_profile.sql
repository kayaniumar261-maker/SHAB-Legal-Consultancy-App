begin;

-- Make the view enforce the querying user's grants and row-level security.
-- Authenticated operations staff retain client/case access, while the existing
-- administrator-only invoice policy protects financial aggregates.
alter view public.client_overview set (security_invoker = true);

revoke all on public.client_overview from public, anon, authenticated;
grant select on public.client_overview to authenticated;

-- Repair Reda Jamal's existing access-to-staff relationship by normalized email.
-- The update is idempotent and does not create or replace either account.
update public.app_user_access access
set full_name = staff.full_name,
    staff_id = staff.id,
    updated_at = now()
from public.staff staff
where access.email = 'reda@shabgroup.com'
  and lower(trim(staff.email)) = access.email
  and staff.full_name = 'Reda Jamal';

update public.staff staff
set user_id = access.user_id,
    updated_at = now()
from public.app_user_access access
where access.email = 'reda@shabgroup.com'
  and access.staff_id = staff.id
  and staff.user_id is null;

commit;
