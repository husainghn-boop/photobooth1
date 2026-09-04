import { Frame } from '../types'

const MIN_PHOTO_COUNT = 1
const MAX_PHOTO_COUNT = 4

export type FrameValidationResult = {
  valid: boolean
  error?: string
}

export function validateFrame(frame: Frame): FrameValidationResult {
  const canvasWidth = frame.canvasWidth ?? frame.width
  const canvasHeight = frame.canvasHeight ?? frame.height

  if (!Number.isFinite(canvasWidth) || canvasWidth <= 0 || !Number.isFinite(canvasHeight) || canvasHeight <= 0) {
    return { valid: false, error: 'Frame dimensions are invalid.' }
  }

  const slots = frame.photoSlots
  if (!Array.isArray(slots) || slots.length < MIN_PHOTO_COUNT || slots.length > MAX_PHOTO_COUNT) {
    return { valid: false, error: 'A frame must contain between 1 and 4 photos.' }
  }

  if (frame.photoCount !== undefined && frame.photoCount !== slots.length) {
    return { valid: false, error: 'The photo count does not match the number of photo slots.' }
  }

  for (const [index, slot] of slots.entries()) {
    if (slot.photoIndex !== index) {
      return { valid: false, error: 'Photo slots must be numbered sequentially.' }
    }

    if (!Number.isFinite(slot.x) || !Number.isFinite(slot.y) || !Number.isFinite(slot.width) || !Number.isFinite(slot.height)) {
      return { valid: false, error: `Photo slot ${index + 1} has invalid geometry.` }
    }

    if (slot.width <= 0 || slot.height <= 0) {
      return { valid: false, error: `Photo slot ${index + 1} has an invalid size.` }
    }

    if (slot.x < 0 || slot.y < 0 || slot.x + slot.width > canvasWidth || slot.y + slot.height > canvasHeight) {
      return { valid: false, error: `Photo slot ${index + 1} is outside the frame.` }
    }
  }

  return { valid: true }
}
