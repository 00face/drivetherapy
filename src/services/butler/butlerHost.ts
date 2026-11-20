/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Butler Host: Server-Side Concierge & Service Mesh Gateway
 * Mounts at `/api/butler/*` to manage Google Workspace, Drive, and isolated OAuth.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { ButlerServiceId, BUTLER_SERVICE_SCOPES } from './types';

export interface ButlerHostContext {
  getClientId: () => string | null;
  getClientSecret: () => string | null;
  getBaseAppUrl: (req: Request) => string;
  pendingOAuthStates: Map<string, { codeVerifier: string; createdAt: number }>;
  getActivePort: () => number;
  getAliasPorts: () => number[];
  clientId?: string;
}

export function createButlerHostRouter(ctx: ButlerHostContext): Router {
  const router = Router();

  // 1. Butler Master Health & Service Telemetry
  router.get('/health', (_req: Request, res: Response) => {
    const activePort = ctx.getActivePort();
    const aliasPorts = ctx.getAliasPorts();
    const clientId = ctx.getClientId();

    res.json({
      status: 'online',
      service: 'butler_concierge',
      port: activePort,
      aliasPorts,
      pid: process.pid,
      mode: process.env.NODE_ENV || 'development',
      hasGoogleOAuth: Boolean(clientId),
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      serviceMatrix: {
        drive: 'operational',
        workspace: 'operational',
        music: 'operational',
        gemini: process.env.GEMINI_API_KEY ? 'operational' : 'byok_fallback',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Butler OAuth Configuration Check & Supported Service Scopes
  router.get('/auth/config', (req: Request, res: Response) => {
    const clientId = ctx.getClientId();
    const baseAppUrl = ctx.getBaseAppUrl(req);

    res.json({
      hasDirectOAuth: Boolean(clientId),
      clientId,
      redirectUri: `${baseAppUrl}/api/auth/google/callback`,
      services: BUTLER_SERVICE_SCOPES,
    });
  });

  // 3. Butler Isolated Service Authorization URL Generator
  router.get('/auth/url', (req: Request, res: Response) => {
    const clientId = ctx.getClientId();
    const baseAppUrl = ctx.getBaseAppUrl(req);
    const redirectUri = `${baseAppUrl}/api/auth/google/callback`;

    const serviceKey = (req.query.service as string) || 'drive';
    const targetService = (serviceKey in BUTLER_SERVICE_SCOPES
      ? serviceKey
      : 'drive') as ButlerServiceId;

    const requestedScopes = BUTLER_SERVICE_SCOPES[targetService];
    const scopesStr = requestedScopes.join(' ');

    const state = crypto.randomBytes(32).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    ctx.pendingOAuthStates.set(state, {
      codeVerifier,
      createdAt: Date.now(),
    });

    const params = new URLSearchParams({
      client_id: clientId || 'butler_direct_oauth_configured',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopesStr,
      access_type: 'offline',
      prompt: 'select_account consent',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    res.json({
      authUrl,
      service: targetService,
      state,
      redirectUri,
      scopes: requestedScopes,
      hasDirectConfig: Boolean(clientId),
    });
  });

  // 4. Butler Active Session Inspector
  router.get('/auth/session', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    const cookies = (req.headers.cookie || '').split(';').reduce<Record<string, string>>((acc, pair) => {
      const [k, v] = pair.trim().split('=');
      if (k && v) acc[k] = decodeURIComponent(v);
      return acc;
    }, {});

    const hasRefreshToken = Boolean(cookies['dt_rt']);

    res.json({
      authenticated: Boolean(bearer),
      hasRefreshToken,
      tokenType: bearer ? 'Bearer' : null,
      serverTime: Date.now(),
    });
  });

  // 5. Butler Storage Quota & Drive Account Telemetry
  router.get('/drive/quota', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const queryToken = typeof req.query.access_token === 'string' ? req.query.access_token : '';
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : queryToken.trim();

    if (!bearer) {
      res.status(401).json({ error: 'Missing Authorization Bearer token' });
      return;
    }

    try {
      const resp = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota,user', {
        headers: { Authorization: `Bearer ${bearer}` },
      });

      if (!resp.ok) {
        res.status(resp.status).json({ error: 'Failed to fetch storage quota from Google Drive API' });
        return;
      }

      const data = await resp.json();
      const quota = data.storageQuota || {};
      const usage = parseInt(quota.usage || '0', 10) || 0;
      const limit = parseInt(quota.limit || '0', 10) || 0;
      const percentage = limit > 0 ? Math.min(100, Math.round((usage / limit) * 100)) : 0;

      res.json({
        user: data.user || null,
        quota: {
          usage,
          limit,
          percentage,
          usageFormatted: `${(usage / (1024 * 1024 * 1024)).toFixed(2)} GB`,
          limitFormatted: limit > 0 ? `${(limit / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Unlimited',
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Drive quota request failed' });
    }
  });

  // 6. Butler Managed Drive Media Stream Proxy (HTTP 206 Byte-Range)
  router.get('/drive/stream/:fileId', async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params;
      const queryToken = typeof req.query.access_token === 'string' ? req.query.access_token : '';
      const authHeader = req.headers.authorization || (queryToken ? `Bearer ${queryToken}` : '');

      if (!authHeader) {
        res.status(401).json({ error: 'Missing Authorization header or access_token' });
        return;
      }

      const driveUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
      const fetchHeaders: Record<string, string> = { Authorization: authHeader };
      if (req.headers.range) {
        fetchHeaders['Range'] = req.headers.range as string;
      }

      const upstreamRes = await fetch(driveUrl, { headers: fetchHeaders });
      res.status(upstreamRes.status);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'private, no-store');

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
      res.status(500).json({ error: err.message || 'Butler stream proxy failed' });
    }
  });

  // 7. Butler Workspace Status & Comms Actions
  router.get('/workspace/status', (_req: Request, res: Response) => {
    res.json({
      channels: {
        chat: { name: 'Google Chat', type: 'cards_v2', enabled: true },
        meet: { name: 'Google Meet', quickUrl: 'https://meet.google.com/new', enabled: true },
        calendar: { name: 'Google Calendar', type: 'compact_iso', enabled: true },
        voice: { name: 'Google Voice', protocols: ['callto:', 'sms:'], enabled: true },
      },
      ready: true,
    });
  });

  return router;
}
