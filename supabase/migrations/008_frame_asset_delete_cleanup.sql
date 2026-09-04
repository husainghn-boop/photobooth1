-- Allow community frame assets to be cleaned up after their parent frame is
-- deleted. The existing policy requires the parent frame to exist, but the
-- frames delete uses ON DELETE CASCADE and runs asset cleanup afterward.
-- Requires migrations 001-007.

-- A registered user may delete only assets in their own community namespace.
drop policy if exists frame_assets_delete_own on storage.objects;
create policy frame_assets_delete_own on storage.objects for delete to authenticated
using (
  (select auth.jwt() ->> 'is_anonymous') = 'false'
  and bucket_id = 'frame-assets'
  and split_part(name, '/', 1) = 'community'
  and split_part(name, '/', 2) = (select auth.uid())::text
);

-- An admin may clean up any community asset. Official assets use a different
-- namespace and remain outside this policy.
drop policy if exists frame_assets_delete_admin_community on storage.objects;
create policy frame_assets_delete_admin_community on storage.objects for delete to authenticated
using (
  (select public.is_admin())
  and bucket_id = 'frame-assets'
  and split_part(name, '/', 1) = 'community'
);
