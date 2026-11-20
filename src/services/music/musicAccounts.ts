/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Drive & Local Media Account Registry (musicAccounts.ts)
 * Resolves OAuth multi-account Drive profiles and local studio sessions dynamically
 * with zero hardcoded mock accounts.
 */

import type { GoogleMusicSubAccount } from '../googleMusicEngine';
import {
  loadAccountProfiles,
  switchActiveAccount,
  saveAccountProfile,
  GoogleAccountProfile,
} from '../multiAccountAuth';
import { DiscoveredGoogleChannel, fetchLinkedGoogleAccounts } from '../googleDrive';
import { loadOAuthToken } from '../oauthStorage';

export const SUB_ACCOUNTS_STORAGE_KEY = 'dt_google_music_sub_accounts_v2';

export interface AccountGroup {
  email: string;
  name: string;
  isPrimary: boolean;
  channels: GoogleMusicSubAccount[];
}

/**
 * Group authenticated media studio profiles by Google account email.
 */
export function groupSubAccountsByGoogleAccount(
  accounts: GoogleMusicSubAccount[],
  primaryEmail?: string
): AccountGroup[] {
  const safeAccounts = sanitizeSubAccountList(accounts);
  if (safeAccounts.length === 0) return [];

  const effectivePrimary = (
    primaryEmail ||
    safeAccounts[0]?.email ||
    'drive-user@google.com'
  ).toLowerCase().trim();

  const map = new Map<string, AccountGroup>();

  for (const acc of safeAccounts) {
    const rawEmail = acc.email || acc.primaryUser?.email || effectivePrimary;
    const emailKey = rawEmail.toLowerCase().trim();
    if (!map.has(emailKey)) {
      map.set(emailKey, {
        email: rawEmail,
        name: acc.primaryUser?.name || acc.name,
        isPrimary: emailKey === effectivePrimary,
        channels: [],
      });
    }
    map.get(emailKey)!.channels.push(acc);
  }

  const groups = Array.from(map.values());
  groups.sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : a.email.localeCompare(b.email)));
  return groups;
}

const DEFAULT_FALLBACK_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';

const LEGACY_MOCK_ACCOUNT_IDS = new Set(['acc_brand_lofi', 'acc_commercial_score']);

export function sanitizeHandle(nameOrEmail: string): string {
  const base = (nameOrEmail.includes('@') ? nameOrEmail.split('@')[0] : nameOrEmail)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  return `@${base || 'drive'}`;
}

export function isValidSubAccount(item: any): item is GoogleMusicSubAccount {
  return Boolean(
    item &&
    typeof item === 'object' &&
    typeof item.id === 'string' &&
    item.id.trim() !== '' &&
    typeof item.email === 'string'
  );
}

export function sanitizeSubAccountList(list: any[]): GoogleMusicSubAccount[] {
  if (!Array.isArray(list)) return [];
  return list.filter(isValidSubAccount);
}

export function loadPersistedSubAccounts(): GoogleMusicSubAccount[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SUB_ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return sanitizeSubAccountList(parsed);
  } catch {
    return [];
  }
}

export function persistSubAccounts(accounts: GoogleMusicSubAccount[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const clean = sanitizeSubAccountList(accounts);
    localStorage.setItem(SUB_ACCOUNTS_STORAGE_KEY, JSON.stringify(clean));
  } catch (err) {
    console.warn('[MusicAccounts] Failed to persist sub-accounts:', err);
  }
}

export function createInitialGuestAccounts(): GoogleMusicSubAccount[] {
  const defaultUser = {
    name: 'Local Studio Session',
    email: 'guest@drivetherapy.local',
  };
  return [
    {
      id: 'acc_studio_primary',
      name: defaultUser.name,
      email: defaultUser.email,
      handle: '@localstudio',
      roleLabel: 'Local Disk Session',
      avatarUrl: DEFAULT_FALLBACK_AVATAR,
      accountType: 'local',
      primaryUser: defaultUser,
    },
  ];
}

/**
 * Reconcile studio accounts with all registered multiAccountAuth Google Drive profiles.
 */
export function syncAccountsWithMultiAuth(
  currentAccounts: GoogleMusicSubAccount[],
  profiles: GoogleAccountProfile[] = loadAccountProfiles()
): { accounts: GoogleMusicSubAccount[]; activeAccountId: string } {
  const safeAccounts = sanitizeSubAccountList(currentAccounts).filter(
    (s) => !LEGACY_MOCK_ACCOUNT_IDS.has(s.id) && !s.id.startsWith('yt_')
  );

  if (profiles.length === 0) {
    const list = safeAccounts.length > 0 ? safeAccounts : createInitialGuestAccounts();
    return { accounts: list, activeAccountId: list[0]?.id || 'acc_studio_primary' };
  }

  const activeProfile = profiles.find((p) => p && p.isActive) || profiles[0];
  const primaryUser = {
    name: activeProfile?.name || 'Google Drive User',
    email: activeProfile?.email || 'drive-user@google.com',
  };

  const customProfiles = safeAccounts.filter(
    (s) => typeof s.id === 'string' && s.id.startsWith('acc_custom_')
  );

  const mappedProfiles: GoogleMusicSubAccount[] = profiles
    .filter((p) => p && typeof p.email === 'string')
    .map((p, idx) => {
      const pid = p.id || `acc_prof_${idx}_${p.email.replace(/[^a-z0-9]/gi, '_')}`;
      return {
        id: pid,
        name: p.name || (p.email ? p.email.split('@')[0] : 'Google Account'),
        email: p.email,
        handle: sanitizeHandle(p.name || p.email || 'user'),
        roleLabel: idx === 0 ? 'Primary Google Drive' : 'Google Drive Account',
        avatarUrl: p.avatarUrl || DEFAULT_FALLBACK_AVATAR,
        accountType: pid === activeProfile?.id ? 'primary' : 'workspace_sub',
        primaryUser,
      };
    });

  const merged = [...mappedProfiles, ...customProfiles.map((c) => ({ ...c, primaryUser }))];
  const safeMerged = sanitizeSubAccountList(merged);
  const resolvedList = safeMerged.length > 0 ? safeMerged : createInitialGuestAccounts();

  return {
    accounts: resolvedList,
    activeAccountId: activeProfile?.id || (resolvedList[0]?.id ?? 'acc_studio_primary'),
  };
}

/**
 * Merge newly discovered Google Drive profiles cleanly without mock placeholders.
 */
export function mergeDiscoveredChannels(
  currentAccounts: GoogleMusicSubAccount[],
  userEmail: string,
  userName: string,
  userAvatar: string | undefined,
  channels: DiscoveredGoogleChannel[] = []
): GoogleMusicSubAccount[] {
  const cleanName = userName?.trim() || (userEmail.includes('@') ? userEmail.split('@')[0] : 'Google User');
  const primaryUser = { name: cleanName, email: userEmail };
  const safeAccounts = sanitizeSubAccountList(currentAccounts);

  const withoutMocks = safeAccounts.filter(
    (s) =>
      !LEGACY_MOCK_ACCOUNT_IDS.has(s.id) &&
      !s.id.startsWith('yt_') &&
      s.email !== 'guest@drivetherapy.local' &&
      s.email !== 'studio@drivetherapy.internal'
  );

  const byId = new Map<string, GoogleMusicSubAccount>();
  for (const existing of withoutMocks) {
    byId.set(existing.id, { ...existing, primaryUser });
  }

  for (const ch of channels || []) {
    if (!ch || typeof ch.id !== 'string') continue;
    const existing = byId.get(ch.id);
    byId.set(ch.id, {
      id: ch.id,
      name: ch.name || cleanName,
      email: existing?.email || userEmail,
      handle: ch.handle || sanitizeHandle(ch.name),
      roleLabel: ch.roleLabel || 'Google Drive Account',
      avatarUrl: ch.avatarUrl || userAvatar || DEFAULT_FALLBACK_AVATAR,
      accountType: ch.accountType || 'workspace_sub',
      primaryUser,
    });
  }

  if ((channels || []).length === 0) {
    const existingPrimary = byId.get('acc_studio_primary');
    byId.set('acc_studio_primary', {
      id: 'acc_studio_primary',
      name: cleanName,
      email: userEmail,
      handle: sanitizeHandle(userEmail),
      roleLabel: existingPrimary?.roleLabel ?? 'Google Drive Connected',
      avatarUrl: userAvatar || existingPrimary?.avatarUrl || DEFAULT_FALLBACK_AVATAR,
      accountType: 'primary',
      primaryUser,
    });
  }

  const list = Array.from(byId.values());
  const primaryIdx = list.findIndex((a) => a.accountType === 'primary' || a.id === 'acc_studio_primary');
  if (primaryIdx > 0) {
    const [p] = list.splice(primaryIdx, 1);
    list.unshift(p);
  }
  return sanitizeSubAccountList(list);
}

/**
 * Switch the active multiAccountAuth credential when switching to an OAuth-backed Drive account.
 */
export function activateProfileTokenForSubAccount(subAccountId: string): boolean {
  const profiles = loadAccountProfiles();
  if (profiles.some((p) => p.id === subAccountId)) {
    const activated = switchActiveAccount(subAccountId);
    return Boolean(activated);
  }
  return false;
}

/**
 * Query `/api/auth/google/accounts` for authenticated Google Drive profile identity.
 */
export async function discoverRemoteSubAccounts(
  currentAccounts: GoogleMusicSubAccount[]
): Promise<{
  accounts: GoogleMusicSubAccount[];
  channels: DiscoveredGoogleChannel[];
}> {
  const tokenRec = loadOAuthToken();
  if (!tokenRec?.accessToken) {
    return { accounts: currentAccounts, channels: [] };
  }

  const { userInfo, channels } = await fetchLinkedGoogleAccounts(tokenRec.accessToken);
  const email = userInfo.email || tokenRec.userEmail || 'drive-user@google.com';
  const name = userInfo.name || (email.includes('@') ? email.split('@')[0] : 'Google User');

  if (userInfo.email) {
    saveAccountProfile(
      {
        id: userInfo.permissionId ? `gacc_${userInfo.permissionId}` : undefined,
        name,
        email: userInfo.email,
        avatarUrl: userInfo.picture,
        tokenRecord: tokenRec,
      },
      { setActive: true }
    );
  }

  const merged = mergeDiscoveredChannels(currentAccounts, email, name, userInfo.picture, channels);
  persistSubAccounts(merged);
  return { accounts: merged, channels };
}
