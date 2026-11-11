-- Existing owner-only FOR ALL policy also applies to DELETE.
grant delete on public.private_sales_entries to authenticated;
