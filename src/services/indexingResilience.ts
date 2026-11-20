/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Crash-Safe Resumable Indexing & Network Resilience Engine
 * Persists scan checkpoints (`pageToken`, `processedCount`, `status`) so abrupt crashes,
 * reloads, or network drops resume cleanly from the exact interruption cursor.
 */

import { getMeta, setMeta } from './catalogDb';

export type IndexingSource = 'cloud' | 'photos' | 'local';
export type IndexingCheckpointStatus = 'in_progress' | 'interrupted' | 'completed';

export interface IndexingCheckpoint {
  id: string;
  source: IndexingSource;
  scanType: 'quick' | 'deep' | 'folder' | 'photos' | 'local';
  status: IndexingCheckpointStatus;
  nextPageToken?: string;
  processedCount: number;
  targetFolderId?: string;
  startedAt: string;
  updatedAt: string;
  lastError?: string;
}

export const INDEXING_CHECKPOINT_META_KEY = 'dt_indexing_checkpoint_v1';

export async function saveIndexingCheckpoint(checkpoint: IndexingCheckpoint): Promise<void> {
  const payload: IndexingCheckpoint = {
    ...checkpoint,
    updatedAt: new Date().toISOString(),
  };
  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      await setMeta(INDEXING_CHECKPOINT_META_KEY, payload);
    }
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(INDEXING_CHECKPOINT_META_KEY, JSON.stringify(payload));
    }
  } catch {}
}

export async function loadIndexingCheckpoint(): Promise<IndexingCheckpoint | null> {
  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      const fromIdb = (await getMeta(INDEXING_CHECKPOINT_META_KEY)) as IndexingCheckpoint | null;
      if (fromIdb && fromIdb.id) return fromIdb;
    }
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(INDEXING_CHECKPOINT_META_KEY);
      if (raw) return JSON.parse(raw) as IndexingCheckpoint;
    }
  } catch {}
  return null;
}

export async function clearIndexingCheckpoint(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      await setMeta(INDEXING_CHECKPOINT_META_KEY, null);
    }
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(INDEXING_CHECKPOINT_META_KEY);
    }
  } catch {}
}

export interface BackoffFetchOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

/**
 * Resilient fetch wrapper with jittered exponential backoff on 429 / 5xx / transient network errors.
 */
export async function fetchWithBackoff(
  url: string,
  init: RequestInit = {},
  options: BackoffFetchOptions = {}
): Promise<Response> {
  const maxRetries = options.maxRetries ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const doFetch = options.fetchImpl ?? fetch;

  let attempt = 0;
  while (true) {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      const res = await doFetch(url, { ...init, signal: options.signal ?? init.signal });
      if (![429, 500, 502, 503, 504].includes(res.status) || attempt >= maxRetries) {
        return res;
      }
      attempt++;
      const retryAfter = res.headers?.get?.('Retry-After');
      const retrySec = retryAfter ? parseInt(retryAfter, 10) : NaN;
      const delayMs = Number.isFinite(retrySec)
        ? Math.min(30000, retrySec * 1000)
        : Math.min(30000, baseDelayMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250));
      await new Promise((r) => setTimeout(r, delayMs));
    } catch (err: any) {
      if (options.signal?.aborted || err?.name === 'AbortError' || attempt >= maxRetries) {
        throw err;
      }
      attempt++;
      const delayMs = Math.min(
        30000,
        baseDelayMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250)
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
