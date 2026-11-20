/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Storage Janitor & Ghost File Elimination Service
 * Manages comprehensive and smart cleanup of caches, temporary blobs,
 * ghost records, and provides atomic storage flush capabilities.
 */

import { blobRegistry, dismountMountedDirectory } from './localFileSystem';
import {
  clearCatalog,
  purgeCloudData,
  pruneGhostAssets,
  getStorageStats,
} from './catalogDb';
import { clearOAuthToken, getOAuthTokenRecord, isTokenExpired } from './oauthStorage';
import { resetGoogleDriveMemoryCache, logoutDrive } from './googleDrive';
import { butlerEngine } from './butler/butlerEngine';
import { googleMusicEngine } from './googleMusicEngine';
import { geminiUniversalEngine } from './geminiUniversalEngine';
import { MediaAsset, FolderNode } from '../types';

export interface CleanupReport {
  prunedAssets: number;
  prunedHandles: number;
  cachesPurged: number;
  revokedBlobs: number;
  timestamp: string;
}

// Purge browser CacheStorage (HTTP & Service Worker request caches)
export async function purgeBrowserCaches(): Promise<number> {
  let count = 0;
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await caches.keys();
      for (const key of keys) {
        const deleted = await caches.delete(key);
        if (deleted) count++;
      }
    } catch (err) {
      console.warn('CacheStorage purge notice:', err);
    }
  }
  return count;
}

// Perform smart cleanup of orphaned ghost records, dead blob URLs, and stale caches
export async function performSmartCleanup(activeAssetIds: Set<string> = new Set()): Promise<CleanupReport> {
  const initialBlobCount = blobRegistry.size();
  
  // 1. Revoke any unused in-memory blob URLs
  if (activeAssetIds.size > 0) {
    blobRegistry.revokeUnused(activeAssetIds);
  }
  const revokedBlobs = Math.max(0, initialBlobCount - blobRegistry.size());

  // 2. Prune orphaned assets and dead directory handles in IndexedDB
  const { prunedAssets, prunedHandles } = await pruneGhostAssets();

  // 3. Purge CacheStorage
  const cachesPurged = await purgeBrowserCaches();

  return {
    prunedAssets,
    prunedHandles,
    cachesPurged,
    revokedBlobs,
    timestamp: new Date().toISOString(),
  };
}

// Dismount a single local folder and eliminate all its ghost assets
export async function dismountFolder(
  folderId: string,
  assetIds?: string[]
): Promise<{ success: boolean; revokedCount: number }> {
  return await dismountMountedDirectory(folderId, assetIds);
}

// Dismount all mounted local folders at once
export async function dismountAllLocalFolders(
  folders: FolderNode[]
): Promise<{ dismountedFolders: number; revokedBlobs: number }> {
  const localFolders = folders.filter((f) => f.source === 'local');
  let revokedBlobs = 0;

  for (const f of localFolders) {
    const res = await dismountMountedDirectory(f.id);
    if (res.success) {
      revokedBlobs += res.revokedCount;
    }
  }

  // Also ensure all registered blob URLs are revoked
  blobRegistry.revokeAll();

  return {
    dismountedFolders: localFolders.length,
    revokedBlobs,
  };
}

// Purge all synced cloud catalog data from IndexedDB
export async function purgeSyncedCloudCatalog(): Promise<{ deletedAssets: number; deletedFolders: number }> {
  return await purgeCloudData();
}

// Clean up all old, expired, and stale authentication sessions and synchronization keys
export function cleanOldSessions(): { cleanedCount: number; keysRemoved: string[] } {
  // Only remove legacy and temporary migration keys — NEVER wipe active valid tokens
  const legacyKeysToRemove = [
    'drive_therapy_oauth_token',
    'drive_auth_record',
    'drive_auth_sync',
    'dt_synced_token',
    'dt_oauth_state',
    'dt_oauth_verifier',
    'dt_pre_restore_snapshot',
  ];

  let cleanedCount = 0;
  const keysRemoved: string[] = [];

  if (typeof window !== 'undefined') {
    // 1. Only purge dt_oauth_session_v2 if the token is actually expired or invalid
    const record = getOAuthTokenRecord();
    if (record && isTokenExpired(record, 0)) {
      clearOAuthToken();
      resetGoogleDriveMemoryCache();
      cleanedCount++;
      keysRemoved.push('dt_oauth_session_v2 (expired token)');
    }

    // 2. Remove all legacy or stale sync keys from both localStorage and sessionStorage
    for (const key of legacyKeysToRemove) {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        cleanedCount++;
        keysRemoved.push(`localStorage:${key}`);
      }
      if (sessionStorage.getItem(key)) {
        sessionStorage.removeItem(key);
        cleanedCount++;
        keysRemoved.push(`sessionStorage:${key}`);
      }
    }

    // 3. If token was expired, notify server to revoke stale cookie
    if (keysRemoved.includes('dt_oauth_session_v2 (expired token)')) {
      try {
        fetch('/api/auth/google/revoke', { method: 'POST', credentials: 'include' }).catch(() => {});
      } catch {
        // Ignored
      }
    }
  }

  return { cleanedCount, keysRemoved };
}

// Complete Atomic Session Disconnect & Teardown
export async function terminateAllSessions(): Promise<{ cleanedCount: number; keysRemoved: string[] }> {
  // 1. Reset in-memory cached token record in googleDrive service
  resetGoogleDriveMemoryCache();

  // 2. Logout Firebase Auth and Google Drive
  try {
    await logoutDrive();
  } catch (e) {
    console.warn('logoutDrive notice during session termination:', e);
  }

  // 3. Clear OAuth tokens from storage
  clearOAuthToken();

  // 4. Purge all legacy and session keys
  const allKeys = [
    'dt_oauth_session_v2',
    'drive_therapy_oauth_token',
    'drive_auth_record',
    'drive_auth_sync',
    'dt_synced_token',
    'dt_oauth_state',
    'dt_oauth_verifier',
    'dt_pre_restore_snapshot',
  ];
  let cleanedCount = 0;
  const keysRemoved: string[] = [];

  if (typeof window !== 'undefined') {
    for (const key of allKeys) {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        cleanedCount++;
        keysRemoved.push(`localStorage:${key}`);
      }
      if (sessionStorage.getItem(key)) {
        sessionStorage.removeItem(key);
        cleanedCount++;
        keysRemoved.push(`sessionStorage:${key}`);
      }
    }

    // 5. Revoke server-side cookie
    try {
      await fetch('/api/auth/google/revoke', { method: 'POST', credentials: 'include' });
    } catch {
      // Ignored
    }

    // 6. Broadcast disconnect event across browser tabs
    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('drive_therapy_auth');
        bc.postMessage({ type: 'DRIVE_AUTH_LOGOUT' });
        bc.close();
      }
    } catch {
      // Ignored
    }
  }

  return { cleanedCount, keysRemoved };
}

// Clear all auth sessions, tokens, and synchronization keys
export async function clearAuthSessionsAndTokens(): Promise<void> {
  await terminateAllSessions();
}

async function deleteIndexedDbDatabase(dbName: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
      setTimeout(resolve, 1500);
    } catch {
      resolve();
    }
  });
}

// Complete Atomic Factory Reset: Zero-Residue Wipe of ALL Local Storage, Session Storage,
// IndexedDB Databases, In-Memory Singletons, Browser Caches, Cookies, and Server Session Vault.
export async function flushAllStorage(): Promise<boolean> {
  try {
    // 1. Revoke all in-memory Blob URLs to immediately release browser heap memory
    blobRegistry.revokeAll();

    // 2. Await full OAuth session & Firebase sign-out teardown
    await clearAuthSessionsAndTokens();

    // 3. Reset all in-memory singletons so zero user PII/state survives in RAM
    try {
      butlerEngine.resetAllState();
    } catch {}
    try {
      await googleMusicEngine.clearDriveLibrary();
    } catch {}
    try {
      geminiUniversalEngine.setApiKey('');
    } catch {}

    // 4. Clear catalog stores & delete ALL IndexedDB databases (catalog, music cache, Firebase Auth, etc.)
    try {
      await clearCatalog();
    } catch {}
    const knownDbs = new Set<string>([
      'drive_therapy_catalog_v2',
      'music_library_cache_v1',
      'firebaseLocalStorageDb',
      'firebase-heartbeat-database',
      'firebase-installations-database',
    ]);
    if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
      try {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          if (db?.name) knownDbs.add(db.name);
        }
      } catch {}
    }
    await Promise.all(Array.from(knownDbs).map((name) => deleteIndexedDbDatabase(name)));

    // 5. Purge browser CacheStorage (Service Worker & HTTP caches)
    await purgeBrowserCaches();

    // 6. Atomically wipe 100% of localStorage & sessionStorage (zero allowlist gaps!)
    if (typeof window !== 'undefined') {
      try {
        localStorage.clear();
      } catch {}
      try {
        sessionStorage.clear();
      } catch {}

      // 7. Destroy server-side HttpOnly session vault (dt_sid) & trigger Clear-Site-Data
      try {
        await fetch('/api/system/factory-reset', {
          method: 'POST',
          credentials: 'same-origin',
        });
      } catch {}

      // 8. Broadcast logout across all open tabs
      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('drive_therapy_auth');
          bc.postMessage({ type: 'DRIVE_AUTH_LOGOUT' });
          bc.close();
        }
      } catch {}
    }

    return true;
  } catch (err) {
    console.error('Failed to flush storage:', err);
    return false;
  }
}

export { getStorageStats };
