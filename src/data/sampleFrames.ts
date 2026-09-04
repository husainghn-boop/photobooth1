import { Frame } from '../types'

const FRAME_WIDTH = 1080
const FRAME_HEIGHT = 1440

const classicStrip: Frame = {
  id: 'classic-strip',
  name: 'Classic Strip',
  creatorName: 'Official',
  isOfficial: true,
  tags: ['official', 'classic', 'strip'],
  usageCount: 1200,
  likes: 420,
  width: FRAME_WIDTH,
  height: FRAME_HEIGHT,
  canvasWidth: FRAME_WIDTH,
  canvasHeight: FRAME_HEIGHT,
  photoSlots: [
    { photoIndex: 0, x: 140, y: 110, width: 800, height: 250, fit: 'cover' },
    { photoIndex: 1, x: 140, y: 410, width: 800, height: 250, fit: 'cover' },
    { photoIndex: 2, x: 140, y: 710, width: 800, height: 250, fit: 'cover' },
    { photoIndex: 3, x: 140, y: 1010, width: 800, height: 250, fit: 'cover' }
  ],
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1440"><rect x="40" y="40" width="1000" height="1360" rx="18" fill="none" stroke="rgba(26,26,26,0.8)" stroke-width="8"/><line x1="140" y1="390" x2="940" y2="390" stroke="rgba(26,26,26,0.8)" stroke-width="4"/><line x1="140" y1="690" x2="940" y2="690" stroke="rgba(26,26,26,0.8)" stroke-width="4"/><line x1="140" y1="990" x2="940" y2="990" stroke="rgba(26,26,26,0.8)" stroke-width="4"/></svg>'
}

const doublePortrait: Frame = {
  id: 'double-portrait',
  name: 'Double Portrait',
  creatorName: 'Studio',
  isOfficial: false,
  tags: ['portrait', 'duo', 'side-by-side'],
  usageCount: 430,
  likes: 180,
  width: FRAME_WIDTH,
  height: FRAME_HEIGHT,
  canvasWidth: FRAME_WIDTH,
  canvasHeight: FRAME_HEIGHT,
  photoSlots: [
    { photoIndex: 0, x: 80, y: 120, width: 430, height: 1180, fit: 'cover' },
    { photoIndex: 1, x: 570, y: 120, width: 430, height: 1180, fit: 'cover' }
  ],
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1440"><rect x="40" y="40" width="1000" height="1360" rx="18" fill="none" stroke="rgba(26,26,26,0.8)" stroke-width="8"/><line x1="540" y1="80" x2="540" y2="1360" stroke="rgba(26,26,26,0.7)" stroke-width="3"/></svg>'
}

const editorial: Frame = {
  id: 'editorial',
  name: 'Editorial',
  creatorName: 'Official',
  isOfficial: true,
  tags: ['editorial', 'magazine', 'collage'],
  usageCount: 810,
  likes: 340,
  width: FRAME_WIDTH,
  height: FRAME_HEIGHT,
  canvasWidth: FRAME_WIDTH,
  canvasHeight: FRAME_HEIGHT,
  photoSlots: [
    { photoIndex: 0, x: 110, y: 90, width: 860, height: 700, fit: 'cover' },
    { photoIndex: 1, x: 110, y: 860, width: 360, height: 360, fit: 'cover' },
    { photoIndex: 2, x: 510, y: 860, width: 460, height: 360, fit: 'cover' }
  ],
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1440"><rect x="40" y="40" width="1000" height="1360" rx="18" fill="none" stroke="rgba(26,26,26,0.8)" stroke-width="8"/><line x1="110" y1="840" x2="970" y2="840" stroke="rgba(26,26,26,0.75)" stroke-width="4"/><line x1="490" y1="840" x2="490" y2="1240" stroke="rgba(26,26,26,0.7)" stroke-width="3"/></svg>'
}

const fourGrid: Frame = {
  id: 'four-grid',
  name: 'Four Grid',
  creatorName: 'Crew',
  isOfficial: false,
  tags: ['grid', 'square', '4-up'],
  usageCount: 620,
  likes: 240,
  width: FRAME_WIDTH,
  height: FRAME_HEIGHT,
  canvasWidth: FRAME_WIDTH,
  canvasHeight: FRAME_HEIGHT,
  photoSlots: [
    { photoIndex: 0, x: 100, y: 130, width: 370, height: 470, fit: 'cover' },
    { photoIndex: 1, x: 610, y: 130, width: 370, height: 470, fit: 'cover' },
    { photoIndex: 2, x: 100, y: 700, width: 370, height: 470, fit: 'cover' },
    { photoIndex: 3, x: 610, y: 700, width: 370, height: 470, fit: 'cover' }
  ],
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1440"><rect x="40" y="40" width="1000" height="1360" rx="18" fill="none" stroke="rgba(26,26,26,0.8)" stroke-width="8"/><line x1="540" y1="90" x2="540" y2="1350" stroke="rgba(26,26,26,0.7)" stroke-width="3"/><line x1="90" y1="660" x2="990" y2="660" stroke="rgba(26,26,26,0.7)" stroke-width="3"/></svg>'
}

export const sampleFrames: Frame[] = [classicStrip, doublePortrait, editorial, fourGrid]
