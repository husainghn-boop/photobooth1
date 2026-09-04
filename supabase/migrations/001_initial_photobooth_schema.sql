-- PhotoBooth initial schema.
-- Image bytes are stored in Supabase Storage; these tables store only paths.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.frames (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type text not null check (type in ('official', 'community')),
  owner_id uuid references public.profiles(id) on delete set null,
  preview_path text,
  overlay_path text,
  layout_type text not null,
  photo_count integer not null check (photo_count >= 1),
  is_public boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint official_frames_have_no_owner check (type = 'community' or owner_id is null),
  constraint community_frames_have_owner check (type = 'official' or owner_id is not null)
);

create table if not exists public.frame_slots (
  id uuid primary key default gen_random_uuid(),
  frame_id uuid not null references public.frames(id) on delete cascade,
  slot_order integer not null check (slot_order >= 1),
  x numeric not null,
  y numeric not null,
  width numeric not null check (width > 0),
  height numeric not null check (height > 0),
  rotation numeric not null default 0,
  object_position_x numeric not null default 0.5,
  object_position_y numeric not null default 0.5,
  created_at timestamptz not null default now(),
  unique (frame_id, slot_order)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  frame_id uuid not null references public.frames(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  current_step text not null default 'frame_selection' check (current_step in ('frame_selection', 'camera', 'review', 'editor', 'result')),
  result_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.session_photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  slot_order integer not null check (slot_order >= 1),
  storage_path text not null,
  original_width integer,
  original_height integer,
  retake_count integer not null default 0 check (retake_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, slot_order)
);

create table if not exists public.photo_edits (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.session_photos(id) on delete cascade,
  filter text,
  brightness numeric not null default 0,
  contrast numeric not null default 0,
  saturation numeric not null default 0,
  rotation numeric not null default 0,
  crop_x numeric,
  crop_y numeric,
  crop_scale numeric not null default 1 check (crop_scale > 0),
  updated_at timestamptz not null default now(),
  unique (photo_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists frames_set_updated_at on public.frames;
create trigger frames_set_updated_at before update on public.frames
for each row execute function public.set_updated_at();
drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at before update on public.sessions
for each row execute function public.set_updated_at();
drop trigger if exists session_photos_set_updated_at on public.session_photos;
create trigger session_photos_set_updated_at before update on public.session_photos
for each row execute function public.set_updated_at();
drop trigger if exists photo_edits_set_updated_at on public.photo_edits;
create trigger photo_edits_set_updated_at before update on public.photo_edits
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
security definer set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email), new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.frames enable row level security;
alter table public.frame_slots enable row level security;
alter table public.sessions enable row level security;
alter table public.session_photos enable row level security;
alter table public.photo_edits enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated
using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy frames_select_public on public.frames for select to anon, authenticated
using (is_public and is_active);
create policy frames_insert_community on public.frames for insert to authenticated
with check (type = 'community' and owner_id = (select auth.uid()));
create policy frames_update_own_community on public.frames for update to authenticated
using (type = 'community' and owner_id = (select auth.uid()))
with check (type = 'community' and owner_id = (select auth.uid()));
create policy frames_delete_own_community on public.frames for delete to authenticated
using (type = 'community' and owner_id = (select auth.uid()));

create policy frame_slots_select_public on public.frame_slots for select to anon, authenticated
using (exists (
  select 1 from public.frames
  where frames.id = frame_slots.frame_id and frames.is_public and frames.is_active
));
create policy frame_slots_insert_own_community on public.frame_slots for insert to authenticated
with check (exists (
  select 1 from public.frames
  where frames.id = frame_slots.frame_id and frames.type = 'community' and frames.owner_id = (select auth.uid())
));
create policy frame_slots_update_own_community on public.frame_slots for update to authenticated
using (exists (
  select 1 from public.frames
  where frames.id = frame_slots.frame_id and frames.type = 'community' and frames.owner_id = (select auth.uid())
)) with check (exists (
  select 1 from public.frames
  where frames.id = frame_slots.frame_id and frames.type = 'community' and frames.owner_id = (select auth.uid())
));
create policy frame_slots_delete_own_community on public.frame_slots for delete to authenticated
using (exists (
  select 1 from public.frames
  where frames.id = frame_slots.frame_id and frames.type = 'community' and frames.owner_id = (select auth.uid())
));

create policy sessions_select_own on public.sessions for select to authenticated
using (user_id = (select auth.uid()));
create policy sessions_insert_own on public.sessions for insert to authenticated
with check (user_id = (select auth.uid()));
create policy sessions_update_own on public.sessions for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy sessions_delete_own on public.sessions for delete to authenticated
using (user_id = (select auth.uid()));

create policy session_photos_select_own on public.session_photos for select to authenticated
using (exists (select 1 from public.sessions where sessions.id = session_photos.session_id and sessions.user_id = (select auth.uid())));
create policy session_photos_insert_own on public.session_photos for insert to authenticated
with check (exists (select 1 from public.sessions where sessions.id = session_photos.session_id and sessions.user_id = (select auth.uid())));
create policy session_photos_update_own on public.session_photos for update to authenticated
using (exists (select 1 from public.sessions where sessions.id = session_photos.session_id and sessions.user_id = (select auth.uid())))
with check (exists (select 1 from public.sessions where sessions.id = session_photos.session_id and sessions.user_id = (select auth.uid())));
create policy session_photos_delete_own on public.session_photos for delete to authenticated
using (exists (select 1 from public.sessions where sessions.id = session_photos.session_id and sessions.user_id = (select auth.uid())));

create policy photo_edits_select_own on public.photo_edits for select to authenticated
using (exists (select 1 from public.session_photos join public.sessions on sessions.id = session_photos.session_id where session_photos.id = photo_edits.photo_id and sessions.user_id = (select auth.uid())));
create policy photo_edits_insert_own on public.photo_edits for insert to authenticated
with check (exists (select 1 from public.session_photos join public.sessions on sessions.id = session_photos.session_id where session_photos.id = photo_edits.photo_id and sessions.user_id = (select auth.uid())));
create policy photo_edits_update_own on public.photo_edits for update to authenticated
using (exists (select 1 from public.session_photos join public.sessions on sessions.id = session_photos.session_id where session_photos.id = photo_edits.photo_id and sessions.user_id = (select auth.uid())))
with check (exists (select 1 from public.session_photos join public.sessions on sessions.id = session_photos.session_id where session_photos.id = photo_edits.photo_id and sessions.user_id = (select auth.uid())));
create policy photo_edits_delete_own on public.photo_edits for delete to authenticated
using (exists (select 1 from public.session_photos join public.sessions on sessions.id = session_photos.session_id where session_photos.id = photo_edits.photo_id and sessions.user_id = (select auth.uid())));

-- Official source frames from src/data/sampleFrames.ts. Inline SVG overlays are
-- intentionally not copied: upload them to frames/official/ and set overlay_path.
insert into public.frames (id, name, description, type, layout_type, photo_count)
values
  ('00000000-0000-0000-0000-000000000001', 'Classic Strip', null, 'official', 'strip', 4),
  ('00000000-0000-0000-0000-000000000002', 'Editorial', null, 'official', 'collage', 3)
on conflict (id) do nothing;

insert into public.frame_slots (frame_id, slot_order, x, y, width, height, rotation)
values
  ('00000000-0000-0000-0000-000000000001', 1, 140, 110, 800, 250, 0),
  ('00000000-0000-0000-0000-000000000001', 2, 140, 410, 800, 250, 0),
  ('00000000-0000-0000-0000-000000000001', 3, 140, 710, 800, 250, 0),
  ('00000000-0000-0000-0000-000000000001', 4, 140, 1010, 800, 250, 0),
  ('00000000-0000-0000-0000-000000000002', 1, 110, 90, 860, 700, 0),
  ('00000000-0000-0000-0000-000000000002', 2, 110, 860, 360, 360, 0),
  ('00000000-0000-0000-0000-000000000002', 3, 510, 860, 460, 360, 0)
on conflict (frame_id, slot_order) do nothing;
