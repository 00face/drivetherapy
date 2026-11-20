/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Zero-Key Offline Canvas Image Stylizer
 * Provides non-destructive artistic transformations (Anime cel-shading + Sobel ink edges,
 * Watercolor, Cyberpunk, Noir, Vintage, Pencil Sketch) purely in-browser with zero API keys.
 */

export type ArtStylePreset = 'anime' | 'watercolor' | 'cyberpunk' | 'noir' | 'vintage' | 'sketch';

export interface StylizedImageResult {
  dataUrl: string;
  style: ArtStylePreset;
  summary: string;
}

export function detectRequestedArtStyle(prompt: string): ArtStylePreset {
  const q = (prompt || '').toLowerCase();
  if (/\b(anime|manga|ghibli|cel[\s-]?shad|cartoon|cel)\b/.test(q)) return 'anime';
  if (/\b(watercolor|water[\s-]?color|pastel|painting|oil\s?paint|impressionist)\b/.test(q)) return 'watercolor';
  if (/\b(cyberpunk|neon|synthwave|vaporwave|sci[\s-]?fi|blade\s?runner)\b/.test(q)) return 'cyberpunk';
  if (/\b(noir|black\s*and\s*white|b&w|monochrome|sin\s?city)\b/.test(q)) return 'noir';
  if (/\b(sketch|pencil|charcoal|line\s?art|ink\s?drawing|drawing)\b/.test(q)) return 'sketch';
  if (/\b(vintage|retro|film|sepia|kodak|polaroid|90s|80s)\b/.test(q)) return 'vintage';
  return 'anime';
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function loadImageForCanvas(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image pixels for styling (check CORS or file availability).'));
    img.src = src;
  });
}

/**
 * Applies a real pixel-level artistic transformation onto an offscreen canvas
 * without mutating the original asset.
 */
export async function stylizeImageOffline(
  imageUrl: string,
  style: ArtStylePreset
): Promise<StylizedImageResult> {
  if (typeof document === 'undefined') {
    throw new Error('Offline canvas stylizer requires a browser environment.');
  }

  const img = await loadImageForCanvas(imageUrl);
  const maxDim = 960;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || 640) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || 480) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Precompute grayscale luminance buffer for edge detection (anime / sketch)
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  const edgeMag = new Float32Array(w * h);
  if (style === 'anime' || style === 'sketch') {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const gx =
          -gray[idx - w - 1] + gray[idx - w + 1] -
          2 * gray[idx - 1] + 2 * gray[idx + 1] -
          gray[idx + w - 1] + gray[idx + w + 1];
        const gy =
          -gray[idx - w - 1] - 2 * gray[idx - w] - gray[idx - w + 1] +
          gray[idx + w - 1] + 2 * gray[idx + w] + gray[idx + w + 1];
        edgeMag[idx] = Math.sqrt(gx * gx + gy * gy);
      }
    }
  }

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (style === 'anime') {
      // 1. Vibrant saturation lift
      const avg = (r + g + b) / 3;
      r = clampByte(avg + (r - avg) * 1.42 + 6);
      g = clampByte(avg + (g - avg) * 1.38 + 4);
      b = clampByte(avg + (b - avg) * 1.45 + 8);
      // 2. Cel-shading quantization (6 tonal steps)
      r = Math.round(r / 42) * 42;
      g = Math.round(g / 42) * 42;
      b = Math.round(b / 42) * 42;
      // 3. Crisp dark ink outlines on strong Sobel edges
      if (edgeMag[p] > 115) {
        const ink = Math.min(0.82, (edgeMag[p] - 115) / 140);
        r = clampByte(r * (1 - ink) + 22 * ink);
        g = clampByte(g * (1 - ink) + 18 * ink);
        b = clampByte(b * (1 - ink) + 34 * ink);
      }
    } else if (style === 'watercolor') {
      const avg = (r + g + b) / 3;
      r = clampByte(Math.round((avg + (r - avg) * 1.18 + 18) / 28) * 28);
      g = clampByte(Math.round((avg + (g - avg) * 1.15 + 16) / 28) * 28);
      b = clampByte(Math.round((avg + (b - avg) * 1.2 + 20) / 28) * 28);
    } else if (style === 'cyberpunk') {
      const lum = gray[p] / 255;
      r = clampByte(r * 1.15 + (1 - lum) * 35 + lum * 45);
      g = clampByte(g * 0.85 + lum * 55);
      b = clampByte(b * 1.35 + (1 - lum) * 75);
    } else if (style === 'noir') {
      const lum = gray[p];
      const contrasted = clampByte((lum - 128) * 1.48 + 128);
      r = contrasted;
      g = contrasted;
      b = contrasted;
    } else if (style === 'sketch') {
      const ink = clampByte(248 - edgeMag[p] * 1.15);
      r = ink;
      g = clampByte(ink - 3);
      b = clampByte(ink - 10);
    } else {
      // vintage film
      const nr = r * 0.96 + g * 0.12 + 14;
      const ng = r * 0.06 + g * 0.92 + b * 0.04 + 6;
      const nb = r * 0.04 + g * 0.08 + b * 0.78 + 12;
      r = clampByte(nr);
      g = clampByte(ng);
      b = clampByte(nb);
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  ctx.putImageData(imgData, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');

  const descriptions: Record<ArtStylePreset, string> = {
    anime: 'Applied non-destructive **Anime Cel-Shading** (vibrant tonal quantization + Sobel ink outlines).',
    watercolor: 'Applied non-destructive **Watercolor** (soft pigment quantization + pastel paper lift).',
    cyberpunk: 'Applied non-destructive **Cyberpunk Neon** (magenta/cyan split-tone contrast).',
    noir: 'Applied non-destructive **Film Noir** (high-contrast monochrome silver-halide curve).',
    sketch: 'Applied non-destructive **Pencil Sketch** (Sobel ink line extraction on warm paper).',
    vintage: 'Applied non-destructive **Retro Film** (warm Kodak-style color shift).',
  };

  return {
    dataUrl,
    style,
    summary: descriptions[style],
  };
}
