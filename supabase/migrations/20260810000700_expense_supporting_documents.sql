begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-documents',
  'expense-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.expense_attachments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint expense_attachments_mime_check check (
    mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  )
);

create index if not exists expense_attachments_expense_idx
on public.expense_attachments(expense_id, created_at desc);

alter table public.expense_attachments enable row level security;
drop policy if exists expense_attachments_read on public.expense_attachments;
drop policy if exists expense_attachments_insert on public.expense_attachments;
drop policy if exists expense_attachments_delete_draft on public.expense_attachments;
create policy expense_attachments_read on public.expense_attachments
for select to authenticated using (true);
create policy expense_attachments_insert on public.expense_attachments
for insert to authenticated with check (
  auth.uid() is not null
  and uploaded_by = auth.uid()
  and exists(select 1 from public.expenses where id = expense_id and status <> 'void')
);
create policy expense_attachments_delete_draft on public.expense_attachments
for delete to authenticated using (
  exists(select 1 from public.expenses where id = expense_id and status = 'draft')
);
revoke all on public.expense_attachments from public, anon;
grant select, insert, delete on public.expense_attachments to authenticated;

drop policy if exists expense_documents_read on storage.objects;
drop policy if exists expense_documents_insert on storage.objects;
drop policy if exists expense_documents_delete_draft on storage.objects;
create policy expense_documents_read on storage.objects
for select to authenticated using (bucket_id = 'expense-documents');
create policy expense_documents_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'expense-documents'
  and exists (
    select 1 from public.expenses
    where id::text = (storage.foldername(name))[1]
      and status <> 'void'
  )
);
create policy expense_documents_delete_draft on storage.objects
for delete to authenticated using (
  bucket_id = 'expense-documents'
  and exists (
    select 1 from public.expenses
    where id::text = (storage.foldername(name))[1]
      and status = 'draft'
  )
);

commit;
