import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTrackSimilarity,
  generateRadioStation,
  getNextAutoplayRecommendations,
} from '../src/services/music/musicRadio';
import type { MusicTrack } from '../src/services/googleMusicEngine';

describe('Procedural Music Radio Engine (musicRadio.ts)', () => {
  const seedTrack: MusicTrack = {
    id: 'track_seed_01',
    title: 'Solar Chill',
    artist: 'Antigravity Sound Lab',
    album: 'Zero-G Sessions',
    durationSeconds: 180,
    albumArtUrl: 'https://example.com/art.jpg',
    genre: 'Lo-Fi',
    format: 'flac',
    bpm: 80,
  };

  const pool: MusicTrack[] = [
    seedTrack,
    {
      id: 'track_cand_same_artist',
      title: 'Lunar Echoes',
      artist: 'Antigravity Sound Lab',
      album: 'Zero-G Sessions',
      durationSeconds: 190,
      albumArtUrl: 'https://example.com/art2.jpg',
      genre: 'Lo-Fi',
      format: 'flac',
      bpm: 82,
    },
    {
      id: 'track_cand_same_genre',
      title: 'Midnight Beats',
      artist: 'Tape Hiss Collective',
      album: 'Coffee & Rain',
      durationSeconds: 175,
      albumArtUrl: 'https://example.com/art3.jpg',
      genre: 'Lo-Fi',
      format: 'mp3',
      bpm: 78,
    },
    {
      id: 'track_cand_harmonic_genre',
      title: 'Quiet Horizon',
      artist: 'Deep Drift',
      album: 'Silent Night',
      durationSeconds: 200,
      albumArtUrl: 'https://example.com/art4.jpg',
      genre: 'Ambient', // Harmonic neighbor to Lo-Fi
      format: 'flac',
      bpm: 75,
    },
    {
      id: 'track_cand_unrelated',
      title: 'Aggressive Metal Anthem',
      artist: 'Iron Shredders',
      album: 'Loud',
      durationSeconds: 320,
      albumArtUrl: 'https://example.com/art5.jpg',
      genre: 'Rock',
      format: 'mp3',
      bpm: 180,
    },
  ];

  test('calculates acoustic similarity score with highest weighting for same artist and genre', () => {
    const sameArtistScore = calculateTrackSimilarity(seedTrack, pool[1]);
    const sameGenreScore = calculateTrackSimilarity(seedTrack, pool[2]);
    const harmonicScore = calculateTrackSimilarity(seedTrack, pool[3]);
    const unrelatedScore = calculateTrackSimilarity(seedTrack, pool[4]);

    // Same artist + genre > same genre alone > harmonic neighbor > unrelated
    assert.ok(sameArtistScore > sameGenreScore);
    assert.ok(sameGenreScore > harmonicScore);
    assert.ok(harmonicScore > unrelatedScore);
  });

  test('generates cohesive continuous radio station starting with the seed track', () => {
    const station = generateRadioStation(seedTrack, pool, 10);
    assert.strictEqual(station.seedTrack.id, seedTrack.id);
    assert.strictEqual(station.tracks[0].id, seedTrack.id);
    assert.strictEqual(station.tracks.length, pool.length);

    // Most similar tracks should follow immediately after the seed track
    assert.strictEqual(station.tracks[1].id, 'track_cand_same_artist');
    assert.strictEqual(station.tracks[2].id, 'track_cand_same_genre');
  });

  test('getNextAutoplayRecommendations avoids duplicates already present in queue', () => {
    const currentQueue = [seedTrack, pool[1]];
    const recs = getNextAutoplayRecommendations(seedTrack, currentQueue, pool, 5);

    // Must not include tracks already in currentQueue
    assert.strictEqual(recs.some((t) => t.id === seedTrack.id), false);
    assert.strictEqual(recs.some((t) => t.id === pool[1].id), false);
    assert.strictEqual(recs[0].id, 'track_cand_same_genre');
  });
});
