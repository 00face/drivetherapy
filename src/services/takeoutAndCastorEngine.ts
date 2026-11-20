/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Castor & Pollux × Drive Therapy Universal Takeout & AI Archive Engine
 * Implements:
 *  - Aegis Secret & Credential Redaction
 *  - SHA-style Hash Deduplication & Photo Batch Deduplication
 *  - Takeout Sidecar Matching (.json + .supplemental-metadata.json)
 *  - Parsers for Castor/Pollux JSONL, Gemini Takeout, Google AI Studio, and Antigravity transcript.jsonl
 *  - Pollux Offline HTML & JSONL Archive Exporters
 */

import type { MediaAsset } from '../types';
import type { TakeoutJsonSidecar } from './googlePhotos';

export type CastorArchiveSource =
  | 'castor-pollux'
  | 'takeout-gemini'
  | 'ai-studio'
  | 'antigravity';

export interface CastorArchiveRecord {
  id: string;
  title: string;
  source: CastorArchiveSource;
  model?: string;
  prompt: string;
  response: string;
  timestamp: string;
  tags: string[];
  redactedCount: number;
}

const ARCHIVE_STORAGE_KEY = 'dt_castor_archives_v1';

/**
 * Aegis Credential Redaction Shield (ported & expanded from Castor & Pollux)
 */
export function redactSecretsAegis(input: string): { text: string; redactedCount: number } {
  if (!input) return { text: '', redactedCount: 0 };
  let redactedCount = 0;
  const patterns: Array<[RegExp, string]> = [
    [/\bAIza[0-9A-Za-z\-_]{20,}\b/g, '[REDACTED_GOOGLE_API_KEY]'],
    [/\bsk-[0-9A-Za-z\-_]{20,}\b/g, '[REDACTED_API_KEY]'],
    [/\bghp_[0-9A-Za-z]{20,}\b/g, '[REDACTED_GITHUB_TOKEN]'],
    [/\bya29\.[0-9A-Za-z\-_]{20,}\b/g, '[REDACTED_OAUTH_ACCESS_TOKEN]'],
    [/\b1\/\/[0-9A-Za-z\-_]{20,}\b/g, '[REDACTED_OAUTH_REFRESH_TOKEN]'],
    [/Bearer\s+[0-9A-Za-z\-._~+/]+=*/gi, 'Bearer [REDACTED_TOKEN]'],
  ];

  let out = input;
  for (const [regex, replacement] of patterns) {
    out = out.replace(regex, () => {
      redactedCount += 1;
      return replacement;
    });
  }
  return { text: out, redactedCount };
}

export function matchTakeoutSidecar(
  mediaFilename: string,
  sidecars: Map<string, TakeoutJsonSidecar>
): TakeoutJsonSidecar | undefined {
  const lower = mediaFilename.toLowerCase();
  const base = lower.replace(/\.[^.]+$/, '');
  return (
    sidecars.get(lower) ||
    sidecars.get(`${lower}.supplemental-metadata`) ||
    sidecars.get(`${lower}.supplemental-metadat`) ||
    sidecars.get(base) ||
    sidecars.get(`${base}.supplemental-metadata`)
  );
}

export function dedupePhotoAssets(
  existing: MediaAsset[],
  incoming: MediaAsset[]
): { unique: MediaAsset[]; skippedDuplicates: number } {
  const seenIds = new Set(existing.map((a) => a.id));
  const seenFingerprints = new Set(
    existing.map((a) => `${a.name.toLowerCase()}::${a.sizeBytes}`)
  );

  const unique: MediaAsset[] = [];
  let skippedDuplicates = 0;

  for (const item of incoming) {
    const fp = `${item.name.toLowerCase()}::${item.sizeBytes}`;
    if (seenIds.has(item.id) || (item.sizeBytes > 0 && seenFingerprints.has(fp))) {
      skippedDuplicates += 1;
      continue;
    }
    seenIds.add(item.id);
    seenFingerprints.add(fp);
    unique.push(item);
  }

  return { unique, skippedDuplicates };
}

function makeSafeRecord(partial: {
  id: string;
  title: string;
  source: CastorArchiveSource;
  model?: string;
  prompt: string;
  response: string;
  timestamp?: string;
  tags?: string[];
}): CastorArchiveRecord {
  const p = redactSecretsAegis(partial.prompt || '');
  const r = redactSecretsAegis(partial.response || '');
  return {
    id: partial.id,
    title: partial.title || 'Archived Record',
    source: partial.source,
    model: partial.model,
    prompt: p.text,
    response: r.text,
    timestamp: partial.timestamp || new Date().toISOString(),
    tags: partial.tags || [partial.source],
    redactedCount: p.redactedCount + r.redactedCount,
  };
}

export function parseCastorOrTakeoutRecords(rawText: string, filename: string): CastorArchiveRecord[] {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return [];
  const lowerName = (filename || '').toLowerCase();
  const out: CastorArchiveRecord[] = [];

  // 1. JSONL (Castor SFT exports or Antigravity transcript.jsonl)
  if (lowerName.endsWith('.jsonl') || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    const lines = trimmed.split(/\r?\n/).filter(Boolean);
    let pendingPrompt = '';
    lines.forEach((line, idx) => {
      try {
        const obj = JSON.parse(line);
        // Antigravity transcript.jsonl
        if (obj.type === 'USER_INPUT' && typeof obj.content === 'string') {
          pendingPrompt = obj.content;
        } else if (obj.type === 'PLANNER_RESPONSE' && typeof obj.content === 'string') {
          out.push(
            makeSafeRecord({
              id: `agy_${obj.step_index ?? idx}`,
              title: pendingPrompt.slice(0, 64) || `Antigravity Step ${obj.step_index ?? idx}`,
              source: 'antigravity',
              prompt: pendingPrompt || '(continued)',
              response: obj.content,
              timestamp: obj.created_at,
              tags: ['Antigravity', 'Transcript'],
            })
          );
          pendingPrompt = '';
        } else if (obj.prompt || obj.instruction || obj.input || obj.messages) {
          const prompt =
            obj.prompt ||
            obj.instruction ||
            obj.input ||
            obj.messages?.find((m: any) => m.role === 'user')?.content ||
            '';
          const response =
            obj.response ||
            obj.output ||
            obj.completion ||
            obj.messages?.find((m: any) => m.role === 'assistant' || m.role === 'model')?.content ||
            '';
          out.push(
            makeSafeRecord({
              id: String(obj.id || `castor_${idx}`),
              title: String(obj.title || prompt.slice(0, 64) || filename),
              source: 'castor-pollux',
              model: obj.model,
              prompt: String(prompt),
              response: String(response),
              timestamp: obj.timestamp || obj.createdAt,
              tags: Array.isArray(obj.tags) ? obj.tags : ['Castor', 'SFT'],
            })
          );
        }
      } catch {}
    });
    return out;
  }

  // 2. JSON (Google AI Studio, Gemini Takeout My Activity, or Castor JSON array)
  try {
    const parsed = JSON.parse(trimmed);

    // Google AI Studio export (chunkedPrompt.chunks)
    if (parsed?.chunkedPrompt?.chunks && Array.isArray(parsed.chunkedPrompt.chunks)) {
      const chunks: any[] = parsed.chunkedPrompt.chunks;
      let userText = '';
      chunks.forEach((ch, idx) => {
        if (ch.role === 'user') {
          userText = ch.text || '';
        } else if (ch.role === 'model') {
          out.push(
            makeSafeRecord({
              id: `aistudio_${idx}`,
              title: parsed.runSettings?.model ? `AI Studio (${parsed.runSettings.model})` : filename,
              source: 'ai-studio',
              model: parsed.runSettings?.model,
              prompt: userText,
              response: ch.text || '',
              tags: ['AI Studio', parsed.runSettings?.model || 'Gemini'],
            })
          );
          userText = '';
        }
      });
      return out;
    }

    // Array of Gemini Takeout My Activity or Castor objects
    const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.records) ? parsed.records : [parsed];
    items.forEach((item: any, idx: number) => {
      if (!item || typeof item !== 'object') return;
      if (item.header === 'Gemini Apps' || item.products?.includes('Gemini Apps') || item.subtitles) {
        const prompt = String(item.title || '').replace(/^Prompted\s+/i, '');
        const response = Array.isArray(item.safeHtmlItem)
          ? item.safeHtmlItem.map((h: any) => String(h.html || '').replace(/<[^>]+>/g, ' ')).join('\n')
          : String(item.description || '');
        out.push(
          makeSafeRecord({
            id: `gemini_takeout_${idx}`,
            title: prompt.slice(0, 64) || 'Gemini Activity',
            source: 'takeout-gemini',
            prompt,
            response: response.trim(),
            timestamp: item.time,
            tags: ['Gemini Takeout'],
          })
        );
      } else if (item.prompt || item.instruction || item.response || item.output) {
        out.push(
          makeSafeRecord({
            id: String(item.id || `castor_json_${idx}`),
            title: String(item.title || item.prompt || filename).slice(0, 64),
            source: 'castor-pollux',
            model: item.model,
            prompt: String(item.prompt || item.instruction || ''),
            response: String(item.response || item.output || ''),
            timestamp: item.timestamp,
            tags: Array.isArray(item.tags) ? item.tags : ['Castor'],
          })
        );
      }
    });
  } catch {}

  return out;
}

export function exportToPolluxJsonl(records: CastorArchiveRecord[]): string {
  return records
    .map((r) =>
      JSON.stringify({
        id: r.id,
        title: r.title,
        source: r.source,
        model: r.model || 'gemini-2.5-flash',
        prompt: r.prompt,
        response: r.response,
        timestamp: r.timestamp,
        tags: r.tags,
      })
    )
    .join('\n');
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function exportToPolluxHtml(records: CastorArchiveRecord[], title = 'Pollux Offline Archive'): string {
  const cards = records
    .map(
      (r) => `<article class="card">
  <header><h3>${escapeHtml(r.title)}</h3><span class="badge">${escapeHtml(r.source)}</span></header>
  <div class="meta">${escapeHtml(r.timestamp)} · Redacted secrets: ${r.redactedCount}</div>
  <pre class="prompt">${escapeHtml(r.prompt)}</pre>
  <pre class="response">${escapeHtml(r.response)}</pre>
</article>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 960px; margin: 32px auto; padding: 0 16px; background: #0f172a; color: #e2e8f0; }
  .card { border: 1px solid #334155; border-radius: 12px; padding: 16px; margin-bottom: 16px; background: #1e293b; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .badge { background: #1074B1; color: #fff; padding: 2px 8px; border-radius: 999px; font-size: 12px; }
  .meta { font-size: 12px; color: #94a3b8; margin: 6px 0 10px; }
  pre { white-space: pre-wrap; background: #0f172a; padding: 10px; border-radius: 8px; font-size: 13px; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)} (${records.length} records)</h1>
  ${cards}
</body>
</html>`;
}

export function loadCastorArchives(): CastorArchiveRecord[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCastorArchives(records: CastorArchiveRecord[]): void {
  try {
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(records.slice(0, 500)));
  } catch {}
}
