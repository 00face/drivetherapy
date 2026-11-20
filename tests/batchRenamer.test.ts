/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Batch Renamer Engine Unit Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatExifDate,
  splitFilename,
  sanitizeFilenameComponent,
  interpolateTokens,
  generateBatchRenamePreview,
  BATCH_RENAME_PRESETS,
} from '../src/services/batchRenamer';
import { MediaAsset } from '../src/types';

describe('Tokenized Batch Renamer Engine', () => {
  const mockAsset1: MediaAsset = {
    id: 'asset_1',
    name: 'DSC04921.JPG',
    mimeType: 'image/jpeg',
    size: 24500000,
    timestamp: new Date('2026-11-09T14:30:22Z').getTime(),
    dateTaken: '2026-11-09T14:30:22Z',
    cameraModel: 'ILCE-7M4',
    rating: 5,
    exif: {
      camera: 'Sony A7IV',
      lens: 'FE 24-70mm F2.8 GM II',
      iso: 400,
      fNumber: 2.8,
      exposureTime: '1/250s',
    },
  } as any;

  const mockAsset2: MediaAsset = {
    id: 'asset_2',
    name: 'IMG_8820.CR3',
    mimeType: 'image/x-canon-cr3',
    size: 32000000,
    timestamp: new Date('2026-11-09T14:31:05Z').getTime(),
    dateTaken: '2026-11-09T14:31:05Z',
    cameraModel: 'EOS R5',
    rating: 4,
    exif: {
      camera: 'Canon EOS R5',
      lens: 'RF 50mm F1.2L',
      iso: 100,
      fNumber: 1.2,
      exposureTime: '1/1000s',
    },
  } as any;

  it('splits filenames into base and ext correctly', () => {
    assert.deepEqual(splitFilename('photo.jpg'), { base: 'photo', ext: 'jpg' });
    assert.deepEqual(splitFilename('archive.tar.gz'), { base: 'archive.tar', ext: 'gz' });
    assert.deepEqual(splitFilename('noextension'), { base: 'noextension', ext: '' });
  });

  it('sanitizes illegal filename characters', () => {
    assert.equal(sanitizeFilenameComponent('Sony/A7IV:Lens*Test?'), 'Sony_A7IV_Lens_Test_');
  });

  it('formats custom EXIF date formats accurately', () => {
    const d = new Date('2026-05-12T09:05:01');
    assert.equal(formatExifDate(d, 'YYYYMMDD'), '20260512');
    assert.equal(formatExifDate(d, 'YYYY-MM-DD'), '2026-05-12');
    assert.equal(formatExifDate(d, 'YYMMDD'), '260512');
    assert.equal(formatExifDate(d, 'HH-mm-SS'), '09-05-01');
  });

  it('interpolates {date}, {time}, {camera}, {lens}, {seq:001}', () => {
    const pattern = '{date:YYYYMMDD}_{camera}_{seq:001}';
    const res = interpolateTokens(mockAsset1, 0, { pattern });
    assert.equal(res, '20261109_Sony A7IV_001');

    const res2 = interpolateTokens(mockAsset2, 1, { pattern });
    assert.equal(res2, '20261109_Canon EOS R5_002');
  });

  it('supports search and replace with case transformations', () => {
    const pattern = '{filename}';
    const res = interpolateTokens(mockAsset1, 0, {
      pattern,
      searchString: 'DSC',
      replaceString: 'ShootA_',
      caseTransformation: 'lowercase',
      spaceReplacement: 'underscore',
    });
    assert.equal(res, 'shoota_04921');
  });

  it('generates preview diffs and detects filename collisions', () => {
    const duplicateAssets = [
      { ...mockAsset1, id: 'a1', name: 'pic1.jpg' },
      { ...mockAsset1, id: 'a2', name: 'pic2.jpg' },
    ];
    // Static pattern without sequence produces collision
    const previews = generateBatchRenamePreview(duplicateAssets, { pattern: 'FixedName' });
    assert.equal(previews.length, 2);
    assert.equal(previews[0].hasCollision, true);
    assert.equal(previews[1].hasCollision, true);
    assert.ok(previews[0].error?.includes('collision'));
  });

  it('provides 5 canonical production presets', () => {
    assert.equal(BATCH_RENAME_PRESETS.length, 5);
    const dateCameraSeq = BATCH_RENAME_PRESETS.find((p) => p.id === 'date_camera_seq');
    assert.ok(dateCameraSeq);
    assert.equal(dateCameraSeq.pattern, '{date:YYYYMMDD}_{camera}_{seq:001}');
  });
});
