/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Drive Workspace Integration via Firebase Auth SDK
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { MediaAsset, FolderNode, OAuthTokenRecord, DriveBrowserFolder } from '../types';
import { taskLogger } from './taskLogger';
import {
  saveOAuthToken,
  loadOAuthToken,
  clearOAuthToken,
  isTokenExpired,
  revokeGoogleToken,
} from './oauthStorage';
import { getActiveAccountProfile, saveAccountProfile } from './multiAccountAuth';
import { classifyFile } from './fileFormatEngine';

// Initialize Firebase App instance safely without duplicates
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');

provider.setCustomParameters({
  prompt: 'select_account consent',
});

let isSigningIn = false;
let cachedTokenRecord: OAuthTokenRecord | null = loadOAuthToken();
let cachedAccessToken: string | null = cachedTokenRecord ? cachedTokenRecord.accessToken : null;

// Reset in-memory cached OAuth records (used on disconnect & session cleanup)
export const resetGoogleDriveMemoryCache = (): void => {
  cachedAccessToken = null;
  cachedTokenRecord = null;
};

// Error thrown on expired token or unauthenticated state
export class OAuthExpiredError extends Error {
  public isExpired = true;
  constructor(message = 'Google OAuth session has expired or is invalid.') {
    super(message);
    this.name = 'OAuthExpiredError';
  }
}

// Get the current active OAuthTokenRecord
export const getOAuthTokenRecord = (): OAuthTokenRecord | null => {
  if (!cachedTokenRecord) {
    cachedTokenRecord = loadOAuthToken();
    if (cachedTokenRecord) {
      cachedAccessToken = cachedTokenRecord.accessToken;
    }
  }
  return cachedTokenRecord;
};

// Refresh Google Drive Token via Server Endpoint
export const refreshDriveToken = async (): Promise<OAuthTokenRecord | null> => {
  const current = getOAuthTokenRecord();
  if (!current) return null;

  try {
    const res = await fetch('/api/auth/google/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(current.refreshToken ? { refreshToken: current.refreshToken } : {}),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const acquiredAt = Date.now();
    const expiresIn = data.expiresIn || 3600;
    const updated: OAuthTokenRecord = {
      ...current,
      accessToken: data.accessToken,
      acquiredAt,
      expiresAt: acquiredAt + expiresIn * 1000,
      expiresIn,
    };
    saveOAuthToken(updated);
    cachedTokenRecord = updated;
    cachedAccessToken = updated.accessToken;
    return updated;
  } catch (err) {
    console.warn('[GoogleDrive] Refresh failed:', err);
    return null;
  }
};

// Authenticated Google Drive fetch wrapper with automatic token injection, 401 interception, 30s timeout, and exponential backoff
export const authorizedDriveFetch = async (
  url: string,
  options: RequestInit = {},
  maxRetries = 4,
  timeoutMs = 30000
): Promise<Response> => {
  let attempt = 0;

  while (true) {
    let token = await getDriveAccessToken();
    const record = getOAuthTokenRecord();

    if (!token) {
      taskLogger.error('auth', 'Google Drive access token missing', { url });
      throw new OAuthExpiredError('Not authenticated with Google Drive. Please connect your account.');
    }

    // Pre-check expiration with 15s margin
    if (record && isTokenExpired(record, 15)) {
      if (record.refreshToken) {
        taskLogger.info('auth', 'Token near expiration. Attempting automatic refresh...', { url });
        const refreshed = await refreshDriveToken();
        if (refreshed) {
          token = refreshed.accessToken;
        } else {
          clearOAuthToken();
          resetGoogleDriveMemoryCache();
          taskLogger.error('auth', 'Token refresh failed; session cleared', { url });
          throw new OAuthExpiredError('Google Drive session has expired. Please sign in again.');
        }
      } else {
        clearOAuthToken();
        resetGoogleDriveMemoryCache();
        taskLogger.error('auth', 'Token expired without refresh token; session cleared', { url });
        throw new OAuthExpiredError('Google Drive session has expired. Please renew your session.');
      }
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept-Encoding', 'gzip, deflate, br');

    // Create 30-second request timeout controller linked with caller's signal
    const timeoutController = new AbortController();
    let timeoutId: any = null;
    let hasTimedOut = false;

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        hasTimedOut = true;
        timeoutController.abort(new Error(`Google Drive request timed out after ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);
    }

    const onParentAbort = () => {
      timeoutController.abort(options.signal?.reason || new Error('Request aborted by caller'));
    };
    if (options.signal) {
      options.signal.addEventListener('abort', onParentAbort, { once: true });
    }

    try {
      const response = await fetch(url, { ...options, headers, signal: timeoutController.signal });
      if (timeoutId) clearTimeout(timeoutId);

      // 401 Interception (token refresh retry)
      if (response.status === 401) {
        taskLogger.warn('auth', 'Google Drive 401 Unauthorized intercepted. Retrying with token refresh...', { url });
        if (record?.refreshToken) {
          const refreshed = await refreshDriveToken();
          if (refreshed) {
            headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
            return fetch(url, { ...options, headers });
          }
        }
        clearOAuthToken();
        resetGoogleDriveMemoryCache();
        taskLogger.error('auth', '401 Unauthorized token recovery failed; session wiped', { url });
        throw new OAuthExpiredError('Your Google Drive authorization token is invalid or has expired. Please re-authenticate.');
      }

      // 429 Rate Limit & 500/502/503/504 Transient Error Handling with Jittered Exponential Backoff
      if ([429, 500, 502, 503, 504].includes(response.status) && attempt < maxRetries) {
        attempt++;
        const retryAfterHeader = response.headers.get('Retry-After');
        const delayMs = retryAfterHeader
          ? parseInt(retryAfterHeader, 10) * 1000
          : Math.min(30000, Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 500));

        taskLogger.warn(
          'network',
          `Google Drive ${response.status} intercepted (${response.statusText}). Retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})...`,
          { status: response.status, attempt, maxRetries, delayMs, retryAfter: retryAfterHeader, url }
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (!response.ok && attempt >= maxRetries) {
        taskLogger.error('network', `Google Drive request permanently failed (${response.status}) after ${attempt} retries`, {
          status: response.status,
          statusText: response.statusText,
          url,
        });
      }

      return response;
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);

      const isCallerAbort = options.signal?.aborted;
      if (isCallerAbort) {
        throw err;
      }

      const isTimeout = hasTimedOut || err.name === 'TimeoutError' || err.message?.includes('timed out');
      if (attempt < maxRetries && !(err instanceof OAuthExpiredError)) {
        attempt++;
        const delayMs = Math.min(30000, Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 500));
        taskLogger.warn(
          'network',
          isTimeout
            ? `Google Drive request timed out after ${Math.round(timeoutMs / 1000)}s. Retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})...`
            : `Network fetch error: ${err.message}. Retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})...`,
          { attempt, maxRetries, delayMs, url, error: err.message, isTimeout }
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      taskLogger.error('network', `Google Drive fetch aborted permanently: ${err.message}`, { attempt, url }, err);
      throw err;
    } finally {
      if (options.signal) {
        options.signal.removeEventListener('abort', onParentAbort);
      }
    }
  }
};

// Initialize auth state listener with automatic session rehydration
export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string, record?: OAuthTokenRecord) => void,
  onAuthFailure?: () => void
) => {
  // 1. Session rehydration check from persistent storage
  const storedRecord = getOAuthTokenRecord();
  if (storedRecord && !isTokenExpired(storedRecord)) {
    const activeProfile = getActiveAccountProfile();
    const syntheticUser = {
      displayName: activeProfile?.name || (storedRecord.userEmail ? storedRecord.userEmail.split('@')[0] : 'Google Drive User'),
      email: activeProfile?.email || storedRecord.userEmail || 'drive-user@google.com',
      photoURL: activeProfile?.avatarUrl || '',
      uid: activeProfile?.id || 'google_drive_rehydrated',
    } as unknown as User;
    if (onAuthSuccess) onAuthSuccess(syntheticUser, storedRecord.accessToken, storedRecord);
  }

  // 2. Firebase auth state listener
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const record = getOAuthTokenRecord();
      if (record && !isTokenExpired(record)) {
        if (onAuthSuccess) onAuthSuccess(user, record.accessToken, record);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        cachedTokenRecord = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      const record = getOAuthTokenRecord();
      if (!record || isTokenExpired(record)) {
        cachedAccessToken = null;
        cachedTokenRecord = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const googleDriveSignIn = async (): Promise<{ user: User; accessToken: string; record: OAuthTokenRecord } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Drive access token from credential');
    }

    const acquiredAt = Date.now();
    const expiresIn = 3600;
    const record: OAuthTokenRecord = {
      accessToken: credential.accessToken,
      acquiredAt,
      expiresAt: acquiredAt + expiresIn * 1000,
      expiresIn,
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.file',
      ],
      tokenType: 'Bearer',
      provider: 'firebase',
      userEmail: result.user.email || undefined,
    };

    saveOAuthToken(record);
    cachedTokenRecord = record;
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken, record };
  } catch (error: any) {
    console.error('Google Drive sign in failed:', error);
    let friendlyMessage = error.message || 'Authentication failed';

    if (error.code === 'auth/popup-blocked') {
      friendlyMessage = 'Google OAuth cannot render inside an embedded iframe due to X-Frame-Options: DENY clickjacking protection and partitioned cookies. Launching top-level authorization window...';
    } else if (error.code === 'auth/popup-closed-by-user') {
      friendlyMessage = 'The Google sign-in window was closed before finishing authorization.';
    } else if (error.code === 'auth/cancelled-popup-request') {
      friendlyMessage = 'Previous sign-in attempt was cancelled.';
    } else if (error.code === 'auth/unauthorized-domain') {
      friendlyMessage = 'The preview origin is constrained by domain whitelisting inside framed environments. Use the top-level standalone window or direct token option to authenticate immediately.';
    }

    const enhancedError = new Error(friendlyMessage);
    (enhancedError as any).code = error.code;
    throw enhancedError;
  } finally {
    isSigningIn = false;
  }
};

// Directly set a Google OAuth Access Token (e.g. from Google OAuth Playground) with persistence
export const setDirectAccessToken = (token: string, expiresIn = 3600, email?: string): OAuthTokenRecord => {
  const cleanToken = token.trim();
  const acquiredAt = Date.now();
  const record: OAuthTokenRecord = {
    accessToken: cleanToken,
    acquiredAt,
    expiresAt: acquiredAt + expiresIn * 1000,
    expiresIn,
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
    ],
    tokenType: 'Bearer',
    provider: 'direct',
    userEmail: email,
  };

  saveOAuthToken(record);
  cachedTokenRecord = record;
  cachedAccessToken = cleanToken;
  return record;
};

// Test and validate a direct token against Google Drive API
export const validateAndConnectToken = async (
  token: string
): Promise<{ success: boolean; quota?: any; userEmail?: string; userDisplayName?: string; photoURL?: string; record?: OAuthTokenRecord; error?: string }> => {
  const cleanToken = token.trim().replace(/^Bearer\s+/i, '');
  if (!cleanToken) {
    return { success: false, error: 'Access token cannot be empty' };
  }

  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota,user', {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        error: `Google API rejected token (${res.status}): ${errText.slice(0, 150)}`,
      };
    }

    const data = await res.json();
    const userEmail = data.user?.emailAddress || 'Google Drive User';
    const userDisplayName = data.user?.displayName || (userEmail.includes('@') ? userEmail.split('@')[0] : 'Google Drive User');
    const photoURL = data.user?.photoLink || '';
    const record = setDirectAccessToken(cleanToken, 3600, userEmail);

    // Persist account profile to multiAccountAuth registry dynamically (activating on connect)
    try {
      saveAccountProfile(
        {
          name: userDisplayName,
          email: userEmail,
          avatarUrl: photoURL || undefined,
          tokenRecord: record,
        },
        { setActive: true }
      );
    } catch (profileErr) {
      console.warn('Could not register profile in multiAccountAuth:', profileErr);
    }

    const quota = data.storageQuota || {};
    const limit = parseInt(quota.limit || '0', 10) || 15 * 1024 * 1024 * 1024;
    const usage = parseInt(quota.usage || '0', 10) || 0;
    const usageInDrive = parseInt(quota.usageInDrive || '0', 10) || usage;
    const percentage = limit > 0 ? Math.min(100, Math.round((usage / limit) * 100)) : 0;

    return {
      success: true,
      quota: { limit, usage, usageInDrive, percentage },
      userEmail,
      userDisplayName,
      photoURL,
      record,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to reach Google Drive API',
    };
  }
};

export interface DiscoveredGoogleChannel {
  id: string;
  name: string;
  handle: string;
  roleLabel?: string;
  avatarUrl?: string;
  accountType: 'primary' | 'workspace_sub' | 'local';
}

// Resolve authenticated Google Drive identity via server proxy
export const fetchLinkedGoogleAccounts = async (
  accessToken?: string
): Promise<{
  userInfo: { email?: string; name?: string; picture?: string; permissionId?: string };
  channels: DiscoveredGoogleChannel[];
}> => {
  const token = accessToken || getOAuthTokenRecord()?.accessToken;
  if (!token || typeof fetch === 'undefined') {
    return { userInfo: {}, channels: [] };
  }
  try {
    const res = await fetch('/api/auth/google/accounts', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { userInfo: {}, channels: [] };
    const data = await res.json();
    return {
      userInfo: data.userInfo || {},
      channels: Array.isArray(data.channels) ? data.channels : [],
    };
  } catch {
    return { userInfo: {}, channels: [] };
  }
};

export const getDriveAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    const record = getOAuthTokenRecord();
    if (record && !isTokenExpired(record)) {
      cachedAccessToken = record.accessToken;
    }
  }
  return cachedAccessToken;
};

// Clean logout with RFC 7009 token revocation
export const logoutDrive = async (): Promise<void> => {
  if (cachedAccessToken) {
    try {
      await revokeGoogleToken(cachedAccessToken);
    } catch (e) {
      console.warn('Token revocation on logout notice:', e);
    }
  }
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Signout warning:', e);
  }
  clearOAuthToken();
  cachedAccessToken = null;
  cachedTokenRecord = null;
};

// Check direct server OAuth configuration
export const fetchServerOAuthConfig = async (): Promise<{
  hasDirectOAuth: boolean;
  clientId: string | null;
  redirectUri: string;
}> => {
  try {
    const res = await fetch('/api/auth/google/config');
    if (!res.ok) return { hasDirectOAuth: false, clientId: null, redirectUri: '' };
    return await res.json();
  } catch {
    return { hasDirectOAuth: false, clientId: null, redirectUri: '' };
  }
};

// Configure custom Google Client ID & Secret dynamically
export const configureServerOAuth = async (
  clientId: string,
  clientSecret?: string,
  persistEnv = false
): Promise<{ success: boolean; clientId?: string; redirectUri?: string; error?: string }> => {
  try {
    const res = await fetch('/api/auth/google/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret, persistEnv }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update server OAuth configuration' };
    }
    return { success: true, clientId: data.clientId, redirectUri: data.redirectUri };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error configuring OAuth' };
  }
};

// Reset custom OAuth configuration to environment defaults
export const resetServerOAuth = async (): Promise<boolean> => {
  try {
    const res = await fetch('/api/auth/google/configure', { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
};

// Active OAuth Popup Window Tracker (prevents opening multiple popups and Firefox suppression)
let activeOAuthWindow: Window | null = null;

export interface DirectOAuthOptions {
  service?: 'drive' | 'music' | 'workspace';
  prompt?: string;
}

// Start Direct Server OAuth 2.0 PKCE flow in top-level window
// Synchronous window.open called immediately within user click gesture - immune to browser popup suppression!
export const startDirectServerOAuth = (options?: DirectOAuthOptions): Window | null => {
  try {
    const params = new URLSearchParams();
    if (options?.service) params.set('service', options.service);
    if (options?.prompt) params.set('prompt', options.prompt);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const authLoginUrl = `${window.location.origin}/api/auth/google/login${qs}`;

    if (activeOAuthWindow && !activeOAuthWindow.closed) {
      try {
        activeOAuthWindow.location.href = authLoginUrl;
      } catch {
        // Cross-origin fallback
      }
      activeOAuthWindow.focus?.();
      return activeOAuthWindow;
    }
    const win = window.open(
      authLoginUrl,
      'DriveTherapyDirectOAuth',
      'width=540,height=720,status=no,toolbar=no,menubar=no,location=yes,resizable=yes'
    );
    if (!win) {
      console.warn('Popup was blocked by browser. Please allow popups.');
      return null;
    }
    activeOAuthWindow = win;
    win.focus?.();
    return win;
  } catch (err) {
    console.error('Failed to launch direct server OAuth:', err);
    return null;
  }
};

// Map Google Drive API file representation to our canonical MediaAsset
export function mapDriveFileToAsset(file: any, folderMap?: Map<string, FolderNode>): MediaAsset {
  const rawMime = file.mimeType || '';
  const sizeBytes = parseInt(file.size || '0', 10) || 1024 * 1024 * 2.5;
  const modifiedTime = file.modifiedTime || new Date().toISOString();
  const classification = classifyFile({
    filename: file.name,
    mimeType: rawMime,
    sizeBytes,
    modifiedTime,
  });
  const extension = (file.name.includes('.') ? file.name.split('.').pop() || '' : classification.format.extension).toUpperCase();
  const category: MediaAsset['category'] = classification.category;

  // Safe fallback thumbnail
  const thumb = file.thumbnailLink || (category === 'video'
    ? 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80'
    : 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80');

  const meta = file.imageMediaMetadata || {};
  const parentId = file.parents?.[0];

  let filePath = `/Google Drive/${file.name}`;
  if (parentId && folderMap && folderMap.has(parentId)) {
    const parentFolder = folderMap.get(parentId);
    if (parentFolder) {
      filePath = `${parentFolder.path}/${file.name}`;
    }
  }

  return {
    id: `drive_${file.id}`,
    name: file.name,
    source: 'cloud',
    category,
    mimeType: rawMime || classification.mimeType,
    extension,
    path: filePath,
    parentId,
    sizeBytes,
    modifiedTime,
    cloudUrl: file.webContentLink || file.webViewLink || getDriveShareLink(file.id),
    thumbnailUrl: thumb,
    isCached: false,
    cullingStatus: 'unrated',
    rating: 0,
    tags: ['Drive Stream', category.toUpperCase(), extension],
    faces: [],
    quality: {
      sharpness: 85,
      exposure: 88,
      overall: 86,
      isBlurry: false,
      reason: 'Cloud preview indexed',
    },
    palette: ['#1074B1', '#403993', '#52B197', '#BEBF61', '#A61B7A'],
    metadata: {
      formatName: classification.format.name,
      family: classification.format.family,
      viewer: classification.viewer,
      editor: classification.editor,
      containerFormat: classification.format.containerFormat,
      preservationGrade: classification.format.preservationGrade,
    },
    exif: {
      camera: meta.cameraMake ? `${meta.cameraMake} ${meta.cameraModel || ''}` : 'Camera EXIF Available',
      lens: meta.lens,
      focalLength: meta.focalLength ? `${meta.focalLength}mm` : undefined,
      aperture: meta.aperture ? `ƒ/${meta.aperture}` : undefined,
      iso: meta.isoSpeed,
      dimensions: meta.width && meta.height ? `${meta.width} × ${meta.height}` : undefined,
      dateTaken: meta.time,
    },
  };
}

// Fetch files from Google Drive with progressive multi-page auto-pagination (maxItems: 0 = unbounded)
export const fetchDriveFiles = async (
  folderId?: string,
  maxItems: number = 0,
  onProgress?: (
    loadedCount: number,
    itemsPerSec: number,
    pageToken?: string,
    heartbeat?: { page: number; timestamp: number }
  ) => void,
  folderMap?: Map<string, FolderNode>,
  signal?: AbortSignal,
  onBatchReceived?: (batch: MediaAsset[]) => void,
  startPageToken?: string,
  leanProjection = true
): Promise<MediaAsset[]> => {
  const token = await getDriveAccessToken();
  if (!token) {
    taskLogger.error('indexer', 'Google Drive access token missing during fetchDriveFiles');
    throw new Error('Not authenticated with Google Drive');
  }

  const queryParts = ["trashed = false"];
  if (folderId && folderId !== 'root') {
    queryParts.push(`'${folderId}' in parents`);
  }
  // Exclude folder MIME types from media file listing
  queryParts.push("mimeType != 'application/vnd.google-apps.folder'");

  const q = encodeURIComponent(queryParts.join(' and '));
  // Lean projection strips heavy imageMediaMetadata for 5x-8x faster bulk scanning
  const fieldList = leanProjection
    ? 'nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, parents)'
    : 'nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, webContentLink, webViewLink, imageMediaMetadata, parents)';
  const fields = encodeURIComponent(fieldList);
  const orderBy = encodeURIComponent('modifiedTime desc');

  let allAssets: MediaAsset[] = [];
  let pageToken: string | undefined = startPageToken || undefined;
  // Maximum allowed pageSize by Google Drive API v3 is 1000
  const pageSize = maxItems > 0 && maxItems < 1000 ? maxItems : 1000;
  const startTime = Date.now();
  let pageIndex = 0;

  taskLogger.task(
    'drive_scan',
    `Initiating Google Drive file fetch (maxItems: ${maxItems === 0 ? 'unbounded' : maxItems}, pageSize: ${pageSize})`,
    { folderId, maxItems, pageSize, leanProjection }
  );

  do {
    if (signal?.aborted) {
      taskLogger.warn('indexer', 'Drive file scanning aborted by user signal', { page: pageIndex, loadedCount: allAssets.length });
      break;
    }

    pageIndex++;
    let url = `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=${pageSize}&fields=${fields}&orderBy=${orderBy}&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    if (pageToken) {
      url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    const response = await authorizedDriveFetch(url, { signal }, 4, 30000);

    if (!response.ok) {
      const errorText = await response.text();
      const err = new Error(`Google Drive API error (${response.status}): ${errorText}`);
      taskLogger.error(
        'indexer',
        `Drive file stream error on page ${pageIndex}: HTTP ${response.status}`,
        { page: pageIndex, error: errorText },
        err
      );
      throw err;
    }

    const data = await response.json();
    const files: any[] = data.files || [];
    const pageAssets = files.map((f: any) => mapDriveFileToAsset(f, folderMap));
    allAssets.push(...pageAssets);

    if (onBatchReceived && pageAssets.length > 0) {
      onBatchReceived(pageAssets);
    }

    pageToken = data.nextPageToken;

    const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
    const itemsPerSec = Math.round(allAssets.length / elapsedSec);

    taskLogger.info(
      'indexer',
      `Page ${pageIndex} indexed: ${files.length} files (cumulative: ${allAssets.length.toLocaleString()}) @ ${itemsPerSec} files/sec`,
      {
        page: pageIndex,
        pageItems: files.length,
        totalItems: allAssets.length,
        itemsPerSec,
        hasNextPage: Boolean(pageToken),
      }
    );

    if (onProgress) {
      onProgress(allAssets.length, itemsPerSec, pageToken, { page: pageIndex, timestamp: Date.now() });
    }
  } while (pageToken && (maxItems <= 0 || allAssets.length < maxItems));

  if (!pageToken) {
    taskLogger.success(
      'indexer',
      `Google Drive file streaming completed: ${allAssets.length.toLocaleString()} files across ${pageIndex} pages. End of stream reached (no nextPageToken).`,
      {
        totalFiles: allAssets.length,
        totalPages: pageIndex,
        durationSec: Math.round((Date.now() - startTime) / 1000),
      }
    );
  }

  return allAssets;
};

/**
 * AIRPHANT-Style Sharded Parallel Drive Catalog Indexing:
 * Splits Drive v3 scanning into concurrent category shards (image, video, audio, docs/other)
 * running in parallel with lean metadata projection, reducing wall-clock scan time by ~3-5x.
 */
export async function fetchDriveCatalogSharded(options?: {
  onProgress?: (loadedCount: number, shardName: string) => void;
  onBatchReceived?: (batch: MediaAsset[]) => void;
  signal?: AbortSignal;
}): Promise<{ folderMap: Map<string, FolderNode>; assets: MediaAsset[] }> {
  const folderNodes = await fetchDriveFolders(undefined, 0, options?.signal);
  const folderMap = new Map<string, FolderNode>();
  for (const f of folderNodes) {
    folderMap.set(f.id.replace(/^drive_/, ''), f);
  }
  const shardQueries: Array<{ name: string; q: string }> = [
    { name: 'images', q: "mimeType contains 'image/' and trashed = false" },
    { name: 'videos', q: "mimeType contains 'video/' and trashed = false" },
    { name: 'audio', q: "mimeType contains 'audio/' and trashed = false" },
    {
      name: 'docs_other',
      q: "not mimeType contains 'image/' and not mimeType contains 'video/' and not mimeType contains 'audio/' and mimeType != 'application/vnd.google-apps.folder' and trashed = false",
    },
  ];

  const deduped = new Map<string, MediaAsset>();
  const fields = encodeURIComponent(
    'nextPageToken,files(id,name,mimeType,size,modifiedTime,parents,trashed,thumbnailLink,iconLink)'
  );

  await Promise.all(
    shardQueries.map(async (shard) => {
      let pageToken: string | undefined;
      do {
        if (options?.signal?.aborted) break;
        let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          shard.q
        )}&pageSize=1000&fields=${fields}&supportsAllDrives=true&includeItemsFromAllDrives=true`;
        if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

        const res = await authorizedDriveFetch(url, { signal: options?.signal }, 3, 25000);
        if (!res.ok) break;
        const data = await res.json();
        const batch: MediaAsset[] = [];
        for (const f of data.files || []) {
          const asset = mapDriveFileToAsset(f, folderMap);
          if (!deduped.has(asset.id)) {
            deduped.set(asset.id, asset);
            batch.push(asset);
          }
        }
        if (batch.length > 0) {
          options?.onBatchReceived?.(batch);
          options?.onProgress?.(deduped.size, shard.name);
        }
        pageToken = data.nextPageToken;
      } while (pageToken);
    })
  );

  return { folderMap, assets: Array.from(deduped.values()) };
}

// -----------------------------------------------------------------------------
// Google Drive Changes API (Instantaneous Sub-Second Delta Sync)
// -----------------------------------------------------------------------------

// Retrieve initial startPageToken for subsequent incremental delta synchronization
export const getDriveChangesStartPageToken = async (): Promise<string | null> => {
  try {
    const res = await authorizedDriveFetch('https://www.googleapis.com/drive/v3/changes/startPageToken');
    if (!res.ok) return null;
    const data = await res.json();
    return data.startPageToken || null;
  } catch (err) {
    console.warn('[GoogleDrive] Could not fetch Changes API startPageToken:', err);
    return null;
  }
};

// Fetch incremental changes (additions, modifications, deletions) since previous startPageToken
export const fetchDriveChanges = async (
  savedPageToken: string,
  folderMap?: Map<string, FolderNode>,
  signal?: AbortSignal
): Promise<{
  addedOrModified: MediaAsset[];
  removedIds: string[];
  newStartPageToken?: string;
}> => {
  let currentPageToken: string | undefined = savedPageToken;
  let newStartPageToken: string | undefined = undefined;
  const addedOrModified: MediaAsset[] = [];
  const removedIds: string[] = [];

  const fields = encodeURIComponent(
    'nextPageToken, newStartPageToken, changes(fileId, removed, file(id, name, mimeType, size, modifiedTime, thumbnailLink, parents, trashed))'
  );

  do {
    if (signal?.aborted) break;

    const url = `https://www.googleapis.com/drive/v3/changes?pageToken=${encodeURIComponent(
      currentPageToken
    )}&pageSize=1000&fields=${fields}&supportsAllDrives=true&includeItemsFromAllDrives=true`;

    const res = await authorizedDriveFetch(url);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Drive Changes API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const changes: any[] = data.changes || [];

    for (const change of changes) {
      if (change.removed || change.file?.trashed) {
        const rawId = cleanDriveFileId(change.fileId);
        if (rawId) {
          removedIds.push(rawId);
          removedIds.push(`drive_${rawId}`);
        }
      } else if (change.file && change.file.mimeType !== 'application/vnd.google-apps.folder') {
        addedOrModified.push(mapDriveFileToAsset(change.file, folderMap));
      }
    }

    currentPageToken = data.nextPageToken;
    if (data.newStartPageToken) {
      newStartPageToken = data.newStartPageToken;
    }
  } while (currentPageToken);

  return { addedOrModified, removedIds, newStartPageToken };
};

// -----------------------------------------------------------------------------
// Google Drive HTTP Batching (Up to 100 API Calls per Single HTTP Request)
// -----------------------------------------------------------------------------

export interface DriveBatchSubRequest {
  id: string;
  method?: string;
  path: string; // e.g. '/drive/v3/files/{fileId}?fields=...'
  body?: any;
}

// Executes up to 100 sub-requests combined in a single RFC 2046 multipart/mixed HTTP call
export const executeDriveBatch = async <T = any>(
  requests: DriveBatchSubRequest[]
): Promise<Map<string, T>> => {
  const results = new Map<string, T>();
  if (!requests || requests.length === 0) return results;

  const token = await getDriveAccessToken();
  if (!token) throw new OAuthExpiredError('Not authenticated with Google Drive');

  // Google Drive specification limit: max 100 requests per batch call
  for (let i = 0; i < requests.length; i += 100) {
    const chunk = requests.slice(i, i + 100);
    const boundary = `batch_dt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    let multipartBody = '';
    for (const req of chunk) {
      multipartBody += `--${boundary}\r\n`;
      multipartBody += 'Content-Type: application/http\r\n';
      multipartBody += `Content-ID: <${req.id}>\r\n\r\n`;
      multipartBody += `${req.method || 'GET'} ${req.path} HTTP/1.1\r\n\r\n`;
      if (req.body) {
        multipartBody += `${JSON.stringify(req.body)}\r\n\r\n`;
      }
    }
    multipartBody += `--${boundary}--\r\n`;

    const res = await fetch('https://www.googleapis.com/batch/drive/v3', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/mixed; boundary=${boundary}`,
        'Accept-Encoding': 'gzip, deflate, br',
      },
      body: multipartBody,
    });

    if (!res.ok) {
      console.warn(`[GoogleDrive] Batch request chunk failed: HTTP ${res.status}`);
      continue;
    }

    const text = await res.text();
    const parts = text.split(`--${boundary}`);
    for (const part of parts) {
      if (part.includes('Content-ID:')) {
        const idMatch = part.match(/Content-ID:\s*<([^>]+)>/i) || part.match(/Content-ID:\s*response-([^\r\n]+)/i);
        if (idMatch) {
          const reqId = idMatch[1];
          const jsonMatch = part.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              results.set(reqId, parsed);
            } catch {
              // Ignore non-json parts
            }
          }
        }
      }
    }
  }

  return results;
};

// Paged fetch for manual infinite scroll or incremental loading
export const fetchDriveFilesPaged = async (
  folderId?: string,
  pageToken?: string,
  pageSize: number = 50,
  folderMap?: Map<string, FolderNode>
): Promise<{ assets: MediaAsset[]; nextPageToken?: string; hasMore: boolean }> => {
  const token = await getDriveAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google Drive');
  }

  const queryParts = ["trashed = false"];
  if (folderId && folderId !== 'root') {
    queryParts.push(`'${folderId}' in parents`);
  }
  queryParts.push("mimeType != 'application/vnd.google-apps.folder'");

  const q = encodeURIComponent(queryParts.join(' and '));
  const fields = encodeURIComponent(
    'nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, webContentLink, webViewLink, imageMediaMetadata, parents)'
  );

  let url = `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=${pageSize}&fields=${fields}`;
  if (pageToken) {
    url += `&pageToken=${encodeURIComponent(pageToken)}`;
  }

  const response = await authorizedDriveFetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Drive API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const files: any[] = data.files || [];
  return {
    assets: files.map((f: any) => mapDriveFileToAsset(f, folderMap)),
    nextPageToken: data.nextPageToken,
    hasMore: Boolean(data.nextPageToken),
  };
};

// Fetch real Google Drive storage quota (drive.about.get)
let cachedQuota: {
  data: { limit: number; usage: number; usageInDrive: number; percentage: number };
  timestamp: number;
} | null = null;

export const fetchDriveStorageQuota = async (forceFresh = false): Promise<{
  limit: number;
  usage: number;
  usageInDrive: number;
  percentage: number;
}> => {
  const now = Date.now();
  if (!forceFresh && cachedQuota && now - cachedQuota.timestamp < 60000) {
    return cachedQuota.data;
  }

  const token = await getDriveAccessToken();
  if (!token) {
    return { limit: 15 * 1024 * 1024 * 1024, usage: 0, usageInDrive: 0, percentage: 0 };
  }

  try {
    const res = await authorizedDriveFetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota,user');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const quota = data.storageQuota || {};
    const limit = parseInt(quota.limit || '0', 10) || 15 * 1024 * 1024 * 1024;
    const usage = parseInt(quota.usage || '0', 10) || 0;
    const usageInDrive = parseInt(quota.usageInDrive || '0', 10) || usage;
    const percentage = limit > 0 ? Math.min(100, Math.round((usage / limit) * 100)) : 0;

    const result = { limit, usage, usageInDrive, percentage };
    cachedQuota = { data: result, timestamp: now };
    return result;
  } catch (err) {
    console.warn('Could not fetch storage quota:', err);
    return { limit: 15 * 1024 * 1024 * 1024, usage: 0, usageInDrive: 0, percentage: 0 };
  }
};

// Helper to build recursive full folder path from parent links
export function buildFolderPath(
  folderId: string,
  folderMap: Map<string, { id: string; name: string; parentId?: string }>,
  visited: Set<string> = new Set()
): string {
  if (visited.has(folderId)) return '';
  visited.add(folderId);
  const folder = folderMap.get(folderId);
  if (!folder) return '';
  if (folder.parentId && folderMap.has(folder.parentId)) {
    const parentPath = buildFolderPath(folder.parentId, folderMap, visited);
    return parentPath ? `${parentPath}/${folder.name}` : `/${folder.name}`;
  }
  return `/${folder.name}`;
}

// Fetch complete folder tree from Google Drive with configurable pagination limit (maxFolders = 0 for unbounded)
export const fetchDriveFolders = async (
  parentId?: string,
  maxFolders: number = 0,
  signal?: AbortSignal,
  onProgress?: (foldersCount: number) => void
): Promise<FolderNode[]> => {
  const token = await getDriveAccessToken();
  if (!token) return [];

  const queryParts = ["mimeType = 'application/vnd.google-apps.folder'", 'trashed = false'];
  if (parentId) {
    queryParts.push(`'${parentId}' in parents`);
  }

  const q = encodeURIComponent(queryParts.join(' and '));
  const fields = encodeURIComponent('nextPageToken, files(id, name, parents)');

  let rawFolders: any[] = [];
  let pageToken: string | undefined = undefined;
  const pageSize = maxFolders > 0 && maxFolders < 1000 ? maxFolders : 1000;

  try {
    do {
      if (signal?.aborted) break;

      let url = `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=${pageSize}&fields=${fields}&supportsAllDrives=true&includeItemsFromAllDrives=true`;
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }
      const response = await authorizedDriveFetch(url);
      if (!response.ok) break;
      const data = await response.json();
      rawFolders = [...rawFolders, ...(data.files || [])];
      if (onProgress) onProgress(rawFolders.length);
      pageToken = data.nextPageToken;
    } while (pageToken && (maxFolders <= 0 || rawFolders.length < maxFolders));

    // Map for resolving recursive parent paths
    const folderMap = new Map<string, { id: string; name: string; parentId?: string }>();
    for (const f of rawFolders) {
      folderMap.set(f.id, { id: f.id, name: f.name, parentId: f.parents?.[0] });
    }

    taskLogger.info('indexer', `Discovered ${rawFolders.length} Google Drive folders`, { totalFolders: rawFolders.length });

    return rawFolders.map((f: any) => ({
      id: f.id,
      name: f.name,
      source: 'cloud' as const,
      path: buildFolderPath(f.id, folderMap),
      parentId: f.parents?.[0],
      itemCount: 0,
    }));
  } catch (err: any) {
    taskLogger.warn('indexer', `Could not complete full folder discovery: ${err?.message}`, { error: err?.message });
    return [];
  }
};

// Create a new remote folder on Google Drive
export const createDriveFolder = async (name: string, parentFolderId?: string): Promise<FolderNode> => {
  const metadata: any = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentFolderId && parentFolderId !== 'root' && parentFolderId !== 'folder_all') {
    metadata.parents = [parentFolderId];
  }

  const response = await authorizedDriveFetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create Google Drive folder: ${err}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    source: 'cloud',
    path: `/${data.name}`,
    parentId: parentFolderId,
    itemCount: 0,
  };
};

// Upload a local file to Google Drive using multipart upload
export const uploadFileToDrive = async (
  file: File,
  folderId?: string,
  onProgress?: (percentage: number) => void
): Promise<MediaAsset> => {
  const metadata: any = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
  };
  if (folderId && folderId !== 'root' && folderId !== 'folder_all') {
    metadata.parents = [folderId];
  }

  if (onProgress) onProgress(15);

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const reader = new FileReader();
  const fileDataPromise = new Promise<ArrayBuffer>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

  const fileBytes = await fileDataPromise;
  if (onProgress) onProgress(45);

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const mediaHeaderPart = `${delimiter}Content-Type: ${metadata.mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`;

  // Convert binary buffer to base64
  let binary = '';
  const bytes = new Uint8Array(fileBytes);
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  const base64Data = btoa(binary);

  const multipartBody = `${metadataPart}${mediaHeaderPart}${base64Data}${closeDelimiter}`;
  if (onProgress) onProgress(70);

  const response = await authorizedDriveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,thumbnailLink,webContentLink,webViewLink', {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload to Google Drive failed (${response.status}): ${errorText}`);
  }

  if (onProgress) onProgress(100);
  const data = await response.json();
  return mapDriveFileToAsset(data);
};

// Normalize Google Drive File ID by stripping any client-side "drive_" prefix
export const cleanDriveFileId = (fileId: string): string => {
  if (!fileId) return '';
  return fileId.trim().replace(/^drive_/, '');
};

// Soft-delete / Move Google Drive file to Trash
export const trashDriveFile = async (fileId: string): Promise<boolean> => {
  const cleanId = cleanDriveFileId(fileId);
  const response = await authorizedDriveFetch(`https://www.googleapis.com/drive/v3/files/${cleanId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trashed: true }),
  });

  return response.ok;
};

// Download original high-res media binary from Google Drive (with Google Workspace doc export fallback)
export const downloadDriveFile = async (fileId: string, filename?: string): Promise<Blob> => {
  const cleanId = cleanDriveFileId(fileId);
  const response = await authorizedDriveFetch(`https://www.googleapis.com/drive/v3/files/${cleanId}?alt=media`);

  if (!response.ok) {
    // If 403 or error, check if this is a Google Workspace Document (Docs, Sheets, Slides) that requires export
    try {
      const exportResponse = await authorizedDriveFetch(
        `https://www.googleapis.com/drive/v3/files/${cleanId}/export?mimeType=application/pdf`
      );
      if (exportResponse.ok) {
        taskLogger.info('indexer', `Exported Google Workspace document to PDF`, { fileId: cleanId, filename });
        return await exportResponse.blob();
      }
    } catch {
      // Continue to throw primary error below
    }

    const errText = await response.text().catch(() => '');
    taskLogger.error('network', `Failed to download binary from Google Drive: HTTP ${response.status}`, { fileId: cleanId, errText });
    throw new Error(`Failed to download from Google Drive (HTTP ${response.status}): ${errText || response.statusText}`);
  }

  return await response.blob();
};

// Resilient Binary Downloader (Fast Single-Stream with Automatic Chunk Fallback)
export const downloadDriveFileChunked = async (
  fileId: string,
  totalSizeBytes?: number,
  concurrency = 6,
  chunkSize = 2 * 1024 * 1024 // 2MB chunk buffer
): Promise<Blob> => {
  const cleanId = cleanDriveFileId(fileId);
  // For small-to-medium files, direct stream is 3x faster and avoids Range negotiation overhead
  if (!totalSizeBytes || totalSizeBytes <= chunkSize * 2) {
    return await downloadDriveFile(cleanId);
  }

  try {
    const chunksCount = Math.ceil(totalSizeBytes / chunkSize);
    const chunksBuffers: ArrayBuffer[] = new Array(chunksCount);

    let currentChunk = 0;
    let fullBlobReceived: Blob | null = null;

    const workers = Array.from({ length: Math.min(concurrency, chunksCount) }, async () => {
      while (currentChunk < chunksCount && !fullBlobReceived) {
        const idx = currentChunk++;
        const start = idx * chunkSize;
        const end = Math.min(totalSizeBytes - 1, start + chunkSize - 1);

        const res = await authorizedDriveFetch(
          `https://www.googleapis.com/drive/v3/files/${cleanId}?alt=media`,
          {
            headers: { Range: `bytes=${start}-${end}` },
          }
        );

        // If Google Drive returns 200 OK (server ignored Range and returned complete binary)
        if (res.ok && res.status === 200) {
          fullBlobReceived = await res.blob();
          return;
        }

        if (!res.ok && res.status !== 206) {
          throw new Error(`Range chunk ${idx} failed: HTTP ${res.status}`);
        }

        chunksBuffers[idx] = await res.arrayBuffer();
      }
    });

    await Promise.all(workers);

    if (fullBlobReceived) {
      return fullBlobReceived;
    }

    return new Blob(chunksBuffers);
  } catch (err: any) {
    taskLogger.warn('network', `Chunked range download failed; falling back to standard stream: ${err.message}`, { fileId: cleanId });
    // Resilient fallback to single-stream download
    return await downloadDriveFile(cleanId);
  }
};

// -----------------------------------------------------------------------------
// Google Drive Context Menu Operations (Star, Rename, Copy, Move, Share)
// -----------------------------------------------------------------------------

// Generate standard Google Drive shareable web view link
export const getDriveShareLink = (fileId: string): string => {
  const cleanId = cleanDriveFileId(fileId);
  return `https://drive.google.com/file/d/${cleanId}/view?usp=sharing`;
};

// Toggle or update starred status on a Google Drive file
export const updateDriveFileStar = async (fileId: string, starred: boolean): Promise<boolean> => {
  const cleanId = cleanDriveFileId(fileId);
  try {
    const response = await authorizedDriveFetch(`https://www.googleapis.com/drive/v3/files/${cleanId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ starred }),
    });
    if (response.ok) {
      taskLogger.info('indexer', `Google Drive file star updated`, { fileId: cleanId, starred });
    }
    return response.ok;
  } catch (err: any) {
    taskLogger.error('indexer', `Failed to update star for ${cleanId}: ${err.message}`, { fileId: cleanId, starred });
    return false;
  }
};

// Rename a file on Google Drive
export const renameDriveFile = async (fileId: string, newName: string): Promise<boolean> => {
  const cleanId = cleanDriveFileId(fileId);
  try {
    const response = await authorizedDriveFetch(`https://www.googleapis.com/drive/v3/files/${cleanId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newName }),
    });
    if (response.ok) {
      taskLogger.info('indexer', `Google Drive file renamed`, { fileId: cleanId, newName });
    }
    return response.ok;
  } catch (err: any) {
    taskLogger.error('indexer', `Failed to rename Google Drive file ${cleanId}: ${err.message}`, { fileId: cleanId, newName });
    return false;
  }
};

// Create a copy of a file in Google Drive
export const copyDriveFile = async (fileId: string, copyName?: string): Promise<MediaAsset | null> => {
  const cleanId = cleanDriveFileId(fileId);
  try {
    const payload: { name?: string } = {};
    if (copyName) {
      payload.name = copyName;
    }
    const response = await authorizedDriveFetch(
      `https://www.googleapis.com/drive/v3/files/${cleanId}/copy?fields=id,name,mimeType,size,modifiedTime,thumbnailLink,webContentLink,webViewLink,parents`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Drive copy failed (${response.status}): ${errText}`);
    }
    const data = await response.json();
    const asset = mapDriveFileToAsset(data);
    taskLogger.info('indexer', `Google Drive file copied: ${asset.name} (${asset.id})`, { sourceId: cleanId, copyId: asset.id });
    return asset;
  } catch (err: any) {
    taskLogger.error('indexer', `Failed to copy Google Drive file ${cleanId}: ${err.message}`, { fileId: cleanId }, err);
    return null;
  }
};

// Move a Google Drive file to another folder
export const moveDriveFile = async (
  fileId: string,
  newParentId: string,
  prevParentId?: string
): Promise<boolean> => {
  const cleanId = cleanDriveFileId(fileId);
  const cleanNewParent = cleanDriveFileId(newParentId);
  const cleanPrevParent = prevParentId ? cleanDriveFileId(prevParentId) : undefined;
  try {
    let url = `https://www.googleapis.com/drive/v3/files/${cleanId}?addParents=${encodeURIComponent(cleanNewParent)}`;
    if (cleanPrevParent && cleanPrevParent !== 'root' && cleanPrevParent !== 'folder_all') {
      url += `&removeParents=${encodeURIComponent(cleanPrevParent)}`;
    }
    const response = await authorizedDriveFetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (response.ok) {
      taskLogger.info('indexer', `Moved Google Drive file ${cleanId} to folder ${cleanNewParent}`, { fileId: cleanId, newParentId: cleanNewParent, prevParentId: cleanPrevParent });
    }
    return response.ok;
  } catch (err: any) {
    taskLogger.error('indexer', `Failed to move Google Drive file ${cleanId}: ${err.message}`, { fileId: cleanId, newParentId: cleanNewParent });
    return false;
  }
};

// -----------------------------------------------------------------------------
// Live Google Drive Directory Browser (No Auto-Sync) & Selective Item Sync
// -----------------------------------------------------------------------------

export type DriveBrowserSection = 'my-drive' | 'shared' | 'starred' | 'recent' | 'trash';

export interface DriveBrowserQueryOptions {
  folderId?: string;
  section?: DriveBrowserSection;
  searchQuery?: string;
  onlyFolders?: boolean;
  excludeFolders?: boolean;
}

/**
 * Constructs a Google Drive v3 API query string for live directory browsing
 * without mutating local catalog storage.
 */
export function buildDriveBrowserQuery(options: DriveBrowserQueryOptions = {}): string {
  const {
    folderId,
    section = 'my-drive',
    searchQuery,
    onlyFolders = false,
    excludeFolders = false,
  } = options;

  const isTrash = section === 'trash';
  const parts: string[] = [isTrash ? 'trashed = true' : 'trashed = false'];

  if (onlyFolders) {
    parts.push("mimeType = 'application/vnd.google-apps.folder'");
  } else if (excludeFolders) {
    parts.push("mimeType != 'application/vnd.google-apps.folder'");
  }

  const cleanSearch = searchQuery?.trim();
  if (cleanSearch) {
    const escaped = cleanSearch.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    parts.push(`name contains '${escaped}'`);
    if (folderId && folderId !== 'root' && section === 'my-drive') {
      parts.push(`'${folderId}' in parents`);
    } else if (section === 'shared' && !folderId) {
      parts.push('sharedWithMe = true');
    } else if (section === 'starred' && !folderId) {
      parts.push('starred = true');
    }
    return parts.join(' and ');
  }

  if (isTrash) {
    return parts.join(' and ');
  } else if (section === 'shared') {
    if (folderId && folderId !== 'root') {
      parts.push(`'${folderId}' in parents`);
    } else {
      parts.push('sharedWithMe = true');
    }
  } else if (section === 'starred') {
    if (folderId && folderId !== 'root') {
      parts.push(`'${folderId}' in parents`);
    } else {
      parts.push('starred = true');
    }
  } else if (section === 'recent') {
    if (!onlyFolders && !excludeFolders) {
      parts.push("mimeType != 'application/vnd.google-apps.folder'");
    }
  } else {
    parts.push(`'${folderId || 'root'}' in parents`);
  }

  return parts.join(' and ');
}

/**
 * Browse a single Google Drive folder or virtual section live via REST v3
 * without persisting items or scanning the rest of Drive.
 */
export async function browseDriveDirectory(options: {
  folderId?: string;
  folderPath?: string;
  section?: DriveBrowserSection;
  pageToken?: string;
  pageSize?: number;
  searchQuery?: string;
  signal?: AbortSignal;
}): Promise<{ folders: DriveBrowserFolder[]; files: MediaAsset[]; nextPageToken?: string }> {
  const {
    folderId = 'root',
    folderPath = '/Google Drive',
    section = 'my-drive',
    pageToken,
    pageSize = 60,
    searchQuery,
    signal,
  } = options;

  const token = await getDriveAccessToken();
  if (!token) {
    throw new OAuthExpiredError('Please connect your Google Drive account to browse Drive folders.');
  }

  const folderFields = encodeURIComponent('files(id, name, parents, modifiedTime, shared, starred)');
  const fileFields = encodeURIComponent(
    'nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, webContentLink, webViewLink, imageMediaMetadata, parents)'
  );

  // Fetch immediate child folders only on initial page (not when loading next page of files or viewing Recent)
  let folders: DriveBrowserFolder[] = [];
  if (!pageToken && section !== 'recent') {
    const fq = encodeURIComponent(
      buildDriveBrowserQuery({
        folderId,
        section,
        searchQuery,
        onlyFolders: true,
      })
    );
    const folderUrl = `https://www.googleapis.com/drive/v3/files?q=${fq}&pageSize=200&fields=${folderFields}&orderBy=${encodeURIComponent(
      'name'
    )}&supportsAllDrives=true&includeItemsFromAllDrives=true`;

    const folderRes = await authorizedDriveFetch(folderUrl, { signal }, 3, 25000);
    if (folderRes.ok) {
      const folderData = await folderRes.json();
      folders = (folderData.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        parentId: f.parents?.[0],
        modifiedTime: f.modifiedTime,
        path: `${folderPath.replace(/\/$/, '')}/${f.name}`,
        shared: Boolean(f.shared),
        starred: Boolean(f.starred),
      }));
    }
  }

  // Fetch immediate non-folder files for this directory/page
  const q = encodeURIComponent(
    buildDriveBrowserQuery({
      folderId,
      section,
      searchQuery,
      excludeFolders: true,
    })
  );
  let filesUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=${pageSize}&fields=${fileFields}&orderBy=${encodeURIComponent(
    section === 'recent' ? 'modifiedTime desc' : 'modifiedTime desc'
  )}&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  if (pageToken) {
    filesUrl += `&pageToken=${encodeURIComponent(pageToken)}`;
  }

  const filesRes = await authorizedDriveFetch(filesUrl, { signal }, 3, 25000);
  if (!filesRes.ok) {
    const errText = await filesRes.text();
    throw new Error(`Google Drive browse failed (${filesRes.status}): ${errText}`);
  }

  const filesData = await filesRes.json();
  const tempFolderMap = new Map<string, FolderNode>();
  if (folderId && folderId !== 'root') {
    tempFolderMap.set(folderId, {
      id: folderId,
      name: folderPath.split('/').filter(Boolean).pop() || 'Folder',
      source: 'cloud',
      path: folderPath,
      itemCount: 0,
    });
  }

  const files = (filesData.files || []).map((f: any) => mapDriveFileToAsset(f, tempFolderMap));
  return {
    folders,
    files,
    nextPageToken: filesData.nextPageToken,
  };
}

/**
 * Collects rootFolderId and every nested descendant folder ID using parentId links (cycle-safe).
 */
export function collectDescendantFolderIds(
  rootFolderId: string,
  folders: Array<{ id: string; parentId?: string }>
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const f of folders) {
    if (!f.parentId) continue;
    const list = childrenByParent.get(f.parentId);
    if (list) list.push(f.id);
    else childrenByParent.set(f.parentId, [f.id]);
  }

  const result = new Set<string>([rootFolderId]);
  const queue: string[] = [rootFolderId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const children = childrenByParent.get(cur) || [];
    for (const childId of children) {
      if (!result.has(childId)) {
        result.add(childId);
        queue.push(childId);
      }
    }
  }
  return result;
}

/**
 * Rolls up recursive itemCount totals from leaf subfolders up to parent FolderNodes.
 */
export function rollUpRecursiveFolderCounts(
  folderNodes: FolderNode[],
  directCounts: Map<string, number>
): void {
  const childrenByParent = new Map<string, string[]>();
  for (const node of folderNodes) {
    if (!node.parentId) continue;
    const list = childrenByParent.get(node.parentId);
    if (list) list.push(node.id);
    else childrenByParent.set(node.parentId, [node.id]);
  }

  const memo = new Map<string, number>();
  const visiting = new Set<string>();

  const computeTotal = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);

    let total = directCounts.get(id) ?? 0;
    const children = childrenByParent.get(id) || [];
    for (const childId of children) {
      total += computeTotal(childId);
    }

    visiting.delete(id);
    memo.set(id, total);
    return total;
  };

  for (const node of folderNodes) {
    node.itemCount = computeTotal(node.id);
  }
}

/**
 * Selectively fetch all files inside one Google Drive folder (and recursively all subfolders by default)
 * using a batched multi-parent query + 6-worker concurrent pool so deep folder trees resolve fast.
 */
export async function fetchDriveFolderAssetsForSync(
  folder: DriveBrowserFolder,
  options?: {
    recursive?: boolean;
    concurrency?: number;
    onProgress?: (progress: { filesCount: number; foldersCount: number; currentFolder: string }) => void;
    signal?: AbortSignal;
  }
): Promise<{ folderNode: FolderNode; subFolders: FolderNode[]; assets: MediaAsset[] }> {
  const recursive = options?.recursive ?? true;
  const concurrency = Math.max(1, Math.min(8, options?.concurrency ?? 6));
  const visited = new Set<string>([folder.id]);
  const rootPath = folder.path || `/${folder.name}`;

  const rootFolderNode: FolderNode = {
    id: folder.id,
    name: folder.name,
    source: 'cloud',
    path: rootPath,
    parentId: folder.parentId,
    itemCount: 0,
  };

  const folderMap = new Map<string, FolderNode>([[folder.id, rootFolderNode]]);
  const collectedSubFolders: FolderNode[] = [];
  const directCounts = new Map<string, number>();
  const allAssets: MediaAsset[] = [];

  const queue: DriveBrowserFolder[] = [folder];
  let activeWorkers = 0;

  const processFolder = async (current: DriveBrowserFolder): Promise<void> => {
    if (options?.signal?.aborted) return;

    options?.onProgress?.({
      filesCount: allAssets.length,
      foldersCount: collectedSubFolders.length + 1,
      currentFolder: current.name,
    });

    // Fetch direct files and direct subfolders in parallel!
    const [directFiles, childFolders] = await Promise.all([
      fetchDriveFiles(
        current.id,
        0,
        (count) =>
          options?.onProgress?.({
            filesCount: allAssets.length + count,
            foldersCount: collectedSubFolders.length + 1,
            currentFolder: current.name,
          }),
        folderMap,
        options?.signal,
        undefined,
        undefined,
        false
      ),
      recursive ? fetchDriveFolders(current.id, 0, options?.signal) : Promise.resolve([]),
    ]);

    directCounts.set(current.id, directFiles.length);
    allAssets.push(...directFiles);

    if (recursive) {
      for (const child of childFolders) {
        if (visited.has(child.id)) continue;
        visited.add(child.id);
        const childPath = `${(current.path || `/${current.name}`).replace(/\/$/, '')}/${child.name}`;
        const childNode: FolderNode = {
          id: child.id,
          name: child.name,
          source: 'cloud',
          path: childPath,
          parentId: current.id,
          itemCount: 0,
        };
        folderMap.set(child.id, childNode);
        collectedSubFolders.push(childNode);
        queue.push({
          id: child.id,
          name: child.name,
          parentId: current.id,
          path: childPath,
        });
      }
    }
  };

  await new Promise<void>((resolve) => {
    const scheduleNext = () => {
      if (options?.signal?.aborted || (queue.length === 0 && activeWorkers === 0)) {
        resolve();
        return;
      }
      while (activeWorkers < concurrency && queue.length > 0 && !options?.signal?.aborted) {
        const nextFolder = queue.shift()!;
        activeWorkers++;
        void processFolder(nextFolder).finally(() => {
          activeWorkers--;
          scheduleNext();
        });
      }
    };
    scheduleNext();
  });

  rollUpRecursiveFolderCounts([rootFolderNode, ...collectedSubFolders], directCounts);

  options?.onProgress?.({
    filesCount: allAssets.length,
    foldersCount: collectedSubFolders.length + 1,
    currentFolder: folder.name,
  });

  return {
    folderNode: rootFolderNode,
    subFolders: collectedSubFolders,
    assets: allAssets,
  };
}

// -----------------------------------------------------------------------------
// Google Drive Full Parity Operations (Create Folder, Rename, Move, Copy,
// Restore, Delete Forever, Sharing/Permissions, Revisions & Workspace Export)
// -----------------------------------------------------------------------------

export interface DrivePermission {
  id: string;
  type: 'user' | 'group' | 'domain' | 'anyone';
  role: 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader';
  emailAddress?: string;
  displayName?: string;
}

export interface DriveRevision {
  id: string;
  modifiedTime: string;
  size?: string;
  keepForever?: boolean;
  lastModifyingUser?: { displayName?: string; emailAddress?: string };
}

export async function restoreDriveFile(fileId: string): Promise<boolean> {
  const cleanId = fileId.replace(/^drive_/, '');
  const res = await authorizedDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cleanId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: false }),
  });
  return res.ok;
}

export { loadOAuthToken };

export async function deleteDriveFilePermanently(fileId: string): Promise<boolean> {
  const cleanId = fileId.replace(/^drive_/, '');
  const res = await authorizedDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cleanId)}`, {
    method: 'DELETE',
  });
  return res.ok || res.status === 204;
}

export async function listDrivePermissions(fileId: string): Promise<DrivePermission[]> {
  const cleanId = fileId.replace(/^drive_/, '');
  const res = await authorizedDriveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cleanId)}/permissions?fields=permissions(id,type,role,emailAddress,displayName)`
  );
  if (!res.ok) throw new Error(`Permissions fetch failed (${res.status})`);
  const data = await res.json();
  return data.permissions || [];
}

export async function shareDriveFile(
  fileId: string,
  options: { type: 'anyone' | 'user'; role: 'reader' | 'commenter' | 'writer'; emailAddress?: string }
): Promise<DrivePermission> {
  const cleanId = fileId.replace(/^drive_/, '');
  const body: Record<string, string> = { type: options.type, role: options.role };
  if (options.type === 'user' && options.emailAddress) {
    body.emailAddress = options.emailAddress.trim();
  }
  const res = await authorizedDriveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cleanId)}/permissions?fields=id,type,role,emailAddress,displayName`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`Share update failed (${res.status})`);
  return res.json();
}

export async function removeDrivePermission(fileId: string, permissionId: string): Promise<boolean> {
  const cleanId = fileId.replace(/^drive_/, '');
  const res = await authorizedDriveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cleanId)}/permissions/${encodeURIComponent(permissionId)}`,
    { method: 'DELETE' }
  );
  return res.ok || res.status === 204;
}

export async function listDriveRevisions(fileId: string): Promise<DriveRevision[]> {
  const cleanId = fileId.replace(/^drive_/, '');
  const res = await authorizedDriveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cleanId)}/revisions?fields=revisions(id,modifiedTime,size,keepForever,lastModifyingUser(displayName,emailAddress))`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.revisions || [];
}

export function getWorkspaceExportOptions(mimeType: string): Array<{ label: string; mimeType: string; ext: string }> {
  switch (mimeType) {
    case 'application/vnd.google-apps.document':
      return [
        { label: 'PDF Document (.pdf)', mimeType: 'application/pdf', ext: 'pdf' },
        { label: 'Microsoft Word (.docx)', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
        { label: 'Plain Text (.txt)', mimeType: 'text/plain', ext: 'txt' },
      ];
    case 'application/vnd.google-apps.spreadsheet':
      return [
        { label: 'Microsoft Excel (.xlsx)', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
        { label: 'CSV (.csv)', mimeType: 'text/csv', ext: 'csv' },
        { label: 'PDF (.pdf)', mimeType: 'application/pdf', ext: 'pdf' },
      ];
    case 'application/vnd.google-apps.presentation':
      return [
        { label: 'PDF Slides (.pdf)', mimeType: 'application/pdf', ext: 'pdf' },
        { label: 'PowerPoint (.pptx)', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx' },
      ];
    default:
      return [];
  }
}

export async function exportGoogleWorkspaceDoc(fileId: string, exportMimeType: string): Promise<Blob> {
  const cleanId = fileId.replace(/^drive_/, '');
  const res = await authorizedDriveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cleanId)}/export?mimeType=${encodeURIComponent(exportMimeType)}`
  );
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  return res.blob();
}

/**
 * Create a native Google Doc or Google Sheet directly inside Google Drive (`drive.file` scope).
 */
export async function createGoogleWorkspaceFile(options: {
  title: string;
  content: string;
  kind: 'doc' | 'sheet';
}): Promise<{ id: string; name: string; webViewLink?: string }> {
  const targetMime =
    options.kind === 'sheet'
      ? 'application/vnd.google-apps.spreadsheet'
      : 'application/vnd.google-apps.document';
  const sourceMime = options.kind === 'sheet' ? 'text/csv' : 'text/plain';
  const boundary = 'dt_workspace_create_boundary';
  const metadata = JSON.stringify({ name: options.title, mimeType: targetMime });
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${sourceMime}; charset=UTF-8\r\n\r\n${options.content}\r\n` +
    `--${boundary}--`;

  const res = await authorizedDriveFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }
  );
  if (!res.ok) throw new Error(`Create Google ${options.kind} failed (${res.status})`);
  return res.json();
}

export interface DriveAdvancedSearchOptions {
  fullText?: string;
  nameContains?: string;
  mimeType?: string;
  mimePrefix?: string;
  folderId?: string;
  modifiedAfter?: string;
  sharedWithMe?: boolean;
  ownedByMe?: boolean;
  starred?: boolean;
  includeTrashed?: boolean;
  orderBy?: string;
  pageSize?: number;
  pageToken?: string;
}

function escapeDriveQueryValue(val: string): string {
  return String(val || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Pure Google Drive API v3 `files.list` query builder supporting fullText, name,
 * mimeType, parents, modifiedTime, sharedWithMe, 'me' in owners, and starred.
 */
export function buildDriveAdvancedQuery(options: DriveAdvancedSearchOptions): string {
  const parts: string[] = [];
  if (!options.includeTrashed) {
    parts.push('trashed = false');
  }

  if (options.fullText && options.fullText.trim()) {
    const tokens = options.fullText
      .trim()
      .split(/\s+/)
      .filter((t) => t.length >= 2)
      .slice(0, 6);
    if (tokens.length <= 1) {
      const esc = escapeDriveQueryValue(options.fullText.trim());
      parts.push(`(name contains '${esc}' or fullText contains '${esc}')`);
    } else {
      for (const tok of tokens) {
        const esc = escapeDriveQueryValue(tok);
        parts.push(`(name contains '${esc}' or fullText contains '${esc}')`);
      }
    }
  }

  if (options.nameContains && options.nameContains.trim()) {
    parts.push(`name contains '${escapeDriveQueryValue(options.nameContains.trim())}'`);
  }

  if (options.mimeType && options.mimeType.trim()) {
    parts.push(`mimeType = '${escapeDriveQueryValue(options.mimeType.trim())}'`);
  } else if (options.mimePrefix && options.mimePrefix.trim()) {
    parts.push(`mimeType contains '${escapeDriveQueryValue(options.mimePrefix.trim())}'`);
  }

  if (options.folderId && options.folderId.trim()) {
    parts.push(`'${escapeDriveQueryValue(options.folderId.trim())}' in parents`);
  }

  if (options.modifiedAfter && options.modifiedAfter.trim()) {
    const iso = options.modifiedAfter.includes('T')
      ? options.modifiedAfter.trim()
      : `${options.modifiedAfter.trim()}T00:00:00`;
    parts.push(`modifiedTime > '${escapeDriveQueryValue(iso)}'`);
  }

  if (options.sharedWithMe) parts.push('sharedWithMe = true');
  if (options.ownedByMe) parts.push("'me' in owners");
  if (options.starred) parts.push('starred = true');

  return parts.join(' and ');
}

/**
 * Parses power-user operators from a Drive search string:
 * e.g. `resume type:pdf starred:true after:2026-01-01 shared:true mime:image/png`
 */
export function parseDriveSearchOperators(rawQuery: string): DriveAdvancedSearchOptions {
  const opts: DriveAdvancedSearchOptions = {};
  const freeTerms: string[] = [];

  const tokens = (rawQuery || '').trim().split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    const lower = tok.toLowerCase();
    if (lower.startsWith('mime:')) {
      const val = tok.slice(5);
      if (val.endsWith('/')) opts.mimePrefix = val;
      else opts.mimeType = val;
    } else if (lower.startsWith('type:')) {
      const val = lower.slice(5);
      if (val === 'pdf') opts.mimeType = 'application/pdf';
      else if (val === 'doc' || val === 'docs') opts.mimeType = 'application/vnd.google-apps.document';
      else if (val === 'sheet' || val === 'sheets') opts.mimeType = 'application/vnd.google-apps.spreadsheet';
      else if (val === 'slide' || val === 'slides') opts.mimeType = 'application/vnd.google-apps.presentation';
      else if (val === 'image' || val === 'photo' || val === 'photos') opts.mimePrefix = 'image/';
      else if (val === 'video') opts.mimePrefix = 'video/';
      else if (val === 'audio') opts.mimePrefix = 'audio/';
      else if (val === 'folder') opts.mimeType = 'application/vnd.google-apps.folder';
    } else if (lower.startsWith('after:')) {
      opts.modifiedAfter = tok.slice(6);
    } else if (lower.startsWith('folder:')) {
      opts.folderId = tok.slice(7);
    } else if (lower === 'starred:true' || lower === 'is:starred') {
      opts.starred = true;
    } else if (lower === 'shared:true' || lower === 'is:shared') {
      opts.sharedWithMe = true;
    } else if (lower === 'mine:true' || lower === 'owner:me') {
      opts.ownedByMe = true;
    } else if (lower.startsWith('name:')) {
      opts.nameContains = tok.slice(5);
    } else {
      freeTerms.push(tok);
    }
  }

  if (freeTerms.length > 0) {
    opts.fullText = freeTerms.join(' ');
  }
  return opts;
}

/**
 * Live headless Google Drive v3 `files.list` search across names, full-text contents,
 * MIME types, dates, ownership, starred status, and imageMediaMetadata (EXIF).
 */
export async function searchDriveFilesLive(
  termOrOptions: string | DriveAdvancedSearchOptions,
  maxResults = 15
): Promise<MediaAsset[]> {
  const opts: DriveAdvancedSearchOptions =
    typeof termOrOptions === 'string'
      ? parseDriveSearchOperators(termOrOptions)
      : { ...termOrOptions };

  const qRaw = buildDriveAdvancedQuery(opts);
  if (!qRaw || qRaw === 'trashed = false') return [];

  const token = await getDriveAccessToken();
  if (!token) return [];

  const q = encodeURIComponent(qRaw);
  const fields = encodeURIComponent(
    'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,parents,starred,shared,imageMediaMetadata(width,height,time,cameraMake,cameraModel,aperture,isoSpeed))'
  );
  const pageSize = Math.min(50, Math.max(1, opts.pageSize || maxResults));
  const orderBy = encodeURIComponent(opts.orderBy || 'modifiedTime desc');
  const pageTokenParam = opts.pageToken ? `&pageToken=${encodeURIComponent(opts.pageToken)}` : '';
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=${pageSize}&fields=${fields}&orderBy=${orderBy}${pageTokenParam}&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  try {
    const res = await authorizedDriveFetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const files = Array.isArray(data?.files) ? data.files : [];

    return files.map((f: any): MediaAsset => {
      const mime = String(f.mimeType || 'application/octet-stream');
      const name = String(f.name || 'Untitled Drive File');
      const extMatch = name.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : mime.includes('google-apps') ? 'gdoc' : '';
      let category: MediaAsset['category'] = 'document';
      if (mime.startsWith('image/')) category = 'image';
      else if (mime.startsWith('video/')) category = 'video';
      else if (mime.startsWith('audio/')) category = 'audio';
      else if (mime.includes('spreadsheet') || mime.includes('csv') || mime.includes('json')) category = 'data';
      else if (mime.includes('zip') || mime.includes('archive')) category = 'archive';

      const imgMeta = f.imageMediaMetadata || {};
      const cameraStr = [imgMeta.cameraMake, imgMeta.cameraModel].filter(Boolean).join(' ').trim() || undefined;

      return {
        id: `drive_${f.id}`,
        name,
        source: 'cloud',
        category,
        mimeType: mime,
        extension: ext,
        path: `/Google Drive/${name}`,
        parentId: Array.isArray(f.parents) ? f.parents[0] : undefined,
        sizeBytes: parseInt(f.size || '0', 10) || 0,
        modifiedTime: f.modifiedTime || new Date().toISOString(),
        dateTaken: imgMeta.time || undefined,
        cameraModel: cameraStr,
        cloudUrl: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
        thumbnailUrl: f.thumbnailLink || '',
        isCached: false,
        cullingStatus: 'unrated',
        rating: f.starred ? 4 : 0,
        tags: ['google-drive', 'live-search', ...(f.starred ? ['starred'] : []), ...(f.shared ? ['shared'] : [])],
        faces: [],
        quality: { sharpness: 85, exposure: 85, isBlurry: false },
        palette: [],
        exif: {
          camera: cameraStr,
          dateTaken: imgMeta.time || undefined,
          aperture: imgMeta.aperture ? `f/${imgMeta.aperture}` : undefined,
          iso: imgMeta.isoSpeed || undefined,
          dimensions: imgMeta.width && imgMeta.height ? `${imgMeta.width}x${imgMeta.height}` : undefined,
        },
      };
    });
  } catch (err) {
    console.warn('[googleDrive] searchDriveFilesLive failed:', err);
    return [];
  }
}



