# Photobooth (MVP)

This workspace contains a local, runnable Photobooth SPA built with React + TypeScript + Vite + Tailwind.

Features implemented (MVP):
- Project scaffold: Vite + React + TypeScript + Tailwind
- Landing, Frame Gallery (sample frames), Frame Preview (via FrameCard)
- PhotoSession persistence in `sessionStorage` via `sessionService`
- Studio: camera access, 4-shot automated capture with countdown
- Review: view 4 photos, retake individual or all
- Editor: Canvas composition, filters (original, grayscale, sepia, warm), brightness/contrast/saturation sliders
- Result: export PNG download and QR generation (data URL QR)
- Mock storage and services (storageService, frameService, qrService)

Notable files added:
- src/App.tsx — app shell and simple hash router
- src/pages/* — Landing, FrameGallery, Studio, Review, Editor, Result
- src/components/* — Header, FrameCard, CameraPreview, PhotoThumbnail
- src/services/* — sessionService, frameService (sample data), storageService (mock), qrService
- src/hooks/useSession.tsx — session hook
- src/data/sampleFrames.ts — sample frames

Run locally:

1. Install dependencies

```bash
npm install
```

2. Start dev server

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

Environment / Integration TODOs:
- Authentication integration (authService abstraction placeholder)
- Real cloud storage (S3/Cloudinary) integration behind `storageService`
- Server-side upload validation and moderation pipeline for frames
- Persist frames, likes, usage counts in a backend

UX / Feature TODOs (future phases):
- Text and stickers editor with drag/rotate/resize
- Undo/Redo history in editor
- Frame upload UI and validation (PNG transparency check)
- Accessibility polishing and keyboard navigation
- Mobile-specific UI polish and touch targets
- Expiring hosted images (24h) via backend

Notes:
- Photos are stored in `sessionStorage` (data URLs) for the MVP — this avoids backend requirements and keeps guest flow private by default.
- The QR code points to the data URL in this MVP; when real storage is added, replace with signed public URLs.
