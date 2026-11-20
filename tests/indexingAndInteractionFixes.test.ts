import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { MediaAsset } from '../src/types/index.ts';
import {
  LitHybridSearchIndex,
  decodeDeltaIds,
  encodeDeltaIds,
} from '../src/services/fastSearchIndex.ts';

function makeAsset(id: number, name: string, category: MediaAsset['category'] = 'image'): MediaAsset {
  return {
    id: `asset_${id}`,
    name,
    source: 'local',
    category,
    mimeType: 'image/jpeg',
    extension: 'JPG',
    path: `/Archive/${name}`,
    sizeBytes: 1024,
    modifiedTime: '2026-11-17T14:00:00.000Z',
    thumbnailUrl: '',
    isCached: true,
    cullingStatus: 'unrated',
    rating: 0,
    tags: ['studio'],
    faces: [],
    quality: { sharpness: 90, exposure: 90, overall: 90, isBlurry: false },
    palette: [],
    exif: {},
  };
}

describe('LIT Hybrid Fast Search Index, Sharded Drive Indexing & Interaction Fixes', () => {
  test('Delta-compressed DocIDs encode and decode losslessly', () => {
    const ids = [3, 10, 11, 45, 120, 5000];
    const encoded = encodeDeltaIds(ids);
    assert.deepEqual(Array.from(encoded), [3, 7, 1, 34, 75, 4880]);
    assert.deepEqual(decodeDeltaIds(encoded), ids);
  });

  test('LitHybridSearchIndex builds and queries 5,000 assets in milliseconds with category pruning', () => {
    const assets: MediaAsset[] = [];
    for (let i = 0; i < 5000; i++) {
      assets.push(
        makeAsset(
          i,
          i === 3456 ? 'special_unicorn_crest.jpg' : `photo_${i}.jpg`,
          i % 5 === 0 ? 'video' : 'image'
        )
      );
    }

    const index = new LitHybridSearchIndex();
    index.rebuild(assets);
    const stats = index.getStats();
    assert.equal(stats.liveCount, 5000);
    assert.ok(stats.uniqueTrigrams > 0);

    const t0 = performance.now();
    const hits = index.search('unicorn', 'image');
    const elapsed = performance.now() - t0;
    assert.equal(hits.length, 1);
    assert.equal(hits[0].name, 'special_unicorn_crest.jpg');
    assert.ok(elapsed < 25, `Expected fast trigram query (<25ms), took ${elapsed.toFixed(2)}ms`);

    const wrongCat = index.search('unicorn', 'video');
    assert.equal(wrongCat.length, 0);
  });

  test('App.tsx wires Lightbox navList context and Drag-and-Drop Cancel/Files guard', () => {
    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    assert.ok(appSrc.includes('lightboxAssetList'), 'App.tsx must track lightboxAssetList');
    assert.ok(appSrc.includes("types.includes('Files')"), 'Drag-over must only activate for Files drops');
    assert.ok(appSrc.includes('Cancel Drop (Esc)'), 'Drag overlay must provide an explicit Cancel button');
  });
});
