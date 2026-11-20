/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-104] Server-Side AES-256-GCM Encrypted Session Vault & Security Primitives
 * Keeps OAuth & external cloud bearer tokens out of browser localStorage by
 * binding them to an HttpOnly, SameSite=Lax session cookie (dt_sid).
 */

import crypto from 'node:crypto';
import type { Request, Response } from 'express';

export const SESSION_COOKIE_NAME = 'dt_sid';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Ephemeral per-process 256-bit key (never written to disk, rotated on restart)
const VAULT_KEY = crypto.randomBytes(32);

interface EncryptedBlob {
  iv: string;
  tag: string;
  ciphertext: string;
}

interface SessionRecord {
  createdAt: number;
  lastAccessAt: number;
  externalClouds: Map<string, EncryptedBlob>;
  googleAccounts: Map<string, EncryptedBlob>;
  activeGoogleEmail?: string;
}

const sessionStore = new Map<string, SessionRecord>();

export function encryptSecret(plaintext: string): EncryptedBlob {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', VAULT_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
}

export function decryptSecret(blob: EncryptedBlob): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    VAULT_KEY,
    Buffer.from(blob.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key) result[key] = decodeURIComponent(val);
  }
  return result;
}

export function getOrCreateSessionId(req: Request, res: Response): string {
  const cookies = parseCookieHeader(req.headers.cookie);
  const existing = cookies[SESSION_COOKIE_NAME];
  if (existing && /^[a-f0-9]{48}$/.test(existing) && sessionStore.has(existing)) {
    const rec = sessionStore.get(existing)!;
    rec.lastAccessAt = Date.now();
    return existing;
  }

  const sid = crypto.randomBytes(24).toString('hex');
  sessionStore.set(sid, {
    createdAt: Date.now(),
    lastAccessAt: Date.now(),
    externalClouds: new Map(),
    googleAccounts: new Map(),
  });

  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${sid}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isHttps) cookieParts.push('Secure');
  res.append('Set-Cookie', cookieParts.join('; '));
  return sid;
}

export function getExistingSessionId(req: Request): string | null {
  const cookies = parseCookieHeader(req.headers.cookie);
  const existing = cookies[SESSION_COOKIE_NAME];
  if (existing && /^[a-f0-9]{48}$/.test(existing) && sessionStore.has(existing)) {
    return existing;
  }
  return null;
}

export function setExternalCloudSecret(
  sid: string,
  providerId: string,
  secretPayload: { accessToken?: string; username?: string; secretKey?: string; endpointUrl?: string }
): void {
  const rec = sessionStore.get(sid);
  if (!rec) return;
  rec.lastAccessAt = Date.now();
  rec.externalClouds.set(providerId, encryptSecret(JSON.stringify(secretPayload)));
}

export function getExternalCloudSecret(
  sid: string | null,
  providerId: string
): { accessToken?: string; username?: string; secretKey?: string; endpointUrl?: string } | null {
  if (!sid) return null;
  const rec = sessionStore.get(sid);
  if (!rec) return null;
  const blob = rec.externalClouds.get(providerId);
  if (!blob) return null;
  try {
    return JSON.parse(decryptSecret(blob));
  } catch {
    return null;
  }
}

export function clearExternalCloudSecret(sid: string | null, providerId: string): void {
  if (!sid) return;
  const rec = sessionStore.get(sid);
  if (!rec) return;
  rec.externalClouds.delete(providerId);
}

/**
 * [WO-111] Destroy a caller's entire server-side encrypted session vault and expire dt_sid cookie.
 */
export function destroySession(req: Request, res: Response): boolean {
  const sid = getExistingSessionId(req);
  let existed = false;
  if (sid) {
    existed = sessionStore.delete(sid);
  }
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=0',
  ];
  if (isHttps) cookieParts.push('Secure');
  res.append('Set-Cookie', cookieParts.join('; '));
  return existed;
}

export function setGoogleAccountToken(
  sid: string,
  email: string,
  tokenData: { accessToken: string; refreshToken?: string; expiresAt?: number }
): void {
  const rec = sessionStore.get(sid);
  if (!rec || !email) return;
  const key = email.trim().toLowerCase();
  rec.lastAccessAt = Date.now();
  rec.googleAccounts.set(key, encryptSecret(JSON.stringify(tokenData)));
  rec.activeGoogleEmail = key;
}

export function getGoogleAccountToken(
  sid: string | null,
  email?: string
): { accessToken: string; refreshToken?: string; expiresAt?: number } | null {
  if (!sid) return null;
  const rec = sessionStore.get(sid);
  if (!rec) return null;
  const key = (email || rec.activeGoogleEmail || '').trim().toLowerCase();
  if (!key) return null;
  const blob = rec.googleAccounts.get(key);
  if (!blob) return null;
  try {
    return JSON.parse(decryptSecret(blob));
  } catch {
    return null;
  }
}

export function removeGoogleAccountToken(sid: string | null, email: string): void {
  if (!sid || !email) return;
  const rec = sessionStore.get(sid);
  if (!rec) return;
  const key = email.trim().toLowerCase();
  rec.googleAccounts.delete(key);
  if (rec.activeGoogleEmail === key) {
    rec.activeGoogleEmail = rec.googleAccounts.keys().next().value;
  }
}

export function listGoogleAccountEmails(sid: string | null): string[] {
  if (!sid) return [];
  const rec = sessionStore.get(sid);
  if (!rec) return [];
  return Array.from(rec.googleAccounts.keys());
}

export function getActiveGoogleEmail(sid: string | null): string | null {
  if (!sid) return null;
  const rec = sessionStore.get(sid);
  return rec?.activeGoogleEmail || null;
}

export function setActiveGoogleAccount(sid: string | null, email: string): boolean {
  if (!sid || !email) return false;
  const rec = sessionStore.get(sid);
  if (!rec) return false;
  const key = email.trim().toLowerCase();
  if (!rec.googleAccounts.has(key)) return false;
  rec.activeGoogleEmail = key;
  rec.lastAccessAt = Date.now();
  return true;
}

export function clearAllGoogleAccountTokens(sid: string | null): number {
  if (!sid) return 0;
  const rec = sessionStore.get(sid);
  if (!rec) return 0;
  const count = rec.googleAccounts.size;
  rec.googleAccounts.clear();
  rec.activeGoogleEmail = undefined;
  return count;
}

export function buildHardenedCspHeader(): string {
  return [
    "default-src 'self' https: data: blob:",
    "script-src 'self' 'wasm-unsafe-eval' https:",
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "connect-src 'self' https: ws: wss:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
  ].join('; ') + ';';
}

export function createIpRateLimiter(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  const check = (ip: string): boolean => {
    const now = Date.now();
    const rec = buckets.get(ip);
    if (!rec || now > rec.resetAt) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (rec.count >= maxRequests) return false;
    rec.count += 1;
    return true;
  };

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets.entries()) {
      if (now > v.resetAt) buckets.delete(k);
    }
  }, Math.max(60_000, windowMs));
  cleanup.unref();

  return { check };
}

export function pruneExpiredSessions(): void {
  const now = Date.now();
  for (const [sid, rec] of sessionStore.entries()) {
    if (now - rec.lastAccessAt > SESSION_TTL_MS) {
      sessionStore.delete(sid);
    }
  }
}

const sessionPruneTimer = setInterval(pruneExpiredSessions, 15 * 60 * 1000);
sessionPruneTimer.unref();
