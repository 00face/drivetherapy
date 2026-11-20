/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Synchronized LRC Lyrics Parser & Local Lyric Store
 * Parses standard `[mm:ss.xx]` LRC timestamps and persists track lyrics locally.
 */

const LYRICS_STORAGE_KEY = 'dt_google_music_lyrics_v1';

export interface ParsedLyricLine {
  timeSec: number;
  text: string;
}

const LRC_TIMESTAMP_RE = /^\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/;

/** Parse raw LRC or plain multi-line lyrics into timed entries sorted ascending. */
export function parseLrc(raw: string): ParsedLyricLine[] {
  if (!raw || !raw.trim()) return [];
  const lines = raw.split(/\r?\n/);
  const timed: ParsedLyricLine[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = LRC_TIMESTAMP_RE.exec(trimmed);
    if (match) {
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const fracRaw = match[3] || '0';
      const frac = parseInt(fracRaw.padEnd(3, '0').slice(0, 3), 10) / 1000;
      const text = match[4].trim();
      if (text) {
        timed.push({ timeSec: mins * 60 + secs + frac, text });
      }
    } else if (!/^\[(ar|ti|al|by|offset):/i.test(trimmed)) {
      // Untimed plain line fallback: assign -1 so UI renders static lyrics cleanly
      timed.push({ timeSec: -1, text: trimmed });
    }
  }

  const hasTimed = timed.some((l) => l.timeSec >= 0);
  if (hasTimed) {
    return timed.filter((l) => l.timeSec >= 0).sort((a, b) => a.timeSec - b.timeSec);
  }
  return timed;
}

/** Find index of active lyric line for a given playback clock in seconds (-1 if untimed/before start). */
export function findActiveLyricIndex(lines: ParsedLyricLine[], currentTimeSec: number): number {
  if (!lines || lines.length === 0) return -1;
  if (lines.every((l) => l.timeSec < 0)) return -1;

  let active = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeSec >= 0 && lines[i].timeSec <= currentTimeSec + 0.15) {
      active = i;
    } else if (lines[i].timeSec > currentTimeSec + 0.15) {
      break;
    }
  }
  return active;
}

const inMemoryLyrics = new Map<string, string[]>();

export function getSavedTrackLyrics(trackId: string): string[] | null {
  try {
    if (typeof localStorage === 'undefined') {
      return inMemoryLyrics.get(trackId) ?? null;
    }
    const raw = localStorage.getItem(LYRICS_STORAGE_KEY);
    if (!raw) return inMemoryLyrics.get(trackId) ?? null;
    const map = JSON.parse(raw) as Record<string, string[]>;
    return Array.isArray(map[trackId]) ? map[trackId] : null;
  } catch {
    return null;
  }
}

export function saveTrackLyrics(trackId: string, lines: string[]): void {
  inMemoryLyrics.set(trackId, lines);
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(LYRICS_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    map[trackId] = lines;
    localStorage.setItem(LYRICS_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('[MusicLyrics] Failed saving lyrics:', err);
  }
}
