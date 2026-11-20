/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Butler Engine: Client Concierge & Service Mesh Orchestrator
 * Centralizes Google Workspace, Drive, and OAuth services with strict schema
 * validation, proactive token health management, and popup suppression defense.
 */

import {
  ButlerServiceId,
  ButlerState,
  ButlerListener,
  ButlerAccount,
  ButlerServiceTelemetry,
  BUTLER_SERVICE_SCOPES,
} from './types';
import { loadOAuthToken, isTokenExpired, isTokenExpiringSoon } from '../oauthStorage';
import {
  loadAccountProfiles,
  switchActiveAccount,
  removeAccountProfileByEmail,
  clearAllAccountProfiles,
  GoogleAccountProfile,
} from '../multiAccountAuth';
import { loadPersistedSubAccounts, sanitizeSubAccountList } from '../music/musicAccounts';
import { googleWorkspaceMessenger } from '../googleWorkspaceMessenger';
import { GoogleCalendarEngine } from '../googleCalendarEngine';
import { GoogleVoiceEngine } from '../googleVoiceEngine';

const calendarEngine = new GoogleCalendarEngine();
const voiceEngine = new GoogleVoiceEngine();

export class ButlerEngine {
  private listeners = new Set<ButlerListener>();
  private isAuthenticating = false;
  private activePopup: Window | null = null;
  private refreshTimer: any = null;

  private state: ButlerState = {
    services: {
      drive: {
        id: 'drive',
        name: 'Google Drive',
        status: 'offline',
        description: 'Asset streaming, culling, RAW preview & XMP sidecar management',
        requiredScopes: BUTLER_SERVICE_SCOPES.drive,
        lastCheckedAt: Date.now(),
      },
      workspace: {
        id: 'workspace',
        name: 'Google Workspace',
        status: 'offline',
        description: 'Google Chat Spaces, Google Meet, Calendar events & Voice SMS/Calls',
        requiredScopes: BUTLER_SERVICE_SCOPES.workspace,
        lastCheckedAt: Date.now(),
      },
      music: {
        id: 'music',
        name: 'Google Music & Media',
        status: 'offline',
        description: 'Full-archive Drive audio/video streaming & YouTube Brand sub-accounts',
        requiredScopes: BUTLER_SERVICE_SCOPES.music,
        lastCheckedAt: Date.now(),
      },
      gemini: {
        id: 'gemini',
        name: 'Gemini AI Studio',
        status: 'connected',
        description: 'Zero-key offline vision models & server-assisted multimodal analysis',
        requiredScopes: BUTLER_SERVICE_SCOPES.gemini,
        lastCheckedAt: Date.now(),
      },
    },
    activeAccount: null,
    accounts: [],
    isRefreshingToken: false,
    tokenExpiresAt: null,
    tokenTimeRemainingSeconds: 0,
    lastError: null,
  };

  constructor() {
    this.hydrateFromStorage();
    this.setupAuthSyncListeners();
    this.startHeartbeat();
  }

  public getState(): ButlerState {
    return { ...this.state };
  }

  /**
   * [WO-111] Atomically wipe all in-memory user identity, sub-accounts, and service auth states.
   */
  public resetAllState(): void {
    const now = Date.now();
    this.state = {
      ...this.state,
      activeAccount: null,
      accounts: [],
      isRefreshingToken: false,
      tokenExpiresAt: null,
      tokenTimeRemainingSeconds: 0,
      lastError: null,
      services: {
        ...this.state.services,
        drive: { ...this.state.services.drive, status: 'offline', lastCheckedAt: now },
        workspace: { ...this.state.services.workspace, status: 'offline', lastCheckedAt: now },
        music: { ...this.state.services.music, status: 'offline', lastCheckedAt: now },
      },
    };
    this.emit();
  }

  /**
   * [WO-113] Switch active Google account among concurrently signed-in accounts.
   */
  public async switchAccountByEmail(email: string): Promise<boolean> {
    const norm = email.trim().toLowerCase();
    const profiles = loadAccountProfiles();
    const match = profiles.find((p) => p.email.toLowerCase() === norm);
    if (!match) return false;
    switchActiveAccount(match.id);
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/auth/google/switch', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: norm }),
        });
      } catch {}
    }
    this.hydrateFromStorage();
    return true;
  }

  /**
   * [WO-113] Sign out ONE specific account while keeping other concurrently signed-in accounts active.
   */
  public async signOutAccount(email: string): Promise<string | null> {
    const norm = email.trim().toLowerCase();
    const { remaining, nextActive } = removeAccountProfileByEmail(norm);
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/auth/google/signout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: norm }),
        });
      } catch {}
    }
    if (remaining.length === 0) {
      this.resetAllState();
      return null;
    }
    this.hydrateFromStorage();
    return nextActive?.email || null;
  }

  /**
   * [WO-113] Sign out ALL concurrently signed-in accounts cleanly.
   */
  public async signOutAllAccounts(): Promise<void> {
    clearAllAccountProfiles();
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/auth/google/signout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ all: true }),
        });
      } catch {}
    }
    this.resetAllState();
  }

  public subscribe(listener: ButlerListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const s = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(s);
      } catch (err) {
        console.warn('[ButlerEngine] Listener error:', err);
      }
    }
  }

  /**
   * Hydrate verified identity and sub-accounts with strict schema sanitization.
   * Completely eliminates `can't access property startsWith, e.id is undefined`.
   */
  public hydrateFromStorage(): void {
    const tokenRec = loadOAuthToken();
    const profiles = loadAccountProfiles();
    const subAccounts = loadPersistedSubAccounts();

    const verifiedAccounts: ButlerAccount[] = [];

    // 1. Process multiAccountAuth profiles
    for (const p of profiles) {
      if (!p || typeof p.email !== 'string') continue;
      const safeId = p.id || `acc_prof_${p.email.replace(/[^a-z0-9]/gi, '_')}`;
      verifiedAccounts.push({
        id: safeId,
        name: p.name || p.email.split('@')[0],
        email: p.email,
        handle: `@${(p.name || p.email).toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user'}`,
        avatarUrl: p.avatarUrl,
        accountType: 'primary',
        quota: p.quota,
        isActive: Boolean(p.isActive),
        lastSyncedAt: p.lastSyncedAt,
      });
    }

    // 2. Process sanitized music sub-accounts
    const safeSubAccounts = sanitizeSubAccountList(subAccounts);
    for (const s of safeSubAccounts) {
      if (!verifiedAccounts.some((v) => v.id === s.id)) {
        verifiedAccounts.push({
          id: s.id,
          name: s.name,
          email: s.email,
          handle: s.handle || `@${s.name.toLowerCase().replace(/[^a-z0-9_]/g, '')}`,
          avatarUrl: s.avatarUrl,
          accountType: (s.accountType as any) || 'primary',
          subscribersLabel: s.roleLabel,
          isActive: false,
        });
      }
    }

    // Fallback guest account if no user is authenticated
    if (verifiedAccounts.length === 0) {
      verifiedAccounts.push({
        id: 'acc_studio_primary',
        name: 'Guest Studio',
        email: 'guest@drivetherapy.local',
        handle: '@gueststudio',
        accountType: 'primary',
        isActive: true,
      });
    }

    const activeAcc = verifiedAccounts.find((a) => a.isActive) || verifiedAccounts[0];

    // Evaluate token validity and service status
    const hasValidToken = Boolean(tokenRec?.accessToken && !isTokenExpired(tokenRec));
    const tokenExpiresAt = tokenRec?.expiresAt || null;
    const now = Date.now();
    const remainingSeconds = tokenExpiresAt ? Math.max(0, Math.round((tokenExpiresAt - now) / 1000)) : 0;

    const driveStatus = hasValidToken ? 'connected' : 'unauthorized';
    const workspaceStatus = hasValidToken ? 'connected' : 'unauthorized';
    const musicStatus = 'connected'; // Music player functions offline or with streaming
    const geminiStatus = 'connected';

    this.state = {
      ...this.state,
      accounts: verifiedAccounts,
      activeAccount: activeAcc,
      tokenExpiresAt,
      tokenTimeRemainingSeconds: remainingSeconds,
      services: {
        drive: { ...this.state.services.drive, status: driveStatus, activeAccountEmail: activeAcc.email, lastCheckedAt: now },
        workspace: { ...this.state.services.workspace, status: workspaceStatus, activeAccountEmail: activeAcc.email, lastCheckedAt: now },
        music: { ...this.state.services.music, status: musicStatus, activeAccountEmail: activeAcc.email, lastCheckedAt: now },
        gemini: { ...this.state.services.gemini, status: geminiStatus, lastCheckedAt: now },
      },
    };

    this.emit();
  }

  /**
   * Popup-Guardian Authentication:
   * Single-flight lock preventing browser popup blocks (`Opening multiple popups was blocked`).
   */
  public async authenticateService(serviceId: ButlerServiceId = 'drive'): Promise<Window | null> {
    if (this.isAuthenticating && this.activePopup && !this.activePopup.closed) {
      this.activePopup.focus?.();
      return this.activePopup;
    }

    this.isAuthenticating = true;
    try {
      const resp = await fetch(`/api/butler/auth/url?service=${encodeURIComponent(serviceId)}`);
      if (!resp.ok) {
        throw new Error(`Failed to obtain Butler authorization URL (HTTP ${resp.status})`);
      }
      const data = await resp.json();
      const authUrl = data.authUrl;
      if (!authUrl) {
        throw new Error('Butler host did not return a valid authUrl');
      }

      const width = 540;
      const height = 720;
      const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
      const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);

      const popup = window.open(
        authUrl,
        'DriveTherapyButlerAuth',
        `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no,location=yes,resizable=yes`
      );

      if (!popup) {
        console.warn('[Butler] Popup was blocked. Launching top-level redirect fallback.');
        window.location.href = authUrl;
        return null;
      }

      this.activePopup = popup;
      popup.focus?.();
      return popup;
    } catch (err: any) {
      console.error('[ButlerEngine] Authentication launch failed:', err);
      this.state.lastError = err.message || 'Authentication launch failed';
      this.emit();
      return null;
    } finally {
      setTimeout(() => {
        this.isAuthenticating = false;
      }, 1500);
    }
  }

  /**
   * Silent Token Concierge:
   * Refreshes active OAuth credentials in background via secure session cookie.
   */
  public async refreshActiveToken(): Promise<boolean> {
    if (this.state.isRefreshingToken) return false;
    this.state.isRefreshingToken = true;
    this.emit();

    try {
      const resp = await fetch('/api/auth/google/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!resp.ok) return false;
      const data = await resp.json();
      if (data.accessToken) {
        this.hydrateFromStorage();
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      this.state.isRefreshingToken = false;
      this.emit();
    }
  }

  /**
   * Switch the active Google account profile cleanly.
   */
  public switchAccount(accountId: string): boolean {
    const success = switchActiveAccount(accountId);
    if (success) {
      this.hydrateFromStorage();
      return true;
    }
    return false;
  }

  /**
   * Synchronize cross-window auth messages and broadcast channels.
   */
  private setupAuthSyncListeners(): void {
    if (typeof window === 'undefined') return;

    // 1. BroadcastChannel
    try {
      const channel = new BroadcastChannel('drive_therapy_auth');
      channel.onmessage = (e) => {
        if (e.data?.type === 'AUTH_SUCCESS' || e.data?.type === 'PROFILE_SWITCHED') {
          this.hydrateFromStorage();
        }
      };
    } catch {
      // BroadcastChannel optional
    }

    // 2. Window postMessage listener
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS' || event.data?.type === 'STANDALONE_AUTH_SYNC') {
        this.hydrateFromStorage();
        if (this.activePopup && !this.activePopup.closed) {
          try {
            this.activePopup.close();
          } catch {
            // Popup close optional
          }
          this.activePopup = null;
        }
      }
    });
  }

  /**
   * Start 30-second token health monitoring heartbeat.
   */
  private startHeartbeat(): void {
    if (typeof window === 'undefined') return;
    if (this.refreshTimer) clearInterval(this.refreshTimer);

    this.refreshTimer = setInterval(() => {
      const tokenRec = loadOAuthToken();
      if (tokenRec && isTokenExpiringSoon(tokenRec, 5)) {
        this.refreshActiveToken().catch(() => {});
      } else {
        this.hydrateFromStorage();
      }
    }, 30000);
  }

  // ----------------------------------------------------
  // Butler Service Facades
  // ----------------------------------------------------

  public readonly drive = {
    getStreamUrl: (fileId: string): string => {
      const token = loadOAuthToken()?.accessToken;
      const cleanId = fileId.replace(/^drive_/, '');
      return `/api/butler/drive/stream/${encodeURIComponent(cleanId)}${token ? `?access_token=${encodeURIComponent(token)}` : ''}`;
    },
    fetchQuota: async (): Promise<{ usage: number; limit: number; percentage: number } | null> => {
      const token = loadOAuthToken()?.accessToken;
      if (!token) return null;
      try {
        const resp = await fetch('/api/butler/drive/quota', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return data.quota || null;
      } catch {
        return null;
      }
    },
  };

  public readonly workspace = {
    getMeetUrl: (): string => 'https://meet.google.com/new',
    getChatUrl: (): string => 'https://chat.google.com/',
    openMeet: (): void => {
      if (typeof window !== 'undefined') window.open('https://meet.google.com/new', '_blank');
    },
    openChat: (): void => {
      if (typeof window !== 'undefined') window.open('https://chat.google.com/', '_blank');
    },
    buildCalendarUrl: (params: Parameters<typeof calendarEngine.generateGoogleCalendarUrl>[0]): string => {
      return calendarEngine.generateGoogleCalendarUrl(params);
    },
    triggerVoiceCall: (phone: string): { protocolUrl: string; webUrl: string } => {
      return voiceEngine.triggerChromeCall(phone);
    },
  };

  public readonly music = {
    getVerifiedAccounts: (): ButlerAccount[] => {
      return this.getState().accounts;
    },
  };
}

export const butlerEngine = new ButlerEngine();
