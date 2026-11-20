/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vision Web Worker Client
 * Async promise wrapper for off-main-thread vision, EXIF, and similarity rites.
 */

import { ExifMetadata, HistogramData } from '../types';

let workerInstance: Worker | null = null;
const pendingTasks = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

function getWorker(): Worker {
  if (!workerInstance && typeof window !== 'undefined') {
    workerInstance = new Worker(new URL('../workers/vision.worker.ts', import.meta.url), {
      type: 'module',
    });

    workerInstance.onmessage = (event: MessageEvent) => {
      const { taskId, success, result, error } = event.data;
      const handler = pendingTasks.get(taskId);
      if (handler) {
        pendingTasks.delete(taskId);
        if (success) {
          handler.resolve(result);
        } else {
          handler.reject(new Error(error || 'Worker task failed'));
        }
      }
    };

    workerInstance.onerror = (err) => {
      console.warn('Vision worker error:', err);
    };
  }
  return workerInstance!;
}

function dispatchTask<T>(action: string, payload: any, timeoutMs = 4000): Promise<T> {
  try {
    const worker = getWorker();
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pendingTasks.has(taskId)) {
          pendingTasks.delete(taskId);
          reject(new Error(`Vision worker task timed out (${action})`));
        }
      }, timeoutMs);

      pendingTasks.set(taskId, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      worker.postMessage({ taskId, action, ...payload });
    });
  } catch (err) {
    return Promise.reject(err);
  }
}

// Convert image URL to ImageData
async function getImageDataFromUrl(url: string, maxWidth = 800): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(1, maxWidth / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(32, Math.floor(img.naturalWidth * scale));
      const h = Math.max(32, Math.floor(img.naturalHeight * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      resolve(data);
    };
    img.onerror = () => reject(new Error('Failed to load image for worker analysis'));
    img.src = url;
  });
}

// Full Pixel Analysis
export async function analyzeImagePixels(url: string): Promise<{
  palette: string[];
  sharpness: number;
  exposure: number;
  isBlurry: boolean;
  overallQuality: number;
  embedding: number[];
  histogram: HistogramData;
  clipping: { highlightPct: number; shadowPct: number };
  pHash: string;
}> {
  const imageData = await getImageDataFromUrl(url);
  return dispatchTask('analyze_pixel', { imageData });
}

// Off-Main-Thread EXIF Parsing
export async function parseExifFromBuffer(buffer: ArrayBuffer): Promise<ExifMetadata> {
  return dispatchTask('parse_exif', { arrayBuffer: buffer });
}

export async function parseExifFromFile(file: File): Promise<ExifMetadata> {
  const slice = file.slice(0, 131072); // First 128KB contains EXIF APP1
  const buffer = await slice.arrayBuffer();
  return parseExifFromBuffer(buffer);
}

// Smart Crop Calculation
export async function calculateSmartCrop(
  url: string,
  targetRatio = 1.0
): Promise<{ x: number; y: number; width: number; height: number; confidence: number }> {
  const imageData = await getImageDataFromUrl(url, 400);
  return dispatchTask('smart_crop', { imageData, options: { threshold: targetRatio } });
}

// Cosine Similarity
export async function compareFeatureVectors(vectorA: number[], vectorB: number[]): Promise<number> {
  const res: { similarity: number } = await dispatchTask('cosine_similarity', { vectorA, vectorB });
  return res.similarity;
}

// dHash Hamming Distance
export async function compareDHash(
  hashA: string,
  hashB: string
): Promise<{ distance: number; isNearDuplicate: boolean }> {
  return dispatchTask('hamming_distance', { hashA, hashB });
}
