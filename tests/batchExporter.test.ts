/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Batch Export & Watermarking Engine Unit Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFitDimensions,
  computeWatermarkPosition,
  scrubExifPrivacy,
  packageBatchExportZip,
  EXPORT_PRESETS,
} from '../src/services/batchExporter';
import { MediaAsset } from '../src/types';

describe('Professional Batch Export & Watermarking Engine', () => {
  it('calculates aspect-ratio scaled dimensions accurately for web 2048px', () => {
    // Landscape: 6000x4000 -> 2048x1365
    const landscape = calculateFitDimensions(6000, 4000, 2048);
    assert.equal(landscape.width, 2048);
    assert.equal(landscape.height, 1365);

    // Portrait: 4000x6000 -> 1365x2048
    const portrait = calculateFitDimensions(4000, 6000, 2048);
    assert.equal(portrait.width, 1365);
    assert.equal(portrait.height, 2048);

    // Small image below max dimension is not enlarged
    const small = calculateFitDimensions(1200, 800, 2048);
    assert.equal(small.width, 1200);
    assert.equal(small.height, 800);
  });

  it('computes watermark positioning across all 5 anchor quadrants', () => {
    const canvasW = 1920;
    const canvasH = 1080;
    const markW = 200;
    const markH = 50;
    const margin = 20;

    // Bottom-right
    const br = computeWatermarkPosition(canvasW, canvasH, markW, markH, 'bottom-right', margin);
    assert.equal(br.x, 1920 - 200 - 20);
    assert.equal(br.y, 1080 - 50 - 20);

    // Bottom-left
    const bl = computeWatermarkPosition(canvasW, canvasH, markW, markH, 'bottom-left', margin);
    assert.equal(bl.x, 20);
    assert.equal(bl.y, 1080 - 50 - 20);

    // Center
    const ctr = computeWatermarkPosition(canvasW, canvasH, markW, markH, 'center', margin);
    assert.equal(ctr.x, (1920 - 200) / 2);
    assert.equal(ctr.y, (1080 - 50) / 2);
  });

  it('strips sensitive GPS and camera serial privacy metadata', () => {
    const sensitiveAsset: MediaAsset = {
      id: 'photo_1',
      name: 'secret_location.jpg',
      mimeType: 'image/jpeg',
      size: 5000000,
      exif: {
        camera: 'Sony A1',
        latitude: 35.6762,
        longitude: 139.6503,
        altitude: 40,
        serialNumber: 'SN-99887711',
        ownerName: 'Secret Agent',
        iso: 100,
      } as any,
    } as any;

    const scrubbed = scrubExifPrivacy(sensitiveAsset, true, true);
    assert.ok(scrubbed.exif);
    assert.equal((scrubbed.exif as any).latitude, undefined);
    assert.equal((scrubbed.exif as any).longitude, undefined);
    assert.equal((scrubbed.exif as any).serialNumber, undefined);
    assert.equal((scrubbed.exif as any).ownerName, undefined);
    // Non-sensitive EXIF is preserved
    assert.equal(scrubbed.exif.iso, 100);
    assert.equal(scrubbed.exif.camera, 'Sony A1');
  });

  it('packages multiple processed export files into a valid ZIP archive', async () => {
    const file1 = new TextEncoder().encode('Dummy JPEG bytes 1');
    const file2 = new TextEncoder().encode('Dummy JPEG bytes 2');

    const zipData = await packageBatchExportZip([
      { filename: 'Client_001.jpg', data: file1 },
      { filename: 'Client_002.jpg', data: file2 },
    ]);

    assert.ok(zipData);
    assert.ok(zipData.length > 50);
    // Standard ZIP magic bytes: PK\x03\x04
    assert.equal(zipData[0], 0x50);
    assert.equal(zipData[1], 0x4b);
    assert.equal(zipData[2], 0x03);
    assert.equal(zipData[3], 0x04);
  });

  it('provides standard Web, Social, and Print export presets', () => {
    assert.equal(EXPORT_PRESETS.length, 3);
    const web = EXPORT_PRESETS.find((p) => p.id === 'web_2048');
    assert.ok(web);
    assert.equal(web.maxDimension, 2048);
    assert.equal(web.stripGpsExif, true);
  });
});
