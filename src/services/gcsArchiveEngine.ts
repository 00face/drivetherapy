/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Cloud Storage (GCS) Bucket Browser Service
 */

import { MediaAsset, MediaCategory } from '../types';
import { loadOAuthToken } from './googleDrive';

export interface GcsBucket {
  id: string;
  name: string;
  location?: string;
  storageClass?: string;
}

export interface GcsObjectItem {
  id: string;
  name: string;
  bucket: string;
  contentType?: string;
  size?: string;
  updated?: string;
  mediaLink?: string;
}

function classifyGcsMime(mime: string): MediaCategory {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.includes('zip') || mime.includes('tar')) return 'archive';
  return 'document';
}

export function mapGcsObjectToAsset(obj: GcsObjectItem, accessToken?: string): MediaAsset {
  const mime = obj.contentType || 'application/octet-stream';
  const extMatch = obj.name.match(/\.([^.]+)$/);
  const ext = extMatch ? extMatch[1].toUpperCase() : 'FILE';
  const cat = classifyGcsMime(mime);
  const encodedPath = obj.name.split('/').map(encodeURIComponent).join('/');
  const tokenQuery = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
  const proxyStreamUrl = `/api/gcs/stream/${encodeURIComponent(obj.bucket)}/${encodedPath}${tokenQuery}`;
  return {
    id: `gcs_${obj.bucket}_${obj.name}`,
    name: obj.name.split('/').pop() || obj.name,
    source: 'cloud',
    category: cat,
    mimeType: mime,
    extension: ext,
    path: `GCS/${obj.bucket}/${obj.name}`,
    sizeBytes: Number(obj.size || 0),
    modifiedTime: obj.updated || new Date().toISOString(),
    cloudUrl: proxyStreamUrl,
    thumbnailUrl: '',
    isCached: false,
    cullingStatus: 'unrated',
    rating: 0,
    tags: ['GCS', obj.bucket],
    faces: [],
    quality: { sharpness: 85, exposure: 85, overall: 85, isBlurry: false },
    palette: [],
    exif: {},
  };
}

export async function fetchGcsBuckets(): Promise<GcsBucket[]> {
  const token = loadOAuthToken()?.accessToken;
  if (!token) throw new Error('Connect Google account first.');
  const res = await fetch('/api/gcs/buckets', { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `GCS bucket list failed (${res.status})`);
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchGcsObjects(bucket: string): Promise<MediaAsset[]> {
  const token = loadOAuthToken()?.accessToken;
  if (!token) throw new Error('Connect Google account first.');
  const res = await fetch(`/api/gcs/objects/${encodeURIComponent(bucket)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `GCS objects fetch failed (${res.status})`);
  return Array.isArray(data.items)
    ? data.items.map((item: GcsObjectItem) => mapGcsObjectToAsset({ ...item, bucket }, token))
    : [];
}
