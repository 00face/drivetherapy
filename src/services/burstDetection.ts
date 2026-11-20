/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * High-Speed Culling & Dynamic Burst Clustering Engine (A+ Tier)
 * Groups high-rate capture series and crowns the sharpest frame as hero.
 */

import { MediaAsset } from '../types';

export interface BurstGroup {
  id: string;
  heroAssetId: string;
  assetIds: string[];
  captureTime: string;
  averageSharpness: number;
}

// Dynamically clusters media items into burst series based on temporal delta and filename patterns
export function detectAndClusterBursts(assets: MediaAsset[]): {
  clusteredAssets: MediaAsset[];
  burstGroups: BurstGroup[];
} {
  // Sort chronologically
  const sorted = [...assets].sort((a, b) => {
    const timeA = new Date(a.exif?.dateTaken || a.modifiedTime).getTime();
    const timeB = new Date(b.exif?.dateTaken || b.modifiedTime).getTime();
    return timeA - timeB;
  });

  const burstClusters: MediaAsset[][] = [];
  let currentCluster: MediaAsset[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];

    if (currentCluster.length === 0) {
      currentCluster.push(current);
      continue;
    }

    const previous = currentCluster[currentCluster.length - 1];
    const prevTime = new Date(previous.exif?.dateTaken || previous.modifiedTime).getTime();
    const currTime = new Date(current.exif?.dateTaken || current.modifiedTime).getTime();
    const deltaMs = Math.abs(currTime - prevTime);

    // Delta threshold: captured within 3500ms of each other
    if (deltaMs <= 3500) {
      currentCluster.push(current);
    } else {
      if (currentCluster.length > 1) {
        burstClusters.push([...currentCluster]);
      }
      currentCluster = [current];
    }
  }

  if (currentCluster.length > 1) {
    burstClusters.push([...currentCluster]);
  }

  // Assign burst metadata and identify heroes
  const burstGroups: BurstGroup[] = [];
  const assetUpdates = new Map<string, Partial<MediaAsset>>();

  burstClusters.forEach((cluster, clusterIndex) => {
    const burstId = `burst_series_${clusterIndex + 1}`;

    // Find the sharpest frame in the burst
    let highestSharpness = -1;
    let heroId = cluster[0].id;
    let totalSharpness = 0;

    cluster.forEach((item) => {
      const score = item.quality?.sharpness || 50;
      totalSharpness += score;
      if (score > highestSharpness) {
        highestSharpness = score;
        heroId = item.id;
      }
    });

    burstGroups.push({
      id: burstId,
      heroAssetId: heroId,
      assetIds: cluster.map((c) => c.id),
      captureTime: cluster[0].modifiedTime,
      averageSharpness: Math.round(totalSharpness / cluster.length),
    });

    cluster.forEach((item) => {
      assetUpdates.set(item.id, {
        burstGroup: burstId,
        isBurstHero: item.id === heroId,
        quality: {
          ...item.quality,
          reason:
            item.id === heroId
              ? `★ Burst Hero: Sharpest in burst series (${highestSharpness}%)`
              : `Burst frame (${item.quality.sharpness}% vs hero ${highestSharpness}%)`,
        },
      });
    });
  });

  const clusteredAssets = assets.map((asset) => {
    const update = assetUpdates.get(asset.id);
    return update ? { ...asset, ...update } : asset;
  });

  return { clusteredAssets, burstGroups };
}

// Perceptual Near-Duplicate Clustering using 64-bit dHash Hamming Distance
export function clusterNearDuplicates(assets: MediaAsset[], maxHammingDistance = 6): {
  duplicateClusters: { heroAsset: MediaAsset; duplicates: MediaAsset[]; averageSharpness: number }[];
} {
  const assetsWithHash = assets.filter((a) => Boolean(a.pHash));
  if (assetsWithHash.length === 0) return { duplicateClusters: [] };

  const visited = new Set<string>();
  const clusters: { heroAsset: MediaAsset; duplicates: MediaAsset[]; averageSharpness: number }[] = [];

  function getHammingDistance(hexA: string, hexB: string): number {
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

  for (let i = 0; i < assetsWithHash.length; i++) {
    const candidate = assetsWithHash[i];
    if (visited.has(candidate.id)) continue;

    const group: MediaAsset[] = [candidate];
    visited.add(candidate.id);

    for (let j = i + 1; j < assetsWithHash.length; j++) {
      const other = assetsWithHash[j];
      if (visited.has(other.id)) continue;

      const dist = getHammingDistance(candidate.pHash!, other.pHash!);
      if (dist <= maxHammingDistance) {
        group.push(other);
        visited.add(other.id);
      }
    }

    if (group.length > 1) {
      // Find sharpest frame in duplicate group
      let hero = group[0];
      let totalSharpness = 0;
      for (const item of group) {
        const s = item.quality?.sharpness || 0;
        totalSharpness += s;
        if (s > (hero.quality?.sharpness || 0)) {
          hero = item;
        }
      }
      clusters.push({
        heroAsset: hero,
        duplicates: group.filter((g) => g.id !== hero.id),
        averageSharpness: Math.round(totalSharpness / group.length),
      });
    }
  }

  return { duplicateClusters: clusters };
}
