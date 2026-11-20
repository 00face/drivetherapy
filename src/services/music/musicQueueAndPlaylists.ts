/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Music Queue, Playlist CRUD, Track Radio, Ratings & Play History Service
 * Stateful per-sub-account store backing full-capability custom Google Music API features.
 */

import type { MusicPlaylist, MusicTrack } from '../googleMusicEngine';

const USER_PLAYLISTS_STORAGE_KEY = 'dt_google_music_user_playlists_v1';
const PLAY_HISTORY_STORAGE_KEY = 'dt_google_music_history_v1';
const RATINGS_STORAGE_KEY = 'dt_google_music_ratings_v1';

export type TrackRatingValue = 'up' | 'down' | 'none';

export interface PlayHistoryEntry {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  albumArtUrl: string;
  playedAt: number;
  playCount: number;
}

const DEFAULT_PLAYLIST_COVER =
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80';

const inMemoryFallback = new Map<string, string>();

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(key)
        : inMemoryFallback.get(key) ?? null;
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, val: unknown): void {
  try {
    const serialized = JSON.stringify(val);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, serialized);
    } else {
      inMemoryFallback.set(key, serialized);
    }
  } catch (err) {
    console.warn(`[MusicQueue] Failed saving ${key}:`, err);
  }
}

// --- User Playlist CRUD (scoped per sub-account) ---

export function getUserPlaylists(accountId: string): MusicPlaylist[] {
  const all = readJson<Record<string, MusicPlaylist[]>>(USER_PLAYLISTS_STORAGE_KEY, {});
  return Array.isArray(all[accountId]) ? [...all[accountId]] : [];
}

function saveUserPlaylists(accountId: string, list: MusicPlaylist[]): void {
  const all = readJson<Record<string, MusicPlaylist[]>>(USER_PLAYLISTS_STORAGE_KEY, {});
  all[accountId] = list;
  writeJson(USER_PLAYLISTS_STORAGE_KEY, all);
}

export function createUserPlaylist(
  accountId: string,
  params: { title: string; description?: string; tracks?: MusicTrack[]; author?: string }
): MusicPlaylist {
  const existing = getUserPlaylists(accountId);
  const tracks = params.tracks ? [...params.tracks] : [];
  const created: MusicPlaylist = {
    id: `pl_user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: params.title.trim() || 'Untitled Playlist',
    description: params.description?.trim() || `Custom playlist • ${tracks.length} tracks`,
    coverUrl: tracks[0]?.albumArtUrl || DEFAULT_PLAYLIST_COVER,
    tracks,
    category: 'playlists',
    itemType: 'playlist',
    author: params.author || 'You',
    trackCount: tracks.length,
  };
  saveUserPlaylists(accountId, [created, ...existing]);
  return created;
}

export function renameUserPlaylist(
  accountId: string,
  playlistId: string,
  title: string,
  description?: string
): MusicPlaylist | null {
  const existing = getUserPlaylists(accountId);
  const idx = existing.findIndex((p) => p.id === playlistId);
  if (idx < 0) return null;
  const updated: MusicPlaylist = {
    ...existing[idx],
    title: title.trim() || existing[idx].title,
    description: description !== undefined ? description.trim() : existing[idx].description,
  };
  existing[idx] = updated;
  saveUserPlaylists(accountId, existing);
  return updated;
}

export function deleteUserPlaylist(accountId: string, playlistId: string): boolean {
  const existing = getUserPlaylists(accountId);
  const next = existing.filter((p) => p.id !== playlistId);
  if (next.length === existing.length) return false;
  saveUserPlaylists(accountId, next);
  return true;
}

export function addTrackToUserPlaylist(
  accountId: string,
  playlistId: string,
  track: MusicTrack
): MusicPlaylist | null {
  const existing = getUserPlaylists(accountId);
  const idx = existing.findIndex((p) => p.id === playlistId);
  if (idx < 0) return null;
  const target = existing[idx];
  if (target.tracks.some((t) => t.id === track.id)) return target;
  const nextTracks = [...target.tracks, track];
  const updated: MusicPlaylist = {
    ...target,
    tracks: nextTracks,
    trackCount: nextTracks.length,
    coverUrl: target.coverUrl || track.albumArtUrl || DEFAULT_PLAYLIST_COVER,
  };
  existing[idx] = updated;
  saveUserPlaylists(accountId, existing);
  return updated;
}

export function removeTrackFromUserPlaylist(
  accountId: string,
  playlistId: string,
  trackId: string
): MusicPlaylist | null {
  const existing = getUserPlaylists(accountId);
  const idx = existing.findIndex((p) => p.id === playlistId);
  if (idx < 0) return null;
  const target = existing[idx];
  const nextTracks = target.tracks.filter((t) => t.id !== trackId);
  const updated: MusicPlaylist = {
    ...target,
    tracks: nextTracks,
    trackCount: nextTracks.length,
  };
  existing[idx] = updated;
  saveUserPlaylists(accountId, existing);
  return updated;
}

// --- Mutable Playback Queue & Track Radio ---

export function insertNextInQueue(
  queue: MusicTrack[],
  currentIndex: number,
  track: MusicTrack
): { queue: MusicTrack[]; currentIndex: number } {
  const filtered = queue.filter((t) => t.id !== track.id);
  const removedBefore = queue.findIndex((t, i) => t.id === track.id && i <= currentIndex) >= 0;
  const adjustedCurrent = removedBefore && queue.findIndex((t) => t.id === track.id) < currentIndex
    ? Math.max(0, currentIndex - 1)
    : currentIndex;
  const insertAt = filtered.length === 0 ? 0 : Math.min(filtered.length, adjustedCurrent + 1);
  const nextQueue = [...filtered.slice(0, insertAt), track, ...filtered.slice(insertAt)];
  return { queue: nextQueue, currentIndex: adjustedCurrent };
}

export function appendToQueue(queue: MusicTrack[], track: MusicTrack): MusicTrack[] {
  if (queue.some((t) => t.id === track.id)) return queue;
  return [...queue, track];
}

export function removeFromQueueAt(
  queue: MusicTrack[],
  currentIndex: number,
  removeIndex: number
): { queue: MusicTrack[]; currentIndex: number } {
  if (removeIndex < 0 || removeIndex >= queue.length) {
    return { queue, currentIndex };
  }
  const nextQueue = queue.filter((_, i) => i !== removeIndex);
  let nextIdx = currentIndex;
  if (removeIndex < currentIndex) nextIdx = Math.max(0, currentIndex - 1);
  else if (nextIdx >= nextQueue.length) nextIdx = Math.max(0, nextQueue.length - 1);
  return { queue: nextQueue, currentIndex: nextIdx };
}

export function moveInQueue(
  queue: MusicTrack[],
  currentIndex: number,
  fromIdx: number,
  toIdx: number
): { queue: MusicTrack[]; currentIndex: number } {
  if (
    fromIdx < 0 ||
    toIdx < 0 ||
    fromIdx >= queue.length ||
    toIdx >= queue.length ||
    fromIdx === toIdx
  ) {
    return { queue, currentIndex };
  }
  const nextQueue = [...queue];
  const [moved] = nextQueue.splice(fromIdx, 1);
  nextQueue.splice(toIdx, 0, moved);

  let nextCurrent = currentIndex;
  if (currentIndex === fromIdx) nextCurrent = toIdx;
  else if (fromIdx < currentIndex && toIdx >= currentIndex) nextCurrent = currentIndex - 1;
  else if (fromIdx > currentIndex && toIdx <= currentIndex) nextCurrent = currentIndex + 1;

  return { queue: nextQueue, currentIndex: nextCurrent };
}

/**
 * Generates an ordered Track Radio queue starting with `seedTrack` followed by
 * similarity-ranked tracks (matching artist, album/folder, genre, format, and BPM proximity).
 */
export function buildTrackRadioQueue(
  seedTrack: MusicTrack,
  catalogTracks: MusicTrack[],
  limit = 25
): MusicTrack[] {
  const candidates = catalogTracks.filter((t) => t.id !== seedTrack.id);
  const scored = candidates.map((cand) => {
    let score = 0;
    if (cand.artist && cand.artist === seedTrack.artist) score += 40;
    if (cand.album && cand.album === seedTrack.album) score += 25;
    if (cand.genre && cand.genre === seedTrack.genre) score += 20;
    if (cand.format === seedTrack.format) score += 5;
    if (cand.isVideo === seedTrack.isVideo) score += 5;
    if (seedTrack.bpm && cand.bpm) {
      const diff = Math.abs(seedTrack.bpm - cand.bpm);
      if (diff <= 15) score += 15 - diff;
    }
    return { cand, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return [seedTrack, ...scored.slice(0, Math.max(0, limit - 1)).map((s) => s.cand)];
}

// --- Play History & Persistent Ratings ---

export function getPlayHistory(accountId: string): PlayHistoryEntry[] {
  const all = readJson<Record<string, PlayHistoryEntry[]>>(PLAY_HISTORY_STORAGE_KEY, {});
  return Array.isArray(all[accountId]) ? [...all[accountId]] : [];
}

export function recordTrackPlay(accountId: string, track: MusicTrack): PlayHistoryEntry[] {
  const all = readJson<Record<string, PlayHistoryEntry[]>>(PLAY_HISTORY_STORAGE_KEY, {});
  const list = Array.isArray(all[accountId]) ? [...all[accountId]] : [];
  const existing = list.find((e) => e.trackId === track.id);
  const updatedEntry: PlayHistoryEntry = {
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    albumArtUrl: track.albumArtUrl,
    playedAt: Date.now(),
    playCount: (existing?.playCount || 0) + 1,
  };
  const next = [updatedEntry, ...list.filter((e) => e.trackId !== track.id)].slice(0, 200);
  all[accountId] = next;
  writeJson(PLAY_HISTORY_STORAGE_KEY, all);
  return next;
}

export function clearPlayHistory(accountId: string): void {
  const all = readJson<Record<string, PlayHistoryEntry[]>>(PLAY_HISTORY_STORAGE_KEY, {});
  all[accountId] = [];
  writeJson(PLAY_HISTORY_STORAGE_KEY, all);
}

export function getTrackRatings(accountId: string): Record<string, TrackRatingValue> {
  const all = readJson<Record<string, Record<string, TrackRatingValue>>>(RATINGS_STORAGE_KEY, {});
  return all[accountId] ? { ...all[accountId] } : {};
}

export function setTrackRating(
  accountId: string,
  trackId: string,
  rating: TrackRatingValue
): Record<string, TrackRatingValue> {
  const all = readJson<Record<string, Record<string, TrackRatingValue>>>(RATINGS_STORAGE_KEY, {});
  const map = all[accountId] ? { ...all[accountId] } : {};
  if (rating === 'none') {
    delete map[trackId];
  } else {
    map[trackId] = rating;
  }
  all[accountId] = map;
  writeJson(RATINGS_STORAGE_KEY, all);
  return map;
}
