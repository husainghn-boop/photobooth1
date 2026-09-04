import React from 'react'
import { Frame } from '../types'

export default function FrameCard({ frame, onClick, onSave, onDelete, canDelete, currentUserId, selected, deleting }: { frame: Frame; onClick?: (f: Frame) => void; onSave?: (f: Frame) => void; onDelete?: (f: Frame) => void; canDelete?: boolean; currentUserId?: string; selected?: boolean; deleting?: boolean }) {
  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSave && onSave(frame)
  }
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete && onDelete(frame)
  }
  const photoCount = frame.photoSlots?.length ?? frame.photoCount ?? 0
  const creatorLabel = frame.ownerId && frame.ownerId === currentUserId ? 'You' : frame.creatorName

  return (
    <div
      className={`relative cursor-pointer rounded-xl border bg-white p-3 shadow-sm transition-all hover:shadow-md ${selected ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200'}`}
      onClick={() => onClick && onClick(frame)}
      role="button"
      tabIndex={0}
      aria-label={`${frame.name} frame card`}
    >
      <button onClick={handleSave} aria-label="Save frame" className="absolute right-3 top-3 rounded-full bg-white/90 p-1.5 shadow-sm">♡</button>
      {canDelete && <button onClick={handleDelete} disabled={deleting} aria-label={`Delete ${frame.name}`} className="absolute bottom-3 right-3 rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>}
      <div className="h-48 overflow-hidden rounded-lg bg-slate-100">
        <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: frame.svg || '' }} />
      </div>
      <div className="mt-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-slate-900">{frame.name}</div>
            <div className="text-xs text-slate-500">by {creatorLabel}</div>
          </div>
          {selected && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">Selected</span>}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{photoCount} {photoCount === 1 ? 'photo' : 'photos'}</span>
          <span className={`rounded-full px-2 py-1 ${frame.isOfficial ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {frame.isOfficial ? 'Official' : 'Community'}
          </span>
        </div>
      </div>
    </div>
  )
}
