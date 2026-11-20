/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pluggable Cloud & Multi-Storage Provider Registry (A+ Tier)
 * Extensible backend adapter for S3 / Cloudflare R2 / Backblaze B2,
 * Dropbox API v2, and self-hosted Nextcloud / WebDAV.
 */

import { MediaAsset, FolderNode } from '../types';

export type StorageBackendType =
  | 'google-drive'
  | 'local-os'
  | 's3-compatible'
  | 'dropbox'
  | 'webdav';

export interface StorageBackendConfig {
  id: string;
  type: StorageBackendType;
  name: string;
  enabled: boolean;
  endpoint?: string;        // S3 / R2 / Backblaze endpoint or Nextcloud WebDAV URL
  region?: string;          // e.g. 'auto', 'us-east-1'
  bucket?: string;          // S3 bucket name
  accessKeyId?: string;     // S3 / R2 access key
  secretAccessKey?: string; // S3 / R2 secret key
  username?: string;        // WebDAV username
  password?: string;        // WebDAV password / app token
  dropboxAccessToken?: string;
  lastConnectedAt?: number;
}

export const DEFAULT_STORAGE_BACKENDS: StorageBackendConfig[] = [
  {
    id: 'backend_gdrive',
    type: 'google-drive',
    name: 'Google Drive',
    enabled: true,
  },
  {
    id: 'backend_local',
    type: 'local-os',
    name: 'Local Computer (Direct OS)',
    enabled: true,
  },
  {
    id: 'backend_cloudflare_r2',
    type: 's3-compatible',
    name: 'Cloudflare R2 (S3-Compatible)',
    endpoint: 'https://<account_id>.r2.cloudflarestorage.com',
    region: 'auto',
    enabled: false,
  },
  {
    id: 'backend_backblaze_b2',
    type: 's3-compatible',
    name: 'Backblaze B2 (S3-Compatible)',
    endpoint: 'https://s3.us-west-004.backblazeb2.com',
    region: 'us-west-004',
    enabled: false,
  },
  {
    id: 'backend_nextcloud',
    type: 'webdav',
    name: 'Nextcloud / ownCloud (WebDAV)',
    endpoint: 'https://cloud.example.com/remote.php/dav/files/user/',
    enabled: false,
  },
  {
    id: 'backend_dropbox',
    type: 'dropbox',
    name: 'Dropbox',
    enabled: false,
  },
];

const STORAGE_BACKENDS_KEY = 'dt_storage_backends_v1';
let inMemoryBackends: StorageBackendConfig[] = [...DEFAULT_STORAGE_BACKENDS];
let activeBackendId = 'backend_gdrive';

/**
 * Load all configured storage backends
 */
export function loadStorageBackends(): StorageBackendConfig[] {
  if (typeof window === 'undefined') return [...inMemoryBackends];
  try {
    const raw = localStorage.getItem(STORAGE_BACKENDS_KEY);
    if (!raw) return [...inMemoryBackends];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...inMemoryBackends];
  } catch {
    return [...inMemoryBackends];
  }
}

/**
 * Persist storage backend configurations
 */
export function persistStorageBackends(backends: StorageBackendConfig[]): void {
  inMemoryBackends = [...backends];
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_BACKENDS_KEY, JSON.stringify(backends));
  } catch (err) {
    console.warn('[StorageRegistry] Failed to save backends:', err);
  }
}

/**
 * Get the currently active storage backend
 */
export function getActiveStorageBackend(): StorageBackendConfig {
  const backends = loadStorageBackends();
  return backends.find((b) => b.id === activeBackendId && b.enabled) || backends[0];
}

/**
 * Set active storage backend
 */
export function setActiveStorageBackend(backendId: string): StorageBackendConfig | null {
  const backends = loadStorageBackends();
  const target = backends.find((b) => b.id === backendId);
  if (target) {
    target.enabled = true;
    activeBackendId = backendId;
    persistStorageBackends(backends);
    return target;
  }
  return null;
}

/**
 * Configure S3 / R2 / Backblaze credentials
 */
export function configureS3Backend(
  id: string,
  config: { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string; region?: string }
): StorageBackendConfig {
  const backends = loadStorageBackends();
  let target = backends.find((b) => b.id === id);

  if (!target) {
    target = {
      id,
      type: 's3-compatible',
      name: config.bucket,
      enabled: true,
      ...config,
    };
    backends.push(target);
  } else {
    Object.assign(target, config, { enabled: true });
  }

  persistStorageBackends(backends);
  return target;
}

/**
 * Configure Nextcloud / WebDAV credentials
 */
export function configureWebDavBackend(
  id: string,
  config: { endpoint: string; username: string; password?: string }
): StorageBackendConfig {
  const backends = loadStorageBackends();
  let target = backends.find((b) => b.id === id);

  if (!target) {
    target = {
      id,
      type: 'webdav',
      name: 'Nextcloud WebDAV',
      enabled: true,
      ...config,
    };
    backends.push(target);
  } else {
    Object.assign(target, config, { enabled: true });
  }

  persistStorageBackends(backends);
  return target;
}

/**
 * AWS Signature Version 4 Canonical Request Builder (for S3 / Cloudflare R2)
 */
export function buildS3CanonicalHeader(
  method: string,
  host: string,
  canonicalUri: string,
  amzDate: string
): { canonicalHeaders: string; signedHeaders: string } {
  const signedHeaders = 'host;x-amz-date';
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  return { canonicalHeaders, signedHeaders };
}
