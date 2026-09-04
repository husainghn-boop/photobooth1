-- Fix frame-assets Storage RLS.
--
-- Storage object name contains the frame ID:
-- community/{user_id}/{frame_id}/overlay.png
--
-- The previous policies incorrectly attempted to extract the frame ID
-- from frames.name instead of storage.objects.name.

drop policy if exists frame_assets_insert_own
on storage.objects;

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
    where f.id = public.storage_frame_id_from_path(name)
      and f.type = 'community'
      and f.owner_id = (select auth.uid())
  )
);


drop policy if exists frame_assets_read_own
on storage.objects;

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
    where f.id = public.storage_frame_id_from_path(name)
      and f.type = 'community'
      and f.owner_id = (select auth.uid())
  )
);


drop policy if exists frame_assets_update_own
on storage.objects;

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
    where f.id = public.storage_frame_id_from_path(name)
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
    where f.id = public.storage_frame_id_from_path(name)
      and f.type = 'community'
      and f.owner_id = (select auth.uid())
  )
);


drop policy if exists frame_assets_delete_own
on storage.objects;

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
    where f.id = public.storage_frame_id_from_path(name)
      and f.type = 'community'
      and f.owner_id = (select auth.uid())
  )
);


drop policy if exists frame_assets_read_public
on storage.objects;

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
        where f.source_id = split_part(name, '/', 2)
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
        where f.id = public.storage_frame_id_from_path(name)
          and f.type = 'community'
          and f.is_public
          and f.is_active
      )
    )
  )
);