import React, { useEffect, useMemo, useState } from 'react'
import { FrameDeleteError, frameService } from '../services/frameService'
import { Frame } from '../types'
import FrameCard from '../components/FrameCard'
import { useSession } from '../hooks/useSession'
import { useAuth } from '../hooks/useAuth'
import FramePreview from '../components/FramePreview'
import FilterChip from '../components/FilterChip'
import { getRequiredPhotoCount } from '../services/sessionService'

const TABS = ['trending', 'popular', 'new', 'official', 'community', 'my', 'saved']

export default function FrameGallery() {
  const [frames, setFrames] = useState<Frame[]>([])
  const { session, setSession, startNewSession, updateSelectedFrame } = useSession()
  const { user, userType, isAdmin, isAuthenticated, isLoading } = useAuth()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<string>('trending')
  const [previewFrame, setPreviewFrame] = useState<Frame | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Frame | null>(null)
  const [savedIds, setSavedIds] = useState<string[]>(() => JSON.parse(localStorage.getItem('photobooth.saved') || '[]'))

  // Redirect unauthenticated users back to landing
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      location.hash = '#/'
    }
  }, [isAuthenticated, isLoading])

  useEffect(() => {
    frameService.list().then(setFrames)
    const parts = window.location.hash.split('?')
    if (parts[1]) {
      const params = new URLSearchParams(parts[1])
      const t = params.get('tab')
      if (t) setTab(t)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('photobooth.saved', JSON.stringify(savedIds))
  }, [savedIds])

  const filtered = useMemo(() => {
    let list = frames
    if (tab === 'official') list = list.filter((f) => f.isOfficial)
    if (tab === 'community') list = list.filter((f) => !f.isOfficial)
    if (tab === 'my') list = user?.id ? list.filter((f) => !f.isOfficial && f.ownerId === user.id) : []
    if (query) list = list.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()) || (f.tags || []).join(' ').toLowerCase().includes(query.toLowerCase()))
    return list
  }, [frames, tab, query])

  const openPreview = (f: Frame) => setPreviewFrame(f)

  const handleUseFromPreview = (f: any) => {
    const isChangingFrame = new URLSearchParams(window.location.hash.split('?')[1] || '').get('mode') === 'change'
    const requiredCount = session ? getRequiredPhotoCount(session.selectedFrame) : 0
    const hasRequiredPhotos = !!session && session.capturedPhotos.slice(0, requiredCount).every((photo) => !!photo?.id)
    if (isChangingFrame && hasRequiredPhotos) {
      updateSelectedFrame(f)
      location.hash = '#/result'
    } else {
      startNewSession(f)
      location.hash = '#/studio'
    }
  }

  const handleSave = (f: Frame) => {
    setSavedIds((s) => (s.includes(f.id) ? s.filter((id) => id !== f.id) : [f.id, ...s]))
  }

  const canDeleteFrame = (frame: Frame) => !frame.isOfficial && (isAdmin || (userType === 'registered' && frame.ownerId === user?.id))

  const requestDelete = (frame: Frame) => {
    if (canDeleteFrame(frame)) {
      setDeleteError(null)
      setPendingDelete(frame)
    }
  }

  const handleDelete = async () => {
    const frame = pendingDelete
    if (!frame || !canDeleteFrame(frame)) return
    setDeleteError(null)
    setDeleteSuccess(null)
    setPendingDelete(null)
    setDeletingId(frame.id)
    try {
      const result = await frameService.delete(frame.id, frame.ownerId)
      if (result.status === 'not_found_or_inaccessible') {
        setFrames((current) => current.filter((item) => item.id !== frame.id))
        setDeleteError('Frame ini sudah tidak tersedia.')
        return
      }
      setFrames((current) => current.filter((item) => item.id !== result.id))
      if (previewFrame?.id === frame.id) setPreviewFrame(null)
      if (session?.selectedFrame?.id === frame.id && session) setSession({ ...session, selectedFrame: null })
      setDeleteSuccess('Frame berhasil dihapus.')
    } catch (error) {
      setDeleteError(error instanceof FrameDeleteError ? error.message : 'Kamu tidak memiliki izin untuk menghapus frame ini.')
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-slate-600">Loading...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Frames</h1>
        <div className="w-1/3">
          <input placeholder="Search frames" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full p-2 border rounded" />
        </div>
      </div>

      <div className="mt-4 flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <FilterChip key={t} active={t === tab} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</FilterChip>
        ))}
      </div>

      {tab === 'my' && userType === 'anonymous' && <p className="mt-4 text-sm text-slate-600">Login untuk melihat frame yang kamu buat.</p>}
      {deleteError && <p className="mt-4 text-sm text-red-600" role="alert">{deleteError}</p>}
      {deleteSuccess && <p className="mt-4 text-sm text-emerald-700" role="status">{deleteSuccess}</p>}

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filtered.map((f) => (
          <FrameCard
            key={f.id}
            frame={f}
            onClick={openPreview}
            onSave={handleSave}
            onDelete={requestDelete}
            canDelete={canDeleteFrame(f)}
            currentUserId={user?.id}
            deleting={deletingId === f.id}
            selected={session?.selectedFrame?.id === f.id}
          />
        ))}
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPendingDelete(null)} />
          <div className="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Hapus frame ini?</h2>
            <p className="mt-2 text-sm text-slate-600">Apakah kamu yakin ingin menghapus frame ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setPendingDelete(null)} className="rounded bg-gray-100 px-4 py-2 text-sm">Batal</button>
              <button onClick={handleDelete} className="rounded bg-red-600 px-4 py-2 text-sm text-white">Hapus</button>
            </div>
          </div>
        </div>
      )}

      <FramePreview frame={previewFrame} open={!!previewFrame} onClose={() => setPreviewFrame(null)} onUse={handleUseFromPreview} />
    </main>
  )
}
