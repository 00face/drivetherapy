/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-115] Full-Width Desktop Settings, Cross-OS / Linux WM Native Window Decorations
 * & All 11 Cloud Power Suite Competitive Features Verification Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { resolveWindowDecorationConfig } from '../electron/windowDecoration';
import {
  auditSharedPermissions,
  buildStorageTreemap,
  buildVirtualMountDescriptor,
  computeNextRunAt,
  computeThrottleDelayMs,
  decryptPayloadWithPassphrase,
  encryptPayloadWithPassphrase,
  evaluateAutoFilingRules,
  findCrossCloudDuplicates,
  formatTimecode,
  generateMobilePairingPayload,
  splitIntoResumableChunks,
} from '../src/services/cloudPowerSuiteEngine';
import type { MediaAsset } from '../src/types';

describe('[WO-115] Full-Width Desktop Settings & Cross-OS / Linux WM Window Decorations', () => {
  it('expands UnifiedSettingsModal and StorageSettingsModal to full-width on desktop/large screens', () => {
    const unified = fs.readFileSync(path.resolve(process.cwd(), 'src/components/UnifiedSettingsModal.tsx'), 'utf8');
    const storage = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StorageSettingsModal.tsx'), 'utf8');
    assert.ok(unified.includes('lg:w-[calc(100vw-2rem)]') && unified.includes('max-w-none'));
    assert.ok(storage.includes('lg:w-[calc(100vw-2rem)]') && storage.includes('max-w-none'));
  });

  it('resolves native window decorations across Linux Wayland, Linux Tiling WMs, X11, Windows & macOS', () => {
    const hypr = resolveWindowDecorationConfig('linux', {
      XDG_SESSION_TYPE: 'wayland',
      WAYLAND_DISPLAY: 'wayland-1',
      XDG_CURRENT_DESKTOP: 'Hyprland',
    });
    assert.equal(hypr.frame, true);
    assert.equal(hypr.isWayland, true);
    assert.equal(hypr.isTilingWm, true);
    assert.equal(hypr.minWidth, 360);
    assert.ok(hypr.chromiumSwitches.some(([k]) => k === 'ozone-platform-hint'));
    assert.ok(hypr.chromiumSwitches.some(([, v]) => (v || '').includes('WaylandWindowDecorations')));

    const cinnamonX11 = resolveWindowDecorationConfig('linux', {
      XDG_SESSION_TYPE: 'x11',
      XDG_CURRENT_DESKTOP: 'X-Cinnamon',
    });
    assert.equal(cinnamonX11.frame, true);
    assert.equal(cinnamonX11.isWayland, false);
    assert.equal(cinnamonX11.isTilingWm, false);
    assert.equal(cinnamonX11.autoHideMenuBar, true);

    const win = resolveWindowDecorationConfig('win32', {}, false);
    assert.equal(win.frame, true);
    assert.equal(win.backgroundColor, '#f8fafc');

    const mac = resolveWindowDecorationConfig('darwin', {}, true);
    assert.equal(mac.frame, true);
    assert.equal(mac.autoHideMenuBar, false);
    assert.equal(mac.backgroundColor, '#0f172a');
  });
});

describe('[WO-115] Cloud Power Suite (All 11 Competitive Cloud & Media Features)', () => {
  it('computes recurring sync schedules, virtual OS mount commands, and chunked throttled transfers', () => {
    const nextHourly = computeNextRunAt('hourly', 1_700_000_000_000);
    assert.equal(Date.parse(nextHourly), 1_700_003_600_000);

    const linuxMount = buildVirtualMountDescriptor('linux-fuse', 'google-drive');
    assert.ok(linuxMount.command.includes('rclone mount google-drive:'));
    const winMount = buildVirtualMountDescriptor('windows-winfsp', 'wasabi');
    assert.ok(winMount.command.includes('Z:'));

    const chunks = splitIntoResumableChunks(20 * 1024 * 1024, 8 * 1024 * 1024);
    assert.equal(chunks.length, 3);
    assert.equal(chunks[2].sizeBytes, 4 * 1024 * 1024);
    assert.equal(computeThrottleDelayMs(1024 * 1024, 1024), 1000);
  });

  it('encrypts and decrypts payloads with Zero-Knowledge AES-256-GCM + PBKDF2-SHA256', async () => {
    const env = await encryptPayloadWithPassphrase('Top Secret RAW Archive Manifest', 'correct-horse-battery', 10_000);
    assert.equal(env.alg, 'AES-256-GCM');
    assert.notEqual(env.ciphertextB64, 'Top Secret RAW Archive Manifest');
    const decrypted = await decryptPayloadWithPassphrase(env, 'correct-horse-battery');
    assert.equal(decrypted, 'Top Secret RAW Archive Manifest');
    await assert.rejects(() => decryptPayloadWithPassphrase(env, 'wrong-passphrase'));
  });

  it('builds cross-cloud storage treemaps, detects cross-cloud duplicates, evaluates auto-filing rules, audits permissions, and formats proofing/mobile payloads', () => {
    const sampleAssets = [
      { id: 'a1', name: 'sunset.cr3', source: 'cloud', category: 'raw', extension: 'cr3', path: '/Shoots/sunset.cr3', sizeBytes: 40_000_000, modifiedTime: '2026-11-20T12:00:00Z', exif: { camera: 'Canon R5' } },
      { id: 'a2', name: 'sunset.cr3', source: 'local', category: 'raw', extension: 'cr3', path: '/Backup/sunset.cr3', sizeBytes: 40_000_000, modifiedTime: '2026-11-20T12:00:00Z' },
      { id: 'a3', name: 'clip.mp4', source: 'photos', category: 'video', extension: 'mp4', path: '/Clips/clip.mp4', sizeBytes: 20_000_000, modifiedTime: '2026-11-20T12:00:00Z' },
    ] as unknown as MediaAsset[];

    const treemap = buildStorageTreemap(sampleAssets);
    assert.equal(treemap.length, 3);
    assert.equal(treemap[0].percentOfTotal, 40);

    const dupes = findCrossCloudDuplicates(sampleAssets);
    assert.equal(dupes.length, 1);
    assert.equal(dupes[0].reclaimableBytes, 40_000_000);

    const filed = evaluateAutoFilingRules(sampleAssets[0], [
      {
        id: 'r1',
        name: 'RAW Rule',
        enabled: true,
        matchExtension: 'cr3,arw',
        destinationTemplate: '/Organized/{year}/{month}/{camera}/{name}',
      },
    ]);
    assert.equal(filed?.targetPath, '/Organized/2026/11/Canon_R5/sunset.cr3');

    const audit = auditSharedPermissions([
      { id: 'f1', name: 'PublicDeck.pdf', providerId: 'google-drive', visibility: 'public-anyone', sharedDaysAgo: 10 },
      { id: 'f2', name: 'OldDomain.zip', providerId: 'onedrive', visibility: 'domain-wide', sharedDaysAgo: 120 },
      { id: 'f3', name: 'Private.cr3', providerId: 'google-drive', visibility: 'private', sharedDaysAgo: 5 },
    ]);
    assert.equal(audit.length, 2);
    assert.equal(audit[0].risk, 'high');
    assert.equal(audit[1].risk, 'medium');

    assert.equal(formatTimecode(125), '02:05');
    const pairing = generateMobilePairingPayload('http://localhost:3015');
    assert.ok(pairing.pairingToken.startsWith('dtmob_'));
    assert.equal(pairing.endpointUrl, 'http://localhost:3015/api/companion/upload-manifest');
  });
});
