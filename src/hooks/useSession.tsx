import { useEffect, useRef, useState } from 'react'
import { CapturedPhoto, Frame, PhotoFilter, PhotoSession } from '../types'
import { getRequiredPhotoCount, sessionService } from '../services/sessionService'
import { photoStore } from '../services/photoStore'

export function useSession() {
  const [session, setSession] = useState<PhotoSession | null>(() => sessionService.load())
  const sessionRef = useRef(session)

  useEffect(() => {
    if (!session) {
      photoStore.clear()
      const s = sessionService.create()
      sessionRef.current = s
      setSession(s)
    }
  }, [])

  const save = (s: PhotoSession) => {
    sessionService.save(s)
    sessionRef.current = s
    setSession({ ...s })
  }

  const startNewSession = (frame?: Frame | null) => {
    photoStore.clear()
    const next = sessionService.startNewSession(frame === undefined ? sessionRef.current?.selectedFrame || null : frame)
    save(next)
    return next
  }

  const beginRetake = (index: number) => {
    const current = sessionRef.current
    if (!current || index < 0 || index >= current.capturedPhotos.length || !current.capturedPhotos[index]?.id) return null
    const next = { ...current, capturedPhotos: [...current.capturedPhotos], captureMode: 'retake' as const, retakePhotoIndex: index, currentStep: 'studio' as const }
    save(next)
    return next
  }

  const capturePhoto = (photo: CapturedPhoto) => {
    const current = sessionRef.current
    if (!current) return null
    const next = sessionService.capturePhoto(current, photo)
    if (!next) return null
    save(next)
    return next
  }

  const continueToEditor = () => {
    const current = sessionRef.current
    if (!current || !current.selectedFrame) return false
    const requiredPhotos = getRequiredPhotoCount(current.selectedFrame)
    if (current.capturedPhotos.length < requiredPhotos || current.capturedPhotos.slice(0, requiredPhotos).some((photo) => !photo?.id)) return false
    save({ ...current, currentStep: 'editor' })
    return true
  }

  const updatePhotoFilter = (index: number, filter: PhotoFilter) => {
    const current = sessionRef.current
    if (!current || !current.selectedFrame) return null
    const requiredPhotos = getRequiredPhotoCount(current.selectedFrame)
    if (index < 0 || index >= requiredPhotos) return null
    const edits = Array.from({ length: requiredPhotos }, (_, photoIndex) => ({ ...current.photoEdits[photoIndex] || { filter: 'original' } }))
    edits[index] = { filter }
    const history = current.editHistory.slice(0, current.editHistoryIndex + 1)
    history.push(edits.map((edit) => ({ ...edit })))
    const next = { ...current, photoEdits: edits, editHistory: history, editHistoryIndex: history.length - 1 }
    save(next)
    return next
  }

  const undoPhotoEdit = () => {
    const current = sessionRef.current
    if (!current || current.editHistoryIndex <= 0) return null
    const index = current.editHistoryIndex - 1
    const edits = current.editHistory[index].map((edit) => ({ ...edit }))
    const next = { ...current, photoEdits: edits, editHistoryIndex: index }
    save(next)
    return next
  }

  const redoPhotoEdit = () => {
    const current = sessionRef.current
    if (!current || current.editHistoryIndex >= current.editHistory.length - 1) return null
    const index = current.editHistoryIndex + 1
    const edits = current.editHistory[index].map((edit) => ({ ...edit }))
    const next = { ...current, photoEdits: edits, editHistoryIndex: index }
    save(next)
    return next
  }

  const continueToResult = () => {
    const current = sessionRef.current
    if (!current) return false
    save({ ...current, currentStep: 'result' })
    return true
  }

  const updateSelectedFrame = (frame: Frame) => {
    const current = sessionRef.current
    if (!current) return null
    const next = { ...current, selectedFrame: frame, currentStep: 'result' as const }
    save(next)
    return next
  }

  const reload = () => {
    const next = sessionService.load()
    sessionRef.current = next
    setSession(next)
  }

  return { session, setSession: save, startNewSession, beginRetake, capturePhoto, continueToEditor, updatePhotoFilter, undoPhotoEdit, redoPhotoEdit, continueToResult, updateSelectedFrame, reload }
}
