-- Enable persistent PNG frame assets in the existing frame-assets design.
-- Requires migrations 001-008.
-- No application credentials or service-role access are required.

insert into storage.buckets (id, name, public)
values ('frame-assets', 'frame-assets', false)
on conflict (id) do update set public = false;

create or replace function public.storage_frame_id_from_path(path text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(path, '/', 1) = 'community'
      and split_part(path, '/', 3) ~ '^[0-9a-fA-F-]{36}$'
    then split_part(path, '/', 3)::uuid
    else null
  end
$$;

-- Public active community assets and official assets can be signed/read by
-- gallery users. The bucket remains private.
drop policy if exists frame_assets_read_public on storage.objects;
create policy frame_assets_read_public on storage.objects for select to anon, authenticated
using (
  bucket_id = 'frame-assets' and (
    (split_part(name, '/', 1) = 'official' and exists (
      select 1 from public.frames f
      where f.source_id = split_part(name, '/', 2)
        and f.type = 'official'
        and f.is_public
        and f.is_active
    ))
    or (split_part(name, '/', 1) = 'community' and exists (
      select 1 from public.frames f
      where f.id = public.storage_frame_id_from_path(name)
        and f.type = 'community'
        and f.is_public
        and f.is_active
    ))
  )
);

-- Owners can read their own community assets, including private frames.
drop policy if exists frame_assets_read_own on storage.objects;
create policy frame_assets_read_own on storage.objects for select to authenticated
using (
  (select auth.jwt() ->> 'is_anonymous') = 'false'
  and bucket_id = 'frame-assets'
  and split_part(name, '/', 1) = 'community'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (
    select 1 from public.frames f
    where f.id = public.storage_frame_id_from_path(name)
      and f.type = 'community'
      and f.owner_id = (select auth.uid())
  )
);

-- Admins can read any community asset needed for management.
drop policy if exists frame_assets_read_admin_community on storage.objects;
create policy frame_assets_read_admin_community on storage.objects for select to authenticated
using (
  (select public.is_admin())
  and bucket_id = 'frame-assets'
  and split_part(name, '/', 1) = 'community'
);

-- Registered users may upload only within their own community namespace, and
-- only after the RPC has created the matching community frame.
drop policy if exists frame_assets_insert_own on storage.objects;
create policy frame_assets_insert_own on storage.objects for insert to authenticated
with check (
  (select auth.jwt() ->> 'is_anonymous') = 'false'
  and bucket_id = 'frame-assets'
  and split_part(name, '/', 1) = 'community'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (
    select 1 from public.frames f
    where f.id = public.storage_frame_id_from_path(name)
      and f.type = 'community'
      and f.owner_id = (select auth.uid())
  )
);

-- Existing owner-scoped update behavior remains available.
drop policy if exists frame_assets_update_own on storage.objects;
create policy frame_assets_update_own on storage.objects for update to authenticated
using (
  (select auth.jwt() ->> 'is_anonymous') = 'false'
  and bucket_id = 'frame-assets'
  and split_part(name, '/', 1) = 'community'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (
    select 1 from public.frames f
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
    select 1 from public.frames f
    where f.id = public.storage_frame_id_from_path(name)
      and f.type = 'community'
      and f.owner_id = (select auth.uid())
  )
);
