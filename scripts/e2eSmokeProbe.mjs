#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-101] Drive Therapy Live E2E Smoke Probe
 * Verifies live HTTP rendering, split bundle loading, all 6 security headers,
 * Castor & Pollux sprite gateways (including path-traversal rejection),
 * Google Originals SHA-256 assets, and live Studio APIs against .runtime-server.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const runtimeFile = path.resolve(process.cwd(), '.runtime-server.json');
if (!fs.existsSync(runtimeFile)) {
  console.error('[qa:e2e] .runtime-server.json not found. Start production server first.');
  process.exit(1);
}

const runtime = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
const baseUrl = `http://127.0.0.1:${runtime.primaryPort}`;

async function run() {
  let passed = 0;
  const check = async (name, fn) => {
    await fn();
    passed++;
    console.log(`[qa:e2e] PASS ${name}`);
  };

  // 1. Root shell + security headers + split bundle references
  await check('Root HTML & 6 Security Headers', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-powered-by'), null, 'x-powered-by must be disabled');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.ok(res.headers.get('referrer-policy'));
    assert.ok(res.headers.get('permissions-policy'));
    assert.ok(res.headers.get('content-security-policy'));
    const html = await res.text();
    assert.ok(html.includes('<div id="root">'), 'Root mount missing');
    const jsMatch = html.match(/src="(\/assets\/[^"]+\.js)"/);
    assert.ok(jsMatch, 'Built JS entry script missing');
    const jsRes = await fetch(`${baseUrl}${jsMatch[1]}`);
    assert.equal(jsRes.status, 200, 'Built JS bundle unreachable');
  });

  // 2. Castor & Pollux gateways + path-traversal rejection
  await check('Castor & Pollux Sprite Gateways + Path Traversal Guard', async () => {
    const manifestRes = await fetch(`${baseUrl}/api/castor/manifest`);
    assert.equal(manifestRes.status, 200);
    const manifest = await manifestRes.json();
    assert.equal(manifest.available, true);
    assert.equal(manifest.polluxAvailable, true);

    for (const ep of [
      '/api/castor/sprite/C-01/02_Happy.png',
      '/api/castor-pollux/pollux/12_pollux_outfit_23_casual_tech.png',
      '/api/castor-pollux/shared/00_castor_pollux_base_armor.png',
      '/api/castor-pollux/reference/pollux_face_cf.png',
    ]) {
      const r = await fetch(`${baseUrl}${ep}`);
      assert.equal(r.status, 200, `Expected 200 on ${ep}`);
      assert.ok((r.headers.get('content-type') || '').startsWith('image/'), `Expected image MIME on ${ep}`);
    }

    const bad = await fetch(`${baseUrl}/api/castor-pollux/pollux/..%2F..%2Fserver.ts`);
    assert.ok(bad.status === 400 || bad.status === 404, 'Path traversal must be rejected');
  });

  // 3. Authentic Google Originals assets
  await check('Authentic Google Originals & Logos', async () => {
    for (const ep of [
      '/themes/originals/manifest.json',
      '/themes/originals/earth-view-1893.jpg',
      '/themes/originals/google-stadia-2019.jpg',
      '/themes/wallpapers/google-tilt-brush.jpg',
      '/themes/logos/workspace-docs.png',
      '/themes/logos/firebase.svg',
    ]) {
      const r = await fetch(`${baseUrl}${ep}`);
      assert.equal(r.status, 200, `Expected 200 on ${ep}`);
    }
  });

  // 4. Live Studio APIs (Webhook Card V2 + Collab Signaling + Loopback FS)
  await check('Studio Webhook Gateway, Collab Signaling & Loopback FS', async () => {
    const wh = await fetch(`${baseUrl}/api/webhooks/google-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'MESSAGE', message: { text: 'e2e ping' } }),
    });
    assert.equal(wh.status, 200);
    const whJson = await wh.json();
    assert.ok(Array.isArray(whJson.cardsV2) && whJson.cardsV2.length > 0);

    const sig = await fetch(`${baseUrl}/api/collab/rooms/e2e-smoke/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peerId: 'e2e', peerName: 'SmokeProbe', type: 'peer_join' }),
    });
    assert.equal(sig.status, 200);
    const sigJson = await sig.json();
    assert.equal(sigJson.success, true);

    const fsRes = await fetch(`${baseUrl}/api/fs/quick-access`);
    assert.equal(fsRes.status, 200);
  });

  console.log(`[qa:e2e] All ${passed} live E2E smoke checks passed against ${baseUrl}.`);
}

run().catch((err) => {
  console.error('[qa:e2e] FAILED:', err);
  process.exit(1);
});
