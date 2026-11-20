/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CPU-Only & Mini Models Engine (Zero-Cost, Low-End Machine Friendly)
 * Lazy-loads lightweight browser WASM/ONNX engines only on demand:
 *  - Phase A: Tesseract.js WASM OCR + Local Ollama CPU model auto-discovery
 *  - Phase B: Transformers.js v3 WASM/q8 mini-models (SmolLM2, CLIP/ViT-GPT2, Whisper-tiny)
 */

export interface CpuMiniModelSpec {
  id: string;
  label: string;
  task: 'ocr' | 'image-caption' | 'text-chat' | 'code' | 'audio-transcribe' | 'vision-embedding';
  runtime: 'tesseract-wasm' | 'transformers-wasm' | 'ollama-cpu';
  approxSizeMb: number;
  recommendedForLowEndCpu: boolean;
  defaultIncluded: boolean;
  withModelBenefit: string;
  withoutModelFallback: string;
}

export const CPU_MINI_MODEL_CATALOG: CpuMiniModelSpec[] = [
  {
    id: 'tesseract-eng-wasm',
    label: 'Tesseract.js OCR (English WASM)',
    task: 'ocr',
    runtime: 'tesseract-wasm',
    approxSizeMb: 12,
    recommendedForLowEndCpu: true,
    defaultIncluded: true,
    withModelBenefit: 'Extracts searchable text from receipts, screenshots, and scanned PDFs offline on CPU.',
    withoutModelFallback: 'OCR uses Gemini Cloud (requires API key) or metadata filename fallback.',
  },
  {
    id: 'HuggingFaceTB/SmolLM2-135M-Instruct',
    label: 'SmolLM2 135M Instruct (Q4 WASM)',
    task: 'text-chat',
    runtime: 'transformers-wasm',
    approxSizeMb: 95,
    recommendedForLowEndCpu: true,
    defaultIncluded: true,
    withModelBenefit: 'Runs offline document summaries, action items, and G. Comms Q&A on any low-end CPU.',
    withoutModelFallback: 'Summaries fall back to instant deterministic metadata synthesis or Gemini Cloud.',
  },
  {
    id: 'Xenova/vit-gpt2-image-captioning',
    label: 'ViT-GPT2 Image Captioner (Q8 WASM)',
    task: 'image-caption',
    runtime: 'transformers-wasm',
    approxSizeMb: 140,
    recommendedForLowEndCpu: true,
    defaultIncluded: false,
    withModelBenefit: 'Generates offline WCAG alt-text and descriptive captions for photos without cloud keys.',
    withoutModelFallback: 'Alt-text uses EXIF/filename templates or Gemini Vision when connected.',
  },
  {
    id: 'Xenova/whisper-tiny.en',
    label: 'Whisper Tiny EN (Q8 WASM)',
    task: 'audio-transcribe',
    runtime: 'transformers-wasm',
    approxSizeMb: 42,
    recommendedForLowEndCpu: true,
    defaultIncluded: false,
    withModelBenefit: 'Transcribes voice memos, interviews, and video audio locally on CPU.',
    withoutModelFallback: 'Audio transcription requires Gemini Cloud or manual notes.',
  },
  {
    id: 'qwen2.5:0.5b',
    label: 'Ollama Qwen 2.5 0.5B (CPU)',
    task: 'text-chat',
    runtime: 'ollama-cpu',
    approxSizeMb: 398,
    recommendedForLowEndCpu: true,
    defaultIncluded: true,
    withModelBenefit: 'Fast local Ollama chat, tagging, and NotebookLM drafting with zero cloud cost.',
    withoutModelFallback: 'Uses browser SmolLM2 (if enabled) or Gemini Cloud API.',
  },
  {
    id: 'qwen2.5-coder:1.5b',
    label: 'Ollama Qwen 2.5 Coder 1.5B (CPU)',
    task: 'code',
    runtime: 'ollama-cpu',
    approxSizeMb: 986,
    recommendedForLowEndCpu: true,
    defaultIncluded: false,
    withModelBenefit: 'Assists with batch rename tokens, GLSL shaders, CSV transforms, and script snippets offline.',
    withoutModelFallback: 'Code/script assistance routes to Gemini Cloud or standard presets.',
  },
  {
    id: 'moondream',
    label: 'Ollama Moondream 1.8B Vision (CPU)',
    task: 'image-caption',
    runtime: 'ollama-cpu',
    approxSizeMb: 1200,
    recommendedForLowEndCpu: true,
    defaultIncluded: false,
    withModelBenefit: 'Full local multimodal image inspection, scene critique, and visual Q&A on CPU.',
    withoutModelFallback: 'Vision analysis uses fast Laplacian/dHash worker metrics or Gemini Vision.',
  },
];

const BROWSER_MINIMODELS_KEY = 'dt_enable_browser_minimodels_v1';

export function isBrowserMiniModelsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(BROWSER_MINIMODELS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setBrowserMiniModelsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BROWSER_MINIMODELS_KEY, enabled ? 'true' : 'false');
  } catch {}
}

/**
 * Phase A.1: Zero-cost CPU WASM OCR using lazy-loaded Tesseract.js.
 */
export async function runLocalCpuOcr(imageInput: string | Blob): Promise<{ text: string; confidence: number }> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(imageInput);
    return {
      text: (result?.data?.text || '').trim(),
      confidence: typeof result?.data?.confidence === 'number' ? result.data.confidence : 0,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Phase A.2: Auto-detect local Ollama CPU models at localhost:11434.
 */
export async function discoverOllamaModels(
  baseUrl: string = 'http://localhost:11434'
): Promise<{ available: boolean; models: Array<{ name: string; sizeMb: number }> }> {
  const cleanBase = baseUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(`${cleanBase}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { available: false, models: [] };
    const data = await res.json();
    const list = Array.isArray(data?.models)
      ? data.models.map((m: any) => ({
          name: String(m.name || m.model || 'unknown'),
          sizeMb: typeof m.size === 'number' ? Math.round(m.size / (1024 * 1024)) : 0,
        }))
      : [];
    return { available: true, models: list };
  } catch {
    clearTimeout(timer);
    return { available: false, models: [] };
  }
}

/**
 * Phase B: Lazy-loaded in-browser Transformers.js CPU WASM mini-models.
 */
export async function runTransformersTextTask(prompt: string, maxNewTokens: number = 128): Promise<string> {
  const { pipeline } = await import('@huggingface/transformers');
  const generator = await pipeline('text-generation', 'HuggingFaceTB/SmolLM2-135M-Instruct', {
    dtype: 'q4',
    device: 'wasm',
  });
  const output: any = await generator(prompt, {
    max_new_tokens: maxNewTokens,
    do_sample: false,
  });
  const text = Array.isArray(output) ? output[0]?.generated_text : output?.generated_text;
  return typeof text === 'string' ? text.trim() : '';
}

export async function runTransformersImageCaption(imageUrlOrDataUrl: string): Promise<string> {
  const { pipeline } = await import('@huggingface/transformers');
  const captioner = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', {
    dtype: 'q8',
    device: 'wasm',
  });
  const output: any = await captioner(imageUrlOrDataUrl);
  const text = Array.isArray(output) ? output[0]?.generated_text : output?.generated_text;
  return typeof text === 'string' ? text.trim() : '';
}
