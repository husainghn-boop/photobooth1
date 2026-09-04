-- Phase 1 frame permissions.
-- Adds database-owned admin roles and extends community-frame policies.
-- Official frames remain protected from admin mutation in this phase.

-- Every existing and new profile is a normal user unless explicitly promoted
-- by a trusted operator outside the application.
alter table public.profiles
  add column if not exists role text not null default 'user';

alter table public.profiles
  drop constraint if exists profiles_role_check,
  add constraint profiles_role_check check (role in ('user', 'admin'));

-- Preserve the current role during self-service profile updates. This avoids
-- allowing a user to promote themselves through a direct profiles UPDATE.
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.current_profile_role() from public, anon;
grant execute on function public.current_profile_role() to authenticated;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and role = (select public.current_profile_role())
);

-- Read the role from the database, never from client metadata or local storage.
-- SECURITY DEFINER avoids profiles RLS recursion when this function is used by
-- frame policies. The fixed search_path prevents object-shadowing surprises.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role = 'admin'
     from public.profiles p
     where p.id = (select auth.uid())
       and (select auth.jwt() ->> 'is_anonymous') = 'false'),
    false
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Public visibility is unchanged for guests and normal users. Admins may
-- inspect community rows they manage, including inactive/private rows, so RLS
-- can support management of any community frame without exposing official
-- frame mutation.
drop policy if exists frames_select_admin_community on public.frames;
create policy frames_select_admin_community on public.frames for select to authenticated
using (type = 'community' and (select public.is_admin()));

-- Normal-user policies remain owner-only. Admins can manage community frames,
-- but the type checks keep official frames protected.
drop policy if exists frames_update_own_community on public.frames;
create policy frames_update_own_community on public.frames for update to authenticated
using (
  type = 'community'
  and (
    owner_id = (select auth.uid())
    or (select public.is_admin())
  )
  and (select auth.jwt() ->> 'is_anonymous') = 'false'
)
with check (
  type = 'community'
  and (
    owner_id = (select auth.uid())
    or (select public.is_admin())
  )
  and (select auth.jwt() ->> 'is_anonymous') = 'false'
);

drop policy if exists frames_delete_own_community on public.frames;
create policy frames_delete_own_community on public.frames for delete to authenticated
using (
  type = 'community'
  and (
    owner_id = (select auth.uid())
    or (select public.is_admin())
  )
  and (select auth.jwt() ->> 'is_anonymous') = 'false'
);

-- Slot visibility follows frame visibility, with admin access to community
-- frames needed for complete management. Mutation remains community-only.
drop policy if exists frame_slots_select_admin_community on public.frame_slots;
create policy frame_slots_select_admin_community on public.frame_slots for select to authenticated
using (
  (select public.is_admin())
  and exists (
    select 1 from public.frames
    where frames.id = frame_slots.frame_id
      and frames.type = 'community'
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
      and (
        frames.owner_id = (select auth.uid())
        or (select public.is_admin())
      )
  )
)
with check (
  (select auth.jwt() ->> 'is_anonymous') = 'false'
  and exists (
    select 1 from public.frames
    where frames.id = frame_slots.frame_id
      and frames.type = 'community'
      and (
        frames.owner_id = (select auth.uid())
        or (select public.is_admin())
      )
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
      and (
        frames.owner_id = (select auth.uid())
        or (select public.is_admin())
      )
  )
);
