import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAtomicSearchQuery, searchUniversalConsole } from '../src/services/universalConsoleSearch.ts';
import type { MediaAsset } from '../src/types/index.ts';

const MOCK_ASSETS: MediaAsset[] = [
  {
    id: 'drive_1',
    name: 'Sunset_Ceremony.cr3',
    source: 'cloud',
    category: 'raw',
    mimeType: 'image/x-canon-cr3',
    extension: 'CR3',
    path: '/Weddings/Ceremony/Sunset_Ceremony.cr3',
    sizeBytes: 24_000_000,
    modifiedTime: '2026-11-18T00:00:00Z',
    thumbnailUrl: '',
    isCached: false,
    cullingStatus: 'picked',
    rating: 5,
    tags: ['Wedding', 'Hero'],
    faces: [],
    quality: { sharpness: 95, exposure: 92, overall: 94, isBlurry: false },
    palette: [],
    exif: {},
  },
  {
    id: 'local_1',
    name: 'Studio_BTS.mp4',
    source: 'local',
    category: 'video',
    mimeType: 'video/mp4',
    extension: 'MP4',
    path: '/home/face/Videos/Studio_BTS.mp4',
    sizeBytes: 5_000_000,
    modifiedTime: '2026-11-18T00:00:00Z',
    thumbnailUrl: '',
    isCached: true,
    cullingStatus: 'unrated',
    rating: 2,
    tags: ['BTS'],
    faces: [],
    quality: { sharpness: 80, exposure: 80, overall: 80, isBlurry: false },
    palette: [],
    exif: {},
  },
];

describe('Google Cloud Console Universal Search & Atomic Filtering', () => {
  it('parses atomic tokens and free-text terms accurately', () => {
    const parsed = parseAtomicSearchQuery('type:file source:drive ext:cr3 rating:>=4 status:picked sunset');
    assert.equal(parsed.type, 'file');
    assert.equal(parsed.source, 'drive');
    assert.equal(parsed.ext, 'cr3');
    assert.equal(parsed.minRating, 4);
    assert.equal(parsed.status, 'picked');
    assert.equal(parsed.freeText, 'sunset');
  });

  it('filters indexed files atomically and surfaces features, settings & workspace items', () => {
    const fileRes = searchUniversalConsole('source:drive ext:cr3 rating:>=4 status:picked', {
      assets: MOCK_ASSETS,
    });
    assert.equal(fileRes.topResults.length, 0);
    assert.equal(fileRes.resources.length, 1);
    assert.equal(fileRes.resources[0].title, 'Sunset_Ceremony.cr3');

    const featureRes = searchUniversalConsole('tv', {
      assets: MOCK_ASSETS,
      keepNotes: [{ id: 'k1', title: 'TV Color Calibration', body: 'Rec.709' }],
    });
    assert.ok(featureRes.topResults.some((r) => r.actionId === 'display:tv-tenfoot'));
    assert.ok(featureRes.resources.some((r) => r.kind === 'note' && r.title === 'TV Color Calibration'));
  });
});
