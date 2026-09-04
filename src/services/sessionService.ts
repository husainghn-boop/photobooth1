import { CapturedPhoto, PhotoEdit, PhotoSession, Frame } from '../types'

const KEY = 'photobooth.session'

const defaultSlots = (count = 1) => Array.from({ length: Math.max(1, count) }, (_, index) => ({
  photoIndex: index,
  x: 90,
  y: 80 + index * 280,
  width: 900,
  height: 260,
  fit: 'cover' as const
}))

export function getRequiredPhotoCount(frame?: Frame | null): number {
  const slotCount = Number(frame?.photoCount ?? frame?.photoSlots?.length ?? 1)
  if (!Number.isFinite(slotCount) || slotCount < 1) return 1
  return Math.max(1, Math.round(slotCount))
}

function normalizePhotoSlots(frame: Frame | null | undefined): Frame['photoSlots'] {
  if (!frame) return defaultSlots(1)
  if (Array.isArray(frame.photoSlots) && frame.photoSlots.length >= 1) {
    return frame.photoSlots.map((slot, index) => ({
      ...slot,
      photoIndex: slot.photoIndex ?? index,
      fit: slot.fit ?? 'cover',
      rotation: slot.rotation ?? 0
    }))
  }
  return defaultSlots(getRequiredPhotoCount(frame))
}

function originalEdits(count = 1): PhotoEdit[] {
  return Array.from({ length: Math.max(1, count) }, () => ({ filter: 'original' }))
}

function frameMetadata(frame: Frame | null | undefined) {
  if (!frame) return null
  return {
    id: frame.id,
    name: frame.name,
    creatorName: frame.creatorName,
    isOfficial: frame.isOfficial,
    tags: frame.tags,
    usageCount: frame.usageCount,
    likes: frame.likes,
    svg: frame.svg,
    imageUrl: frame.imageUrl,
    width: frame.width,
    height: frame.height,
    canvasWidth: frame.canvasWidth ?? frame.width,
    canvasHeight: frame.canvasHeight ?? frame.height,
    photoCount: frame.photoSlots.length,
    photoSlots: frame.photoSlots
  }
}

export const sessionService = {
  create(frame: Frame | null = null, persist = true): PhotoSession {
    const normalizedFrame = frame ? { ...frame, width: frame.width || 1080, height: frame.height || 1440, canvasWidth: frame.canvasWidth || frame.width || 1080, canvasHeight: frame.canvasHeight || frame.height || 1440, photoSlots: normalizePhotoSlots(frame) } : null
    const requiredPhotos = getRequiredPhotoCount(normalizedFrame)
    const now = new Date().toISOString()
    const edits = originalEdits(requiredPhotos)
    const s: PhotoSession = {
      id: Math.random().toString(36).slice(2, 9),
      selectedFrame: normalizedFrame,
      capturedPhotos: Array.from({ length: requiredPhotos }, () => null),
      photoEdits: edits,
      editHistory: [edits.map((edit) => ({ ...edit }))],
      editHistoryIndex: 0,
      captureMode: 'new',
      retakePhotoIndex: null,
      currentStep: 'frame',
      activeFilter: 'original',
      brightness: 100,
      contrast: 100,
      saturation: 100,
      decorations: [],
      createdAt: now
    }
    if (persist) this.save(s)
    return s
  },
  load(): PhotoSession | null {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as PhotoSession & { finalImage?: unknown }
      const hasLegacyBinary = parsed.capturedPhotos?.some((photo: any) => typeof photo === 'string' || typeof photo?.dataUrl === 'string') || !!parsed.finalImage
      if (hasLegacyBinary) {
        this.clear()
        return null
      }

      const session = parsed
      session.captureMode = session.captureMode || 'new'
      session.retakePhotoIndex = session.retakePhotoIndex ?? null

      const requiredPhotos = getRequiredPhotoCount(session.selectedFrame)
      session.capturedPhotos = Array.from({ length: requiredPhotos }, (_, index) => {
        const photo = (session.capturedPhotos || [])[index]
        return photo && photo.id ? { id: photo.id, order: photo.order || index + 1 } : null
      })

      if (session.selectedFrame) {
        session.selectedFrame = {
          ...session.selectedFrame,
          width: session.selectedFrame.width || 1080,
          height: session.selectedFrame.height || 1440,
          canvasWidth: session.selectedFrame.canvasWidth || session.selectedFrame.width || 1080,
          canvasHeight: session.selectedFrame.canvasHeight || session.selectedFrame.height || 1440,
          photoSlots: normalizePhotoSlots(session.selectedFrame)
        }
      }

      const editCount = getRequiredPhotoCount(session.selectedFrame)
      session.photoEdits = Array.from({ length: editCount }, (_, index) => ({
        filter: session.photoEdits?.[index]?.filter || 'original'
      }))
      session.editHistory = session.editHistory?.length ? session.editHistory.map((history) => Array.from({ length: editCount }, (_, index) => ({ filter: history[index]?.filter || 'original' }))) : [session.photoEdits.map((edit) => ({ ...edit }))]
      session.editHistoryIndex = Math.min(session.editHistoryIndex ?? session.editHistory.length - 1, session.editHistory.length - 1)
      return session
    } catch {
      this.clear()
      return null
    }
  },
  save(session: PhotoSession) {
    const metadata = {
      id: session.id,
      selectedFrame: frameMetadata(session.selectedFrame),
      capturedPhotos: (session.capturedPhotos || []).filter((photo): photo is CapturedPhoto => !!photo?.id).map((photo) => ({ id: photo.id, order: photo.order })),
      photoEdits: session.photoEdits,
      editHistory: session.editHistory,
      editHistoryIndex: session.editHistoryIndex,
      captureMode: session.captureMode,
      retakePhotoIndex: session.retakePhotoIndex,
      currentStep: session.currentStep,
      activeFilter: session.activeFilter,
      brightness: session.brightness,
      contrast: session.contrast,
      saturation: session.saturation,
      createdAt: session.createdAt
    }
    try {
      sessionStorage.setItem(KEY, JSON.stringify(metadata))
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Could not persist the current session locally.', error)
    }
  },
  clear() {
    sessionStorage.removeItem(KEY)
  },
  setFrame(session: PhotoSession, frame: Frame) {
    this.save({ ...session, selectedFrame: frame })
  },
  startNewSession(frame: Frame | null = null) {
    return this.create(frame, false)
  },
  capturePhoto(session: PhotoSession, photo: CapturedPhoto) {
    const requiredPhotos = getRequiredPhotoCount(session.selectedFrame)
    const photos = Array.from({ length: requiredPhotos }, (_, index) => session.capturedPhotos[index] ?? null)
    const nextEmptyIndex = photos.findIndex((item) => !item?.id)
    const targetIndex = session.captureMode === 'retake' && session.retakePhotoIndex !== null
      ? session.retakePhotoIndex
      : nextEmptyIndex === -1 ? photos.length : nextEmptyIndex

    if (targetIndex < 0 || targetIndex >= requiredPhotos) return null
    photos[targetIndex] = { ...photo, order: targetIndex + 1 }
    return {
      ...session,
      capturedPhotos: photos,
      captureMode: 'new' as const,
      retakePhotoIndex: null,
      currentStep: photos.every((item) => item?.id) ? 'review' as const : 'studio' as const
    }
  }
}
