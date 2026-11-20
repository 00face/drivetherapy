/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Contacts (People API) Autocomplete & Face Labeling Service
 */

import { loadOAuthToken } from './googleDrive';

export interface GoogleContactEntry {
  resourceName: string;
  name: string;
  email: string;
  photoUrl?: string;
}

const CONTACTS_CACHE_KEY = 'dt_google_contacts_v1';

export function loadCachedGoogleContacts(): GoogleContactEntry[] {
  try {
    const raw = localStorage.getItem(CONTACTS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function fetchGoogleContacts(): Promise<GoogleContactEntry[]> {
  const token = loadOAuthToken()?.accessToken;
  if (!token) throw new Error('Connect Google account first to load contacts.');
  const res = await fetch('/api/contacts', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Google Contacts fetch failed (${res.status})`);
  const contacts: GoogleContactEntry[] = Array.isArray(data.contacts) ? data.contacts : [];
  try {
    localStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify(contacts.slice(0, 500)));
  } catch {}
  return contacts;
}
