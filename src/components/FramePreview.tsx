import React from 'react'
import Modal from './Modal'
import Button from './Button'
import { Frame } from '../types'

export default function FramePreview({ frame, open, onClose, onUse }: { frame: Frame | null; open: boolean; onClose: () => void; onUse?: (f: Frame) => void }) {
  if (!frame) return null
  const photoCount = frame.photoSlots?.length ?? frame.photoCount ?? 0

  return (
    <Modal open={open} onClose={onClose} title={frame.name}>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded p-3 flex items-center justify-center">
          <div style={{ maxWidth: 360 }} dangerouslySetInnerHTML={{ __html: frame.svg || '' }} />
        </div>
        <div>
          <div className="text-sm text-gray-600">by {frame.creatorName}</div>
          <div className="mt-2 text-sm font-medium text-indigo-700">{photoCount} {photoCount === 1 ? 'photo' : 'photos'}</div>
          <div className="mt-3 text-gray-700">{frame.tags?.join(', ')}</div>
          <div className="mt-6 flex gap-3">
            <Button onClick={() => onUse && onUse(frame)} className="bg-indigo-600 text-white">Use This Frame</Button>
            <Button onClick={onClose} className="bg-gray-100">Close</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
