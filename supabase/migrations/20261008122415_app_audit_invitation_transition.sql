begin;
-- Supabase creates the user first, then writes invited_at in the same invite flow.
-- Activate only the first trusted invitation; a resend must not undo a suspension.
create or replace function public.shab_activate_first_invitation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.invited_at is null and new.invited_at is not null then
    update public.app_user_access
    set is_active = true, updated_at = now()
    where user_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.shab_activate_first_invitation() from public, anon, authenticated;
drop trigger if exists shab_activate_first_invitation on auth.users;
create trigger shab_activate_first_invitation
after update of invited_at on auth.users
for each row execute function public.shab_activate_first_invitation();
commit;
