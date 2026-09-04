import { useSyncExternalStore } from 'react'

export type StoredPhoto = {
  id: string
  blob: Blob
  objectUrl: string
  width: number
  height: number
}

type PhotoListener = () => void

const photos = new Map<string, StoredPhoto>()
const listeners = new Set<PhotoListener>()

function notify() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: PhotoListener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function snapshot() {
  return photos
}

export const photoStore = {
  add(blob: Blob, width: number, height: number, id = `photo-${Math.random().toString(36).slice(2, 10)}`) {
    const existing = photos.get(id)
    if (existing) URL.revokeObjectURL(existing.objectUrl)
    const photo = { id, blob, objectUrl: URL.createObjectURL(blob), width, height }
    photos.set(id, photo)
    notify()
    return photo
  },
  get(id: string) {
    return photos.get(id) || null
  },
  remove(id: string) {
    const photo = photos.get(id)
    if (!photo) return
    URL.revokeObjectURL(photo.objectUrl)
    photos.delete(id)
    notify()
  },
  clear() {
    photos.forEach((photo) => URL.revokeObjectURL(photo.objectUrl))
    photos.clear()
    notify()
  },
  subscribe,
  snapshot
}

export function usePhotoStore() {
  return useSyncExternalStore(photoStore.subscribe, photoStore.snapshot, photoStore.snapshot)
}
