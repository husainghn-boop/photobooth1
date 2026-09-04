import React, { useState } from 'react'
import UploadDropzone from '../components/UploadDropzone'
import FrameSlotEditor from '../components/FrameSlotEditor'
import { frameService } from '../services/frameService'
import { Frame, PhotoSlot } from '../types'
import { useAuth } from '../hooks/useAuth'

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Invalid image'))
    }
    image.src = url
  })
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid image data'))
    reader.onerror = () => reject(new Error('Could not read image data'))
    reader.readAsDataURL(file)
  })
}

export default function Upload() {
  const { isLoading, userType } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [tags, setTags] = useState('')
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (isLoading) return <main className="max-w-3xl mx-auto p-6"><p className="text-slate-600">Checking upload access...</p></main>
  if (userType !== 'registered') return <main className="max-w-3xl mx-auto p-6"><h2 className="text-xl font-semibold">Upload unavailable</h2><p className="mt-3 text-gray-600">Please sign in to upload a frame.</p><a href="#/signin" className="mt-5 inline-block rounded bg-indigo-600 px-4 py-2 text-white">Sign In</a></main>

  const onFile = async (f: File) => {
    setError(null)
    if (f.type !== 'image/png') return setError('Only PNG files are allowed')
    if (f.size > 2 * 1024 * 1024) return setError('File too large (max 2 MB)')
    try {
      const imageDimensions = await getImageDimensions(f)
      const imageDataUrl = await readFileAsDataUrl(f)
      setFile(f)
      setPreview(imageDataUrl)
      setDimensions(imageDimensions)
    } catch (e) {
      setError('Could not process image')
    }
  }

  const submit = async (photoSlots: PhotoSlot[]) => {
    if (!file) return setError('Please select a valid PNG')
    if (!name) return setError('Please enter a name')
    setSubmitting(true)
    const id = 'community-' + Math.random().toString(36).slice(2, 9)
    const svgPlaceholder = `<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1200 1800\"><rect fill=\"none\"/></svg>`
    const frameWidth = dimensions?.width || 0
    const frameHeight = dimensions?.height || 0
    const frame: Frame = {
      id,
      name,
      description: desc,
      layoutType: `photos-${photoSlots.length}`,
      creatorName: 'You',
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      usageCount: 0,
      likes: 0,
      width: frameWidth,
      height: frameHeight,
      canvasWidth: frameWidth,
      canvasHeight: frameHeight,
      photoCount: photoSlots.length,
      photoSlots,
      frameImage: preview || undefined,
      svg: svgPlaceholder
    }
    try {
      await frameService.add(frame)
      location.hash = '#/frames?tab=community'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not save this frame right now. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h2 className="text-xl font-semibold">Upload Frame</h2>
      <div className="mt-4 grid gap-6">
        <UploadDropzone onFile={onFile} />
        {preview && <div className="w-64 h-auto border rounded overflow-hidden"><img src={preview} className="w-full" /></div>}
        <input placeholder="Frame name" value={name} onChange={(e) => setName(e.target.value)} className="p-2 border rounded" />
        <textarea placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} className="p-2 border rounded" />
        <input placeholder="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} className="p-2 border rounded" />
        {error && <div className="text-red-600">{error}</div>}
        {preview && dimensions && <FrameSlotEditor imageUrl={preview} width={dimensions.width} height={dimensions.height} onCancel={() => { setFile(null); setPreview(null); setDimensions(null) }} onSave={submit} />}
        {!preview && <button onClick={() => (location.hash = '#/frames')} className="w-fit rounded bg-gray-100 px-4 py-2">Cancel</button>}
      </div>
    </main>
  )
}
