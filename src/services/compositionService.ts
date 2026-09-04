import { Frame, PhotoEdit } from '../types'
import { calculateCoverCrop } from '../utils/crop'
import { StoredPhoto } from './photoStore'

export const COMPOSITION_WIDTH = 1080
export const COMPOSITION_HEIGHT = 1440

const filterCss: Record<PhotoEdit['filter'], string> = {
  original: 'none',
  blackwhite: 'grayscale(1)',
  vintage: 'sepia(.65) saturate(.85) contrast(1.05)',
  warm: 'sepia(.2) saturate(1.35) brightness(1.04)',
  cool: 'saturate(.85) hue-rotate(12deg) brightness(1.04)',
  fade: 'contrast(.82) brightness(1.12) saturate(.7)'
}

export function validateFrame(frame: Frame | null | undefined): { valid: boolean; error?: string } {
  if (!frame) return { valid: false, error: 'A frame is required before composition can start.' }
  const canvasWidth = Number(frame.canvasWidth ?? frame.width ?? 0)
  const canvasHeight = Number(frame.canvasHeight ?? frame.height ?? 0)

  if (!Number.isFinite(canvasWidth) || canvasWidth <= 0 || !Number.isFinite(canvasHeight) || canvasHeight <= 0) {
    return { valid: false, error: 'The selected frame must define valid canvas dimensions.' }
  }
  if (!Array.isArray(frame.photoSlots) || frame.photoSlots.length < 1) {
    return { valid: false, error: 'The selected frame must define at least one photo slot.' }
  }

  for (const [index, slot] of frame.photoSlots.entries()) {
    if (!slot || !Number.isFinite(slot.x) || !Number.isFinite(slot.y) || !Number.isFinite(slot.width) || !Number.isFinite(slot.height)) {
      return { valid: false, error: `Photo slot ${index + 1} must have x, y, width, and height values.` }
    }
    if (slot.width <= 0 || slot.height <= 0) {
      return { valid: false, error: `Photo slot ${index + 1} must have a positive width and height.` }
    }
    const photoIndex = slot.photoIndex ?? index
    if (!Number.isInteger(photoIndex) || photoIndex < 0) {
      return { valid: false, error: `Photo slot ${index + 1} has an invalid photoIndex.` }
    }
  }

  return { valid: true }
}

export function loadCompositionImage(src: string, label: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load ${label}.`))
    image.src = src
  })
}

function drawImageToSlot(context: CanvasRenderingContext2D, image: HTMLImageElement, slot: Frame['photoSlots'][number], targetX: number, targetY: number) {
  const crop = calculateCoverCrop(image.naturalWidth, image.naturalHeight, slot.width, slot.height)
  const drawX = targetX + (slot.width - crop.targetWidth) / 2
  const drawY = targetY + (slot.height - crop.targetHeight) / 2
  context.drawImage(image, crop.sourceX, crop.sourceY, crop.sourceWidth, crop.sourceHeight, drawX, drawY, crop.targetWidth, crop.targetHeight)
}

export async function renderPhotobooth({ photos, photoEdits, frame }: { photos: StoredPhoto[]; photoEdits: PhotoEdit[]; frame: Frame }): Promise<HTMLCanvasElement> {
  const validation = validateFrame(frame)
  if (!validation.valid) throw new Error(validation.error || 'The selected frame is invalid.')

  const canvasWidth = frame.canvasWidth ?? frame.width
  const canvasHeight = frame.canvasHeight ?? frame.height
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the composition canvas.')

  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvasWidth, canvasHeight)

  for (const [index, slot] of frame.photoSlots.entries()) {
    const photoIndex = slot.photoIndex ?? index
    const sourcePhoto = photos[photoIndex]
    if (!sourcePhoto) continue

    const image = await loadCompositionImage(sourcePhoto.objectUrl, `photo ${photoIndex + 1}`)
    context.save()
    context.translate(slot.x + slot.width / 2, slot.y + slot.height / 2)
    context.rotate(((slot.rotation ?? 0) * Math.PI) / 180)
    context.beginPath()
    context.rect(-slot.width / 2, -slot.height / 2, slot.width, slot.height)
    context.clip()
    context.filter = filterCss[photoEdits[photoIndex]?.filter || 'original']
    drawImageToSlot(context, image, slot, -slot.width / 2, -slot.height / 2)
    context.restore()
  }

  const overlaySource = frame.frameImage || frame.imageUrl || (frame.svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(frame.svg.replace(/viewBox="0 0 1200 1800"/, `viewBox="0 0 ${canvasWidth} ${canvasHeight}"`))}` : '')
  if (overlaySource) {
    const overlay = await loadCompositionImage(overlaySource, 'the selected frame overlay')
    context.drawImage(overlay, 0, 0, canvasWidth, canvasHeight)
  }

  return canvas
}