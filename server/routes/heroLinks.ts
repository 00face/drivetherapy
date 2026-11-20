/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-116 / WO-117] Microsoft-Style Persistent Hero Links & Unified DLP Express Router
 * Guarantees ONE canonical persistent /s/:slug URL per file/folder.
 * Updating permissions, sensitivity, external guests, or expiration applies immediately
 * to the existing URL without ever generating conflicting duplicate links.
 * Includes mode-0600 atomic disk persistence, reload, revocation (DELETE), and input guards.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import {
  DEFAULT_UNIFIED_DLP_POLICY,
  evaluateDlpSharePolicy,
  type HeroLinkRecord,
  type SensitivityLabel,
  type ShareAudience,
  type ShareRole,
} from '../../src/services/enterpriseSharingEngine';
import { hasPrototypePollutionKeys } from '../security/accessPolicy';

const VALID_AUDIENCES = new Set<ShareAudience>(['private', 'internal-domain', 'named-external', 'public-anyone']);
const VALID_ROLES = new Set<ShareRole>(['viewer', 'commenter', 'editor']);
const VALID_SENSITIVITIES = new Set<SensitivityLabel>(['public', 'internal', 'confidential', 'restricted']);

const heroLinksBySlug = new Map<string, HeroLinkRecord>();
const slugByAssetId = new Map<string, string>();

let heroLinksStorePath = path.resolve(process.cwd(), '.hero-links-store.json');
let initializedFromDisk = false;

function ensureInitialized(): void {
  if (initializedFromDisk) return;
  initializedFromDisk = true;
  reloadHeroLinksFromDisk();
}

export function configureHeroLinksStorePath(customPath: string): void {
  heroLinksStorePath = path.resolve(customPath);
  initializedFromDisk = true;
  reloadHeroLinksFromDisk();
}

export function reloadHeroLinksFromDisk(): number {
  heroLinksBySlug.clear();
  slugByAssetId.clear();
  try {
    if (!fs.existsSync(heroLinksStorePath)) return 0;
    const raw = fs.readFileSync(heroLinksStorePath, 'utf8');
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed?.links) ? parsed.links : [];
    for (const item of items) {
      if (item && typeof item.slug === 'string' && typeof item.assetId === 'string') {
        heroLinksBySlug.set(item.slug, item as HeroLinkRecord);
        slugByAssetId.set(item.assetId, item.slug);
      }
    }
    return heroLinksBySlug.size;
  } catch {
    return 0;
  }
}

function persistHeroLinksToDisk(): void {
  try {
    const dir = path.dirname(heroLinksStorePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${heroLinksStorePath}.tmp.${process.pid}`;
    const payload = JSON.stringify(
      {
        version: 1,
        updatedAt: new Date().toISOString(),
        links: Array.from(heroLinksBySlug.values()),
      },
      null,
      2
    );
    fs.writeFileSync(tmpPath, payload, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmpPath, heroLinksStorePath);
  } catch {
    // Non-fatal in read-only environments; in-memory state remains authoritative
  }
}

function normalizeAudience(val: unknown): ShareAudience {
  const s = typeof val === 'string' ? (val.trim() as ShareAudience) : 'internal-domain';
  return VALID_AUDIENCES.has(s) ? s : 'internal-domain';
}

function normalizeRole(val: unknown): ShareRole {
  const s = typeof val === 'string' ? (val.trim() as ShareRole) : 'viewer';
  return VALID_ROLES.has(s) ? s : 'viewer';
}

function normalizeSensitivity(val: unknown): SensitivityLabel {
  const s = typeof val === 'string' ? (val.trim() as SensitivityLabel) : 'internal';
  return VALID_SENSITIVITIES.has(s) ? s : 'internal';
}

function sanitizeGuests(guests: unknown): string[] {
  if (!Array.isArray(guests)) return [];
  return guests
    .map((g) => (typeof g === 'string' ? g.trim().slice(0, 254) : ''))
    .filter(Boolean)
    .slice(0, 200);
}

export function createOrGetHeroLink(input: {
  assetId: string;
  assetName: string;
  isFolder?: boolean;
  audience?: ShareAudience;
  role?: ShareRole;
  sensitivityLabel?: SensitivityLabel;
  limitedAccess?: boolean;
  editorsCanShare?: boolean;
  viewersCanDownload?: boolean;
  externalGuests?: string[];
  expiresAt?: string | null;
}): { link?: HeroLinkRecord; error?: string; dlpBlocked?: boolean } {
  ensureInitialized();

  const cleanAssetId = typeof input?.assetId === 'string' ? input.assetId.trim().slice(0, 512) : '';
  const cleanAssetName = typeof input?.assetName === 'string' ? input.assetName.trim().slice(0, 512) : '';
  if (!cleanAssetId || !cleanAssetName) {
    return { error: 'assetId and assetName are required.' };
  }

  const existingSlug = slugByAssetId.get(cleanAssetId);
  if (existingSlug && heroLinksBySlug.has(existingSlug)) {
    return { link: heroLinksBySlug.get(existingSlug)! };
  }

  const audience = normalizeAudience(input.audience);
  const sensitivityLabel = normalizeSensitivity(input.sensitivityLabel);
  const limitedAccess = Boolean(input.limitedAccess);

  const dlp = evaluateDlpSharePolicy(
    { sensitivityLabel, audience, expiresAt: input.expiresAt ?? null, limitedAccess },
    DEFAULT_UNIFIED_DLP_POLICY
  );
  if (!dlp.allowed) {
    return { error: dlp.reasons.join(' '), dlpBlocked: true };
  }

  const slug = crypto.randomBytes(6).toString('base64url');
  const now = new Date().toISOString();
  const record: HeroLinkRecord = {
    slug,
    assetId: cleanAssetId,
    assetName: cleanAssetName,
    isFolder: Boolean(input.isFolder),
    canonicalPath: `/s/${slug}`,
    audience,
    role: normalizeRole(input.role),
    sensitivityLabel,
    limitedAccess,
    editorsCanShare: input.editorsCanShare ?? false,
    viewersCanDownload: input.viewersCanDownload ?? true,
    externalGuests: sanitizeGuests(input.externalGuests),
    expiresAt: typeof input.expiresAt === 'string' && input.expiresAt.trim() ? input.expiresAt.trim() : null,
    accessCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  heroLinksBySlug.set(slug, record);
  slugByAssetId.set(cleanAssetId, slug);
  persistHeroLinksToDisk();
  return { link: record };
}

export function updateHeroLinkPermissions(
  slug: string,
  patch: Partial<
    Pick<
      HeroLinkRecord,
      | 'audience'
      | 'role'
      | 'sensitivityLabel'
      | 'limitedAccess'
      | 'editorsCanShare'
      | 'viewersCanDownload'
      | 'externalGuests'
      | 'expiresAt'
    >
  >
): { link?: HeroLinkRecord; error?: string; dlpBlocked?: boolean; notFound?: boolean } {
  ensureInitialized();
  const existing = heroLinksBySlug.get(slug);
  if (!existing) return { notFound: true, error: 'Hero Link not found.' };

  const candidate: HeroLinkRecord = {
    ...existing,
    audience: patch.audience !== undefined ? normalizeAudience(patch.audience) : existing.audience,
    role: patch.role !== undefined ? normalizeRole(patch.role) : existing.role,
    sensitivityLabel:
      patch.sensitivityLabel !== undefined ? normalizeSensitivity(patch.sensitivityLabel) : existing.sensitivityLabel,
    limitedAccess: patch.limitedAccess !== undefined ? Boolean(patch.limitedAccess) : existing.limitedAccess,
    editorsCanShare: patch.editorsCanShare !== undefined ? Boolean(patch.editorsCanShare) : existing.editorsCanShare,
    viewersCanDownload:
      patch.viewersCanDownload !== undefined ? Boolean(patch.viewersCanDownload) : existing.viewersCanDownload,
    externalGuests:
      patch.externalGuests !== undefined ? sanitizeGuests(patch.externalGuests) : existing.externalGuests,
    expiresAt:
      patch.expiresAt !== undefined
        ? typeof patch.expiresAt === 'string' && patch.expiresAt.trim()
          ? patch.expiresAt.trim()
          : null
        : existing.expiresAt,
    updatedAt: new Date().toISOString(),
  };

  const dlp = evaluateDlpSharePolicy(
    {
      sensitivityLabel: candidate.sensitivityLabel,
      audience: candidate.audience,
      expiresAt: candidate.expiresAt,
      limitedAccess: candidate.limitedAccess,
    },
    DEFAULT_UNIFIED_DLP_POLICY
  );
  if (!dlp.allowed) {
    return { error: dlp.reasons.join(' '), dlpBlocked: true };
  }

  heroLinksBySlug.set(slug, candidate);
  persistHeroLinksToDisk();
  return { link: candidate };
}

export function revokeHeroLink(slug: string): boolean {
  ensureInitialized();
  const existing = heroLinksBySlug.get(slug);
  if (!existing) return false;
  heroLinksBySlug.delete(slug);
  slugByAssetId.delete(existing.assetId);
  persistHeroLinksToDisk();
  return true;
}

export function createHeroLinksRouter(): express.Router {
  ensureInitialized();
  const router = express.Router();

  router.get('/hero-links', (_req: Request, res: Response) => {
    res.json({
      links: Array.from(heroLinksBySlug.values()),
    });
  });

  router.post('/hero-links', (req: Request, res: Response) => {
    if (hasPrototypePollutionKeys(req.body)) {
      res.status(400).json({ error: 'Invalid payload: prototype pollution keys are prohibited.' });
      return;
    }
    const assetId = String(req.body?.assetId || '').trim();
    const assetName = String(req.body?.assetName || '').trim();
    if (!assetId || !assetName) {
      res.status(400).json({ error: 'assetId and assetName are required.' });
      return;
    }
    const result = createOrGetHeroLink({
      assetId,
      assetName,
      isFolder: Boolean(req.body?.isFolder),
      audience: req.body?.audience,
      role: req.body?.role,
      sensitivityLabel: req.body?.sensitivityLabel,
      limitedAccess: Boolean(req.body?.limitedAccess),
      editorsCanShare: req.body?.editorsCanShare,
      viewersCanDownload: req.body?.viewersCanDownload,
      externalGuests: req.body?.externalGuests,
      expiresAt: req.body?.expiresAt ?? null,
    });
    if (result.dlpBlocked) {
      res.status(403).json({ error: result.error, dlpBlocked: true });
      return;
    }
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ link: result.link });
  });

  router.patch('/hero-links/:slug', (req: Request, res: Response) => {
    if (hasPrototypePollutionKeys(req.body)) {
      res.status(400).json({ error: 'Invalid payload: prototype pollution keys are prohibited.' });
      return;
    }
    const slug = String(req.params.slug || '');
    const result = updateHeroLinkPermissions(slug, req.body || {});
    if (result.notFound) {
      res.status(404).json({ error: result.error });
      return;
    }
    if (result.dlpBlocked) {
      res.status(403).json({ error: result.error, dlpBlocked: true });
      return;
    }
    res.json({ link: result.link });
  });

  router.delete('/hero-links/:slug', (req: Request, res: Response) => {
    const slug = String(req.params.slug || '');
    const revoked = revokeHeroLink(slug);
    if (!revoked) {
      res.status(404).json({ error: 'Hero Link not found.' });
      return;
    }
    res.json({ success: true, revokedSlug: slug });
  });

  return router;
}

export function handleHeroLinkResolve(req: Request, res: Response): void {
  ensureInitialized();
  const slug = String(req.params.slug || '');
  const link = heroLinksBySlug.get(slug);
  if (!link) {
    res.status(404).json({ error: 'Hero Link not found or revoked.' });
    return;
  }
  if (link.expiresAt && Date.now() > Date.parse(link.expiresAt)) {
    res.status(410).json({ error: 'This Hero Link has expired.', slug, expiredAt: link.expiresAt });
    return;
  }
  link.accessCount += 1;
  persistHeroLinksToDisk();
  res.json({
    slug: link.slug,
    assetId: link.assetId,
    assetName: link.assetName,
    audience: link.audience,
    role: link.role,
    sensitivityLabel: link.sensitivityLabel,
    viewersCanDownload: link.viewersCanDownload,
    externalGuestCount: link.externalGuests.length,
    accessCount: link.accessCount,
  });
}
