/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Smart Collections & Dynamic Saved Queries Engine (A+ Tier)
 * Manages persistent dynamic virtual albums that re-evaluate queries against
 * catalog assets in real-time.
 */

import { MediaAsset } from '../types';

export interface SmartCollection {
  id: string;
  name: string;
  query: string;
  icon?: string;
  color?: string;
  createdAt: number;
}

const SMART_COLLECTIONS_STORAGE_KEY = 'dt_smart_collections_v1';

export const DEFAULT_SMART_COLLECTIONS: SmartCollection[] = [
  {
    id: 'sc_five_stars',
    name: 'Five-Star Gems',
    query: 'stars:5',
    icon: 'star',
    color: '#EAB308',
    createdAt: 1700000000000,
  },
  {
    id: 'sc_raw_bursts',
    name: 'RAW Bursts & Captures',
    query: 'type:raw',
    icon: 'camera',
    color: '#1074B1',
    createdAt: 1700000000001,
  },
  {
    id: 'sc_picked_heros',
    name: 'Picked Heros (Ready)',
    query: 'status:picked',
    icon: 'check',
    color: '#10B981',
    createdAt: 1700000000002,
  },
  {
    id: 'sc_large_files',
    name: 'Heavy Files (>20MB)',
    query: 'size:>20mb',
    icon: 'hard-drive',
    color: '#8B5CF6',
    createdAt: 1700000000003,
  },
];

/**
 * Load saved smart collections from local storage with fallback to defaults
 */
export function loadSmartCollections(): SmartCollection[] {
  if (typeof window === 'undefined') {
    return [...DEFAULT_SMART_COLLECTIONS];
  }

  try {
    const raw = localStorage.getItem(SMART_COLLECTIONS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(SMART_COLLECTIONS_STORAGE_KEY, JSON.stringify(DEFAULT_SMART_COLLECTIONS));
      return [...DEFAULT_SMART_COLLECTIONS];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('[SmartCollections] Failed to load collections:', err);
  }

  return [...DEFAULT_SMART_COLLECTIONS];
}

/**
 * Persist smart collections array
 */
export function persistSmartCollections(collections: SmartCollection[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SMART_COLLECTIONS_STORAGE_KEY, JSON.stringify(collections));
  } catch (err) {
    console.warn('[SmartCollections] Failed to persist collections:', err);
  }
}

/**
 * Create and save a new Smart Collection
 */
export function createSmartCollection(
  name: string,
  query: string,
  icon = 'folder-star',
  color = '#1074B1'
): SmartCollection {
  const collections = loadSmartCollections();
  const newCol: SmartCollection = {
    id: `sc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim() || 'New Smart Collection',
    query: query.trim(),
    icon,
    color,
    createdAt: Date.now(),
  };

  collections.push(newCol);
  persistSmartCollections(collections);
  return newCol;
}

/**
 * Delete a Smart Collection by ID
 */
export function deleteSmartCollection(id: string): SmartCollection[] {
  const collections = loadSmartCollections().filter((c) => c.id !== id);
  persistSmartCollections(collections);
  return collections;
}

/**
 * Evaluate if a single asset matches a query string token grammar
 */
export function matchesSmartQuery(asset: MediaAsset, rawQuery: string): boolean {
  const query = (rawQuery || '').trim().toLowerCase();
  if (!query) return true;

  const tokens = query.split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    if (token.startsWith('stars:') || token.startsWith('rating:')) {
      const valStr = token.split(':')[1];
      const targetStars = parseInt(valStr.replace(/[^0-9]/g, ''), 10) || 0;
      const assetRating = asset.rating || 0;

      if (valStr.includes('>=')) {
        if (assetRating < targetStars) return false;
      } else if (valStr.includes('>')) {
        if (assetRating <= targetStars) return false;
      } else {
        if (assetRating !== targetStars) return false;
      }
    } else if (token.startsWith('type:')) {
      const targetType = token.split(':')[1];
      const mime = (asset.mimeType || '').toLowerCase();
      const name = (asset.name || '').toLowerCase();

      if (targetType === 'raw') {
        const isRaw = name.endsWith('.arw') || name.endsWith('.cr2') || name.endsWith('.cr3') ||
                      name.endsWith('.nef') || name.endsWith('.raf') || name.endsWith('.dng') ||
                      name.endsWith('.rw2');
        if (!isRaw) return false;
      } else if (targetType === 'image') {
        if (!mime.startsWith('image/')) return false;
      } else if (targetType === 'video') {
        if (!mime.startsWith('video/')) return false;
      }
    } else if (token.startsWith('status:')) {
      const targetStatus = token.split(':')[1];
      if (targetStatus === 'picked' && !asset.isPicked && asset.cullingStatus !== 'picked') return false;
      if (targetStatus === 'rejected' && !asset.isRejected && asset.cullingStatus !== 'rejected') return false;
      if (targetStatus === 'flagged' && !asset.isFlagged && !asset.isRejected && asset.cullingStatus !== 'rejected') return false;
    } else if (token.startsWith('size:')) {
      const sizeParam = token.split(':')[1];
      const isGreater = sizeParam.startsWith('>');
      const numMB = parseFloat(sizeParam.replace(/[^0-9.]/g, '')) || 0;
      const targetBytes = numMB * 1024 * 1024;
      const assetSize = asset.sizeBytes || asset.size || 0;

      if (isGreater && assetSize <= targetBytes) return false;
      if (!isGreater && assetSize > targetBytes) return false;
    } else if (token.startsWith('camera:')) {
      const targetCam = token.split(':')[1];
      const cam = (asset.cameraModel || asset.exif?.camera || '').toLowerCase();
      if (!cam.includes(targetCam)) return false;
    } else {
      // General text query in name, tags, or description
      const name = (asset.name || '').toLowerCase();
      const tags = (asset.tags || []).join(' ').toLowerCase();
      if (!name.includes(token) && !tags.includes(token)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Filter an entire array of assets matching a smart collection
 */
export function evaluateSmartCollection(
  collection: SmartCollection,
  assets: MediaAsset[]
): MediaAsset[] {
  return assets.filter((a) => matchesSmartQuery(a, collection.query));
}
