/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * RAW Demosaicing & Preview Engine Unit Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCameraRawFormat,
  detectRawFormat,
  extractEmbeddedJpegStream,
  demosaicBayerToRgba,
  decodeCameraRawBuffer,
} from '../src/services/rawDemosaicEngine';

describe('Native Camera RAW Demosaicing & Preview Engine', () => {
  it('identifies Sony, Canon, Nikon, Fuji, and DNG raw formats correctly', () => {
    assert.equal(isCameraRawFormat('DSC04921.ARW'), true);
    assert.equal(isCameraRawFormat('IMG_001.cr3'), true);
    assert.equal(isCameraRawFormat('_DSC9912.NEF'), true);
    assert.equal(isCameraRawFormat('FUJI1234.RAF'), true);
    assert.equal(isCameraRawFormat('RENDER.DNG'), true);
    assert.equal(isCameraRawFormat('standard_photo.jpg'), false);
    assert.equal(isCameraRawFormat('vector.svg'), false);
  });

  it('detects RAW format from magic headers', () => {
    // Canon CR3 ISO BMFF header: ....ftypcrx
    const cr3Header = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x63, 0x72, 0x78]);
    assert.equal(detectRawFormat(cr3Header, 'sample.cr3'), 'cr3');

    // Fuji RAF header: FUJIFILMCCD-RAW
    const rafHeader = new Uint8Array([0x46, 0x55, 0x4a, 0x49, 0x46, 0x49, 0x4c, 0x4d]);
    assert.equal(detectRawFormat(rafHeader, 'sample.raf'), 'raf');

    // Sony ARW TIFF II*.
    const arwHeader = new Uint8Array([0x49, 0x49, 0x2a, 0x00]);
    assert.equal(detectRawFormat(arwHeader, 'sony.arw'), 'arw');
  });

  it('extracts embedded JPEG preview streams from raw payloads', () => {
    // Create a mock buffer with an embedded JPEG stream (SOI 0xFFD8 to EOI 0xFFD9)
    const streamSize = 34 * 1024;
    const mockRaw = new Uint8Array(streamSize + 200);
    // Fill prefix with dummy metadata
    mockRaw.fill(0x55, 0, 100);
    // Write JPEG SOI at offset 100
    mockRaw[100] = 0xff;
    mockRaw[101] = 0xd8;
    mockRaw[102] = 0xff;
    mockRaw[103] = 0xe1; // Exif marker
    // Write JPEG EOI at offset 100 + streamSize
    const eoiIndex = 100 + streamSize - 2;
    mockRaw[eoiIndex] = 0xff;
    mockRaw[eoiIndex + 1] = 0xd9;

    const extracted = extractEmbeddedJpegStream(mockRaw);
    assert.ok(extracted);
    assert.equal(extracted.length, streamSize);
    assert.equal(extracted[0], 0xff);
    assert.equal(extracted[1], 0xd8);
    assert.equal(extracted[extracted.length - 2], 0xff);
    assert.equal(extracted[extracted.length - 1], 0xd9);
  });

  it('demosaics Bayer RGGB raw matrix into full 4-channel RGBA ImageData', () => {
    const width = 4;
    const height = 4;
    // 4x4 RGGB Bayer pattern (16 pixels)
    // Row 0: R G R G
    // Row 1: G B G B
    // Row 2: R G R G
    // Row 3: G B G B
    const bayer = new Uint8Array([
      255, 128, 255, 128,
      128, 64,  128, 64,
      255, 128, 255, 128,
      128, 64,  128, 64,
    ]);

    const rgba = demosaicBayerToRgba(bayer, width, height, { pattern: 'RGGB', gamma: 1.0 });
    assert.equal(rgba.length, width * height * 4);
    // Alpha channel must be 255 (opaque)
    assert.equal(rgba[3], 255);
    assert.equal(rgba[7], 255);
    assert.equal(rgba[11], 255);
    assert.equal(rgba[15], 255);
  });

  it('high-level decodeCameraRawBuffer returns structured metadata', async () => {
    const mockPayload = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]);
    const res = await decodeCameraRawBuffer(mockPayload, 'test.ARW');
    assert.equal(res.isRaw, true);
    assert.equal(res.rawFormat, 'arw');
    assert.equal(res.hasEmbeddedPreview, false);
  });
});
