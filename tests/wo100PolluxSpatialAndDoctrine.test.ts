/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  POLLUX_CHIBI_SHEETS,
  getPolluxPortraitUrl,
  getPolluxTourArtForStep,
  getCastorPolluxSharedUrl,
} from '../src/services/polluxTourAgent.ts';
import {
  DISPLAY_TIER_CYCLE_ORDER,
  detectDisplayProfile,
  getDisplayTierLabel,
} from '../src/services/adaptiveDisplayProfile.ts';

describe('[WO-100] Pollux Tour Guide, Adaptive Spatial/Transparent Modes & Codebase Doctrine', () => {
  it('resolves Pollux chibi sheets, portrait, and Castor & Pollux shared welcome banner', () => {
    assert.equal(POLLUX_CHIBI_SHEETS.length, 13);
    assert.equal(getPolluxPortraitUrl(), '/characters/pollux/P-23/02_Happy.png?v=bust2');
    assert.equal(getCastorPolluxSharedUrl(), '/api/castor-pollux/shared/00_castor_pollux_base_armor.png');

    const welcome = getPolluxTourArtForStep('studio-tour', 0);
    assert.ok(welcome.sheetUrl.includes('/characters/pollux/'));

    const step2 = getPolluxTourArtForStep('google-ecosystem-guide', 2);
    assert.ok(step2.sheetUrl.includes('/characters/pollux/'));
  });

  it('detects small-screen, tablet, large-format, AR spatial, and transparent-oled display profiles', () => {
    assert.equal(detectDisplayProfile({ width: 320, coarsePointer: true }).displayTier, 'small-screen');
    assert.equal(detectDisplayProfile({ width: 390, coarsePointer: true }).displayTier, 'compact-touch');
    assert.equal(detectDisplayProfile({ width: 820, coarsePointer: false }).displayTier, 'tablet');
    assert.equal(detectDisplayProfile({ width: 2560, coarsePointer: false }).displayTier, 'large-format');
    assert.equal(
      detectDisplayProfile({ width: 1280, userAgent: 'Mozilla/5.0 AppleWebKit visionOS' }).displayTier,
      'ar-spatial'
    );
    assert.equal(
      detectDisplayProfile({ width: 1280, overrideTier: 'transparent-oled' }).displayTier,
      'transparent-oled'
    );
    assert.equal(getDisplayTierLabel('ar-spatial'), 'AR Spatial');
    assert.equal(getDisplayTierLabel('transparent-oled'), 'Transparent Glass');
    assert.ok(DISPLAY_TIER_CYCLE_ORDER.includes('ar-spatial'));
    assert.ok(DISPLAY_TIER_CYCLE_ORDER.includes('transparent-oled'));
  });

  it('enforces server HTTP security headers and erasable TypeScript syntax across new services', () => {
    const serverSrc = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
    assert.ok(serverSrc.includes('X-Content-Type-Options'));
    assert.ok(serverSrc.includes('X-Frame-Options'));
    assert.ok(serverSrc.includes('Referrer-Policy'));
    assert.ok(serverSrc.includes('Permissions-Policy'));
    assert.ok(serverSrc.includes('Content-Security-Policy'));
    assert.ok(serverSrc.includes('/api/castor-pollux/:group/:fileName'));

    const servicesToAudit = [
      'src/services/polluxTourAgent.ts',
      'src/services/chatDecorationEngine.ts',
      'src/services/adaptiveDisplayProfile.ts',
      'src/services/hlsStreamingEngine.ts',
      'src/services/webrtcCullingSync.ts',
      'src/services/workspaceWebhookMesh.ts',
      'src/services/mobileTouchGestures.ts',
      'src/services/pwaSyncManager.ts',
    ];
    for (const rel of servicesToAudit) {
      const code = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
      assert.ok(code.includes('SPDX-License-Identifier: Apache-2.0'), `${rel} missing SPDX header`);
      assert.ok(!/\bexport\s+enum\b/.test(code) && !/\bnamespace\s+\w+/.test(code), `${rel} violates Erasable Syntax Doctrine`);
    }

    // Verify zero dangerouslySetInnerHTML across NotebookLmExportModal (sandboxed iframe instead)
    const nbModal = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/NotebookLmExportModal.tsx'),
      'utf8'
    );
    assert.ok(!nbModal.includes('dangerouslySetInnerHTML'), 'NotebookLmExportModal must not use dangerouslySetInnerHTML');
    assert.ok(nbModal.includes('sandbox=""'), 'NotebookLmExportModal must use sandboxed iframe for HTML preview');
  });
});
