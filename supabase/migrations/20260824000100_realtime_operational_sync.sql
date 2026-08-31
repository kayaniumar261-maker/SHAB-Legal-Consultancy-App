do $$
declare
  table_name text;
  realtime_tables text[] := array[
    'clients', 'cases', 'tasks', 'hearings', 'documents',
    'invoices', 'payments', 'credit_notes', 'payment_reversals',
    'activity_logs', 'case_activities', 'case_notes',
    'case_status_history', 'staff', 'notifications'
  ];
begin
  foreach table_name in array realtime_tables loop
    if to_regclass(format('public.%I', table_name)) is not null
      and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      )
    then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end
$$;
