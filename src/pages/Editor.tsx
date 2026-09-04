import React, { useEffect, useState } from 'react'
import { useSession } from '../hooks/useSession'
import { PhotoFilter } from '../types'
import { photoStore } from '../services/photoStore'
import { getRequiredPhotoCount } from '../services/sessionService'

const FILTERS: { value: PhotoFilter; label: string; css: string }[] = [
  { value: 'original', label: 'Original', css: 'none' },
  { value: 'blackwhite', label: 'Black & White', css: 'grayscale(1)' },
  { value: 'vintage', label: 'Vintage', css: 'sepia(.65) saturate(.85) contrast(1.05)' },
  { value: 'warm', label: 'Warm', css: 'sepia(.2) saturate(1.35) brightness(1.04)' },
  { value: 'cool', label: 'Cool', css: 'saturate(.85) hue-rotate(12deg) brightness(1.04)' },
  { value: 'fade', label: 'Fade', css: 'contrast(.82) brightness(1.12) saturate(.7)' }
]

function loadImage(src: string, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`Could not load ${label}.`))
    image.src = src
  })
}

export default function Editor() {
  const { session, updatePhotoFilter, undoPhotoEdit, redoPhotoEdit, continueToResult } = useSession()
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
  const [previewError, setPreviewError] = useState('')
  const [previewReady, setPreviewReady] = useState(false)
  const [actionError, setActionError] = useState('')

  const requiredPhotos = session ? getRequiredPhotoCount(session.selectedFrame) : 0
  const activePhoto = session?.capturedPhotos[activePhotoIndex] ?? null
  const activeStoredPhoto = activePhoto ? photoStore.get(activePhoto.id) : null
  const activeEdit = session?.photoEdits[activePhotoIndex]
  const activeFilter = FILTERS.find((filter) => filter.value === activeEdit?.filter) || FILTERS[0]
  const canUndo = !!session && session.editHistoryIndex > 0
  const canRedo = !!session && session.editHistoryIndex < session.editHistory.length - 1

  useEffect(() => {
    if (!session) return
    const maxIndex = Math.max(0, getRequiredPhotoCount(session.selectedFrame) - 1)
    setActivePhotoIndex((current) => Math.min(Math.max(current, 0), maxIndex))
  }, [session?.selectedFrame?.id, session?.selectedFrame?.photoSlots?.length])

  useEffect(() => {
    let active = true
    setPreviewReady(false)
    setPreviewError('')
    if (!activeStoredPhoto) {
      setPreviewError('This photo is unavailable. Return to Review and try again.')
      return () => { active = false }
    }
    void loadImage(activeStoredPhoto.objectUrl, `photo ${activePhoto?.order ?? 1}`)
      .then(() => { if (active) setPreviewReady(true) })
      .catch((error: unknown) => {
        if (active) setPreviewError(error instanceof Error ? error.message : 'This photo could not be loaded.')
      })
    return () => { active = false }
  }, [activeStoredPhoto?.objectUrl, activePhoto?.order])

  if (!session) {
    return <EditorError message="Your editing session is unavailable." />
  }
  if (!session.selectedFrame || requiredPhotos < 1 || !Array.from({ length: requiredPhotos }, (_, index) => session.capturedPhotos[index]).every((photo) => photo?.id && photoStore.get(photo.id)) ) {
    return <EditorError message={`The editor needs all ${requiredPhotos || 'selected'} photos and a selected frame.`} />
  }

  const chooseFilter = (filter: PhotoFilter) => {
    setActionError('')
    updatePhotoFilter(activePhotoIndex, filter)
  }

  const undo = () => {
    setActionError('')
    if (!undoPhotoEdit()) setActionError('There is nothing to undo.')
  }

  const redo = () => {
    setActionError('')
    if (!redoPhotoEdit()) setActionError('There is nothing to redo.')
  }

  const resetPhoto = () => chooseFilter('original')

  const continueForward = () => {
    setActionError('')
    if (!continueToResult()) {
      setActionError('Your photos and selected frame must be ready before continuing.')
      return
    }
    location.hash = '#/result'
  }

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Photo editor</h1>
          <p className="mt-1 text-sm text-gray-600">Editing Photo {activePhoto?.order ?? activePhotoIndex + 1} of {requiredPhotos}</p>
        </div>
        <div className="text-right text-sm text-gray-600"><div className="font-medium text-gray-900">{session.selectedFrame.name}</div><div>by {session.selectedFrame.creatorName}</div></div>
      </div>

      {(previewError || actionError) && <p className="mt-4 text-sm text-red-600" role="alert">{previewError || actionError}</p>}

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section>
          <div className="rounded bg-gray-100 p-3 sm:p-6">
            <div className="mx-auto flex min-h-[18rem] max-w-2xl items-center justify-center overflow-hidden rounded bg-black">
              {previewReady && activePhoto && activeStoredPhoto && <img src={activeStoredPhoto.objectUrl} alt={`Photo ${activePhoto.order}`} className="max-h-[70vh] w-full object-contain" style={{ filter: activeFilter.css }} />}
              {!previewReady && !previewError && <p className="p-8 text-sm text-white">Loading photo...</p>}
            </div>
          </div>

          <div className="mt-4 flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
            {Array.from({ length: requiredPhotos }, (_, index) => {
              const photo = session.capturedPhotos[index]
              if (!photo) return null
              const filter = FILTERS.find((item) => item.value === session.photoEdits[index]?.filter) || FILTERS[0]
              return <button key={photo.id} onClick={() => setActivePhotoIndex(index)} className={`min-w-24 rounded border-2 bg-white p-1 text-left ${index === activePhotoIndex ? 'border-indigo-600' : 'border-transparent'}`} aria-label={`Edit photo ${photo.order}`}><img src={photoStore.get(photo.id)?.objectUrl} alt={`Photo ${photo.order}`} className="h-20 w-full object-cover" style={{ filter: filter.css }} /><span className="mt-1 block px-1 text-xs">Photo {photo.order}</span></button>
            })}
          </div>
        </section>

        <aside className="rounded border bg-white p-4">
          <div className="flex items-center justify-between"><h2 className="font-medium">Photo {activePhoto?.order ?? activePhotoIndex + 1}</h2><span className="text-sm text-gray-600">{activeFilter.label}</span></div>
          <div className="mt-4 flex gap-2"><button onClick={undo} disabled={!canUndo} className="flex-1 rounded bg-gray-100 px-3 py-2 text-sm disabled:opacity-40">Undo</button><button onClick={redo} disabled={!canRedo} className="flex-1 rounded bg-gray-100 px-3 py-2 text-sm disabled:opacity-40">Redo</button></div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-2 lg:grid lg:grid-cols-2 lg:overflow-visible">
            {FILTERS.map((filter) => <button key={filter.value} onClick={() => chooseFilter(filter.value)} className={`min-w-28 rounded border px-3 py-2 text-sm ${activeFilter.value === filter.value ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white'}`}>{filter.label}</button>)}
          </div>
          <button onClick={resetPhoto} className="mt-4 w-full rounded bg-gray-100 px-3 py-2 text-sm">Reset Photo</button>
        </aside>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-between"><button onClick={() => { location.hash = '#/review' }} className="rounded bg-gray-100 px-4 py-2">Back to Review</button><button onClick={continueForward} className="rounded bg-indigo-600 px-4 py-2 text-white">Continue to Result</button></div>
    </main>
  )
}

function EditorError({ message }: { message: string }) {
  return <main className="max-w-4xl mx-auto p-6"><h2 className="text-xl font-semibold">Editor unavailable</h2><p className="mt-3 text-gray-600">{message}</p><a href="#/review" className="mt-6 inline-block rounded bg-indigo-600 px-4 py-2 text-white">Back to Review</a></main>
}
