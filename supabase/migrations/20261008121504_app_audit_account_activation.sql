begin;
CREATE OR REPLACE FUNCTION public.shab_prepare_user_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  normalized_email text := lower(trim(coalesce(new.email, '')));
  selected_role public.shab_access_role;
begin
  if normalized_email = '' then
    raise exception 'An email address is required for SHAB application access.';
  end if;
  selected_role := case when exists (
    select 1 from public.access_administrator_allowlist allowlist
    where allowlist.email = normalized_email
  ) then 'administrator'::public.shab_access_role else 'operations_staff'::public.shab_access_role end;

  insert into public.app_user_access(user_id, email, full_name, access_role, is_active)
  values(
    new.id,
    normalized_email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), ''),
    selected_role,
    -- Only administrator invitations activate new accounts automatically.
    -- Confirming a public signup or editing metadata cannot approve access.
    new.invited_at is not null
  )
  on conflict (user_id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.app_user_access.full_name),
    access_role = selected_role,
    updated_at = now();
  return new;
end;
$function$;

-- Keep this trigger unavailable through the public RPC interface.
revoke all on function public.shab_prepare_user_access() from public, anon, authenticated;
commit;
