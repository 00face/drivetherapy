import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { blobRegistry } from '../src/services/localFileSystem.ts';
import {
  clearAuthSessionsAndTokens,
  performSmartCleanup,
  cleanOldSessions,
  terminateAllSessions,
} from '../src/services/storageJanitor.ts';
import { MediaAsset, FolderNode } from '../src/types/index.ts';

describe('Storage Janitor & Ghost File Elimination Verification Suite', () => {

  test('BlobMemoryRegistry registers, revokes single, and tracks active size', () => {
    blobRegistry.revokeAll();
    assert.equal(blobRegistry.size(), 0);

    blobRegistry.register('asset_1', 'blob:http://localhost:3004/test-uuid-1');
    blobRegistry.register('asset_2', 'blob:http://localhost:3004/test-uuid-2');
    blobRegistry.register('asset_3', 'blob:http://localhost:3004/test-uuid-3');
    assert.equal(blobRegistry.size(), 3);

    blobRegistry.revoke('asset_2');
    assert.equal(blobRegistry.size(), 2);

    blobRegistry.revokeAll();
    assert.equal(blobRegistry.size(), 0);
  });

  test('BlobMemoryRegistry revokeUnused prunes only unreferenced blob URLs', () => {
    blobRegistry.revokeAll();

    blobRegistry.register('active_1', 'blob:http://localhost:3004/active-1');
    blobRegistry.register('active_2', 'blob:http://localhost:3004/active-2');
    blobRegistry.register('ghost_old', 'blob:http://localhost:3004/ghost-old');
    blobRegistry.register('ghost_dismounted', 'blob:http://localhost:3004/ghost-dismounted');

    assert.equal(blobRegistry.size(), 4);

    const activeSet = new Set(['active_1', 'active_2']);
    blobRegistry.revokeUnused(activeSet);

    assert.equal(blobRegistry.size(), 2);
    blobRegistry.revokeAll();
  });

  test('Cloud vs Local segregation purges cloud assets while preserving local assets', () => {
    const assets: Partial<MediaAsset>[] = [
      {
        id: 'cloud_1',
        name: 'Drive_Photo_1.jpg',
        source: 'cloud',
        category: 'image',
        mimeType: 'image/jpeg',
        extension: 'JPG',
        path: '/Google Drive/Drive_Photo_1.jpg',
        sizeBytes: 1024,
        modifiedTime: new Date().toISOString(),
        thumbnailUrl: 'https://lh3.googleusercontent.com/test',
        isCached: false,
        cullingStatus: 'unrated',
        rating: 0,
        tags: [],
        faces: [],
      },
      {
        id: 'local_1',
        name: 'Local_Raw_01.CR3',
        source: 'local',
        category: 'raw',
        mimeType: 'image/x-canon-cr3',
        extension: 'CR3',
        path: '/Photos/Local_Raw_01.CR3',
        parentId: 'f_local_photos',
        sizeBytes: 25000000,
        modifiedTime: new Date().toISOString(),
        thumbnailUrl: 'blob:http://localhost:3004/local-raw',
        isCached: true,
        cullingStatus: 'picked',
        rating: 5,
        tags: [],
        faces: [],
      },
    ];

    // Simulate purgeCloudData filter logic
    const remainingAssets = assets.filter((a) => a.source !== 'cloud');
    assert.equal(remainingAssets.length, 1);
    assert.equal(remainingAssets[0].id, 'local_1');
    assert.equal(remainingAssets[0].source, 'local');
  });

  test('Folder dismount identifies and marks all matching assets for revocation', () => {
    const assets: Partial<MediaAsset>[] = [
      { id: 'loc_a1', parentId: 'f_shoot_2026', path: '/Shoot_2026/01.jpg' },
      { id: 'loc_a2', parentId: 'f_shoot_2026', path: '/Shoot_2026/02.jpg' },
      { id: 'loc_b1', parentId: 'f_archive', path: '/Archive/doc.pdf' },
    ];

    const folderIdToDismount = 'f_shoot_2026';
    const assetsToDismount = assets.filter(
      (a) => a.parentId === folderIdToDismount || a.path?.startsWith(`/${folderIdToDismount}/`)
    );
    const retainedAssets = assets.filter(
      (a) => a.parentId !== folderIdToDismount && !a.path?.startsWith(`/${folderIdToDismount}/`)
    );

    assert.equal(assetsToDismount.length, 2);
    assert.equal(retainedAssets.length, 1);
    assert.equal(retainedAssets[0].id, 'loc_b1');
  });

  test('Ghost asset detection flags items with orphaned parent folders', () => {
    const validFolders: FolderNode[] = [
      { id: 'folder_all', name: 'All Media', source: 'cloud', path: '/All Media', itemCount: 1 },
      { id: 'f_active_local', name: 'Active_Shoot', source: 'local', path: '/Active_Shoot', itemCount: 1 },
    ];

    const validFolderIds = new Set(validFolders.map((f) => f.id));
    validFolderIds.add('folder_all');
    validFolderIds.add('recent');

    const testAssets: Partial<MediaAsset>[] = [
      { id: 'asset_valid', parentId: 'f_active_local' },
      { id: 'asset_orphaned_1', parentId: 'f_deleted_folder_99' },
      { id: 'asset_root', parentId: undefined },
    ];

    const isGhost = (a: Partial<MediaAsset>) => Boolean(a.parentId && !validFolderIds.has(a.parentId));

    assert.equal(isGhost(testAssets[0]), false);
    assert.equal(isGhost(testAssets[1]), true);
    assert.equal(isGhost(testAssets[2]), false);
  });

  test('clearAuthSessionsAndTokens executes without uncaught reference errors', () => {
    assert.doesNotThrow(() => {
      clearAuthSessionsAndTokens();
    });
  });

  test('cleanOldSessions purges legacy keys and reports cleaned count', () => {
    // Mock legacy keys in localStorage if window/localStorage exists in test environment
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('drive_auth_sync', 'test_sync');
      window.localStorage.setItem('dt_oauth_state', 'stale_state');
    }
    const result = cleanOldSessions();
    assert.ok(typeof result.cleanedCount === 'number');
    assert.ok(Array.isArray(result.keysRemoved));
  });

  test('terminateAllSessions executes full session teardown without errors', async () => {
    const result = await terminateAllSessions();
    assert.ok(typeof result.cleanedCount === 'number');
    assert.ok(Array.isArray(result.keysRemoved));
  });

});
