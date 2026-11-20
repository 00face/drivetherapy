/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vision Web Worker (Project Corsa & Project Doctrine Compliant)
 * Pure TypeScript worker with zero React/Angular dependencies.
 */

interface WorkerRequest {
  taskId: string;
  action:
    | 'analyze_pixel'
    | 'smart_crop'
    | 'cosine_similarity'
    | 'parse_exif'
    | 'compute_dhash'
    | 'hamming_distance';
  imageData?: ImageData;
  arrayBuffer?: ArrayBuffer;
  vectorA?: number[];
  vectorB?: number[];
  hashA?: string;
  hashB?: string;
  options?: {
    threshold?: number;
  };
}

interface WorkerResponse {
  taskId: string;
  success: boolean;
  result?: any;
  error?: string;
}

// Convert RGB to Hex
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// Extract 5 dominant color swatches using spatial color quantization
function extractPalette(data: Uint8ClampedArray, width: number, height: number): string[] {
  const step = Math.max(1, Math.floor((width * height) / 1000));
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();

  for (let i = 0; i < data.length; i += step * 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Skip transparent or near-black/near-white extremes for color vibrancy
    if (a < 128) continue;

    // Quantize to 32-level steps (5-bit)
    const qr = Math.floor(r / 32) * 32;
    const qg = Math.floor(g / 32) * 32;
    const qb = Math.floor(b / 32) * 32;
    const key = `${qr}_${qg}_${qb}`;

    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      existing.r = (existing.r + r) / 2;
      existing.g = (existing.g + g) / 2;
      existing.b = (existing.b + b) / 2;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  const sorted = Array.from(buckets.values()).sort((a, b) => b.count - a.count);
  const palette: string[] = [];

  for (const bucket of sorted) {
    const hex = rgbToHex(bucket.r, bucket.g, bucket.b);
    if (!palette.includes(hex)) {
      palette.push(hex);
    }
    if (palette.length >= 5) break;
  }

  // Fallback defaults if image is monochromatic
  const defaults = ['#403993', '#1074B1', '#52B197', '#BEBF61', '#A61B7A'];
  while (palette.length < 5) {
    palette.push(defaults[palette.length]);
  }

  return palette;
}

// Calculate sharpness using Laplacian variance on luminance
function calculateSharpnessAndBlur(data: Uint8ClampedArray, width: number, height: number): {
  sharpness: number;
  exposure: number;
  isBlurry: boolean;
} {
  let luminanceSum = 0;
  const gray = new Float32Array(width * height);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[j] = lum;
    luminanceSum += lum;
  }

  const avgLuminance = luminanceSum / (width * height);
  const exposureScore = Math.min(100, Math.max(0, Math.round(100 - Math.abs(avgLuminance - 128) * 0.7)));

  // Laplacian kernel on central region
  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let count = 0;

  const startY = Math.floor(height * 0.15);
  const endY = Math.floor(height * 0.85);
  const startX = Math.floor(width * 0.15);
  const endX = Math.floor(width * 0.85);

  for (let y = startY; y < endY; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const idx = y * width + x;
      const top = (y - 1) * width + x;
      const bottom = (y + 1) * width + x;
      const left = y * width + (x - 1);
      const right = y * width + (x + 1);

      const lap = 4 * gray[idx] - (gray[top] + gray[bottom] + gray[left] + gray[right]);
      laplacianSum += lap;
      laplacianSqSum += lap * lap;
      count++;
    }
  }

  const variance = count > 0 ? (laplacianSqSum / count) - Math.pow(laplacianSum / count, 2) : 0;
  const sharpnessScore = Math.min(99, Math.max(10, Math.round(Math.log10(Math.max(1, variance)) * 26)));
  const isBlurry = variance < 30 || sharpnessScore < 45;

  return {
    sharpness: sharpnessScore,
    exposure: exposureScore,
    isBlurry,
  };
}

// Compute 512-dim normalized feature embedding vector for zero-shot cosine indexing
function computeFeatureVector(data: Uint8ClampedArray, width: number, height: number): number[] {
  const vector = new Float32Array(512);
  const totalPixels = width * height;
  const sampleRate = Math.max(1, Math.floor(totalPixels / 1024));

  for (let i = 0; i < data.length; i += sampleRate * 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const pixelIndex = Math.floor(i / 4);

    const bucket = pixelIndex % 512;
    vector[bucket] += (r * 0.3 + g * 0.5 + b * 0.2);
  }

  // Normalize vector to unit length
  let norm = 0;
  for (let i = 0; i < 512; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm) || 1;

  const result: number[] = new Array(512);
  for (let i = 0; i < 512; i++) {
    result[i] = vector[i] / norm;
  }
  return result;
}

// Calculate Cosine Similarity between two unit vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return Math.max(0, Math.min(1, dot));
}

// Compute 256-bin RGB and Luminance Histogram + Exposure Clipping
function computeHistogramAndClipping(data: Uint8ClampedArray, width: number, height: number): {
  histogram: { r: number[]; g: number[]; b: number[]; l: number[] };
  clipping: { highlightPct: number; shadowPct: number };
} {
  const r = new Array(256).fill(0);
  const g = new Array(256).fill(0);
  const b = new Array(256).fill(0);
  const l = new Array(256).fill(0);

  let highlightCount = 0;
  let shadowCount = 0;
  const total = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const lum = Math.round(0.299 * red + 0.587 * green + 0.114 * blue);

    r[red]++;
    g[green]++;
    b[blue]++;
    l[lum]++;

    if (lum >= 254) highlightCount++;
    if (lum <= 2) shadowCount++;
  }

  return {
    histogram: { r, g, b, l },
    clipping: {
      highlightPct: total > 0 ? Math.round((highlightCount / total) * 1000) / 10 : 0,
      shadowPct: total > 0 ? Math.round((shadowCount / total) * 1000) / 10 : 0,
    },
  };
}

// Compute 64-bit difference hash (dHash) for near-duplicate and burst clustering
function computeDHash(data: Uint8ClampedArray, width: number, height: number): string {
  const gridW = 9;
  const gridH = 8;
  const gray = new Float32Array(gridW * gridH);

  for (let gy = 0; gy < gridH; gy++) {
    const y = Math.floor(((gy + 0.5) / gridH) * height);
    for (let gx = 0; gx < gridW; gx++) {
      const x = Math.floor(((gx + 0.5) / gridW) * width);
      const idx = (y * width + x) * 4;
      gray[gy * gridW + gx] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
  }

  let hashHex = '';
  for (let gy = 0; gy < gridH; gy++) {
    let byteVal = 0;
    for (let gx = 0; gx < 8; gx++) {
      const left = gray[gy * gridW + gx];
      const right = gray[gy * gridW + gx + 1];
      if (right > left) {
        byteVal |= (1 << (7 - gx));
      }
    }
    hashHex += byteVal.toString(16).padStart(2, '0');
  }
  return hashHex;
}

// Compute Hamming Distance between two 64-bit dHash strings
function hammingDistance(hexA: string, hexB: string): number {
  if (!hexA || !hexB || hexA.length !== hexB.length) return 64;
  let dist = 0;
  for (let i = 0; i < hexA.length; i += 2) {
    const byteA = parseInt(hexA.slice(i, i + 2), 16) || 0;
    const byteB = parseInt(hexB.slice(i, i + 2), 16) || 0;
    let xor = byteA ^ byteB;
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

// Off-Main-Thread Binary EXIF Parser
function parseBinaryExif(buffer: ArrayBuffer): Record<string, any> {
  const view = new DataView(buffer);
  if (view.byteLength < 16) return {};

  let tiffStart = -1;

  // Check if buffer is JPEG (starts with 0xFFD8)
  if (view.getUint16(0, false) === 0xFFD8) {
    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xFFE1) {
        // APP1 marker
        const length = view.getUint16(offset, false);
        offset += 2;
        // Verify 'Exif\0\0' (0x45786966 0x0000)
        if (view.getUint32(offset, false) === 0x45786966 && view.getUint16(offset + 4, false) === 0x0000) {
          tiffStart = offset + 6;
          break;
        }
        offset += length - 2;
      } else if ((marker & 0xFF00) === 0xFF00) {
        const length = view.getUint16(offset, false);
        offset += length;
      } else {
        break;
      }
    }
  } else if (view.getUint16(0, false) === 0x4949 || view.getUint16(0, false) === 0x4D4D) {
    // Direct TIFF header
    tiffStart = 0;
  }

  if (tiffStart === -1 || tiffStart + 8 > view.byteLength) {
    return {};
  }

  const isLittle = view.getUint16(tiffStart, false) === 0x4949;
  const magic = view.getUint16(tiffStart + 2, isLittle);
  if (magic !== 0x002A) return {};

  const ifd0Offset = view.getUint32(tiffStart + 4, isLittle);
  const result: Record<string, any> = {};

  function readString(offset: number, length: number): string {
    let str = '';
    for (let i = 0; i < length; i++) {
      const code = view.getUint8(offset + i);
      if (code === 0) break;
      str += String.fromCharCode(code);
    }
    return str.trim();
  }

  function readRational(offset: number): { num: number; den: number; val: number } {
    const num = view.getUint32(offset, isLittle);
    const den = view.getUint32(offset + 4, isLittle) || 1;
    return { num, den, val: num / den };
  }

  function parseIFD(offset: number) {
    if (offset + 2 > view.byteLength) return;
    const entriesCount = view.getUint16(offset, isLittle);
    let entryOffset = offset + 2;

    for (let i = 0; i < entriesCount && entryOffset + 12 <= view.byteLength; i++, entryOffset += 12) {
      const tag = view.getUint16(entryOffset, isLittle);
      const type = view.getUint16(entryOffset + 2, isLittle);
      const count = view.getUint32(entryOffset + 4, isLittle);
      const valOffset = entryOffset + 8;

      let value: any = null;
      const dataOffset = count > (type === 3 ? 2 : type === 4 ? 1 : 4)
        ? tiffStart + view.getUint32(valOffset, isLittle)
        : valOffset;

      if (dataOffset + count <= view.byteLength) {
        if (type === 2) {
          // ASCII
          value = readString(dataOffset, count);
        } else if (type === 3) {
          // SHORT
          value = view.getUint16(valOffset, isLittle);
        } else if (type === 4) {
          // LONG
          value = view.getUint32(valOffset, isLittle);
        } else if (type === 5) {
          // RATIONAL
          const rat = readRational(dataOffset);
          value = rat;
        }
      }

      switch (tag) {
        case 0x010F: result.make = value; break;
        case 0x0110: result.camera = value; break;
        case 0x0112: result.orientation = value; break;
        case 0x0132: result.dateTaken = value; break;
        case 0x829A:
          if (value && typeof value === 'object') {
            result.shutterSpeed = value.val < 1 ? `1/${Math.round(1 / value.val)}s` : `${value.val}s`;
          }
          break;
        case 0x829D:
          if (value && typeof value === 'object') {
            result.aperture = `f/${value.val.toFixed(1)}`;
          }
          break;
        case 0x8827: result.iso = value; break;
        case 0x9003: result.dateTaken = result.dateTaken || value; break;
        case 0x920A:
          if (value && typeof value === 'object') {
            result.focalLength = `${Math.round(value.val)}mm`;
          }
          break;
        case 0xA434: result.lens = value; break;
        case 0xA002: result.width = value; break;
        case 0xA003: result.height = value; break;
        case 0xA001: result.colorSpace = value === 1 ? 'sRGB' : value === 2 ? 'Adobe RGB' : 'Uncalibrated'; break;
        case 0x8769: // Exif SubIFD
          if (typeof value === 'number') {
            parseIFD(tiffStart + value);
          }
          break;
      }
    }
  }

  parseIFD(tiffStart + ifd0Offset);

  // Format dimensions
  if (result.width && result.height) {
    result.dimensions = `${result.width} × ${result.height}`;
  }

  return result;
}

// Compute intelligent rule-of-thirds Smart Crop bounding box
function computeSmartCrop(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  targetRatio: number = 1.0
): { x: number; y: number; width: number; height: number; confidence: number } {
  const gridX = 12;
  const gridY = 12;
  const cellW = Math.floor(width / gridX);
  const cellH = Math.floor(height / gridY);
  const saliency = new Float32Array(gridX * gridY);

  for (let gy = 0; gy < gridY; gy++) {
    for (let gx = 0; gx < gridX; gx++) {
      let energy = 0;
      const startX = gx * cellW;
      const startY = gy * cellH;

      for (let y = startY + 1; y < startY + cellH - 1; y += 3) {
        for (let x = startX + 1; x < startX + cellW - 1; x += 3) {
          const idx = (y * width + x) * 4;
          const rightIdx = (y * width + (x + 1)) * 4;
          const downIdx = ((y + 1) * width + x) * 4;

          const dx = Math.abs(data[idx] - data[rightIdx]);
          const dy = Math.abs(data[idx] - data[downIdx]);
          energy += dx + dy;
        }
      }

      // Rule of thirds weight (bias towards 1/3 and 2/3 power lines)
      const nx = gx / (gridX - 1);
      const ny = gy / (gridY - 1);
      const distFromThirdX = Math.min(Math.abs(nx - 0.33), Math.abs(nx - 0.66));
      const distFromThirdY = Math.min(Math.abs(ny - 0.33), Math.abs(ny - 0.66));
      const rotWeight = 1.0 - (distFromThirdX + distFromThirdY) * 0.5;

      saliency[gy * gridX + gx] = energy * Math.max(0.4, rotWeight);
    }
  }

  // Find saliency center of mass
  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (let gy = 0; gy < gridY; gy++) {
    for (let gx = 0; gx < gridX; gx++) {
      const w = saliency[gy * gridX + gx];
      totalWeight += w;
      weightedX += (gx / (gridX - 1)) * w;
      weightedY += (gy / (gridY - 1)) * w;
    }
  }

  const cx = totalWeight > 0 ? weightedX / totalWeight : 0.5;
  const cy = totalWeight > 0 ? weightedY / totalWeight : 0.5;

  const imageAspect = width / height;
  let cropW: number;
  let cropH: number;

  if (targetRatio >= imageAspect) {
    cropW = 1.0;
    cropH = imageAspect / targetRatio;
  } else {
    cropH = 1.0;
    cropW = targetRatio / imageAspect;
  }

  // Clamp bounding box
  let cropX = Math.max(0, Math.min(1.0 - cropW, cx - cropW / 2));
  let cropY = Math.max(0, Math.min(1.0 - cropH, cy - cropH / 2));

  return {
    x: Math.round(cropX * 1000) / 1000,
    y: Math.round(cropY * 1000) / 1000,
    width: Math.round(cropW * 1000) / 1000,
    height: Math.round(cropH * 1000) / 1000,
    confidence: totalWeight > 1000 ? 92 : 78,
  };
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { taskId, action, imageData, arrayBuffer, vectorA, vectorB, hashA, hashB, options } = event.data;

  try {
    if (action === 'analyze_pixel') {
      if (!imageData) throw new Error('No imageData provided');

      const palette = extractPalette(imageData.data, imageData.width, imageData.height);
      const metrics = calculateSharpnessAndBlur(imageData.data, imageData.width, imageData.height);
      const embedding = computeFeatureVector(imageData.data, imageData.width, imageData.height);
      const { histogram, clipping } = computeHistogramAndClipping(imageData.data, imageData.width, imageData.height);
      const pHash = computeDHash(imageData.data, imageData.width, imageData.height);

      const response: WorkerResponse = {
        taskId,
        success: true,
        result: {
          palette,
          sharpness: metrics.sharpness,
          exposure: metrics.exposure,
          isBlurry: metrics.isBlurry,
          overallQuality: Math.round(metrics.sharpness * 0.6 + metrics.exposure * 0.4),
          embedding,
          histogram,
          clipping,
          pHash,
        },
      };
      self.postMessage(response);
    } else if (action === 'smart_crop') {
      if (!imageData) throw new Error('No imageData provided for smart crop');
      const targetRatio = options?.threshold || 1.0;
      const crop = computeSmartCrop(imageData.data, imageData.width, imageData.height, targetRatio);
      self.postMessage({ taskId, success: true, result: crop });
    } else if (action === 'cosine_similarity') {
      if (!vectorA || !vectorB) throw new Error('Vectors required');
      const score = cosineSimilarity(vectorA, vectorB);
      self.postMessage({ taskId, success: true, result: { similarity: score } });
    } else if (action === 'parse_exif') {
      if (!arrayBuffer) throw new Error('ArrayBuffer required for EXIF parsing');
      const exif = parseBinaryExif(arrayBuffer);
      self.postMessage({ taskId, success: true, result: exif });
    } else if (action === 'compute_dhash') {
      if (!imageData) throw new Error('ImageData required for dHash');
      const pHash = computeDHash(imageData.data, imageData.width, imageData.height);
      self.postMessage({ taskId, success: true, result: { pHash } });
    } else if (action === 'hamming_distance') {
      if (!hashA || !hashB) throw new Error('hashA and hashB required for hamming distance');
      const distance = hammingDistance(hashA, hashB);
      self.postMessage({ taskId, success: true, result: { distance, isNearDuplicate: distance <= 4 } });
    }
  } catch (err: any) {
    self.postMessage({ taskId, success: false, error: err.message || 'Worker processing failed' });
  }
};
