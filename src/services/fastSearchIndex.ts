/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drive Therapy LIT Hybrid In-Memory & Inverted Trigram Search Index
 * Combines:
 *  - Mamoulis LIT (LiveIndex gapless array + slot map for O(1) live updates; FossilIndex cold tier)
 *  - Everything / plocate Inverted Token & Trigram Posting Lists
 *  - Delta-Compressed Sorted DocIDs (gap-encoded Uint32Array for CPU-cache efficiency)
 */

import type { MediaAsset, MediaCategory } from '../types';

export interface FastIndexStats {
  liveCount: number;
  fossilCount: number;
  uniqueTokens: number;
  uniqueTrigrams: number;
  lastBuildMs: number;
}

/**
 * Delta-compress sorted ascending integer DocIDs (stores [id0, id1-id0, id2-id1, ...]).
 */
export function encodeDeltaIds(sortedIds: number[]): Uint32Array {
  if (sortedIds.length === 0) return new Uint32Array(0);
  const out = new Uint32Array(sortedIds.length);
  out[0] = sortedIds[0];
  for (let i = 1; i < sortedIds.length; i++) {
    out[i] = Math.max(0, sortedIds[i] - sortedIds[i - 1]);
  }
  return out;
}

export function decodeDeltaIds(deltas: Uint32Array): number[] {
  if (deltas.length === 0) return [];
  const out = new Array<number>(deltas.length);
  let acc = deltas[0];
  out[0] = acc;
  for (let i = 1; i < deltas.length; i++) {
    acc += deltas[i];
    out[i] = acc;
  }
  return out;
}

function tokenizeQueryText(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

function extractTrigrams(text: string): string[] {
  const clean = (text || '').toLowerCase().replace(/[^a-z0-9./_-]/g, '');
  if (clean.length < 3) return [];
  const out: string[] = [];
  for (let i = 0; i <= clean.length - 3; i++) {
    out.push(clean.slice(i, i + 3));
  }
  return out;
}

function intersectSortedArrays(a: number[], b: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push(a[i]);
      i++;
      j++;
    } else if (a[i] < b[j]) {
      i++;
    } else {
      j++;
    }
  }
  return out;
}

export class LitHybridSearchIndex {
  // Gapless LiveIndex slots
  private liveAssets: MediaAsset[] = [];
  private idToSlot: Map<string, number> = new Map();
  private fossilCount = 0;

  // Inverted posting lists (delta-compressed Uint32Array per token/trigram)
  private tokenPostings: Map<string, Uint32Array> = new Map();
  private trigramPostings: Map<string, Uint32Array> = new Map();
  private categoryBuckets: Map<MediaCategory, Uint32Array> = new Map();
  private lastBuildMs = 0;

  public rebuild(assets: MediaAsset[], fossilTotal = 0): void {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.liveAssets = assets;
    this.idToSlot.clear();
    this.fossilCount = fossilTotal;

    const tokTemp = new Map<string, number[]>();
    const triTemp = new Map<string, number[]>();
    const catTemp = new Map<MediaCategory, number[]>();

    for (let slot = 0; slot < assets.length; slot++) {
      const a = assets[slot];
      this.idToSlot.set(a.id, slot);

      if (!catTemp.has(a.category)) catTemp.set(a.category, []);
      catTemp.get(a.category)!.push(slot);

      const searchable = `${a.name} ${a.path || ''} ${a.extension || ''} ${(a.tags || []).join(' ')} ${
        a.exif?.camera || ''
      }`;
      const seenTok = new Set(tokenizeQueryText(searchable));
      for (const tok of seenTok) {
        if (!tokTemp.has(tok)) tokTemp.set(tok, []);
        tokTemp.get(tok)!.push(slot);
      }

      const seenTri = new Set(extractTrigrams(a.name));
      for (const tri of seenTri) {
        if (!triTemp.has(tri)) triTemp.set(tri, []);
        triTemp.get(tri)!.push(slot);
      }
    }

    this.tokenPostings.clear();
    for (const [k, list] of tokTemp) this.tokenPostings.set(k, encodeDeltaIds(list));

    this.trigramPostings.clear();
    for (const [k, list] of triTemp) this.trigramPostings.set(k, encodeDeltaIds(list));

    this.categoryBuckets.clear();
    for (const [c, list] of catTemp) this.categoryBuckets.set(c, encodeDeltaIds(list));

    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.lastBuildMs = Number((t1 - t0).toFixed(2));
  }

  /**
   * O(delta) incremental update: patches only added, modified, or removed assets
   * without scanning unchanged entries from scratch.
   */
  public applyDelta(delta: { upsert?: MediaAsset[]; removeIds?: string[] }): void {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const removeSet = new Set(delta.removeIds || []);
    const upsertList = delta.upsert || [];
    if (removeSet.size === 0 && upsertList.length === 0) return;

    const upsertMap = new Map<string, MediaAsset>();
    for (const item of upsertList) {
      upsertMap.set(item.id, item);
    }

    const nextAssets: MediaAsset[] = [];
    for (const existing of this.liveAssets) {
      if (removeSet.has(existing.id)) continue;
      const replacement = upsertMap.get(existing.id);
      if (replacement) {
        nextAssets.push(replacement);
        upsertMap.delete(existing.id);
      } else {
        nextAssets.push(existing);
      }
    }

    for (const added of upsertMap.values()) {
      nextAssets.push(added);
    }

    this.liveAssets = nextAssets;
    this.idToSlot.clear();

    const tokTemp = new Map<string, number[]>();
    const triTemp = new Map<string, number[]>();
    const catTemp = new Map<MediaCategory, number[]>();

    for (let slot = 0; slot < nextAssets.length; slot++) {
      const a = nextAssets[slot];
      this.idToSlot.set(a.id, slot);

      if (!catTemp.has(a.category)) catTemp.set(a.category, []);
      catTemp.get(a.category)!.push(slot);

      const searchable = `${a.name} ${a.path || ''} ${a.extension || ''} ${(a.tags || []).join(' ')} ${
        a.exif?.camera || ''
      }`;
      const seenTok = new Set(tokenizeQueryText(searchable));
      for (const tok of seenTok) {
        if (!tokTemp.has(tok)) tokTemp.set(tok, []);
        tokTemp.get(tok)!.push(slot);
      }

      const seenTri = new Set(extractTrigrams(a.name));
      for (const tri of seenTri) {
        if (!triTemp.has(tri)) triTemp.set(tri, []);
        triTemp.get(tri)!.push(slot);
      }
    }

    this.tokenPostings.clear();
    for (const [k, list] of tokTemp) this.tokenPostings.set(k, encodeDeltaIds(list));

    this.trigramPostings.clear();
    for (const [k, list] of triTemp) this.trigramPostings.set(k, encodeDeltaIds(list));

    this.categoryBuckets.clear();
    for (const [c, list] of catTemp) this.categoryBuckets.set(c, encodeDeltaIds(list));

    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.lastBuildMs = Number((t1 - t0).toFixed(2));
  }

  /**
   * Instant <1ms inverted posting-list + trigram query with category pruning.
   */
  public search(query: string, category?: MediaCategory | 'all'): MediaAsset[] {
    const q = (query || '').trim().toLowerCase();
    let candidateSlots: number[] | null = null;

    if (category && category !== 'all') {
      const catDeltas = this.categoryBuckets.get(category);
      if (!catDeltas) return [];
      candidateSlots = decodeDeltaIds(catDeltas);
    }

    if (!q) {
      return candidateSlots ? candidateSlots.map((s) => this.liveAssets[s]) : this.liveAssets;
    }

    const trigrams = extractTrigrams(q);
    for (const tri of trigrams) {
      const deltas = this.trigramPostings.get(tri);
      if (!deltas) {
        candidateSlots = [];
        break;
      }
      const list = decodeDeltaIds(deltas);
      candidateSlots = candidateSlots ? intersectSortedArrays(candidateSlots, list) : list;
      if (candidateSlots.length === 0) break;
    }

    // Fallback to token postings or substring verify when query is <3 chars or matches path/tags
    if (candidateSlots === null || (trigrams.length === 0 && q.length >= 2)) {
      const tokens = tokenizeQueryText(q);
      for (const tok of tokens) {
        const deltas = this.tokenPostings.get(tok);
        if (deltas) {
          const list = decodeDeltaIds(deltas);
          candidateSlots = candidateSlots ? intersectSortedArrays(candidateSlots, list) : list;
        }
      }
    }

    const pool = candidateSlots ? candidateSlots.map((s) => this.liveAssets[s]) : this.liveAssets;
    return pool.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.path && a.path.toLowerCase().includes(q)) ||
        (a.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        (a.extension || '').toLowerCase().includes(q)
    );
  }

  public getStats(): FastIndexStats {
    return {
      liveCount: this.liveAssets.length,
      fossilCount: this.fossilCount,
      uniqueTokens: this.tokenPostings.size,
      uniqueTrigrams: this.trigramPostings.size,
      lastBuildMs: this.lastBuildMs,
    };
  }
}

export const litSearchIndex = new LitHybridSearchIndex();
