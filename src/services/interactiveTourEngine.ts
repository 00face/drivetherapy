/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Interactive App Tour, Guides & Studio Walkthroughs Engine
 */

export interface TourStep {
  id: string;
  title: string;
  description: string;
  shortcut?: string;
  actionLabel?: string;
  targetAction?: 'omnibox' | 'music' | 'workspace' | 'photos' | 'oauth' | 'shortcuts' | 'map' | 'settings' | 'gcomms';
}

export interface TourTrack {
  id: 'studio-tour' | 'google-ecosystem-guide' | 'tv-a11y-pro-guide';
  title: string;
  subtitle: string;
  steps: TourStep[];
}

export interface TourProgress {
  completedTracks: string[];
  lastTrackId: string;
  lastStepIndex: number;
}

const PROGRESS_KEY = 'dt_tour_progress_v1';

export const TOUR_TRACKS: TourTrack[] = [
  {
    id: 'studio-tour',
    title: 'Quick Studio Tour',
    subtitle: 'Master search, culling, visualizers & multi-format editing in 4 steps',
    steps: [
      {
        id: 'omnibox-search',
        title: 'Cloud Console Universal Search & Atomic Filters',
        description:
          'Search everything—indexed local/cloud files, app features, settings, and 310 file formats—with atomic filters like source:drive ext:mp4 rating:>=4.',
        shortcut: 'Ctrl+K or /',
        actionLabel: 'Focus Search Bar',
        targetAction: 'omnibox',
      },
      {
        id: 'media-visualizers',
        title: 'Media Player Theater & 5-Mode FFT Visualizers',
        description:
          'Play audio & video with 5 live Web Audio visualizers (Spectrum, Radial, Waveform, Mirror, Ambient), 3-band EQ, LRC lyrics, and fullscreen Theater HUD.',
        shortcut: 'V (Visualizer) · F (Fullscreen)',
        actionLabel: 'Open Media Studio',
        targetAction: 'music',
      },
      {
        id: 'photos-picker',
        title: 'Google Photos 2,000-Item Picker & Albums',
        description:
          'Select up to 2,000 photos/videos or entire albums in a single Google Photos Picker session with automatic multi-page pagination.',
        actionLabel: 'Open Google Photos',
        targetAction: 'photos',
      },
      {
        id: 'non-destructive',
        title: 'Non-Destructive Curation & Exports',
        description:
          'Mark Picks (P) and Rejects (X), grade with LUTs, or generate HTML/NotebookLM dossiers without ever altering your original cloud or local files.',
        shortcut: 'P / X / ?',
        actionLabel: 'View All Shortcuts',
        targetAction: 'shortcuts',
      },
      {
        id: 'map-studio-data',
        title: 'Multi-Provider Map Studio & Spatial Data Loader',
        description:
          'Auto-loads Google Maps (when keyed) or FOSS OpenStreetMap, Carto, and OpenTopoMap, plus GeoJSON, GPX, KML, and CSV layers from Drive, Disk, or HTTPS URLs.',
        actionLabel: 'Open Map Studio',
        targetAction: 'map',
      },
      {
        id: 'gemstone-gcomms',
        title: 'Gemstone G. Comms & 2-Click Local CPU Models',
        description:
          'Drag the translucent gemstone G. Comms icon anywhere (double-click to reset, right-click to cycle gem colors), and set up zero-cost CPU models in 2 clicks inside Settings.',
        actionLabel: 'Open G. Comms',
        targetAction: 'gcomms',
      },
    ],
  },
  {
    id: 'google-ecosystem-guide',
    title: 'Google Workspace & Cloud Guide',
    subtitle: 'One single sign-in with on-demand Workspace apps & AI assist',
    steps: [
      {
        id: 'single-signin',
        title: 'Single-Sign-In OAuth & Incremental Scopes',
        description:
          'Sign in once cleanly with Drive, Photos, and Cloud Storage. Grant optional Gmail, Tasks, Contacts, or Classroom permissions on demand without Error 400.',
        actionLabel: 'Open OAuth Wizard',
        targetAction: 'oauth',
      },
      {
        id: 'workspace-hub',
        title: 'Keep Notes, Gmail, Tasks, Classroom & GCS',
        description:
          'Browse Keep notes, extract Gmail media attachments, inspect Classroom materials, stream private GCS buckets, and use AI Tasks / AI Draft / AI Course Brief.',
        actionLabel: 'Open Workspace Hub',
        targetAction: 'workspace',
      },
    ],
  },
  {
    id: 'tv-a11y-pro-guide',
    title: 'TV, Touch & Accessibility Guide',
    subtitle: '10-Foot TV D-pad mode, touch targets, 52 themes & 20 languages',
    steps: [
      {
        id: 'adaptive-display',
        title: 'Touch, Large-Format 4K & 10-Foot TV Mode',
        description:
          'Switch between Auto, Compact Touch, Desktop, Large Format, and 10-Foot TV Display in Settings or Search for overscan-safe 3vw padding and 18px base type.',
        shortcut: 'Arrow Keys (D-Pad)',
      },
      {
        id: 'wcag-aaa',
        title: 'WCAG AAA Focus, Calm Motion & 20 Languages',
        description:
          'All interactive controls maintain >=44x44px targets, 2px+ focus rings, High Contrast AAA & Dyslexia presets, and instant switching across 20 global languages.',
      },
    ],
  },
];

export function loadTourProgress(): TourProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        completedTracks: Array.isArray(parsed.completedTracks) ? parsed.completedTracks : [],
        lastTrackId: typeof parsed.lastTrackId === 'string' ? parsed.lastTrackId : 'studio-tour',
        lastStepIndex: typeof parsed.lastStepIndex === 'number' ? parsed.lastStepIndex : 0,
      };
    }
  } catch {}
  return { completedTracks: [], lastTrackId: 'studio-tour', lastStepIndex: 0 };
}

export function saveTourProgress(progress: TourProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {}
}

export function markTrackCompleted(trackId: string): TourProgress {
  const current = loadTourProgress();
  const completedTracks = current.completedTracks.includes(trackId)
    ? current.completedTracks
    : [...current.completedTracks, trackId];
  const next = { ...current, completedTracks };
  saveTourProgress(next);
  return next;
}
