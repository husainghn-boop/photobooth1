-- Corrections to 001_initial_photobooth_schema.sql.
-- Guest sessions use Supabase Anonymous Auth. Anonymous users receive auth.uid()
-- and the authenticated role without creating a normal account.

alter table public.frames
  add column if not exists source_id text,
  add column if not exists canvas_width numeric,
  add column if not exists canvas_height numeric;

update public.frames
set source_id = case name
  when 'Classic Strip' then 'classic-strip'
  when 'Editorial' then 'editorial'
  else source_id
end,
canvas_width = coalesce(canvas_width, 1080),
canvas_height = coalesce(canvas_height, 1440)
where name in ('Classic Strip', 'Editorial');

alter table public.frames
  alter column canvas_width set not null,
  alter column canvas_height set not null;

alter table public.frames
  drop constraint if exists frames_canvas_width_check,
  drop constraint if exists frames_canvas_height_check,
  add constraint frames_canvas_width_check check (canvas_width > 0),
  add constraint frames_canvas_height_check check (canvas_height > 0);

create unique index if not exists frames_source_id_unique
  on public.frames (source_id)
  where source_id is not null;

-- Only official frames present in src/data/sampleFrames.ts are seeded. The
-- current inline SVG is not a Storage asset, so overlay_path remains null.
update public.frames
set source_id = 'classic-strip', canvas_width = 1080, canvas_height = 1440
where name = 'Classic Strip' and type = 'official';
update public.frames
set source_id = 'editorial', canvas_width = 1080, canvas_height = 1440
where name = 'Editorial' and type = 'official';

drop policy if exists frames_select_own_community on public.frames;
create policy frames_select_own_community on public.frames for select to authenticated
using (type = 'community' and owner_id = (select auth.uid()));

drop policy if exists frame_slots_select_own_community on public.frame_slots;
create policy frame_slots_select_own_community on public.frame_slots for select to authenticated
using (exists (
  select 1 from public.frames
  where frames.id = frame_slots.frame_id
    and frames.type = 'community'
    and frames.owner_id = (select auth.uid())
));

-- Complete community frames must be created through this atomic RPC. This
-- avoids committing a frame with a partial or mismatched slot set.
create or replace function public.create_community_frame(
  p_name text,
  p_description text,
  p_layout_type text,
  p_photo_count integer,
  p_canvas_width numeric,
  p_canvas_height numeric,
  p_preview_path text,
  p_overlay_path text,
  p_slots jsonb
)
returns public.frames
language plpgsql
security definer
set search_path = public
as $$
declare
  new_frame public.frames;
  slot_record jsonb;
  slot_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_name is null or length(trim(p_name)) = 0
     or p_layout_type is null or length(trim(p_layout_type)) = 0
     or p_photo_count < 1 or p_canvas_width <= 0 or p_canvas_height <= 0
     or jsonb_typeof(p_slots) <> 'array' then
    raise exception 'Invalid frame metadata';
  end if;

  select count(*) into slot_count from jsonb_array_elements(p_slots);
  if slot_count <> p_photo_count then
    raise exception 'photo_count must equal the number of slots';
  end if;

  insert into public.frames (
    name, description, type, owner_id, preview_path, overlay_path,
    layout_type, photo_count, canvas_width, canvas_height
  ) values (
    trim(p_name), p_description, 'community', auth.uid(), p_preview_path,
    p_overlay_path, trim(p_layout_type), p_photo_count, p_canvas_width,
    p_canvas_height
  ) returning * into new_frame;

  for slot_record in select value from jsonb_array_elements(p_slots)
  loop
    if (slot_record->>'slot_order')::integer < 1
       or (slot_record->>'width')::numeric <= 0
       or (slot_record->>'height')::numeric <= 0
       or coalesce((slot_record->>'object_position_x')::numeric, .5) not between 0 and 1
       or coalesce((slot_record->>'object_position_y')::numeric, .5) not between 0 and 1 then
      raise exception 'Invalid frame slot geometry';
    end if;
    insert into public.frame_slots (
      frame_id, slot_order, x, y, width, height, rotation,
      object_position_x, object_position_y
    ) values (
      new_frame.id, (slot_record->>'slot_order')::integer,
      (slot_record->>'x')::numeric, (slot_record->>'y')::numeric,
      (slot_record->>'width')::numeric, (slot_record->>'height')::numeric,
      coalesce((slot_record->>'rotation')::numeric, 0),
      coalesce((slot_record->>'object_position_x')::numeric, .5),
      coalesce((slot_record->>'object_position_y')::numeric, .5)
    );
  end loop;
  return new_frame;
end;
$$;

revoke all on function public.create_community_frame(text, text, text, integer, numeric, numeric, text, text, jsonb) from public;
grant execute on function public.create_community_frame(text, text, text, integer, numeric, numeric, text, text, jsonb) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

alter table public.frame_slots
  drop constraint if exists frame_slots_object_position_x_check,
  drop constraint if exists frame_slots_object_position_y_check,
  add constraint frame_slots_object_position_x_check check (object_position_x between 0 and 1),
  add constraint frame_slots_object_position_y_check check (object_position_y between 0 and 1);

create or replace function public.validate_frame_slot_count()
returns trigger
language plpgsql
as $$
declare
  expected_count integer;
  actual_count integer;
  target_frame_id uuid := coalesce(new.frame_id, old.frame_id);
begin
  select photo_count into expected_count from public.frames where id = target_frame_id;
  select count(*) into actual_count from public.frame_slots where frame_id = target_frame_id;
  if expected_count is not null and actual_count <> expected_count then
    raise exception 'Frame % requires % slots but has %', target_frame_id, expected_count, actual_count;
  end if;
  return null;
end;
$$;

drop trigger if exists frame_slots_count_check on public.frame_slots;
create constraint trigger frame_slots_count_check
after insert or update or delete on public.frame_slots
deferrable initially deferred
for each row execute function public.validate_frame_slot_count();

insert into storage.buckets (id, name, public)
values
  ('frame-assets', 'frame-assets', false),
  ('photos', 'photos', false),
  ('results', 'results', false)
on conflict (id) do update set public = excluded.public;

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

create policy frame_assets_read_public on storage.objects for select to anon, authenticated
using (
  bucket_id = 'frame-assets' and (
    (split_part(name, '/', 1) = 'official' and exists (
      select 1 from public.frames f
      where f.source_id = split_part(name, '/', 2) and f.type = 'official'
        and f.is_public and f.is_active
    ))
    or (split_part(name, '/', 1) = 'community' and exists (
      select 1 from public.frames f
      where f.id = public.storage_frame_id_from_path(name)
        and f.type = 'community' and f.is_public and f.is_active
    ))
  )
);

create policy frame_assets_read_own on storage.objects for select to authenticated
using (
  bucket_id = 'frame-assets' and split_part(name, '/', 1) = 'community'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (
    select 1 from public.frames f
    where f.id = public.storage_frame_id_from_path(name)
      and f.type = 'community' and f.owner_id = (select auth.uid())
  )
);

create policy frame_assets_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id = 'frame-assets' and split_part(name, '/', 1) = 'community'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (
    select 1 from public.frames f
    where f.id = public.storage_frame_id_from_path(name)
      and f.type = 'community' and f.owner_id = (select auth.uid())
  )
);

create policy frame_assets_update_own on storage.objects for update to authenticated
using (
  bucket_id = 'frame-assets' and split_part(name, '/', 1) = 'community'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (select 1 from public.frames f where f.id = public.storage_frame_id_from_path(name) and f.type = 'community' and f.owner_id = (select auth.uid()))
)
with check (
  bucket_id = 'frame-assets' and split_part(name, '/', 1) = 'community'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (select 1 from public.frames f where f.id = public.storage_frame_id_from_path(name) and f.type = 'community' and f.owner_id = (select auth.uid()))
);

create policy frame_assets_delete_own on storage.objects for delete to authenticated
using (
  bucket_id = 'frame-assets' and split_part(name, '/', 1) = 'community'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (select 1 from public.frames f where f.id = public.storage_frame_id_from_path(name) and f.type = 'community' and f.owner_id = (select auth.uid()))
);

create policy photos_owner_access on storage.objects for all to authenticated
using (bucket_id = 'photos' and exists (select 1 from public.sessions s where s.id::text = split_part(name, '/', 1) and s.user_id = (select auth.uid())))
with check (bucket_id = 'photos' and exists (select 1 from public.sessions s where s.id::text = split_part(name, '/', 1) and s.user_id = (select auth.uid())));

create policy results_owner_access on storage.objects for all to authenticated
using (bucket_id = 'results' and exists (select 1 from public.sessions s where s.id::text = split_part(name, '/', 1) and s.user_id = (select auth.uid())))
with check (bucket_id = 'results' and exists (select 1 from public.sessions s where s.id::text = split_part(name, '/', 1) and s.user_id = (select auth.uid())));
