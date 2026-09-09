-- Upsert requires SELECT as well as INSERT/UPDATE on an existing object.
-- Keep object management scoped to the authenticated user's own folder.

drop policy if exists "Users can read their own profile photo object" on storage.objects;
create policy "Users can read their own profile photo object"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their own profile photo" on storage.objects;
create policy "Users can delete their own profile photo"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
