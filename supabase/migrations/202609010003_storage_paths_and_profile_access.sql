-- Align database paths with the recursive Storage upload layout and allow
-- authenticated users to inspect their own membership state while approval is pending.

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/ktx2',
  'application/octet-stream'
]
where id = 'vworld-catalog-originals';

update public.image_occurrences
set asset_storage_path = 'originals/' || asset_storage_path
where asset_storage_path is not null
  and asset_storage_path not like 'originals/%';

update public.image_occurrences
set preview_storage_path = 'previews/' || preview_storage_path
where preview_storage_path is not null
  and preview_storage_path not like 'previews/%';

drop policy if exists profiles_read_active on public.profiles;

create policy profiles_read_active
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_active_member());
