/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Multi-Account Google Drive Profile Switcher Service (A+ Tier)
 * Manages multiple authenticated Google accounts, fast 1-click profile switching,
 * credential isolation, and independent storage quotas.
 */

import { OAuthTokenRecord } from '../types';
import { saveOAuthToken, clearOAuthToken } from './oauthStorage';

export interface GoogleAccountProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  tokenRecord: OAuthTokenRecord;
  quota?: {
    usage: number;
    limit: number;
    percentage: number;
  };
  isActive: boolean;
  lastSyncedAt?: number;
}

const MULTI_ACCOUNT_STORAGE_KEY = 'dt_multi_account_profiles_v1';
let inMemoryProfiles: GoogleAccountProfile[] = [];

/**
 * Load all registered Google account profiles
 */
export function loadAccountProfiles(): GoogleAccountProfile[] {
  if (typeof window === 'undefined') return [...inMemoryProfiles];
  try {
    const raw = localStorage.getItem(MULTI_ACCOUNT_STORAGE_KEY);
    if (!raw) return [...inMemoryProfiles];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [...inMemoryProfiles];
  }
}

/**
 * Persist account profiles (Security [WO-114]: strips raw accessToken / refreshToken before writing
 * to localStorage; live tokens stay strictly in RAM inMemoryProfiles + server HttpOnly dt_sid vault).
 */
export function persistAccountProfiles(profiles: GoogleAccountProfile[]): void {
  inMemoryProfiles = [...profiles];
  if (typeof window === 'undefined') return;
  try {
    const sanitized = profiles.map((p) => ({
      ...p,
      tokenRecord: {
        ...p.tokenRecord,
        accessToken: '',
        refreshToken: undefined,
      },
    }));
    localStorage.setItem(MULTI_ACCOUNT_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.warn('[MultiAccount] Failed to persist accounts:', err);
  }
}

/**
 * Get the currently active account profile
 */
export function getActiveAccountProfile(): GoogleAccountProfile | null {
  const profiles = loadAccountProfiles();
  return profiles.find((p) => p.isActive) || profiles[0] || null;
}

/**
 * Register or update an account profile (supports multiple Brand Sub-Accounts under one email
 * when distinct ids are provided, and activates newly authenticated sessions by default).
 */
export function saveAccountProfile(
  profile: Omit<GoogleAccountProfile, 'id' | 'isActive'> & { id?: string },
  options?: { setActive?: boolean }
): GoogleAccountProfile {
  const profiles = loadAccountProfiles();
  const shouldActivate = options?.setActive ?? true;
  const existingIdx = profile.id
    ? profiles.findIndex((p) => p.id === profile.id)
    : profiles.findIndex((p) => p.email.toLowerCase() === profile.email.toLowerCase());

  if (shouldActivate) {
    for (const p of profiles) {
      p.isActive = false;
    }
  }

  let target: GoogleAccountProfile;
  if (existingIdx >= 0) {
    target = {
      ...profiles[existingIdx],
      ...profile,
      tokenRecord: profile.tokenRecord,
      isActive: shouldActivate ? true : profiles[existingIdx].isActive,
    };
    profiles[existingIdx] = target;
  } else {
    target = {
      ...profile,
      id: profile.id || `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      isActive: shouldActivate || profiles.length === 0,
    };
    profiles.push(target);
  }

  persistAccountProfiles(profiles);

  // If this is active, synchronize token storage
  if (target.isActive) {
    saveOAuthToken(target.tokenRecord);
  }

  return target;
}

/**
 * Switch active account to a target profile ID
 */
export function switchActiveAccount(targetAccountId: string): GoogleAccountProfile | null {
  const profiles = loadAccountProfiles();
  let activated: GoogleAccountProfile | null = null;

  for (const p of profiles) {
    if (p.id === targetAccountId) {
      p.isActive = true;
      activated = p;
    } else {
      p.isActive = false;
    }
  }

  if (activated) {
    persistAccountProfiles(profiles);
    saveOAuthToken(activated.tokenRecord);
  }

  return activated;
}

/**
 * Remove an account profile
 */
export function removeAccountProfile(accountId: string): GoogleAccountProfile[] {
  let profiles = loadAccountProfiles();
  const removed = profiles.find((p) => p.id === accountId);
  profiles = profiles.filter((p) => p.id !== accountId);

  // If removed profile was active, activate next available profile
  if (removed?.isActive && profiles.length > 0) {
    profiles[0].isActive = true;
    saveOAuthToken(profiles[0].tokenRecord);
  } else if (profiles.length === 0) {
    clearOAuthToken();
  }

  persistAccountProfiles(profiles);
  return profiles;
}

/**
 * [WO-113] Remove a single signed-in account by email while preserving other concurrent accounts.
 */
export function removeAccountProfileByEmail(email: string): {
  remaining: GoogleAccountProfile[];
  nextActive: GoogleAccountProfile | null;
} {
  const norm = email.trim().toLowerCase();
  let profiles = loadAccountProfiles();
  const removed = profiles.find((p) => p.email.toLowerCase() === norm);
  profiles = profiles.filter((p) => p.email.toLowerCase() !== norm);

  let nextActive: GoogleAccountProfile | null = profiles.find((p) => p.isActive) || null;
  if ((removed?.isActive || !nextActive) && profiles.length > 0) {
    profiles = profiles.map((p, idx) => ({ ...p, isActive: idx === 0 }));
    nextActive = profiles[0];
    saveOAuthToken(nextActive.tokenRecord);
  } else if (profiles.length === 0) {
    nextActive = null;
    clearOAuthToken();
  }

  persistAccountProfiles(profiles);
  return { remaining: profiles, nextActive };
}

/**
 * [WO-113] Clear all account profiles in memory and localStorage (Sign Out All).
 */
export function clearAllAccountProfiles(): void {
  inMemoryProfiles = [];
  clearOAuthToken();
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(MULTI_ACCOUNT_STORAGE_KEY);
    } catch {}
  }
}

/**
 * [WO-113 Option 1] Strict Per-Account Catalog Isolation:
 * Local OS disk assets remain shared across users, while cloud/photos assets are strictly
 * scoped to the active signed-in email (when logged out, only local assets are visible).
 */
export function filterAssetsForActiveAccount<T extends { source: string; ownerEmail?: string }>(
  assets: T[],
  activeEmail: string | null | undefined
): T[] {
  const normActive = activeEmail?.trim().toLowerCase() || null;
  return assets.filter((asset) => {
    if (asset.source === 'local') return true;
    if (!normActive) return false;
    if (!asset.ownerEmail) return true;
    return asset.ownerEmail.trim().toLowerCase() === normActive;
  });
}
