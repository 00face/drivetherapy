/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Local Operating System File System Access API
 * Supports modern showDirectoryPicker with graceful fallback for legacy browsers.
 */

import { MediaAsset, FolderNode } from '../types';
import {
  saveDirectoryHandle,
  loadDirectoryHandle,
  deleteDirectoryHandle,
  deleteAssetsByFolder,
  deleteFolder,
} from './catalogDb';
import { parseExifFromFile } from './visionWorkerClient';
import { classifyFile } from './fileFormatEngine';

// Live In-Memory Registry for Active Mounted FileSystemDirectoryHandles
const activeDirectoryHandles = new Map<string, FileSystemDirectoryHandle>();

export function getActiveDirectoryHandle(folderId: string): FileSystemDirectoryHandle | undefined {
  return activeDirectoryHandles.get(folderId);
}

export function setActiveDirectoryHandle(folderId: string, handle: FileSystemDirectoryHandle): void {
  activeDirectoryHandles.set(folderId, handle);
}

// Memory Lifecycle Manager for Object URLs
class BlobMemoryRegistry {
  private urls: Map<string, string> = new Map();

  public register(id: string, url: string): void {
    if (this.urls.has(id)) {
      this.revoke(id);
    }
    this.urls.set(id, url);
  }

  public get(id: string): string | undefined {
    return this.urls.get(id);
  }

  public revoke(id: string): void {
    const existing = this.urls.get(id);
    if (existing && typeof window !== 'undefined' && existing.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(existing);
      } catch (e) {
        console.warn('Revoke object URL error:', e);
      }
    }
    this.urls.delete(id);
  }

  public revokeAll(): void {
    for (const [id] of this.urls) {
      this.revoke(id);
    }
  }

  public revokeUnused(activeIds: Set<string>): void {
    for (const [id] of this.urls) {
      if (!activeIds.has(id)) {
        this.revoke(id);
      }
    }
  }

  public size(): number {
    return this.urls.size;
  }
}

export const blobRegistry = new BlobMemoryRegistry();

export const isFileSystemAccessSupported = (): boolean => {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
};

// Map local file to canonical MediaAsset
export const mapLocalFileToAsset = (file: File, relativePath?: string): MediaAsset => {
  const modifiedIso = new Date(file.lastModified).toISOString();
  const classification = classifyFile({
    filename: file.name,
    mimeType: file.type || '',
    sizeBytes: file.size,
    modifiedTime: modifiedIso,
  });
  const extension = (file.name.includes('.') ? file.name.split('.').pop() || '' : classification.format.extension).toUpperCase();
  const category: MediaAsset['category'] = classification.category;

  // Create local object URL for preview and register in memory registry
  const objectUrl = URL.createObjectURL(file);
  const assetId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  blobRegistry.register(assetId, objectUrl);

  return {
    id: assetId,
    name: file.name,
    source: 'local',
    category,
    mimeType: file.type || classification.mimeType,
    extension,
    path: relativePath || `/Local OS/${file.name}`,
    sizeBytes: file.size,
    modifiedTime: modifiedIso,
    thumbnailUrl: objectUrl,
    cloudUrl: undefined,
    isCached: true,
    cullingStatus: 'unrated',
    rating: 0,
    tags: ['Local Storage', category.toUpperCase(), extension],
    faces: [],
    quality: {
      sharpness: 90,
      exposure: 86,
      overall: 88,
      isBlurry: false,
      reason: 'Local file loaded',
    },
    palette: ['#52B197', '#1074B1', '#403993', '#BEBF61', '#A61B7A'],
    metadata: {
      formatName: classification.format.name,
      family: classification.format.family,
      viewer: classification.viewer,
      editor: classification.editor,
      containerFormat: classification.format.containerFormat,
      preservationGrade: classification.format.preservationGrade,
    },
    exif: {
      dimensions: 'Native Resolution',
      dateTaken: new Date(file.lastModified).toLocaleDateString(),
    },
  };
};

// Enrich asset with real parsed EXIF asynchronously
export async function enrichAssetWithExif(asset: MediaAsset, file: File): Promise<MediaAsset> {
  if (asset.category !== 'image' && asset.category !== 'raw') return asset;
  try {
    const exifPromise = parseExifFromFile(file);
    const timeoutPromise = new Promise<Record<string, any>>((resolve) => setTimeout(() => resolve({}), 1500));
    const exif = await Promise.race([exifPromise, timeoutPromise]);
    if (exif && Object.keys(exif).length > 0) {
      return {
        ...asset,
        exif: {
          ...asset.exif,
          ...exif,
        },
      };
    }
  } catch (e) {
    console.warn('EXIF parse note for', file.name, e);
  }
  return asset;
}

// Verify handle permissions
export async function verifyHandlePermission(handle: any, readWrite: boolean = false): Promise<boolean> {
  if (!handle) return false;
  const options = { mode: readWrite ? 'readwrite' : 'read' };
  if (typeof handle.queryPermission === 'function') {
    if ((await handle.queryPermission(options)) === 'granted') {
      return true;
    }
  }
  if (typeof handle.requestPermission === 'function') {
    if ((await handle.requestPermission(options)) === 'granted') {
      return true;
    }
  }
  return typeof handle.queryPermission !== 'function';
}

// Pick local directory using modern File System Access API with universal input directory fallback
export const openLocalDirectory = async (): Promise<{
  folder: FolderNode;
  assets: MediaAsset[];
}> => {
  // Strategy 1: Modern File System Access API
  if (isFileSystemAccessSupported()) {
    try {
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'read',
      });

      const assets: MediaAsset[] = [];
      const folderName = dirHandle.name;
      const folderId = `local_dir_${folderName}`;

      // Persist handle to memory map and IndexedDB for live in-place mounting
      activeDirectoryHandles.set(folderId, dirHandle);
      try {
        await saveDirectoryHandle(folderId, dirHandle);
      } catch (e) {
        console.warn('Directory handle persist note:', e);
      }

      async function scanDirectory(handle: any, currentPath: string) {
        for await (const entry of handle.values()) {
          if (entry.kind === 'file') {
            try {
              const file = await entry.getFile();
              const rawAsset = mapLocalFileToAsset(file, `${currentPath}/${file.name}`);
              const asset = await enrichAssetWithExif(rawAsset, file);
              assets.push(asset);
            } catch (e) {
              console.warn('Could not read file:', entry.name, e);
            }
          } else if (entry.kind === 'directory') {
            await scanDirectory(entry, `${currentPath}/${entry.name}`);
          }
        }
      }

      await scanDirectory(dirHandle, `/${folderName}`);

      const folder: FolderNode = {
        id: folderId,
        name: folderName,
        source: 'local',
        path: `/${folderName}`,
        itemCount: assets.length,
      };

      return { folder, assets };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      console.warn('showDirectoryPicker failed, transitioning to universal directory input fallback:', err);
    }
  }

  // Strategy 2: Universal Directory HTML Input Fallback (Works across all browsers, iframes & OSs)
  return new Promise<{ folder: FolderNode; assets: MediaAsset[] }>((resolve, reject) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('dt:local-mount-notice', {
          detail: {
            isFallback: true,
            message:
              "Firefox/Browser note: Click 'Upload' on the browser prompt to authorize local folder reading (0MB sent to any server).",
          },
        })
      );
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    (input as any).webkitdirectory = true;
    (input as any).directory = true;

    input.onchange = async () => {
      try {
        const files = Array.from(input.files || []);
        if (files.length === 0) {
          return resolve({
            folder: { id: `local_empty_${Date.now()}`, name: 'Empty Selection', source: 'local', path: '/Local', itemCount: 0 },
            assets: [],
          });
        }

        const firstRel = files[0].webkitRelativePath || files[0].name;
        const folderName = firstRel.includes('/') ? firstRel.split('/')[0] : 'Local Media';
        const folderId = `local_dir_${folderName}_${Date.now()}`;

        const assets: MediaAsset[] = [];
        for (const file of files) {
          const relPath = file.webkitRelativePath ? `/${file.webkitRelativePath}` : `/${folderName}/${file.name}`;
          const rawAsset = mapLocalFileToAsset(file, relPath);
          const asset = await enrichAssetWithExif(rawAsset, file);
          assets.push(asset);
        }

        const folder: FolderNode = {
          id: folderId,
          name: folderName,
          source: 'local',
          path: `/${folderName}`,
          itemCount: assets.length,
        };

        resolve({ folder, assets });
      } catch (e) {
        reject(e);
      }
    };

    input.oncancel = () => {
      const err = new Error('Picker cancelled');
      err.name = 'AbortError';
      reject(err);
    };

    input.click();
  });
};

// Pick individual or multiple local files
export const openLocalFiles = async (): Promise<MediaAsset[]> => {
  if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
    try {
      const handles = await (window as any).showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: 'Media Assets',
            accept: {
              'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp', '.tiff'],
              'video/*': ['.mp4', '.mov', '.webm', '.mkv'],
              'audio/*': ['.mp3', '.wav', '.ogg', '.flac'],
              'application/*': ['.zip', '.pdf', '.psd', '.cr2', '.cr3', '.nef', '.arw', '.dng'],
            },
          },
        ],
      });

      const assets: MediaAsset[] = [];
      for (const handle of handles) {
        try {
          const file = await handle.getFile();
          const rawAsset = mapLocalFileToAsset(file, `/Local OS/${file.name}`);
          const asset = await enrichAssetWithExif(rawAsset, file);
          assets.push(asset);
        } catch (e) {
          console.warn('Failed to load file from handle:', e);
        }
      }
      return assets;
    } catch (err: any) {
      if (err.name === 'AbortError') return [];
      console.warn('Open file picker failed, falling back to input:', err);
    }
  }

  // Input fallback
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,video/*,audio/*,.raw,.cr2,.cr3,.nef,.arw,.dng,.zip';
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      const assets: MediaAsset[] = [];
      for (const file of files) {
        const rawAsset = mapLocalFileToAsset(file, `/Local OS/${file.name}`);
        const asset = await enrichAssetWithExif(rawAsset, file);
        assets.push(asset);
      }
      resolve(assets);
    };
    input.oncancel = () => resolve([]);
    input.click();
  });
};

// Parse Drag-and-Drop items recursively
export const parseDroppedItems = async (dataTransfer: DataTransfer): Promise<{
  folders: FolderNode[];
  assets: MediaAsset[];
}> => {
  const assets: MediaAsset[] = [];
  const foldersMap = new Map<string, FolderNode>();

  const items = Array.from(dataTransfer.items || []);

  async function traverseEntry(entry: any, currentPath: string): Promise<void> {
    if (!entry) return;

    if (entry.isFile) {
      await new Promise<void>((resolve) => {
        entry.file(
          async (file: File) => {
            const rawAsset = mapLocalFileToAsset(file, `${currentPath}/${file.name}`);
            const asset = await enrichAssetWithExif(rawAsset, file);
            assets.push(asset);
            resolve();
          },
          (err: any) => {
            console.warn('File read error:', err);
            resolve();
          }
        );
      });
    } else if (entry.isDirectory) {
      const folderPath = `${currentPath}/${entry.name}`;
      const folderId = `drop_folder_${entry.name}_${Date.now()}`;
      if (!foldersMap.has(folderPath)) {
        foldersMap.set(folderPath, {
          id: folderId,
          name: entry.name,
          source: 'local',
          path: folderPath,
          itemCount: 0,
        });
      }

      const reader = entry.createReader();
      const readAllEntries = async (): Promise<any[]> => {
        const batch: any[] = [];
        let done = false;
        while (!done) {
          const results: any[] = await new Promise((resolve, reject) => {
            reader.readEntries(resolve, reject);
          });
          if (results.length === 0) {
            done = true;
          } else {
            batch.push(...results);
          }
        }
        return batch;
      };

      try {
        const entries = await readAllEntries();
        for (const child of entries) {
          await traverseEntry(child, folderPath);
        }
      } catch (e) {
        console.warn('Directory read error:', e);
      }
    }
  }

  // Prefer webkitGetAsEntry
  const entries: any[] = [];
  for (const item of items) {
    if (typeof item.webkitGetAsEntry === 'function') {
      const entry = item.webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
  }

  if (entries.length > 0) {
    for (const entry of entries) {
      await traverseEntry(entry, '');
    }
  } else {
    // Fallback to dataTransfer.files
    const files = Array.from(dataTransfer.files || []);
    for (const file of files) {
      assets.push(mapLocalFileToAsset(file, `/Local OS/${file.name}`));
    }
  }

  // Update folder item counts
  const folders = Array.from(foldersMap.values()).map((f) => {
    const count = assets.filter((a) => a.path.startsWith(f.path)).length;
    return { ...f, itemCount: count };
  });

  return { folders, assets };
};

// Download / save file locally to OS using proven browser download standards
export const saveFileToOS = async (filename: string, blob: Blob): Promise<boolean> => {
  // Try Chromium File System Access API if available and user interaction allows
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err: any) {
      if (err.name === 'AbortError') return false;
      console.warn('showSaveFilePicker failed, falling back to standard download anchor:', err);
    }
  }

  // Proven universal anchor download standard (supported by 100% of browsers including Firefox & Safari)
  if (typeof document === 'undefined') return false;
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Keep blob URL alive for 60 seconds so Firefox's background download stream completes
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Cleanup best effort
      }
    }, 60000);
    return true;
  } catch (err) {
    console.error('Standard anchor download failed:', err);
    return false;
  }
};

// Direct server-stream download for local computer files (0MB RAM browser overhead)
export const downloadLocalFileViaServer = (filePath: string, filename?: string): void => {
  if (typeof document === 'undefined') return;
  const safeName = filename || filePath.split('/').pop() || 'download';
  const downloadUrl = `/api/fs/stream?path=${encodeURIComponent(filePath)}&download=1`;
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = safeName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// Write XMP sidecar directly to mounted directory on local disk (In-Place Live Sync)
export async function writeSidecarToMountedDirectory(
  folderId: string,
  fileName: string,
  xmpContent: string
): Promise<boolean> {
  const dirHandle = activeDirectoryHandles.get(folderId);
  if (!dirHandle) return false;

  try {
    const hasPermission = await verifyHandlePermission(dirHandle, true);
    if (!hasPermission) return false;

    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const sidecarName = `${baseName}.xmp`;
    const fileHandle = await (dirHandle as any).getFileHandle(sidecarName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(xmpContent);
    await writable.close();
    return true;
  } catch (err) {
    console.warn('In-place sidecar write note:', err);
    return false;
  }
}

// Reconnect a previously persisted directory handle from IndexedDB after browser reload
export async function reconnectMountedDirectory(folderId: string): Promise<{
  success: boolean;
  folder?: FolderNode;
  assets?: MediaAsset[];
  error?: string;
}> {
  try {
    let handle = activeDirectoryHandles.get(folderId);
    if (!handle) {
      try {
        handle = await loadDirectoryHandle(folderId);
      } catch {
        handle = undefined;
      }
    }
    if (!handle) {
      return { success: false, error: 'Directory handle not found in catalog storage' };
    }

    const granted = await verifyHandlePermission(handle, false);
    if (!granted) {
      return { success: false, error: 'File system access permission was not granted by user' };
    }

    activeDirectoryHandles.set(folderId, handle);

    const assets: MediaAsset[] = [];
    const folderName = handle.name;

    async function scanDirectory(h: any, currentPath: string) {
      for await (const entry of h.values()) {
        if (entry.kind === 'file') {
          try {
            const file = await entry.getFile();
            const rawAsset = mapLocalFileToAsset(file, `${currentPath}/${file.name}`);
            assets.push(rawAsset);
          } catch (e) {
            console.warn('Could not read file:', entry.name, e);
          }
        } else if (entry.kind === 'directory') {
          await scanDirectory(entry, `${currentPath}/${entry.name}`);
        }
      }
    }

    await scanDirectory(handle, `/${folderName}`);

    const folder: FolderNode = {
      id: folderId,
      name: folderName,
      source: 'local',
      path: `/${folderName}`,
      itemCount: assets.length,
    };

    return { success: true, folder, assets };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reconnect directory handle' };
  }
}

// Dismount a mounted directory cleanly, revoking all blob URLs and cleaning persistence
export async function dismountMountedDirectory(
  folderId: string,
  assetIdsToRevoke?: string[]
): Promise<{ success: boolean; revokedCount: number }> {
  try {
    activeDirectoryHandles.delete(folderId);
    await deleteDirectoryHandle(folderId);
    const deletedAssetIds = await deleteAssetsByFolder(folderId);
    await deleteFolder(folderId);

    const allIdsToRevoke = new Set([...(assetIdsToRevoke || []), ...deletedAssetIds]);
    for (const id of allIdsToRevoke) {
      blobRegistry.revoke(id);
    }

    return { success: true, revokedCount: allIdsToRevoke.size };
  } catch (err: any) {
    console.warn(`Error dismounting folder ${folderId}:`, err);
    return { success: false, revokedCount: 0 };
  }
}

