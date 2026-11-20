/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-055] Offline PWA Sync Manager & Background Mutation Queue
 * Buffers non-destructive curation mutations (pick, reject, rating, tag) while offline
 * and replays them automatically once connectivity is restored.
 */

export interface OfflineSyncMutation {
  id: string;
  type: 'pick' | 'reject' | 'rating' | 'tag';
  assetId: string;
  value: string | number | boolean;
  createdAt: number;
}

const PWA_SYNC_QUEUE_KEY = 'dt_pwa_sync_queue_v1';
let memoryQueue: OfflineSyncMutation[] = [];

export function loadOfflineSyncQueue(): OfflineSyncMutation[] {
  if (typeof window === 'undefined') return [...memoryQueue];
  try {
    const raw = localStorage.getItem(PWA_SYNC_QUEUE_KEY);
    if (!raw) return [...memoryQueue];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...memoryQueue];
  } catch {
    return [...memoryQueue];
  }
}

export function saveOfflineSyncQueue(queue: OfflineSyncMutation[]): void {
  memoryQueue = [...queue];
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PWA_SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore quota errors
  }
}

export function enqueueOfflineMutation(
  mutation: Omit<OfflineSyncMutation, 'id' | 'createdAt'>
): OfflineSyncMutation[] {
  const next: OfflineSyncMutation[] = [
    ...loadOfflineSyncQueue(),
    {
      ...mutation,
      id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
    },
  ];
  saveOfflineSyncQueue(next);
  return next;
}

export async function flushOfflineSyncQueue(
  executor: (item: OfflineSyncMutation) => Promise<boolean>
): Promise<{ processed: number; remaining: number }> {
  const queue = loadOfflineSyncQueue();
  if (queue.length === 0) return { processed: 0, remaining: 0 };

  const remaining: OfflineSyncMutation[] = [];
  let processed = 0;

  for (const item of queue) {
    try {
      const ok = await executor(item);
      if (ok) processed++;
      else remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }

  saveOfflineSyncQueue(remaining);
  return { processed, remaining: remaining.length };
}

export async function registerDriveTherapyServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    await navigator.serviceWorker.register('/sw.js');
    return true;
  } catch {
    return false;
  }
}
