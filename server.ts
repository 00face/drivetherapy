import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import { execFile, spawn } from 'child_process';
import { buildFfmpegHlsArgs } from './src/services/hlsStreamingEngine';
import compression from 'compression';
import type { Server as HttpServer } from 'http';
import {
  DEFAULT_CLEAN_PORT,
  clearRuntimeServerState,
  isPortAvailable,
  readRuntimeServerState,
  reclaimPreviousServerInstances,
  resolveCleanServerPort,
  writeRuntimeServerState,
} from './src/services/serverPortManager';
import { createButlerHostRouter } from './src/services/butler/butlerHost';
import { createMusicHostRouter } from './src/services/music/musicHost';
import {
  classifyFile,
  lookupFileFormat,
  searchFormatDatabase,
  getFormatDatabaseStats,
  upsertFormatDefinition,
  getAllFormatDefinitions,
} from './src/services/fileFormatEngine';
import {
  computeCanonicalAlbumUid,
  extractAudioTagsFromBuffer,
} from './src/services/music/audioTagReader';
import type { FileFormatDatabaseDocument, FileFormatDefinition } from './src/types/fileFormats';
import { generateVideoEditFfmpegArgs } from './src/services/videoCurationEngine';
import { generateGifFfmpegArgs } from './src/services/gifStudioEngine';
import type { MediaCategory, OsFileEntry, OsFolderEntry } from './src/types/index';
import {
  buildHardenedCspHeader,
  clearAllGoogleAccountTokens,
  createIpRateLimiter,
  destroySession,
  getActiveGoogleEmail,
  getExistingSessionId,
  getGoogleAccountToken,
  getOrCreateSessionId,
  listGoogleAccountEmails,
  removeGoogleAccountToken,
  setActiveGoogleAccount,
  setGoogleAccountToken,
} from './server/security/sessionVault';
import { createExternalCloudsRouter } from './server/routes/externalClouds';
import { createTakeoutStreamRouter } from './server/routes/takeoutStream';
import { createHeroLinksRouter, handleHeroLinkResolve } from './server/routes/heroLinks';
import { createOpenSharingRouter } from './server/routes/openSharing';
import { createMalwareScannerRouter } from './server/routes/malwareScanner';
import { createAccessPolicyMiddleware, createAccessPolicyRouter } from './server/security/accessPolicy';
import {
  correlationAndTelemetryMiddleware,
  getObservabilitySnapshot,
} from './server/observability/telemetry';

dotenv.config();

const __resolvedFilename =
  typeof import.meta?.url === 'string' && import.meta.url
    ? fileURLToPath(import.meta.url)
    : path.join(process.cwd(), 'server.cjs');
const __dirname = path.dirname(__resolvedFilename);

const app = express();
const parsedEnvPort = process.env.PORT ? parseInt(process.env.PORT, 10) : NaN;
let activePort =
  Number.isInteger(parsedEnvPort) && parsedEnvPort > 0 && parsedEnvPort <= 65535
    ? parsedEnvPort
    : DEFAULT_CLEAN_PORT;
const activeAliasPorts: number[] = [];

// Security & Boundary Hardening Headers Middleware
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
app.use((_req: Request, res: Response, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', buildHardenedCspHeader());
  next();
});

// [WO-117] Phase 16 Request Correlation ID & Structured Latency/Error Telemetry Middleware
app.use(correlationAndTelemetryMiddleware);

// Enable Gzip/Deflate/Brotli Compression for Fast Asset Delivery & Snappy Startup
app.use(compression());

// Scoped JSON payload limits: 4mb default globally, 50mb only on media/Gemini/Takeout routes
app.use('/api/gemini', express.json({ limit: '50mb' }));
app.use('/api/takeout', express.json({ limit: '50mb' }));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

// In-Memory IP Rate Limiters (uses req.ip — prevents X-Forwarded-For spoofing)
const authLimiter = createIpRateLimiter(45, 60_000);
const geminiLimiter = createIpRateLimiter(45, 60_000);

// Apply rate limiting across OAuth & Gemini AI endpoints
app.use('/api/auth', (req: Request, res: Response, next) => {
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  if (!authLimiter.check(clientIp)) {
    res.status(429).json({ error: 'Too many authentication requests from this IP. Please wait 1 minute.' });
    return;
  }
  next();
});

app.use('/api/gemini', (req: Request, res: Response, next) => {
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  if (!geminiLimiter.check(clientIp)) {
    res.status(429).json({ error: 'Gemini API rate limit exceeded from this IP. Please wait 1 minute.' });
    return;
  }
  next();
});

// Dynamic Google OAuth Credentials (supports runtime in-app wizard configuration)
let defaultClientId: string | null = process.env.GOOGLE_CLIENT_ID || null;
let defaultClientSecret: string | null = process.env.GOOGLE_CLIENT_SECRET || null;

if (!defaultClientId || !defaultClientSecret) {
  try {
    const googleDir = path.resolve(__dirname, 'google');
    if (fs.existsSync(googleDir)) {
      const files = fs.readdirSync(googleDir);
      const secretFile = files.find(f => f.startsWith('client_secret_') && f.endsWith('.json'));
      if (secretFile) {
        const secretJson = JSON.parse(fs.readFileSync(path.join(googleDir, secretFile), 'utf-8'));
        const creds = secretJson.installed || secretJson.web;
        if (creds?.client_id && !defaultClientId) {
          defaultClientId = creds.client_id;
        }
        if (creds?.client_secret && !defaultClientSecret) {
          defaultClientSecret = creds.client_secret;
        }
      }
    }
  } catch (err) {
    console.warn('Google client secret directory read note:', err);
  }
}

if (!defaultClientId) {
  try {
    const localConfigPath = path.resolve(__dirname, 'firebase-applet-config.local.json');
    const configPath = fs.existsSync(localConfigPath)
      ? localConfigPath
      : path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const fbConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (fbConfig.oAuthClientId) {
        defaultClientId = fbConfig.oAuthClientId;
      }
    }
  } catch (err) {
    console.warn('Firebase applet config read note:', err);
  }
}
let dynamicGoogleClientId: string | null = defaultClientId;
let dynamicGoogleClientSecret: string | null = defaultClientSecret;

// Helper to parse cookie headers securely
const parseCookies = (cookieHeader?: string): Record<string, string> => {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  cookieHeader.split(';').forEach((part) => {
    const [k, v] = part.trim().split('=');
    if (k && v) map[k] = decodeURIComponent(v);
  });
  return map;
};

// Helper to verify loopback requests for administrative endpoints
const isLoopbackRequest = (req: Request): boolean => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || '';
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'].includes(ip);
};

// In-memory PKCE & CSRF State Registry (5 min strict RFC 6749 TTL)
interface OAuthPendingState {
  codeVerifier: string;
  createdAt: number;
}
const pendingOAuthStates = new Map<string, OAuthPendingState>();

setInterval(() => {
  const now = Date.now();
  for (const [state, item] of pendingOAuthStates.entries()) {
    if (now - item.createdAt > 5 * 60 * 1000) {
      pendingOAuthStates.delete(state);
    }
  }
}, 60 * 1000);

// Helper to determine base URL
const getBaseAppUrl = (req: Request): string => {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.get('host') || `localhost:${activePort}`;
  return `${protocol}://${host}`;
};

// ----------------------------------------------------
// Google OAuth 2.0 Direct Server-Assisted PKCE Routes
// ----------------------------------------------------

const OAUTH_LITE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive.file',
];

const OAUTH_SCOPES = [
  ...OAUTH_LITE_SCOPES,
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
];

const OPTIONAL_EXTRA_SCOPES: Record<string, string[]> = {
  gcs: ['https://www.googleapis.com/auth/devstorage.read_only'],
  gmail: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
  ],
  tasks: ['https://www.googleapis.com/auth/tasks'],
  calendar: ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events'],
  contacts: ['https://www.googleapis.com/auth/contacts.readonly'],
  classroom: [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  ],
  youtube: ['https://www.googleapis.com/auth/youtube.readonly'],
};

function resolveRequestedScopes(extraQuery: unknown, modeQuery?: unknown): string {
  const mode =
    (typeof modeQuery === 'string' && modeQuery.trim().toLowerCase()) ||
    (process.env.OAUTH_SCOPE_MODE || 'standard').trim().toLowerCase();
  const baseScopes = mode === 'lite' || mode === 'non_sensitive' ? OAUTH_LITE_SCOPES : OAUTH_SCOPES;
  const scopes = new Set<string>(baseScopes);
  const raw = typeof extraQuery === 'string' ? extraQuery : '';
  for (const key of raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    const mapped = OPTIONAL_EXTRA_SCOPES[key];
    if (mapped) {
      for (const s of mapped) scopes.add(s);
    }
  }
  return Array.from(scopes).join(' ');
}

async function resolveGoogleAccountIdentity(accessToken: string) {
  let userInfo: { email?: string; name?: string; picture?: string; permissionId?: string } = {};
  const channels: Array<{
    id: string;
    name: string;
    handle: string;
    avatarUrl?: string;
    accountType: 'primary' | 'workspace_sub' | 'local';
  }> = [];

  try {
    const [uRes, driveRes] = await Promise.all([
      fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => null),
      fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => null),
    ]);

    if (uRes?.ok) {
      const u = await uRes.json();
      userInfo = { email: u.email, name: u.name, picture: u.picture };
    }
    if (driveRes?.ok) {
      const d = await driveRes.json();
      if (d.user) {
        userInfo.email = userInfo.email || d.user.emailAddress;
        userInfo.name = userInfo.name || d.user.displayName;
        userInfo.picture = userInfo.picture || d.user.photoLink;
        userInfo.permissionId = d.user.permissionId;
      }
    }
  } catch (err) {
    console.warn('[OAuth] Account identity resolution warning:', err);
  }

  return { userInfo, channels };
}

// ----------------------------------------------------
// The Butler Host: Master Concierge & Service Mesh Router
// ----------------------------------------------------
app.use(
  '/api/butler',
  createButlerHostRouter({
    getClientId: () => dynamicGoogleClientId || process.env.GOOGLE_CLIENT_ID || null,
    getClientSecret: () => dynamicGoogleClientSecret || process.env.GOOGLE_CLIENT_SECRET || null,
    getBaseAppUrl,
    pendingOAuthStates,
    getActivePort: () => activePort,
    getAliasPorts: () => [...activeAliasPorts],
  })
);

// ----------------------------------------------------
// Google Music Host: Master Discovery, Charts & Audio API (/api/music/*)
// ----------------------------------------------------
app.use('/api/music', createMusicHostRouter());

// 1. Direct Server OAuth Configuration Check
app.get('/api/auth/google/config', (req: Request, res: Response) => {
  const clientId = dynamicGoogleClientId || process.env.GOOGLE_CLIENT_ID || null;
  res.json({
    hasDirectOAuth: Boolean(clientId),
    clientId,
    redirectUri: `${getBaseAppUrl(req)}/api/auth/google/callback`,
    scopes: OAUTH_SCOPES,
  });
});

// 1b. In-App OAuth Wizard Dynamic Credential Configuration
app.post('/api/auth/google/configure', async (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'OAuth credential reconfiguration is strictly permitted from local loopback origins.' });
    return;
  }

  try {
    const { clientId, clientSecret, persistEnv = false } = req.body;
    if (!clientId || typeof clientId !== 'string' || !clientId.includes('.apps.googleusercontent.com')) {
      res.status(400).json({
        error: 'Invalid Google Client ID format. Must end with .apps.googleusercontent.com',
      });
      return;
    }

    dynamicGoogleClientId = clientId.trim();
    if (clientSecret && typeof clientSecret === 'string') {
      dynamicGoogleClientSecret = clientSecret.trim();
    }

    // Optional persistence to .env file if in local workstation mode
    if (persistEnv) {
      try {
        const envPath = path.resolve(__dirname, '.env');
        let envContent = '';
        if (fs.existsSync(envPath)) {
          envContent = fs.readFileSync(envPath, 'utf8');
        }

        const updateOrAppend = (content: string, key: string, val: string) => {
          const regex = new RegExp(`^${key}=.*$`, 'm');
          if (regex.test(content)) {
            return content.replace(regex, `${key}="${val}"`);
          }
          return content ? `${content.trim()}\n${key}="${val}"\n` : `${key}="${val}"\n`;
        };

        let updated = updateOrAppend(envContent, 'GOOGLE_CLIENT_ID', dynamicGoogleClientId);
        if (dynamicGoogleClientSecret) {
          updated = updateOrAppend(updated, 'GOOGLE_CLIENT_SECRET', dynamicGoogleClientSecret);
        }
        fs.writeFileSync(envPath, updated, 'utf8');
      } catch (e) {
        console.warn('Could not persist credentials to .env:', e);
      }
    }

    res.json({
      success: true,
      clientId: dynamicGoogleClientId,
      hasSecret: Boolean(dynamicGoogleClientSecret),
      redirectUri: `${getBaseAppUrl(req)}/api/auth/google/callback`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update OAuth configuration' });
  }
});

// 1c. Reset Custom OAuth Configuration
app.delete('/api/auth/google/configure', (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'OAuth credential reset is strictly permitted from local loopback origins.' });
    return;
  }
  dynamicGoogleClientId = defaultClientId;
  dynamicGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET || null;
  res.json({ success: true, clientId: dynamicGoogleClientId });
});

// 2a. Synchronous Direct Login Gateway (Redirects directly to Google OAuth, immune to popup blockers)
app.get('/api/auth/google/login', (req: Request, res: Response) => {
  const clientId = dynamicGoogleClientId || process.env.GOOGLE_CLIENT_ID;
  const baseAppUrl = getBaseAppUrl(req);
  const redirectUri = `${baseAppUrl}/api/auth/google/callback`;

  const state = crypto.randomBytes(32).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  pendingOAuthStates.set(state, {
    codeVerifier,
    createdAt: Date.now(),
  });

  const promptParam = typeof req.query.prompt === 'string' ? req.query.prompt.trim() : 'select_account consent';
  const scopes = resolveRequestedScopes(req.query.extra_scopes, req.query.mode);

  const params = new URLSearchParams({
    client_id: clientId || 'direct_oauth_configured',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: promptParam,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.redirect(authUrl);
});

// 2b. Generate Google OAuth 2.0 Authorization URL with PKCE & Anti-CSRF State
app.get('/api/auth/google/url', (req: Request, res: Response) => {
  const clientId = dynamicGoogleClientId || process.env.GOOGLE_CLIENT_ID;
  const baseAppUrl = getBaseAppUrl(req);
  const redirectUri = `${baseAppUrl}/api/auth/google/callback`;

  // Generate 256-bit cryptographic state and PKCE verifier/challenge
  const state = crypto.randomBytes(32).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  pendingOAuthStates.set(state, {
    codeVerifier,
    createdAt: Date.now(),
  });

  const promptParam = typeof req.query.prompt === 'string' ? req.query.prompt.trim() : 'select_account consent';
  const scopes = resolveRequestedScopes(req.query.extra_scopes, req.query.mode);

  const params = new URLSearchParams({
    client_id: clientId || 'direct_oauth_configured',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: promptParam,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  res.json({
    authUrl,
    state,
    redirectUri,
    hasDirectConfig: Boolean(clientId),
  });
});

// 3. OAuth 2.0 Authorization Code Exchange Callback
app.get('/api/auth/google/callback', async (req: Request, res: Response) => {
  const { code, state, error: oauthError } = req.query;

  const baseAppUrl = getBaseAppUrl(req);

  if (oauthError) {
    const safeError = encodeURIComponent(String(oauthError));
    res.status(400).send(`
      <!DOCTYPE html>
      <html><body>
      <script>
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: '${safeError}' }, '${baseAppUrl}');
        }
        setTimeout(() => window.close(), 1200);
      </script>
      <p>Authentication was denied or cancelled: ${safeError}</p>
      </body></html>
    `);
    return;
  }

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    res.status(400).send('Missing code or state parameters.');
    return;
  }

  const pending = pendingOAuthStates.get(state);
  if (!pending) {
    res.status(400).send('Invalid or expired anti-CSRF state token. Please try authenticating again.');
    return;
  }
  pendingOAuthStates.delete(state);

  const clientId = dynamicGoogleClientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = dynamicGoogleClientSecret || process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${baseAppUrl}/api/auth/google/callback`;

  try {
    const tokenParams: Record<string, string> = {
      client_id: clientId || '',
      code,
      code_verifier: pending.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    };
    if (clientSecret) {
      tokenParams['client_secret'] = clientSecret;
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(tokenParams).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      res.status(tokenRes.status).send(`Failed to exchange token with Google: ${errText}`);
      return;
    }

    const tokenData = await tokenRes.json();
    const isProd = process.env.NODE_ENV === 'production';

    // Set secure HTTP-only cookie for long-lived refresh token in production
    if (tokenData.refresh_token) {
      res.setHeader('Set-Cookie', [
        `dt_rt=${encodeURIComponent(tokenData.refresh_token)}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${isProd ? '; Secure' : ''}`,
      ]);
    }

    // Query Google userinfo & Drive user to hydrate primary account identity
    const { userInfo, channels } = await resolveGoogleAccountIdentity(tokenData.access_token);

    const tokenPayload = {
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in || 3600,
      refreshToken: tokenData.refresh_token,
      scopes: (tokenData.scope || '').split(' '),
      tokenType: 'Bearer',
      provider: 'server',
      acquiredAt: Date.now(),
      expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
      user: {
        email: userInfo.email,
        displayName: userInfo.name,
        photoURL: userInfo.picture,
        permissionId: userInfo.permissionId,
      },
      userEmail: userInfo.email,
      channels,
    };

    // If API client asked for JSON:
    if (req.headers.accept?.includes('application/json')) {
      res.json(tokenPayload);
      return;
    }

    // [WO-112] Store Google OAuth access/refresh tokens in the server-side HttpOnly AES-256-GCM vault
    const sid = getOrCreateSessionId(req, res);
    if (tokenPayload.user?.email && tokenPayload.accessToken) {
      setGoogleAccountToken(sid, tokenPayload.user.email, {
        accessToken: tokenPayload.accessToken,
        refreshToken: tokenPayload.refreshToken,
        expiresAt: tokenPayload.expiresAt,
      });
    }

    // Return CSP-strict HTML page using external /auth-bridge.js (zero inline executable JS!)
    const safeJsonForScript = JSON.stringify(tokenPayload).replace(/</g, '\\u003c');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authorization Successful</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0D111D; color: #fff; text-align: center; padding: 2.5rem; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh;">
        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 2rem; max-width: 420px; width: 100%;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">✨</div>
          <h2 style="margin: 0 0 0.5rem 0; font-size: 1.25rem;">Google Drive Connected!</h2>
          <p style="color: #94a3b8; font-size: 0.875rem; margin: 0 0 1.5rem 0;">Session synchronized securely with Drive Therapy. Closing authorization window...</p>
          <button id="dt-close-auth-btn" type="button" style="background: #1074B1; color: #fff; border: none; padding: 0.6rem 1.5rem; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 0.875rem;">Close Window</button>
        </div>
        <script type="application/json" id="dt-auth-payload">${safeJsonForScript}</script>
        <script src="/auth-bridge.js" defer></script>
      </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).send(`Internal token exchange error: ${err.message}`);
  }
});

// 4. Token Refresh Endpoint
app.post('/api/auth/google/refresh', async (req: Request, res: Response) => {
  const cookies = parseCookies(req.headers.cookie);
  const refreshToken = req.body?.refreshToken || cookies['dt_rt'];
  if (!refreshToken) {
    res.status(400).json({ error: 'Missing refreshToken in request body or session cookie' });
    return;
  }

  const clientId = dynamicGoogleClientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = dynamicGoogleClientSecret || process.env.GOOGLE_CLIENT_SECRET;

  try {
    const params: Record<string, string> = {
      client_id: clientId || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    };
    if (clientSecret) {
      params['client_secret'] = clientSecret;
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      res.status(tokenRes.status).json({ error: `Refresh failed: ${errText}` });
      return;
    }

    const data = await tokenRes.json();
    const expiresIn = data.expires_in || 3600;

    // If Google returned a rotated refresh token, update secure cookie
    if (data.refresh_token) {
      const isProd = process.env.NODE_ENV === 'production';
      res.setHeader('Set-Cookie', [
        `dt_rt=${encodeURIComponent(data.refresh_token)}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${isProd ? '; Secure' : ''}`,
      ]);
    }

    res.json({
      accessToken: data.access_token,
      expiresIn,
      expiresAt: Date.now() + expiresIn * 1000,
      tokenType: 'Bearer',
      scopes: (data.scope || '').split(' '),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Token refresh error' });
  }
});

// 5. Token Revocation Endpoint (RFC 7009 proxy)
app.post('/api/auth/google/revoke', async (req: Request, res: Response) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = req.body?.token || cookies['dt_rt'];
  if (!token) {
    res.status(400).json({ error: 'Missing token in request body or session cookie' });
    return;
  }

  // Clear HTTP-only session cookie
  res.setHeader('Set-Cookie', 'dt_rt=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0');

  try {
    const revokeRes = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    res.json({ success: revokeRes.ok, status: revokeRes.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Revocation error' });
  }
});

// 6. Resolve Authenticated Google Identity & Drive Profile
app.get('/api/auth/google/accounts', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.access_token === 'string' ? req.query.access_token : '';
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : queryToken.trim();

  if (!bearer) {
    res.status(401).json({ error: 'Missing Authorization Bearer token' });
    return;
  }

  try {
    const identity = await resolveGoogleAccountIdentity(bearer);
    res.json(identity);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to resolve sub-accounts' });
  }
});

// 7. Google Music Host endpoints mounted at /api/music/* (see createMusicHostRouter)

// Shared server-side Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Health prober
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    port: activePort,
    aliasPorts: activeAliasPorts,
    pid: process.pid,
    mode: process.env.NODE_ENV || 'development',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasGoogleMapsKey: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Map provider configuration (auto-loads Google Maps when GOOGLE_MAPS_API_KEY is present, else FOSS OSM)
app.get('/api/maps/config', (_req: Request, res: Response) => {
  const key = process.env.GOOGLE_MAPS_API_KEY || '';
  res.json({
    hasGoogleMapsKey: Boolean(key),
    googleMapsApiKey: key,
  });
});

// SSRF-hardened remote spatial layer fetcher (GeoJSON / GPX / KML / CSV)
app.post('/api/maps/fetch-url', async (req: Request, res: Response) => {
  try {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!rawUrl) {
      res.status(400).json({ error: 'Missing url parameter' });
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: 'Invalid URL format' });
      return;
    }
    if (parsed.protocol !== 'https:') {
      res.status(400).json({ error: 'Only https:// URLs are permitted for remote map data' });
      return;
    }
    const host = parsed.hostname.toLowerCase();
    const isPrivateHost =
      host === 'localhost' ||
      host === '::1' ||
      host.endsWith('.local') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      /^(fc|fd)[0-9a-f]{2}:/i.test(host);
    if (isPrivateHost) {
      res.status(403).json({ error: 'Private or loopback network hosts are blocked' });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const upstream = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/geo+json, application/json, application/xml, text/xml, text/csv, */*' },
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `Upstream HTTP ${upstream.status}` });
      return;
    }

    const text = await upstream.text();
    if (text.length > 10 * 1024 * 1024) {
      res.status(413).json({ error: 'Remote map dataset exceeds 10 MB limit' });
      return;
    }

    res.json({
      success: true,
      content: text,
      contentType: upstream.headers.get('content-type') || 'text/plain',
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch remote map data' });
  }
});

// Loopback-only 2-click local CPU model folder setup, status & uninstall
const DEFAULT_MODELS_DIR = path.join(os.homedir(), '.drivetherapy', 'models');
const MODELS_MANIFEST_NAME = 'dt-models-manifest.json';

function resolveSafeModelsDir(inputDir?: string): string {
  const raw = (inputDir || '').trim();
  if (!raw) return DEFAULT_MODELS_DIR;
  if (raw.startsWith('~/')) return path.join(os.homedir(), raw.slice(2));
  return path.resolve(raw);
}

app.get('/api/models/local-status', (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Loopback access only' });
    return;
  }
  const targetDir = resolveSafeModelsDir(typeof req.query.dir === 'string' ? req.query.dir : undefined);
  const manifestPath = path.join(targetDir, MODELS_MANIFEST_NAME);
  try {
    if (!fs.existsSync(manifestPath)) {
      res.json({
        configuredDir: targetDir,
        isReady: false,
        installedModels: [],
        totalSizeMb: 0,
      });
      return;
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const installed = Array.isArray(manifest.installedModels) ? manifest.installedModels : [];
    const totalSizeMb = installed.reduce((sum: number, m: any) => sum + (Number(m.sizeMb) || 0), 0);
    res.json({
      configuredDir: targetDir,
      isReady: installed.length > 0,
      installedModels: installed,
      totalSizeMb,
      updatedAt: manifest.updatedAt || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to read local models status' });
  }
});

app.post('/api/models/local-setup', async (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Loopback access only' });
    return;
  }
  try {
    const targetDir = resolveSafeModelsDir(typeof req.body?.targetDir === 'string' ? req.body.targetDir : undefined);
    const requestedModels: Array<{ id: string; runtime: string; approxSizeMb: number }> = Array.isArray(req.body?.models)
      ? req.body.models
      : [];

    fs.mkdirSync(targetDir, { recursive: true });

    const installedModels: Array<{ id: string; runtime: string; sizeMb: number; file?: string; status: string }> = [];
    const warnings: string[] = [];

    for (const model of requestedModels) {
      if (model.runtime === 'ollama-cpu') {
        try {
          const pullRes = await fetch('http://127.0.0.1:11434/api/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: model.id, stream: false }),
          });
          if (pullRes.ok) {
            installedModels.push({
              id: model.id,
              runtime: model.runtime,
              sizeMb: model.approxSizeMb || 0,
              status: 'pulled-ollama',
            });
          } else {
            warnings.push(`Ollama pull for ${model.id} returned HTTP ${pullRes.status}`);
          }
        } catch {
          warnings.push(`Ollama daemon not reachable on localhost:11434 for ${model.id} (skipped)`);
        }
      } else {
        // Register WASM/ONNX browser-cached model slot in targetDir manifest + config marker
        const safeFile = `${model.id.replace(/[^a-z0-9._-]+/gi, '_')}.model.json`;
        fs.writeFileSync(
          path.join(targetDir, safeFile),
          JSON.stringify({ id: model.id, runtime: model.runtime, configuredAt: new Date().toISOString() }, null, 2),
          'utf8'
        );
        installedModels.push({
          id: model.id,
          runtime: model.runtime,
          sizeMb: model.approxSizeMb || 0,
          file: safeFile,
          status: 'configured',
        });
      }
    }

    const manifestPath = path.join(targetDir, MODELS_MANIFEST_NAME);
    const manifest = {
      version: 1,
      targetDir,
      installedModels,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    const totalSizeMb = installedModels.reduce((sum, m) => sum + (Number(m.sizeMb) || 0), 0);
    res.json({
      success: true,
      configuredDir: targetDir,
      installedModels,
      totalSizeMb,
      warnings,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to setup local models' });
  }
});

app.post('/api/models/local-uninstall', async (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Loopback access only' });
    return;
  }
  try {
    const targetDir = resolveSafeModelsDir(typeof req.body?.targetDir === 'string' ? req.body.targetDir : undefined);
    const manifestPath = path.join(targetDir, MODELS_MANIFEST_NAME);

    let removedCount = 0;
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const installed: Array<{ id: string; runtime: string; file?: string }> = Array.isArray(manifest.installedModels)
        ? manifest.installedModels
        : [];

      for (const m of installed) {
        if (m.runtime === 'ollama-cpu') {
          try {
            await fetch('http://127.0.0.1:11434/api/delete', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: m.id }),
            });
          } catch {}
        } else if (m.file) {
          const full = path.join(targetDir, path.basename(m.file));
          if (fs.existsSync(full)) {
            fs.unlinkSync(full);
          }
        }
        removedCount++;
      }
      fs.unlinkSync(manifestPath);
    }

    res.json({ success: true, configuredDir: targetDir, removedCount });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to uninstall local models' });
  }
});

// Loopback-only Full Diagnostic Telemetry Report Writer
app.post('/api/diagnostics/report', (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Loopback access only' });
    return;
  }
  try {
    const diagDir = path.join(process.cwd(), 'diagnostics');
    fs.mkdirSync(diagDir, { recursive: true });

    const payload = req.body || {};
    const results: Array<{ id: string; name: string; category: string; passed: boolean; latencyMs: number; detail: string }> =
      Array.isArray(payload.results) ? payload.results : [];

    const jsonPath = path.join(diagDir, 'full_diagnostic_report.json');
    const mdPath = path.join(diagDir, 'full_diagnostic_report.md');

    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

    const passed = results.filter((r) => r.passed).length;
    const lines = [
      '# Drive Therapy Full Diagnostic Report',
      '',
      `- **Generated:** ${payload.generatedAt || new Date().toISOString()}`,
      `- **Summary:** ${passed} / ${results.length} Passed`,
      '',
      '| Category | Probe | Status | Latency | Detail |',
      '| :--- | :--- | :---: | :---: | :--- |',
      ...results.map(
        (r) =>
          `| ${r.category} | ${r.name} | ${r.passed ? 'PASS' : 'FAIL'} | ${r.latencyMs}ms | ${r.detail.replace(/\|/g, '\\|')} |`
      ),
      '',
    ];
    fs.writeFileSync(mdPath, lines.join('\n'), 'utf8');

    res.json({
      success: true,
      jsonPath: 'diagnostics/full_diagnostic_report.json',
      markdownPath: 'diagnostics/full_diagnostic_report.md',
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to write diagnostic report' });
  }
});

// Server-side Gemini 3.8 Flash Vision Analysis
app.post('/api/gemini/analyze', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', filename = 'photo.jpg' } = req.body;

    if (!imageBase64) {
      res.status(400).json({ error: 'Missing imageBase64 data in request body.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured on the server. Falling back to local in-browser models.',
        fallback: true,
      });
      return;
    }

    // Clean base64 string
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const promptText = `
You are an expert digital asset manager and photographic culling assistant for "Drive Therapy".
Analyze this image "${filename}" and return structured JSON ONLY matching this exact JSON format:
{
  "description": "Short, vivid 1-sentence description of the image subject and composition",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
  "faces": [
    {
      "id": "face_1",
      "label": "Person / Subject 1 (e.g. Young adult woman, smiling)",
      "box": { "ymin": 0.1, "xmin": 0.2, "ymax": 0.4, "xmax": 0.5 }
    }
  ],
  "quality": {
    "sharpness": 88,
    "exposure": 92,
    "overall": 90,
    "isBlurry": false,
    "reason": "Crisp focus on eye pupils, excellent dynamic range"
  },
  "burstRecommendation": "keep",
  "palette": ["#403993", "#1074B1", "#52B197", "#BEBF61", "#A61B7A"]
}
Rules:
- burstRecommendation must be "keep" (if sharp/hero frame) or "reject" (if redundant, blurry, or misfocused).
- quality scores are integers between 0 and 100.
- tags should include subject, genre, environment, lighting, color tone, and composition.
- palette should be 5 dominant hex colors.
- Return raw JSON only with no markdown backticks.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          { text: promptText },
        ],
      },
    });

    const rawText = (response.text || '{}').trim();
    const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(cleanedText);
      res.json({ success: true, result: parsed });
    } catch {
      res.json({
        success: true,
        result: {
          description: rawText.slice(0, 200),
          tags: ['Photograph', 'Media', 'Cataloged'],
          faces: [],
          quality: { sharpness: 80, exposure: 80, overall: 80, isBlurry: false, reason: 'Analyzed' },
          burstRecommendation: 'keep',
          palette: ['#1074B1', '#52B197', '#BEBF61', '#403993', '#A61B7A'],
        },
      });
    }
  } catch (err: any) {
    console.error('Gemini analyze error:', err);
    res.status(500).json({ error: err.message || 'Vision analysis failed' });
  }
});

// Semantic natural language search across metadata
app.post('/api/gemini/search', async (req: Request, res: Response) => {
  try {
    const { query, catalogSummary } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      res.status(503).json({ error: 'Gemini API not configured.', fallback: true });
      return;
    }

    const prompt = `
Given this natural language search query for a photo catalog: "${query}"
And this summary of catalog items:
${JSON.stringify(catalogSummary).slice(0, 8000)}

Return a JSON array of matching item IDs ranked by relevance:
["id_1", "id_2", ...]
Return raw JSON only.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    const rawText = (response.text || '[]').trim();
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const matchedIds = JSON.parse(cleaned);

    res.json({ matchedIds });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Search failed' });
  }
});

// Harmonized Multi-Turn Gemini Workspace Chat (grounded in user index, storage & OAuth telemetry)
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  try {
    const { messages, systemContext, attachmentBase64, attachmentMimeType } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

    if (!apiKey) {
      res.status(503).json({
        error: 'Gemini API key is not configured on the server. Falling back to local grounded intelligence.',
        fallback: true,
      });
      return;
    }

    const turns = Array.isArray(messages) ? messages.slice(-12) : [];
    if (turns.length === 0) {
      res.status(400).json({ error: 'Missing chat messages array.' });
      return;
    }

    const contents = turns.map((turn: { role?: string; text?: string }, idx: number) => {
      const parts: Array<Record<string, any>> = [{ text: String(turn?.text || '').slice(0, 6000) }];
      if (idx === turns.length - 1 && typeof attachmentBase64 === 'string' && attachmentBase64.trim()) {
        const cleanData = attachmentBase64.includes(',')
          ? attachmentBase64.split(',')[1]
          : attachmentBase64;
        parts.unshift({
          inlineData: {
            mimeType: typeof attachmentMimeType === 'string' && attachmentMimeType ? attachmentMimeType : 'image/jpeg',
            data: cleanData,
          },
        });
      }
      return {
        role: turn?.role === 'model' ? 'model' : 'user',
        parts,
      };
    });

    const payload: Record<string, any> = { contents };
    if (typeof systemContext === 'string' && systemContext.trim()) {
      payload.system_instruction = {
        parts: [{ text: systemContext.slice(0, 12000) }],
      };
    }

    const gRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data = await gRes.json().catch(() => ({}));
    const outText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!gRes.ok || !outText) {
      res.status(502).json({
        error: data?.error?.message || `Gemini chat proxy error (${gRes.status})`,
        fallback: true,
      });
      return;
    }

    res.json({
      success: true,
      text: outText,
      modelUsed: 'gemini-2.5-flash (Server Proxy)',
      tokensUsed: data?.usageMetadata?.totalTokenCount || Math.round(outText.length / 4),
    });
  } catch (err: any) {
    console.error('Gemini chat error:', err);
    res.status(500).json({ error: err?.message || 'Gemini chat failed', fallback: true });
  }
});

// Non-Destructive Gemini Image Style Transfer / Editing Proxy
app.post('/api/gemini/image-edit', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', prompt } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    if (!apiKey) {
      res.status(503).json({
        error: 'Gemini API key not configured on server. Falling back to offline Canvas stylizer.',
        fallback: true,
      });
      return;
    }
    if (!imageBase64 || !prompt) {
      res.status(400).json({ error: 'Missing imageBase64 or prompt', fallback: true });
      return;
    }

    const cleanData = String(imageBase64).includes(',') ? String(imageBase64).split(',')[1] : String(imageBase64);
    const gRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inlineData: { mimeType, data: cleanData } },
                { text: String(prompt).slice(0, 2000) },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      }
    );

    const data = await gRes.json().catch(() => ({}));
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p: any) => p?.inlineData?.data);
    const textPart = parts.find((p: any) => typeof p?.text === 'string');

    if (!gRes.ok || !imgPart?.inlineData?.data) {
      res.status(502).json({
        error: data?.error?.message || `Gemini image edit unavailable (${gRes.status})`,
        fallback: true,
      });
      return;
    }

    res.json({
      success: true,
      imageBase64: imgPart.inlineData.data,
      mimeType: imgPart.inlineData.mimeType || 'image/png',
      text: textPart?.text || 'Generated non-destructive stylized image via Gemini.',
      modelUsed: 'gemini-2.5-flash-image-preview (Server Proxy)',
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Image edit failed', fallback: true });
  }
});

// Read-only Castor & Pollux Complete Library Sprite Gateway (zero source mutation, strict regex whitelist)
const CASTOR_OUTFITS_ROOT =
  process.env.CASTOR_OUTFITS_DIR ||
  '/home/face/Documents/Documents/code/CastorAndPollux/gens/Castor_24_Outfits';

const CASTOR_POLLUX_COMPLETE_ROOT =
  process.env.CASTOR_POLLUX_LIBRARY_DIR ||
  '/home/face/Documents/Documents/code/CastorAndPollux/gens/castor_pollux_complete_library';

const CASTOR_CHIBI_FALLBACK_MAP: Record<string, string> = {
  'C-01': '13_castor_casual_tech_apparel.png',
  'C-02': '01_castor_outfits_01_02.png',
  'C-03': '02_castor_outfits_03_04.png',
  'C-04': '02_castor_outfits_03_04.png',
  'C-05': '03_castor_outfits_05_06.png',
  'C-06': '03_castor_outfits_05_06.png',
  'C-07': '04_castor_outfits_07_08.png',
  'C-08': '04_castor_outfits_07_08.png',
  'C-09': '05_castor_outfits_09_10.png',
  'C-10': '05_castor_outfits_09_10.png',
  'C-11': '06_castor_outfits_11_12.png',
  'C-12': '06_castor_outfits_11_12.png',
  'C-13': '07_castor_outfits_13_14.png',
  'C-14': '07_castor_outfits_13_14.png',
  'C-15': '08_castor_outfits_15_16.png',
  'C-16': '08_castor_outfits_15_16.png',
  'C-17': '09_castor_outfits_17_18.png',
  'C-18': '09_castor_outfits_17_18.png',
  'C-19': '10_castor_outfits_19_20.png',
  'C-20': '10_castor_outfits_19_20.png',
  'C-21': '11_castor_outfits_21_22.png',
  'C-22': '11_castor_outfits_21_22.png',
  'C-23': '13_castor_casual_tech_apparel.png',
  'C-24': '12_castor_outfit_24_heavy_eva.png',
};

function detectImageMimeType(filePath: string): string {
  try {
    const fd = fs.openSync(filePath, 'r');
    const head = Buffer.alloc(12);
    fs.readSync(fd, head, 0, 12, 0);
    fs.closeSync(fd);
    if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'image/png';
    if (head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP') {
      return 'image/webp';
    }
  } catch {
    // fallback below
  }
  return 'image/png';
}

const CASTOR_OUTFIT_FOLDER_MAP = new Map<string, string>();
function resolveCastorOutfitDir(outfitId: string): string | null {
  if (!/^C-(0[1-9]|1[0-9]|2[0-4])$/.test(outfitId)) return null;
  if (CASTOR_OUTFIT_FOLDER_MAP.has(outfitId)) {
    return CASTOR_OUTFIT_FOLDER_MAP.get(outfitId)!;
  }
  try {
    if (!fs.existsSync(CASTOR_OUTFITS_ROOT)) return null;
    const entries = fs.readdirSync(CASTOR_OUTFITS_ROOT, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory() && ent.name.startsWith(`${outfitId}_`)) {
        const full = path.join(CASTOR_OUTFITS_ROOT, ent.name);
        CASTOR_OUTFIT_FOLDER_MAP.set(outfitId, full);
        return full;
      }
    }
  } catch {
    return null;
  }
  return null;
}

app.get('/api/castor/manifest', (_req: Request, res: Response) => {
  const available =
    fs.existsSync(CASTOR_OUTFITS_ROOT) ||
    fs.existsSync(path.join(CASTOR_POLLUX_COMPLETE_ROOT, 'generated_chibi_sheets', 'castor'));
  const polluxAvailable = fs.existsSync(
    path.join(CASTOR_POLLUX_COMPLETE_ROOT, 'generated_chibi_sheets', 'pollux')
  );
  res.json({
    available,
    polluxAvailable,
    character: 'Castor',
    partner: 'Pollux',
    outfitsCount: 24,
    expressionsCount: 16,
  });
});

app.get('/api/castor/sprite/:outfitId/:expressionFile', (req: Request, res: Response) => {
  const outfitId = String(req.params.outfitId || '');
  const expressionFile = String(req.params.expressionFile || '');

  if (!/^C-(0[1-9]|1[0-9]|2[0-4])$/.test(outfitId)) {
    res.status(400).json({ error: 'Invalid Castor outfit ID' });
    return;
  }
  if (!/^(0[1-9]|1[0-6])_[A-Za-z]+\.png$/.test(expressionFile)) {
    res.status(400).json({ error: 'Invalid Castor expression filename' });
    return;
  }

  // 0. Try clean pre-sliced individual transparent PNGs under public/characters/castor first
  const slicedCastorRoot = path.resolve(process.cwd(), 'public', 'characters', 'castor');
  const slicedCastorSprite = path.resolve(slicedCastorRoot, outfitId, expressionFile);
  if (
    slicedCastorSprite.startsWith(slicedCastorRoot + path.sep) &&
    fs.existsSync(slicedCastorSprite)
  ) {
    res.setHeader('Content-Type', detectImageMimeType(slicedCastorSprite));
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    fs.createReadStream(slicedCastorSprite).pipe(res);
    return;
  }

  // 1. Fall back seamlessly to full-color castor_pollux_complete_library/generated_chibi_sheets/castor
  const fallbackName = CASTOR_CHIBI_FALLBACK_MAP[outfitId] || '13_castor_casual_tech_apparel.png';
  const fallbackDir = path.resolve(CASTOR_POLLUX_COMPLETE_ROOT, 'generated_chibi_sheets', 'castor');
  const fallbackPath = path.resolve(fallbackDir, fallbackName);
  if (fallbackPath.startsWith(fallbackDir + path.sep) && fs.existsSync(fallbackPath)) {
    res.setHeader('Content-Type', detectImageMimeType(fallbackPath));
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    fs.createReadStream(fallbackPath).pipe(res);
    return;
  }

  res.status(404).json({ error: 'Castor sprite not found' });
});

app.get('/api/castor-pollux/:group/:fileName', (req: Request, res: Response) => {
  const group = String(req.params.group || '');
  const fileName = String(req.params.fileName || '');

  const groupDirMap: Record<string, string> = {
    castor: path.join(CASTOR_POLLUX_COMPLETE_ROOT, 'generated_chibi_sheets', 'castor'),
    pollux: path.join(CASTOR_POLLUX_COMPLETE_ROOT, 'generated_chibi_sheets', 'pollux'),
    shared: path.join(CASTOR_POLLUX_COMPLETE_ROOT, 'generated_chibi_sheets', 'shared'),
    reference: path.join(CASTOR_POLLUX_COMPLETE_ROOT, 'reference_sheets'),
  };

  const baseDir = groupDirMap[group];
  if (!baseDir) {
    res.status(400).json({ error: 'Invalid character library group' });
    return;
  }
  if (!/^[A-Za-z0-9_.-]+\.(png|jpg|jpeg|webp)$/i.test(fileName)) {
    res.status(400).json({ error: 'Invalid sheet filename' });
    return;
  }

  const normalizedBase = path.resolve(baseDir);
  const resolvedFile = path.resolve(normalizedBase, fileName);
  if (!resolvedFile.startsWith(normalizedBase + path.sep) || !fs.existsSync(resolvedFile)) {
    res.status(404).json({ error: 'Character sheet not found' });
    return;
  }

  res.setHeader('Content-Type', detectImageMimeType(resolvedFile));
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  fs.createReadStream(resolvedFile).pipe(res);
});

// [WO-104 / WO-105] Modular Native External Cloud VFS, Stream Proxy & Transfer Router + Takeout Stream Inspector
app.use('/api/clouds', createExternalCloudsRouter());
app.use('/api/takeout', createTakeoutStreamRouter(isLoopbackRequest));

// [WO-116 / WO-117] Enterprise Access Policy Enforcement Middleware, Persistent Hero Links,
// Unified DLP, Databricks OpenSharing v1, 4-Tier Malware Scanner & Structured Observability
const accessPolicyMiddleware = createAccessPolicyMiddleware(isLoopbackRequest);
app.use('/api', accessPolicyMiddleware);
app.use('/s', accessPolicyMiddleware);
app.use('/api/share', createHeroLinksRouter());
app.get('/s/:slug', handleHeroLinkResolve);
app.use('/api/opensharing', createOpenSharingRouter());
app.use('/api/security', createMalwareScannerRouter(isLoopbackRequest));
app.use('/api/security', createAccessPolicyRouter(isLoopbackRequest));
app.get('/api/system/observability', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(getObservabilitySnapshot());
});

// [WO-120] Public Google OAuth Verification Privacy Policy & Terms of Service Endpoints
app.get('/privacy', (_req: Request, res: Response) => {
  const p = fs.existsSync(path.join(__dirname, 'dist', 'privacy.html'))
    ? path.join(__dirname, 'dist', 'privacy.html')
    : path.join(__dirname, 'public', 'privacy.html');
  res.sendFile(p);
});

app.get('/terms', (_req: Request, res: Response) => {
  const p = fs.existsSync(path.join(__dirname, 'dist', 'terms.html'))
    ? path.join(__dirname, 'dist', 'terms.html')
    : path.join(__dirname, 'public', 'terms.html');
  res.sendFile(p);
});

// [WO-113] Multi-User Concurrent Google Account Session Management (HttpOnly dt_sid vault)
app.get('/api/auth/google/sessions', (req: Request, res: Response) => {
  const sid = getExistingSessionId(req);
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    activeEmail: getActiveGoogleEmail(sid),
    accounts: listGoogleAccountEmails(sid),
  });
});

app.post('/api/auth/google/switch', (req: Request, res: Response) => {
  const sid = getExistingSessionId(req);
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) {
    res.status(400).json({ error: 'Target account email is required.' });
    return;
  }
  const switched = setActiveGoogleAccount(sid, email);
  if (!switched) {
    res.status(404).json({ error: `Account ${email} is not currently signed in.` });
    return;
  }
  res.json({
    success: true,
    activeEmail: getActiveGoogleEmail(sid),
    accounts: listGoogleAccountEmails(sid),
  });
});

app.post('/api/auth/google/signout', (req: Request, res: Response) => {
  const sid = getExistingSessionId(req);
  const signOutAll = Boolean(req.body?.all);
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

  if (signOutAll || !email) {
    const removedCount = clearAllGoogleAccountTokens(sid);
    res.json({
      success: true,
      removedCount,
      activeEmail: null,
      accounts: [],
    });
    return;
  }

  removeGoogleAccountToken(sid, email);
  res.json({
    success: true,
    removedEmail: email,
    activeEmail: getActiveGoogleEmail(sid),
    accounts: listGoogleAccountEmails(sid),
  });
});

// [WO-115] Mobile Companion Background Camera-Roll Sync Intake (Pairing-Token Gated)
app.post('/api/companion/upload-manifest', (req: Request, res: Response) => {
  const token = String(req.headers['x-dt-pairing-token'] || req.body?.pairingToken || '');
  if (!/^dtmob_[a-f0-9]{24}$/.test(token)) {
    res.status(401).json({ error: 'Invalid or missing Mobile Companion pairing token.' });
    return;
  }
  const files = Array.isArray(req.body?.files) ? req.body.files : [];
  res.json({
    success: true,
    acceptedCount: files.length,
    targetFolder: typeof req.body?.targetFolder === 'string' ? req.body.targetFolder : '/Mobile Backups',
    preserveHeicAndLivePhoto: true,
    receivedAt: new Date().toISOString(),
  });
});

// [WO-111] True Zero-Residue Atomic Factory Reset Endpoint (works in both dev & production)
app.post('/api/system/factory-reset', (req: Request, res: Response) => {
  const sessionDestroyed = destroySession(req, res);
  for (const cookieName of ['dt_google_refresh', 'dt_oauth_sid', 'drive_auth_token']) {
    res.append('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
  res.json({
    success: true,
    sessionDestroyed,
    cleared: ['server_session_vault', 'cookies', 'cache', 'storage'],
  });
});

// Loopback-only Permission-Gated Local OS Search (used by Castor @local / /search)
app.post('/api/fs/search', async (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Local filesystem search is restricted to loopback requests.' });
    return;
  }

  const rawQuery = String(req.body?.query || '').trim().toLowerCase();
  const categoryFilter = typeof req.body?.category === 'string' ? req.body.category.toLowerCase() : '';
  const maxResults = Math.min(50, Math.max(1, Number(req.body?.maxResults) || 20));
  if (!rawQuery) {
    res.json({ success: true, items: [], scannedDirs: 0 });
    return;
  }

  const tokens = rawQuery.split(/\s+/).filter((t) => t.length >= 2);
  const skipDirs = new Set(['node_modules', '.git', '.cache', 'dist', '.Trash', '.local', '.npm', '.cargo']);
  const roots = resolveOsCommonFolders()
    .filter((r) => r.id !== 'home' && fs.existsSync(r.path))
    .map((r) => r.path);

  const items: Array<Record<string, any>> = [];
  let scannedDirs = 0;
  const maxDirs = 450;

  const walk = (dir: string, depth: number) => {
    if (depth > 4 || items.length >= maxResults || scannedDirs >= maxDirs) return;
    scannedDirs++;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of entries) {
      if (items.length >= maxResults || scannedDirs >= maxDirs) break;
      if (ent.name.startsWith('.') || skipDirs.has(ent.name)) continue;
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (ent.isFile()) {
        const lowerName = ent.name.toLowerCase();
        const lowerPath = fullPath.toLowerCase();
        const matches =
          tokens.length === 0
            ? lowerName.includes(rawQuery)
            : tokens.every((tok) => lowerName.includes(tok) || lowerPath.includes(tok));
        if (!matches) continue;

        const ext = path.extname(ent.name).replace(/^\./, '').toLowerCase();
        const isImg = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'avif', 'bmp', 'svg'].includes(ext);
        const isRaw = ['dng', 'cr2', 'cr3', 'nef', 'arw', 'raf', 'orf', 'rw2'].includes(ext);
        const isVid = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'].includes(ext);
        const isAud = ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac'].includes(ext);
        const isArc = ['zip', 'tar', 'gz', '7z', 'rar'].includes(ext);
        const isData = ['csv', 'json', 'xlsx', 'tsv', 'sql', 'xml'].includes(ext);
        const category = isImg
          ? 'image'
          : isRaw
            ? 'raw'
            : isVid
              ? 'video'
              : isAud
                ? 'audio'
                : isArc
                  ? 'archive'
                  : isData
                    ? 'data'
                    : 'document';

        if (categoryFilter && categoryFilter !== 'all' && category !== categoryFilter) continue;

        try {
          const stat = fs.statSync(fullPath);
          items.push({
            name: ent.name,
            path: fullPath,
            size: stat.size,
            modifiedTime: stat.mtime.toISOString(),
            extension: ext,
            mimeType: isImg ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'application/octet-stream',
            category,
            isMedia: isImg || isRaw || isVid || isAud,
            streamUrl: `/api/fs/stream?path=${encodeURIComponent(fullPath)}`,
          });
        } catch {
          // Skip unreadable files
        }
      }
    }
  };

  for (const r of roots) {
    if (items.length >= maxResults) break;
    walk(r, 0);
  }

  res.json({ success: true, items, scannedDirs });
});

// Generic CORS proxy for external free AI providers (Puter, Pollinations, Horde, Ollama, etc.)
app.post('/api/proxy', async (req: Request, res: Response) => {
  try {
    const { url, method = 'POST', headers = {}, body } = req.body;
    if (!url) {
      res.status(400).json({ error: 'Missing target URL' });
      return;
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.text();
    res.status(response.status).send(data);
  } catch (err: any) {
    res.status(502).json({ error: `Proxy error: ${err.message}` });
  }
});

// Authenticated Google Drive Media Binary Stream Proxy
app.get('/api/drive/stream/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    // <audio>/<video> elements cannot send headers; support HttpOnly dt_sid vault first, then header/query fallback.
    const vaultedGoogle = getGoogleAccountToken(getExistingSessionId(req));
    const queryToken = typeof req.query.access_token === 'string' ? req.query.access_token : '';
    const authHeader =
      req.headers.authorization ||
      (vaultedGoogle?.accessToken ? `Bearer ${vaultedGoogle.accessToken}` : '') ||
      (queryToken ? `Bearer ${queryToken}` : '');
    if (!authHeader) {
      res.status(401).json({ error: 'Missing Authorization header, session vault token, or access_token' });
      return;
    }

    const driveUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
    const fetchHeaders: Record<string, string> = {
      Authorization: authHeader,
    };
    if (req.headers.range) {
      fetchHeaders['Range'] = req.headers.range as string;
    }

    const upstreamRes = await fetch(driveUrl, { headers: fetchHeaders });
    res.status(upstreamRes.status);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-store');
    // Forward only the headers needed for correct media playback & seeking
    for (const h of ['content-type', 'content-length', 'content-range']) {
      const v = upstreamRes.headers.get(h);
      if (v) res.setHeader(h, v);
    }

    if (upstreamRes.body && upstreamRes.status < 400) {
      const { Readable } = await import('node:stream');
      const nodeStream = Readable.fromWeb(upstreamRes.body as any);
      req.on('close', () => nodeStream.destroy());
      nodeStream.on('error', () => res.end());
      nodeStream.pipe(res);
    } else {
      const text = upstreamRes.body ? await upstreamRes.text() : '';
      res.send(text);
    }
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Stream error' });
    } else {
      res.end();
    }
  }
});

// Local OS Filesystem MIME Map & Categorization (backed by Universal File Format DB)
function getLocalFileMime(filePath: string): string {
  return lookupFileFormat(path.basename(filePath)).mimeTypes[0] || 'application/octet-stream';
}

function getLocalFileCategory(ext: string, mime = ''): MediaCategory {
  return lookupFileFormat(ext, mime).category;
}

import { resolveOsCommonFolders } from './src/services/osFolders';
export { resolveOsCommonFolders };

// 1. Native Local File Manager: Quick Access Locations
app.get('/api/fs/quick-access', (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Access denied: local file management is restricted to loopback host.' });
    return;
  }

  try {
    const home = os.homedir();
    const accessible = resolveOsCommonFolders(home, os.platform());
    res.json({ success: true, homePath: home, locations: accessible, platform: os.platform() });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list quick access locations' });
  }
});

// 2. Native Local File Manager: Browse Directory
app.get('/api/fs/browse', async (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Access denied: local file management is restricted to loopback host.' });
    return;
  }

  try {
    const requestedPath = (req.query.path as string) || os.homedir();
    const cleanPath = requestedPath.startsWith('~')
      ? path.join(os.homedir(), requestedPath.slice(1))
      : requestedPath;
    const targetPath = path.resolve(cleanPath);

    // Guard against null-byte injection
    if (targetPath.indexOf('\0') !== -1) {
      res.status(400).json({ error: 'Invalid path' });
      return;
    }

    if (!fs.existsSync(targetPath)) {
      res.status(404).json({ error: `Directory not found: ${targetPath}` });
      return;
    }

    const dirStat = await fs.promises.stat(targetPath);
    if (!dirStat.isDirectory()) {
      res.status(400).json({ error: `Target path is not a directory: ${targetPath}` });
      return;
    }

    const dirEntries = await fs.promises.readdir(targetPath, { withFileTypes: true });
    const folders: OsFolderEntry[] = [];
    const files: OsFileEntry[] = [];

    for (const entry of dirEntries) {
      // Exclude hidden directories like .git unless requested
      if (entry.name.startsWith('.') && entry.name !== '.thumbnails') continue;

      const fullItemPath = path.join(targetPath, entry.name);
      try {
        if (entry.isDirectory()) {
          folders.push({
            name: entry.name,
            path: fullItemPath,
          });
        } else if (entry.isFile() || entry.isSymbolicLink()) {
          const fileStat = await fs.promises.stat(fullItemPath);
          const ext = path.extname(entry.name).toLowerCase();
          const fmt = lookupFileFormat(entry.name);
          const mime = fmt.mimeTypes[0] || 'application/octet-stream';
          const category = fmt.category;
          const isMedia = ['image', 'raw', 'video', 'audio'].includes(category);

          files.push({
            name: entry.name,
            path: fullItemPath,
            size: fileStat.size,
            modifiedTime: fileStat.mtime.toISOString(),
            extension: ext.replace('.', '').toUpperCase() || fmt.extension,
            mimeType: mime,
            category,
            isMedia,
            streamUrl: `/api/fs/stream?path=${encodeURIComponent(fullItemPath)}`,
            formatName: fmt.name,
            family: fmt.family,
            viewer: fmt.viewer,
            editor: fmt.editor,
          });
        }
      } catch {
        // Skip unreadable or permission-restricted individual entries
        continue;
      }
    }

    // Sort folders alphabetically, files by name or media prominence
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));

    // Build breadcrumbs
    const rootPath = os.platform() === 'win32' ? path.parse(targetPath).root : '/';
    const relative = path.relative(rootPath, targetPath);
    const parts = relative ? relative.split(path.sep).filter(Boolean) : [];

    const breadcrumbs = [{ name: rootPath === '/' ? 'Computer' : rootPath, path: rootPath }];
    let acc = rootPath;
    for (const part of parts) {
      acc = path.join(acc, part);
      breadcrumbs.push({ name: part, path: acc });
    }

    const parentPath = targetPath === rootPath ? null : path.dirname(targetPath);

    res.json({
      success: true,
      currentPath: targetPath,
      parentPath,
      breadcrumbs,
      folders,
      files,
      totalFolders: folders.length,
      totalFiles: files.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to browse local directory' });
  }
});

// 3. Native Local File Manager: Media Binary Stream (with HTTP Range Support)
app.get('/api/fs/stream', async (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Access denied: local file management is restricted to loopback host.' });
    return;
  }

  try {
    const rawPath = req.query.path as string;
    if (!rawPath) {
      res.status(400).json({ error: 'Missing path query parameter' });
      return;
    }

    const filePath = path.resolve(rawPath);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      res.status(400).json({ error: 'Requested path is not a file' });
      return;
    }

    const mime = getLocalFileMime(filePath);
    const range = req.headers.range;
    const isDownload = req.query.download === '1' || req.query.download === 'true';

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (isDownload) {
      const fileName = path.basename(filePath);
      const encodedName = encodeURIComponent(fileName);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`
      );
    }

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

      if (start >= stat.size || end >= stat.size || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end();
        return;
      }

      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Content-Type', mime);

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.status(200);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Type', mime);

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Stream error' });
  }
});

// 4. Native Local File Manager: Import Directory to Studio Catalog
app.post('/api/fs/import-to-catalog', async (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Access denied: local file management is restricted to loopback host.' });
    return;
  }

  try {
    const { folderPath, recursive = false } = req.body;
    if (!folderPath || typeof folderPath !== 'string') {
      res.status(400).json({ error: 'Missing folderPath in request body' });
      return;
    }

    const targetPath = path.resolve(folderPath);
    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) {
      res.status(404).json({ error: `Directory not found: ${targetPath}` });
      return;
    }

    const assets: any[] = [];

    async function scanDir(currentDir: string, currentRelative: string) {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const itemPath = path.join(currentDir, entry.name);
        try {
          if (entry.isDirectory() && recursive) {
            await scanDir(itemPath, `${currentRelative}/${entry.name}`);
          } else if (entry.isFile()) {
            const stat = await fs.promises.stat(itemPath);
            const ext = path.extname(entry.name).toLowerCase();
            const mime = getLocalFileMime(itemPath);
            const category = getLocalFileCategory(ext, mime);

            // Filter for media assets suitable for studio workstations
            if (['image', 'raw', 'video', 'audio'].includes(category)) {
              const assetId = `local_os_${crypto.createHash('md5').update(itemPath).digest('hex').slice(0, 12)}`;
              assets.push({
                id: assetId,
                name: entry.name,
                source: 'local',
                category,
                mimeType: mime,
                extension: ext.replace('.', '').toUpperCase(),
                path: itemPath,
                sizeBytes: stat.size,
                modifiedTime: stat.mtime.toISOString(),
                thumbnailUrl: `/api/fs/stream?path=${encodeURIComponent(itemPath)}`,
                cloudUrl: undefined,
                isCached: true,
                cullingStatus: 'unrated',
                rating: 0,
                tags: ['My Computer', category.toUpperCase(), ext.replace('.', '').toUpperCase()],
                faces: [],
                quality: {
                  sharpness: 90,
                  exposure: 88,
                  overall: 89,
                  isBlurry: false,
                  reason: 'Local file imported',
                },
                palette: ['#52B197', '#1074B1', '#403993', '#BEBF61', '#A61B7A'],
                exif: {
                  dimensions: 'Native Resolution',
                  dateTaken: stat.mtime.toLocaleDateString(),
                },
              });
            }
          }
        } catch {
          continue;
        }
      }
    }

    await scanDir(targetPath, path.basename(targetPath));

    res.json({
      success: true,
      folderName: path.basename(targetPath),
      folderPath: targetPath,
      count: assets.length,
      assets,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Import error' });
  }
});

// 4b. Native Local File Manager: Scan OS Music & Videos Directories for Media Player
app.get('/api/fs/scan-media', async (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Access denied: local media scanning is restricted to loopback host.' });
    return;
  }

  try {
    const customPath = typeof req.query.path === 'string' && req.query.path.trim() ? path.resolve(req.query.path.trim()) : null;
    const locations = resolveOsCommonFolders(os.homedir(), os.platform());
    const rootsToScan = customPath
      ? [customPath]
      : locations.filter((l) => l.id === 'music' || l.id === 'videos').map((l) => l.path);

    const mediaTracks: any[] = [];
    const seenPaths = new Set<string>();
    const MAX_FILES = 1500;
    const MAX_DEPTH = 4;

    async function walkMedia(dir: string, depth: number) {
      if (depth > MAX_DEPTH || mediaTracks.length >= MAX_FILES || !fs.existsSync(dir)) return;
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (mediaTracks.length >= MAX_FILES) break;
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walkMedia(fullPath, depth + 1);
        } else if (entry.isFile() || entry.isSymbolicLink()) {
          const ext = path.extname(entry.name).toLowerCase();
          const mime = getLocalFileMime(fullPath);
          const category = getLocalFileCategory(ext, mime);
          if ((category === 'audio' || category === 'video') && !seenPaths.has(fullPath)) {
            seenPaths.add(fullPath);
            try {
              const stat = await fs.promises.stat(fullPath);
              const parentDir = path.basename(path.dirname(fullPath)) || 'Local Music';
              const base = entry.name.replace(/\.[^/.]+$/, '');
              let artist = 'Local Artist';
              let title = base;
              const dashIdx = base.indexOf(' - ');
              if (dashIdx > 0 && dashIdx < base.length - 3) {
                artist = base.slice(0, dashIdx).trim();
                title = base.slice(dashIdx + 3).trim();
              }
              const id = `local_os_${crypto.createHash('md5').update(fullPath).digest('hex').slice(0, 12)}`;
              const format = ext.replace('.', '').toLowerCase() || (category === 'video' ? 'mp4' : 'mp3');

              let tags: ReturnType<typeof extractAudioTagsFromBuffer> = {};
              if (category === 'audio' && stat.size >= 16) {
                try {
                  const fh = await fs.promises.open(fullPath, 'r');
                  const headerBuf = Buffer.alloc(Math.min(65536, stat.size));
                  await fh.read(headerBuf, 0, headerBuf.length, 0);
                  await fh.close();
                  tags = extractAudioTagsFromBuffer(headerBuf, entry.name);
                } catch {
                  // Ignore read errors on locked files
                }
              }

              const finalTitle = tags.title || title;
              const finalArtist = tags.artist || artist;
              const finalAlbum = tags.album || parentDir;
              const uidInfo = computeCanonicalAlbumUid({
                embeddedUid: tags.albumUid,
                album: finalAlbum,
                albumArtist: tags.albumArtist,
                artist: finalArtist,
                year: tags.year,
                folderIdOrPath: path.dirname(fullPath),
              });

              mediaTracks.push({
                id,
                name: entry.name,
                title: finalTitle,
                artist: finalArtist,
                albumArtist: tags.albumArtist,
                album: finalAlbum,
                albumUid: uidInfo.albumUid,
                uidSource: uidInfo.uidSource,
                trackUid: tags.trackUid,
                trackNumber: tags.trackNumber,
                discNumber: tags.discNumber,
                year: tags.year,
                genre: tags.genre,
                durationSeconds: tags.durationSeconds || 0,
                path: fullPath,
                mimeType: mime,
                category,
                format,
                isVideo: category === 'video',
                sizeBytes: stat.size,
                modifiedAt: stat.mtimeMs,
                streamUrl: `/api/fs/stream?path=${encodeURIComponent(fullPath)}`,
              });
            } catch {
              continue;
            }
          }
        }
      }
    }

    for (const root of rootsToScan) {
      await walkMedia(root, 0);
    }

    res.json({
      success: true,
      roots: rootsToScan,
      count: mediaTracks.length,
      tracks: mediaTracks,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to scan local media directories' });
  }
});

// High-Speed In-Memory OS Volume Index + fs.watch Cache (Everything / fd / plocate inspired)
const fastOsIndexCache = new Map<
  string,
  { entries: Array<{ name: string; path: string; isDirectory: boolean; ext: string }>; builtAt: number; watching: boolean }
>();

app.get('/api/fs/fast-index', async (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Access denied: loopback host only.' });
    return;
  }
  try {
    const rawRoot = typeof req.query.root === 'string' && req.query.root.trim() ? req.query.root.trim() : os.homedir();
    const rootDir = path.resolve(rawRoot);
    const force = req.query.force === '1';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const cached = fastOsIndexCache.get(rootDir);

    if (!force && cached && Date.now() - cached.builtAt < 60_000) {
      const results = q ? cached.entries.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 500) : cached.entries.slice(0, 500);
      res.json({ cached: true, totalIndexed: cached.entries.length, results });
      return;
    }

    const entries: Array<{ name: string; path: string; isDirectory: boolean; ext: string }> = [];
    const SKIP_DIRS = new Set(['node_modules', '.git', '.cache', '.Trash', 'dist']);
    const queue: Array<{ dir: string; depth: number }> = [{ dir: rootDir, depth: 0 }];

    while (queue.length > 0 && entries.length < 15000) {
      const batch = queue.splice(0, 8);
      await Promise.all(
        batch.map(async ({ dir, depth }) => {
          if (depth > 4) return;
          try {
            const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const d of dirents) {
              if (d.name.startsWith('.') || SKIP_DIRS.has(d.name)) continue;
              const full = path.join(dir, d.name);
              const isDirectory = d.isDirectory();
              entries.push({
                name: d.name,
                path: full,
                isDirectory,
                ext: isDirectory ? '' : path.extname(d.name).replace('.', '').toUpperCase(),
              });
              if (isDirectory && depth < 4 && entries.length < 15000) {
                queue.push({ dir: full, depth: depth + 1 });
              }
            }
          } catch {
            // Skip unreadable dirs
          }
        })
      );
    }

    let watching = cached?.watching || false;
    if (!watching) {
      try {
        fs.watch(rootDir, { persistent: false }, () => {
          fastOsIndexCache.delete(rootDir);
        });
        watching = true;
      } catch {
        watching = false;
      }
    }

    fastOsIndexCache.set(rootDir, { entries, builtAt: Date.now(), watching });
    const results = q ? entries.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 500) : entries.slice(0, 500);
    res.json({ cached: false, totalIndexed: entries.length, results });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Fast index failed' });
  }
});

// 5. Native Local File Manager: Rename File or Directory
app.post('/api/fs/rename', async (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Access denied: local file management is restricted to loopback host.' });
    return;
  }

  try {
    const { oldPath, newName } = req.body;
    if (!oldPath || !newName || typeof oldPath !== 'string' || typeof newName !== 'string') {
      res.status(400).json({ error: 'Missing oldPath or newName in request body' });
      return;
    }

    const resolvedOld = path.resolve(oldPath);
    if (!fs.existsSync(resolvedOld)) {
      res.status(404).json({ error: `File or folder not found: ${resolvedOld}` });
      return;
    }

    // Sanitize new name against directory traversal
    const safeName = path.basename(newName.trim());
    if (!safeName || safeName === '.' || safeName === '..') {
      res.status(400).json({ error: 'Invalid new name' });
      return;
    }

    const resolvedNew = path.join(path.dirname(resolvedOld), safeName);
    if (fs.existsSync(resolvedNew) && resolvedNew.toLowerCase() !== resolvedOld.toLowerCase()) {
      res.status(409).json({ error: `An item named "${safeName}" already exists in this folder.` });
      return;
    }

    await fs.promises.rename(resolvedOld, resolvedNew);

    res.json({
      success: true,
      oldPath: resolvedOld,
      newPath: resolvedNew,
      newName: safeName,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to rename file' });
  }
});

// 6. Native Local File Manager: Duplicate File
app.post('/api/fs/duplicate', async (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Access denied: local file management is restricted to loopback host.' });
    return;
  }

  try {
    const { filePath } = req.body;
    if (!filePath || typeof filePath !== 'string') {
      res.status(400).json({ error: 'Missing filePath in request body' });
      return;
    }

    const resolvedSource = path.resolve(filePath);
    if (!fs.existsSync(resolvedSource)) {
      res.status(404).json({ error: `File not found: ${resolvedSource}` });
      return;
    }

    const stat = await fs.promises.stat(resolvedSource);
    if (stat.isDirectory()) {
      res.status(400).json({ error: 'Duplication is only supported for files, not directories' });
      return;
    }

    const dir = path.dirname(resolvedSource);
    const ext = path.extname(resolvedSource);
    const baseName = path.basename(resolvedSource, ext);

    // Compute unique duplicate filename: "photo copy.jpg", "photo copy 2.jpg", etc.
    let copyIndex = 1;
    let destPath = path.join(dir, `${baseName} copy${ext}`);
    while (fs.existsSync(destPath)) {
      copyIndex++;
      destPath = path.join(dir, `${baseName} copy ${copyIndex}${ext}`);
    }

    await fs.promises.copyFile(resolvedSource, destPath);
    const newStat = await fs.promises.stat(destPath);
    const newMime = getLocalFileMime(destPath);
    const newCat = getLocalFileCategory(ext.toLowerCase(), newMime);

    res.json({
      success: true,
      originalPath: resolvedSource,
      newPath: destPath,
      newName: path.basename(destPath),
      sizeBytes: newStat.size,
      category: newCat,
      mimeType: newMime,
      thumbnailUrl: `/api/fs/stream?path=${encodeURIComponent(destPath)}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to duplicate file' });
  }
});

// 7. Native Local File Manager: Delete File or Folder
app.post('/api/fs/delete', async (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Access denied: local file management is restricted to loopback host.' });
    return;
  }

  try {
    const { targetPath } = req.body;
    if (!targetPath || typeof targetPath !== 'string') {
      res.status(400).json({ error: 'Missing targetPath in request body' });
      return;
    }

    const resolvedTarget = path.resolve(targetPath);
    if (!fs.existsSync(resolvedTarget)) {
      res.status(404).json({ error: `Path not found: ${resolvedTarget}` });
      return;
    }

    const stat = await fs.promises.stat(resolvedTarget);
    if (stat.isDirectory()) {
      await fs.promises.rm(resolvedTarget, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(resolvedTarget);
    }

    res.json({
      success: true,
      deletedPath: resolvedTarget,
      isFolder: stat.isDirectory(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete file' });
  }
});

// Universal File Format Flat-File Database & Magic-Byte Sniffer Endpoints
const FORMAT_DB_FILE = path.resolve(__dirname, 'src/data/fileFormatsDatabase.json');

app.get('/api/formats/db', (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const family = typeof req.query.family === 'string' ? req.query.family : undefined;
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const viewer = typeof req.query.viewer === 'string' ? req.query.viewer : undefined;
  const editor = typeof req.query.editor === 'string' ? req.query.editor : undefined;

  const formats = searchFormatDatabase(q, { family, category, viewer, editor });
  const stats = getFormatDatabaseStats();
  res.json({
    stats,
    total: formats.length,
    formats,
  });
});

app.post('/api/formats/upsert', async (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Access denied: updating flat-file format database is restricted to loopback host.' });
    return;
  }

  try {
    const body = req.body as Partial<FileFormatDefinition>;
    const rawExt = (body.extension || '').replace(/^\./, '').trim().toUpperCase();
    const rawName = (body.name || '').trim();
    if (!rawExt || !rawName || !body.family || !body.category) {
      res.status(400).json({ error: 'Required fields: extension, name, family, category' });
      return;
    }

    const normalizedAliases = Array.isArray(body.aliases)
      ? body.aliases.map((a) => String(a).replace(/^\./, '').trim().toUpperCase()).filter((a) => a && a !== rawExt)
      : [];

    // Enforce collision-free invariant against other canonical extensions and aliases
    const existingOthers = getAllFormatDefinitions().filter((item) => item.extension !== rawExt);
    const tokenSet = new Set<string>([rawExt, ...normalizedAliases]);
    for (const existing of existingOthers) {
      if (tokenSet.has(existing.extension)) {
        res.status(409).json({ error: `Token collision with existing extension ${existing.extension}` });
        return;
      }
      for (const alias of existing.aliases) {
        if (tokenSet.has(alias)) {
          res.status(409).json({ error: `Alias collision with ${alias} on ${existing.extension}` });
          return;
        }
      }
    }

    const saved = upsertFormatDefinition({
      extension: rawExt,
      aliases: normalizedAliases,
      name: rawName,
      family: body.family,
      category: body.category,
      mimeTypes:
        Array.isArray(body.mimeTypes) && body.mimeTypes.length > 0
          ? body.mimeTypes.map((m) => String(m).trim()).filter(Boolean)
          : [`application/x-${rawExt.toLowerCase()}`],
      magicSignatures: Array.isArray(body.magicSignatures) ? body.magicSignatures : [],
      containerFormat: body.containerFormat,
      metadataParsers: Array.isArray(body.metadataParsers) ? body.metadataParsers : [],
      viewer: body.viewer || 'hex-inspector',
      editor: body.editor || 'none',
      isLossless: body.isLossless,
      isStreamable: Boolean(body.isStreamable),
      preservationGrade: body.preservationGrade || 'LOC-Acceptable',
      description: (body.description || `${rawName} (.${rawExt.toLowerCase()})`).trim(),
    });

    const stats = getFormatDatabaseStats();
    let sourceStandards: string[] = [
      'FileInfo.com File Types Reference',
      'Library of Congress Digital Formats (FDD)',
      'Wikipedia List of File Formats',
      'FileFormat.info',
      'Aspose & Online-Convert Registry',
      'Voidtools Everything Search Indexing Standards',
    ];
    try {
      const existingRaw = await fs.promises.readFile(FORMAT_DB_FILE, 'utf8');
      const existingDoc = JSON.parse(existingRaw) as Partial<FileFormatDatabaseDocument>;
      if (Array.isArray(existingDoc.sourceStandards) && existingDoc.sourceStandards.length > 0) {
        sourceStandards = existingDoc.sourceStandards;
      }
    } catch {
      // Fallback to canonical source list if missing
    }

    const doc: FileFormatDatabaseDocument = {
      schemaVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      sourceStandards,
      totalFormats: stats.totalFormats,
      totalExtensionsAndAliases: stats.totalExtensionsAndAliases,
      formats: getAllFormatDefinitions(),
    };
    const tmpFile = `${FORMAT_DB_FILE}.tmp`;
    await fs.promises.writeFile(tmpFile, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    await fs.promises.rename(tmpFile, FORMAT_DB_FILE);

    res.json({
      success: true,
      format: saved,
      stats,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update format database' });
  }
});

app.get('/api/fs/inspect-meta', async (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Access denied: local file header inspection is restricted to loopback host.' });
    return;
  }

  try {
    const rawPath = req.query.path as string;
    if (!rawPath) {
      res.status(400).json({ error: 'Missing path query parameter' });
      return;
    }

    const filePath = path.resolve(rawPath);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      res.status(400).json({ error: 'Requested path is not a file' });
      return;
    }

    const maxBytes = Math.min(4096, Math.max(0, stat.size));
    const buf = Buffer.alloc(maxBytes);
    let bytesRead = 0;
    if (maxBytes > 0) {
      const handle = await fs.promises.open(filePath, 'r');
      try {
        const readResult = await handle.read(buf, 0, maxBytes, 0);
        bytesRead = readResult.bytesRead;
      } finally {
        await handle.close();
      }
    }

    const headerBytes = new Uint8Array(buf.buffer, buf.byteOffset, bytesRead);
    const textSample = bytesRead > 0 ? buf.subarray(0, bytesRead).toString('utf8') : undefined;
    const classification = classifyFile({
      filename: path.basename(filePath),
      sizeBytes: stat.size,
      modifiedTime: stat.mtime.toISOString(),
      headerBytes,
      textSample,
    });

    res.json({
      path: filePath,
      classification,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to inspect file metadata' });
  }
});

// Non-Destructive Collision-Safe Save Copy for In-Place Studio Editors
app.post('/api/fs/save-copy', async (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Access denied: saving edited file copies is restricted to loopback host.' });
    return;
  }

  try {
    const body = req.body as {
      originalPath?: string;
      targetDir?: string;
      filename?: string;
      content?: string;
      encoding?: 'utf8' | 'base64';
    };

    if (typeof body.content !== 'string' || !body.filename) {
      res.status(400).json({ error: 'Required fields: filename and content' });
      return;
    }

    const safeFileName = path.basename(body.filename).trim() || 'edited-file.txt';
    const ext = path.extname(safeFileName);
    const baseName = path.basename(safeFileName, ext);

    let destDir = os.tmpdir();
    if (body.targetDir && fs.existsSync(path.resolve(body.targetDir))) {
      destDir = path.resolve(body.targetDir);
    } else if (body.originalPath && body.originalPath.startsWith('/')) {
      const candidateDir = path.dirname(path.resolve(body.originalPath));
      if (fs.existsSync(candidateDir)) {
        destDir = candidateDir;
      }
    }

    let copyIdx = 1;
    let destPath = path.join(destDir, `${baseName} (edited)${ext}`);
    while (fs.existsSync(destPath)) {
      copyIdx += 1;
      destPath = path.join(destDir, `${baseName} (edited ${copyIdx})${ext}`);
    }

    const encoding: BufferEncoding = body.encoding === 'base64' ? 'base64' : 'utf8';
    await fs.promises.writeFile(destPath, body.content, encoding);
    const stat = await fs.promises.stat(destPath);

    res.json({
      success: true,
      savedPath: destPath,
      name: path.basename(destPath),
      sizeBytes: stat.size,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save non-destructive copy' });
  }
});


async function listenOnCleanPort(initialPort: number, maxRetries = 25): Promise<{ server: HttpServer; port: number }> {
  let candidate = initialPort;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const server = await new Promise<HttpServer>((resolve, reject) => {
        const instance = app.listen(candidate, '0.0.0.0', () => {
          resolve(instance);
        });
        instance.once('error', (err: NodeJS.ErrnoException) => {
          reject(err);
        });
      });
      return { server, port: candidate };
    } catch (err: any) {
      if (err?.code === 'EADDRINUSE' && attempt + 1 < maxRetries) {
        candidate += 1;
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Failed to bind Drive Therapy server after ${maxRetries} port attempts starting at ${initialPort}`);
}

// Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Prevent stale HTML & service worker caching across deploys
    app.use((req, res, next) => {
      if (req.path === '/' || req.path === '/index.html' || req.path === '/sw.js') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      next();
    });

    app.use(
      express.static(path.resolve(__dirname, 'dist'), {
        etag: false,
        lastModified: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          } else if (filePath.includes('/characters/') || filePath.includes('/themes/')) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
          } else if (filePath.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );

    // Explicit cache flush endpoint (triggers W3C Clear-Site-Data header)
    app.get('/api/system/flush-cache', (req: Request, res: Response) => {
      const clearStorage = req.query.storage === 'true';
      res.setHeader('Clear-Site-Data', clearStorage ? '"cache", "storage"' : '"cache"');
      res.json({ success: true, message: 'Browser cache successfully cleared', storageCleared: clearStorage });
    });

    // [WO-111] True Zero-Residue Atomic Factory Reset Endpoint (destroys server session vault + cookies + browser storage)
    app.post('/api/system/factory-reset', (req: Request, res: Response) => {
      const sessionDestroyed = destroySession(req, res);
      // Expire any legacy Google OAuth / refresh cookies
      for (const cookieName of ['dt_google_refresh', 'dt_oauth_sid', 'drive_auth_token']) {
        res.append('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
      res.json({
        success: true,
        sessionDestroyed,
        cleared: ['server_session_vault', 'cookies', 'cache', 'storage'],
      });
    });

    app.get('*', (req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      if (req.query.flush === 'true') {
        res.setHeader('Clear-Site-Data', '"cache"');
      }
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'), { etag: false, lastModified: false });
    });
  }

  const forceFreshPort = process.env.FRESH_PORT === '1' || process.argv.includes('--fresh-port');
  const preferredPort =
    Number.isInteger(parsedEnvPort) && parsedEnvPort > 0 && parsedEnvPort <= 65535
      ? parsedEnvPort
      : DEFAULT_CLEAN_PORT;

  const previousState = readRuntimeServerState();
  const reclaimedPids = await reclaimPreviousServerInstances();
  if (reclaimedPids.length > 0) {
    console.log(`[Drive Therapy] Reclaimed prior server PID(s): ${reclaimedPids.join(', ')}`);
  }

  const candidateCleanPort = await resolveCleanServerPort({
    preferredPort,
    previousPort: previousState?.primaryPort,
    forceFreshPort,
  });

  const boundServers: HttpServer[] = [];
  const { server: primaryServer, port: boundPort } = await listenOnCleanPort(candidateCleanPort);
  activePort = boundPort;
  boundServers.push(primaryServer);

  // Optional in-process alias ports (replaces external node reverse-proxy scripts when configured)
  const rawAliasPorts = (process.env.ALIAS_PORTS || '')
    .split(',')
    .map((v) => parseInt(v.trim(), 10))
    .filter((p) => Number.isInteger(p) && p > 0 && p <= 65535 && p !== activePort);

  for (const aliasPort of rawAliasPorts) {
    if (await isPortAvailable(aliasPort)) {
      const aliasServer = await new Promise<HttpServer | null>((resolve) => {
        const instance = app.listen(aliasPort, '0.0.0.0', () => resolve(instance));
        instance.once('error', () => resolve(null));
      });
      if (aliasServer) {
        boundServers.push(aliasServer);
        activeAliasPorts.push(aliasPort);
      }
    }
  }

  writeRuntimeServerState({
    pid: process.pid,
    primaryPort: activePort,
    aliasPorts: [...activeAliasPorts],
    mode: process.env.NODE_ENV || 'development',
    startedAt: new Date().toISOString(),
    url: `http://localhost:${activePort}`,
  });

  const shutdownCleanup = () => {
    clearRuntimeServerState(undefined, process.pid);
    for (const srv of boundServers) {
      try {
        srv.close();
      } catch {
        // Ignore close errors during shutdown
      }
    }
  };

  process.once('SIGINT', () => {
    shutdownCleanup();
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    shutdownCleanup();
    process.exit(0);
  });
  process.once('exit', () => {
    clearRuntimeServerState(undefined, process.pid);
  });

  const aliasSummary =
    activeAliasPorts.length > 0 ? ` (aliases: ${activeAliasPorts.join(', ')})` : '';
  console.log(`[Drive Therapy] Server ignited on clean port ${activePort}${aliasSummary}`);
}

// -----------------------------------------------------------------------------
// Google Photos Picker API, Library Auto-Load & Authenticated Media Proxy
// -----------------------------------------------------------------------------

app.get('/api/photos/library', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  try {
    const fetchPagedPhotos = async (endpoint: string, listKey: string, maxPages: number) => {
      const collected: any[] = [];
      let pageToken = '';
      let status = 200;
      let errorDetail: string | undefined;

      for (let page = 0; page < maxPages; page++) {
        const sep = endpoint.includes('?') ? '&' : '?';
        const url = pageToken ? `${endpoint}${sep}pageToken=${encodeURIComponent(pageToken)}` : endpoint;
        const gRes = await fetch(url, { headers: { Authorization: authHeader } }).catch(() => null);
        if (!gRes) break;
        status = gRes.status;
        const body = await gRes.json().catch(() => ({}));
        if (!gRes.ok) {
          errorDetail = body?.error?.message || `HTTP ${gRes.status}`;
          break;
        }
        if (Array.isArray(body[listKey])) {
          collected.push(...body[listKey]);
        }
        if (!body.nextPageToken) break;
        pageToken = body.nextPageToken;
      }

      return { items: collected, status, errorDetail };
    };

    const [mediaResult, albumsResult, sharedResult] = await Promise.all([
      fetchPagedPhotos('https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=100', 'mediaItems', 3),
      fetchPagedPhotos('https://photoslibrary.googleapis.com/v1/albums?pageSize=50', 'albums', 3),
      fetchPagedPhotos('https://photoslibrary.googleapis.com/v1/sharedAlbums?pageSize=50', 'sharedAlbums', 2),
    ]);

    const policyRestricted = Boolean(
      mediaResult.status === 403 ||
        mediaResult.status === 401 ||
        albumsResult.status === 403 ||
        albumsResult.status === 401
    );

    res.json({
      mediaItems: mediaResult.items,
      albums: albumsResult.items,
      sharedAlbums: sharedResult.items,
      policyRestricted,
      errorDetail: mediaResult.errorDetail || albumsResult.errorDetail || sharedResult.errorDetail,
    });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Failed to contact Google Photos Library API' });
  }
});

app.post('/api/photos/album-items', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  const { albumId, pageToken } = req.body || {};
  if (!albumId || typeof albumId !== 'string') {
    res.status(400).json({ error: 'albumId is required' });
    return;
  }
  try {
    const gRes = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ albumId, pageSize: 100, ...(pageToken ? { pageToken } : {}) }),
    });
    const data = await gRes.json().catch(() => ({}));
    if (!gRes.ok) {
      res.status(gRes.status).json({ error: data?.error?.message || 'Failed to load album items' });
      return;
    }
    res.json({ mediaItems: data.mediaItems || [], nextPageToken: data.nextPageToken || null });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Album items request failed' });
  }
});

// Live Google Photos Content-Category Search (PETS, ANIMALS, LANDSCAPES, RECEIPTS, etc.)
app.post('/api/photos/search', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  const { categories, pageSize = 20 } = req.body || {};
  const validCategories = Array.isArray(categories)
    ? categories.filter((c: unknown) => typeof c === 'string' && /^[A-Z_]+$/.test(c)).slice(0, 5)
    : [];

  try {
    const bodyPayload: Record<string, any> = {
      pageSize: Math.min(50, Math.max(1, Number(pageSize) || 20)),
    };
    if (validCategories.length > 0) {
      bodyPayload.filters = {
        contentFilter: {
          includedContentCategories: validCategories,
        },
      };
    }

    const gRes = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });
    const data = await gRes.json().catch(() => ({}));
    if (!gRes.ok) {
      res.status(gRes.status).json({ error: data?.error?.message || 'Google Photos search failed' });
      return;
    }
    res.json({ mediaItems: data.mediaItems || [], nextPageToken: data.nextPageToken || null });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Google Photos search proxy error' });
  }
});

app.post('/api/photos/albums', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  const { title } = req.body || {};
  if (!title || typeof title !== 'string' || !title.trim()) {
    res.status(400).json({ error: 'Album title is required' });
    return;
  }
  try {
    const gRes = await fetch('https://photoslibrary.googleapis.com/v1/albums', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ album: { title: title.trim() } }),
    });
    const data = await gRes.json().catch(() => ({}));
    if (!gRes.ok) {
      res.status(gRes.status).json({ error: data?.error?.message || 'Create Google Photos album failed' });
      return;
    }
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Create album request failed' });
  }
});

// -----------------------------------------------------------------------------
// Loopback-Only Local OS Delta Scan (mtimeMs / size diff without full rebuild)
// -----------------------------------------------------------------------------

app.post('/api/fs/delta-scan', async (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Loopback access only' });
    return;
  }
  const { rootPaths, manifest } = req.body || {};
  const roots: string[] = Array.isArray(rootPaths) ? rootPaths.filter((p) => typeof p === 'string' && fs.existsSync(p)) : [];
  const known: Record<string, { mtimeMs: number; size: number }> =
    manifest && typeof manifest === 'object' ? manifest : {};

  if (roots.length === 0) {
    res.json({ addedOrModified: [], removedPaths: [] });
    return;
  }

  const seenPaths = new Set<string>();
  const addedOrModified: Array<{ name: string; path: string; sizeBytes: number; mtimeMs: number }> = [];
  const stack = [...roots];

  while (stack.length > 0 && addedOrModified.length < 5000) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') stack.push(fullPath);
      } else if (entry.isFile()) {
        seenPaths.add(fullPath);
        try {
          const stat = await fs.promises.stat(fullPath);
          const prev = known[fullPath];
          if (!prev || Math.abs(prev.mtimeMs - stat.mtimeMs) > 1 || prev.size !== stat.size) {
            addedOrModified.push({
              name: entry.name,
              path: fullPath,
              sizeBytes: stat.size,
              mtimeMs: stat.mtimeMs,
            });
          }
        } catch {}
      }
    }
  }

  const removedPaths = Object.keys(known).filter((p) => !seenPaths.has(p));
  res.json({ addedOrModified, removedPaths });
});

app.post('/api/photos/session', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  try {
    const gRes = await fetch('https://photospicker.googleapis.com/v1/sessions', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pickingConfig: { maxItemCount: 2000 },
      }),
    });
    const data = await gRes.json().catch(() => ({}));
    if (!gRes.ok) {
      res.status(gRes.status).json({ error: data?.error?.message || 'Google Photos Picker session error' });
      return;
    }
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Failed to contact Google Photos Picker API' });
  }
});

app.get('/api/photos/session/:sessionId', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  const sessionId = String(req.params.sessionId || '');
  try {
    const sRes = await fetch(`https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: authHeader },
    });
    const sessionData = await sRes.json().catch(() => ({}));
    if (!sRes.ok) {
      res.status(sRes.status).json({ error: sessionData?.error?.message || 'Session poll failed' });
      return;
    }
    if (!sessionData.mediaItemsSet) {
      res.json({ mediaItemsSet: false, mediaItems: [] });
      return;
    }

    const allPicked: any[] = [];
    let pageToken = '';
    for (let page = 0; page < 20; page++) {
      const url = `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${encodeURIComponent(sessionId)}&pageSize=100${
        pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
      }`;
      const itemsRes = await fetch(url, { headers: { Authorization: authHeader } });
      const itemsData = await itemsRes.json().catch(() => ({}));
      if (Array.isArray(itemsData.mediaItems)) {
        allPicked.push(...itemsData.mediaItems);
      }
      if (!itemsData.nextPageToken) break;
      pageToken = itemsData.nextPageToken;
    }
    res.json({ mediaItemsSet: true, mediaItems: allPicked });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Failed to poll Google Photos session' });
  }
});

// Live Google Workspace Search Proxies (Gmail, Calendar, Contacts)
app.post('/api/workspace/search/gmail', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  const q = String(req.body?.q || '').trim();
  if (!q) {
    res.json({ items: [] });
    return;
  }
  try {
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=8`,
      { headers: { Authorization: authHeader } }
    );
    const listData = await listRes.json().catch(() => ({}));
    if (!listRes.ok) {
      res.status(listRes.status).json({ error: listData?.error?.message || 'Gmail search failed' });
      return;
    }
    const ids: Array<{ id: string }> = Array.isArray(listData.messages) ? listData.messages.slice(0, 8) : [];
    const hydrated = await Promise.all(
      ids.map(async (m) => {
        try {
          const mRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(m.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: authHeader } }
          );
          const mData = await mRes.json().catch(() => ({}));
          const headers: Array<{ name: string; value: string }> = mData?.payload?.headers || [];
          const getH = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || '';
          return {
            id: m.id,
            subject: getH('Subject') || '(No Subject)',
            from: getH('From') || 'Unknown Sender',
            date: getH('Date') || '',
            snippet: String(mData.snippet || ''),
            webUrl: `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(m.id)}`,
          };
        } catch {
          return null;
        }
      })
    );
    res.json({ items: hydrated.filter(Boolean) });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Gmail search proxy error' });
  }
});

app.post('/api/workspace/search/calendar', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  const q = String(req.body?.q || '').trim();
  const timeMin = typeof req.body?.timeMin === 'string' ? req.body.timeMin : '';
  const timeMax = typeof req.body?.timeMax === 'string' ? req.body.timeMax : '';
  try {
    const params = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '10' });
    if (q) params.set('q', q);
    if (timeMin) params.set('timeMin', timeMin);
    if (timeMax) params.set('timeMax', timeMax);
    const cRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: authHeader } }
    );
    const data = await cRes.json().catch(() => ({}));
    if (!cRes.ok) {
      res.status(cRes.status).json({ error: data?.error?.message || 'Calendar search failed' });
      return;
    }
    const items = (Array.isArray(data.items) ? data.items : []).map((ev: any) => ({
      id: ev.id,
      summary: ev.summary || '(Untitled Event)',
      start: ev.start?.dateTime || ev.start?.date || '',
      end: ev.end?.dateTime || ev.end?.date || '',
      location: ev.location || '',
      htmlLink: ev.htmlLink || 'https://calendar.google.com',
    }));
    res.json({ items });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Calendar search proxy error' });
  }
});

app.post('/api/workspace/search/contacts', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  const q = String(req.body?.q || '').trim();
  if (!q) {
    res.json({ items: [] });
    return;
  }
  try {
    const pRes = await fetch(
      `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(q)}&readMask=names,emailAddresses,phoneNumbers&pageSize=10`,
      { headers: { Authorization: authHeader } }
    );
    const data = await pRes.json().catch(() => ({}));
    if (!pRes.ok) {
      res.status(pRes.status).json({ error: data?.error?.message || 'Contacts search failed' });
      return;
    }
    const items = (Array.isArray(data.results) ? data.results : []).map((r: any) => ({
      resourceName: r.person?.resourceName || '',
      name: r.person?.names?.[0]?.displayName || 'Unnamed Contact',
      email: r.person?.emailAddresses?.[0]?.value || '',
      phone: r.person?.phoneNumbers?.[0]?.value || '',
    }));
    res.json({ items });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Contacts search proxy error' });
  }
});

// Multicloud Direct Server-Side Transfer: Google Photos -> Google Drive (zero client download)
app.post('/api/multicloud/photos-to-drive', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 50) : [];
  const destinationFolderId = typeof req.body?.destinationFolderId === 'string' ? req.body.destinationFolderId.trim() : '';

  if (items.length === 0) {
    res.status(400).json({ error: 'No items provided for transfer.' });
    return;
  }

  const results: Array<Record<string, any>> = [];
  for (const item of items) {
    const rawUrl = String(item?.baseUrl || '').trim();
    const name = String(item?.name || `photo_${Date.now()}.jpg`);
    const mimeType = String(item?.mimeType || 'image/jpeg');

    let allowed = false;
    try {
      const u = new URL(rawUrl);
      const host = u.hostname.toLowerCase();
      allowed =
        u.protocol === 'https:' &&
        (host === 'lh3.googleusercontent.com' ||
          host.endsWith('.googleusercontent.com') ||
          host === 'photos.googleapis.com');
    } catch {
      allowed = false;
    }

    if (!allowed) {
      results.push({ sourceId: item?.id || name, name, status: 'failed', error: 'Disallowed source media URL' });
      continue;
    }

    try {
      const downloadUrl = rawUrl.includes('=') ? rawUrl : `${rawUrl}=d`;
      const imgRes = await fetch(downloadUrl, { headers: { Authorization: authHeader } });
      if (!imgRes.ok) {
        results.push({ sourceId: item?.id || name, name, status: 'failed', error: `Photos fetch HTTP ${imgRes.status}` });
        continue;
      }
      const bytes = Buffer.from(await imgRes.arrayBuffer());
      const boundary = `dt_mc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const metaObj: Record<string, any> = { name, mimeType };
      if (destinationFolderId) metaObj.parents = [destinationFolderId];

      const preamble = Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metaObj)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
        'utf8'
      );
      const epilogue = Buffer.from(`\r\n--${boundary}--`, 'utf8');
      const multipartBody = Buffer.concat([preamble, bytes, epilogue]);

      const upRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );
      const upData = await upRes.json().catch(() => ({}));
      if (!upRes.ok) {
        results.push({ sourceId: item?.id || name, name, status: 'failed', error: upData?.error?.message || `Drive upload HTTP ${upRes.status}` });
        continue;
      }
      results.push({
        sourceId: item?.id || name,
        name: upData.name || name,
        status: 'transferred',
        destinationFileId: upData.id,
        webViewLink: upData.webViewLink || `https://drive.google.com/file/d/${upData.id}/view`,
      });
    } catch (err: any) {
      results.push({ sourceId: item?.id || name, name, status: 'failed', error: err?.message || 'Transfer error' });
    }
  }

  res.json({ success: true, results });
});

// Multicloud Native Google Drive Cloud-Side Copy (zero bandwidth)
app.post('/api/multicloud/drive-copy', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 50) : [];
  const destinationFolderId = typeof req.body?.destinationFolderId === 'string' ? req.body.destinationFolderId.trim() : '';

  const results: Array<Record<string, any>> = [];
  for (const item of items) {
    const fileId = String(item?.driveFileId || item?.id || '').replace(/^drive_/, '').trim();
    const name = String(item?.name || 'Copied File');
    if (!fileId) {
      results.push({ sourceId: name, name, status: 'failed', error: 'Missing Drive fileId' });
      continue;
    }
    try {
      const bodyObj: Record<string, any> = { name };
      if (destinationFolderId) bodyObj.parents = [destinationFolderId];
      const copyRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/copy?fields=id,name,webViewLink&supportsAllDrives=true`,
        {
          method: 'POST',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyObj),
        }
      );
      const copyData = await copyRes.json().catch(() => ({}));
      if (!copyRes.ok) {
        results.push({ sourceId: fileId, name, status: 'failed', error: copyData?.error?.message || `Drive copy HTTP ${copyRes.status}` });
        continue;
      }
      results.push({
        sourceId: fileId,
        name: copyData.name || name,
        status: 'transferred',
        destinationFileId: copyData.id,
        webViewLink: copyData.webViewLink || `https://drive.google.com/file/d/${copyData.id}/view`,
      });
    } catch (err: any) {
      results.push({ sourceId: fileId, name, status: 'failed', error: err?.message || 'Drive copy error' });
    }
  }
  res.json({ success: true, results });
});

// =========================================================================
// [WO-052] Video Transcode & Adaptive HTTP Live Streaming (HLS via FFmpeg)
// =========================================================================
const HLS_CACHE_ROOT = path.join(os.tmpdir(), 'drivetherapy-hls-cache');
const hlsJobs = new Map<
  string,
  {
    jobId: string;
    status: 'starting' | 'ready' | 'complete' | 'error';
    outputDir: string;
    error?: string;
    createdAt: number;
  }
>();

app.post('/api/media/hls/start', async (req: Request, res: Response) => {
  const { localPath, driveFileId, maxHeight = 1080 } = req.body || {};
  const authHeader = req.headers.authorization || '';

  let inputSource = '';
  if (typeof localPath === 'string' && localPath.trim()) {
    if (!isLoopbackRequest(req)) {
      res.status(403).json({ error: 'Local file HLS transcode restricted to loopback.' });
      return;
    }
    const resolved = path.resolve(localPath.trim());
    if (!fs.existsSync(resolved)) {
      res.status(404).json({ error: 'Source local video not found.' });
      return;
    }
    inputSource = resolved;
  } else if (typeof driveFileId === 'string' && driveFileId.trim() && authHeader.startsWith('Bearer ')) {
    const cleanId = driveFileId.replace(/^drive_/, '').trim();
    inputSource = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cleanId)}?alt=media`;
  } else {
    res.status(400).json({ error: 'Provide localPath (loopback) or driveFileId with Bearer token.' });
    return;
  }

  const jobId = `hls_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const outputDir = path.join(HLS_CACHE_ROOT, jobId);
  fs.mkdirSync(outputDir, { recursive: true });

  const job = { jobId, status: 'starting' as 'starting' | 'ready' | 'complete' | 'error', outputDir, createdAt: Date.now() };
  hlsJobs.set(jobId, job);

  const safeHeight: 720 | 1080 | 2160 = maxHeight >= 2160 ? 2160 : maxHeight <= 720 ? 720 : 1080;
  const ffmpegArgs = buildFfmpegHlsArgs({ inputSource, outputDir, maxHeight: safeHeight });
  if (inputSource.startsWith('https://') && authHeader.startsWith('Bearer ')) {
    ffmpegArgs.unshift('-headers', `Authorization: ${authHeader}\r\n`);
  }

  try {
    const proc = spawn('ffmpeg', ffmpegArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
    proc.on('error', (err) => {
      job.status = 'error';
      (job as any).error = err.message;
    });
    proc.on('close', (code) => {
      if (code === 0) job.status = 'complete';
      else if (job.status !== 'error') {
        job.status = 'error';
        (job as any).error = `FFmpeg exited with code ${code}`;
      }
    });
  } catch (err: any) {
    job.status = 'error';
    (job as any).error = err?.message || 'Failed to spawn FFmpeg';
  }

  res.json({
    jobId,
    status: job.status,
    playlistUrl: `/api/media/hls/${jobId}/index.m3u8`,
    segmentsCount: 0,
  });
});

app.get('/api/media/hls/:jobId/status', (req: Request, res: Response) => {
  const job = hlsJobs.get(String(req.params.jobId || ''));
  if (!job) {
    res.status(404).json({ error: 'HLS job not found' });
    return;
  }
  const files = fs.existsSync(job.outputDir) ? fs.readdirSync(job.outputDir) : [];
  const segCount = files.filter((f) => f.endsWith('.ts')).length;
  if (job.status === 'starting' && files.includes('index.m3u8') && segCount > 0) {
    job.status = 'ready';
  }
  res.json({
    jobId: job.jobId,
    status: job.status,
    playlistUrl: `/api/media/hls/${job.jobId}/index.m3u8`,
    segmentsCount: segCount,
    error: job.error,
  });
});

app.get('/api/media/hls/:jobId/:fileName', (req: Request, res: Response) => {
  const job = hlsJobs.get(String(req.params.jobId || ''));
  const fileName = String(req.params.fileName || '');
  if (!job || (fileName !== 'index.m3u8' && !/^seg_\d{4}\.ts$/.test(fileName))) {
    res.status(404).json({ error: 'HLS segment not found' });
    return;
  }
  const fullPath = path.join(job.outputDir, fileName);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'Segment not yet ready' });
    return;
  }
  res.setHeader(
    'Content-Type',
    fileName.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t'
  );
  fs.createReadStream(fullPath).pipe(res);
});

// =========================================================================
// [WO-053] Collaborative Multi-User Culling & WebRTC Signaling Relay (SSE)
// =========================================================================
const collabRooms = new Map<string, Set<Response>>();

app.get('/api/collab/rooms/:roomId/events', (req: Request, res: Response) => {
  const roomId = String(req.params.roomId || 'default').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  if (!collabRooms.has(roomId)) collabRooms.set(roomId, new Set());
  const peers = collabRooms.get(roomId)!;
  peers.add(res);

  res.write(`data: ${JSON.stringify({ type: 'room_connected', roomId, peerCount: peers.size })}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepAlive);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    peers.delete(res);
    if (peers.size === 0) collabRooms.delete(roomId);
  });
});

app.post('/api/collab/rooms/:roomId/signal', (req: Request, res: Response) => {
  const roomId = String(req.params.roomId || 'default').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
  const message = req.body || {};
  const peers = collabRooms.get(roomId);
  let delivered = 0;
  if (peers) {
    const serialized = `data: ${JSON.stringify({ ...message, roomId, timestamp: message.timestamp || Date.now() })}\n\n`;
    for (const client of peers) {
      try {
        client.write(serialized);
        delivered++;
      } catch {
        peers.delete(client);
      }
    }
  }
  res.json({ success: true, roomId, delivered });
});

// =========================================================================
// [WO-054] Dedicated Google Workspace Bot Gateway & Webhook Event Mesh
// =========================================================================
const webhookEventLog: Array<{
  id: string;
  direction: 'inbound' | 'outbound';
  source: string;
  eventType: string;
  timestamp: string;
  status: 'ok' | 'rejected' | 'error';
  summary: string;
}> = [];

function recordWebhookEvent(entry: Omit<(typeof webhookEventLog)[number], 'id' | 'timestamp'>) {
  webhookEventLog.unshift({
    id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
  if (webhookEventLog.length > 50) webhookEventLog.length = 50;
}

app.post('/api/webhooks/google-chat', (req: Request, res: Response) => {
  const secret = process.env.GOOGLE_CHAT_WEBHOOK_SECRET || '';
  const sigHeader = String(req.headers['x-drivetherapy-signature'] || '');
  const rawBody = JSON.stringify(req.body || {});

  if (secret) {
    const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    if (sigHeader !== expected) {
      recordWebhookEvent({
        direction: 'inbound',
        source: 'google-chat',
        eventType: String(req.body?.type || 'UNKNOWN'),
        status: 'rejected',
        summary: 'Invalid HMAC signature on Google Chat webhook',
      });
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }
  }

  const eventType = String(req.body?.type || 'MESSAGE').toUpperCase();
  const text = String(req.body?.message?.text || '').trim();
  const actionName = String(req.body?.action?.actionMethodName || '');

  recordWebhookEvent({
    direction: 'inbound',
    source: 'google-chat',
    eventType,
    status: 'ok',
    summary: actionName ? `Card V2 action: ${actionName}` : text.slice(0, 120) || `Event ${eventType}`,
  });

  if (eventType === 'ADDED_TO_SPACE') {
    res.json({
      text: '👋 Drive Therapy Castor Bot connected to this Space! Send a query or receive automated export & culling Card V2 summaries.',
    });
    return;
  }

  if (eventType === 'CARD_CLICKED') {
    res.json({
      actionResponse: { type: 'UPDATE_MESSAGE' },
      text: `✅ Drive Therapy processed interactive Card V2 action: ${actionName || 'confirmed'}`,
    });
    return;
  }

  res.json({
    text: `Castor Bot received: "${text || 'ping'}"`,
    cardsV2: [
      {
        cardId: `dt_bot_${Date.now()}`,
        card: {
          header: {
            title: 'Drive Therapy Workspace Bot',
            subtitle: 'Non-Destructive Media & Studio Gateway',
          },
          sections: [
            {
              widgets: [
                {
                  decoratedText: {
                    topLabel: 'Status',
                    text: 'Online & synchronized with Drive Therapy Event Mesh.',
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  });
});

app.post('/api/webhooks/dispatch', async (req: Request, res: Response) => {
  const { targetUrl, payload, secret } = req.body || {};
  const cleanUrl = String(targetUrl || '').trim();
  let parsed: URL;
  try {
    parsed = new URL(cleanUrl);
    if (parsed.protocol !== 'https:') {
      res.status(400).json({ error: 'Webhook targetUrl must use HTTPS.' });
      return;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.')
    ) {
      res.status(403).json({ error: 'Private/loopback webhook destinations are blocked (SSRF guard).' });
      return;
    }
  } catch {
    res.status(400).json({ error: 'Invalid webhook targetUrl.' });
    return;
  }

  const bodyStr = JSON.stringify(payload || {});
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof secret === 'string' && secret.trim()) {
    headers['X-DriveTherapy-Signature'] = `sha256=${crypto.createHmac('sha256', secret.trim()).update(bodyStr).digest('hex')}`;
  }

  try {
    const outRes = await fetch(cleanUrl, { method: 'POST', headers, body: bodyStr });
    recordWebhookEvent({
      direction: 'outbound',
      source: parsed.hostname,
      eventType: 'DISPATCH',
      status: outRes.ok ? 'ok' : 'error',
      summary: `POST ${parsed.hostname} -> HTTP ${outRes.status}`,
    });
    res.status(outRes.ok ? 200 : 502).json({ success: outRes.ok, status: outRes.status });
  } catch (err: any) {
    recordWebhookEvent({
      direction: 'outbound',
      source: parsed.hostname,
      eventType: 'DISPATCH',
      status: 'error',
      summary: err?.message || 'Dispatch failed',
    });
    res.status(502).json({ success: false, error: err?.message || 'Webhook dispatch failed' });
  }
});

app.get('/api/webhooks/events', (_req: Request, res: Response) => {
  res.json({ events: webhookEventLog });
});

app.get('/api/photos/proxy', async (req: Request, res: Response) => {
  const rawUrl = String(req.query.url || '');
  const token = String(req.query.access_token || '') || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!rawUrl || !/^https:\/\/[a-z0-9.-]*googleusercontent\.com\//i.test(rawUrl)) {
    res.status(400).json({ error: 'Invalid Google Photos media URL' });
    return;
  }
  try {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (req.headers.range) headers.Range = String(req.headers.range);

    const upstream = await fetch(rawUrl, { headers });
    res.status(upstream.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control']) {
      const val = upstream.headers.get(h);
      if (val) res.setHeader(h, val);
    }
    if (!upstream.body) {
      res.end();
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Photos media proxy error' });
  }
});

// -----------------------------------------------------------------------------
// Loopback-Only Non-Destructive FFmpeg Video & GIF Editing Endpoints
// -----------------------------------------------------------------------------

function resolveSafeNonDestructiveCopyPath(inputPath: string, suffix: string, overrideExt?: string): string {
  const parsed = path.parse(inputPath);
  const ext = overrideExt ? (overrideExt.startsWith('.') ? overrideExt : `.${overrideExt}`) : parsed.ext || '.mp4';
  let candidate = path.join(parsed.dir, `${parsed.name}${suffix}${ext}`);
  let counter = 2;
  while (fs.existsSync(candidate) && counter < 100) {
    candidate = path.join(parsed.dir, `${parsed.name}${suffix}_${counter}${ext}`);
    counter++;
  }
  return candidate;
}

app.post('/api/media/video-edit', (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Loopback access only' });
    return;
  }
  const { inputPath, recipe } = req.body || {};
  if (typeof inputPath !== 'string' || !inputPath.trim() || !fs.existsSync(inputPath)) {
    res.status(400).json({ error: 'Valid local inputPath is required' });
    return;
  }
  if (!recipe || typeof recipe.startTime !== 'number' || typeof recipe.endTime !== 'number') {
    res.status(400).json({ error: 'Valid video edit recipe is required' });
    return;
  }

  const outputPath = resolveSafeNonDestructiveCopyPath(
    inputPath,
    recipe.extractAudioOnly ? '_audio' : '_edited',
    recipe.extractAudioOnly ? '.mp3' : undefined
  );

  const { args, isLosslessCopy } = generateVideoEditFfmpegArgs(inputPath, outputPath, recipe);
  execFile('ffmpeg', args, { timeout: 120000 }, (err, _stdout, stderr) => {
    if (err) {
      res.status(500).json({
        error: `FFmpeg execution failed: ${err.message}`,
        stderr: String(stderr || '').slice(-400),
      });
      return;
    }
    const stat = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;
    res.json({
      success: true,
      outputPath,
      fileName: path.basename(outputPath),
      sizeBytes: stat?.size || 0,
      isLosslessCopy,
    });
  });
});

app.post('/api/media/gif', (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Loopback access only' });
    return;
  }
  const { inputPath, recipe } = req.body || {};
  if (typeof inputPath !== 'string' || !inputPath.trim() || !fs.existsSync(inputPath)) {
    res.status(400).json({ error: 'Valid local inputPath is required' });
    return;
  }
  if (!recipe || typeof recipe.startTime !== 'number' || typeof recipe.endTime !== 'number') {
    res.status(400).json({ error: 'Valid GIF edit recipe is required' });
    return;
  }

  const outputPath = resolveSafeNonDestructiveCopyPath(inputPath, '_edited', '.gif');
  const args = generateGifFfmpegArgs(inputPath, outputPath, recipe);
  execFile('ffmpeg', args, { timeout: 120000 }, (err, _stdout, stderr) => {
    if (err) {
      res.status(500).json({
        error: `FFmpeg GIF execution failed: ${err.message}`,
        stderr: String(stderr || '').slice(-400),
      });
      return;
    }
    const stat = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;
    res.json({
      success: true,
      outputPath,
      fileName: path.basename(outputPath),
      sizeBytes: stat?.size || 0,
      streamUrl: `/api/fs/stream?path=${encodeURIComponent(outputPath)}`,
    });
  });
});

// -----------------------------------------------------------------------------
// Google Ecosystem APIs: Gmail Harvester, Google Tasks & Google Contacts
// -----------------------------------------------------------------------------

app.get('/api/gmail/attachments', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  try {
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=has:attachment&maxResults=20',
      { headers: { Authorization: authHeader } }
    );
    const listData = await listRes.json().catch(() => ({}));
    if (!listRes.ok) {
      res.status(listRes.status).json({ error: listData?.error?.message || 'Gmail list failed' });
      return;
    }

    const msgIds: string[] = Array.isArray(listData.messages)
      ? listData.messages.map((m: any) => m.id).slice(0, 15)
      : [];

    const attachments: any[] = [];
    await Promise.all(
      msgIds.map(async (msgId) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(msgId)}?format=full`,
          { headers: { Authorization: authHeader } }
        ).catch(() => null);
        if (!msgRes || !msgRes.ok) return;
        const msg = await msgRes.json().catch(() => ({}));
        const headers: Array<{ name: string; value: string }> = msg.payload?.headers || [];
        const getHeader = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || '';
        const subject = getHeader('Subject') || '(No subject)';
        const from = getHeader('From');
        const date = getHeader('Date') || new Date(Number(msg.internalDate || Date.now())).toISOString();

        const walkParts = (parts: any[]) => {
          for (const part of parts) {
            if (part.filename && part.body?.attachmentId) {
              attachments.push({
                messageId: msgId,
                attachmentId: part.body.attachmentId,
                filename: part.filename,
                mimeType: part.mimeType || 'application/octet-stream',
                sizeBytes: Number(part.body.size || 0),
                subject,
                from,
                date,
              });
            }
            if (Array.isArray(part.parts)) walkParts(part.parts);
          }
        };
        if (Array.isArray(msg.payload?.parts)) walkParts(msg.payload.parts);
      })
    );

    res.json({ attachments });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Gmail attachment harvest failed' });
  }
});

app.get('/api/gmail/attachment/:messageId/:attachmentId', async (req: Request, res: Response) => {
  const token =
    String(req.query.access_token || '') || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ error: 'Missing access token' });
    return;
  }
  const { messageId, attachmentId } = req.params;
  const mimeType = String(req.query.mimeType || 'application/octet-stream');
  try {
    const gRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await gRes.json().catch(() => ({}));
    if (!gRes.ok || !data.data) {
      res.status(gRes.status || 404).json({ error: data?.error?.message || 'Attachment not found' });
      return;
    }
    const b64 = String(data.data).replace(/-/g, '+').replace(/_/g, '/');
    const buf = Buffer.from(b64, 'base64');
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', String(buf.length));
    res.send(buf);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Attachment proxy failed' });
  }
});

app.post('/api/gmail/send', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  const { to, subject, body } = req.body || {};
  if (!to || !subject) {
    res.status(400).json({ error: 'Recipient (to) and subject are required' });
    return;
  }
  const rawEmail = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset=utf-8', '', String(body || '')].join('\r\n');
  const encoded = Buffer.from(rawEmail).toString('base64url');
  try {
    const gRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: encoded }),
    });
    const data = await gRes.json().catch(() => ({}));
    if (!gRes.ok) {
      res.status(gRes.status).json({ error: data?.error?.message || 'Gmail send failed' });
      return;
    }
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Gmail send error' });
  }
});

app.get('/api/tasks', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  try {
    const gRes = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=true&maxResults=100', {
      headers: { Authorization: authHeader },
    });
    const data = await gRes.json().catch(() => ({}));
    if (!gRes.ok) {
      res.status(gRes.status).json({ error: data?.error?.message || 'Google Tasks fetch failed' });
      return;
    }
    res.json({ items: data.items || [] });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Google Tasks error' });
  }
});

app.post('/api/tasks', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  const { title, notes } = req.body || {};
  if (!title || typeof title !== 'string') {
    res.status(400).json({ error: 'Task title is required' });
    return;
  }
  try {
    const gRes = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), notes: notes || undefined }),
    });
    const data = await gRes.json().catch(() => ({}));
    if (!gRes.ok) {
      res.status(gRes.status).json({ error: data?.error?.message || 'Create Google Task failed' });
      return;
    }
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Create task error' });
  }
});

app.patch('/api/tasks/:taskId', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  const taskId = String(req.params.taskId || '');
  const { status } = req.body || {};
  try {
    const gRes = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${encodeURIComponent(taskId)}`,
      {
        method: 'PATCH',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status === 'completed' ? 'completed' : 'needsAction' }),
      }
    );
    const data = await gRes.json().catch(() => ({}));
    if (!gRes.ok) {
      res.status(gRes.status).json({ error: data?.error?.message || 'Update Google Task failed' });
      return;
    }
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Update task error' });
  }
});

app.get('/api/contacts', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  try {
    const gRes = await fetch(
      'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,photos&pageSize=200',
      { headers: { Authorization: authHeader } }
    );
    const data = await gRes.json().catch(() => ({}));
    if (!gRes.ok) {
      res.status(gRes.status).json({ error: data?.error?.message || 'Google Contacts fetch failed' });
      return;
    }
    const contacts = (data.connections || [])
      .map((p: any) => ({
        resourceName: p.resourceName,
        name: p.names?.[0]?.displayName || p.emailAddresses?.[0]?.value || 'Contact',
        email: p.emailAddresses?.[0]?.value || '',
        photoUrl: p.photos?.[0]?.url,
      }))
      .filter((c: any) => Boolean(c.email));
    res.json({ contacts });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Google Contacts error' });
  }
});

app.get('/api/classroom/courses', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  try {
    const gRes = await fetch('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=50', {
      headers: { Authorization: authHeader },
    });
    const data = await gRes.json().catch(() => ({}));
    if (!gRes.ok) {
      res.status(gRes.status).json({ error: data?.error?.message || 'Google Classroom fetch failed' });
      return;
    }
    res.json({ courses: data.courses || [] });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Google Classroom error' });
  }
});

app.get('/api/classroom/materials/:courseId', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  const courseId = String(req.params.courseId || '');
  try {
    const [matRes, cwRes] = await Promise.all([
      fetch(`https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/courseWorkMaterials?pageSize=50`, {
        headers: { Authorization: authHeader },
      }).catch(() => null),
      fetch(`https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/courseWork?pageSize=50`, {
        headers: { Authorization: authHeader },
      }).catch(() => null),
    ]);
    const matData = matRes && matRes.ok ? await matRes.json().catch(() => ({})) : {};
    const cwData = cwRes && cwRes.ok ? await cwRes.json().catch(() => ({})) : {};
    res.json({
      courseWorkMaterial: matData.courseWorkMaterial || [],
      courseWork: cwData.courseWork || [],
    });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Classroom materials error' });
  }
});

app.get('/api/gcs/buckets', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  const project = String(req.query.project || '585563903166');
  try {
    const gRes = await fetch(`https://storage.googleapis.com/storage/v1/b?project=${encodeURIComponent(project)}`, {
      headers: { Authorization: authHeader },
    });
    const data = await gRes.json().catch(() => ({}));
    if (!gRes.ok) {
      res.status(gRes.status).json({ error: data?.error?.message || 'GCS bucket list failed' });
      return;
    }
    res.json({ items: data.items || [] });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'GCS list error' });
  }
});

app.get('/api/gcs/objects/:bucket', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer access token' });
    return;
  }
  const bucket = String(req.params.bucket || '');
  try {
    const gRes = await fetch(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?maxResults=100`, {
      headers: { Authorization: authHeader },
    });
    const data = await gRes.json().catch(() => ({}));
    if (!gRes.ok) {
      res.status(gRes.status).json({ error: data?.error?.message || 'GCS objects list failed' });
      return;
    }
    res.json({ items: data.items || [] });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'GCS objects error' });
  }
});

// Authenticated Byte-Range Proxy for Private Google Cloud Storage (GCS) Objects
app.get('/api/gcs/stream/:bucket/*', async (req: Request, res: Response) => {
  const bucket = String(req.params.bucket || '');
  const objectName = String((req.params as Record<string, string>)[0] || '');
  const tokenParam = typeof req.query.token === 'string' ? req.query.token : '';
  const authHeader = req.headers.authorization || (tokenParam ? `Bearer ${tokenParam}` : '');
  if (!authHeader.startsWith('Bearer ') || !bucket || !objectName) {
    res.status(401).json({ error: 'Missing Bearer access token or GCS object coordinates' });
    return;
  }
  try {
    const forwardHeaders: Record<string, string> = { Authorization: authHeader };
    if (req.headers.range) {
      forwardHeaders.Range = String(req.headers.range);
    }
    const gcsUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`;
    const upstream = await fetch(gcsUrl, { headers: forwardHeaders });
    if (!upstream.ok && upstream.status !== 206) {
      res.status(upstream.status).json({ error: `GCS stream failed (${upstream.status})` });
      return;
    }
    res.status(upstream.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag']) {
      const val = upstream.headers.get(h);
      if (val) res.setHeader(h, val);
    }
    if (!upstream.body) {
      res.end();
      return;
    }
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
    res.end();
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'GCS stream proxy error' });
  }
});

// Google Workspace AI Assist (Gemini + Zero-Key Offline Fallback)
app.post('/api/gemini/workspace-assist', async (req: Request, res: Response) => {
  const { action, text, subject, courseName } = req.body || {};
  const rawText = typeof text === 'string' ? text.trim() : '';
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

  const offlineFallback = () => {
    if (action === 'note_to_tasks') {
      const lines = rawText
        .split(/\r?\n|[.;]+/)
        .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
        .filter((l) => l.length > 2)
        .slice(0, 6);
      return { tasks: lines.length > 0 ? lines : ['Review Keep note deliverables'], mode: 'offline' };
    }
    if (action === 'draft_gmail') {
      const cleanSubj = typeof subject === 'string' && subject.trim() ? subject.trim() : 'Project Update';
      return {
        draft: `Hi,\n\nFollowing up regarding "${cleanSubj}":\n${rawText || 'Please find the latest media deliverables and status notes attached.'}\n\nBest regards,`,
        mode: 'offline',
      };
    }
    const label = typeof courseName === 'string' && courseName.trim() ? courseName.trim() : 'Course';
    return {
      brief: `# ${label} — Study Brief\n\n- Key Materials Indexed: ${rawText || 'Drive attachments ready in catalog'}\n- Recommended Next Step: Tag hero frames and export NotebookLM dossier.`,
      mode: 'offline',
    };
  };

  if (!apiKey) {
    res.json(offlineFallback());
    return;
  }

  try {
    let prompt = '';
    if (action === 'note_to_tasks') {
      prompt = `Extract up to 5 concise actionable task titles (one per line, no bullets) from this note:\n\n${rawText}`;
    } else if (action === 'draft_gmail') {
      prompt = `Draft a concise professional email body for subject "${subject || 'Update'}" using these notes:\n\n${rawText}`;
    } else {
      prompt = `Summarize these Google Classroom materials for "${courseName || 'Course'}" into a concise markdown study brief:\n\n${rawText}`;
    }
    const gRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await gRes.json().catch(() => ({}));
    const outText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!gRes.ok || !outText) {
      res.json(offlineFallback());
      return;
    }
    if (action === 'note_to_tasks') {
      const tasks = outText.split(/\r?\n/).map((s: string) => s.replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean).slice(0, 6);
      res.json({ tasks, mode: 'gemini' });
      return;
    }
    if (action === 'draft_gmail') {
      res.json({ draft: outText, mode: 'gemini' });
      return;
    }
    res.json({ brief: outText, mode: 'gemini' });
  } catch {
    res.json(offlineFallback());
  }
});

// Loopback-Only Google Takeout Host Disk Scanner (Multi-GB Photos & Sidecars without Browser RAM overhead)
app.post('/api/takeout/scan-folder', async (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Takeout folder scan is restricted to loopback requests.' });
    return;
  }
  const folderPath = typeof req.body?.folderPath === 'string' ? path.resolve(req.body.folderPath.trim()) : '';
  if (!folderPath || !fs.existsSync(folderPath)) {
    res.status(400).json({ error: 'Valid local Takeout folder path is required.' });
    return;
  }

  try {
    const mediaExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.dng', '.raw', '.cr3', '.nef', '.mp4', '.mov', '.mkv', '.webm']);
    const sidecars = new Map<string, any>();
    const mediaPaths: Array<{ fullPath: string; name: string; ext: string; sizeBytes: number; mtimeMs: number }> = [];

    const walk = (dir: string, depth = 0) => {
      if (depth > 8 || mediaPaths.length >= 5000) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full, depth + 1);
        } else if (entry.isFile()) {
          const lower = entry.name.toLowerCase();
          if (lower.endsWith('.json')) {
            try {
              const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
              sidecars.set(lower.replace(/\.json$/i, ''), parsed);
            } catch {}
          } else {
            const ext = path.extname(lower);
            if (mediaExts.has(ext)) {
              const st = fs.statSync(full);
              mediaPaths.push({
                fullPath: full,
                name: entry.name,
                ext: ext.slice(1).toUpperCase(),
                sizeBytes: st.size,
                mtimeMs: st.mtimeMs,
              });
            }
          }
        }
      }
    };
    walk(folderPath);

    const items = mediaPaths.map((m, idx) => {
      const lower = m.name.toLowerCase();
      const base = lower.replace(/\.[^.]+$/, '');
      const sidecar =
        sidecars.get(lower) ||
        sidecars.get(`${lower}.supplemental-metadata`) ||
        sidecars.get(base) ||
        sidecars.get(`${base}.supplemental-metadata`);
      const isVideo = ['MP4', 'MOV', 'MKV', 'WEBM'].includes(m.ext);
      const streamUrl = `/api/fs/stream?path=${encodeURIComponent(m.fullPath)}`;
      const takenIso = sidecar?.photoTakenTime?.timestamp
        ? new Date(Number(sidecar.photoTakenTime.timestamp) * 1000).toISOString()
        : new Date(m.mtimeMs).toISOString();
      return {
        id: `takeout_disk_${idx}_${Buffer.from(m.fullPath).toString('base64url').slice(0, 16)}`,
        name: m.name,
        source: 'photos',
        category: isVideo ? 'video' : 'image',
        mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
        extension: m.ext,
        path: m.fullPath,
        localPath: m.fullPath,
        sizeBytes: m.sizeBytes,
        modifiedTime: takenIso,
        cloudUrl: streamUrl,
        thumbnailUrl: isVideo ? '' : streamUrl,
        isCached: true,
        cullingStatus: 'unrated',
        rating: 0,
        tags: ['Google Photos', 'Takeout Disk'],
        faces: Array.isArray(sidecar?.people) ? sidecar.people.map((p: any) => p?.name).filter(Boolean) : [],
        quality: { sharpness: 90, exposure: 90, overall: 90, isBlurry: false },
        palette: [],
        exif: sidecar?.geoData?.latitude
          ? { gps: { lat: Number(sidecar.geoData.latitude), lng: Number(sidecar.geoData.longitude) } }
          : {},
      };
    });

    res.json({ items, totalScanned: items.length, sidecarsMatched: sidecars.size });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Takeout disk scan failed' });
  }
});

// Loopback-Only Pollux / Takeout Archive Localhost Exporter
app.post('/api/takeout/save-archive', (req: Request, res: Response) => {
  if (!isLoopbackRequest(req)) {
    res.status(403).json({ error: 'Saving Takeout/Pollux archives to localhost is restricted to loopback requests.' });
    return;
  }
  const rawName = typeof req.body?.filename === 'string' ? req.body.filename : `pollux_archive_${Date.now()}.jsonl`;
  const safeName = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const content = typeof req.body?.content === 'string' ? req.body.content : '';
  if (!content) {
    res.status(400).json({ error: 'Archive content is required.' });
    return;
  }

  try {
    const outDir = path.join(os.homedir(), 'Documents', 'DriveTherapy-Exports');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, safeName);
    fs.writeFileSync(outPath, content, 'utf8');
    res.json({ success: true, path: outPath, bytes: Buffer.byteLength(content, 'utf8') });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save archive to localhost' });
  }
});

startServer();
