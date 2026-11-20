/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drive Therapy Codex Knowledge Base
 * Feature Walkthroughs, FAQ, Glossary, Use Cases, and Semantic Area Help Topics.
 */

export type CodexCategory = 'walkthroughs' | 'faq' | 'glossary' | 'use-cases';

export type CodexTopicId =
  | 'header-omnibox'
  | 'quick-access'
  | 'left-rail'
  | 'map-studio'
  | 'local-models'
  | 'api-status'
  | 'non-destructive'
  | 'gcomms';

export interface CodexEntry {
  id: string;
  topicId?: CodexTopicId;
  category: CodexCategory;
  title: string;
  shortTooltip: string;
  summary: string;
  bullets: string[];
  shortcut?: string;
  hasMoreInCodex?: boolean;
}

export const CODEX_ENTRIES: CodexEntry[] = [
  // Walkthroughs
  {
    id: 'wt-header-omnibox',
    topicId: 'header-omnibox',
    category: 'walkthroughs',
    title: 'Header, OAuth Wizard, Diagnostics & G. Comms',
    shortTooltip: 'Manage Google Drive sign-in, OAuth setup, API status, Tour mode, and G. Comms.',
    summary:
      'The top header keeps identity, OAuth setup (Wand), API Status & Diagnostics (Key), Settings, Tour Mode (Rocket), Codex (?), and G. Comms one click away — both before and after signing in.',
    bullets: [
      'Click Connect Drive for PKCE OAuth sign-in, or use the Wand icon for step-by-step Google Cloud setup.',
      'Click the Key icon anytime to inspect token TTL, live server/Ollama probes, and $0 Workspace APIs.',
      'Click the Rocket icon to launch the Interactive Studio Tour, or (?) to search the Codex.',
    ],
    shortcut: 'Ctrl+K (Search) · ? (Shortcuts)',
    hasMoreInCodex: true,
  },
  {
    id: 'wt-quick-access',
    topicId: 'quick-access',
    category: 'walkthroughs',
    title: 'Quick Access Toolbar, Scans & Studio Tools',
    shortTooltip: 'Run Quick 300 or Deep Scans, filter by media type, and open Studio Tools.',
    summary:
      'The Quick Access bar places 1-click Google Drive scanning (Quick 300 & Deep Scan) on the left, live category filter pills in the center, and the Studio Tools menu (Display Profile, QA Logs, Format DB) on the right.',
    bullets: [
      'Quick 300 indexes your latest 300 Drive items in seconds; Deep Scan pages your entire Drive.',
      'Click any media category pill (Images, RAW, Videos, Audio, Archives, Docs) to filter without losing search.',
      'Open Tools for Display Profile scaling, QA Diagnostics Logs, and the 310-Format Registry.',
    ],
    hasMoreInCodex: true,
  },
  {
    id: 'wt-left-rail',
    topicId: 'left-rail',
    category: 'walkthroughs',
    title: 'Unified Left Rail & Collapsible Storage Drawer',
    shortTooltip: 'Switch between Drive, Photos, Local OS, Studios, Folders Drawer (B), and Workspace Hub.',
    summary:
      'A single 64px left rail (expandable to 224px) hosts your Drive Connection dot + % quota badge, all 9 Studio views, the Folders & Storage Drawer toggle (B), and Google Workspace Hub.',
    bullets: [
      'Expanding the rail or Storage Drawer smoothly glides the floating G. Comms gemstone out of the way.',
      'Press B anytime to toggle the Folders & Storage directory drawer.',
    ],
    shortcut: 'B (Toggle Folders Drawer)',
    hasMoreInCodex: true,
  },
  {
    id: 'wt-map-studio',
    topicId: 'map-studio',
    category: 'walkthroughs',
    title: 'Multi-Provider Map Studio & Spatial Data Loader',
    shortTooltip: 'Switch between Google Maps & FOSS OSM/Carto/Topo and load GeoJSON/GPX/KML/CSV layers.',
    summary:
      'World Map Studio automatically loads Google Maps when a key is present or FOSS OpenStreetMap/Carto/OpenTopoMap with zero keys, and lets you overlay GeoJSON, GPX, KML, and CSV datasets from Local Disk, Drive, or HTTPS URLs.',
    bullets: [
      'Switch tile providers live in the top bar (Google Maps, OSM, Carto Light/Dark, OpenTopoMap, Offline Vector).',
      'Click Load Map Data to import .geojson, .gpx, .kml, or geotagged .csv tracks and waypoints.',
    ],
    hasMoreInCodex: true,
  },
  {
    id: 'wt-local-models',
    topicId: 'local-models',
    category: 'walkthroughs',
    title: '2-Click Local CPU Mini-Models (Zero-Cost)',
    shortTooltip: 'Set a models folder and install/uninstall optional WASM or Ollama CPU models in 2 clicks.',
    summary:
      'Run OCR, text summaries, image captions, code helpers, and audio transcription at $0 on low-end CPUs using lazy-loaded WASM models (Tesseract.js, SmolLM2, ViT-GPT2, Whisper-tiny) or local Ollama models.',
    bullets: [
      'Step 1: Choose or confirm your local models folder in Settings.',
      'Step 2: Check only the models you want (exact MB sizes and With/Without trade-offs shown) and click Download & Setup.',
      'Click Uninstall Models anytime to remove manifest-tracked files cleanly.',
    ],
    hasMoreInCodex: true,
  },
  {
    id: 'wt-gcomms',
    topicId: 'gcomms',
    category: 'walkthroughs',
    title: 'Gemstone G. Comms & Butler Concierge',
    shortTooltip: 'Floating translucent gemstone chat bubble: click to open, drag to move, right-click to cycle gem.',
    summary:
      'G. Comms unifies Gemini AI Copilot, Google Chat, and Google Workspace actions in one slide-over drawer, anchored by an action-reactive faceted gemstone bubble.',
    bullets: [
      'Gemstone color shifts automatically: Diamond (idle), Sapphire (Gemini), Emerald (Chat), Amber (scanning), Amethyst (culling/photos).',
      'Drag anywhere to reposition; double-click to snap back to default.',
    ],
    hasMoreInCodex: true,
  },

  // FAQ
  {
    id: 'faq-non-destructive',
    topicId: 'non-destructive',
    category: 'faq',
    title: 'Does Drive Therapy ever modify my original Drive or local files?',
    shortTooltip: '100% non-destructive: edits, ratings, and tags live in IndexedDB & sidecars.',
    summary:
      'Never automatically. All picks/rejects, star ratings, face labels, LUT grades, and search indices are stored in IndexedDB (drive_therapy_catalog_v2) or non-destructive XMP sidecars. Any destructive purge requires explicit DestructiveActionDialog confirmation.',
    bullets: [
      'Original cloud and local files remain untouched.',
      'Exports always write new copies (ZIP, HTML Portfolio, XMP, or trimmed clips).',
    ],
    hasMoreInCodex: true,
  },
  {
    id: 'faq-billing',
    topicId: 'api-status',
    category: 'faq',
    title: 'Do I need Google Workspace Business, Google AI Pro, or Cloud Billing?',
    shortTooltip: 'No Cloud Billing is needed for Drive, Photos, Picker, Docs/Sheets/Slides, Tasks, Calendar, or Local CPU AI.',
    summary:
      'No. Drive API v3, Google Picker, Photos, Docs/Sheets/Slides export, Tasks, Calendar, People/Contacts, Gmail, FOSS OpenStreetMap, and Local CPU WASM/Ollama models all run at $0 with no Cloud Billing account.',
    bullets: [
      'Check Settings / Key Icon -> API Status & Free Services for your live account tier and $0 vs. optional billing badges.',
      'Google Maps JS API and Cloud Vision/GCS are strictly optional and fall back cleanly to FOSS/local alternatives.',
    ],
    hasMoreInCodex: true,
  },
  {
    id: 'faq-loopback',
    category: 'faq',
    title: 'How is local OS filesystem access secured?',
    shortTooltip: 'All /api/fs/* and /api/models/* routes strictly enforce isLoopbackRequest(req).',
    summary:
      'Host filesystem and local model endpoints only accept requests originating from 127.0.0.1 / ::1 loopback addresses, and remote map URL fetches enforce HTTPS-only + private-IP SSRF blocking.',
    bullets: [
      'Remote network clients cannot read host OS folders.',
      'OAuth tokens are stored via PKCE with no plaintext client secrets in browser code.',
    ],
  },

  // Glossary
  {
    id: 'gl-dhash',
    category: 'glossary',
    title: 'Perceptual dHash & Burst Clustering',
    shortTooltip: 'Fast 64-bit visual fingerprint used to group near-duplicate shots.',
    summary:
      'Difference Hash (dHash) computes a compact gradient fingerprint in vision.worker.ts to cluster bursts (<=3.5s) and near-duplicates (Hamming distance <=6) completely offline.',
    bullets: ['Runs in a pure TypeScript Web Worker with zero network calls.'],
  },
  {
    id: 'gl-lut',
    category: 'glossary',
    title: '3D .CUBE LUT & Non-Destructive Grading',
    shortTooltip: 'Color lookup table applied in real-time Canvas/WebGL without altering source RAW/JPEG.',
    summary:
      'Drive Therapy parses industry-standard .CUBE 3D lookup tables and renders film-stock color grades in real time inside the Photo Editor.',
    bullets: ['Export graded copies via Batch Exporter while preserving original masters.'],
  },
  {
    id: 'gl-changes-api',
    category: 'glossary',
    title: 'Google Drive Changes API (startPageToken)',
    shortTooltip: 'Incremental delta-sync cursor for <500ms Drive catalog updates.',
    summary:
      'Instead of rescanning every folder, Drive Therapy saves a startPageToken cursor and fetches only files added, renamed, or trashed since the last sync.',
    bullets: ['Dramatically reduces API quota usage and sync wait times.'],
  },

  // Use Cases
  {
    id: 'uc-photographer',
    category: 'use-cases',
    title: 'Event & Editorial Photographer Culling',
    shortTooltip: 'Index thousands of RAW/JPEG shots, cluster bursts, cull with P/X, and export client portfolios.',
    summary:
      'Connect Google Drive or mount a local SD card folder, let vision.worker.ts score sharpness and group bursts, triage rapidly with P (Pick) / X (Reject) / 1-5 stars, and export a standalone interactive HTML portfolio.',
    bullets: ['Works 100% offline in the field with zero API keys.'],
  },
  {
    id: 'uc-cartographer',
    category: 'use-cases',
    title: 'Field Cartography & Geotagged Archive',
    shortTooltip: 'Overlay GPX trails, KML boundaries, and geotagged photos on OSM/Topo/Google Maps.',
    summary:
      'Combine EXIF-geotagged photos with .GPX hike logs or .GeoJSON survey boundaries inside World Map Studio, and inspect .HGT/.DEM elevation profiles in NativeHeightmapMapViewer.',
    bullets: ['Switch seamlessly between OpenTopoMap, Carto Dark, and Google Maps Satellite.'],
  },
  {
    id: 'uc-airgapped',
    category: 'use-cases',
    title: 'Low-End Laptop Offline / Air-Gapped Review',
    shortTooltip: 'Zero-cost CPU OCR, summaries, and semantic search on 4–8GB RAM hardware.',
    summary:
      'Enable only the 12 MB Tesseract OCR or 95 MB SmolLM2 WASM mini-models in Settings to extract receipt text and summarize docs offline without GPU hardware or cloud subscriptions.',
    bullets: ['Uninstall in 1 click whenever you want to reclaim disk space.'],
  },
];

export function getCodexTopicById(topicId: CodexTopicId): CodexEntry {
  return CODEX_ENTRIES.find((e) => e.topicId === topicId) || CODEX_ENTRIES[0];
}

export function searchCodexEntries(query: string, category?: CodexCategory | 'all'): CodexEntry[] {
  const q = query.trim().toLowerCase();
  return CODEX_ENTRIES.filter((entry) => {
    if (category && category !== 'all' && entry.category !== category) return false;
    if (!q) return true;
    return (
      entry.title.toLowerCase().includes(q) ||
      entry.summary.toLowerCase().includes(q) ||
      entry.shortTooltip.toLowerCase().includes(q) ||
      entry.bullets.some((b) => b.toLowerCase().includes(q))
    );
  });
}
