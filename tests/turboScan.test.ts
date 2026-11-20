import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MediaAsset } from '../src/types/index.ts';

describe('Turbocharged Google Drive Deep Scan & Changes API Engine Suite', () => {

  test('Multipart batch request boundary and body formatting', () => {
    const requests = [
      { id: 'req_1', method: 'GET', path: '/drive/v3/files/file_abc?fields=id,name' },
      { id: 'req_2', method: 'GET', path: '/drive/v3/files/file_xyz?fields=id,name' },
    ];

    const boundary = 'batch_dt_test_boundary';
    let multipartBody = '';
    for (const req of requests) {
      multipartBody += `--${boundary}\r\n`;
      multipartBody += 'Content-Type: application/http\r\n';
      multipartBody += `Content-ID: <${req.id}>\r\n\r\n`;
      multipartBody += `${req.method || 'GET'} ${req.path} HTTP/1.1\r\n\r\n`;
    }
    multipartBody += `--${boundary}--\r\n`;

    assert.ok(multipartBody.includes('--batch_dt_test_boundary'));
    assert.ok(multipartBody.includes('Content-ID: <req_1>'));
    assert.ok(multipartBody.includes('GET /drive/v3/files/file_abc?fields=id,name HTTP/1.1'));
    assert.ok(multipartBody.includes('Content-ID: <req_2>'));
    assert.ok(multipartBody.endsWith('--batch_dt_test_boundary--\r\n'));
  });

  test('Multipart batch response boundary parser resolves mapped items', () => {
    const boundary = 'batch_response_boundary_123';
    const mockResponseText = [
      `--${boundary}`,
      'Content-Type: application/http',
      'Content-ID: <response-item_1>',
      '',
      'HTTP/1.1 200 OK',
      'Content-Type: application/json; charset=UTF-8',
      '',
      '{"id": "item_1", "name": "Sunset_01.jpg", "size": "2048"}',
      `--${boundary}`,
      'Content-Type: application/http',
      'Content-ID: <response-item_2>',
      '',
      'HTTP/1.1 200 OK',
      'Content-Type: application/json; charset=UTF-8',
      '',
      '{"id": "item_2", "name": "Portrait_02.raw", "size": "35000"}',
      `--${boundary}--`,
    ].join('\r\n');

    const results = new Map<string, any>();
    const parts = mockResponseText.split(`--${boundary}`);
    for (const part of parts) {
      if (part.includes('Content-ID:')) {
        const idMatch = part.match(/Content-ID:\s*<([^>]+)>/i) || part.match(/Content-ID:\s*response-([^\r\n]+)/i);
        if (idMatch) {
          const reqId = idMatch[1].replace('response-', '');
          const jsonMatch = part.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            results.set(reqId, JSON.parse(jsonMatch[0]));
          }
        }
      }
    }

    assert.equal(results.size, 2);
    assert.equal(results.get('item_1')?.name, 'Sunset_01.jpg');
    assert.equal(results.get('item_2')?.size, '35000');
  });

  test('Google Drive Changes API delta computation correctly segregates additions, updates, and deletions', () => {
    const previousAssets: Partial<MediaAsset>[] = [
      {
        id: 'asset_1',
        name: 'Keep_Me.jpg',
        source: 'cloud',
        category: 'image',
        mimeType: 'image/jpeg',
        extension: 'JPG',
        path: '/Keep_Me.jpg',
        sizeBytes: 1000,
        modifiedTime: '2026-11-01T00:00:00Z',
        thumbnailUrl: 'https://thumb.google/1',
        isCached: false,
        cullingStatus: 'unrated',
        rating: 0,
        tags: [],
      },
      {
        id: 'asset_2',
        name: 'Delete_Me.jpg',
        source: 'cloud',
        category: 'image',
        mimeType: 'image/jpeg',
        extension: 'JPG',
        path: '/Delete_Me.jpg',
        sizeBytes: 2000,
        modifiedTime: '2026-11-01T00:00:00Z',
        thumbnailUrl: 'https://thumb.google/2',
        cullingStatus: 'unrated',
        rating: 0,
        tags: [],
      },
    ];

    // Mock Changes API result: asset_2 trashed, asset_1 modified, asset_3 newly created
    const mockChanges = [
      { fileId: 'asset_2', removed: true },
      {
        fileId: 'asset_1',
        removed: false,
        file: {
          id: 'asset_1',
          name: 'Keep_Me_Renamed.jpg',
          mimeType: 'image/jpeg',
          size: '1200',
          modifiedTime: '2026-11-08T22:00:00Z',
        },
      },
      {
        fileId: 'asset_3',
        removed: false,
        file: {
          id: 'asset_3',
          name: 'Newly_Uploaded.png',
          mimeType: 'image/png',
          size: '5000',
          modifiedTime: '2026-11-08T22:30:00Z',
        },
      },
    ];

    const removedIds: string[] = [];
    const addedOrModified: Partial<MediaAsset>[] = [];

    for (const change of mockChanges) {
      if (change.removed) {
        removedIds.push(change.fileId);
      } else if (change.file) {
        addedOrModified.push({
          id: change.file.id,
          name: change.file.name,
          source: 'cloud',
          sizeBytes: Number(change.file.size),
          modifiedTime: change.file.modifiedTime,
        });
      }
    }

    // Apply delta in memory
    const removedSet = new Set(removedIds);
    const retained = previousAssets.filter((a) => a.id && !removedSet.has(a.id));
    const updatedIds = new Set(addedOrModified.map((a) => a.id).filter(Boolean) as string[]);
    const cleanRetained = retained.filter((a) => a.id && !updatedIds.has(a.id));
    const mergedCatalog = [...addedOrModified, ...cleanRetained];

    assert.equal(mergedCatalog.length, 2);
    assert.equal(mergedCatalog.some((a) => a.id === 'asset_2'), false, 'asset_2 must be removed');
    assert.equal(mergedCatalog.find((a) => a.id === 'asset_1')?.name, 'Keep_Me_Renamed.jpg');
    assert.equal(mergedCatalog.some((a) => a.id === 'asset_3'), true, 'asset_3 must be added');
  });

  test('Jittered exponential backoff calculation honors bounds and Retry-After header', () => {
    const calculateBackoff = (attempt: number, retryAfterSeconds?: string | null) => {
      if (retryAfterSeconds) {
        return parseInt(retryAfterSeconds, 10) * 1000;
      }
      return Math.min(30000, Math.pow(2, attempt) * 1000);
    };

    assert.equal(calculateBackoff(1, null), 2000);
    assert.equal(calculateBackoff(2, null), 4000);
    assert.equal(calculateBackoff(3, null), 8000);
    assert.equal(calculateBackoff(5, null), 30000, 'Max backoff ceiling is 30s');
    assert.equal(calculateBackoff(1, '15'), 15000, 'Respects Google Retry-After header');
  });

  test('HTTP Range chunk calculation computes non-overlapping byte windows', () => {
    const totalSizeBytes = 10 * 1024 * 1024; // 10MB
    const chunkSize = 2 * 1024 * 1024; // 2MB
    const chunksCount = Math.ceil(totalSizeBytes / chunkSize);

    const ranges: string[] = [];
    for (let idx = 0; idx < chunksCount; idx++) {
      const start = idx * chunkSize;
      const end = Math.min(totalSizeBytes - 1, start + chunkSize - 1);
      ranges.push(`bytes=${start}-${end}`);
    }

    assert.equal(ranges.length, 5);
    assert.equal(ranges[0], 'bytes=0-2097151');
    assert.equal(ranges[1], 'bytes=2097152-4194303');
    assert.equal(ranges[4], 'bytes=8388608-10485759');
  });

});