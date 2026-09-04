import React, { useEffect, useRef } from 'react'

export default function CameraPreview({
  stream,
  mirrored = true,
  videoRef: externalVideoRef,
  aspectRatio = 4 / 3,
  showCropGuide = false,
  cropRect
}: {
  stream: MediaStream | null
  mirrored?: boolean
  videoRef?: React.RefObject<HTMLVideoElement>
  aspectRatio?: number
  showCropGuide?: boolean
  cropRect?: { x: number; y: number; width: number; height: number }
}) {
  const internalVideoRef = useRef<HTMLVideoElement | null>(null)
  const videoRef = externalVideoRef || internalVideoRef

  useEffect(() => {
    const v = videoRef.current
    if (v && stream) {
      v.srcObject = stream
      v.play().catch(() => {})
    }
  }, [stream])

  return (
    <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: `${aspectRatio}` }}>
      <video ref={videoRef} className={`h-full w-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`} playsInline muted />
      {showCropGuide && cropRect && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
            style={{
              left: `${(cropRect.x / 100) * 100}%`,
              top: `${(cropRect.y / 100) * 100}%`,
              width: `${cropRect.width}%`,
              height: `${cropRect.height}%`,
              boxSizing: 'border-box'
            }}
          />
        </div>
      )}
    </div>
  )
}
