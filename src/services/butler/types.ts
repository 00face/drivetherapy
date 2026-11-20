/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Butler Concierge & Service Mesh Types
 * Follows Erasable Syntax Doctrine: union types and interfaces only (zero enum/namespace).
 */

export type ButlerServiceId = 'drive' | 'workspace' | 'music' | 'gemini';

export type ButlerServiceStatus = 'connected' | 'unauthorized' | 'degraded' | 'offline';

export type ButlerAccountType = 'primary' | 'brand_channel' | 'sub_channel' | 'workspace_sub' | 'local';

export interface ButlerStorageQuota {
  usage: number;
  limit: number;
  percentage: number;
}

export interface ButlerAccount {
  id: string;
  name: string;
  email: string;
  handle: string;
  avatarUrl?: string;
  accountType: ButlerAccountType;
  subscribersCount?: number;
  subscribersLabel?: string;
  quota?: ButlerStorageQuota;
  isActive: boolean;
  lastSyncedAt?: number;
}

export interface ButlerServiceTelemetry {
  id: ButlerServiceId;
  name: string;
  status: ButlerServiceStatus;
  description: string;
  requiredScopes: string[];
  activeAccountEmail?: string;
  lastCheckedAt: number;
  errorMessage?: string;
}

export interface ButlerState {
  services: Record<ButlerServiceId, ButlerServiceTelemetry>;
  activeAccount: ButlerAccount | null;
  accounts: ButlerAccount[];
  isRefreshingToken: boolean;
  tokenExpiresAt: number | null;
  tokenTimeRemainingSeconds: number;
  lastError: string | null;
}

export type ButlerListener = (state: ButlerState) => void;

/**
 * Isolated OAuth Scopes Per Service Matrix
 * Crucial: Prevents Google OAuth 400 invalid_request (drive.file + youtube.readonly exclusivity)
 */
export const BUTLER_SERVICE_SCOPES: Record<ButlerServiceId, string[]> = {
  drive: [
    'openid',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
  ],
  workspace: [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/chat.spaces.readonly',
  ],
  music: [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/youtube.readonly',
  ],
  gemini: [], // Pure BYOK or server proxy, no Google OAuth scope required
};
