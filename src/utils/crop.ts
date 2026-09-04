export type CropRegion = {
  sourceX: number
  sourceY: number
  sourceWidth: number
  sourceHeight: number
  targetWidth: number
  targetHeight: number
}

export function calculateCoverCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): CropRegion {
  const safeSourceWidth = Number.isFinite(sourceWidth) && sourceWidth > 0 ? sourceWidth : 1
  const safeSourceHeight = Number.isFinite(sourceHeight) && sourceHeight > 0 ? sourceHeight : 1
  const safeTargetWidth = Number.isFinite(targetWidth) && targetWidth > 0 ? targetWidth : safeSourceWidth
  const safeTargetHeight = Number.isFinite(targetHeight) && targetHeight > 0 ? targetHeight : safeSourceHeight

  const sourceAspect = safeSourceWidth / safeSourceHeight
  const targetAspect = safeTargetWidth / safeTargetHeight

  if (sourceAspect > targetAspect) {
    const cropHeight = safeSourceHeight
    const cropWidth = safeSourceHeight * targetAspect
    return {
      sourceX: (safeSourceWidth - cropWidth) / 2,
      sourceY: 0,
      sourceWidth: cropWidth,
      sourceHeight: cropHeight,
      targetWidth: safeTargetWidth,
      targetHeight: safeTargetHeight
    }
  }

  const cropWidth = safeSourceWidth
  const cropHeight = safeSourceWidth / targetAspect

  return {
    sourceX: 0,
    sourceY: (safeSourceHeight - cropHeight) / 2,
    sourceWidth: cropWidth,
    sourceHeight: cropHeight,
    targetWidth: safeTargetWidth,
    targetHeight: safeTargetHeight
  }
}

export function calculateContainCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): CropRegion {
  const safeSourceWidth = Number.isFinite(sourceWidth) && sourceWidth > 0 ? sourceWidth : 1
  const safeSourceHeight = Number.isFinite(sourceHeight) && sourceHeight > 0 ? sourceHeight : 1
  const safeTargetWidth = Number.isFinite(targetWidth) && targetWidth > 0 ? targetWidth : safeSourceWidth
  const safeTargetHeight = Number.isFinite(targetHeight) && targetHeight > 0 ? targetHeight : safeSourceHeight

  const sourceAspect = safeSourceWidth / safeSourceHeight
  const targetAspect = safeTargetWidth / safeTargetHeight

  if (sourceAspect > targetAspect) {
    const cropWidth = safeSourceWidth
    const cropHeight = safeSourceWidth / targetAspect
    return {
      sourceX: 0,
      sourceY: (safeSourceHeight - cropHeight) / 2,
      sourceWidth: cropWidth,
      sourceHeight: cropHeight,
      targetWidth: safeTargetWidth,
      targetHeight: safeTargetHeight
    }
  }

  const cropHeight = safeSourceHeight
  const cropWidth = safeSourceHeight * targetAspect
  return {
    sourceX: (safeSourceWidth - cropWidth) / 2,
    sourceY: 0,
    sourceWidth: cropWidth,
    sourceHeight: cropHeight,
    targetWidth: safeTargetWidth,
    targetHeight: safeTargetHeight
  }
}
