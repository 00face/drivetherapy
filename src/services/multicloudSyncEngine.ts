/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Multicloud Direct Cloud-to-Cloud Sync Engine
 * Phase 1 (Active): Google Workspace Core — Direct Server-Side Google Photos → Google Drive
 * streaming (zero client download/re-upload) and native Google Drive cloud-side copy.
 * Phase 2 (Ready Connectors): OneDrive, SharePoint, Dropbox, Wasabi, S3/R2/B2, Flickr, iCloud, WebDAV, FTP.
 */

import { getDriveAccessToken } from './googleDrive';

export type MulticloudConnectorStatus = 'active' | 'phase2-ready';

export interface MulticloudConnectorDef {
  id: string;
  name: string;
  tier: 'google-workspace' | 'external-cloud';
  status: MulticloudConnectorStatus;
  capabilities: string[];
  description: string;
}

export interface MulticloudTransferItem {
  id: string;
  name: string;
  baseUrl?: string;
  mimeType?: string;
  driveFileId?: string;
}

export interface MulticloudTransferResult {
  sourceId: string;
  name: string;
  status: 'transferred' | 'failed';
  destinationFileId?: string;
  webViewLink?: string;
  error?: string;
}

export interface MulticloudJobRecord {
  id: string;
  sourceConnector: string;
  destinationConnector: string;
  destinationFolderName: string;
  startedAt: string;
  completedAt: string;
  totalItems: number;
  transferredCount: number;
  failedCount: number;
  results: MulticloudTransferResult[];
}

export const MULTICLOUD_CONNECTORS: MulticloudConnectorDef[] = [
  // Tier 1: Google Workspace Core (Tight & Active)
  {
    id: 'google-photos',
    name: 'Google Photos (Picker)',
    tier: 'google-workspace',
    status: 'active',
    capabilities: ['source', 'direct-stream-to-drive'],
    description: 'Pick up to 2,000 photos per session and stream directly into Google Drive without local downloads.',
  },
  {
    id: 'google-drive',
    name: 'Google Drive / Workspace',
    tier: 'google-workspace',
    status: 'active',
    capabilities: ['source', 'destination', 'cloud-side-copy'],
    description: 'Direct multipart destination & zero-bandwidth cloud-side file copy across folders & Shared Drives.',
  },
  {
    id: 'gcs',
    name: 'Google Cloud Storage (GCS)',
    tier: 'google-workspace',
    status: 'active',
    capabilities: ['source', 'cold-archive'],
    description: 'Cold archive buckets for RAW & 4K masters outside personal Drive quota.',
  },
  {
    id: 'local-os',
    name: 'Local OS Disk',
    tier: 'google-workspace',
    status: 'active',
    capabilities: ['source', 'destination'],
    description: 'Loopback-protected host filesystem folders with non-destructive indexing.',
  },

  // Tier 2: External Clouds (Phase 2 Adapters Ready)
  {
    id: 'onedrive',
    name: 'Microsoft OneDrive',
    tier: 'external-cloud',
    status: 'phase2-ready',
    capabilities: ['source', 'destination'],
    description: 'Microsoft Graph API cloud-to-cloud transfer adapter (Phase 2).',
  },
  {
    id: 'sharepoint',
    name: 'SharePoint Online',
    tier: 'external-cloud',
    status: 'phase2-ready',
    capabilities: ['source', 'destination'],
    description: 'Enterprise document libraries & team sites sync (Phase 2).',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    tier: 'external-cloud',
    status: 'phase2-ready',
    capabilities: ['source', 'destination'],
    description: 'Dropbox API v2 direct cloud transfer & folder mirror (Phase 2).',
  },
  {
    id: 'wasabi',
    name: 'Wasabi / S3 / R2 / Backblaze B2',
    tier: 'external-cloud',
    status: 'phase2-ready',
    capabilities: ['source', 'destination'],
    description: 'S3-compatible object storage sync with SigV4 streaming (Phase 2).',
  },
  {
    id: 'flickr',
    name: 'Flickr',
    tier: 'external-cloud',
    status: 'phase2-ready',
    capabilities: ['source'],
    description: 'Photo archive migration into Google Drive / GCS (Phase 2).',
  },
  {
    id: 'icloud',
    name: 'iCloud Drive & iCloud Photos',
    tier: 'external-cloud',
    status: 'phase2-ready',
    capabilities: ['source', 'destination'],
    description: 'Apple iCloud cloud-to-cloud migration bridge (Phase 2).',
  },
  {
    id: 'webdav',
    name: 'Nextcloud / ownCloud (WebDAV)',
    tier: 'external-cloud',
    status: 'phase2-ready',
    capabilities: ['source', 'destination'],
    description: 'Self-hosted WebDAV server synchronization (Phase 2).',
  },
  {
    id: 'ftp',
    name: 'FTP / SFTP',
    tier: 'external-cloud',
    status: 'phase2-ready',
    capabilities: ['source', 'destination'],
    description: 'Direct studio NAS & remote SFTP server transfers (Phase 2).',
  },
];

const MULTICLOUD_JOBS_KEY = 'dt_multicloud_jobs_v1';

/**
 * Strict SSRF allowlist for direct server-side Google Photos media streaming.
 */
export function isAllowedGooglePhotosMediaUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'lh3.googleusercontent.com' ||
      host.endsWith('.googleusercontent.com') ||
      host === 'photos.googleapis.com'
    );
  } catch {
    return false;
  }
}

export function loadMulticloudJobs(): MulticloudJobRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MULTICLOUD_JOBS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function saveMulticloudJob(job: MulticloudJobRecord): MulticloudJobRecord[] {
  const next = [job, ...loadMulticloudJobs()].slice(0, 20);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(MULTICLOUD_JOBS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}

/**
 * Direct Server-Side Google Photos → Google Drive streaming transfer
 * (no local download or browser upload).
 */
export async function transferPhotosToDriveDirect(
  items: MulticloudTransferItem[],
  destinationFolderId?: string,
  destinationFolderName = 'My Drive'
): Promise<MulticloudJobRecord> {
  const token = await getDriveAccessToken();
  if (!token) throw new Error('Connect Google OAuth before transferring files.');

  const startedAt = new Date().toISOString();
  const res = await fetch('/api/multicloud/photos-to-drive', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      items,
      destinationFolderId: destinationFolderId || undefined,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Multicloud transfer failed (${res.status})`);
  }

  const results: MulticloudTransferResult[] = Array.isArray(data.results) ? data.results : [];
  const job: MulticloudJobRecord = {
    id: `mc_${Date.now()}`,
    sourceConnector: 'Google Photos (Picker)',
    destinationConnector: 'Google Drive',
    destinationFolderName,
    startedAt,
    completedAt: new Date().toISOString(),
    totalItems: items.length,
    transferredCount: results.filter((r) => r.status === 'transferred').length,
    failedCount: results.filter((r) => r.status === 'failed').length,
    results,
  };
  saveMulticloudJob(job);
  return job;
}

/**
 * Native Google Drive cloud-side file copy (zero bandwidth).
 */
export async function copyDriveFilesCloudSide(
  items: MulticloudTransferItem[],
  destinationFolderId?: string,
  destinationFolderName = 'My Drive'
): Promise<MulticloudJobRecord> {
  const token = await getDriveAccessToken();
  if (!token) throw new Error('Connect Google OAuth before copying Drive files.');

  const startedAt = new Date().toISOString();
  const res = await fetch('/api/multicloud/drive-copy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      items,
      destinationFolderId: destinationFolderId || undefined,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Drive cloud copy failed (${res.status})`);
  }

  const results: MulticloudTransferResult[] = Array.isArray(data.results) ? data.results : [];
  const job: MulticloudJobRecord = {
    id: `mc_${Date.now()}`,
    sourceConnector: 'Google Drive',
    destinationConnector: 'Google Drive',
    destinationFolderName,
    startedAt,
    completedAt: new Date().toISOString(),
    totalItems: items.length,
    transferredCount: results.filter((r) => r.status === 'transferred').length,
    failedCount: results.filter((r) => r.status === 'failed').length,
    results,
  };
  saveMulticloudJob(job);
  return job;
}
