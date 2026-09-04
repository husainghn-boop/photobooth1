import React, { useRef, useState } from 'react'

type Props = { onFile: (file: File) => void }

export default function UploadDropzone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [drag, setDrag] = useState(false)

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
  }

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) onFile(f)
  }

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={() => setDrag(true)}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded p-6 text-center ${drag ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'} `}
      >
        <div className="text-gray-600">Drag & drop a PNG frame here, or</div>
        <div className="mt-3">
          <button className="px-4 py-2 bg-indigo-600 text-white rounded" onClick={() => inputRef.current?.click()}>Select a file</button>
        </div>
        <input ref={inputRef} type="file" accept="image/png" onChange={onSelect} className="hidden" />
      </div>
      <div className="text-xs text-gray-500 mt-2">PNG only • Max 2 MB • Transparent background recommended</div>
    </div>
  )
}
