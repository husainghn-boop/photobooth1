import React, { useEffect, useRef, useState } from 'react'
import CameraPreview from '../components/CameraPreview'
import { useSession } from '../hooks/useSession'
import { CapturedPhoto } from '../types'
import { photoStore } from '../services/photoStore'
import { getRequiredPhotoCount } from '../services/sessionService'
import { calculateCoverCrop } from '../utils/crop'

export default function Studio() {
  const { session, capturePhoto } = useSession()
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraState, setCameraState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [cameraError, setCameraError] = useState('')
  const [counting, setCounting] = useState<number | 'Capture' | null>(null)
  const [started, setStarted] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [captureError, setCaptureError] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timersRef = useRef<number[]>([])
  const sequenceRef = useRef(0)
  const mirrored = true

  const stopTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current = []
  }

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setStream(null)
  }

  const requestCamera = async () => {
    stopStream()
    setCameraState('loading')
    setCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('error')
      setCameraError('This browser or device does not support camera access.')
      return
    }
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = nextStream
      setStream(nextStream)
      setCameraState('ready')
    } catch (error) {
      console.error('camera error', error)
      setCameraState('error')
      setCameraError(error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Camera permission is required to take your photos. Please allow camera access and try again.'
        : 'We could not start the camera. Check that no other app is using it, then try again.')
    }
  }

  useEffect(() => {
    requestCamera()
    return () => {
      sequenceRef.current += 1
      stopTimers()
      stopStream()
    }
  }, [])

  const activeSlot = session && session.selectedFrame ? session.selectedFrame.photoSlots[photoIndex] ?? session.selectedFrame.photoSlots[0] : null
  const previewAspectRatio = activeSlot ? activeSlot.width / activeSlot.height : 4 / 3
  const previewCropGuide = activeSlot ? {
    x: 50 - (((activeSlot.width / activeSlot.height) / (videoRef.current?.videoWidth && videoRef.current?.videoHeight ? (videoRef.current.videoWidth / videoRef.current.videoHeight) : 1)) * 50),
    y: 50 - ((activeSlot.height / activeSlot.width) / ((videoRef.current?.videoWidth && videoRef.current?.videoHeight ? (videoRef.current.videoWidth / videoRef.current.videoHeight) : 1)) * 50),
    width: 100,
    height: 100
  } : undefined

  const captureToBlob = () => new Promise<{ blob: Blob; width: number; height: number } | null>((resolve) => {
    const video = videoRef.current
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !session?.selectedFrame) {
      resolve(null)
      return
    }

    const slot = session.selectedFrame.photoSlots[photoIndex] ?? session.selectedFrame.photoSlots[0]
    const crop = calculateCoverCrop(video.videoWidth, video.videoHeight, slot.width, slot.height)
    const canvas = document.createElement('canvas')
    canvas.width = slot.width
    canvas.height = slot.height
    const context = canvas.getContext('2d')
    if (!context) {
      resolve(null)
      return
    }
    if (mirrored) {
      context.save()
      context.translate(slot.width, 0)
      context.scale(-1, 1)
    }
    context.drawImage(video, crop.sourceX, crop.sourceY, crop.sourceWidth, crop.sourceHeight, 0, 0, slot.width, slot.height)
    if (mirrored) {
      context.restore()
    }
    canvas.toBlob((blob) => resolve(blob ? { blob, width: slot.width, height: slot.height } : null), 'image/png')
  })

  const wait = (milliseconds: number, sequence: number) => new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => resolve(sequence === sequenceRef.current), milliseconds)
    timersRef.current.push(timer)
  })

  const startSequence = async () => {
    if (!session || cameraState !== 'ready' || started) return
    const sequence = ++sequenceRef.current
    const retakeIndex = session.retakePhotoIndex
    const requiredPhotos = getRequiredPhotoCount(session.selectedFrame)
    const photos: Array<CapturedPhoto | null> = [...session.capturedPhotos]
    const indexes = session.captureMode === 'retake' && retakeIndex !== null
      ? [retakeIndex]
      : Array.from({ length: requiredPhotos }, (_, index) => index).filter((index) => !photos[index]?.id)
    setStarted(true)
    setCaptureError('')

    for (const index of indexes) {
      setPhotoIndex(index)
      for (let number = 3; number > 0; number -= 1) {
        setCounting(number)
        if (!(await wait(800, sequence))) return
      }
      setCounting('Capture')
      if (!(await wait(250, sequence))) return
      if (session.captureMode === 'retake' && retakeIndex !== null && session.capturedPhotos[retakeIndex]?.id) {
        photoStore.remove(session.capturedPhotos[retakeIndex].id)
      }
      const captured = await captureToBlob()
      if (!captured) {
        setCaptureError('The photo could not be captured. Keep the camera preview visible and try again.')
        setCounting(null)
        setStarted(false)
        return
      }
      const nextPhoto = photoStore.add(captured.blob, captured.width, captured.height, photos[index]?.id || `${session.id}-photo-${index + 1}`)
      const nextSession = capturePhoto({ id: nextPhoto.id, order: index + 1 })
      if (!nextSession) {
        setCaptureError('The photo could not be saved. Please try again.')
        setCounting(null)
        setStarted(false)
        return
      }
      photos[index] = nextSession.capturedPhotos[index]
      setCounting(null)
      if (!(await wait(450, sequence))) return
    }

    setStarted(false)
    if (photos.length >= requiredPhotos && photos.every((photo) => photo?.id)) {
      location.hash = '#/review'
    }
  }

  const goBack = () => {
    if (session && session.capturedPhotos.some((photo) => !!photo?.id) && !window.confirm('Going back will lose the photos in this session. Leave anyway?')) return
    sequenceRef.current += 1
    stopTimers()
    location.hash = '#/frames'
  }

  if (cameraState === 'loading') {
    return <main className="max-w-4xl mx-auto p-6"><h2 className="text-xl font-semibold">Preparing your camera...</h2><p className="mt-3 text-gray-600">Please allow camera access when your browser asks.</p></main>
  }
  if (cameraState === 'error') {
    return <main className="max-w-4xl mx-auto p-6"><h2 className="text-xl font-semibold">Camera unavailable</h2><p className="mt-3 text-gray-600">{cameraError}</p><button onClick={requestCamera} className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded">Try Again</button></main>
  }
  if (!session) return null

  const retakeIndex = session.retakePhotoIndex
  const requiredPhotos = getRequiredPhotoCount(session.selectedFrame)
  const statusText = retakeIndex === null ? `Photo ${Math.min(photoIndex + 1, requiredPhotos)} of ${requiredPhotos}` : `Retaking photo ${retakeIndex + 1} of ${requiredPhotos}`
  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">Photobooth</h2><p className="mt-1 text-sm text-gray-600">{statusText}</p></div><button onClick={goBack} className="px-3 py-2 bg-gray-100 rounded text-sm">Back</button></div>
      <div className="mt-4 relative bg-black rounded overflow-hidden">
        <CameraPreview
          stream={stream}
          videoRef={videoRef}
          mirrored={mirrored}
          aspectRatio={previewAspectRatio}
          showCropGuide={!!activeSlot}
          cropRect={{ x: 10, y: 10, width: 80, height: 80 }}
        />
        {session.selectedFrame?.svg && <div className="absolute inset-0 pointer-events-none" dangerouslySetInnerHTML={{ __html: session.selectedFrame.svg }} />}
        {counting !== null && <div className="absolute inset-0 flex items-center justify-center bg-black/20"><span className="text-7xl font-bold text-white drop-shadow">{counting}</span></div>}
      </div>
      <div className="mt-4 flex items-center justify-between gap-4"><div><p className="font-medium">{started ? `Get ready for ${statusText.toLowerCase()}` : retakeIndex === null && session.capturedPhotos.some((photo) => !!photo?.id) ? 'Ready to continue your session?' : retakeIndex === null ? 'Ready?' : `Ready to retake photo ${retakeIndex + 1}?`}</p>{captureError && <p className="mt-2 text-sm text-red-600">{captureError}</p>}</div>{!started && <button onClick={startSequence} className="px-4 py-2 bg-indigo-600 text-white rounded">{retakeIndex === null ? session.capturedPhotos.some((photo) => !!photo?.id) ? 'Continue Session' : 'Start Session' : 'Retake Photo'}</button>}</div>
    </main>
  )
}
