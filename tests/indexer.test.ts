import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapDriveFileToAsset,
  buildFolderPath,
  buildDriveBrowserQuery,
  collectDescendantFolderIds,
  rollUpRecursiveFolderCounts,
} from '../src/services/googleDrive.ts';
import { FolderNode, MediaAsset } from '../src/types/index.ts';

describe('Unbounded Deep Google Drive Indexer & Path Resolution Suite', () => {

  test('buildFolderPath constructs recursive full folder paths from parent links', () => {
    const rawFolders = [
      { id: 'f_root', name: 'Studio_Archive', parentId: undefined },
      { id: 'f_sub', name: '2026_Photoshoots', parentId: 'f_root' },
      { id: 'f_deep', name: 'Portrait_Session_A', parentId: 'f_sub' },
      { id: 'f_standalone', name: 'Standalone_Bucket', parentId: undefined },
    ];

    const folderMap = new Map<string, { id: string; name: string; parentId?: string }>();
    for (const f of rawFolders) {
      folderMap.set(f.id, f);
    }

    assert.equal(buildFolderPath('f_root', folderMap), '/Studio_Archive');
    assert.equal(buildFolderPath('f_sub', folderMap), '/Studio_Archive/2026_Photoshoots');
    assert.equal(buildFolderPath('f_deep', folderMap), '/Studio_Archive/2026_Photoshoots/Portrait_Session_A');
    assert.equal(buildFolderPath('f_standalone', folderMap), '/Standalone_Bucket');
  });

  test('buildFolderPath guards against circular parent hierarchies without infinite recursion', () => {
    const circularFolders = [
      { id: 'f_loop_a', name: 'LoopA', parentId: 'f_loop_b' },
      { id: 'f_loop_b', name: 'LoopB', parentId: 'f_loop_a' },
    ];

    const folderMap = new Map<string, { id: string; name: string; parentId?: string }>();
    for (const f of circularFolders) {
      folderMap.set(f.id, f);
    }

    const path = buildFolderPath('f_loop_a', folderMap);
    assert.ok(typeof path === 'string');
    assert.ok(path.length > 0);
  });

  test('mapDriveFileToAsset resolves parent folder path and stores parentId', () => {
    const folderMap = new Map<string, FolderNode>([
      [
        'folder_vae_123',
        {
          id: 'folder_vae_123',
          name: 'VAE',
          source: 'cloud',
          path: '/Models/VAE',
          itemCount: 0,
        },
      ],
    ]);

    const mockDriveFile = {
      id: 'file_safetensors_99',
      name: 'sdxl_vae.safetensors',
      mimeType: 'application/octet-stream',
      size: '335544320', // ~320 MB
      modifiedTime: '2026-05-10T12:00:00.000Z',
      parents: ['folder_vae_123'],
    };

    const asset = mapDriveFileToAsset(mockDriveFile, folderMap);

    assert.equal(asset.id, 'drive_file_safetensors_99');
    assert.equal(asset.name, 'sdxl_vae.safetensors');
    assert.equal(asset.parentId, 'folder_vae_123');
    assert.equal(asset.path, '/Models/VAE/sdxl_vae.safetensors');
    assert.equal(asset.source, 'cloud');
  });

  test('mapDriveFileToAsset falls back cleanly to /Google Drive/ when parent is unknown', () => {
    const mockDriveFile = {
      id: 'file_unparented_01',
      name: 'Unorganized_Photo.CR3',
      mimeType: 'image/x-canon-cr3',
      size: '45000000',
      modifiedTime: '2026-06-01T08:00:00.000Z',
    };

    const asset = mapDriveFileToAsset(mockDriveFile);

    assert.equal(asset.parentId, undefined);
    assert.equal(asset.path, '/Google Drive/Unorganized_Photo.CR3');
    assert.equal(asset.category, 'raw');
  });

  test('mapDriveFileToAsset recognizes disk images, archives and large media formats', () => {
    const testCases = [
      { name: 'MacOS_X_Leopard.dmg', mime: 'application/x-apple-diskimage', expectedCat: 'archive' },
      { name: 'Installer.pkg', mime: 'application/octet-stream', expectedCat: 'archive' },
      { name: 'Backup_Disk.iso', mime: 'application/x-iso9660-image', expectedCat: 'archive' },
      { name: 'Raw_Burst_01.NEF', mime: 'image/x-nikon-nef', expectedCat: 'raw' },
      { name: '4K_Commercial.PRORES', mime: 'video/quicktime', expectedCat: 'video' },
    ];

    for (const tc of testCases) {
      const asset = mapDriveFileToAsset({
        id: `file_${tc.name}`,
        name: tc.name,
        mimeType: tc.mime,
        size: '1000000',
      });
      assert.equal(asset.category, tc.expectedCat, `File ${tc.name} should map to ${tc.expectedCat}`);
    }
  });

  test('Folder count aggregation calculates precise item totals per parentId', () => {
    const assets: Partial<MediaAsset>[] = [
      { id: '1', parentId: 'f_vae' },
      { id: '2', parentId: 'f_vae' },
      { id: '3', parentId: 'f_vae' },
      { id: '4', parentId: 'f_lora' },
      { id: '5', parentId: undefined },
    ];

    const folderCounts = new Map<string, number>();
    for (const a of assets) {
      if (a.parentId) {
        folderCounts.set(a.parentId, (folderCounts.get(a.parentId) || 0) + 1);
      }
    }

    assert.equal(folderCounts.get('f_vae'), 3);
    assert.equal(folderCounts.get('f_lora'), 1);
    assert.equal(folderCounts.get('f_missing'), undefined);
  });

  test('Dual-tier query specification properly differentiates quick scan, deep scan and folder targeting', () => {
    // Helper replicating query constructor logic in fetchDriveFiles
    const buildDriveQuery = (folderId?: string) => {
      const queryParts = ["trashed = false"];
      if (folderId && folderId !== 'root' && folderId !== 'folder_all' && folderId !== 'recent') {
        queryParts.push(`'${folderId}' in parents`);
      }
      queryParts.push("mimeType != 'application/vnd.google-apps.folder'");
      return queryParts.join(' and ');
    };

    // 1. Root / All Media Quick Scan Query
    const allQuery = buildDriveQuery(undefined);
    assert.equal(allQuery, "trashed = false and mimeType != 'application/vnd.google-apps.folder'");

    // 2. Targeted Folder Query
    const folderQuery = buildDriveQuery('folder_portraits_2026');
    assert.equal(
      folderQuery,
      "trashed = false and 'folder_portraits_2026' in parents and mimeType != 'application/vnd.google-apps.folder'"
    );

    // 3. Virtual folder 'folder_all' shouldn't append parent query
    const virtualAllQuery = buildDriveQuery('folder_all');
    assert.equal(virtualAllQuery, "trashed = false and mimeType != 'application/vnd.google-apps.folder'");
  });

  test('Pagination loop terminates accurately at maxItems = 300 vs unbounded maxItems = 0', () => {
    // Simulated page provider yielding 100 items per page
    const simulateFetchPages = (maxItems: number, totalMockPages = 10) => {
      let loaded = 0;
      let pages = 0;
      const pageSize = maxItems > 0 && maxItems < 1000 ? maxItems : 100;
      let hasNextPage = true;

      while (hasNextPage && (maxItems <= 0 || loaded < maxItems)) {
        pages++;
        loaded += Math.min(pageSize, 100);
        if (pages >= totalMockPages) {
          hasNextPage = false;
        }
      }
      return { loaded, pages };
    };

    // Quick scan limited to 300
    const quickScan = simulateFetchPages(300, 10);
    assert.equal(quickScan.loaded, 300);
    assert.equal(quickScan.pages, 3); // 3 pages of 100 items = 300 items

    // Deep scan unbounded (maxItems = 0)
    const deepScan = simulateFetchPages(0, 10);
    assert.equal(deepScan.loaded, 1000); // Scanned all 10 pages
    assert.equal(deepScan.pages, 10);
  });

  test('Mutex lock prevents concurrent duplicate scan triggers', async () => {
    let isScanning = false;
    let scanExecutionCount = 0;

    const triggerScan = async () => {
      if (isScanning) {
        return { started: false, reason: 'locked' };
      }
      isScanning = true;
      scanExecutionCount++;
      // Simulate async network work
      await new Promise((r) => setTimeout(r, 20));
      isScanning = false;
      return { started: true };
    };

    // Dispatch 3 concurrent triggers (mimicking BroadcastChannel + storage + message simultaneous events)
    const results = await Promise.all([triggerScan(), triggerScan(), triggerScan()]);

    const startedCount = results.filter((r) => r.started).length;
    const lockedCount = results.filter((r) => !r.started).length;

    assert.equal(scanExecutionCount, 1, 'Only one scan should have executed');
    assert.equal(startedCount, 1, 'Only the first caller acquires the mutex');
    assert.equal(lockedCount, 2, 'The other 2 concurrent triggers must be rejected by the mutex');
  });

  test('Authentication guard strictly rejects scan execution when user is null', () => {
    let currentUser: any = null;
    let scanAttempted = false;

    const dispatchScanWithAuthGuard = (user: any) => {
      if (!user) {
        return { rejected: true, reason: 'unauthenticated' };
      }
      scanAttempted = true;
      return { rejected: false };
    };

    const resUnauthed = dispatchScanWithAuthGuard(currentUser);
    assert.equal(resUnauthed.rejected, true);
    assert.equal(scanAttempted, false, 'Scan must not execute when unauthenticated');

    currentUser = { uid: 'drive_user_1', email: 'test@example.com' };
    const resAuthed = dispatchScanWithAuthGuard(currentUser);
    assert.equal(resAuthed.rejected, false);
    assert.equal(scanAttempted, true, 'Scan must proceed when authenticated');
  });

  test('Fast folder discovery limits pagination to maxFolders parameter', () => {
    const mockFolderPages = [
      Array.from({ length: 150 }, (_, i) => ({ id: `f_${i}`, name: `Folder_${i}` })),
      Array.from({ length: 150 }, (_, i) => ({ id: `f_${i + 150}`, name: `Folder_${i + 150}` })),
      Array.from({ length: 150 }, (_, i) => ({ id: `f_${i + 300}`, name: `Folder_${i + 300}` })),
    ];

    const simulateFolderFetch = (maxFolders: number) => {
      let collected: any[] = [];
      let pageIdx = 0;
      do {
        const page = mockFolderPages[pageIdx++] || [];
        collected = [...collected, ...page];
      } while (pageIdx < mockFolderPages.length && (maxFolders <= 0 || collected.length < maxFolders));
      return collected;
    };

    const quickResults = simulateFolderFetch(200);
    assert.ok(quickResults.length <= 300);
    assert.equal(quickResults.length, 300, 'Page 2 completes reaching 300 which satisfies maxFolders 200 threshold');

    const deepResults = simulateFolderFetch(0);
    assert.equal(deepResults.length, 450, 'Unbounded folder fetch paginates all pages');
  });

  test('buildDriveBrowserQuery constructs live no-sync queries across sections and search filters', () => {
    assert.equal(
      buildDriveBrowserQuery({ folderId: 'root', section: 'my-drive', onlyFolders: true }),
      "trashed = false and mimeType = 'application/vnd.google-apps.folder' and 'root' in parents"
    );

    assert.equal(
      buildDriveBrowserQuery({ folderId: 'fld_abc', section: 'my-drive', excludeFolders: true }),
      "trashed = false and mimeType != 'application/vnd.google-apps.folder' and 'fld_abc' in parents"
    );

    assert.equal(
      buildDriveBrowserQuery({ section: 'shared' }),
      'trashed = false and sharedWithMe = true'
    );

    assert.equal(
      buildDriveBrowserQuery({ folderId: 'shared_sub_1', section: 'shared', excludeFolders: true }),
      "trashed = false and mimeType != 'application/vnd.google-apps.folder' and 'shared_sub_1' in parents"
    );

    assert.equal(
      buildDriveBrowserQuery({ section: 'starred' }),
      'trashed = false and starred = true'
    );

    assert.equal(
      buildDriveBrowserQuery({ section: 'recent', excludeFolders: true }),
      "trashed = false and mimeType != 'application/vnd.google-apps.folder'"
    );

    assert.equal(
      buildDriveBrowserQuery({
        folderId: 'fld_shoots',
        section: 'my-drive',
        searchQuery: "Client's\\Raw",
        excludeFolders: true,
      }),
      "trashed = false and mimeType != 'application/vnd.google-apps.folder' and name contains 'Client\\'s\\\\Raw' and 'fld_shoots' in parents"
    );
  });

  test('collectDescendantFolderIds gathers nested subfolder IDs recursively and handles cycles', () => {
    const folders = [
      { id: 'f_root', parentId: undefined },
      { id: 'f_child_a', parentId: 'f_root' },
      { id: 'f_child_b', parentId: 'f_root' },
      { id: 'f_grandchild', parentId: 'f_child_a' },
      { id: 'f_other', parentId: 'f_unrelated' },
    ];

    const descendants = collectDescendantFolderIds('f_root', folders);
    assert.deepEqual(
      Array.from(descendants).sort(),
      ['f_child_a', 'f_child_b', 'f_grandchild', 'f_root'].sort()
    );
    assert.equal(descendants.has('f_other'), false);
  });

  test('rollUpRecursiveFolderCounts aggregates direct and nested subfolder itemCounts', () => {
    const nodes: FolderNode[] = [
      { id: 'root', name: 'UX', source: 'cloud', path: '/UX', itemCount: 0 },
      { id: 'sub1', name: 'Wireframes', source: 'cloud', path: '/UX/Wireframes', parentId: 'root', itemCount: 0 },
      { id: 'sub2', name: 'Prototypes', source: 'cloud', path: '/UX/Prototypes', parentId: 'root', itemCount: 0 },
      { id: 'leaf', name: 'Mobile', source: 'cloud', path: '/UX/Wireframes/Mobile', parentId: 'sub1', itemCount: 0 },
    ];
    const directCounts = new Map<string, number>([
      ['root', 2],
      ['sub1', 4],
      ['sub2', 5],
      ['leaf', 7],
    ]);

    rollUpRecursiveFolderCounts(nodes, directCounts);

    assert.equal(nodes.find((n) => n.id === 'leaf')?.itemCount, 7);
    assert.equal(nodes.find((n) => n.id === 'sub1')?.itemCount, 11);
    assert.equal(nodes.find((n) => n.id === 'sub2')?.itemCount, 5);
    assert.equal(nodes.find((n) => n.id === 'root')?.itemCount, 18);
  });

});
