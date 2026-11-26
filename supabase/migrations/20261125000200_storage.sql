-- Private bucket for screenshots. Files are saved as "<user id>/<interaction id>.jpg".
-- A signed-in user can reach only the files inside the folder named after their own id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'screenshots',
  'screenshots',
  false,
  5242880, -- 5 MB. Screenshots are resized to about 1280 px before upload.
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "screenshots: owner reads" on storage.objects for select to authenticated
  using (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "screenshots: owner uploads" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "screenshots: owner replaces" on storage.objects for update to authenticated
  using (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "screenshots: owner deletes" on storage.objects for delete to authenticated
  using (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
