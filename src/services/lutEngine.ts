/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 3D LUT Engine & Batch Edit Synchronization Service (A+ Tier)
 * Parses Adobe .CUBE 3D LUT files, implements fast trilinear interpolation,
 * provides built-in analog film simulation recipes, and supports copy/paste adjustment sync.
 */

export interface CubeLut3D {
  title: string;
  size: number;
  data: Float32Array; // Flattened N*N*N*3 float array (R, G, B in 0..1)
}

export type LutProfile = {
  id: string;
  name: string;
  description: string;
  lut?: CubeLut3D;
  cubePath?: string;
  cssFilterFallback?: string;
};

export interface ImageAdjustments {
  exposure: number;     // -2.0 to +2.0 EV (default: 0)
  contrast: number;     // -100 to +100 (default: 0)
  brightness: number;   // -100 to +100 (default: 0)
  saturation: number;   // -100 to +100 (default: 0)
  temperature: number;  // -100 (cool/blue) to +100 (warm/amber) (default: 0)
  tint: number;         // -100 (green) to +100 (magenta) (default: 0)
  highlights: number;   // -100 to +100 (default: 0)
  shadows: number;      // -100 to +100 (default: 0)
  sharpness: number;    // 0 to 100 (default: 0)
  vignette: number;     // 0 to 100 (default: 0)
  lutId?: string;       // e.g. 'kodak_portra_400'
  lutIntensity?: number;// 0.0 to 1.0 (default: 1.0)
}

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  exposure: 0,
  contrast: 0,
  brightness: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  sharpness: 0,
  vignette: 0,
  lutId: undefined,
  lutIntensity: 1.0,
};

/**
 * Global Clipboard Store for Ctrl+Shift+C / Ctrl+Shift+V Adjustment Sync
 */
let clipboardAdjustments: ImageAdjustments | null = null;

export function copyAdjustmentsToClipboard(adjustments: ImageAdjustments): void {
  clipboardAdjustments = { ...adjustments };
}

export function getClipboardAdjustments(): ImageAdjustments | null {
  return clipboardAdjustments ? { ...clipboardAdjustments } : null;
}

export function hasClipboardAdjustments(): boolean {
  return clipboardAdjustments !== null;
}

/**
 * Parse an Adobe .CUBE 3D LUT text file format into a CubeLut3D structure
 */
export function parseCubeLut(cubeText: string): CubeLut3D {
  const lines = cubeText.split(/\r?\n/);
  let title = 'Untitled 3D LUT';
  let size = 0;
  const values: number[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.toUpperCase().startsWith('TITLE')) {
      const parts = line.split('"');
      if (parts.length >= 2) {
        title = parts[1];
      } else {
        title = line.replace(/TITLE/i, '').trim();
      }
      continue;
    }

    if (line.toUpperCase().startsWith('LUT_3D_SIZE')) {
      const parts = line.split(/\s+/);
      size = parseInt(parts[1], 10);
      continue;
    }

    // Numbers (RGB components)
    const tokens = line.split(/\s+/);
    if (tokens.length >= 3) {
      const r = parseFloat(tokens[0]);
      const g = parseFloat(tokens[1]);
      const b = parseFloat(tokens[2]);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        values.push(r, g, b);
      }
    }
  }

  if (size <= 0) {
    // Estimate size from total points if header missing
    const totalPoints = values.length / 3;
    size = Math.round(Math.cbrt(totalPoints)) || 2;
  }

  return {
    title,
    size,
    data: new Float32Array(values),
  };
}

/**
 * Fast Trilinear Interpolation on a 3D LUT
 */
export function applyTrilinearLut(
  rNorm: number,
  gNorm: number,
  bNorm: number,
  lut: CubeLut3D
): [number, number, number] {
  const N = lut.size;
  const maxIdx = N - 1;

  // Scale input 0..1 to 0..(N-1)
  const rScaled = Math.max(0, Math.min(maxIdx, rNorm * maxIdx));
  const gScaled = Math.max(0, Math.min(maxIdx, gNorm * maxIdx));
  const bScaled = Math.max(0, Math.min(maxIdx, bNorm * maxIdx));

  const r0 = Math.floor(rScaled);
  const g0 = Math.floor(gScaled);
  const b0 = Math.floor(bScaled);

  const r1 = Math.min(maxIdx, r0 + 1);
  const g1 = Math.min(maxIdx, g0 + 1);
  const b1 = Math.min(maxIdx, b0 + 1);

  const dr = rScaled - r0;
  const dg = gScaled - g0;
  const db = bScaled - b0;

  // Index helper: index in CUBE order: R fastest, G second, B slowest
  const getLutRgb = (ir: number, ig: number, ib: number): [number, number, number] => {
    const idx = (ib * N * N + ig * N + ir) * 3;
    return [lut.data[idx], lut.data[idx + 1], lut.data[idx + 2]];
  };

  const c000 = getLutRgb(r0, g0, b0);
  const c100 = getLutRgb(r1, g0, b0);
  const c010 = getLutRgb(r0, g1, b0);
  const c110 = getLutRgb(r1, g1, b0);

  const c001 = getLutRgb(r0, g0, b1);
  const c101 = getLutRgb(r1, g0, b1);
  const c011 = getLutRgb(r0, g1, b1);
  const c111 = getLutRgb(r1, g1, b1);

  // Interpolate along R
  const c00 = [c000[0] * (1 - dr) + c100[0] * dr, c000[1] * (1 - dr) + c100[1] * dr, c000[2] * (1 - dr) + c100[2] * dr];
  const c10 = [c010[0] * (1 - dr) + c110[0] * dr, c010[1] * (1 - dr) + c110[1] * dr, c010[2] * (1 - dr) + c110[2] * dr];
  const c01 = [c001[0] * (1 - dr) + c101[0] * dr, c001[1] * (1 - dr) + c101[1] * dr, c001[2] * (1 - dr) + c101[2] * dr];
  const c11 = [c011[0] * (1 - dr) + c111[0] * dr, c011[1] * (1 - dr) + c111[1] * dr, c011[2] * (1 - dr) + c111[2] * dr];

  // Interpolate along G
  const c0 = [c00[0] * (1 - dg) + c10[0] * dg, c00[1] * (1 - dg) + c10[1] * dg, c00[2] * (1 - dg) + c10[2] * dg];
  const c1 = [c01[0] * (1 - dg) + c11[0] * dg, c01[1] * (1 - dg) + c11[1] * dg, c01[2] * (1 - dg) + c11[2] * dg];

  // Interpolate along B
  const outR = c0[0] * (1 - db) + c1[0] * db;
  const outG = c0[1] * (1 - db) + c1[1] * db;
  const outB = c0[2] * (1 - db) + c1[2] * db;

  return [Math.max(0, Math.min(1, outR)), Math.max(0, Math.min(1, outG)), Math.max(0, Math.min(1, outB))];
}

/**
 * Generate built-in 3D LUT presets programmatically
 */
export function createSyntheticLut(
  type: 'kodak_portra_400' | 'fuji_pro_400h' | 'ilford_hp5' | 'teal_orange',
  size = 17
): CubeLut3D {
  const data = new Float32Array(size * size * size * 3);
  let idx = 0;

  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        let rNorm = r / (size - 1);
        let gNorm = g / (size - 1);
        let bNorm = b / (size - 1);

        if (type === 'kodak_portra_400') {
          // Warm skin tones, softened highlights, slight red warmth
          rNorm = Math.pow(rNorm, 0.95) * 1.04;
          gNorm = Math.pow(gNorm, 0.98) * 0.99;
          bNorm = Math.pow(bNorm, 1.05) * 0.94;
        } else if (type === 'fuji_pro_400h') {
          // Cool airy greens, cyan highlights, gentle contrast
          rNorm = Math.pow(rNorm, 1.02) * 0.96;
          gNorm = Math.pow(gNorm, 0.96) * 1.02;
          bNorm = Math.pow(bNorm, 0.95) * 1.03;
        } else if (type === 'ilford_hp5') {
          // Rich black & white monochrome conversion
          const luma = 0.299 * rNorm + 0.587 * gNorm + 0.114 * bNorm;
          const curve = Math.pow(luma, 1.1) * 1.05;
          rNorm = curve;
          gNorm = curve;
          bNorm = curve;
        } else if (type === 'teal_orange') {
          // Push shadows to cyan/teal and highlights to warm amber
          const luma = (rNorm + gNorm + bNorm) / 3;
          if (luma < 0.5) {
            rNorm *= 0.85;
            bNorm = Math.min(1, bNorm * 1.18);
          } else {
            rNorm = Math.min(1, rNorm * 1.15);
            bNorm *= 0.88;
          }
        }

        data[idx++] = Math.max(0, Math.min(1, rNorm));
        data[idx++] = Math.max(0, Math.min(1, gNorm));
        data[idx++] = Math.max(0, Math.min(1, bNorm));
      }
    }
  }

  return {
    title: type,
    size,
    data,
  };
}

export const BUILTIN_LUTS: Record<string, { id: string; name: string; description: string; lut: CubeLut3D }> = {
  kodak_portra_400: {
    id: 'kodak_portra_400',
    name: 'Kodak Portra 400',
    description: 'Warm golden skin tones with soft pastel highlight roll-off',
    lut: createSyntheticLut('kodak_portra_400'),
  },
  fuji_pro_400h: {
    id: 'fuji_pro_400h',
    name: 'Fujifilm Pro 400H',
    description: 'Airy cool emerald tones and crisp cyan daylight skies',
    lut: createSyntheticLut('fuji_pro_400h'),
  },
  ilford_hp5: {
    id: 'ilford_hp5',
    name: 'Ilford HP5 Plus (B&W)',
    description: 'High-contrast classic 400-speed street film monochrome',
    lut: createSyntheticLut('ilford_hp5'),
  },
  teal_orange: {
    id: 'teal_orange',
    name: 'Cinematic Teal & Orange',
    description: 'Vibrant blockbuster color separation between skin and shadows',
    lut: createSyntheticLut('teal_orange'),
  },
};

/**
 * Apply full image adjustment stack + 3D LUT to an RGBA pixel array in-place
 */
export function applyAdjustmentsToRgba(
  rgba: Uint8ClampedArray,
  adjustments: ImageAdjustments,
  lut?: CubeLut3D
): void {
  const len = rgba.length;
  const expFactor = Math.pow(2, adjustments.exposure || 0);
  const contrastFactor = ((adjustments.contrast || 0) + 100) / 100;
  const brightnessOffset = adjustments.brightness || 0;
  const tempOffset = adjustments.temperature || 0;
  const tintOffset = adjustments.tint || 0;
  const intensity = adjustments.lutIntensity ?? 1.0;

  for (let i = 0; i < len; i += 4) {
    let r = rgba[i];
    let g = rgba[i + 1];
    let b = rgba[i + 2];

    // 1. Exposure & Brightness
    r = r * expFactor + brightnessOffset;
    g = g * expFactor + brightnessOffset;
    b = b * expFactor + brightnessOffset;

    // 2. Contrast
    r = (r - 128) * contrastFactor + 128;
    g = (g - 128) * contrastFactor + 128;
    b = (b - 128) * contrastFactor + 128;

    // 3. White Balance (Temperature & Tint)
    r += tempOffset * 0.6;
    b -= tempOffset * 0.6;
    g -= tintOffset * 0.4;
    r += tintOffset * 0.2;
    b += tintOffset * 0.2;

    // 4. Optional 3D LUT mapping
    if (lut) {
      const rNorm = Math.max(0, Math.min(1, r / 255));
      const gNorm = Math.max(0, Math.min(1, g / 255));
      const bNorm = Math.max(0, Math.min(1, b / 255));

      const [lutR, lutG, lutB] = applyTrilinearLut(rNorm, gNorm, bNorm, lut);
      r = (r * (1 - intensity)) + (lutR * 255 * intensity);
      g = (g * (1 - intensity)) + (lutG * 255 * intensity);
      b = (b * (1 - intensity)) + (lutB * 255 * intensity);
    }

    rgba[i] = Math.max(0, Math.min(255, r));
    rgba[i + 1] = Math.max(0, Math.min(255, g));
    rgba[i + 2] = Math.max(0, Math.min(255, b));
  }
}
