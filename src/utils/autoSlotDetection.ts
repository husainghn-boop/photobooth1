import { PhotoSlot } from '../types'

const DEFAULT_OPTIONS = {
  sampleSize: 96,
  alphaThreshold: 40,
  minimumAreaRatio: 0.006,
  minimumWidthRatio: 0.08,
  minimumHeightRatio: 0.08,
  maximumSlots: 4
}

type DetectionOptions = Partial<typeof DEFAULT_OPTIONS>

type Candidate = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  area: number
  confidence: number
  rotation: number
}

export type SlotDetectionResult = {
  slots: PhotoSlot[]
  confidence: number
  usedAlpha: boolean
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The frame image could not be read.'))
    image.src = url
  })
}

function candidateToSlot(candidate: Candidate, width: number, height: number, index: number): PhotoSlot {
  return {
    photoIndex: index,
    x: Math.max(0, Math.round(candidate.minX * width)),
    y: Math.max(0, Math.round(candidate.minY * height)),
    width: Math.min(width, Math.round((candidate.maxX - candidate.minX) * width)),
    height: Math.min(height, Math.round((candidate.maxY - candidate.minY) * height)),
    rotation: candidate.rotation,
    fit: 'cover'
  }
}

function normalizeRotation(angle: number): number {
  let normalized = angle
  while (normalized > 45) normalized -= 90
  while (normalized < -45) normalized += 90
  if (!Number.isFinite(normalized) || Math.abs(normalized) > 45) return 0
  return Math.round(normalized * 10) / 10
}

function rankCandidates(candidates: Candidate[], maximumSlots: number): Candidate[] {
  return candidates
    .sort((a, b) => b.confidence - a.confidence || b.area - a.area)
    .slice(0, maximumSlots)
    .sort((a, b) => a.minY - b.minY || a.minX - b.minX)
}

function detectTransparentCandidates(data: ImageData, options: Required<DetectionOptions>): Candidate[] {
  const { width, height } = data
  const visited = new Uint8Array(width * height)
  const candidates: Candidate[] = []
  const isTransparent = (x: number, y: number) => data.data[(y * width + x) * 4 + 3] <= options.alphaThreshold

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const start = y * width + x
      if (visited[start] || !isTransparent(x, y)) continue
      const queue: Array<[number, number]> = [[x, y]]
      visited[start] = 1
      let area = 0
      let minX = x
      let minY = y
      let maxX = x
      let maxY = y
      let sumX = 0
      let sumY = 0
      let sumXX = 0
      let sumYY = 0
      let sumXY = 0
      while (queue.length) {
        const [currentX, currentY] = queue.pop()!
        area += 1
        sumX += currentX
        sumY += currentY
        sumXX += currentX * currentX
        sumYY += currentY * currentY
        sumXY += currentX * currentY
        minX = Math.min(minX, currentX)
        minY = Math.min(minY, currentY)
        maxX = Math.max(maxX, currentX)
        maxY = Math.max(maxY, currentY)
        for (const [nextX, nextY] of [[currentX + 1, currentY], [currentX - 1, currentY], [currentX, currentY + 1], [currentX, currentY - 1]]) {
          if (nextX < 1 || nextY < 1 || nextX >= width - 1 || nextY >= height - 1) continue
          const next = nextY * width + nextX
          if (!visited[next] && isTransparent(nextX, nextY)) {
            visited[next] = 1
            queue.push([nextX, nextY])
          }
        }
      }
      const regionWidth = maxX - minX + 1
      const regionHeight = maxY - minY + 1
      const boxArea = regionWidth * regionHeight
      const areaRatio = area / (width * height)
      const rectangularity = area / boxArea
      const meanX = sumX / area
      const meanY = sumY / area
      const varianceX = sumXX / area - meanX * meanX
      const varianceY = sumYY / area - meanY * meanY
      const covariance = sumXY / area - meanX * meanY
      const principalAngle = (Math.atan2(2 * covariance, varianceX - varianceY) * 180) / Math.PI / 2
      const majorVariance = (varianceX + varianceY + Math.sqrt(Math.max(0, (varianceX - varianceY) ** 2 + 4 * covariance ** 2))) / 2
      const minorVariance = (varianceX + varianceY - Math.sqrt(Math.max(0, (varianceX - varianceY) ** 2 + 4 * covariance ** 2))) / 2
      const axisConfidence = majorVariance > 0 ? (majorVariance - minorVariance) / majorVariance : 0
      const referenceAngle = regionWidth >= regionHeight ? 0 : 90
      const rotation = axisConfidence >= 0.18 ? normalizeRotation(principalAngle - referenceAngle) : 0
      if (areaRatio < options.minimumAreaRatio || regionWidth / width < options.minimumWidthRatio || regionHeight / height < options.minimumHeightRatio) continue
      if (rectangularity < 0.45 || minX <= 1 || minY <= 1 || maxX >= width - 2 || maxY >= height - 2) continue
      candidates.push({
        minX: minX / width,
        minY: minY / height,
        maxX: (maxX + 1) / width,
        maxY: (maxY + 1) / height,
        area: areaRatio,
        confidence: Math.min(1, areaRatio * 3 + rectangularity * 0.55),
        rotation
      })
    }
  }
  return candidates
}

function detectOpaqueCandidates(data: ImageData, options: Required<DetectionOptions>): Candidate[] {
  const { width, height } = data
  const visited = new Uint8Array(width * height)
  const candidates: Candidate[] = []
  const isPlaceholder = (x: number, y: number) => {
    const offset = (y * width + x) * 4
    const alpha = data.data[offset + 3]
    const red = data.data[offset]
    const green = data.data[offset + 1]
    const blue = data.data[offset + 2]
    return alpha > options.alphaThreshold && red > 210 && green > 210 && blue > 210
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const start = y * width + x
      if (visited[start] || !isPlaceholder(x, y)) continue
      const queue: Array<[number, number]> = [[x, y]]
      visited[start] = 1
      let area = 0
      let minX = x
      let minY = y
      let maxX = x
      let maxY = y
      let sumX = 0
      let sumY = 0
      let sumXX = 0
      let sumYY = 0
      let sumXY = 0
      while (queue.length) {
        const [currentX, currentY] = queue.pop()!
        area += 1
        sumX += currentX
        sumY += currentY
        sumXX += currentX * currentX
        sumYY += currentY * currentY
        sumXY += currentX * currentY
        minX = Math.min(minX, currentX)
        minY = Math.min(minY, currentY)
        maxX = Math.max(maxX, currentX)
        maxY = Math.max(maxY, currentY)
        for (const [nextX, nextY] of [[currentX + 1, currentY], [currentX - 1, currentY], [currentX, currentY + 1], [currentX, currentY - 1]]) {
          if (nextX < 1 || nextY < 1 || nextX >= width - 1 || nextY >= height - 1) continue
          const next = nextY * width + nextX
          if (!visited[next] && isPlaceholder(nextX, nextY)) {
            visited[next] = 1
            queue.push([nextX, nextY])
          }
        }
      }
      const regionWidth = maxX - minX + 1
      const regionHeight = maxY - minY + 1
      const areaRatio = area / (width * height)
      const rectangularity = area / (regionWidth * regionHeight)
      const meanX = sumX / area
      const meanY = sumY / area
      const varianceX = sumXX / area - meanX * meanX
      const varianceY = sumYY / area - meanY * meanY
      const covariance = sumXY / area - meanX * meanY
      const principalAngle = (Math.atan2(2 * covariance, varianceX - varianceY) * 180) / Math.PI / 2
      const majorVariance = (varianceX + varianceY + Math.sqrt(Math.max(0, (varianceX - varianceY) ** 2 + 4 * covariance ** 2))) / 2
      const minorVariance = (varianceX + varianceY - Math.sqrt(Math.max(0, (varianceX - varianceY) ** 2 + 4 * covariance ** 2))) / 2
      const axisConfidence = majorVariance > 0 ? (majorVariance - minorVariance) / majorVariance : 0
      const referenceAngle = regionWidth >= regionHeight ? 0 : 90
      const rotation = axisConfidence >= 0.18 ? normalizeRotation(principalAngle - referenceAngle) : 0
      if (areaRatio >= options.minimumAreaRatio * 2 && regionWidth / width >= options.minimumWidthRatio && regionHeight / height >= options.minimumHeightRatio && rectangularity >= 0.6 && minX > 1 && minY > 1 && maxX < width - 2 && maxY < height - 2) {
        candidates.push({ minX: minX / width, minY: minY / height, maxX: (maxX + 1) / width, maxY: (maxY + 1) / height, area: areaRatio, confidence: Math.min(0.7, areaRatio * 2 + rectangularity * 0.35), rotation })
      }
    }
  }
  return candidates
}

export async function detectPhotoSlots(imageUrl: string, frameWidth: number, frameHeight: number, inputOptions: DetectionOptions = {}): Promise<SlotDetectionResult> {
  const options = { ...DEFAULT_OPTIONS, ...inputOptions } as Required<DetectionOptions>
  try {
    const image = await loadImage(imageUrl)
    const sampleWidth = Math.min(options.sampleSize, Math.max(24, frameWidth))
    const sampleHeight = Math.max(24, Math.round(sampleWidth * frameHeight / frameWidth))
    const canvas = document.createElement('canvas')
    canvas.width = sampleWidth
    canvas.height = sampleHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return { slots: [], confidence: 0, usedAlpha: false }
    context.drawImage(image, 0, 0, sampleWidth, sampleHeight)
    const data = context.getImageData(0, 0, sampleWidth, sampleHeight)
    let hasTransparency = false
    for (let index = 3; index < data.data.length; index += 4) {
      if (data.data[index] <= options.alphaThreshold) {
        hasTransparency = true
        break
      }
    }
    const alphaCandidates = rankCandidates(detectTransparentCandidates(data, options), options.maximumSlots)
    const candidates = alphaCandidates.length ? alphaCandidates : rankCandidates(detectOpaqueCandidates(data, options), options.maximumSlots)
    const confidence = candidates.length ? Math.max(...candidates.map((candidate) => candidate.confidence)) : 0
    if (confidence < 0.35) return { slots: [], confidence, usedAlpha: false }
    return {
      slots: candidates.map((candidate, index) => candidateToSlot(candidate, frameWidth, frameHeight, index)),
      confidence,
      usedAlpha: hasTransparency && alphaCandidates.length > 0
    }
  } catch {
    return { slots: [], confidence: 0, usedAlpha: false }
  }
}
