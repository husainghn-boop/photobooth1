# Supabase Storage Plan

Create these private Supabase buckets:

- `frame-assets`
- `photos`
- `results`

Use these object paths:

- `official/{source_id}/preview.*` and `official/{source_id}/overlay.svg` in `frame-assets`
- `community/{user_id}/{frame_id}/preview.*` and `community/{user_id}/{frame_id}/overlay.svg` in `frame-assets`
- `photos/{session_id}/{photo_id}.png`
- `results/{session_id}/result.png`

Store only the object path in `preview_path`, `overlay_path`, `storage_path`, or
`result_path`. The corrective migration creates the three private buckets and
object policies. Official assets are readable only when their frame is active
and public; official assets are never writable by normal users. Community and
session paths are checked against their database owners.

Guest users use Supabase Anonymous Auth. They receive an `auth.uid()` and the
same owner-scoped RLS as signed-in users, but do not need a normal account.
Enable Anonymous sign-ins in Supabase Auth. Do not grant unrestricted `anon`
object access. Use scheduled cleanup for abandoned anonymous sessions and
their Storage objects.

The current MVP uses inline SVG and in-memory browser blobs, so no existing
assets can be copied automatically. Upload real overlays before setting
`overlay_path` on the seeded frames.