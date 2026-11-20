/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-103] Release Readiness, External Cloud OAuth Wizards, Multi-Cloud VFS,
 * Reactive Gemstone FAB, Head-to-Toe Castor/Pollux Avatars & Zero-Scroll Ribbon Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  EXTERNAL_CLOUD_SPECS,
  buildExternalOAuthUrl,
  validateExternalCloudConfig,
} from '../src/services/externalCloudAuth';
import { cloudVfsItemToMediaAsset } from '../src/services/cloudVfsAdapter';
import { resolveReactiveGemColor } from '../src/components/FloatingGCommsButton';
import { getPolluxPortraitUrl } from '../src/services/polluxTourAgent';

describe('[WO-103] External Cloud OAuth & Credential Wizards', () => {
  it('defines all 15 external cloud provider specs with valid auth modes', () => {
    assert.equal(EXTERNAL_CLOUD_SPECS.length, 15);
    const ids = EXTERNAL_CLOUD_SPECS.map((s) => s.id);
    for (const coreId of [
      'dropbox',
      'onedrive',
      'sharepoint',
      'wasabi',
      'icloud-drive',
      'flickr',
      'webdav-sftp',
      'mega',
      'pcloud',
      'box',
      'backblaze-b2',
      'cloudflare-r2',
      'proton-drive',
      'smb-nas',
      'sftp-ssh',
    ]) {
      assert.ok(ids.includes(coreId as (typeof ids)[number]), `Missing provider spec: ${coreId}`);
    }
  });

  it('builds valid OAuth 2.0 PKCE URLs for Dropbox and OneDrive', () => {
    const dbx = buildExternalOAuthUrl({
      providerId: 'dropbox',
      clientId: 'client_123',
      redirectUri: 'http://localhost:3050/oauth',
      state: 'st_1',
    });
    assert.ok(dbx && dbx.startsWith('https://www.dropbox.com/oauth2/authorize?'));
    assert.ok(dbx.includes('client_id=client_123'));

    const od = buildExternalOAuthUrl({
      providerId: 'onedrive',
      clientId: 'ms_456',
      redirectUri: 'http://localhost:3050/oauth',
      state: 'st_2',
    });
    assert.ok(od && od.startsWith('https://login.microsoftonline.com/common/oauth2/v2.0/authorize?'));
    assert.ok(od.includes('client_id=ms_456'));
  });

  it('validates OAuth, S3 SigV4, and WebDAV configurations strictly', () => {
    assert.equal(validateExternalCloudConfig('dropbox', {}).valid, false);
    assert.equal(validateExternalCloudConfig('dropbox', { clientId: 'abc123' }).valid, true);
    assert.equal(
      validateExternalCloudConfig('wasabi', { endpointUrl: 'http://insecure', bucket: 'b' }).valid,
      false
    );
    assert.equal(
      validateExternalCloudConfig('wasabi', {
        endpointUrl: 'https://s3.wasabisys.com',
        bucket: 'studio-raw',
      }).valid,
      true
    );
  });
});

describe('[WO-103] Multi-Cloud VFS Adapter', () => {
  it('converts a remote cloud VFS item into a non-destructive MediaAsset', () => {
    const asset = cloudVfsItemToMediaAsset({
      id: 'dbx_001',
      providerId: 'dropbox',
      name: 'sunset_raw.cr3',
      path: '/Shoots/sunset_raw.cr3',
      isFolder: false,
      sizeBytes: 42_000_000,
      modifiedAt: '2026-11-19T12:00:00Z',
      mimeType: 'image/x-canon-cr3',
    });
    assert.equal(asset.id, 'ext_dropbox_dbx_001');
    assert.equal(asset.category, 'raw');
    assert.equal(asset.extension, 'cr3');
    assert.equal(asset.cullingStatus, 'unrated');
    assert.ok(asset.tags.includes('dropbox'));
  });
});

describe('[WO-103] Reactive Gemstone FAB & Head-to-Toe Castor/Pollux Sprites', () => {
  it('shifts gemstone color reactively across Castor, Google Chat, Thinking, Scan, and Idle states', () => {
    assert.equal(resolveReactiveGemColor({ isGeminiBusy: true, isActive: true, activeTab: 'gemini' }), 'amethyst');
    assert.equal(resolveReactiveGemColor({ isActive: true, activeTab: 'chat' }), 'emerald');
    assert.equal(resolveReactiveGemColor({ isActive: true, activeTab: 'gemini' }), 'sapphire');
    assert.equal(resolveReactiveGemColor({ isActive: false, isScanning: true }), 'amber');
    assert.equal(resolveReactiveGemColor({ isActive: false, isScanning: false, currentMode: 'files' }), 'diamond');
  });

  it('serves full-color Castor and Pollux chibi sprites from public/characters/', () => {
    assert.equal(getPolluxPortraitUrl(), '/characters/pollux/P-23/02_Happy.png?v=bust2');
    const polluxPath = path.resolve(process.cwd(), 'public/characters/pollux/P-23/02_Happy.png');
    const castorPath = path.resolve(process.cwd(), 'public/characters/castor/C-01/02_Happy.png');
    assert.equal(fs.existsSync(polluxPath), true, 'Pollux P-23/02_Happy.png must exist');
    assert.equal(fs.existsSync(castorPath), true, 'Castor C-01/02_Happy.png must exist');
  });

  it('verifies zero-scroll responsive classes on QuickAccessRibbon and single-click toggle in App.tsx', () => {
    const ribbonSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/QuickAccessRibbon.tsx'), 'utf8');
    assert.ok(ribbonSrc.includes('hidden xl:inline'), 'QuickAccessRibbon should adapt category labels cleanly');
    assert.ok(ribbonSrc.includes('hidden 2xl:inline'), 'QuickAccessRibbon should hide QUICK ACCESS label on compact desktop');

    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    assert.ok(appSrc.includes('setIsCopilotDrawerOpen((v) => !v)'), 'FloatingGCommsButton must single-click toggle');
    assert.ok(appSrc.includes("currentMode === 'external-clouds'"), 'App must mount ExternalCloudsBrowserView');
  });
});
