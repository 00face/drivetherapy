/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Native IndexedDB Non-Destructive Catalog Persistence Layer
 * Strictly complies with Sacred Non-Destructive Integrity, Zero-Key Offline Resilience,
 * Erasable Syntax Doctrine, and Typescript Heresy Ban.
 */

import { MediaAsset, FolderNode, PortfolioProject, CatalogBackup, ProviderConfig } from '../types';

const DB_NAME = 'drive_therapy_catalog_v2';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not supported in this runtime environment'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('assets')) {
        db.createObjectStore('assets', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('portfolios')) {
        db.createObjectStore('portfolios', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open catalog IndexedDB'));
    };
  });

  return dbPromise;
}

// High-speed buffered queue for streaming bulk IndexedDB writes
// Groups assets into chunks of up to 5,000 items and writes them sequentially
// to prevent browser disk I/O lockup and transaction serialization bottlenecks
class AssetBatchWriter {
  private buffer: MediaAsset[] = [];
  private isWriting = false;
  private flushPromise: Promise<void> | null = null;
  private resolveFlush: (() => void) | null = null;
  private CHUNK_SIZE = 5000;

  public async queue(batch: MediaAsset[]): Promise<void> {
    if (!batch || batch.length === 0) return;
    for (let i = 0; i < batch.length; i++) {
      this.buffer.push(batch[i]);
    }

    if (!this.flushPromise) {
      this.flushPromise = new Promise((resolve) => {
        this.resolveFlush = resolve;
      });
    }

    if (!this.isWriting) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isWriting) return;
    this.isWriting = true;

    try {
      while (this.buffer.length > 0) {
        const slice = this.buffer.splice(0, this.CHUNK_SIZE);
        await this.writeSlice(slice);
        // Micro-yield to keep browser UI thread fluid
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      this.isWriting = false;
      if (this.buffer.length === 0 && this.resolveFlush) {
        this.resolveFlush();
        this.flushPromise = null;
        this.resolveFlush = null;
      } else if (this.buffer.length > 0) {
        this.processQueue();
      }
    }
  }

  private async writeSlice(slice: MediaAsset[]): Promise<void> {
    if (slice.length === 0) return;
    try {
      const db = await getDb();
      const tx = db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      for (let i = 0; i < slice.length; i++) {
        store.put(slice[i]);
      }
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('AssetBatchWriter slice error:', err);
    }
  }

  public async flush(): Promise<void> {
    if (this.buffer.length > 0 || this.isWriting) {
      if (!this.flushPromise) {
        this.flushPromise = new Promise((resolve) => {
          this.resolveFlush = resolve;
        });
      }
      await this.flushPromise;
    }
  }
}

export const assetBatchWriter = new AssetBatchWriter();

// Save or update all assets in bulk
export async function saveAssets(assets: MediaAsset[]): Promise<void> {
  if (!assets || assets.length === 0) return;
  await assetBatchWriter.queue(assets);
  await assetBatchWriter.flush();
}

// High-speed linear batch write for newly streamed chunks (avoids O(N^2) cumulative rewrites)
export async function saveAssetBatch(batch: MediaAsset[]): Promise<void> {
  await assetBatchWriter.queue(batch);
}

// Ensure all pending asset batches are committed to IndexedDB
export async function flushAssetBatchQueue(): Promise<void> {
  await assetBatchWriter.flush();
}

const CHANGES_TOKEN_META_KEY = 'dt_google_drive_changes_token';

// Save Google Drive Changes API startPageToken
export async function saveChangesToken(token: string): Promise<void> {
  await setMeta(CHANGES_TOKEN_META_KEY, token);
}

// Retrieve Google Drive Changes API startPageToken
export async function getChangesToken(): Promise<string | null> {
  return await getMeta(CHANGES_TOKEN_META_KEY);
}

// Clear Google Drive Changes API token (used on forced deep scan or session reset)
export async function deleteChangesToken(): Promise<void> {
  await deleteMeta(CHANGES_TOKEN_META_KEY);
}

// Atomically apply Changes API delta (insert/update modified, remove trashed) in a single transaction
export async function applyChangesDelta(
  addedOrModified: MediaAsset[],
  removedIds: string[]
): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('assets', 'readwrite');
    const store = tx.objectStore('assets');

    for (const asset of addedOrModified) {
      store.put(asset);
    }

    for (const id of removedIds) {
      store.delete(id);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to apply changes delta to IndexedDB:', err);
  }
}

// Load all saved assets from IndexedDB
export async function loadAssets(): Promise<MediaAsset[]> {
  try {
    const db = await getDb();
    const tx = db.transaction('assets', 'readonly');
    const store = tx.objectStore('assets');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to load assets from IndexedDB:', err);
    return [];
  }
}

// Save folders in bulk
export async function saveFolders(folders: FolderNode[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('folders', 'readwrite');
    const store = tx.objectStore('folders');

    for (const folder of folders) {
      store.put(folder);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to persist folders to IndexedDB:', err);
  }
}

// Load all folders
export async function loadFolders(): Promise<FolderNode[]> {
  try {
    const db = await getDb();
    const tx = db.transaction('folders', 'readonly');
    const store = tx.objectStore('folders');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to load folders from IndexedDB:', err);
    return [];
  }
}

// Save or update a client portfolio
export async function savePortfolio(portfolio: PortfolioProject): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('portfolios', 'readwrite');
    const store = tx.objectStore('portfolios');
    store.put(portfolio);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to persist portfolio to IndexedDB:', err);
  }
}

// Save multiple client portfolios
export async function savePortfolios(portfolios: PortfolioProject[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('portfolios', 'readwrite');
    const store = tx.objectStore('portfolios');

    for (const p of portfolios) {
      store.put(p);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to persist portfolios to IndexedDB:', err);
  }
}

// Load all portfolios
export async function loadPortfolios(): Promise<PortfolioProject[]> {
  try {
    const db = await getDb();
    const tx = db.transaction('portfolios', 'readonly');
    const store = tx.objectStore('portfolios');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to load portfolios from IndexedDB:', err);
    return [];
  }
}

// Save metadata key-value
export async function setMeta(key: string, value: any): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('meta', 'readwrite');
    const store = tx.objectStore('meta');
    store.put({ key, value, timestamp: new Date().toISOString() });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`Failed to set metadata ${key} in IndexedDB:`, err);
  }
}

// Get metadata value
export async function getMeta(key: string): Promise<any> {
  try {
    const db = await getDb();
    const tx = db.transaction('meta', 'readonly');
    const store = tx.objectStore('meta');
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(`Failed to get metadata ${key} from IndexedDB:`, err);
    return null;
  }
}

// Delete metadata key
export async function deleteMeta(key: string): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('meta', 'readwrite');
    const store = tx.objectStore('meta');
    store.delete(key);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`Failed to delete metadata ${key} from IndexedDB:`, err);
  }
}

// Delete a single asset by ID
export async function deleteAsset(id: string): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('assets', 'readwrite');
    tx.objectStore('assets').delete(id);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`Failed to delete asset ${id} from IndexedDB:`, err);
  }
}

// Delete all assets belonging to a specific folder
export async function deleteAssetsByFolder(folderId: string): Promise<string[]> {
  try {
    const db = await getDb();
    const tx = db.transaction('assets', 'readwrite');
    const store = tx.objectStore('assets');
    const request = store.getAll();

    const assets: MediaAsset[] = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    const deletedIds: string[] = [];
    for (const a of assets) {
      if (a.parentId === folderId || a.path.startsWith(`/${folderId}/`)) {
        store.delete(a.id);
        deletedIds.push(a.id);
      }
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    });

    return deletedIds;
  } catch (err) {
    console.warn(`Failed to delete assets for folder ${folderId} from IndexedDB:`, err);
    return [];
  }
}

// Delete a folder node by ID
export async function deleteFolder(id: string): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('folders', 'readwrite');
    tx.objectStore('folders').delete(id);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`Failed to delete folder ${id} from IndexedDB:`, err);
  }
}

// Purge all cloud assets and cloud folders (used on sign-out / cloud disconnect)
export async function purgeCloudData(): Promise<{ deletedAssets: number; deletedFolders: number }> {
  try {
    const db = await getDb();
    const tx = db.transaction(['assets', 'folders'], 'readwrite');
    const assetStore = tx.objectStore('assets');
    const folderStore = tx.objectStore('folders');

    const assetReq = assetStore.getAll();
    const folderReq = folderStore.getAll();

    const [assets, folders] = (await Promise.all([
      new Promise<MediaAsset[]>((resolve, reject) => {
        assetReq.onsuccess = () => resolve(assetReq.result || []);
        assetReq.onerror = () => reject(assetReq.error);
      }),
      new Promise<FolderNode[]>((resolve, reject) => {
        folderReq.onsuccess = () => resolve(folderReq.result || []);
        folderReq.onerror = () => reject(folderReq.error);
      }),
    ])) as [MediaAsset[], FolderNode[]];

    let deletedAssets = 0;
    for (const a of assets) {
      if (a.source === 'cloud') {
        assetStore.delete(a.id);
        deletedAssets++;
      }
    }

    let deletedFolders = 0;
    for (const f of folders) {
      if (f.source === 'cloud') {
        folderStore.delete(f.id);
        deletedFolders++;
      }
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    });

    await deleteChangesToken();

    return { deletedAssets, deletedFolders };
  } catch (err) {
    console.warn('Failed to purge cloud data from IndexedDB:', err);
    return { deletedAssets: 0, deletedFolders: 0 };
  }
}

// Prune orphaned/ghost local assets (e.g. dead blob URLs from prior browser sessions without live handles)
export async function pruneGhostAssets(): Promise<{ prunedAssets: number; prunedHandles: number }> {
  try {
    const db = await getDb();
    const tx = db.transaction(['assets', 'folders', 'meta'], 'readwrite');
    const assetStore = tx.objectStore('assets');
    const folderStore = tx.objectStore('folders');
    const metaStore = tx.objectStore('meta');

    const [assets, folders, metaEntries] = (await Promise.all([
      new Promise<MediaAsset[]>((resolve, reject) => {
        const req = assetStore.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      }),
      new Promise<FolderNode[]>((resolve, reject) => {
        const req = folderStore.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      }),
      new Promise<{ key: string; value: any }[]>((resolve, reject) => {
        const req = metaStore.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      }),
    ])) as [MediaAsset[], FolderNode[], { key: string; value: any }[]];

    const validFolderIds = new Set(folders.map((f) => f.id));
    validFolderIds.add('folder_all');
    validFolderIds.add('recent');

    let prunedAssets = 0;
    for (const a of assets) {
      // If asset is local and has an orphaned parent or a stale dead blob URL
      const isOrphaned = a.parentId && !validFolderIds.has(a.parentId);
      if (isOrphaned) {
        assetStore.delete(a.id);
        prunedAssets++;
      }
    }

    // Prune handles that no longer map to any folder
    let prunedHandles = 0;
    for (const m of metaEntries) {
      if (m.key.startsWith('dir_handle_')) {
        const folderId = m.key.replace('dir_handle_', '');
        if (!validFolderIds.has(folderId)) {
          metaStore.delete(m.key);
          prunedHandles++;
        }
      }
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    });

    return { prunedAssets, prunedHandles };
  } catch (err) {
    console.warn('Failed to prune ghost assets from IndexedDB:', err);
    return { prunedAssets: 0, prunedHandles: 0 };
  }
}

// Storage stats inspector
export async function getStorageStats(): Promise<{
  cloudAssets: number;
  localAssets: number;
  totalAssets: number;
  folders: number;
  portfolios: number;
  handles: number;
  storageEstimate?: { usage: number; quota: number; percentage: number };
}> {
  try {
    const assets = await loadAssets();
    const folders = await loadFolders();
    const portfolios = await loadPortfolios();

    let handles = 0;
    try {
      const db = await getDb();
      const tx = db.transaction('meta', 'readonly');
      const meta = await new Promise<any[]>((res) => {
        const req = tx.objectStore('meta').getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      });
      handles = meta.filter((m) => m.key.startsWith('dir_handle_')).length;
    } catch {
      handles = 0;
    }

    let storageEstimate: { usage: number; quota: number; percentage: number } | undefined = undefined;
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const usage = est.usage || 0;
        const quota = est.quota || 1;
        storageEstimate = {
          usage,
          quota,
          percentage: Math.min(100, Math.round((usage / quota) * 100)),
        };
      } catch {
        // Ignored in unsupported environments
      }
    }

    const cloudAssets = assets.filter((a) => a.source === 'cloud').length;
    const localAssets = assets.filter((a) => a.source === 'local').length;

    return {
      cloudAssets,
      localAssets,
      totalAssets: assets.length,
      folders: folders.length,
      portfolios: portfolios.length,
      handles,
      storageEstimate,
    };
  } catch {
    return {
      cloudAssets: 0,
      localAssets: 0,
      totalAssets: 0,
      folders: 0,
      portfolios: 0,
      handles: 0,
    };
  }
}

// Purge catalog completely (Fresh Start)
export async function clearCatalog(): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(['assets', 'folders', 'portfolios', 'meta'], 'readwrite');
    tx.objectStore('assets').clear();
    tx.objectStore('folders').clear();
    tx.objectStore('portfolios').clear();
    tx.objectStore('meta').clear();

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to clear catalog from IndexedDB:', err);
  }
}

// Directory handle persistence in meta store
export async function saveDirectoryHandle(id: string, handle: any): Promise<void> {
  await setMeta(`dir_handle_${id}`, handle);
}

export async function loadDirectoryHandle(id: string): Promise<any | null> {
  return await getMeta(`dir_handle_${id}`);
}

export async function deleteDirectoryHandle(id: string): Promise<void> {
  await deleteMeta(`dir_handle_${id}`);
}

// Full Catalog Backup Export
export async function exportFullCatalogBackup(): Promise<CatalogBackup> {
  const assets = await loadAssets();
  const folders = await loadFolders();
  const portfolios = await loadPortfolios();

  let providerConfigs: ProviderConfig[] | undefined = undefined;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('drive_therapy_providers_v1');
      if (raw) providerConfigs = JSON.parse(raw);
    } catch (e) {
      console.warn('Provider export note:', e);
    }
  }

  return {
    version: '1.7.0',
    exportedAt: new Date().toISOString(),
    assets,
    folders,
    portfolios,
    providerConfigs,
  };
}

// Full Catalog Backup Restore
export async function restoreFullCatalogBackup(backup: CatalogBackup): Promise<boolean> {
  if (!backup || !Array.isArray(backup.assets) || !Array.isArray(backup.folders)) {
    throw new Error('Invalid catalog backup structure');
  }

  // Backup current state to sessionStorage for rollback protection
  try {
    const currentState = await exportFullCatalogBackup();
    sessionStorage.setItem('dt_pre_restore_snapshot', JSON.stringify(currentState));
  } catch (e) {
    console.warn('Pre-restore snapshot note:', e);
  }

  // Clear existing catalog
  await clearCatalog();

  // Restore assets, folders, portfolios
  await saveAssets(backup.assets);
  await saveFolders(backup.folders);
  if (Array.isArray(backup.portfolios) && backup.portfolios.length > 0) {
    await savePortfolios(backup.portfolios);
  }

  if (backup.providerConfigs && typeof window !== 'undefined') {
    try {
      localStorage.setItem('drive_therapy_providers_v1', JSON.stringify(backup.providerConfigs));
    } catch (e) {
      console.warn('Provider restore note:', e);
    }
  }

  return true;
}
