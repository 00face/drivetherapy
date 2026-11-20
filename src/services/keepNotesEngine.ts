/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Keep-Style Notes, Shoot Checklists & Google Keep Takeout Importer
 * Persists color-coded notes & checklists locally and syncs to Google Drive (`drive.file` scope)
 * so both personal @gmail.com and Workspace accounts work seamlessly.
 */

import { loadOAuthToken } from './googleDrive';

export type KeepNoteColor = 'default' | 'citron' | 'teal' | 'sky' | 'magenta' | 'indigo';

export interface KeepChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface KeepNote {
  id: string;
  title: string;
  body: string;
  color: KeepNoteColor;
  pinned: boolean;
  checklist: KeepChecklistItem[];
  linkedAssetId?: string;
  linkedAssetName?: string;
  updatedAt: string;
  source: 'local' | 'takeout' | 'drive-sync';
}

const KEEP_NOTES_KEY = 'dt_keep_notes_v1';

export function loadKeepNotes(): KeepNote[] {
  try {
    const raw = localStorage.getItem(KEEP_NOTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveKeepNotes(notes: KeepNote[]): void {
  try {
    localStorage.setItem(KEEP_NOTES_KEY, JSON.stringify(notes.slice(0, 500)));
  } catch {}
}

/**
 * Parse a Google Takeout Keep `.json` export note into Drive Therapy's KeepNote model.
 */
export function parseKeepTakeoutNote(rawJson: any, fallbackTitle = 'Imported Note'): KeepNote {
  const checklist: KeepChecklistItem[] = Array.isArray(rawJson?.listContent)
    ? rawJson.listContent.map((item: any, idx: number) => ({
        id: `chk_${Date.now()}_${idx}`,
        text: String(item?.text || ''),
        checked: Boolean(item?.isChecked),
      }))
    : [];

  const colorMap: Record<string, KeepNoteColor> = {
    YELLOW: 'citron',
    TEAL: 'teal',
    BLUE: 'sky',
    PINK: 'magenta',
    PURPLE: 'indigo',
  };

  const tsMicros = Number(rawJson?.userEditedTimestampUsec || 0);
  const updatedAt = tsMicros > 0 ? new Date(Math.floor(tsMicros / 1000)).toISOString() : new Date().toISOString();

  return {
    id: `keep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: String(rawJson?.title || fallbackTitle).trim() || fallbackTitle,
    body: String(rawJson?.textContent || ''),
    color: colorMap[String(rawJson?.color || '').toUpperCase()] || 'default',
    pinned: Boolean(rawJson?.isPinned),
    checklist,
    updatedAt,
    source: 'takeout',
  };
}

/**
 * Sync notes non-destructively to `DriveTherapy_KeepNotes.json` in Google Drive (`drive.file`).
 */
export async function syncKeepNotesToDrive(notes: KeepNote[]): Promise<{ fileId: string } | null> {
  const token = loadOAuthToken()?.accessToken;
  if (!token) throw new Error('Connect Google account first to sync notes to Drive.');

  const boundary = 'dt_keep_sync_boundary';
  const meta = JSON.stringify({
    name: 'DriveTherapy_KeepNotes.json',
    mimeType: 'application/json',
  });
  const payload = JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), notes }, null, 2);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${payload}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) throw new Error(`Drive notes sync failed (${res.status})`);
  const data = await res.json();
  return { fileId: data.id };
}
