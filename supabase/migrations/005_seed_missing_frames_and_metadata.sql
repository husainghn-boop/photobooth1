-- 005_seed_missing_frames_and_metadata.sql
-- 
-- Safely adds missing frame metadata columns and seeds missing official frames.
-- This migration is idempotent and preserves all existing data.
-- 
-- Changes:
-- 1. Adds width, height, canvas_width, canvas_height, creator_name, tags columns
--    to public.frames (only if they don't already exist)
-- 2. Updates existing official frames with metadata
-- 3. Seeds Double Portrait and Four Grid frames
-- 4. Seeds frame_slots for the new frames

-- ============================================================================
-- Step 1: Add missing metadata columns to frames table
-- ============================================================================
-- These columns support the current Frame TypeScript interface and allow
-- complete frame data to be queried from the database rather than only from
-- sampleFrames.ts

ALTER TABLE public.frames
ADD COLUMN IF NOT EXISTS width INTEGER DEFAULT 1080,
ADD COLUMN IF NOT EXISTS height INTEGER DEFAULT 1440,
ADD COLUMN IF NOT EXISTS canvas_width INTEGER DEFAULT 1080,
ADD COLUMN IF NOT EXISTS canvas_height INTEGER DEFAULT 1440,
ADD COLUMN IF NOT EXISTS creator_name TEXT,
ADD COLUMN IF NOT EXISTS tags JSONB;

-- ============================================================================
-- Step 2: Update existing official frames with dimensions and metadata
-- ============================================================================
-- Sets canonical values for frames already in the database.
-- Uses COALESCE to preserve any existing creator_name or tags if already set.

UPDATE public.frames
SET
  width = 1080,
  height = 1440,
  canvas_width = 1080,
  canvas_height = 1440,
  creator_name = COALESCE(creator_name, 'Official'),
  tags = COALESCE(tags, '[]'::jsonb)
WHERE type = 'official' AND is_active = true;

-- ============================================================================
-- Step 3: Seed missing official frames (Double Portrait and Four Grid)
-- ============================================================================
-- These frames are defined in src/data/sampleFrames.ts and are part of the
-- official frame collection. ON CONFLICT DO NOTHING ensures this is safe to
-- run multiple times and won't duplicate or overwrite existing frames.

INSERT INTO public.frames (
  id,
  name,
  description,
  type,
  owner_id,
  preview_path,
  overlay_path,
  layout_type,
  photo_count,
  is_public,
  is_active,
  width,
  height,
  canvas_width,
  canvas_height,
  creator_name,
  tags,
  created_at,
  updated_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000003'::uuid,
    'Double Portrait',
    NULL,
    'official',
    NULL,
    NULL,
    NULL,
    'duo',
    2,
    true,
    true,
    1080,
    1440,
    1080,
    1440,
    'Official',
    '["portrait", "duo", "side-by-side"]'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000004'::uuid,
    'Four Grid',
    NULL,
    'official',
    NULL,
    NULL,
    NULL,
    'grid',
    4,
    true,
    true,
    1080,
    1440,
    1080,
    1440,
    'Official',
    '["grid", "square", "4-up"]'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Step 4: Seed frame_slots for Double Portrait
-- ============================================================================
-- Frame ID: 00000000-0000-0000-0000-000000000003
-- 
-- Coordinates from src/data/sampleFrames.ts doublePortrait:
--   Slot 1: x=80, y=120, width=430, height=1180
--   Slot 2: x=570, y=120, width=430, height=1180

INSERT INTO public.frame_slots (
  frame_id,
  slot_order,
  x,
  y,
  width,
  height,
  rotation,
  object_position_x,
  object_position_y,
  created_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000003'::uuid,
    1,
    80,
    120,
    430,
    1180,
    0,
    0.5,
    0.5,
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000003'::uuid,
    2,
    570,
    120,
    430,
    1180,
    0,
    0.5,
    0.5,
    now()
  )
ON CONFLICT (frame_id, slot_order) DO NOTHING;

-- ============================================================================
-- Step 5: Seed frame_slots for Four Grid
-- ============================================================================
-- Frame ID: 00000000-0000-0000-0000-000000000004
-- 
-- Coordinates from src/data/sampleFrames.ts fourGrid:
--   Slot 1: x=100, y=130, width=370, height=470
--   Slot 2: x=610, y=130, width=370, height=470
--   Slot 3: x=100, y=700, width=370, height=470
--   Slot 4: x=610, y=700, width=370, height=470

INSERT INTO public.frame_slots (
  frame_id,
  slot_order,
  x,
  y,
  width,
  height,
  rotation,
  object_position_x,
  object_position_y,
  created_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000004'::uuid,
    1,
    100,
    130,
    370,
    470,
    0,
    0.5,
    0.5,
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000004'::uuid,
    2,
    610,
    130,
    370,
    470,
    0,
    0.5,
    0.5,
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000004'::uuid,
    3,
    100,
    700,
    370,
    470,
    0,
    0.5,
    0.5,
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000004'::uuid,
    4,
    610,
    700,
    370,
    470,
    0,
    0.5,
    0.5,
    now()
  )
ON CONFLICT (frame_id, slot_order) DO NOTHING;
