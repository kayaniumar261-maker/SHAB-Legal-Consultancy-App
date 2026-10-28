begin;
-- In-app alerts are independent of external email and WhatsApp setup.
create or replace function shab_private.queue_task_event()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare event text;
begin
  if not (select enabled from public.task_notification_settings where id=1) then return new; end if;
  if tg_op='UPDATE' and new.notification_revision=old.notification_revision then return new; end if;
  if new.status='completed' then
    if tg_op='UPDATE' and old.status='completed' then return new; end if;
    insert into public.task_notification_deliveries(task_id,revision,recipient_key,channel,kind)
    select distinct new.id,new.notification_revision,d.recipient_key,'email','completed'
    from public.task_notification_deliveries d
    where d.task_id=new.id and d.kind in ('overdue','follow_up') and d.channel='email'
      and d.status='accepted' and d.recipient_key like 'administrator:%'
    on conflict do nothing;
  elsif new.status in ('pending','in_progress') and new.assigned_staff_id is not null then
    event:='assigned';
    if tg_op='UPDATE' and new.assigned_staff_id is not distinct from old.assigned_staff_id then event:='updated'; end if;
    insert into public.task_notification_deliveries(task_id,revision,recipient_key,channel,kind)
    select new.id,new.notification_revision,'staff:'||new.assigned_staff_id::text,ch,event from unnest(array['email']) ch
    on conflict do nothing;
  end if;
  return new;
end;$$;
revoke all on function shab_private.queue_task_event() from public,anon,authenticated;

create or replace function public.plan_task_notifications()
returns void language plpgsql security invoker set search_path=pg_catalog,public,shab_private as $$
begin
  if not (select enabled from public.task_notification_settings where id=1) then return; end if;
  -- Serialize planners. Uniqueness is a second guard against repeated scheduler calls.
  perform pg_advisory_xact_lock(728031);
  insert into public.task_notification_deliveries(task_id,revision,recipient_key,channel,kind)
  select t.id,t.notification_revision,'staff:'||t.assigned_staff_id::text,ch,'due_soon'
  from public.tasks t cross join unnest(array['email']) ch
  where t.status in ('pending','in_progress') and t.assigned_staff_id is not null
    and t.due_at>now() and t.due_at<=now()+interval '24 hours'
  on conflict do nothing;

  insert into public.task_notification_deliveries(task_id,revision,recipient_key,channel,kind)
  select t.id,t.notification_revision,r.recipient_key,'email','overdue'
  from public.tasks t join shab_private.notification_recipients() r
    on (r.recipient_key='staff:'||t.assigned_staff_id::text or r.administrator_user_id is not null) and r.active
  where t.status in ('pending','in_progress') and t.due_at<now()
  on conflict do nothing;

  insert into public.task_notification_deliveries(task_id,revision,recipient_key,channel,kind,period_key)
  select t.id,t.notification_revision,r.recipient_key,'email','follow_up',to_char(now() at time zone 'Asia/Dubai','YYYY-MM-DD')
  from public.tasks t join shab_private.notification_recipients() r on r.administrator_user_id is not null and r.active
  where t.status in ('pending','in_progress') and t.due_at<now()
    and extract(hour from now() at time zone 'Asia/Dubai')>=9
    and exists(select 1 from public.task_notification_deliveries d where d.task_id=t.id and d.revision=t.notification_revision
      and d.recipient_key=r.recipient_key and d.kind='overdue' and d.status='accepted'
      and (d.accepted_at at time zone 'Asia/Dubai')::date < (now() at time zone 'Asia/Dubai')::date)
  on conflict do nothing;
end;$$;
revoke all on function public.plan_task_notifications() from public,anon,authenticated;
grant execute on function public.plan_task_notifications() to service_role;

update public.task_notification_deliveries set status='cancelled',last_error='WhatsApp uses manual sending.',updated_at=now() where channel='whatsapp' and status in ('queued','blocked','failed');
create function public.get_my_task_alerts()
returns table(id text,task_id uuid,title text,description text,priority text,due_at timestamptz,assignee text,kind text)
language sql stable security invoker set search_path=pg_catalog,public as $$
 select concat('task:',a.user_id,':',t.id,':',t.notification_revision,':',
   case when t.due_at<now() then to_char((now() at time zone 'Asia/Dubai')-interval '9 hours','YYYY-MM-DD') else 'assignment' end),
   t.id,t.title,t.description,t.priority,t.due_at,coalesce(s.full_name,'Unassigned'),
   case when t.due_at<now() then 'overdue' when t.due_at<=now()+interval '24 hours' then 'due_soon' else 'assigned' end
 from public.tasks t
 join public.app_user_access a on a.user_id=auth.uid() and a.is_active
 left join public.staff s on s.id=t.assigned_staff_id
 where t.status in ('pending','in_progress') and (
   (a.access_role='administrator' and t.due_at<now())
   or (s.status='active' and (s.user_id=a.user_id or (s.user_id is null and lower(trim(s.email))=a.email)))
 )
 order by (t.due_at<now()) desc nulls last,t.due_at asc nulls last,t.id limit 50;
$$;
revoke all on function public.get_my_task_alerts() from public,anon;
grant execute on function public.get_my_task_alerts() to authenticated;
commit;
