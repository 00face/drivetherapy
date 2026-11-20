/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Castor Command Parser (`@` Mentions, `/` Slash Commands, `!` Bangs),
 * Permission-Gated Local Disk Search Client, and Live Workspace Search Clients
 * (Gmail, Calendar, Contacts).
 */

import type { MediaAsset } from '../types';
import { getDriveAccessToken } from './googleDrive';

export type CastorCommandPrefix = '@' | '/' | '!';

export interface CastorCommandDef {
  trigger: string;
  prefix: CastorCommandPrefix;
  name: string;
  usage: string;
  description: string;
}

export interface ParsedCastorCommand {
  prefix: CastorCommandPrefix | null;
  command: string;
  args: string;
  raw: string;
}

export const CASTOR_COMMAND_CATALOG: CastorCommandDef[] = [
  // @ Source & Entity Mentions
  { trigger: '@drive', prefix: '@', name: 'drive', usage: '@drive <query>', description: 'Live headless Google Drive v3 search (fullText, mime:, starred:, after:)' },
  { trigger: '@photos', prefix: '@', name: 'photos', usage: '@photos <query>', description: 'Search indexed Google Photos or launch the in-chat Photos Picker' },
  { trigger: '@gmail', prefix: '@', name: 'gmail', usage: '@gmail <query>', description: 'Live Gmail search (from:, after:, has:attachment, label:)' },
  { trigger: '@calendar', prefix: '@', name: 'calendar', usage: '@calendar <query>', description: 'Live Google Calendar event search' },
  { trigger: '@contacts', prefix: '@', name: 'contacts', usage: '@contacts <name>', description: 'Live Google Contacts People API search' },
  { trigger: '@local', prefix: '@', name: 'local', usage: '@local <query>', description: 'Live Local OS drive search (requires explicit permission)' },
  { trigger: '@index', prefix: '@', name: 'index', usage: '@index <query>', description: 'Instant LitHybridSearchIndex catalog lookup' },
  { trigger: '@selected', prefix: '@', name: 'selected', usage: '@selected <prompt>', description: 'Target the currently selected asset' },
  { trigger: '@castor', prefix: '@', name: 'castor', usage: '@castor <C-01..C-24>', description: 'Switch Castor outfit (e.g. @castor C-02)' },

  // / Slash Commands
  { trigger: '/search', prefix: '/', name: 'search', usage: '/search <query>', description: 'Federated live search across Drive, Photos, Local & Index' },
  { trigger: '/sync', prefix: '/', name: 'sync', usage: '/sync', description: 'Sync Google Drive changes into your local catalog' },
  { trigger: '/transfer', prefix: '/', name: 'transfer', usage: '/transfer', description: 'Open Multicloud Direct Cloud-to-Cloud Sync tool' },
  { trigger: '/scan', prefix: '/', name: 'scan', usage: '/scan', description: 'Run Quick 300 Google Drive scan' },
  { trigger: '/deep-scan', prefix: '/', name: 'deep-scan', usage: '/deep-scan', description: 'Run full Deep Google Drive scan' },
  { trigger: '/anime', prefix: '/', name: 'anime', usage: '/anime', description: 'Non-destructive Anime style copy of selected photo' },
  { trigger: '/watercolor', prefix: '/', name: 'watercolor', usage: '/watercolor', description: 'Non-destructive Watercolor style copy of selected photo' },
  { trigger: '/cyberpunk', prefix: '/', name: 'cyberpunk', usage: '/cyberpunk', description: 'Non-destructive Cyberpunk Neon style copy of selected photo' },
  { trigger: '/noir', prefix: '/', name: 'noir', usage: '/noir', description: 'Non-destructive Film Noir style copy of selected photo' },
  { trigger: '/sketch', prefix: '/', name: 'sketch', usage: '/sketch', description: 'Non-destructive Pencil Sketch style copy of selected photo' },
  { trigger: '/wardrobe', prefix: '/', name: 'wardrobe', usage: '/wardrobe [C-01..C-24]', description: 'Open Castor 24-outfit Wardrobe Picker or switch directly' },
  { trigger: '/storage', prefix: '/', name: 'storage', usage: '/storage', description: 'Live storage quota & provider audit' },
  { trigger: '/oauth', prefix: '/', name: 'oauth', usage: '/oauth', description: 'Inspect Google Workspace OAuth scopes & capabilities' },
  { trigger: '/clear', prefix: '/', name: 'clear', usage: '/clear', description: 'Clear Castor chat history' },
  { trigger: '/help', prefix: '/', name: 'help', usage: '/help', description: 'List all @, /, and ! commands' },

  // ! Bang Quick Actions
  { trigger: '!picker', prefix: '!', name: 'picker', usage: '!picker', description: 'Open Google Photos Picker (up to 2,000 photos per batch)' },
  { trigger: '!transfer', prefix: '!', name: 'transfer', usage: '!transfer', description: 'Launch Multicloud Sync (Photos → Drive direct pipe)' },
  { trigger: '!sync', prefix: '!', name: 'sync', usage: '!sync', description: 'Immediately sync Google Drive changes' },
  { trigger: '!mount', prefix: '!', name: 'mount', usage: '!mount', description: 'Mount a local OS folder into the catalog' },
  { trigger: '!cull', prefix: '!', name: 'cull', usage: '!cull', description: 'Open Culling Room' },
  { trigger: '!editor', prefix: '!', name: 'editor', usage: '!editor', description: 'Open selected asset in Pixel Editor' },
  { trigger: '!dossier', prefix: '!', name: 'dossier', usage: '!dossier', description: 'Open NotebookLM Dossier Compiler' },
  { trigger: '!allow-local', prefix: '!', name: 'allow-local', usage: '!allow-local', description: 'Grant Castor read-only Local OS drive search permission' },
  { trigger: '!revoke-local', prefix: '!', name: 'revoke-local', usage: '!revoke-local', description: 'Revoke Castor Local OS drive search permission' },
];

const LOCAL_SEARCH_PERM_KEY = 'dt_castor_local_search_perm_v1';

export function loadCastorLocalPermission(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(LOCAL_SEARCH_PERM_KEY) === 'granted';
  } catch {
    return false;
  }
}

export function saveCastorLocalPermission(granted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (granted) {
      localStorage.setItem(LOCAL_SEARCH_PERM_KEY, 'granted');
    } else {
      localStorage.removeItem(LOCAL_SEARCH_PERM_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function parseCastorCommand(input: string): ParsedCastorCommand {
  const raw = (input || '').trim();
  const match = raw.match(/^([@/!])([a-zA-Z0-9_-]+)(?:\s+([\s\S]*))?$/);
  if (!match) {
    return { prefix: null, command: '', args: raw, raw };
  }
  return {
    prefix: match[1] as CastorCommandPrefix,
    command: match[2].toLowerCase(),
    args: (match[3] || '').trim(),
    raw,
  };
}

export function getCommandSuggestions(input: string, limit = 8): CastorCommandDef[] {
  const trimmed = (input || '').trimStart();
  if (!trimmed || !/^[@/!]/.test(trimmed)) return [];
  // Only show autocomplete while typing the first token
  if (/\s/.test(trimmed)) return [];
  const lower = trimmed.toLowerCase();
  return CASTOR_COMMAND_CATALOG.filter(
    (c) => c.trigger.startsWith(lower) || c.name.startsWith(lower.slice(1))
  ).slice(0, limit);
}

export function formatCastorCommandsHelp(): string {
  return [
    '### Castor `@` / `/` / `!` Command Reference',
    '**`@` Source Mentions:**',
    '- `@drive <query>` — Live Drive v3 search (`mime:image/png`, `type:pdf`, `starred:true`, `shared:true`, `after:2026-01-01`)',
    '- `@photos <query>` — Search indexed Google Photos or open the in-chat Photos Picker',
    '- `@gmail <query>` — Live Gmail search (`from:`, `after:`, `has:attachment`)',
    '- `@calendar <query>` — Live Google Calendar event search',
    '- `@contacts <name>` — Live Google Contacts People API search',
    '- `@local <query>` — Live Local OS drive search (requires permission)',
    '- `@castor <C-01..C-24>` — Switch Castor outfit',
    '',
    '**`/` Slash Commands:**',
    '- `/search <query>`, `/sync`, `/transfer`, `/scan`, `/deep-scan`, `/anime`, `/watercolor`, `/cyberpunk`, `/noir`, `/sketch`, `/wardrobe`, `/storage`, `/oauth`, `/clear`',
    '',
    '**`!` Instant Actions:**',
    '- `!picker`, `!transfer`, `!sync`, `!mount`, `!cull`, `!editor`, `!dossier`, `!allow-local`, `!revoke-local`',
  ].join('\n');
}

/**
 * Permission-gated loopback Local OS drive search (`POST /api/fs/search`).
 */
export async function searchLocalDriveLive(
  query: string,
  category?: string,
  maxResults = 20
): Promise<{ items: MediaAsset[]; scannedDirs: number; error?: string }> {
  const clean = (query || '').trim();
  if (!clean) return { items: [], scannedDirs: 0 };
  try {
    const res = await fetch('/api/fs/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: clean, category, maxResults }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { items: [], scannedDirs: 0, error: err.error || `Local search failed (${res.status})` };
    }
    const data = await res.json();
    const rawItems = Array.isArray(data?.items) ? data.items : [];
    const mapped: MediaAsset[] = rawItems.map((entry: any) => ({
      id: `local_${btoa(unescape(encodeURIComponent(String(entry.path || entry.name)))).replace(/=+$/, '').slice(0, 32)}`,
      name: String(entry.name || 'Local File'),
      source: 'local',
      category: (entry.category && entry.category !== 'other' ? entry.category : 'document') as MediaAsset['category'],
      mimeType: String(entry.mimeType || 'application/octet-stream'),
      extension: String(entry.extension || ''),
      path: String(entry.path || ''),
      localPath: String(entry.path || ''),
      sizeBytes: Number(entry.size || 0),
      modifiedTime: String(entry.modifiedTime || new Date().toISOString()),
      thumbnailUrl: entry.category === 'image' ? String(entry.streamUrl || '') : '',
      previewUrl: String(entry.streamUrl || ''),
      isCached: true,
      cullingStatus: 'unrated',
      rating: 0,
      tags: ['local-os', 'live-search'],
      faces: [],
      quality: { sharpness: 85, exposure: 85, isBlurry: false },
      palette: [],
      exif: {},
    }));
    return { items: mapped, scannedDirs: Number(data?.scannedDirs || 0) };
  } catch (err: any) {
    return { items: [], scannedDirs: 0, error: err?.message || 'Local OS search unreachable' };
  }
}

export interface WorkspaceGmailHit {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  webUrl: string;
}

export async function searchWorkspaceGmailLive(
  q: string
): Promise<{ items: WorkspaceGmailHit[]; needsScope: boolean; error?: string }> {
  const token = await getDriveAccessToken();
  if (!token) return { items: [], needsScope: true, error: 'Google OAuth not connected.' };
  try {
    const res = await fetch('/api/workspace/search/gmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ q }),
    });
    if (res.status === 401 || res.status === 403) {
      return { items: [], needsScope: true, error: 'Gmail read scope not granted.' };
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { items: [], needsScope: false, error: data.error || `Gmail search failed (${res.status})` };
    return { items: Array.isArray(data.items) ? data.items : [], needsScope: false };
  } catch (err: any) {
    return { items: [], needsScope: false, error: err?.message || 'Gmail search failed' };
  }
}

export interface WorkspaceCalendarHit {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  htmlLink?: string;
}

export async function searchWorkspaceCalendarLive(
  q: string
): Promise<{ items: WorkspaceCalendarHit[]; needsScope: boolean; error?: string }> {
  const token = await getDriveAccessToken();
  if (!token) return { items: [], needsScope: true, error: 'Google OAuth not connected.' };
  try {
    const res = await fetch('/api/workspace/search/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ q }),
    });
    if (res.status === 401 || res.status === 403) {
      return { items: [], needsScope: true, error: 'Google Calendar scope not granted.' };
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { items: [], needsScope: false, error: data.error || `Calendar search failed (${res.status})` };
    return { items: Array.isArray(data.items) ? data.items : [], needsScope: false };
  } catch (err: any) {
    return { items: [], needsScope: false, error: err?.message || 'Calendar search failed' };
  }
}

export interface WorkspaceContactHit {
  resourceName: string;
  name: string;
  email: string;
  phone: string;
}

export async function searchWorkspaceContactsLive(
  q: string
): Promise<{ items: WorkspaceContactHit[]; needsScope: boolean; error?: string }> {
  const token = await getDriveAccessToken();
  if (!token) return { items: [], needsScope: true, error: 'Google OAuth not connected.' };
  try {
    const res = await fetch('/api/workspace/search/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ q }),
    });
    if (res.status === 401 || res.status === 403) {
      return { items: [], needsScope: true, error: 'Google Contacts scope not granted.' };
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { items: [], needsScope: false, error: data.error || `Contacts search failed (${res.status})` };
    return { items: Array.isArray(data.items) ? data.items : [], needsScope: false };
  } catch (err: any) {
    return { items: [], needsScope: false, error: err?.message || 'Contacts search failed' };
  }
}
