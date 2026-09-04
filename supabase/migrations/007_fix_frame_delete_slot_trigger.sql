-- Make deferred slot-count validation compatible with frame deletion.
-- Requires migrations 001-006.
-- The frame_slots foreign key uses ON DELETE CASCADE, so a deferred DELETE
-- trigger can run after the parent frame has already been removed.

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
  -- Cascaded frame_slots deletes are valid after their parent frame is gone.
  -- Existing frames still receive the same slot-count validation below.
  if not exists (
    select 1
    from public.frames
    where id = target_frame_id
  ) then
    return;
  end if;

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
