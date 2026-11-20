/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Procedural Music Radio Engine (musicRadio.ts)
 * Algorithmic track similarity and continuous radio station generator for
 * Drive Therapy Media Studio "Start Radio" and Autoplay features.
 *
 * Erasable Syntax Doctrine: Zero enum/namespace, pure functions and interfaces.
 * Zero-Key Offline Resilience: Computes similarity heuristics directly in-process.
 */

import type { MusicTrack } from '../googleMusicEngine';

export interface RadioStationResult {
  seedTrack: MusicTrack;
  stationName: string;
  description: string;
  tracks: MusicTrack[];
}

export interface SimilarityFeatures {
  genre: string;
  artist: string;
  bpm?: number;
  durationSeconds: number;
  year?: number;
}

/**
 * Genre affinity weights matrix
 * Pairs genres that share high acoustic harmony.
 */
const GENRE_AFFINITY: Record<string, string[]> = {
  'lo-fi': ['ambient', 'chillhop', 'downtempo', 'jazz'],
  'ambient': ['lo-fi', 'classical', 'minimalism', 'drone'],
  'classical': ['ambient', 'soundtrack', 'piano'],
  'synthwave': ['electronic', 'cyberpunk', 'retrowave', 'edm'],
  'electronic': ['synthwave', 'drum & bass', 'techno', 'house'],
  'drum & bass': ['electronic', 'breakbeat', 'synthwave'],
  'jazz': ['lo-fi', 'soul', 'r&b', 'blues'],
  'indie': ['alternative', 'pop', 'folk', 'rock'],
  'rock': ['indie', 'alternative', 'punk', 'metal'],
  'pop': ['indie', 'dance', 'synthpop', 'r&b'],
};

/**
 * Calculate acoustic similarity score between a candidate track and seed track.
 * Higher score indicates higher acoustic affinity (Max score ~ 100+).
 */
export function calculateTrackSimilarity(
  seed: MusicTrack,
  candidate: MusicTrack
): number {
  if (seed.id === candidate.id) return 1000; // Exact match crowns first position

  let score = 0;

  // 1. Performer / Artist Affinity (+40 for exact same artist)
  if (seed.artist && candidate.artist) {
    if (seed.artist.toLowerCase() === candidate.artist.toLowerCase()) {
      score += 40;
    }
  }

  // 2. Genre Match (+30 for exact genre match, +18 for harmonic neighbor)
  const seedGenre = (seed.genre || '').toLowerCase();
  const candGenre = (candidate.genre || '').toLowerCase();

  if (seedGenre && candGenre) {
    if (seedGenre === candGenre) {
      score += 30;
    } else {
      const affinities = GENRE_AFFINITY[seedGenre] || [];
      if (affinities.some((a) => candGenre.includes(a))) {
        score += 18;
      }
    }
  }

  // 3. Tempo / BPM Proximity (+15 for close BPM within +-15%)
  if (seed.bpm && candidate.bpm && seed.bpm > 0 && candidate.bpm > 0) {
    const bpmDiff = Math.abs(seed.bpm - candidate.bpm);
    if (bpmDiff <= 10) {
      score += 15;
    } else if (bpmDiff <= 25) {
      score += 8;
    }
  }

  // 4. Duration Proximity (+10 for similar track length within 60s)
  if (seed.durationSeconds > 0 && candidate.durationSeconds > 0) {
    const durDiff = Math.abs(seed.durationSeconds - candidate.durationSeconds);
    if (durDiff <= 60) {
      score += 10;
    } else if (durDiff <= 120) {
      score += 5;
    }
  }

  // 5. User Rating Bonus (+5 if candidate is starred/liked)
  if (candidate.isLiked) {
    score += 5;
  }

  return score;
}

/**
 * Generate a continuous radio station playlist from a seed track.
 */
export function generateRadioStation(
  seedTrack: MusicTrack,
  candidatePool: MusicTrack[],
  limit = 25
): RadioStationResult {
  const seenIds = new Set<string>([seedTrack.id]);
  const ranked = candidatePool
    .filter((c) => c.id !== seedTrack.id)
    .map((cand) => ({
      track: cand,
      score: calculateTrackSimilarity(seedTrack, cand),
    }));

  ranked.sort((a, b) => b.score - a.score);

  const playlist: MusicTrack[] = [seedTrack];

  for (const item of ranked) {
    if (!seenIds.has(item.track.id)) {
      seenIds.add(item.track.id);
      playlist.push(item.track);
      if (playlist.length >= limit) break;
    }
  }

  // If candidate pool was small, ensure we at least return what was available
  return {
    seedTrack,
    stationName: `${seedTrack.title} Radio`,
    description: `Continuous stream tuned to ${seedTrack.artist} and ${seedTrack.genre || 'studio tracks'}`,
    tracks: playlist,
  };
}

/**
 * Infinite Autoplay expansion:
 * When queue is near completion, finds next best tracks not already in queue.
 */
export function getNextAutoplayRecommendations(
  currentTrack: MusicTrack,
  existingQueue: MusicTrack[],
  libraryTracks: MusicTrack[],
  batchSize = 10
): MusicTrack[] {
  const existingIds = new Set(existingQueue.map((t) => t.id));
  const available = libraryTracks.filter((t) => !existingIds.has(t.id));

  const ranked = available.map((candidate) => ({
    track: candidate,
    score: calculateTrackSimilarity(currentTrack, candidate),
  }));

  ranked.sort((a, b) => b.score - a.score);

  return ranked.slice(0, batchSize).map((r) => r.track);
}
