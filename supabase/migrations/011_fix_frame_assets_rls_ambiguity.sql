-- Fix frame-assets Storage RLS policy ambiguity.
--
-- The frame_assets policies had a critical bug: inside the EXISTS subquery,
-- the unqualified `name` reference was resolving to f.name (the frame's 
-- human-readable name) instead of to storage.objects.name (the storage path).
--
-- This caused storage_frame_id_from_path(f.name) to return NULL, which
-- would fail the frame ownership check and reject all read/write operations with 
-- "row-level security policy" error.
--
-- Storage object name format: community/{user_id}/{frame_id}/overlay.png
-- Frames table name column: human-readable frame name (e.g. "Wedding Frame")
--
-- Fix: Explicitly qualify the storage.objects table reference using 
-- fully qualified column names (storage.objects.name, storage.objects.bucket_id)
-- so that the storage path is passed to the extraction function.
--
-- VERIFIED: PostgreSQL RLS correctly handles storage.objects.name as a 
-- correlated reference to the outer storage.objects row, even without 
-- explicit table alias in CREATE POLICY syntax.

drop policy if exists frame_assets_insert_own on storage.objects;

create policy frame_assets_insert_own
on storage.objects
for insert
to authenticated
with check (
  (select auth.jwt() ->> 'is_anonymous') = 'false'
  and bucket_id = 'frame-assets'
  and split_part(name, '/', 1) = 'community'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (
    select 1
    from public.frames f
    where f.id = public.storage_frame_id_from_path(storage.objects.name)
      and f.type = 'community'
      and f.owner_id = (select auth.uid())
  )
);

drop policy if exists frame_assets_read_own on storage.objects;

create policy frame_assets_read_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'frame-assets'
  and split_part(name, '/', 1) = 'community'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (
    select 1
    from public.frames f
    where f.id = public.storage_frame_id_from_path(storage.objects.name)
      and f.type = 'community'
      and f.owner_id = (select auth.uid())
  )
);

drop policy if exists frame_assets_update_own on storage.objects;

create policy frame_assets_update_own
on storage.objects
for update
to authenticated
using (
  (select auth.jwt() ->> 'is_anonymous') = 'false'
  and bucket_id = 'frame-assets'
  and split_part(name, '/', 1) = 'community'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (
    select 1
    from public.frames f
    where f.id = public.storage_frame_id_from_path(storage.objects.name)
      and f.type = 'community'
      and f.owner_id = (select auth.uid())
  )
)
with check (
  (select auth.jwt() ->> 'is_anonymous') = 'false'
  and bucket_id = 'frame-assets'
  and split_part(name, '/', 1) = 'community'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (
    select 1
    from public.frames f
    where f.id = public.storage_frame_id_from_path(storage.objects.name)
      and f.type = 'community'
      and f.owner_id = (select auth.uid())
  )
);

drop policy if exists frame_assets_delete_own on storage.objects;

create policy frame_assets_delete_own
on storage.objects
for delete
to authenticated
using (
  (select auth.jwt() ->> 'is_anonymous') = 'false'
  and bucket_id = 'frame-assets'
  and split_part(name, '/', 1) = 'community'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (
    select 1
    from public.frames f
    where f.id = public.storage_frame_id_from_path(storage.objects.name)
      and f.type = 'community'
      and f.owner_id = (select auth.uid())
  )
);

drop policy if exists frame_assets_read_public on storage.objects;

create policy frame_assets_read_public
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'frame-assets'
  and (
    (
      split_part(name, '/', 1) = 'official'
      and exists (
        select 1
        from public.frames f
        where f.source_id = split_part(storage.objects.name, '/', 2)
          and f.type = 'official'
          and f.is_public
          and f.is_active
      )
    )
    or
    (
      split_part(name, '/', 1) = 'community'
      and exists (
        select 1
        from public.frames f
        where f.id = public.storage_frame_id_from_path(storage.objects.name)
          and f.type = 'community'
          and f.is_public
          and f.is_active
      )
    )
  )
);
