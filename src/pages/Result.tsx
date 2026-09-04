import React, { useEffect, useRef, useState } from 'react'
import { useSession } from '../hooks/useSession'
import { renderPhotobooth } from '../services/compositionService'
import { photoStore } from '../services/photoStore'
import { getRequiredPhotoCount } from '../services/sessionService'

function filename(frameName: string, extension: string) {
  const safeName = frameName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'frame'
  return `photobooth-${safeName}-${Date.now()}.${extension}`
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The composition could not be encoded.')), type, quality)
  })
}

export default function Result() {
  const { session, startNewSession } = useSession()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isRendering, setIsRendering] = useState(true)
  const [renderError, setRenderError] = useState('')

  useEffect(() => {
    let active = true
    async function compose() {
      if (!session || !session.selectedFrame) {
        setRenderError('A selected frame is required for composition.')
        setIsRendering(false)
        return
      }
      const requiredPhotos = getRequiredPhotoCount(session.selectedFrame)
      if (requiredPhotos < 1 || session.capturedPhotos.length < requiredPhotos || session.capturedPhotos.slice(0, requiredPhotos).some((photo) => !photo?.id)) {
        setRenderError(`A selected frame and all ${requiredPhotos} photos are required for composition.`)
        setIsRendering(false)
        return
      }
      const photos = Array.from({ length: requiredPhotos }, (_, index) => photoStore.get(session.capturedPhotos[index]!.id))
      if (photos.some((photo) => !photo)) {
        setRenderError('Your photo session is no longer available. Please start a new session.')
        setIsRendering(false)
        return
      }
      setIsRendering(true)
      setRenderError('')
      try {
        const canvas = await renderPhotobooth({ photos: photos as NonNullable<typeof photos[number]>[], photoEdits: session.photoEdits, frame: session.selectedFrame })
        if (!active) return
        const preview = canvasRef.current
        if (!preview) throw new Error('The composition preview is unavailable. Please reload the page.')
        preview.width = canvas.width
        preview.height = canvas.height
        const context = preview.getContext('2d')
        if (!context) throw new Error('The composition preview could not be drawn.')
        context.clearRect(0, 0, preview.width, preview.height)
        context.drawImage(canvas, 0, 0)
      } catch (error) {
        console.error('composition error', error)
        if (active) setRenderError(error instanceof Error ? error.message : 'The final composition could not be rendered.')
      } finally {
        if (active) setIsRendering(false)
      }
    }
    void compose()
    return () => { active = false }
  }, [session?.id, session?.selectedFrame, session?.capturedPhotos, session?.photoEdits])

  if (!session) return <ResultError message="Your photobooth session is unavailable." />
  if (renderError) return <ResultError message={renderError} />

  const download = async (type: 'png' | 'jpg') => {
    const canvas = canvasRef.current
    if (!canvas) {
      setRenderError('The composition is not ready to download. Please try again.')
      return
    }
    try {
      const blob = await canvasBlob(canvas, type === 'png' ? 'image/png' : 'image/jpeg', type === 'jpg' ? 0.95 : undefined)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename(session.selectedFrame?.name || 'frame', type)
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    } catch (error) {
      console.error('download error', error)
      setRenderError('The download could not be created. Please try again.')
    }
  }

  const retakePhotos = () => {
    const requiredPhotos = getRequiredPhotoCount(session.selectedFrame)
    if (!window.confirm(`Retaking photos will delete the current ${requiredPhotos} photos and their edits. Continue?`)) return
    startNewSession(session.selectedFrame)
    location.hash = '#/studio'
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Result</p>
          <h1 className="text-2xl font-semibold text-slate-900">Your composition</h1>
          <p className="mt-1 text-sm text-slate-600">{session.selectedFrame?.name}</p>
        </div>
        <div className="text-right text-sm text-slate-600">
          <div>{session.selectedFrame?.width} x {session.selectedFrame?.height} px</div>
          {isRendering && <div className="text-indigo-600">Preparing your photobooth...</div>}
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="mx-auto w-full max-w-[540px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm"><canvas ref={canvasRef} className="block h-auto w-full" /></div>
        <aside className="flex flex-col gap-3">
          <button onClick={() => download('png')} disabled={isRendering} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50">Download PNG</button>
          <button onClick={() => download('jpg')} disabled={isRendering} className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-50">Download JPG</button>
          <button onClick={() => (location.hash = '#/editor')} className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200">Edit Again</button>
          <button onClick={() => (location.hash = '#/frames?mode=change')} className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200">Choose Another Frame</button>
          <button onClick={retakePhotos} className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200">Start New Photobooth</button>
        </aside>
      </div>
    </main>
  )
}

function ResultError({ message }: { message: string }) {
  return <main className="max-w-4xl mx-auto p-6"><h2 className="text-xl font-semibold">Composition unavailable</h2><p className="mt-3 text-gray-600">{message}</p><div className="mt-6 flex gap-3"><a href="#/editor" className="rounded bg-indigo-600 px-4 py-2 text-white">Back to Editor</a><a href="#/frames" className="rounded bg-gray-100 px-4 py-2">Start New Session</a></div></main>
}
