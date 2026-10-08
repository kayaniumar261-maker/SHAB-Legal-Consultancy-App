-- Rollback-only integration check. Run as a database administrator on staging.
-- Requires an operations account which has never received an invitation.
-- This checks database transitions; it does not send invitation emails.
begin;
do $$
declare target uuid;
begin
  select u.id into target from auth.users u join public.app_user_access a on a.user_id=u.id where a.access_role='operations_staff' and u.invited_at is null limit 1;
  if target is null then raise exception 'No suitable rollback-only fixture exists'; end if;
  update public.app_user_access set is_active=false where user_id=target;
  update auth.users set raw_user_meta_data=raw_user_meta_data where id=target;
  if (select is_active from public.app_user_access where user_id=target) then raise exception 'Metadata edit bypassed approval'; end if;
  update auth.users set invited_at=now() where id=target;
  if not (select is_active from public.app_user_access where user_id=target) then raise exception 'First invitation did not activate account'; end if;
  update public.app_user_access set is_active=false where user_id=target;
  update auth.users set invited_at=now()+interval '1 second' where id=target;
  if (select is_active from public.app_user_access where user_id=target) then raise exception 'Resend bypassed suspension'; end if;
end;
$$;
select 'PASS: metadata cannot approve access; first invitation activates; resend preserves suspension; transaction rolled back' result;
rollback;
