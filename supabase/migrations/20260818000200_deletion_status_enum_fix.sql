begin;

create or replace function public.shab_admin_resolve_deletion_request(
  p_request_id bigint,
  p_approve boolean,
  p_resolution_note text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_email text;
begin
  if not public.shab_is_administrator() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(p_resolution_note, ''))) < 3 then
    raise exception 'A short administrator note is required.';
  end if;

  select access.email into actor_email
  from public.app_user_access access
  where access.user_id = auth.uid();

  update public.staff_deletion_requests
  set status = case
        when p_approve then 'approved'::public.shab_deletion_request_status
        else 'rejected'::public.shab_deletion_request_status
      end,
      resolved_by = auth.uid(),
      resolved_by_email = actor_email,
      resolved_at = now(),
      resolution_note = trim(p_resolution_note)
  where id = p_request_id
    and status = 'pending'::public.shab_deletion_request_status;

  if not found then
    raise exception 'Pending deletion request not found.';
  end if;
end;
$$;

grant execute on function public.shab_admin_resolve_deletion_request(bigint, boolean, text) to authenticated;

commit;
