/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Tasks Sync Service
 */

import { loadOAuthToken } from './googleDrive';

export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  updated?: string;
}

const TASKS_CACHE_KEY = 'dt_google_tasks_cache_v1';

export function loadCachedGoogleTasks(): GoogleTaskItem[] {
  try {
    const raw = localStorage.getItem(TASKS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCachedGoogleTasks(tasks: GoogleTaskItem[]): void {
  try {
    localStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(tasks.slice(0, 200)));
  } catch {}
}

export async function fetchGoogleTasks(): Promise<GoogleTaskItem[]> {
  const token = loadOAuthToken()?.accessToken;
  if (!token) throw new Error('Connect Google account first to sync Google Tasks.');
  const res = await fetch('/api/tasks', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Google Tasks fetch failed (${res.status})`);
  const items: GoogleTaskItem[] = Array.isArray(data.items) ? data.items : [];
  saveCachedGoogleTasks(items);
  return items;
}

export async function createGoogleTask(title: string, notes?: string): Promise<GoogleTaskItem> {
  const token = loadOAuthToken()?.accessToken;
  if (!token) throw new Error('Connect Google account first to create a Google Task.');
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title, notes }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Create task failed (${res.status})`);
  return data;
}

export async function toggleGoogleTaskStatus(
  taskId: string,
  nextStatus: 'needsAction' | 'completed'
): Promise<GoogleTaskItem> {
  const token = loadOAuthToken()?.accessToken;
  if (!token) throw new Error('Connect Google account first.');
  const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: nextStatus }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Update task failed (${res.status})`);
  return data;
}
