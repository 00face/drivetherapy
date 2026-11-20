import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fetchWithBackoff } from '../src/services/indexingResilience.ts';
import { LitHybridSearchIndex } from '../src/services/fastSearchIndex.ts';
import { mapGooglePhotosLibraryItem } from '../src/services/googlePhotos.ts';
import type { MediaAsset } from '../src/types/index.ts';

function makeAsset(id: string, name: string): MediaAsset {
  return {
    id,
    name,
    source: 'cloud',
    category: 'image',
    mimeType: 'image/jpeg',
    extension: 'JPG',
    path: `/Drive/${name}`,
    sizeBytes: 1024,
    modifiedTime: '2026-11-17T00:00:00Z',
    thumbnailUrl: '',
    isCached: false,
    cullingStatus: 'unrated',
    rating: 0,
    tags: [],
    faces: [],
    quality: { sharpness: 90, exposure: 90, overall: 90, isBlurry: false },
    palette: [],
    exif: {},
  };
}

describe('Crash-Safe Resumable Indexing, O(delta) Index & Real Google Photos Albums API', () => {
  it('fetchWithBackoff retries transient 503/429 responses and succeeds on recovery', async () => {
    let calls = 0;
    const mockFetch: typeof fetch = async () => {
      calls++;
      if (calls < 3) {
        return new Response('Busy', { status: 503 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const res = await fetchWithBackoff('https://example.test/api', {}, {
      maxRetries: 4,
      baseDelayMs: 5,
      fetchImpl: mockFetch,
    });
    assert.equal(res.status, 200);
    assert.equal(calls, 3);
  });

  it('LitHybridSearchIndex.applyDelta incrementally upserts and removes entries without full rebuild', () => {
    const idx = new LitHybridSearchIndex();
    idx.rebuild([makeAsset('a1', 'Alpha.jpg'), makeAsset('a2', 'Beta.jpg')]);
    assert.equal(idx.search('Alpha').length, 1);

    idx.applyDelta({
      upsert: [makeAsset('a2', 'BetaRenamed.jpg'), makeAsset('a3', 'Gamma.jpg')],
      removeIds: ['a1'],
    });

    assert.equal(idx.search('Alpha').length, 0);
    assert.equal(idx.search('BetaRenamed').length, 1);
    assert.equal(idx.search('Gamma').length, 1);
    assert.equal(idx.getStats().liveCount, 2);
  });

  it('maps Google Photos Library items directly and never silently substitutes Drive files', () => {
    const item = mapGooglePhotosLibraryItem({
      id: 'gp_album_item_1',
      baseUrl: 'https://lh3.googleusercontent.com/real_photo',
      mimeType: 'image/jpeg',
      filename: 'Vacation_01.jpg',
      mediaMetadata: {
        creationTime: '2026-10-01T12:00:00Z',
        width: '4032',
        height: '3024',
        photo: { cameraMake: 'Google', cameraModel: 'Pixel 9' },
      },
    });
    assert.equal(item.source, 'photos');
    assert.equal(item.exif.camera, 'Google Pixel 9');
    assert.ok(item.thumbnailUrl.includes('/api/photos/proxy'));

    const photosSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/services/googlePhotos.ts'),
      'utf8'
    );
    assert.ok(!photosSrc.includes('gphotos_drive_'));
  });

  it('server.ts exposes loopback /api/fs/delta-scan and Google Photos albums endpoints', () => {
    const srv = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
    assert.ok(srv.includes("app.post('/api/fs/delta-scan'"));
    assert.ok(srv.includes("app.get('/api/photos/library'"));
    assert.ok(srv.includes("app.post('/api/photos/album-items'"));
    assert.ok(srv.includes("app.post('/api/photos/albums'"));
    assert.ok(srv.includes('https://www.googleapis.com/auth/photoslibrary.readonly'));

    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    assert.ok(appSrc.includes('autoLoadGooglePhotosLibrary()'));
  });
});
