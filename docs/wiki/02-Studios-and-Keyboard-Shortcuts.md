# 02 — The 9 Studios, Accessibility & Keyboard/Vim Shortcuts

Drive Therapy organizes Google Workspace and local media management into **9 specialized studios**, accessible from the top navigation ribbon, the bottom MiniDock, or keyboard shortcuts.

---

## 1. The 9 Studios

1. **File Manager (`FileManagerView.tsx`)**
   - Browse Google Drive folders, Google Photos/Takeout archives, and local host directories (`/api/fs/*` on loopback).
   - Inspect EXIF/file metadata, run tokenized batch renamer recipes (`{date}_{camera}_{seq:001}`), or batch-export watermarked/metadata-scrubbed ZIP archives.
2. **Culling Room (`CullingRoomView.tsx`)**
   - Rapidly triage large shoots or document batches with one-key Pick (`P`), Reject (`X`), Unrate (`U`), and 1–5 Star ratings.
   - Automatically groups burst captures and near-duplicates using offline 64-bit perceptual dHash similarity (`vision.worker.ts`) and exports Adobe-compatible `.xmp` sidecars.
3. **Pixel Editor (`PixelEditorView.tsx`)**
   - Non-destructive Canvas/WebGL LUT color grading, exposure/contrast/saturation sliders, live RGB histograms, and aspect-ratio smart cropping.
4. **AI Vision Lab (`AiVisionLabView.tsx`)**
   - Local OCR text extraction (`tesseract.js`), offline sharpness/exposure quality scoring, face grouping, and optional Gemini AI semantic analysis when `GEMINI_API_KEY` is configured.
5. **Portfolio Maker (`PortfolioMakerView.tsx`)**
   - Assemble curated picks into client review galleries and export standalone interactive HTML lookbooks.
6. **Slideshow Theater (`SlideshowTheaterView.tsx`)**
   - Full-screen presentation theater with synchronized background audio and adjustable transition timing.
7. **World Map (`WorldMapView.tsx`)**
   - Interactive Leaflet geospatial map plotting GPS EXIF coordinates from your photo and Takeout catalog.
8. **Music & Universal Media Studio (`src/components/music/`)**
   - Stream audio and video tracks directly from Google Drive (`/api/drive/stream/:fileId` HTTP 206 byte-range proxy) or local disk with a 3-band Web Audio equalizer, synchronized `.lrc` lyrics, per-account playlists, and Picture-in-Picture (PiP) support.
9. **Cloud Power Suite (`CloudPowerSuitePanel.tsx`)**
   - Multi-cloud connector hub, Client-Side Zero-Knowledge AES-256-GCM Vault, CDC Delta Sync & Time-Machine, CRDT Conflict Solver, Hero Links, Unified DLP, OpenSharing v1, and the 4-Tier Malware Scanner.

---

## 2. Keyboard & Procedural Vim Shortcuts

| Key / Chord | Action | Context |
| :--- | :--- | :--- |
| `j` / `ArrowDown` / `ArrowRight` | Move selection to next asset | File Manager / Culling Room (Vim Mode) |
| `k` / `ArrowUp` / `ArrowLeft` | Move selection to previous asset | File Manager / Culling Room (Vim Mode) |
| `gg` | Jump to first asset in catalog | File Manager / Culling Room (Vim Mode) |
| `G` | Jump to last asset in catalog | File Manager / Culling Room (Vim Mode) |
| `y` | Yank active asset cloud link or file path to clipboard | File Manager / Culling Room (Vim Mode) |
| `P` / `X` / `U` | Mark asset as **Picked**, **Rejected**, or **Unrated** | Culling Room / Lightbox |
| `1` – `5` | Assign 1 to 5 Star rating | Culling Room / Lightbox |
| `Shift + B` | Toggle Butler Concierge & Multi-Account Switcher | Global |
| `/` or `Ctrl/Cmd + K` | Focus Central Omnibox (`@`, `/`, `!` commands & Drive search) | Global |

---

## 3. Accessibility & Sensory Comfort (WCAG 2.2 AAA Target)

- **52 Curated Themes**: Includes dedicated **High Contrast (AAA >= 7:1)**, **Warm Low-Glare (Dyslexia-Friendly)**, and authentic Google Workspace product themes.
- **Sensory Controls**: Toggle dyslexia-friendly typography, calm/reduced motion, scalable UI font sizes, and `>= 44x44 CSS px` interactive touch/click targets in the Accessibility Control Modal.
- **20 Languages**: Full UI translation parity across 20 languages, including right-to-left (RTL) layout support for Arabic (`ar`) and Hebrew (`he`).
