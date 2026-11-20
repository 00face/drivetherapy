/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Media Library Indexer
 * Pages through the signed-in user's Google Drive (My Drive, Shared with me and
 * shared drives) AND scans host OS Music/Video directories (/api/fs/scan-media) for audio
 * and video files, deriving all 6 categories (Playlists, Songs, Albums, Artists, Profiles, Podcasts).
 */

import type { MusicPlaylist, MusicTrack } from '../googleMusicEngine';
import { loadOAuthToken, isTokenExpired } from '../oauthStorage';
import {
  computeCanonicalAlbumUid,
  extractAudioTagsFromBuffer,
  type AudioTagMetadata,
} from './audioTagReader';

export interface DriveMediaOwner {
  displayName?: string;
  emailAddress?: string;
  photoLink?: string;
}

export interface DriveMediaFile {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  parents?: string[];
  thumbnailLink?: string;
  modifiedTime?: string;
  starred?: boolean;
  owners?: DriveMediaOwner[];
  videoMediaMetadata?: { durationMillis?: string };
}

export interface LibraryProgress {
  loaded: number;
  done: boolean;
}

export interface LocalScannedMediaItem {
  id: string;
  name: string;
  title?: string;
  artist?: string;
  albumArtist?: string;
  album?: string;
  albumUid?: string;
  uidSource?: AudioTagMetadata['uidSource'];
  trackUid?: string;
  trackNumber?: number;
  discNumber?: number;
  year?: number;
  genre?: string;
  durationSeconds?: number;
  path: string;
  mimeType?: string;
  category?: string;
  format?: string;
  isVideo?: boolean;
  sizeBytes?: number;
  modifiedAt?: number;
  streamUrl?: string;
}

const DRIVE_MEDIA_QUERY = "(mimeType contains 'audio/' or mimeType contains 'video/') and trashed = false";
const DRIVE_MEDIA_FIELDS =
  'nextPageToken,files(id,name,mimeType,size,parents,thumbnailLink,modifiedTime,starred,owners(displayName,emailAddress,photoLink),videoMediaMetadata(durationMillis))';

const FORMAT_BY_EXT: Record<string, MusicTrack['format']> = {
  flac: 'flac',
  ogg: 'ogg',
  oga: 'ogg',
  opus: 'ogg',
  wav: 'wav',
  mp3: 'mp3',
  m4a: 'm4a',
  aac: 'aac',
  mp4: 'mp4',
  m4v: 'mp4',
  mov: 'mov',
  mkv: 'mkv',
  webm: 'webm',
};

const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80';
const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80';

export function inferFormat(name: string, mimeType = ''): MusicTrack['format'] {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (FORMAT_BY_EXT[ext]) return FORMAT_BY_EXT[ext];
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.startsWith('video/')) return 'mp4';
  return 'mp3';
}

/** Parse "Artist - Title" filenames; otherwise leave artist generic. */
export function parseTitleArtist(fileName: string): { title: string; artist: string } {
  const base = fileName.replace(/\.[^/.]+$/, '');
  if (base.includes(' - ')) {
    const parts = base.split(' - ');
    return { artist: parts[0].trim() || 'Unknown Artist', title: parts.slice(1).join(' - ').trim() || base };
  }
  return { artist: 'Unknown Artist', title: base };
}

export function isPodcastTrack(track: Pick<MusicTrack, 'title' | 'album' | 'genre' | 'durationSeconds'>): boolean {
  if (track.durationSeconds >= 600) return true;
  const hay = `${track.title} ${track.album} ${track.genre}`.toLowerCase();
  return /(podcast|episode|\bep\.?\s?\d+|interview|talk|audiobook|lecture)/.test(hay);
}

export function mapDriveFileToTrack(file: DriveMediaFile, folderNames: Map<string, string> = new Map()): MusicTrack {
  const mime = file.mimeType || '';
  const isVideo = mime.startsWith('video/');
  const { title, artist } = parseTitleArtist(file.name);
  const parentId = file.parents?.[0];
  const parentName = file.parents?.map((p) => folderNames.get(p)).find(Boolean);
  const durationMs = parseInt(file.videoMediaMetadata?.durationMillis || '0', 10);
  const owner = file.owners?.[0];
  const albumName = parentName || 'Drive Collection';
  const year = file.modifiedTime ? new Date(file.modifiedTime).getFullYear() : undefined;
  const uidInfo = computeCanonicalAlbumUid({
    album: albumName,
    artist,
    year,
    folderIdOrPath: parentId,
  });

  const track: MusicTrack = {
    id: `drive_${file.id}`,
    driveFileId: file.id,
    title,
    artist,
    album: albumName,
    albumUid: uidInfo.albumUid,
    uidSource: uidInfo.uidSource,
    durationSeconds: durationMs > 0 ? Math.round(durationMs / 1000) : 0,
    albumArtUrl: file.thumbnailLink || '',
    genre: isVideo ? 'Video' : 'Audio',
    format: inferFormat(file.name, mime),
    mimeType: mime,
    isVideo,
    isLiked: Boolean(file.starred),
    source: 'cloud',
    subCategory: 'songs',
    year,
    modifiedAt: file.modifiedTime ? Date.parse(file.modifiedTime) : undefined,
    ownerName: owner?.displayName || owner?.emailAddress,
    ownerAvatarUrl: owner?.photoLink,
  };
  if (isPodcastTrack(track)) track.subCategory = 'podcasts';
  return track;
}

/**
 * Fast folder ID -> Name index for resolving Drive audio parent folder names in parallel.
 */
export async function fetchDriveFolderNamesMap(signal?: AbortSignal): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const record = loadOAuthToken();
  if (!record || isTokenExpired(record, 15) || typeof fetch === 'undefined') return map;

  try {
    const params = new URLSearchParams({
      q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      pageSize: '1000',
      fields: 'files(id,name)',
      corpora: 'allDrives',
      includeItemsFromAllDrives: 'true',
      supportsAllDrives: 'true',
    });
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${record.accessToken}` },
      signal,
    });
    if (res.ok) {
      const data = await res.json();
      for (const f of data.files || []) {
        if (f.id && f.name) map.set(f.id, f.name);
      }
    }
  } catch {
    // Non-fatal fallback
  }
  return map;
}

/**
 * Concurrently probes the first 64KB of cloud audio files via Range requests
 * to extract ID3v2 / FLAC Vorbis / MP4 tags & MusicBrainz/UFID Album UIDs.
 */
export async function enrichDriveTracksWithAudioTags(
  tracks: MusicTrack[],
  opts: {
    concurrency?: number;
    maxTracks?: number;
    signal?: AbortSignal;
    onBatchEnriched?: (updated: MusicTrack[]) => void;
  } = {}
): Promise<MusicTrack[]> {
  const record = loadOAuthToken();
  if (!record || isTokenExpired(record, 15) || typeof fetch === 'undefined') return tracks;

  const candidates = tracks
    .filter((t) => t.source === 'cloud' && t.driveFileId && !t.isVideo)
    .slice(0, opts.maxTracks ?? 120);
  if (candidates.length === 0) return tracks;

  const concurrency = Math.max(1, Math.min(8, opts.concurrency ?? 6));
  const enrichedById = new Map<string, MusicTrack>();
  let cursor = 0;

  const worker = async () => {
    while (cursor < candidates.length && !opts.signal?.aborted) {
      const track = candidates[cursor++];
      if (!track.driveFileId) continue;
      try {
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(track.driveFileId)}?alt=media`,
          {
            headers: {
              Authorization: `Bearer ${record.accessToken}`,
              Range: 'bytes=0-65535',
            },
            signal: opts.signal,
          }
        );
        if (!res.ok && res.status !== 206) continue;
        const buf = new Uint8Array(await res.arrayBuffer());
        const tags = extractAudioTagsFromBuffer(buf, `${track.title}.${track.format}`);
        if (!tags.title && !tags.album && !tags.artist && !tags.albumUid) continue;

        const nextTitle = tags.title || track.title;
        const nextArtist = tags.artist || track.artist;
        const nextAlbum = tags.album || track.album;
        const nextAlbumArtist = tags.albumArtist || track.albumArtist;
        const nextYear = tags.year || track.year;
        const uidInfo = computeCanonicalAlbumUid({
          embeddedUid: tags.albumUid,
          album: nextAlbum,
          albumArtist: nextAlbumArtist,
          artist: nextArtist,
          year: nextYear,
          folderIdOrPath: track.albumUid?.startsWith('fld:') ? track.albumUid.slice(4) : undefined,
        });

        enrichedById.set(track.id, {
          ...track,
          title: nextTitle,
          artist: nextArtist,
          albumArtist: nextAlbumArtist,
          album: nextAlbum,
          albumUid: uidInfo.albumUid,
          uidSource: uidInfo.uidSource,
          trackUid: tags.trackUid || track.trackUid,
          trackNumber: tags.trackNumber ?? track.trackNumber,
          discNumber: tags.discNumber ?? track.discNumber,
          year: nextYear,
          genre: tags.genre || track.genre,
          durationSeconds: tags.durationSeconds || track.durationSeconds,
        });
      } catch {
        // Ignore single-track range probe errors
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker()));
  const merged = tracks.map((t) => enrichedById.get(t.id) || t);
  if (enrichedById.size > 0) opts.onBatchEnriched?.(merged);
  return merged;
}

/**
 * Page through the full Drive archive for audio/video. Returns [] when not signed in.
 * Throws nothing: network/auth problems resolve to whatever was loaded so far.
 */
export async function fetchDriveMusicLibrary(
  opts: {
    folderNames?: Map<string, string>;
    resolveFolderNames?: boolean;
    onProgress?: (p: LibraryProgress) => void;
    signal?: AbortSignal;
  } = {}
): Promise<MusicTrack[]> {
  const record = loadOAuthToken();
  if (!record || isTokenExpired(record, 15) || typeof fetch === 'undefined') return [];

  const tracks: MusicTrack[] = [];
  let pageToken: string | undefined;

  try {
    const folderNamesPromise = opts.folderNames
      ? Promise.resolve(opts.folderNames)
      : opts.resolveFolderNames
      ? fetchDriveFolderNamesMap(opts.signal)
      : Promise.resolve(new Map<string, string>());

    do {
      const params = new URLSearchParams({
        q: DRIVE_MEDIA_QUERY,
        pageSize: '1000',
        fields: DRIVE_MEDIA_FIELDS,
        corpora: 'allDrives',
        includeItemsFromAllDrives: 'true',
        supportsAllDrives: 'true',
        orderBy: 'modifiedTime desc',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const [resolvedFolderNames, res] = await Promise.all([
        folderNamesPromise,
        fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
          headers: { Authorization: `Bearer ${record.accessToken}` },
          signal: opts.signal,
        }),
      ]);
      if (!res.ok) break;

      const data = await res.json();
      for (const f of (data.files || []) as DriveMediaFile[]) {
        tracks.push(mapDriveFileToTrack(f, resolvedFolderNames));
      }
      pageToken = data.nextPageToken;
      opts.onProgress?.({ loaded: tracks.length, done: !pageToken });
    } while (pageToken);
  } catch (err) {
    console.warn('[MusicLibrary] Archive scan interrupted:', err);
  }

  opts.onProgress?.({ loaded: tracks.length, done: true });
  return tracks;
}

/** Scan local host OS Music & Videos folders via loopback `/api/fs/scan-media` endpoint. */
export async function fetchLocalDiskMusicLibrary(customPath?: string): Promise<MusicTrack[]> {
  if (typeof fetch === 'undefined') return [];
  try {
    const qs = customPath ? `?path=${encodeURIComponent(customPath)}` : '';
    const res = await fetch(`/api/fs/scan-media${qs}`);
    if (!res.ok) return [];
    const data = await res.json();
    const rawTracks: LocalScannedMediaItem[] = Array.isArray(data.tracks) ? data.tracks : [];
    return rawTracks.map((item) => {
      const parsed = item.title && item.artist
        ? { title: item.title, artist: item.artist }
        : parseTitleArtist(item.name);
      const format = inferFormat(item.name, item.mimeType);
      const isVideo = Boolean(item.isVideo ?? item.mimeType?.startsWith('video/'));
      const uidInfo = item.albumUid
        ? { albumUid: item.albumUid, uidSource: item.uidSource || 'tag-composite' }
        : computeCanonicalAlbumUid({
            album: item.album || 'Local Music',
            albumArtist: item.albumArtist,
            artist: parsed.artist,
            year: item.year,
            folderIdOrPath: item.path,
          });
      return {
        id: item.id,
        mimeType: item.mimeType,
        title: parsed.title,
        artist: parsed.artist,
        albumArtist: item.albumArtist,
        album: item.album || 'Local Music',
        albumUid: uidInfo.albumUid,
        uidSource: uidInfo.uidSource,
        trackUid: item.trackUid,
        trackNumber: item.trackNumber,
        discNumber: item.discNumber,
        year: item.year,
        durationSeconds: item.durationSeconds || 0,
        albumArtUrl: DEFAULT_COVER,
        genre: item.genre || (isVideo ? 'Local Video' : 'Local Audio'),
        format,
        isVideo,
        source: 'local',
        localPath: item.path,
        subCategory: 'songs',
        modifiedAt: item.modifiedAt,
      };
    });
  } catch {
    return [];
  }
}

/** Merge track lists by id (first occurrence wins). */
export function mergeTracks(...lists: MusicTrack[][]): MusicTrack[] {
  const seen = new Set<string>();
  const out: MusicTrack[] = [];
  for (const list of lists) {
    for (const t of list) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
}

/**
 * Derive all 6 Media Studio filter categories cleanly from real Google Drive and Local tracks,
 * user playlists, and account profiles.
 */
export function buildAllCategoryPlaylists(params: {
  tracks: MusicTrack[];
  userPlaylists?: MusicPlaylist[];
  accountName: string;
  subAccountProfiles?: Array<{ id: string; name: string; handle: string; avatarUrl?: string; roleLabel?: string }>;
}): MusicPlaylist[] {
  const { tracks, userPlaylists = [], accountName, subAccountProfiles = [] } = params;

  const likedTracks = tracks.filter((t) => t.isLiked);
  const likedPlaylist: MusicPlaylist = {
    id: 'pl_liked_music',
    title: 'Liked Music',
    description: 'Auto playlist containing your saved and starred music.',
    coverUrl: tracks[0]?.albumArtUrl || DEFAULT_COVER,
    tracks: likedTracks.length > 0 ? likedTracks : tracks.slice(0, 5),
    category: 'playlists',
    itemType: 'playlist',
    author: 'Auto Playlist',
    isPinned: true,
    trackCount: likedTracks.length > 0 ? likedTracks.length : Math.min(5, tracks.length),
  };

  const allDrivePlaylist: MusicPlaylist = {
    id: 'pl_drive_all',
    title: 'Drive Audio & Video',
    description: 'All audio and video files cataloged from your connected storage.',
    coverUrl: tracks[0]?.albumArtUrl || DEFAULT_COVER,
    tracks,
    category: 'playlists',
    itemType: 'playlist',
    author: accountName,
    trackCount: tracks.length,
  };

  // Songs category collections
  const songItems: MusicPlaylist[] = [];
  if (tracks.length > 0) {
    const audioOnly = tracks.filter((t) => !t.isVideo);
    const videoOnly = tracks.filter((t) => t.isVideo);
    songItems.push({
      id: 'pl_songs_all',
      title: 'All Songs & Tracks',
      description: `${tracks.length} playable songs & streams`,
      coverUrl: tracks[0]?.albumArtUrl || DEFAULT_COVER,
      tracks,
      category: 'songs',
      itemType: 'playlist',
      author: accountName,
      trackCount: tracks.length,
    });
    if (audioOnly.length > 0) {
      songItems.push({
        id: 'pl_songs_audio',
        title: 'Audio Tracks',
        description: `${audioOnly.length} audio files`,
        coverUrl: audioOnly[0]?.albumArtUrl || DEFAULT_COVER,
        tracks: audioOnly,
        category: 'songs',
        itemType: 'playlist',
        author: accountName,
        trackCount: audioOnly.length,
      });
    }
    if (videoOnly.length > 0) {
      songItems.push({
        id: 'pl_songs_video',
        title: 'Music Videos',
        description: `${videoOnly.length} video streams`,
        coverUrl: videoOnly[0]?.albumArtUrl || DEFAULT_COVER,
        tracks: videoOnly,
        category: 'songs',
        itemType: 'playlist',
        author: accountName,
        trackCount: videoOnly.length,
      });
    }
  }

  // Albums grouped by canonical Album UID (MusicBrainz / UFID / AlbumArtist+Album+Year / Folder UID)
  const albumMap = new Map<string, MusicTrack[]>();
  for (const track of tracks) {
    const uidKey =
      track.albumUid ||
      computeCanonicalAlbumUid({
        album: track.album,
        albumArtist: track.albumArtist,
        artist: track.artist,
        year: track.year,
      }).albumUid;
    if (!albumMap.has(uidKey)) albumMap.set(uidKey, []);
    albumMap.get(uidKey)!.push(track);
  }
  const dynamicAlbums: MusicPlaylist[] = Array.from(albumMap.entries()).map(([uidKey, albTracks], idx) => {
    const sorted = [...albTracks].sort((a, b) => {
      const discDiff = (a.discNumber || 1) - (b.discNumber || 1);
      if (discDiff !== 0) return discDiff;
      const trkDiff = (a.trackNumber || 9999) - (b.trackNumber || 9999);
      if (trkDiff !== 0) return trkDiff;
      return a.title.localeCompare(b.title);
    });
    const lead = sorted[0];
    const albTitle = lead?.album || 'Drive Collection';
    const primaryArtist = lead?.albumArtist || lead?.artist || accountName;
    const yrLabel = lead?.year ? ` • ${lead.year}` : '';
    const uidBadge = lead?.uidSource === 'musicbrainz' ? ' • MB-UID' : '';
    return {
      id: `pl_drive_album_${idx}_${encodeURIComponent(uidKey)}`,
      title: albTitle,
      description: `Album • ${primaryArtist}${yrLabel} • ${sorted.length} tracks${uidBadge}`,
      coverUrl: lead?.albumArtUrl || DEFAULT_COVER,
      tracks: sorted,
      category: 'albums',
      itemType: 'album',
      author: primaryArtist,
      year: lead?.year,
      trackCount: sorted.length,
    };
  });

  // Artists grouped by performer
  const artistMap = new Map<string, MusicTrack[]>();
  for (const track of tracks) {
    const art = track.artist || 'Unknown Artist';
    if (!artistMap.has(art)) artistMap.set(art, []);
    artistMap.get(art)!.push(track);
  }
  const dynamicArtists: MusicPlaylist[] = Array.from(artistMap.entries()).map(([artName, artTracks], idx) => ({
    id: `pl_drive_artist_${idx}_${encodeURIComponent(artName)}`,
    title: artName,
    description: `Artist • ${artTracks.length} tracks in library`,
    coverUrl: artTracks[0]?.albumArtUrl || DEFAULT_AVATAR,
    tracks: artTracks,
    category: 'artists',
    itemType: 'artist',
    author: artName,
    trackCount: artTracks.length,
  }));

  // Podcasts grouped by long-form duration >= 10m or keywords
  const podcastTracks = tracks.filter((t) => isPodcastTrack(t));
  const dynamicPodcasts: MusicPlaylist[] =
    podcastTracks.length > 0
      ? [
          {
            id: 'pl_drive_podcasts',
            title: 'Podcasts & Long-Form Audio',
            description: `${podcastTracks.length} episodes and long-form recordings`,
            coverUrl: podcastTracks[0]?.albumArtUrl || DEFAULT_COVER,
            tracks: podcastTracks,
            category: 'podcasts',
            itemType: 'podcast',
            author: accountName,
            trackCount: podcastTracks.length,
          },
        ]
      : [];

  // Profiles: authenticated Google Drive accounts + unique Drive file owners
  const ownerMap = new Map<string, { name: string; avatar?: string; tracks: MusicTrack[] }>();
  for (const track of tracks) {
    const owner = track.ownerName;
    if (!owner) continue;
    if (!ownerMap.has(owner)) {
      ownerMap.set(owner, { name: owner, avatar: track.ownerAvatarUrl, tracks: [] });
    }
    ownerMap.get(owner)!.tracks.push(track);
  }

  const profilePlaylists: MusicPlaylist[] = [];
  for (const acc of subAccountProfiles) {
    profilePlaylists.push({
      id: `pl_profile_${acc.id}`,
      title: acc.name,
      description: `Profile • ${acc.handle}${acc.roleLabel ? ` • ${acc.roleLabel}` : ''}`,
      coverUrl: acc.avatarUrl || DEFAULT_AVATAR,
      tracks,
      category: 'profiles',
      itemType: 'profile',
      author: acc.handle,
      roleLabel: acc.roleLabel,
      trackCount: tracks.length,
    });
  }
  for (const [ownerName, info] of ownerMap.entries()) {
    if (!profilePlaylists.some((p) => p.title === ownerName)) {
      profilePlaylists.push({
        id: `pl_owner_${encodeURIComponent(ownerName)}`,
        title: ownerName,
        description: `Drive Owner • ${info.tracks.length} tracks`,
        coverUrl: info.avatar || DEFAULT_AVATAR,
        tracks: info.tracks,
        category: 'profiles',
        itemType: 'profile',
        author: ownerName,
        trackCount: info.tracks.length,
      });
    }
  }

  return [
    likedPlaylist,
    allDrivePlaylist,
    ...userPlaylists,
    ...songItems,
    ...dynamicAlbums,
    ...dynamicArtists,
    ...dynamicPodcasts,
    ...profilePlaylists,
  ];
}
