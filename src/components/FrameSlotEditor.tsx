import React, { useEffect, useRef, useState } from 'react'
import { PhotoSlot } from '../types'
import { detectPhotoSlots } from '../utils/autoSlotDetection'
import { validateFrame } from '../utils/frameValidation'

const MAX_SLOTS = 4
const MIN_SLOT_SIZE = 24

type FrameSlotEditorProps = {
  imageUrl: string
  width: number
  height: number
  initialSlots?: PhotoSlot[]
  onCancel: () => void
  onSave: (slots: PhotoSlot[]) => void
}

type Interaction = {
  mode: 'move' | 'resize'
  index: number
  startX: number
  startY: number
  slot: PhotoSlot
}

function defaultSlot(width: number, height: number): PhotoSlot {
  const insetX = Math.max(12, Math.round(width * 0.1))
  const insetY = Math.max(12, Math.round(height * 0.1))
  return { photoIndex: 0, x: insetX, y: insetY, width: Math.max(MIN_SLOT_SIZE, width - insetX * 2), height: Math.max(MIN_SLOT_SIZE, height - insetY * 2), rotation: 0, fit: 'cover' }
}

function normalizeSlots(slots: PhotoSlot[], width: number, height: number): PhotoSlot[] {
  return slots.slice(0, MAX_SLOTS).map((slot, index) => ({
    ...slot,
    photoIndex: index,
    x: Math.max(0, Math.min(Math.round(slot.x), Math.max(0, width - MIN_SLOT_SIZE))),
    y: Math.max(0, Math.min(Math.round(slot.y), Math.max(0, height - MIN_SLOT_SIZE))),
    width: Math.max(MIN_SLOT_SIZE, Math.min(Math.round(slot.width), width)),
    height: Math.max(MIN_SLOT_SIZE, Math.min(Math.round(slot.height), height)),
    rotation: Number(slot.rotation ?? 0),
    fit: 'cover' as const
  })).map((slot) => ({
    ...slot,
    width: Math.min(slot.width, width - slot.x),
    height: Math.min(slot.height, height - slot.y)
  }))
}

export default function FrameSlotEditor({ imageUrl, width, height, initialSlots, onCancel, onSave }: FrameSlotEditorProps) {
  const [slots, setSlots] = useState<PhotoSlot[]>(() => normalizeSlots(initialSlots?.length ? initialSlots : [defaultSlot(width, height)], width, height))
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const interactionRef = useRef<Interaction | null>(null)

  const recalculate = async () => {
    setDetecting(true)
    setError(null)
    const detected = await detectPhotoSlots(imageUrl, width, height)
    setSlots(normalizeSlots(detected.slots.length ? detected.slots : [defaultSlot(width, height)], width, height))
    setSelectedIndex(0)
    setDetecting(false)
  }

  useEffect(() => {
    if (!initialSlots?.length) void recalculate()
  }, [imageUrl, width, height])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current
      const preview = previewRef.current
      if (!interaction || !preview) return
      const scale = preview.clientWidth / width
      const deltaX = (event.clientX - interaction.startX) / scale
      const deltaY = (event.clientY - interaction.startY) / scale
      setSlots((current) => current.map((slot, index) => {
        if (index !== interaction.index) return slot
        if (interaction.mode === 'move') {
          return { ...slot, x: Math.max(0, Math.min(width - slot.width, Math.round(interaction.slot.x + deltaX))), y: Math.max(0, Math.min(height - slot.height, Math.round(interaction.slot.y + deltaY))) }
        }
        return { ...slot, width: Math.max(MIN_SLOT_SIZE, Math.min(width - slot.x, Math.round(interaction.slot.width + deltaX))), height: Math.max(MIN_SLOT_SIZE, Math.min(height - slot.y, Math.round(interaction.slot.height + deltaY))) }
      }))
    }
    const stopInteraction = () => { interactionRef.current = null }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopInteraction)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopInteraction)
    }
  }, [height, width])

  const updateSelected = (changes: Partial<PhotoSlot>) => {
    setSlots((current) => current.map((slot, index) => index === selectedIndex ? normalizeSlots([{ ...slot, ...changes }], width, height)[0] : slot))
  }

  const addSlot = () => {
    if (slots.length >= MAX_SLOTS) return
    const size = Math.max(MIN_SLOT_SIZE, Math.round(Math.min(width, height) * 0.3))
    const next: PhotoSlot = { photoIndex: slots.length, x: Math.max(0, Math.round((width - size) / 2)), y: Math.max(0, Math.round((height - size) / 2)), width: Math.min(size, width), height: Math.min(size, height), rotation: 0, fit: 'cover' }
    setSlots((current) => [...current, next])
    setSelectedIndex(slots.length)
  }

  const removeSlot = () => {
    if (slots.length <= 1) return
    setSlots((current) => current.filter((_, index) => index !== selectedIndex).map((slot, index) => ({ ...slot, photoIndex: index })))
    setSelectedIndex(Math.max(0, selectedIndex - 1))
  }

  const moveOrder = (direction: -1 | 1) => {
    const nextIndex = selectedIndex + direction
    if (nextIndex < 0 || nextIndex >= slots.length) return
    setSlots((current) => {
      const next = [...current]
      ;[next[selectedIndex], next[nextIndex]] = [next[nextIndex], next[selectedIndex]]
      return next.map((slot, index) => ({ ...slot, photoIndex: index }))
    })
    setSelectedIndex(nextIndex)
  }

  const save = () => {
    const normalized = normalizeSlots(slots, width, height)
    const validation = validateFrame({ id: 'draft', name: 'Draft frame', creatorName: 'You', width, height, canvasWidth: width, canvasHeight: height, photoCount: normalized.length, photoSlots: normalized })
    if (!validation.valid) {
      setError(validation.error || 'The photo slots are invalid.')
      return
    }
    onSave(normalized)
  }

  const selected = slots[selectedIndex]
  const scale = 100 / width

  return (
    <section className="mt-6 border-t pt-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Frame Slot Editor</h3>
          <p className="text-sm text-slate-600">{width} x {height} px · Slots: {slots.length} / {MAX_SLOTS}</p>
        </div>
        <button type="button" onClick={recalculate} disabled={detecting} className="rounded bg-gray-100 px-3 py-2 text-sm">{detecting ? 'Detecting...' : 'Reset Detection'}</button>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div ref={previewRef} className="relative mx-auto w-full max-w-xl overflow-hidden border bg-slate-100" style={{ aspectRatio: `${width} / ${height}` }}>
          <img src={imageUrl} alt="Uploaded frame" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
          {slots.map((slot, index) => (
            <div
              key={`${slot.photoIndex}-${index}`}
              onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setSelectedIndex(index); interactionRef.current = { mode: 'move', index, startX: event.clientX, startY: event.clientY, slot: { ...slot } } }}
              className={`absolute cursor-move border-2 ${selectedIndex === index ? 'z-10 border-indigo-600 bg-indigo-400/20' : 'border-amber-500 bg-amber-300/10'}`}
              style={{ left: `${slot.x * scale}%`, top: `${slot.y / height * 100}%`, width: `${slot.width * scale}%`, height: `${slot.height / height * 100}%`, transform: `rotate(${slot.rotation ?? 0}deg)` }}
            >
              <span className="absolute left-1 top-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-xs font-semibold text-white">SLOT {index + 1}</span>
              {selectedIndex === index && <span onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); interactionRef.current = { mode: 'resize', index, startX: event.clientX, startY: event.clientY, slot: { ...slot } } }} className="absolute -bottom-2 -right-2 h-4 w-4 cursor-se-resize rounded-sm border-2 border-white bg-indigo-600" />}
            </div>
          ))}
        </div>

        <div className="grid content-start gap-3">
          <div className="flex gap-2">
            <button type="button" onClick={addSlot} disabled={slots.length >= MAX_SLOTS} className="rounded bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50">Add Slot</button>
            <button type="button" onClick={removeSlot} disabled={slots.length <= 1} className="rounded bg-gray-100 px-3 py-2 text-sm disabled:opacity-50">Remove</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {slots.map((slot, index) => <button type="button" key={`selector-${index}`} onClick={() => setSelectedIndex(index)} className={`rounded px-3 py-1 text-sm ${selectedIndex === index ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100'}`}>Slot {index + 1}</button>)}
          </div>
          {selected && <div className="grid grid-cols-2 gap-2 text-sm">
            <label>X<input type="number" value={selected.x} onChange={(event) => updateSelected({ x: Number(event.target.value) })} className="w-full rounded border p-1" /></label>
            <label>Y<input type="number" value={selected.y} onChange={(event) => updateSelected({ y: Number(event.target.value) })} className="w-full rounded border p-1" /></label>
            <label>Width<input type="number" value={selected.width} onChange={(event) => updateSelected({ width: Number(event.target.value) })} className="w-full rounded border p-1" /></label>
            <label>Height<input type="number" value={selected.height} onChange={(event) => updateSelected({ height: Number(event.target.value) })} className="w-full rounded border p-1" /></label>
            <label className="col-span-2">Rotation<input type="number" value={selected.rotation ?? 0} onChange={(event) => updateSelected({ rotation: Number(event.target.value) })} className="w-full rounded border p-1" /></label>
            <div className="col-span-2 flex gap-2"><button type="button" onClick={() => moveOrder(-1)} className="rounded bg-slate-100 px-2 py-1">Move Earlier</button><button type="button" onClick={() => moveOrder(1)} className="rounded bg-slate-100 px-2 py-1">Move Later</button></div>
          </div>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>

      <div className="mt-6 flex justify-between gap-3"><button type="button" onClick={onCancel} className="rounded bg-gray-100 px-4 py-2">Cancel</button><button type="button" onClick={save} className="rounded bg-indigo-600 px-4 py-2 text-white">Save Frame</button></div>
    </section>
  )
}
