import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { FolderNode, MediaAsset, OAuthTokenRecord } from '../src/types';
import { litSearchIndex } from '../src/services/fastSearchIndex';
import type { StorageBackendConfig } from '../src/services/storageProviderRegistry';
import {
  buildGeminiWorkspaceSnapshot,
  formatWorkspaceSystemPrompt,
  generateGroundedOfflineReply,
  retrieveIndexedMatchesForPrompt,
} from '../src/services/geminiWorkspaceContext';

function makeAsset(overrides: Partial<MediaAsset>): MediaAsset {
  return {
    id: overrides.id || 'asset_1',
    name: overrides.name || 'DSC00123.ARW',
    source: overrides.source || 'cloud',
    category: overrides.category || 'raw',
    mimeType: overrides.mimeType || 'image/x-sony-arw',
    extension: overrides.extension || 'arw',
    path: overrides.path || '/Shoots/Portraits/DSC00123.ARW',
    sizeBytes: overrides.sizeBytes ?? 42 * 1024 * 1024,
    modifiedTime: overrides.modifiedTime || '2026-11-18T12:00:00Z',
    thumbnailUrl: '',
    isCached: false,
    cullingStatus: overrides.cullingStatus || 'picked',
    rating: overrides.rating ?? 5,
    tags: overrides.tags || ['portrait', 'studio', 'golden-hour'],
    faces: [],
    quality: overrides.quality || { sharpness: 94, exposure: 90, isBlurry: false },
    palette: [],
    exif: overrides.exif || { camera: 'Sony A7R V' },
  };
}

describe('geminiWorkspaceContext harmonization', () => {
  const sampleAssets: MediaAsset[] = [
    makeAsset({
      id: 'a1',
      name: 'Kyoto_Temple_Sunset.ARW',
      source: 'cloud',
      category: 'raw',
      extension: 'arw',
      path: '/Travel/Japan/Kyoto_Temple_Sunset.ARW',
      sizeBytes: 58 * 1024 * 1024,
      cullingStatus: 'picked',
      rating: 5,
      tags: ['kyoto', 'sunset', 'architecture'],
    }),
    makeAsset({
      id: 'a2',
      name: 'Client_Contract_2026.pdf',
      source: 'local',
      category: 'document',
      extension: 'pdf',
      mimeType: 'application/pdf',
      path: '/Documents/Contracts/Client_Contract_2026.pdf',
      sizeBytes: 3 * 1024 * 1024,
      cullingStatus: 'unrated',
      rating: 0,
      tags: ['contract', 'deliverables'],
    }),
    makeAsset({
      id: 'a3',
      name: 'Motion_Blur_Test.JPG',
      source: 'photos',
      category: 'image',
      extension: 'jpg',
      mimeType: 'image/jpeg',
      path: '/Photos/Tests/Motion_Blur_Test.JPG',
      sizeBytes: 6 * 1024 * 1024,
      cullingStatus: 'rejected',
      rating: 1,
      tags: ['test'],
      quality: { sharpness: 25, exposure: 70, isBlurry: true },
    }),
  ];

  const sampleFolders: FolderNode[] = [
    { id: 'f1', name: 'Japan', source: 'cloud', path: '/Travel/Japan', itemCount: 120 },
    { id: 'f2', name: 'Contracts', source: 'local', path: '/Documents/Contracts', itemCount: 14 },
  ];

  const sampleBackends: StorageBackendConfig[] = [
    { id: 'backend_gdrive', type: 'google-drive', name: 'Google Drive', enabled: true },
    { id: 'backend_local', type: 'local-os', name: 'Local Computer (Direct OS)', enabled: true },
    {
      id: 'backend_r2',
      type: 's3-compatible',
      name: 'Cloudflare R2',
      enabled: true,
      accessKeyId: 'AKIA_TEST_KEY',
      secretAccessKey: 'SUPER_SECRET_R2_CREDENTIAL',
    },
  ];

  const sampleToken: OAuthTokenRecord = {
    accessToken: 'ya29.SUPER_SECRET_OAUTH_TOKEN_VALUE',
    refreshToken: '1//SUPER_SECRET_REFRESH_TOKEN',
    expiresAt: Date.now() + 2400 * 1000,
    provider: 'server',
    userEmail: 'photographer@example.org',
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  };

  it('aggregates live index stats, storage quota/backends, and OAuth capabilities accurately', () => {
    litSearchIndex.rebuild(sampleAssets);

    const snapshot = buildGeminiWorkspaceSnapshot({
      allAssets: sampleAssets,
      folders: sampleFolders,
      driveQuota: {
        usage: 45 * 1024 * 1024 * 1024,
        limit: 100 * 1024 * 1024 * 1024,
        usageInDrive: 40 * 1024 * 1024 * 1024,
        usageInDriveTrash: 2 * 1024 * 1024 * 1024,
        percentage: 45,
      },
      user: { displayName: 'Studio User', email: 'photographer@example.org' },
      storageBackends: sampleBackends,
      oauthToken: sampleToken,
    });

    assert.equal(snapshot.index.totalAssets, 3);
    assert.equal(snapshot.index.liveCount, 3);
    assert.ok(snapshot.index.uniqueTokens > 0);
    assert.equal(snapshot.index.pickedCount, 1);
    assert.equal(snapshot.index.blurryCount, 1);
    assert.equal(snapshot.storage.driveQuota?.percentage, 45);
    assert.equal(snapshot.storage.driveQuota?.planLabel, 'Google One Basic (100 GB)');
    assert.equal(snapshot.storage.enabledBackends.length, 3);
    assert.equal(snapshot.oauth.isSignedIn, true);
    assert.equal(snapshot.oauth.userEmail, 'photographer@example.org');
    assert.equal(snapshot.oauth.tokenStatus, 'valid');
    assert.ok(snapshot.oauth.activeCapabilities.some((c) => c.id === 'drive-api'));
    assert.ok(snapshot.oauth.activeCapabilities.some((c) => c.id === 'google-calendar'));
    assert.ok(snapshot.oauth.missingIncrementalCapabilities.some((c) => c.id === 'gmail-attachments'));
  });

  it('retrieves indexed matches by filename, tags, category, and curation attributes', () => {
    litSearchIndex.rebuild(sampleAssets);

    const kyotoHits = retrieveIndexedMatchesForPrompt('find my kyoto raw sunset photos', sampleAssets);
    assert.ok(kyotoHits.length >= 1);
    assert.equal(kyotoHits[0].id, 'a1');

    const pdfHits = retrieveIndexedMatchesForPrompt('where is the client contract pdf?', sampleAssets);
    assert.ok(pdfHits.length >= 1);
    assert.equal(pdfHits[0].id, 'a2');
  });

  it('redacts all raw OAuth tokens and storage secrets from the system prompt', () => {
    litSearchIndex.rebuild(sampleAssets);
    const snapshot = buildGeminiWorkspaceSnapshot({
      allAssets: sampleAssets,
      folders: sampleFolders,
      storageBackends: sampleBackends,
      oauthToken: sampleToken,
    });

    const sysPrompt = formatWorkspaceSystemPrompt(snapshot, [sampleAssets[0]]);
    assert.ok(sysPrompt.includes('USER INDEX TELEMETRY'));
    assert.ok(sysPrompt.includes('STORAGE TELEMETRY'));
    assert.ok(sysPrompt.includes('GOOGLE WORKSPACE OAUTH SETUP'));
    assert.ok(sysPrompt.includes('Kyoto_Temple_Sunset.ARW'));
    assert.equal(sysPrompt.includes('SUPER_SECRET_OAUTH_TOKEN_VALUE'), false);
    assert.equal(sysPrompt.includes('SUPER_SECRET_REFRESH_TOKEN'), false);
    assert.equal(sysPrompt.includes('SUPER_SECRET_R2_CREDENTIAL'), false);
    assert.equal(sysPrompt.includes('AKIA_TEST_KEY'), false);
  });

  it('produces grounded zero-key offline replies with actionable buttons for OAuth, storage, and index queries', () => {
    litSearchIndex.rebuild(sampleAssets);
    const snapshot = buildGeminiWorkspaceSnapshot({
      allAssets: sampleAssets,
      folders: sampleFolders,
      driveQuota: {
        usage: 12 * 1024 * 1024 * 1024,
        limit: 15 * 1024 * 1024 * 1024,
        usageInDrive: 11 * 1024 * 1024 * 1024,
        usageInDriveTrash: 1 * 1024 * 1024 * 1024,
        percentage: 80,
      },
      storageBackends: sampleBackends,
      oauthToken: null,
    });

    const oauthReply = generateGroundedOfflineReply('Check my Google Workspace OAuth scopes', snapshot);
    assert.ok(oauthReply.text.includes('Google Workspace OAuth Status'));
    assert.equal(oauthReply.suggestedAction?.type, 'open_oauth');

    const storageReply = generateGroundedOfflineReply('How much Drive storage quota am I using?', snapshot);
    assert.ok(storageReply.text.includes('80%'));
    assert.ok(storageReply.text.includes('Cloudflare R2'));
    assert.equal(storageReply.suggestedAction?.type, 'open_storage');

    const matches = retrieveIndexedMatchesForPrompt('kyoto', sampleAssets);
    const searchReply = generateGroundedOfflineReply('kyoto', snapshot, matches);
    assert.ok(searchReply.text.includes('Kyoto_Temple_Sunset.ARW'));
    assert.equal(searchReply.suggestedAction?.type, 'filter_catalog');
  });
});
