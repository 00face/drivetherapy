/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-103] Unified Cloud Virtual File System (CloudVfsAdapter)
 * Normalizes Dropbox API v2, Microsoft Graph (OneDrive/SharePoint), S3-Compatible (Wasabi/R2),
 * and WebDAV into one consistent File Manager + Context Menu + Catalog contract.
 */

import type { MediaAsset } from '../types';
import type { ExternalCloudConnection, ExternalCloudProviderId } from './externalCloudAuth';

export interface CloudVfsItem {
  id: string;
  providerId: ExternalCloudProviderId;
  name: string;
  path: string;
  isFolder: boolean;
  mimeType: string;
  sizeBytes: number;
  modifiedAt: string;
  thumbnailUrl?: string;
  streamUrl?: string;
}

export interface CloudVfsListResult {
  providerId: ExternalCloudProviderId;
  currentPath: string;
  items: CloudVfsItem[];
  nextCursor?: string | null;
  source: 'live-api' | 'not-connected' | 'error';
  message?: string;
}

export async function listExternalCloudFolder(
  connection: ExternalCloudConnection | undefined,
  providerId: ExternalCloudProviderId,
  folderPath = '/'
): Promise<CloudVfsListResult> {
  if (!connection || !connection.connected) {
    return {
      providerId,
      currentPath: folderPath,
      items: [],
      source: 'not-connected',
      message: 'Connect this cloud account via the OAuth / Credential Wizard to browse live files.',
    };
  }

  try {
    const res = await fetch(`/api/clouds/${encodeURIComponent(providerId)}/list`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: folderPath,
        endpointUrl: connection.endpointUrl,
        bucket: connection.bucket,
        region: connection.region,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        providerId,
        currentPath: folderPath,
        items: [],
        source: 'error',
        message: data?.error || `HTTP ${res.status}`,
      };
    }
    return {
      providerId,
      currentPath: data.currentPath || folderPath,
      items: Array.isArray(data.items) ? data.items : [],
      nextCursor: data.nextCursor || null,
      source: 'live-api',
      message: data.message,
    };
  } catch (err) {
    return {
      providerId,
      currentPath: folderPath,
      items: [],
      source: 'error',
      message: err instanceof Error ? err.message : 'Network error reaching cloud gateway',
    };
  }
}

export function cloudVfsItemToMediaAsset(item: CloudVfsItem): MediaAsset {
  const ext = item.name.includes('.') ? item.name.split('.').pop()?.toLowerCase() || 'bin' : 'bin';
  const isRawExt = ['cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2'].includes(ext);
  const category = isRawExt
    ? 'raw'
    : item.mimeType.startsWith('image/')
    ? 'image'
    : item.mimeType.startsWith('video/')
    ? 'video'
    : item.mimeType.startsWith('audio/')
    ? 'audio'
    : 'document';

  return {
    id: `ext_${item.providerId}_${item.id}`,
    name: item.name,
    source: 'cloud',
    category,
    mimeType: item.mimeType || 'application/octet-stream',
    extension: ext,
    path: `/${item.providerId}${item.path.startsWith('/') ? item.path : `/${item.path}`}`,
    sizeBytes: item.sizeBytes || 0,
    modifiedTime: item.modifiedAt || new Date().toISOString(),
    thumbnailUrl: item.thumbnailUrl || '',
    previewUrl: item.streamUrl || item.thumbnailUrl || '',
    isCached: false,
    cullingStatus: 'unrated',
    rating: 0,
    tags: ['external-cloud', item.providerId],
    faces: [],
    palette: [],
    exif: {},
    quality: {
      sharpness: 80,
      isBlurry: false,
    },
  };
}
