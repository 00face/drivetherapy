/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Cloud Console-Style Universal Search & Atomic Filter Engine
 * Searches indexed files, cloud data, app features, settings, formats, and guides.
 */

import type { MediaAsset } from '../types';
import { searchFormatDatabase } from './fileFormatEngine';

export type UniversalResultKind =
  | 'feature'
  | 'setting'
  | 'view'
  | 'workspace'
  | 'guide'
  | 'format'
  | 'file'
  | 'note'
  | 'task'
  | 'contact';

export interface ParsedAtomicQuery {
  freeText: string;
  type?: string;
  source?: string;
  category?: string;
  ext?: string;
  status?: string;
  minRating?: number;
  tag?: string;
  minSizeBytes?: number;
  maxSizeBytes?: number;
  tokens: Array<{ raw: string; key: string; value: string }>;
}

export interface UniversalSearchResult {
  id: string;
  kind: UniversalResultKind;
  group: 'top' | 'resource';
  title: string;
  subtitle: string;
  badge: string;
  actionId: string;
  asset?: MediaAsset;
  score: number;
}

export interface UniversalSearchResponse {
  topResults: UniversalSearchResult[];
  resources: UniversalSearchResult[];
  totalResources: number;
  parsed: ParsedAtomicQuery;
}

function parseSizeValue(raw: string): number | undefined {
  const m = raw.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = m[2] || 'b';
  const mult = unit === 'gb' ? 1024 ** 3 : unit === 'mb' ? 1024 ** 2 : unit === 'kb' ? 1024 : 1;
  return n * mult;
}

export function parseAtomicSearchQuery(rawQuery: string): ParsedAtomicQuery {
  const tokens: Array<{ raw: string; key: string; value: string }> = [];
  const freeParts: string[] = [];

  const parsed: ParsedAtomicQuery = {
    freeText: '',
    tokens,
  };

  for (const part of (rawQuery || '').trim().split(/\s+/).filter(Boolean)) {
    const colonIdx = part.indexOf(':');
    if (colonIdx > 0) {
      const key = part.slice(0, colonIdx).toLowerCase();
      const val = part.slice(colonIdx + 1).trim();
      const lowerVal = val.toLowerCase();
      if (['type', 'source', 'cat', 'category', 'ext', 'status', 'rating', 'tag', 'size'].includes(key) && val) {
        tokens.push({ raw: part, key, value: val });
        if (key === 'type') parsed.type = lowerVal;
        else if (key === 'source') parsed.source = lowerVal;
        else if (key === 'cat' || key === 'category') parsed.category = lowerVal;
        else if (key === 'ext') parsed.ext = lowerVal.replace(/^\./, '');
        else if (key === 'status') parsed.status = lowerVal;
        else if (key === 'tag') parsed.tag = lowerVal;
        else if (key === 'rating') {
          const numMatch = lowerVal.match(/(\d+(?:\.\d+)?)/);
          if (numMatch) parsed.minRating = Number(numMatch[1]);
        } else if (key === 'size') {
          if (lowerVal.startsWith('>')) parsed.minSizeBytes = parseSizeValue(lowerVal.slice(1));
          else if (lowerVal.startsWith('<')) parsed.maxSizeBytes = parseSizeValue(lowerVal.slice(1));
        }
        continue;
      }
    }
    freeParts.push(part);
  }

  parsed.freeText = freeParts.join(' ').toLowerCase();
  return parsed;
}

const STATIC_CONSOLE_ITEMS: Array<{
  id: string;
  kind: UniversalResultKind;
  title: string;
  subtitle: string;
  badge: string;
  actionId: string;
  keywords: string;
}> = [
  { id: 'view:files', kind: 'view', title: 'Files & Cloud Catalog', subtitle: 'View · Browse Drive & Local assets', badge: 'View', actionId: 'view:files', keywords: 'files drive catalog browse grid' },
  { id: 'view:photos', kind: 'view', title: 'Google Photos Studio', subtitle: 'View · 2,000-item Picker, Albums & Takeout', badge: 'View', actionId: 'view:photos', keywords: 'photos picker albums takeout' },
  { id: 'view:culling', kind: 'view', title: 'Culling Room', subtitle: 'View · Pick (P), Reject (X), Stars & Bursts', badge: 'View', actionId: 'view:culling', keywords: 'culling pick reject rating bursts' },
  { id: 'view:local', kind: 'view', title: 'Local OS File Manager', subtitle: 'View · Host disk browser & Delta Scan', badge: 'View', actionId: 'view:local', keywords: 'local disk folder delta scan' },
  { id: 'view:map', kind: 'view', title: 'EXIF Geo-Map Explorer', subtitle: 'View · GPS coordinates & shoot locations', badge: 'View', actionId: 'view:map', keywords: 'map gps geo exif location' },
  { id: 'view:compare', kind: 'view', title: 'Side-by-Side Compare', subtitle: 'View · Dual frame sharpness comparison', badge: 'View', actionId: 'view:compare', keywords: 'compare side by side dual' },
  { id: 'view:slideshow', kind: 'view', title: 'Theater Slideshow', subtitle: 'View · Fullscreen presentation playback', badge: 'View', actionId: 'view:slideshow', keywords: 'slideshow theater fullscreen' },
  { id: 'feature:music', kind: 'feature', title: 'Media Player & 5-Mode Visualizers', subtitle: 'Feature · Audio/Video, EQ, Lyrics & Theater', badge: 'Studio', actionId: 'modal:music', keywords: 'music player video visualizer spectrum radial waveform mirror ambient eq lyrics' },
  { id: 'feature:workspace', kind: 'workspace', title: 'Google Workspace Hub', subtitle: 'Workspace · Keep, Gmail, Tasks, Contacts, Classroom, GCS', badge: 'Workspace', actionId: 'modal:workspace', keywords: 'workspace keep gmail tasks contacts classroom gcs buckets' },
  { id: 'feature:tour', kind: 'guide', title: 'Interactive App Tour & Guides', subtitle: 'Guide · Walkthroughs, Cloud & TV/A11y guides', badge: 'Guide', actionId: 'modal:tour', keywords: 'tour guide walkthrough help onboarding tutorial' },
  { id: 'feature:oauth', kind: 'setting', title: 'Google OAuth 2.0 Setup Wizard', subtitle: 'Auth · Single Sign-In & Custom Credentials', badge: 'Auth', actionId: 'modal:oauth', keywords: 'oauth login signin scopes credentials client id' },
  { id: 'feature:butler', kind: 'feature', title: 'Butler Concierge Service Mesh', subtitle: 'Feature · Background host orchestration', badge: 'Service', actionId: 'modal:butler', keywords: 'butler service mesh automation' },
  { id: 'feature:formats', kind: 'format', title: 'Universal Format Database (310 Formats)', subtitle: 'Registry · 720 extensions & viewers', badge: 'Registry', actionId: 'modal:formats', keywords: 'formats extensions codecs raw 3d obj lut' },
  { id: 'setting:display-tv', kind: 'setting', title: 'Display Mode: 10-Foot TV (D-Pad UI)', subtitle: 'Setting · Overscan-safe 18px TV typography', badge: 'Display', actionId: 'display:tv-tenfoot', keywords: 'tv tenfoot television display mode dpad remote overscan' },
  { id: 'setting:display-large', kind: 'setting', title: 'Display Mode: Large Format / 4K', subtitle: 'Setting · Wide theater split layouts', badge: 'Display', actionId: 'display:large-format', keywords: 'large format 4k ultrawide monitor display' },
  { id: 'setting:display-touch', kind: 'setting', title: 'Display Mode: Compact Touch', subtitle: 'Setting · Coarse-pointer mobile/tablet controls', badge: 'Display', actionId: 'display:compact-touch', keywords: 'touch tablet phone mobile compact' },
  { id: 'setting:display-auto', kind: 'setting', title: 'Display Mode: Auto Detect (UA & Viewport)', subtitle: 'Setting · Adaptive browser & screen detection', badge: 'Display', actionId: 'display:auto', keywords: 'auto detect display user agent responsive' },
  { id: 'setting:settings', kind: 'setting', title: 'Studio Settings, Themes (52) & Languages (20)', subtitle: 'Setting · Theme Engine, i18n, Calm Motion & Dyslexia', badge: 'Settings', actionId: 'modal:settings', keywords: 'settings themes colors language i18n accessibility dyslexia calm motion' },
  { id: 'setting:shortcuts', kind: 'guide', title: 'Keyboard Shortcuts & Vim Reference', subtitle: 'Guide · Hotkeys, Vim j/k/gg/G & D-Pad', badge: 'Hotkeys', actionId: 'modal:shortcuts', keywords: 'shortcuts hotkeys keyboard vim navigation' },
  { id: 'setting:diagnostics', kind: 'setting', title: 'Auth & System Diagnostics', subtitle: 'Setting · Token scopes & server health', badge: 'Diagnostics', actionId: 'modal:diagnostics', keywords: 'diagnostics health token scopes debug' },
];

export function searchUniversalConsole(
  rawQuery: string,
  context: {
    assets: MediaAsset[];
    keepNotes?: Array<{ id: string; title: string; body: string }>;
    tasks?: Array<{ id: string; title: string; status: string }>;
    contacts?: Array<{ resourceName: string; name: string; email: string }>;
    resourceLimit?: number;
  }
): UniversalSearchResponse {
  const parsed = parseAtomicSearchQuery(rawQuery);
  const q = parsed.freeText;
  const topResults: UniversalSearchResult[] = [];
  const resources: UniversalSearchResult[] = [];

  const allowTop =
    !parsed.source &&
    !parsed.ext &&
    !parsed.status &&
    parsed.minRating === undefined &&
    (!parsed.type || ['feature', 'setting', 'view', 'workspace', 'guide', 'format'].includes(parsed.type));

  if (allowTop) {
    for (const item of STATIC_CONSOLE_ITEMS) {
      if (parsed.type && item.kind !== parsed.type) continue;
      const hay = `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase();
      if (!q || hay.includes(q)) {
        const titleMatch = q && item.title.toLowerCase().includes(q) ? 20 : 0;
        topResults.push({
          id: item.id,
          kind: item.kind,
          group: 'top',
          title: item.title,
          subtitle: item.subtitle,
          badge: item.badge,
          actionId: item.actionId,
          score: 50 + titleMatch,
        });
      }
    }

    if (q && (!parsed.type || parsed.type === 'format')) {
      for (const fmt of searchFormatDatabase(q).slice(0, 6)) {
        topResults.push({
          id: `fmt:${fmt.extension}`,
          kind: 'format',
          group: 'top',
          title: `${fmt.name} (.${fmt.extension})`,
          subtitle: `Format · ${fmt.category} · ${fmt.mimeTypes?.[0] || fmt.extension}`,
          badge: 'Format',
          actionId: 'modal:formats',
          score: 40,
        });
      }
    }
  }

  // Indexed & Cloud Files
  const allowFiles = !parsed.type || parsed.type === 'file';
  if (allowFiles) {
    for (const asset of context.assets || []) {
      const assetSource =
        asset.tags?.some((tg) => tg.toLowerCase() === 'gcs')
          ? 'gcs'
          : asset.tags?.some((tg) => tg.toLowerCase() === 'classroom')
          ? 'classroom'
          : asset.id.startsWith('photos_') || asset.tags?.includes('Google Photos')
          ? 'photos'
          : asset.source === 'local'
          ? 'local'
          : 'drive';

      if (parsed.source && assetSource !== parsed.source) continue;
      if (parsed.category && asset.category.toLowerCase() !== parsed.category) continue;
      if (parsed.ext && asset.extension.toLowerCase() !== parsed.ext) continue;
      if (parsed.status && asset.cullingStatus !== parsed.status) continue;
      if (parsed.minRating !== undefined && asset.rating < parsed.minRating) continue;
      if (parsed.tag && !asset.tags?.some((tg) => tg.toLowerCase().includes(parsed.tag!))) continue;
      if (parsed.minSizeBytes !== undefined && asset.sizeBytes < parsed.minSizeBytes) continue;
      if (parsed.maxSizeBytes !== undefined && asset.sizeBytes > parsed.maxSizeBytes) continue;

      const hay = `${asset.name} ${asset.path} ${asset.extension} ${(asset.tags || []).join(' ')}`.toLowerCase();
      if (!q || hay.includes(q)) {
        resources.push({
          id: `asset:${asset.id}`,
          kind: 'file',
          group: 'resource',
          title: asset.name,
          subtitle: `${assetSource.toUpperCase()} · ${asset.extension} · ${asset.path}`,
          badge: asset.rating > 0 ? `★${asset.rating}` : asset.cullingStatus,
          actionId: `asset:${asset.id}`,
          asset,
          score: q && asset.name.toLowerCase().includes(q) ? 80 : 50,
        });
      }
    }
  }

  // Workspace Keep Notes, Tasks & Contacts
  if (!parsed.type || parsed.type === 'note' || parsed.source === 'keep') {
    for (const n of context.keepNotes || []) {
      if (!q || `${n.title} ${n.body}`.toLowerCase().includes(q)) {
        resources.push({
          id: `note:${n.id}`,
          kind: 'note',
          group: 'resource',
          title: n.title,
          subtitle: `Keep Note · ${n.body.slice(0, 60)}`,
          badge: 'Keep',
          actionId: 'modal:workspace:keep',
          score: 55,
        });
      }
    }
  }

  if (!parsed.type || parsed.type === 'task' || parsed.source === 'tasks') {
    for (const task of context.tasks || []) {
      if (!q || task.title.toLowerCase().includes(q)) {
        resources.push({
          id: `task:${task.id}`,
          kind: 'task',
          group: 'resource',
          title: task.title,
          subtitle: `Google Task · ${task.status}`,
          badge: 'Task',
          actionId: 'modal:workspace:tasks',
          score: 55,
        });
      }
    }
  }

  if (!parsed.type || parsed.type === 'contact' || parsed.source === 'contacts') {
    for (const c of context.contacts || []) {
      if (!q || `${c.name} ${c.email}`.toLowerCase().includes(q)) {
        resources.push({
          id: `contact:${c.resourceName}`,
          kind: 'contact',
          group: 'resource',
          title: c.name,
          subtitle: `Contact · ${c.email}`,
          badge: 'Contact',
          actionId: 'modal:workspace:contacts',
          score: 52,
        });
      }
    }
  }

  topResults.sort((a, b) => b.score - a.score);
  resources.sort((a, b) => b.score - a.score);

  const limit = context.resourceLimit ?? 6;
  return {
    topResults: topResults.slice(0, 6),
    resources: resources.slice(0, limit),
    totalResources: resources.length,
    parsed,
  };
}
