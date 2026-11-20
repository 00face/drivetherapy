/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OAuth 2.0 Token Storage, Session Rehydration & Lifecycle Management (A+ Tier)
 * Manages token persistence, proactive expiration calculation, RFC 7009 revocation,
 * and scope inspection without runtime dependencies.
 */

import { OAuthTokenRecord, OAuthScopeInspection } from '../types';

const OAUTH_STORAGE_KEY = 'dt_oauth_session_v2';
const OAUTH_SALT = 'DriveTherapy::OAuth::Salt::v2';

// Reversible obfuscation to prevent plain-text exposure in browser storage
function obfuscatePayload(plainText: string): string {
  try {
    const combined = `${OAUTH_SALT}::${plainText}`;
    if (typeof btoa === 'function') {
      return btoa(unescape(encodeURIComponent(combined)));
    }
    return Buffer.from(combined, 'utf8').toString('base64');
  } catch {
    return plainText;
  }
}

function deobfuscatePayload(encodedText: string): string | null {
  try {
    let decoded = '';
    if (typeof atob === 'function') {
      decoded = decodeURIComponent(escape(atob(encodedText)));
    } else {
      decoded = Buffer.from(encodedText, 'base64').toString('utf8');
    }
    const prefix = `${OAUTH_SALT}::`;
    if (decoded.startsWith(prefix)) {
      return decoded.slice(prefix.length);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save an OAuthTokenRecord to browser sessionStorage (and localStorage backup)
 */
export function saveOAuthToken(record: OAuthTokenRecord): void {
  if (!record || !record.accessToken) return;

  const serialized = JSON.stringify(record);
  const obfuscated = obfuscatePayload(serialized);

  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(OAUTH_STORAGE_KEY, obfuscated);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(OAUTH_STORAGE_KEY, obfuscated);
    }
  } catch (err) {
    console.warn('[OAuthStorage] Failed to persist token:', err);
  }
}

/**
 * Load and rehydrate OAuthTokenRecord from storage
 */
export function loadOAuthToken(): OAuthTokenRecord | null {
  try {
    let raw: string | null = null;
    if (typeof sessionStorage !== 'undefined') {
      raw = sessionStorage.getItem(OAUTH_STORAGE_KEY);
    }
    if (!raw && typeof localStorage !== 'undefined') {
      raw = localStorage.getItem(OAUTH_STORAGE_KEY);
    }

    if (!raw) return null;

    const deobfuscated = deobfuscatePayload(raw);
    if (!deobfuscated) return null;

    const record: OAuthTokenRecord = JSON.parse(deobfuscated);
    if (!record.accessToken || !record.expiresAt) return null;

    return record;
  } catch (err) {
    console.warn('[OAuthStorage] Failed to load token:', err);
    return null;
  }
}

/**
 * Rehydrate and retrieve current OAuthTokenRecord
 */
export const getOAuthTokenRecord = (): OAuthTokenRecord | null => {
  return loadOAuthToken();
};

/**
 * Clear stored OAuth tokens across all browser storage targets
 */
export function clearOAuthToken(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(OAUTH_STORAGE_KEY);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(OAUTH_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[OAuthStorage] Failed to clear token:', err);
  }
}

/**
 * Check if token is expired, with an optional safety margin (default 60 seconds)
 */
export function isTokenExpired(
  record?: OAuthTokenRecord | null,
  safetyMarginSeconds = 60
): boolean {
  if (!record || !record.expiresAt) return true;
  const now = Date.now();
  const marginMs = safetyMarginSeconds * 1000;
  return now >= record.expiresAt - marginMs;
}

/**
 * Calculate remaining valid lifetime in seconds
 */
export function getTokenRemainingSeconds(record?: OAuthTokenRecord | null): number {
  if (!record || !record.expiresAt) return 0;
  const diffMs = record.expiresAt - Date.now();
  return Math.max(0, Math.floor(diffMs / 1000));
}

/**
 * Detect if token is approaching expiration (default threshold: 300 seconds / 5 minutes)
 */
export function isTokenExpiringSoon(
  record?: OAuthTokenRecord | null,
  thresholdSeconds = 300
): boolean {
  if (!record || !record.expiresAt) return false;
  if (isTokenExpired(record, 0)) return true;
  const remaining = getTokenRemainingSeconds(record);
  return remaining > 0 && remaining <= thresholdSeconds;
}

/**
 * RFC 7009 Token Revocation
 * Sends token revocation request to Google's OAuth2 revocation endpoint
 */
export async function revokeGoogleToken(token: string): Promise<boolean> {
  const cleanToken = (token || '').trim();
  if (!cleanToken) return true;

  try {
    const res = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(cleanToken)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return res.ok;
  } catch (err) {
    console.warn('[OAuthStorage] Token revocation warning:', err);
    return false;
  }
}

/**
 * Parse raw Google scope space-delimited string into structured permissions
 */
export function parseTokenInfoScopes(rawScopeString: string): {
  scopes: string[];
  hasDriveReadonly: boolean;
  hasDriveFile: boolean;
  hasDriveFull: boolean;
} {
  const scopes = (rawScopeString || '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const hasDriveReadonly = scopes.some((s) => s.includes('auth/drive.readonly'));
  const hasDriveFile = scopes.some((s) => s.includes('auth/drive.file'));
  const hasDriveFull = scopes.some(
    (s) => s === 'https://www.googleapis.com/auth/drive' || s === 'drive'
  );

  return { scopes, hasDriveReadonly, hasDriveFile, hasDriveFull };
}

/**
 * Live Scope Inspection via Google TokenInfo API
 */
export async function inspectTokenViaGoogle(accessToken: string): Promise<OAuthScopeInspection> {
  const cleanToken = (accessToken || '').trim().replace(/^Bearer\s+/i, '');
  if (!cleanToken) {
    return {
      isValid: false,
      scopeString: '',
      scopes: [],
      expiresInSeconds: 0,
      hasDriveReadonly: false,
      hasDriveFile: false,
      hasDriveFull: false,
      error: 'Token is empty',
    };
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(cleanToken)}`
    );

    if (!res.ok) {
      const errText = await res.text();
      return {
        isValid: false,
        scopeString: '',
        scopes: [],
        expiresInSeconds: 0,
        hasDriveReadonly: false,
        hasDriveFile: false,
        hasDriveFull: false,
        error: `Token verification failed (${res.status}): ${errText.slice(0, 120)}`,
      };
    }

    const data = await res.json();
    const scopeString = data.scope || '';
    const { scopes, hasDriveReadonly, hasDriveFile, hasDriveFull } = parseTokenInfoScopes(scopeString);
    const expiresInSeconds = parseInt(data.expires_in || '0', 10);

    return {
      isValid: true,
      issuedTo: data.azp || data.aud,
      audience: data.aud,
      userEmail: data.email,
      scopeString,
      scopes,
      expiresInSeconds,
      hasDriveReadonly,
      hasDriveFile,
      hasDriveFull,
    };
  } catch (err: any) {
    return {
      isValid: false,
      scopeString: '',
      scopes: [],
      expiresInSeconds: 0,
      hasDriveReadonly: false,
      hasDriveFile: false,
      hasDriveFull: false,
      error: err.message || 'Failed to reach Google tokeninfo endpoint',
    };
  }
}
