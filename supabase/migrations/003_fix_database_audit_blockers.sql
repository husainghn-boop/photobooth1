-- Fixes for the production audit of migrations 001 and 002.
-- Requires 001_initial_photobooth_schema.sql and 002_correct_frame_guest_storage.sql.
-- Supabase Anonymous Auth users have auth.uid() but are excluded from
-- community authoring by the standard is_anonymous JWT claim.

-- Preserve community frames when their owner profile is deleted. The existing
-- community owner check is intentionally incompatible with SET NULL.
alter table public.frames
  drop constraint if exists frames_owner_id_fkey;

alter table public.frames
  add constraint frames_owner_id_fkey
  foreign key (owner_id)
  references public.profiles(id)
  on delete restrict;

-- Validate one frame's complete slot set without relying on the caller's RLS
-- visibility. The constraint triggers below invoke this at commit time.
create or replace function public.assert_frame_slot_count(target_frame_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_count integer;
  actual_count integer;
begin
  select photo_count into expected_count
  from public.frames
  where id = target_frame_id;

  if expected_count is null then
    raise exception 'Frame % does not exist', target_frame_id;
  end if;

  select count(*) into actual_count
  from public.frame_slots
  where frame_id = target_frame_id;

  if actual_count <> expected_count then
    raise exception 'Frame % requires % slots but has %',
      target_frame_id, expected_count, actual_count;
  end if;
end;
$$;

create or replace function public.validate_frame_slot_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.assert_frame_slot_count(new.frame_id);
  elsif tg_op = 'DELETE' then
    perform public.assert_frame_slot_count(old.frame_id);
  else
    perform public.assert_frame_slot_count(new.frame_id);
    if old.frame_id is distinct from new.frame_id then
      perform public.assert_frame_slot_count(old.frame_id);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists frame_slots_count_check on public.frame_slots;
create constraint trigger frame_slots_count_check
after insert or update or delete on public.frame_slots
deferrable initially deferred
for each row execute function public.validate_frame_slot_count();

create or replace function public.validate_frame_photo_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_frame_slot_count(new.id);
  return null;
end;
$$;

drop trigger if exists frames_photo_count_validation on public.frames;
create constraint trigger frames_photo_count_validation
after update of photo_count on public.frames
deferrable initially deferred
for each row execute function public.validate_frame_photo_count();

revoke all on function public.assert_frame_slot_count(uuid) from public, anon, authenticated;
revoke all on function public.validate_frame_slot_count() from public, anon, authenticated;
revoke all on function public.validate_frame_photo_count() from public, anon, authenticated;

-- Anonymous Auth users can use sessions and session-owned assets, but may not
-- author community frames. The explicit false check fails closed if the claim
-- is absent rather than granting authoring access accidentally.
drop policy if exists frames_insert_community on public.frames;
create policy frames_insert_community on public.frames for insert to authenticated
with check (
  type = 'community'
  and owner_id = (select auth.uid())
  and (select auth.jwt() ->> 'is_anonymous') = 'false'
);

drop policy if exists frames_update_own_community on public.frames;
create policy frames_update_own_community on public.frames for update to authenticated
using (
  type = 'community'
  and owner_id = (select auth.uid())
  and (select auth.jwt() ->> 'is_anonymous') = 'false'
)
with check (
  type = 'community'
  and owner_id = (select auth.uid())
  and (select auth.jwt() ->> 'is_anonymous') = 'false'
);

drop policy if exists frames_delete_own_community on public.frames;
create policy frames_delete_own_community on public.frames for delete to authenticated
using (
  type = 'community'
  and owner_id = (select auth.uid())
  and (select auth.jwt() ->> 'is_anonymous') = 'false'
);

drop policy if exists frame_slots_insert_own_community on public.frame_slots;
create policy frame_slots_insert_own_community on public.frame_slots for insert to authenticated
with check (
  (select auth.jwt() ->> 'is_anonymous') = 'false'
  and exists (
    select 1 from public.frames
    where frames.id = frame_slots.frame_id
      and frames.type = 'community'
      and frames.owner_id = (select auth.uid())
  )
);

drop policy if exists frame_slots_update_own_community on public.frame_slots;
create policy frame_slots_update_own_community on public.frame_slots for update to authenticated
using (
  (select auth.jwt() ->> 'is_anonymous') = 'false'
  and exists (
    select 1 from public.frames
    where frames.id = frame_slots.frame_id
      and frames.type = 'community'
      and frames.owner_id = (select auth.uid())
  )
)
with check (
  (select auth.jwt() ->> 'is_anonymous') = 'false'
  and exists (
    select 1 from public.frames
    where frames.id = frame_slots.frame_id
      and frames.type = 'community'
      and frames.owner_id = (select auth.uid())
  )
);

drop policy if exists frame_slots_delete_own_community on public.frame_slots;
create policy frame_slots_delete_own_community on public.frame_slots for delete to authenticated
using (
  (select auth.jwt() ->> 'is_anonymous') = 'false'
  and exists (
    select 1 from public.frames
    where frames.id = frame_slots.frame_id
      and frames.type = 'community'
      and frames.owner_id = (select auth.uid())
  )
);

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
  slot_record record;
  slot_count integer;
begin
  if auth.uid() is null or (auth.jwt() ->> 'is_anonymous') <> 'false' then
    raise exception 'Registered authentication required';
  end if;
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

  for slot_record in
    select value, ordinality
    from jsonb_array_elements(p_slots) with ordinality
  loop
    if not (slot_record.value ? 'slot_order')
       or not (slot_record.value ? 'x')
       or not (slot_record.value ? 'y')
       or not (slot_record.value ? 'width')
       or not (slot_record.value ? 'height') then
      raise exception 'Slot geometry is incomplete';
    end if;
    if (slot_record.value->>'slot_order')::integer <> slot_record.ordinality
       or (slot_record.value->>'width')::numeric <= 0
       or (slot_record.value->>'height')::numeric <= 0
       or coalesce((slot_record.value->>'object_position_x')::numeric, .5) not between 0 and 1
       or coalesce((slot_record.value->>'object_position_y')::numeric, .5) not between 0 and 1 then
      raise exception 'Invalid frame slot geometry';
    end if;
    perform (slot_record.value->>'x')::numeric;
    perform (slot_record.value->>'y')::numeric;
    perform coalesce((slot_record.value->>'rotation')::numeric, 0);
  end loop;

  insert into public.frames (
    name, description, type, owner_id, preview_path, overlay_path,
    layout_type, photo_count, canvas_width, canvas_height
  ) values (
    trim(p_name), p_description, 'community', auth.uid(), p_preview_path,
    p_overlay_path, trim(p_layout_type), p_photo_count, p_canvas_width,
    p_canvas_height
  ) returning * into new_frame;

  for slot_record in
    select value from jsonb_array_elements(p_slots)
  loop
    insert into public.frame_slots (
      frame_id, slot_order, x, y, width, height, rotation,
      object_position_x, object_position_y
    ) values (
      new_frame.id, (slot_record.value->>'slot_order')::integer,
      (slot_record.value->>'x')::numeric,
      (slot_record.value->>'y')::numeric,
      (slot_record.value->>'width')::numeric,
      (slot_record.value->>'height')::numeric,
      coalesce((slot_record.value->>'rotation')::numeric, 0),
      coalesce((slot_record.value->>'object_position_x')::numeric, .5),
      coalesce((slot_record.value->>'object_position_y')::numeric, .5)
    );
  end loop;
  return new_frame;
end;
$$;

revoke all on function public.create_community_frame(text, text, text, integer, numeric, numeric, text, text, jsonb) from public;
grant execute on function public.create_community_frame(text, text, text, integer, numeric, numeric, text, text, jsonb) to authenticated;

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
      and f.type = 'community' and f.owner_id = (select auth.uid())
  )
);

drop policy if exists frame_assets_update_own on storage.objects;
create policy frame_assets_update_own on storage.objects for update to authenticated
using (
  (select auth.jwt() ->> 'is_anonymous') = 'false'
  and bucket_id = 'frame-assets'
  and split_part(name, '/', 1) = 'community'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (select 1 from public.frames f where f.id = public.storage_frame_id_from_path(name) and f.type = 'community' and f.owner_id = (select auth.uid()))
)
with check (
  (select auth.jwt() ->> 'is_anonymous') = 'false'
  and bucket_id = 'frame-assets'
  and split_part(name, '/', 1) = 'community'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (select 1 from public.frames f where f.id = public.storage_frame_id_from_path(name) and f.type = 'community' and f.owner_id = (select auth.uid()))
);

drop policy if exists frame_assets_delete_own on storage.objects;
create policy frame_assets_delete_own on storage.objects for delete to authenticated
using (
  (select auth.jwt() ->> 'is_anonymous') = 'false'
  and bucket_id = 'frame-assets'
  and split_part(name, '/', 1) = 'community'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (select 1 from public.frames f where f.id = public.storage_frame_id_from_path(name) and f.type = 'community' and f.owner_id = (select auth.uid()))
);
