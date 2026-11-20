/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Photos Storage Integration Service
 * Supports Google Photos Picker API sessions, authenticated media proxy mapping,
 * chronological timeline grouping, and offline Google Takeout JSON sidecar merging.
 */

import { MediaAsset } from '../types';
import { getDriveAccessToken, loadOAuthToken } from './googleDrive';
import { fetchWithBackoff } from './indexingResilience';

export interface GooglePhotosAlbum {
  id: string;
  title: string;
  productUrl?: string;
  mediaItemsCount?: string;
  coverPhotoBaseUrl?: string;
  coverThumbnailUrl?: string;
  isShared?: boolean;
}

export interface GooglePhotosPickedItem {
  id: string;
  createTime?: string;
  type?: 'PHOTO' | 'VIDEO' | 'TYPE_UNSPECIFIED';
  mediaFile?: {
    baseUrl: string;
    mimeType: string;
    filename: string;
    mediaFileMetadata?: {
      width?: number;
      height?: number;
      cameraMake?: string;
      cameraModel?: string;
      photoMetadata?: {
        focalLength?: number;
        apertureFNumber?: number;
        isoEquivalent?: number;
        exposureTime?: string;
      };
      videoMetadata?: {
        fps?: number;
        processingStatus?: string;
      };
    };
  };
}

export interface GooglePhotosPickerSession {
  id: string;
  pickerUri: string;
  pollingConfig?: { pollInterval?: string; timeoutIn?: string };
  mediaItemsSet?: boolean;
}

export interface TakeoutJsonSidecar {
  title?: string;
  description?: string;
  photoTakenTime?: { timestamp?: string; formatted?: string };
  creationTime?: { timestamp?: string; formatted?: string };
  geoData?: { latitude?: number; longitude?: number; altitude?: number };
  geoDataExif?: { latitude?: number; longitude?: number; altitude?: number };
  people?: Array<{ name?: string }>;
}

const PHOTOS_CATALOG_STORAGE_KEY = 'dt_google_photos_catalog_v1';
const PHOTOS_ALBUMS_STORAGE_KEY = 'dt_google_photos_albums_v1';

export function loadSavedGooglePhotosAlbums(): GooglePhotosAlbum[] {
  try {
    const raw = localStorage.getItem(PHOTOS_ALBUMS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGooglePhotosAlbums(albums: GooglePhotosAlbum[]): void {
  try {
    localStorage.setItem(PHOTOS_ALBUMS_STORAGE_KEY, JSON.stringify(albums.slice(0, 500)));
  } catch {}
}

export function buildGooglePhotosProxyUrl(baseUrl: string, variant: 'thumb' | 'full' | 'video' = 'thumb'): string {
  const token = loadOAuthToken()?.accessToken || '';
  const suffix = variant === 'video' ? '=dv' : variant === 'full' ? '=d' : '=w480-h480-c';
  const target = baseUrl.includes('=') ? baseUrl : `${baseUrl}${suffix}`;
  return `/api/photos/proxy?url=${encodeURIComponent(target)}&access_token=${encodeURIComponent(token)}`;
}

export function mapPickedPhotoToAsset(item: GooglePhotosPickedItem): MediaAsset {
  const file = item.mediaFile;
  const filename = file?.filename || `photo_${item.id}.jpg`;
  const mime = file?.mimeType || 'image/jpeg';
  const isVideo = item.type === 'VIDEO' || mime.startsWith('video/');
  const extMatch = filename.match(/\.([^.]+)$/);
  const ext = extMatch ? extMatch[1].toUpperCase() : isVideo ? 'MP4' : 'JPG';
  const meta = file?.mediaFileMetadata;
  const photoMeta = meta?.photoMetadata;
  const baseUrl = file?.baseUrl || '';

  return {
    id: `gphotos_${item.id}`,
    name: filename,
    source: 'photos',
    category: isVideo ? 'video' : 'image',
    mimeType: mime,
    extension: ext,
    path: `Google Photos/${filename}`,
    sizeBytes: 0,
    modifiedTime: item.createTime || new Date().toISOString(),
    dateTaken: item.createTime,
    cloudUrl: baseUrl ? buildGooglePhotosProxyUrl(baseUrl, isVideo ? 'video' : 'full') : undefined,
    thumbnailUrl: baseUrl ? buildGooglePhotosProxyUrl(baseUrl, 'thumb') : '',
    isCached: false,
    cullingStatus: 'unrated',
    rating: 0,
    tags: ['Google Photos', isVideo ? 'Video' : 'Photo', ext === 'GIF' ? 'GIF' : ''].filter(Boolean),
    faces: [],
    quality: { sharpness: 88, exposure: 88, overall: 88, isBlurry: false },
    palette: [],
    exif: {
      camera: [meta?.cameraMake, meta?.cameraModel].filter(Boolean).join(' ') || undefined,
      focalLength: photoMeta?.focalLength ? `${photoMeta.focalLength}mm` : undefined,
      aperture: photoMeta?.apertureFNumber ? `f/${photoMeta.apertureFNumber}` : undefined,
      iso: photoMeta?.isoEquivalent,
      exposureTime: photoMeta?.exposureTime,
      dimensions: meta?.width && meta?.height ? `${meta.width} x ${meta.height}` : undefined,
      dateTaken: item.createTime,
    },
  };
}

/**
 * Group Google Photos assets chronologically by calendar date for timeline rendering.
 */
export function groupPhotosByDate(assets: MediaAsset[]): Array<{ dateKey: string; label: string; items: MediaAsset[] }> {
  const buckets = new Map<string, MediaAsset[]>();
  const sorted = [...assets].sort((a, b) => {
    const ta = new Date(a.dateTaken || a.modifiedTime || 0).getTime();
    const tb = new Date(b.dateTaken || b.modifiedTime || 0).getTime();
    return tb - ta;
  });

  for (const asset of sorted) {
    const d = new Date(asset.dateTaken || asset.modifiedTime || Date.now());
    const key = isNaN(d.getTime()) ? 'Undated' : d.toISOString().slice(0, 10);
    const list = buckets.get(key) || [];
    list.push(asset);
    buckets.set(key, list);
  }

  return Array.from(buckets.entries()).map(([dateKey, items]) => {
    if (dateKey === 'Undated') return { dateKey, label: 'Undated', items };
    const d = new Date(`${dateKey}T12:00:00Z`);
    const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    return { dateKey, label, items };
  });
}

/**
 * Merge Google Takeout `.json` sidecar metadata onto a MediaAsset.
 */
export function mergeTakeoutSidecar(asset: MediaAsset, sidecar: TakeoutJsonSidecar): MediaAsset {
  const ts = sidecar.photoTakenTime?.timestamp || sidecar.creationTime?.timestamp;
  const isoDate = ts ? new Date(Number(ts) * 1000).toISOString() : asset.dateTaken || asset.modifiedTime;
  const geo = sidecar.geoData?.latitude ? sidecar.geoData : sidecar.geoDataExif;
  const peopleFaces = (sidecar.people || [])
    .filter((p) => p.name)
    .map((p) => ({ label: p.name as string }));

  return {
    ...asset,
    source: 'photos',
    dateTaken: isoDate,
    modifiedTime: isoDate,
    aiDescription: sidecar.description || asset.aiDescription,
    faces: peopleFaces.length > 0 ? peopleFaces : asset.faces,
    tags: Array.from(new Set([...(asset.tags || []), 'Google Photos', 'Takeout'])),
    exif: {
      ...asset.exif,
      dateTaken: isoDate,
    },
    metadata: {
      ...(asset.metadata || {}),
      gps: geo?.latitude && geo?.longitude ? { lat: geo.latitude, lng: geo.longitude } : asset.metadata?.gps,
    },
  };
}

export function loadSavedGooglePhotosAssets(): MediaAsset[] {
  try {
    const raw = localStorage.getItem(PHOTOS_CATALOG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGooglePhotosAssets(assets: MediaAsset[]): void {
  try {
    localStorage.setItem(PHOTOS_CATALOG_STORAGE_KEY, JSON.stringify(assets.slice(0, 1500)));
  } catch {}
}

export async function createGooglePhotosPickerSession(
  maxItemCount = 2000
): Promise<GooglePhotosPickerSession> {
  const token = (await getDriveAccessToken()) || loadOAuthToken()?.accessToken;
  if (!token) throw new Error('Connect Google account first to open Google Photos Picker.');
  const res = await fetch('/api/photos/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ maxItemCount }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Google Photos Picker failed (${res.status})`);
  }
  return res.json();
}

export async function pollGooglePhotosPickerSession(sessionId: string): Promise<{
  mediaItemsSet: boolean;
  items: MediaAsset[];
}> {
  const token = (await getDriveAccessToken()) || loadOAuthToken()?.accessToken;
  if (!token) throw new Error('OAuth session expired.');
  const res = await fetch(`/api/photos/session/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to poll Google Photos session (${res.status})`);
  }
  const data = await res.json();
  const mapped = Array.isArray(data.mediaItems) ? data.mediaItems.map(mapPickedPhotoToAsset) : [];
  return { mediaItemsSet: Boolean(data.mediaItemsSet), items: mapped };
}

export function mapGooglePhotosLibraryItem(item: any): MediaAsset {
  return mapPickedPhotoToAsset({
    id: item.id,
    createTime: item.mediaMetadata?.creationTime,
    type: item.mimeType?.startsWith('video/') ? 'VIDEO' : 'PHOTO',
    mediaFile: {
      baseUrl: item.baseUrl,
      mimeType: item.mimeType || 'image/jpeg',
      filename: item.filename || `photo_${item.id}.jpg`,
      mediaFileMetadata: {
        width: item.mediaMetadata?.width ? Number(item.mediaMetadata.width) : undefined,
        height: item.mediaMetadata?.height ? Number(item.mediaMetadata.height) : undefined,
        cameraMake: item.mediaMetadata?.photo?.cameraMake,
        cameraModel: item.mediaMetadata?.photo?.cameraModel,
      },
    },
  });
}

function mapRawAlbums(rawAlbums: any[], isShared = false): GooglePhotosAlbum[] {
  return rawAlbums.map((a: any) => ({
    id: a.id,
    title: a.title || 'Untitled Album',
    productUrl: a.productUrl,
    mediaItemsCount: a.mediaItemsCount,
    coverPhotoBaseUrl: a.coverPhotoBaseUrl,
    coverThumbnailUrl: a.coverPhotoBaseUrl ? buildGooglePhotosProxyUrl(a.coverPhotoBaseUrl, 'thumb') : undefined,
    isShared,
  }));
}

/**
 * Load real Google Photos Albums, Shared Albums, and Media Items via `/api/photos/library`.
 * Never silently substitutes Google Drive files.
 */
export async function autoLoadGooglePhotosLibrary(): Promise<{
  items: MediaAsset[];
  albums: GooglePhotosAlbum[];
  policyRestricted: boolean;
  errorDetail?: string;
}> {
  const token = loadOAuthToken()?.accessToken;
  if (!token) {
    return { items: [], albums: [], policyRestricted: false };
  }

  try {
    const res = await fetchWithBackoff('/api/photos/library', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return { items: [], albums: [], policyRestricted: res.status === 403 || res.status === 401 };
    }
    const data = await res.json();
    const rawItems = Array.isArray(data.mediaItems) ? data.mediaItems : [];
    const ownAlbums = mapRawAlbums(Array.isArray(data.albums) ? data.albums : [], false);
    const sharedAlbums = mapRawAlbums(Array.isArray(data.sharedAlbums) ? data.sharedAlbums : [], true);
    const items = rawItems.map(mapGooglePhotosLibraryItem);
    const albums = [...ownAlbums, ...sharedAlbums];
    if (items.length > 0) saveGooglePhotosAssets(items);
    if (albums.length > 0) saveGooglePhotosAlbums(albums);
    return {
      items,
      albums,
      policyRestricted: Boolean(data.policyRestricted),
      errorDetail: typeof data.errorDetail === 'string' ? data.errorDetail : undefined,
    };
  } catch {
    return { items: [], albums: [], policyRestricted: false };
  }
}

export async function fetchGooglePhotosAlbumItems(albumId: string): Promise<MediaAsset[]> {
  const token = loadOAuthToken()?.accessToken;
  if (!token) throw new Error('Connect Google account first.');
  const res = await fetchWithBackoff('/api/photos/album-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ albumId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load album items (${res.status})`);
  }
  const data = await res.json();
  return Array.isArray(data.mediaItems) ? data.mediaItems.map(mapGooglePhotosLibraryItem) : [];
}

export async function createGooglePhotosAlbum(title: string): Promise<GooglePhotosAlbum> {
  const token = loadOAuthToken()?.accessToken;
  if (!token) throw new Error('Connect Google account first.');
  const res = await fetchWithBackoff('/api/photos/albums', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create album (${res.status})`);
  }
  const data = await res.json();
  return {
    id: data.id,
    title: data.title || title,
    productUrl: data.productUrl,
    mediaItemsCount: '0',
    isShared: false,
  };
}

/**
 * Live Google Photos Library API content-category search (e.g. PETS, ANIMALS, LANDSCAPES, RECEIPTS).
 * Requires `photoslibrary.readonly` scope; gracefully returns `{ needsScope: true }` if unauthorized.
 */
export async function searchGooglePhotosLive(
  categories: string[],
  pageSize = 20
): Promise<{ items: MediaAsset[]; needsScope: boolean; error?: string }> {
  const token = (await getDriveAccessToken()) || loadOAuthToken()?.accessToken;
  if (!token) {
    return { items: [], needsScope: true, error: 'Google OAuth not connected.' };
  }
  try {
    const res = await fetchWithBackoff('/api/photos/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        categories: categories.length > 0 ? categories : ['PETS', 'ANIMALS'],
        pageSize,
      }),
    });
    if (res.status === 401 || res.status === 403) {
      return { items: [], needsScope: true, error: 'Google Photos Library scope not granted.' };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { items: [], needsScope: false, error: err.error || `Photos search failed (${res.status})` };
    }
    const data = await res.json();
    const items = Array.isArray(data.mediaItems) ? data.mediaItems.map(mapGooglePhotosLibraryItem) : [];
    return { items, needsScope: false };
  } catch (err: any) {
    return { items: [], needsScope: false, error: err?.message || 'Photos search failed' };
  }
}
