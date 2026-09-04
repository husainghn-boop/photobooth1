import React from 'react'
import { useSession } from '../hooks/useSession'
import { photoStore } from '../services/photoStore'
import { getRequiredPhotoCount } from '../services/sessionService'

function ReviewPhotoCard({ photoId, photoOrder, selected, onSelect }: { photoId: string; photoOrder: number; selected: boolean; onSelect: () => void }) {
  const storedPhoto = photoStore.get(photoId)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-lg border-2 bg-white transition-all ${selected ? 'border-indigo-600 shadow-md ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'}`}
      aria-label={`View photo ${photoOrder}`}
    >
      <div className="h-20 w-20 overflow-hidden bg-slate-100 sm:h-24 sm:w-24">
        {storedPhoto ? (
          <img src={storedPhoto.objectUrl} alt={`Photo ${photoOrder}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">No photo</div>
        )}
      </div>
      <div className={`mt-2 text-center text-xs font-medium ${selected ? 'text-indigo-700' : 'text-slate-600'}`}>
        Photo {photoOrder}
      </div>
    </button>
  )
}

export default function Review() {
  const { session, beginRetake, continueToEditor } = useSession()
  const [actionError, setActionError] = React.useState('')
  const [selectedPhotoId, setSelectedPhotoId] = React.useState<string | null>(null)

  if (!session || !session.selectedFrame) {
    return <main className="max-w-4xl mx-auto p-6"><h2 className="text-xl font-semibold">Your photo session is no longer available</h2><p className="mt-3 text-gray-600">The photos are kept in memory for this MVP and were lost after a refresh. Please start a new session.</p><a href="#/frames" className="inline-block mt-6 px-4 py-2 bg-indigo-600 text-white rounded">Start New Session</a></main>
  }

  const requiredPhotos = getRequiredPhotoCount(session.selectedFrame)
  const photos = [...session.capturedPhotos]
    .filter((photo): photo is NonNullable<typeof photo> => !!photo?.id && !!photoStore.get(photo.id))
    .sort((a, b) => (a.order || 0) - (b.order || 0))

  if (photos.length !== requiredPhotos) {
    return <main className="max-w-4xl mx-auto p-6"><h2 className="text-xl font-semibold">Your photo session is no longer available</h2><p className="mt-3 text-gray-600">The photos are kept in memory for this MVP and were lost after a refresh. Please start a new session.</p><a href="#/frames" className="inline-block mt-6 px-4 py-2 bg-indigo-600 text-white rounded">Start New Session</a></main>
  }

  React.useEffect(() => {
    if (!selectedPhotoId || !photos.some((photo) => photo.id === selectedPhotoId)) {
      setSelectedPhotoId(photos[0]?.id ?? null)
    }
  }, [photos, selectedPhotoId])

  const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId) ?? photos[0]

  const retake = (index: number) => {
    const next = beginRetake(index)
    if (!next) {
      setActionError('That photo is not available to retake. Please try again.')
      return
    }
    location.hash = '#/studio'
  }

  const cont = () => {
    setActionError('')
    if (!continueToEditor()) {
      setActionError(`Please make sure all ${requiredPhotos} photos and a selected frame are ready before continuing.`)
      return
    }
    location.hash = '#/editor'
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Review</p>
          <h2 className="text-2xl font-semibold text-slate-900">Check your captures</h2>
        </div>
        <div className="text-sm text-slate-600">{requiredPhotos} {requiredPhotos === 1 ? 'photo' : 'photos'} ready</div>
      </div>

      {actionError && <p className="mt-3 text-sm text-red-600" role="alert">{actionError}</p>}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        {selectedPhoto && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-slate-700">Photo {selectedPhoto.order} of {requiredPhotos}</div>
              <button
                type="button"
                onClick={() => retake((selectedPhoto.order || 1) - 1)}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
              >
                Retake
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              <div className="aspect-[4/3] w-full bg-slate-100">
                <img
                  src={photoStore.get(selectedPhoto.id)?.objectUrl}
                  alt={`Photo ${selectedPhoto.order}`}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {photos.map((photo) => (
                <ReviewPhotoCard
                  key={photo.id}
                  photoId={photo.id}
                  photoOrder={photo.order}
                  selected={photo.id === selectedPhoto.id}
                  onSelect={() => setSelectedPhotoId(photo.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button onClick={() => (location.hash = '#/studio')} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">Back to Camera</button>
        <button onClick={cont} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500">Continue to Edit</button>
      </div>
    </main>
  )
}
