import { Frame } from '../types'
import { sampleFrames } from '../data/sampleFrames'
import { supabase } from '../lib/supabaseClient'
import { getUserType } from './authService'
import { validateFrame } from '../utils/frameValidation'

const STORAGE_KEY = 'photobooth.frames'
const runtimeFrameAssets = new Map<string, string>()

class FrameServiceError extends Error {
  constructor(message: string, readonly allowLocalFallback = false) {
    super(message)
    this.name = 'FrameServiceError'
  }
}

export type FrameDeleteResult = { status: 'deleted'; id: string } | { status: 'not_found_or_inaccessible' }

export class FrameDeleteError extends Error {
  readonly code = 'database_error'

  constructor() {
    super('We could not delete this frame right now. Please try again.')
    this.name = 'FrameDeleteError'
  }
}

function loadStored(): Frame[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const frames = JSON.parse(raw) as Frame[]
    for (const frame of frames) {
      if (frame.frameImage) runtimeFrameAssets.set(frame.id, frame.frameImage)
    }
    return frames
  } catch {
    return []
  }
}

function saveStored(frames: Frame[]) {
  const persistedFrames = frames.map(({ frameImage: _frameImage, ...metadata }) => metadata)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedFrames))
  } catch (error) {
    if (import.meta.env.DEV) console.warn('Could not persist frame metadata locally.', error)
  }
}

function mergeFrames(remoteFrames: Frame[], storedFrames: Frame[]): Frame[] {
  const storedById = new Map(storedFrames.map((frame) => [frame.id, frame]))
  const mergedRemote = remoteFrames.map((frame) => ({
    ...storedById.get(frame.id),
    ...frame,
    frameImage: frame.frameImage || runtimeFrameAssets.get(frame.id) || storedById.get(frame.id)?.frameImage
  }))
  const remoteIds = new Set(remoteFrames.map((frame) => frame.id))
  return [...mergedRemote, ...storedFrames.filter((frame) => !remoteIds.has(frame.id)).map((frame) => ({
    ...frame,
    frameImage: runtimeFrameAssets.get(frame.id) || frame.frameImage
  }))]
}

function userFacingFrameError(error: unknown): Error {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('registered authentication required') || message.includes('row-level security')) {
    return new FrameServiceError('You must be signed in with a registered account to create a community frame.')
  }
  if (message.includes('invalid frame metadata') || message.includes('slot geometry') || message.includes('photo_count')) {
    return new FrameServiceError('The frame metadata or photo slots are invalid.')
  }
  return new FrameServiceError('We could not save this frame right now. Please try again.', true)
}

function frameSlotsForRpc(frame: Frame) {
  return frame.photoSlots.map((slot, index) => ({
    slot_order: (slot.photoIndex ?? index) + 1,
    x: slot.x,
    y: slot.y,
    width: slot.width,
    height: slot.height,
    rotation: slot.rotation ?? 0
  }))
}

async function uploadFrameAsset(frameImage: string, ownerId: string, frameId: string): Promise<string> {
  try {
    const response = await fetch(frameImage)
    if (!response.ok) {
      throw new Error(`Failed to fetch frame image: ${response.statusText}`)
    }
    const blob = await response.blob()
    if (blob.size === 0) {
      throw new Error('Frame image blob is empty')
    }
    
    const path = `community/${ownerId}/${frameId}/overlay.png`
    const { error } = await supabase.storage.from('frame-assets').upload(path, blob, {
      contentType: 'image/png',
      upsert: false
    })
    
    if (error) {
      // Log actual error for debugging
      if (import.meta.env.DEV) {
        console.error('Storage upload failed:', {
          path,
          ownerId,
          frameId,
          blobSize: blob.size,
          error: error.message || error
        })
      }
      // Determine the specific error type for better messaging
      const errorMsg = error.message?.toLowerCase() || ''
      if (errorMsg.includes('not found') || errorMsg.includes('404')) {
        throw new FrameServiceError('Storage bucket is not configured. Please contact support.')
      }
      if (errorMsg.includes('unauthorized') || errorMsg.includes('forbidden') || errorMsg.includes('403')) {
        throw new FrameServiceError('You do not have permission to upload frames. Please ensure you are signed in as a registered user.')
      }
      throw new FrameServiceError(`Frame asset storage failed: ${error.message || 'Unknown error'}`)
    }
    
    return path
  } catch (err) {
    if (err instanceof FrameServiceError) {
      throw err
    }
    const message = err instanceof Error ? err.message : 'Unknown error during frame asset upload'
    throw new FrameServiceError(`Failed to process frame image: ${message}`)
  }
}

async function resolveFrameAsset(path: string | null): Promise<string | undefined> {
  if (!path) return undefined
  const { data, error } = await supabase.storage.from('frame-assets').createSignedUrl(path, 3600)
  return error ? undefined : data.signedUrl
}

async function deleteFrameIfOwned(frameId: string): Promise<void> {
  try {
    // Only delete if the current user is the owner
    // RLS policy will prevent deletion of frames owned by other users
    const { error } = await supabase
      .from('frames')
      .delete()
      .eq('id', frameId)
    
    if (error && import.meta.env.DEV) {
      console.warn('Failed to clean up orphaned frame:', frameId, error)
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('Error during frame cleanup:', err)
    }
  }
}

async function createCommunityFrame(frame: Frame): Promise<Frame> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new FrameServiceError('We could not verify your sign-in. Please try again.')

  const userType = getUserType(userData.user)
  if (userType === 'anonymous') {
    throw new FrameServiceError('Guest users cannot create community frames. Please sign in with a registered account.')
  }
  if (userType !== 'registered') {
    throw new FrameServiceError('Please sign in with a registered account before creating a community frame.')
  }

  const normalized = normalizeFrame(frame)
  const { data, error } = await supabase.rpc('create_community_frame', {
    p_name: normalized.name,
    p_description: normalized.description || null,
    p_layout_type: normalized.layoutType || `photos-${normalized.photoSlots.length}`,
    p_photo_count: normalized.photoSlots.length,
    p_canvas_width: normalized.canvasWidth ?? normalized.width,
    p_canvas_height: normalized.canvasHeight ?? normalized.height,
    p_preview_path: null,
    p_overlay_path: null,
    p_slots: frameSlotsForRpc(normalized)
  })

  if (error || !data) throw userFacingFrameError(error)

  const created = Array.isArray(data) ? data[0] : data
  
  // Upload frame asset if provided
  let overlayPath: string | null = null
  if (normalized.frameImage) {
    try {
      overlayPath = await uploadFrameAsset(normalized.frameImage, userData.user.id, created.id)
    } catch (uploadError) {
      // Asset upload failed - clean up the orphaned frame record
      await deleteFrameIfOwned(created.id)
      
      // Re-throw with context about cleanup
      if (uploadError instanceof FrameServiceError) {
        throw new FrameServiceError(
          uploadError.message.includes('storage failed')
            ? uploadError.message
            : `Frame creation failed: ${uploadError.message}`
        )
      }
      throw uploadError
    }
  }
  
  // Update frame with metadata and asset path
  if (overlayPath) {
    const { error: metadataError } = await supabase
      .from('frames')
      .update({
        width: normalized.width,
        height: normalized.height,
        creator_name: normalized.creatorName || 'You',
        tags: normalized.tags || [],
        overlay_path: overlayPath
      })
      .eq('id', created.id)
    
    if (metadataError) {
      // Metadata update failed - clean up
      await deleteFrameIfOwned(created.id)
      throw new FrameServiceError('Frame was created but could not be finalized. Please try again.')
    }
  } else {
    // No asset, but update other metadata
    const { error: metadataError } = await supabase
      .from('frames')
      .update({
        width: normalized.width,
        height: normalized.height,
        creator_name: normalized.creatorName || 'You',
        tags: normalized.tags || []
      })
      .eq('id', created.id)
    
    if (metadataError) {
      await deleteFrameIfOwned(created.id)
      throw new FrameServiceError('Frame was created but could not be finalized. Please try again.')
    }
  }

  return { ...normalized, id: created.id, isOfficial: false, creatorName: normalized.creatorName || 'You' }
}

type SupabaseFrame = {
  id: string
  name: string
  type: 'official' | 'community'
  source_id: string | null
  owner_id: string | null
  overlay_path: string | null
  creator_name: string | null
  tags: unknown
  width: number | null
  height: number | null
  canvas_width: number | null
  canvas_height: number | null
  photo_count: number | null
}

type SupabaseFrameSlot = {
  frame_id: string
  slot_order: number
  x: number
  y: number
  width: number
  height: number
  rotation: number | null
}

function sampleForFrame(frame: SupabaseFrame): Frame | undefined {
  return sampleFrames.find((sample) => sample.id === frame.source_id || sample.name === frame.name)
}

function frameTags(value: unknown, fallback: string[] | undefined): string[] | undefined {
  if (Array.isArray(value)) return value.filter((tag): tag is string => typeof tag === 'string')
  return fallback
}

async function fetchFromSupabase(): Promise<Frame[]> {
  const { data: frameRows, error: frameError } = await supabase
    .from('frames')
    .select('id, name, type, source_id, owner_id, overlay_path, creator_name, tags, width, height, canvas_width, canvas_height, photo_count')
    .order('created_at', { ascending: false })

  if (frameError) throw frameError

  const frames = (frameRows || []) as SupabaseFrame[]
  if (frames.length === 0) return []

  const { data: slotRows, error: slotError } = await supabase
    .from('frame_slots')
    .select('frame_id, slot_order, x, y, width, height, rotation')
    .in('frame_id', frames.map((frame) => frame.id))
    .order('slot_order', { ascending: true })

  if (slotError) throw slotError

  const slotsByFrame = new Map<string, SupabaseFrameSlot[]>()
  for (const slot of (slotRows || []) as SupabaseFrameSlot[]) {
    const slots = slotsByFrame.get(slot.frame_id) || []
    slots.push(slot)
    slotsByFrame.set(slot.frame_id, slots)
  }

  return Promise.all(frames.map(async (row) => {
    const sample = sampleForFrame(row)
    const dbSlots = slotsByFrame.get(row.id) || []
    const isOfficial = row.type === 'official'
    const photoSlots = dbSlots
      .sort((a, b) => a.slot_order - b.slot_order)
      .map((slot, index) => ({
        photoIndex: slot.slot_order - 1,
        x: Number(slot.x),
        y: Number(slot.y),
        width: Number(slot.width),
        height: Number(slot.height),
        rotation: Number(slot.rotation ?? 0),
        fit: sample?.photoSlots[index]?.fit ?? 'cover' as const
      }))

    return {
      ...sample,
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
      frameImage: await resolveFrameAsset(row.overlay_path),
      creatorName: row.creator_name || sample?.creatorName || (isOfficial ? 'Official' : 'Unknown'),
      isOfficial,
      tags: frameTags(row.tags, sample?.tags),
      width: Number(row.width ?? sample?.width ?? 1080),
      height: Number(row.height ?? sample?.height ?? 1440),
      canvasWidth: Number(row.canvas_width ?? sample?.canvasWidth ?? row.width ?? 1080),
      canvasHeight: Number(row.canvas_height ?? sample?.canvasHeight ?? row.height ?? 1440),
      photoCount: Number(row.photo_count ?? photoSlots.length ?? 1),
      photoSlots
    }
  }))
}

const defaultSlots = (count = 1) => Array.from({ length: Math.max(1, count) }, (_, index) => ({
  photoIndex: index,
  x: 90,
  y: 80 + index * 280,
  width: 900,
  height: 260,
  fit: 'cover' as const
}))

function normalizeFrame(frame: Frame): Frame {
  const photoCount = Math.max(1, frame.photoCount ?? frame.photoSlots?.length ?? 1)
  const normalizedSlots = Array.isArray(frame.photoSlots) && frame.photoSlots.length >= 1
    ? frame.photoSlots.map((slot, index) => ({
        ...slot,
        photoIndex: slot.photoIndex ?? index,
        fit: slot.fit ?? 'cover',
        rotation: slot.rotation ?? 0
      }))
    : defaultSlots(photoCount)

  return {
    ...frame,
    width: frame.width || 1080,
    height: frame.height || 1440,
    canvasWidth: frame.canvasWidth ?? frame.width ?? 1080,
    canvasHeight: frame.canvasHeight ?? frame.height ?? 1440,
    photoCount: normalizedSlots.length,
    photoSlots: normalizedSlots
  }
}

export const frameService = {
  async list(): Promise<Frame[]> {
    try {
      const frames = await fetchFromSupabase()
      return mergeFrames(frames, loadStored()).map(normalizeFrame)
    } catch {
      return [...sampleFrames, ...loadStored()].map(normalizeFrame)
    }
  },
  async add(frame: Frame) {
    const validation = validateFrame(frame)
    if (!validation.valid) throw new FrameServiceError(validation.error || 'The frame metadata or photo slots are invalid.')

    try {
      const created = await createCommunityFrame(frame)
      if (created.frameImage) runtimeFrameAssets.set(created.id, created.frameImage)
      const stored = loadStored().filter((storedFrame) => storedFrame.id !== created.id)
      stored.unshift(created)
      saveStored(stored)
      return created
    } catch (error) {
      const safeError = error instanceof Error ? error : userFacingFrameError(error)
      if (safeError instanceof FrameServiceError && safeError.allowLocalFallback) {
        const normalized = normalizeFrame(frame)
        if (normalized.frameImage) runtimeFrameAssets.set(normalized.id, normalized.frameImage)
        const store = loadStored()
        store.unshift(normalized)
        saveStored(store)
      }
      throw safeError
    }
  },
  async delete(frameId: string, frameOwnerId?: string | null): Promise<FrameDeleteResult> {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) throw new FrameServiceError('You must be signed in to delete a frame.')

    const user = userData.user
    const isAnonymous = user.aud === 'authenticated' && user.user_metadata?.provider === 'anonymous'
    console.log('FRAME_DELETE_AUTH', {
      userId: user.id,
      email: user.email,
      isAnonymous
    })
    console.log('FRAME_DELETE_INPUT', { frameId, frameOwnerId })

    if (getUserType(user) !== 'registered') {
      throw new FrameServiceError('Guest users cannot delete frames. Please sign in with a registered account.')
    }

    const { data: existingFrame, error: existingFrameError } = await supabase
      .from('frames')
      .select('id,name,type,owner_id,overlay_path')
      .eq('id', frameId)
      .maybeSingle()

    console.log('FRAME_DELETE_LOOKUP', {
      frameId,
      frameExists: !!existingFrame,
      frameOwnerId: existingFrame?.owner_id,
      frameType: existingFrame?.type,
      currentUserId: user.id,
      error: existingFrameError,
      errorMessage: existingFrameError?.message,
      errorCode: existingFrameError?.code,
      errorDetails: existingFrameError?.details,
      errorHint: existingFrameError?.hint
    })

    const { data, error } = await supabase
      .from('frames')
      .delete()
      .eq('id', frameId)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('SUPABASE_DELETE_ERROR', {
        error,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        errorHint: error.hint,
        frameId,
        currentUserId: user.id,
        frameOwnerId: existingFrame?.owner_id ?? frameOwnerId
      })
      throw new FrameDeleteError()
    }
    if (!data) {
      console.warn('DELETE_ZERO_ROWS', {
        frameId,
        currentUserId: user.id,
        frameOwnerId: existingFrame?.owner_id ?? frameOwnerId
      })
      return { status: 'not_found_or_inaccessible' }
    }

    console.log('DELETE_SUCCESS', { frameId, deletedFrameId: data.id, currentUserId: user.id })

    runtimeFrameAssets.delete(frameId)
    saveStored(loadStored().filter((frame) => frame.id !== frameId))
    if (existingFrame?.overlay_path) {
      const { error: assetError } = await supabase.storage.from('frame-assets').remove([existingFrame.overlay_path])
      if (assetError && import.meta.env.DEV) console.warn('Could not remove the deleted frame asset.', assetError)
    }
    return { status: 'deleted', id: data.id }
  },
  async search(query: string) {
    const all = await this.list()
    if (!query) return all
    const q = query.toLowerCase()
    return all.filter((f) => f.name.toLowerCase().includes(q) || (f.creatorName || '').toLowerCase().includes(q) || (f.tags || []).join(' ').toLowerCase().includes(q))
  },
  async getById(id: string) {
    const all = await this.list()
    return all.find((f) => f.id === id) || null
  }
}

