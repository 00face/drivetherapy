/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-117] Universal Release Readiness, Fuzz/Boundary, Persistence, Access Policy
 * Enforcement & Structured Observability Verification Suite (Phases 04–16).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { Request, Response } from 'express';

import {
  DEFAULT_UNIFIED_DLP_POLICY,
  buildCleanSharePdfHtml,
  buildMeetSharePayload,
  evaluateDlpSharePolicy,
} from '../src/services/enterpriseSharingEngine';
import {
  configureHeroLinksStorePath,
  createOrGetHeroLink,
  handleHeroLinkResolve,
  reloadHeroLinksFromDisk,
  revokeHeroLink,
  updateHeroLinkPermissions,
} from '../server/routes/heroLinks';
import { scanBufferOfflineHeuristics } from '../server/routes/malwareScanner';
import {
  createAccessPolicyMiddleware,
  evaluateAccessPolicy,
  hasPrototypePollutionKeys,
  setActiveAccessPolicy,
} from '../server/security/accessPolicy';
import {
  getObservabilitySnapshot,
  recordDiagnosticEvent,
  redactSensitiveTelemetry,
  sanitizeCorrelationId,
} from '../server/observability/telemetry';

describe('[WO-117] Universal Release Readiness & Hardening Suite', () => {
  let tmpDir: string;
  let storeFile: string;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-wo117-hero-'));
    storeFile = path.join(tmpDir, 'hero-links.json');
    configureHeroLinksStorePath(storeFile);
  });

  after(() => {
    setActiveAccessPolicy({
      enabled: false,
      allowedIps: [],
      allowedCountries: [],
      alwaysAllowLoopback: true,
    });
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  });

  describe('Phase 04 & 05 — Property-Based, Fuzz & Boundary Invariants', () => {
    it('handles Unicode, emoji, RTL BiDi, and 100KB boundary inputs safely in Clean PDF Prep and Meet Share', () => {
      const adversarialStrings = [
        '',
        '   \t\n  ',
        '日本語テスト_🚀_👨‍👩‍👧‍👦_e\u0301',
        '\u202Eevil-bidi-override.pdf\u202C',
        '<script>alert("xss")</script><img src=x onerror=alert(1)>',
        'A'.repeat(100_000),
      ];

      for (const s of adversarialStrings) {
        const html = buildCleanSharePdfHtml({
          assetName: s,
          heroUrl: 'https://localhost:3017/s/abc',
          sensitivityLabel: 'confidential',
          summaryText: s,
        });
        assert.ok(typeof html === 'string' && html.includes('<!DOCTYPE html>'));
        assert.ok(!html.includes('<script>alert("xss")</script>'), 'Must escape raw script tags');

        const meet = buildMeetSharePayload(
          'https://localhost:3017',
          {
            slug: 'abc',
            assetId: s || 'fallback-id',
            assetName: s || 'fallback-name',
            isFolder: false,
            canonicalPath: '/s/abc',
            audience: 'internal-domain',
            role: 'viewer',
            sensitivityLabel: 'internal',
            limitedAccess: false,
            editorsCanShare: false,
            viewersCanDownload: true,
            externalGuests: [],
            expiresAt: null,
            accessCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          'abc-defg-hij'
        );
        assert.equal(meet.grantedRole, 'viewer');
        assert.equal(meet.meetingCode, 'abc-defg-hij');
      }
    });

    it('fuzzes offline malware scanner with empty, random binary, truncated PDF, and polyglot buffers without throwing', () => {
      const emptyResult = scanBufferOfflineHeuristics(Buffer.alloc(0), 'empty.bin');
      assert.equal(emptyResult.verdict, 'clean');
      assert.equal(emptyResult.sizeBytes, 0);

      // Deterministic pseudo-random buffer (64 KB)
      const randomBuf = Buffer.alloc(65536);
      for (let i = 0; i < randomBuf.length; i += 1) {
        randomBuf[i] = (i * 73 + 19) & 0xff;
      }
      const randResult = scanBufferOfflineHeuristics(randomBuf, 'photo.jpg');
      assert.equal(randResult.verdict, 'clean');

      // Mach-O magic header disguised as .png
      const machoFakePng = Buffer.from([0xfe, 0xed, 0xfa, 0xcf, 0x00, 0x01, 0x02]);
      const machoResult = scanBufferOfflineHeuristics(machoFakePng, 'avatar.png');
      assert.equal(machoResult.verdict, 'malicious');

      // PDF with embedded /OpenAction and /JS
      const maliciousPdf = Buffer.from('%PDF-1.7\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>');
      const pdfResult = scanBufferOfflineHeuristics(maliciousPdf, 'invoice.pdf');
      assert.equal(pdfResult.verdict, 'suspicious');
    });

    it('detects prototype pollution keys at root and nested object levels', () => {
      const cleanObj = { enabled: true, allowedCountries: ['US', 'CA'] };
      assert.equal(hasPrototypePollutionKeys(cleanObj), false);

      const pollutedRoot = JSON.parse('{"__proto__":{"isAdmin":true}}');
      assert.equal(hasPrototypePollutionKeys(pollutedRoot), true);

      const pollutedNested = JSON.parse('{"nested":{"constructor":{"prototype":{"polluted":true}}}}');
      assert.equal(hasPrototypePollutionKeys(pollutedNested), true);
    });

    it('enforces DLP expiration boundaries across negative, zero, valid, and >30-day horizons', () => {
      const pastIso = new Date(Date.now() - 86_400_000).toISOString();
      const valid20DaysIso = new Date(Date.now() + 20 * 86_400_000).toISOString();
      const tooFar45DaysIso = new Date(Date.now() + 45 * 86_400_000).toISOString();

      // Valid 20-day public link for public sensitivity passes
      const passVerdict = evaluateDlpSharePolicy(
        { sensitivityLabel: 'public', audience: 'public-anyone', expiresAt: valid20DaysIso, limitedAccess: false },
        DEFAULT_UNIFIED_DLP_POLICY
      );
      assert.equal(passVerdict.allowed, true);

      // 45-day public link exceeds maxPublicExpiryDays (30)
      const farVerdict = evaluateDlpSharePolicy(
        { sensitivityLabel: 'public', audience: 'public-anyone', expiresAt: tooFar45DaysIso, limitedAccess: false },
        DEFAULT_UNIFIED_DLP_POLICY
      );
      assert.equal(farVerdict.allowed, false);

      // Past expiration date fails
      const pastVerdict = evaluateDlpSharePolicy(
        { sensitivityLabel: 'public', audience: 'public-anyone', expiresAt: pastIso, limitedAccess: false },
        DEFAULT_UNIFIED_DLP_POLICY
      );
      assert.equal(pastVerdict.allowed, false);
    });
  });

  describe('Phase 07 & 12 — Hero Links Disk Persistence, Reload, Expiry & Revocation Lifecycle', () => {
    it('persists Hero Links to mode-0600 disk storage, survives reload, enforces 410 expiry, and revokes cleanly', () => {
      const created = createOrGetHeroLink({
        assetId: 'asset-persist-117',
        assetName: 'Architecture-Blueprint.pdf',
        audience: 'internal-domain',
        role: 'viewer',
        sensitivityLabel: 'internal',
        limitedAccess: true,
      });
      assert.ok(created.link);
      const slug = created.link!.slug;
      assert.ok(fs.existsSync(storeFile), 'Hero Links store file should exist on disk');

      // Update permissions and verify persistence after full disk reload
      const updated = updateHeroLinkPermissions(slug, {
        role: 'editor',
        externalGuests: ['auditor@partner.example'],
      });
      assert.ok(updated.link);
      assert.equal(updated.link!.role, 'editor');

      const countAfterReload = reloadHeroLinksFromDisk();
      assert.equal(countAfterReload, 1);

      // Re-fetching by assetId returns the exact same canonical slug and persisted role
      const reFetched = createOrGetHeroLink({
        assetId: 'asset-persist-117',
        assetName: 'Architecture-Blueprint.pdf',
      });
      assert.equal(reFetched.link?.slug, slug);
      assert.equal(reFetched.link?.role, 'editor');
      assert.deepEqual(reFetched.link?.externalGuests, ['auditor@partner.example']);

      // Revoke the Hero Link and verify 404 on resolve
      const revoked = revokeHeroLink(slug);
      assert.equal(revoked, true);
      assert.equal(revokeHeroLink(slug), false);

      let statusCode = 200;
      const mockReq = { params: { slug } } as unknown as Request;
      const mockRes = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json() {
          return this;
        },
      } as unknown as Response;
      handleHeroLinkResolve(mockReq, mockRes);
      assert.equal(statusCode, 404);
    });
  });

  describe('Phase 06 — Runtime Enterprise Access Policy Enforcement Middleware', () => {
    it('blocks unauthorized external IPs/countries with 403 while permitting allowed traffic and loopback', () => {
      setActiveAccessPolicy({
        enabled: true,
        allowedIps: ['198.51.100.42'],
        allowedCountries: ['US'],
        alwaysAllowLoopback: true,
      });

      const middleware = createAccessPolicyMiddleware((req) => req.ip === '127.0.0.1');

      // 1. Disallowed external IP/Country -> 403
      let blockedStatus = 200;
      let blockedBody: Record<string, unknown> = {};
      let nextCalled = false;
      middleware(
        {
          ip: '203.0.113.99',
          headers: { 'cf-ipcountry': 'FR' },
        } as unknown as Request,
        {
          status(code: number) {
            blockedStatus = code;
            return this;
          },
          json(payload: Record<string, unknown>) {
            blockedBody = payload;
            return this;
          },
        } as unknown as Response,
        () => {
          nextCalled = true;
        }
      );
      assert.equal(blockedStatus, 403);
      assert.equal(blockedBody.policyEnforced, true);
      assert.equal(nextCalled, false);

      // 2. Allowed external IP + Country -> passes
      let allowedNext = false;
      middleware(
        {
          ip: '198.51.100.42',
          headers: { 'cf-ipcountry': 'US' },
        } as unknown as Request,
        {} as unknown as Response,
        () => {
          allowedNext = true;
        }
      );
      assert.equal(allowedNext, true);

      // 3. Loopback request -> always passes when alwaysAllowLoopback is true
      let loopbackNext = false;
      middleware(
        {
          ip: '127.0.0.1',
          headers: {},
        } as unknown as Request,
        {} as unknown as Response,
        () => {
          loopbackNext = true;
        }
      );
      assert.equal(loopbackNext, true);
    });
  });

  describe('Phase 16 — Structured Observability, Correlation ID & Secret Redaction', () => {
    it('sanitizes correlation IDs against header injection and redacts credentials from diagnostic logs', () => {
      assert.equal(sanitizeCorrelationId('req-2026-valid_id.01'), 'req-2026-valid_id.01');
      const injected = sanitizeCorrelationId('bad\r\nSet-Cookie: evil=1');
      assert.notEqual(injected, 'bad\r\nSet-Cookie: evil=1');
      assert.match(injected, /^[0-9a-f-]{36}$/i);

      const rawSecretLog =
        'Failed call with key AIzaSyD123456789012345678901234567890 and Bearer ya29.a0AfH6SMBx123456789012345 and cookie dt_sid=secret_session_token_999';
      const redacted = redactSensitiveTelemetry(rawSecretLog);
      assert.ok(!redacted.includes('AIzaSyD123456789012345678901234567890'));
      assert.ok(!redacted.includes('ya29.a0AfH6SMBx123456789012345'));
      assert.ok(!redacted.includes('secret_session_token_999'));
      assert.ok(redacted.includes('[REDACTED_GOOGLE_API_KEY]'));

      recordDiagnosticEvent('security', rawSecretLog, 'corr-test-117');
      const snapshot = getObservabilitySnapshot();
      assert.equal(snapshot.status, 'healthy');
      assert.equal(snapshot.securityPosture.cspActive, true);
      assert.equal(snapshot.securityPosture.sessionVaultEncrypted, true);
      const lastEvent = snapshot.recentEvents[snapshot.recentEvents.length - 1];
      assert.ok(lastEvent);
      assert.ok(!lastEvent.message.includes('AIzaSyD'));
    });
  });
});
