/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-104 / WO-105 / WO-106] Security Hardening (HttpOnly AES-256-GCM Session Vault,
 * Hardened CSP, IP Rate Limiter), Native S3/WebDAV/Takeout Parsers & Code-Splitting Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildHardenedCspHeader,
  createIpRateLimiter,
  decryptSecret,
  encryptSecret,
  getGoogleAccountToken,
  getOrCreateSessionId,
  listGoogleAccountEmails,
  parseCookieHeader,
  removeGoogleAccountToken,
  setGoogleAccountToken,
} from '../server/security/sessionVault';
import {
  isSafeHttpsExternalEndpoint,
  parseS3ListObjectsXml,
  parseWebDavPropfindXml,
} from '../server/routes/externalClouds';
import { parseZipCentralDirectoryEntries } from '../server/routes/takeoutStream';
import { saveExternalCloudConnection } from '../src/services/externalCloudAuth';

describe('[WO-104] Security Hardening — Session Vault, CSP & Rate Limiter', () => {
  it('encrypts and decrypts secrets cleanly with AES-256-GCM', () => {
    const secret = 'ya29.test_bearer_token_do_not_expose';
    const blob = encryptSecret(secret);
    assert.notEqual(blob.ciphertext, secret);
    assert.equal(decryptSecret(blob), secret);
  });

  it('parses HttpOnly cookie headers and builds hardened CSP without unsafe-eval', () => {
    const parsed = parseCookieHeader('dt_sid=abc123; theme=dark');
    assert.equal(parsed.dt_sid, 'abc123');
    assert.equal(parsed.theme, 'dark');

    const csp = buildHardenedCspHeader();
    assert.ok(csp.includes("'wasm-unsafe-eval'"), 'CSP must permit wasm-unsafe-eval for ONNX');
    assert.equal(csp.includes("'unsafe-eval'"), false, 'CSP must NOT allow unsafe-eval');
    assert.equal(
      csp.includes("script-src 'self' 'unsafe-inline'"),
      false,
      'CSP script-src must NOT allow unsafe-inline'
    );
    assert.ok(csp.includes("object-src 'none'"));

    const bridgeSrc = fs.readFileSync(path.resolve(process.cwd(), 'public/auth-bridge.js'), 'utf8');
    assert.ok(bridgeSrc.includes('window.location.origin'), 'auth-bridge.js must scope postMessage to window.location.origin');
    assert.equal(bridgeSrc.includes('localStorage.setItem'), false, 'auth-bridge.js must not write tokens to localStorage');
  });

  it('[WO-112] isolates multiple concurrent Google account tokens in server session vault', () => {
    const req = { headers: {}, secure: false } as unknown as import('express').Request;
    const res = { append() {} } as unknown as import('express').Response;
    const sid = getOrCreateSessionId(req, res);
    setGoogleAccountToken(sid, 'alice@example.com', { accessToken: 'tok_alice' });
    setGoogleAccountToken(sid, 'bob@example.com', { accessToken: 'tok_bob' });
    assert.deepEqual(listGoogleAccountEmails(sid).sort(), ['alice@example.com', 'bob@example.com']);
    assert.equal(getGoogleAccountToken(sid, 'alice@example.com')?.accessToken, 'tok_alice');
    assert.equal(getGoogleAccountToken(sid, 'bob@example.com')?.accessToken, 'tok_bob');
    removeGoogleAccountToken(sid, 'alice@example.com');
    assert.deepEqual(listGoogleAccountEmails(sid), ['bob@example.com']);
    assert.equal(getGoogleAccountToken(sid, 'alice@example.com'), null);
    assert.equal(getGoogleAccountToken(sid, 'bob@example.com')?.accessToken, 'tok_bob');
  });

  it('enforces per-IP rate limiting thresholds', () => {
    const limiter = createIpRateLimiter(2, 60_000);
    assert.equal(limiter.check('127.0.0.1'), true);
    assert.equal(limiter.check('127.0.0.1'), true);
    assert.equal(limiter.check('127.0.0.1'), false);
    assert.equal(limiter.check('10.0.0.5'), true);
  });

  it('strips raw accessToken from ExternalCloudConnection metadata before persistence', () => {
    const result = saveExternalCloudConnection({
      providerId: 'dropbox',
      connected: true,
      accountLabel: 'Studio Dropbox',
      clientId: 'client_xyz',
      accessToken: 'sl.secret_token_must_not_persist',
      connectedAt: '2026-11-19T16:30:00Z',
    });
    assert.equal(result.dropbox.connected, true);
    assert.equal(result.dropbox.accessToken, undefined);
  });
});

describe('[WO-105] Native External Cloud XML & Takeout ZIP Parsers', () => {
  it('enforces strict SSRF endpoint allowlist on external cloud URLs', () => {
    assert.equal(isSafeHttpsExternalEndpoint('https://s3.us-east-1.wasabisys.com'), true);
    assert.equal(isSafeHttpsExternalEndpoint('http://s3.us-east-1.wasabisys.com'), false);
    assert.equal(isSafeHttpsExternalEndpoint('https://127.0.0.1:8080'), false);
    assert.equal(isSafeHttpsExternalEndpoint('https://169.254.169.254/latest/meta-data'), false);
    assert.equal(isSafeHttpsExternalEndpoint('https://192.168.1.50/webdav'), false);
  });

  it('parses S3 ListObjectsV2 XML folders and media objects accurately', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <ListBucketResult>
        <CommonPrefixes><Prefix>Shoots/2026/</Prefix></CommonPrefixes>
        <Contents>
          <Key>Shoots/hero_frame.cr3</Key>
          <LastModified>2026-11-19T12:00:00.000Z</LastModified>
          <Size>38400123</Size>
        </Contents>
      </ListBucketResult>`;
    const items = parseS3ListObjectsXml(xml, 'wasabi', 'Shoots/');
    assert.equal(items.length, 2);
    assert.equal(items[0].isFolder, true);
    assert.equal(items[0].name, '2026');
    assert.equal(items[1].isFolder, false);
    assert.equal(items[1].name, 'hero_frame.cr3');
    assert.equal(items[1].sizeBytes, 38400123);
  });

  it('parses WebDAV PROPFIND XML responses accurately', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <D:multistatus xmlns:D="DAV:">
        <D:response>
          <D:href>/Photos/</D:href>
          <D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop></D:propstat>
        </D:response>
        <D:response>
          <D:href>/Photos/Albums/</D:href>
          <D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop></D:propstat>
        </D:response>
        <D:response>
          <D:href>/Photos/sunset.jpg</D:href>
          <D:propstat><D:prop>
            <D:getcontentlength>2450120</D:getcontentlength>
            <D:getcontenttype>image/jpeg</D:getcontenttype>
          </D:prop></D:propstat>
        </D:response>
      </D:multistatus>`;
    const items = parseWebDavPropfindXml(xml, 'webdav-sftp', '/Photos');
    assert.equal(items.length, 2);
    assert.equal(items[0].isFolder, true);
    assert.equal(items[0].name, 'Albums');
    assert.equal(items[1].isFolder, false);
    assert.equal(items[1].name, 'sunset.jpg');
    assert.equal(items[1].mimeType, 'image/jpeg');
  });

  it('returns empty array safely when buffer has no ZIP EOCD signature', () => {
    assert.deepEqual(parseZipCentralDirectoryEntries(Buffer.from('not-a-zip')), []);
  });
});

describe('[WO-106] Code-Splitting & User Flow Components', () => {
  it('verifies lazy studio splitting, FirstRunQuickStartCard, and MobileBottomNav in App.tsx', () => {
    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    assert.ok(appSrc.includes('lazy(() => import('), 'App.tsx must use React.lazy() for heavy studios');
    assert.ok(appSrc.includes('<FirstRunQuickStartCard'), 'App.tsx must mount FirstRunQuickStartCard');
    assert.ok(appSrc.includes('<MobileBottomNav'), 'App.tsx must mount MobileBottomNav');
  });
});
