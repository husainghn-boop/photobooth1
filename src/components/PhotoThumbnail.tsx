import React from 'react'

export default function PhotoThumbnail({ src, onRetake }: { src: string; onRetake: () => void }) {
  return (
    <div className="w-32">
      <div className="h-24 bg-gray-100 rounded overflow-hidden">
        <img src={src} className="w-full h-full object-cover" />
      </div>
      <div className="mt-2 text-center">
        <button onClick={onRetake} className="text-sm text-indigo-600">Retake</button>
      </div>
    </div>
  )
}
