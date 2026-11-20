/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 3D LUT Engine & Adjustment Synchronization Unit Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCubeLut,
  applyTrilinearLut,
  createSyntheticLut,
  BUILTIN_LUTS,
  applyAdjustmentsToRgba,
  copyAdjustmentsToClipboard,
  getClipboardAdjustments,
  hasClipboardAdjustments,
  DEFAULT_ADJUSTMENTS,
  ImageAdjustments,
} from '../src/services/lutEngine';

describe('3D LUT Engine & Adjustment Synchronization Suite', () => {
  it('parses Adobe .CUBE 3D LUT text specifications accurately', () => {
    const mockCubeText = `
# Kodak Portra 400 Simulation
TITLE "Portra 400 Standard"
LUT_3D_SIZE 2

0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0
    `;

    const parsed = parseCubeLut(mockCubeText);
    assert.equal(parsed.title, 'Portra 400 Standard');
    assert.equal(parsed.size, 2);
    assert.equal(parsed.data.length, 2 * 2 * 2 * 3); // 24 floats
    assert.equal(parsed.data[0], 0.0);
    assert.equal(parsed.data[3], 1.0);
  });

  it('performs trilinear interpolation mapping on 3D color cube', () => {
    const lut = createSyntheticLut('teal_orange', 5);
    assert.equal(lut.size, 5);

    // Map midtone gray (0.5, 0.5, 0.5)
    const [r, g, b] = applyTrilinearLut(0.5, 0.5, 0.5, lut);
    assert.ok(r >= 0 && r <= 1);
    assert.ok(g >= 0 && g <= 1);
    assert.ok(b >= 0 && b <= 1);
  });

  it('provides built-in Kodak Portra 400 and Fuji Pro 400H film recipes', () => {
    assert.ok(BUILTIN_LUTS.kodak_portra_400);
    assert.ok(BUILTIN_LUTS.fuji_pro_400h);
    assert.ok(BUILTIN_LUTS.ilford_hp5);
    assert.ok(BUILTIN_LUTS.teal_orange);

    // Ilford HP5 converts color to monochrome (r == g == b)
    const hp5Lut = BUILTIN_LUTS.ilford_hp5.lut;
    const [r, g, b] = applyTrilinearLut(0.8, 0.2, 0.1, hp5Lut);
    assert.ok(Math.abs(r - g) < 0.05, 'B&W channels should be nearly identical');
    assert.ok(Math.abs(g - b) < 0.05, 'B&W channels should be nearly identical');
  });

  it('manages copy/paste adjustment sync clipboard across burst captures', () => {
    const customAdjustments: ImageAdjustments = {
      ...DEFAULT_ADJUSTMENTS,
      exposure: 0.65,
      contrast: 15,
      temperature: 10,
      lutId: 'kodak_portra_400',
    };

    copyAdjustmentsToClipboard(customAdjustments);
    assert.equal(hasClipboardAdjustments(), true);

    const pasted = getClipboardAdjustments();
    assert.ok(pasted);
    assert.equal(pasted?.exposure, 0.65);
    assert.equal(pasted?.contrast, 15);
    assert.equal(pasted?.lutId, 'kodak_portra_400');
  });

  it('applies exposure, contrast, temperature and LUT in-place to RGBA pixels', () => {
    const rgba = new Uint8ClampedArray([
      128, 128, 128, 255, // midtone gray
      200, 100, 50,  255, // warm orange
    ]);

    const adjustments: ImageAdjustments = {
      ...DEFAULT_ADJUSTMENTS,
      exposure: 0.5,
      brightness: 10,
      temperature: 15,
      lutId: 'kodak_portra_400',
    };

    const lut = BUILTIN_LUTS.kodak_portra_400.lut;
    applyAdjustmentsToRgba(rgba, adjustments, lut);

    // Check pixel 1 has been warmed up and brightened
    assert.ok(rgba[0] > 128, 'Red channel should increase');
    assert.equal(rgba[3], 255, 'Alpha must remain opaque');
  });
});
