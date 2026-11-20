/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Professional Batch Export Engine & Modal Integration Suite
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPORT_PRESETS,
  calculateFitDimensions,
  computeWatermarkPosition,
  scrubExifPrivacy,
  packageBatchExportZip,
} from '../src/services/batchExporter';
import { MediaAsset } from '../src/types';

describe('Batch Export Engine & Modal Logic Suite', () => {
  const sampleAssets: MediaAsset[] = [
    {
      id: 'asset_001',
      name: 'Sony_A7IV_Golden_Hour.jpg',
      sizeBytes: 14500000,
      mimeType: 'image/jpeg',
      source: 'local',
      thumbnailUrl: 'blob:sample1',
      rating: 5,
      cullingStatus: 'picked',
      colorLabel: 'green',
      tags: ['portrait', 'golden hour'],
      faces: [{ label: 'Alex', count: 1 }],
      exif: {
        camera: 'Sony ILCE-7M4',
        lens: 'FE 50mm F1.2 GM',
        focalLength: '50mm',
        aperture: 'f/1.2',
        shutterSpeed: '1/4000s',
        iso: 100,
        dateTimeOriginal: '2026-05-18T17:42:00Z',
        latitude: 37.7749,
        longitude: -122.4194,
        serialNumber: 'SONY-SERIAL-99882211',
      } as any,
      quality: { sharpness: 96, isBlurry: false },
      category: 'image',
    },
    {
      id: 'asset_002',
      name: 'Canon_R5_Editorial_Burst.cr3',
      sizeBytes: 38200000,
      mimeType: 'image/x-canon-cr3',
      source: 'cloud',
      thumbnailUrl: 'blob:sample2',
      rating: 4,
      cullingStatus: 'picked',
      colorLabel: 'yellow',
      tags: ['studio', 'fashion'],
      faces: [{ label: 'Sarah', count: 1 }],
      exif: {
        camera: 'Canon EOS R5',
        lens: 'RF 85mm F1.2L USM',
        dateTimeOriginal: '2026-05-18T18:10:00Z',
        latitude: 34.0522,
        longitude: -118.2437,
      } as any,
      quality: { sharpness: 98, isBlurry: false },
      category: 'raw',
    },
  ] as any;

  test('provides all 3 pro export presets (Web Pro 2048px, Social 1080px, Print Full-Res)', () => {
    assert.strictEqual(EXPORT_PRESETS.length, 3);
    const ids = EXPORT_PRESETS.map((p) => p.id);
    assert.ok(ids.includes('web_2048'));
    assert.ok(ids.includes('instagram_portrait'));
    assert.ok(ids.includes('full_res_print'));
  });

  test('calculates accurate dimension downscaling for high-res captures', () => {
    const origW = 7008;
    const origH = 4672;
    const webDims = calculateFitDimensions(origW, origH, 2048);
    assert.strictEqual(webDims.width, 2048);
    assert.strictEqual(webDims.height, 1365);

    const socialDims = calculateFitDimensions(origW, origH, 1080);
    assert.strictEqual(socialDims.width, 1080);
    assert.strictEqual(socialDims.height, 720);
  });

  test('scrubs privacy metadata (GPS coordinates & camera serials) when enabled', () => {
    const sanitized = scrubExifPrivacy(sampleAssets[0], true, true);

    assert.strictEqual((sanitized.exif as any).latitude, undefined);
    assert.strictEqual((sanitized.exif as any).longitude, undefined);
    assert.strictEqual((sanitized.exif as any).serialNumber, undefined);
    assert.strictEqual(sanitized.exif?.camera, 'Sony ILCE-7M4');
    assert.strictEqual(sanitized.exif?.focalLength, '50mm');
  });

  test('retains camera metadata when privacy stripping is disabled', () => {
    const preserved = scrubExifPrivacy(sampleAssets[0], false, false);

    assert.strictEqual((preserved.exif as any).latitude, 37.7749);
    assert.strictEqual((preserved.exif as any).serialNumber, 'SONY-SERIAL-99882211');
  });

  test('computes watermark positioning across corners with custom margins', () => {
    const canvasW = 2048;
    const canvasH = 1366;
    const wmW = 300;
    const wmH = 60;
    const margin = 24;

    const br = computeWatermarkPosition(canvasW, canvasH, wmW, wmH, 'bottom-right', margin);
    assert.strictEqual(br.x, 2048 - 300 - 24);
    assert.strictEqual(br.y, 1366 - 60 - 24);

    const center = computeWatermarkPosition(canvasW, canvasH, wmW, wmH, 'center', margin);
    assert.strictEqual(center.x, Math.round((2048 - 300) / 2));
    assert.strictEqual(center.y, Math.round((1366 - 60) / 2));
  });

  test('packages batch export files into a valid ZIP archive Uint8Array', async () => {
    const files = [
      { filename: 'Web_001.jpg', data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) },
      { filename: 'Web_002.jpg', data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) },
    ];
    const zipBytes = await packageBatchExportZip(files);
    assert.ok(zipBytes instanceof Uint8Array);
    assert.ok(zipBytes.byteLength > 100);
    // Standard ZIP local file header signature: PK\x03\x04
    assert.strictEqual(zipBytes[0], 0x50);
    assert.strictEqual(zipBytes[1], 0x4b);
    assert.strictEqual(zipBytes[2], 0x03);
    assert.strictEqual(zipBytes[3], 0x04);
  });
});
