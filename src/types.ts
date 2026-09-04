export type PhotoFit = 'cover' | 'contain'

export type Frame = {
  id: string
  name: string
  description?: string
  layoutType?: string
  ownerId?: string | null
  creatorName: string
  isOfficial?: boolean
  tags?: string[]
  usageCount?: number
  likes?: number
  svg?: string // inline SVG overlay for demo frames
  frameImage?: string // local/data URL for an uploaded PNG frame
  width: number
  height: number
  canvasWidth?: number
  canvasHeight?: number
  imageUrl?: string
  photoCount?: number
  photoSlots: PhotoSlot[]
}

export type PhotoSlot = {
  photoIndex?: number
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  fit?: PhotoFit
}

export type CapturedPhoto = {
  id: string
  order: number
}

export type PhotoFilter = 'original' | 'blackwhite' | 'vintage' | 'warm' | 'cool' | 'fade'

export type PhotoEdit = {
  filter: PhotoFilter
}

export type PhotoSession = {
  id: string
  selectedFrame?: Frame | null
  capturedPhotos: Array<CapturedPhoto | null>
  photoEdits: PhotoEdit[]
  editHistory: PhotoEdit[][]
  editHistoryIndex: number
  captureMode: 'new' | 'retake'
  retakePhotoIndex: number | null
  currentStep: 'frame' | 'studio' | 'review' | 'editor' | 'result'
  activeFilter?: string
  brightness?: number
  contrast?: number
  saturation?: number
  decorations?: any[]
  createdAt: string
}
