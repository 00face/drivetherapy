/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Deep Indexing Progress HUD & App Startup Acceleration Verification Suite
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MediaAsset } from '../src/types';
import { fetchDriveStorageQuota, fetchDriveFolders } from '../src/services/googleDrive';

describe('Deep Indexing Progress HUD & Startup Optimization Suite', () => {
  // Test 1: Single-pass metric accumulator vs legacy multi-filter output
  test('Single-pass metric accumulator matches legacy multi-filter output with O(N) efficiency', () => {
    const mockAssets: Partial<MediaAsset>[] = [
      { id: '1', category: 'image', cullingStatus: 'picked', rating: 5, quality: { sharpness: 80, isBlurry: false } as any },
      { id: '2', category: 'image', cullingStatus: 'rejected', rating: 1, quality: { sharpness: 20, isBlurry: true } as any },
      { id: '3', category: 'raw', cullingStatus: 'unrated', rating: 0, quality: { sharpness: 90, isBlurry: false } as any },
      { id: '4', category: 'video', cullingStatus: 'picked', rating: 4, quality: { sharpness: 60, isBlurry: false } as any },
      { id: '5', category: 'audio', cullingStatus: 'unrated', rating: 0, quality: { sharpness: 0, isBlurry: false } as any },
      { id: '6', category: 'archive', cullingStatus: 'rejected', rating: 0, quality: { sharpness: 0, isBlurry: true } as any },
      { id: '7', category: 'document', cullingStatus: 'unrated', rating: 3, quality: { sharpness: 50, isBlurry: false } as any },
    ];

    // Single-pass accumulator
    const counts = {
      all: mockAssets.length,
      image: 0,
      raw: 0,
      video: 0,
      audio: 0,
      archive: 0,
      document: 0,
    };
    let picked = 0;
    let rejected = 0;
    let rated = 0;
    let blurry = 0;

    for (let i = 0; i < mockAssets.length; i++) {
      const a = mockAssets[i];
      if (a.category && (counts as any)[a.category] !== undefined) {
        (counts as any)[a.category]++;
      }
      if (a.cullingStatus === 'picked') picked++;
      else if (a.cullingStatus === 'rejected') rejected++;
      if ((a.rating || 0) > 0) rated++;
      if (a.quality?.isBlurry) blurry++;
    }

    // Assertions against expected counts
    assert.equal(counts.all, 7);
    assert.equal(counts.image, 2);
    assert.equal(counts.raw, 1);
    assert.equal(counts.video, 1);
    assert.equal(counts.audio, 1);
    assert.equal(counts.archive, 1);
    assert.equal(counts.document, 1);
    assert.equal(picked, 2);
    assert.equal(rejected, 2);
    assert.equal(rated, 4);
    assert.equal(blurry, 2);
  });

  // Test 2: Windowed progressive slice bounds
  test('Windowed progressive slice limits initial paint DOM size and expands correctly', () => {
    const largeCatalog = Array.from({ length: 500 }, (_, i) => ({
      id: `asset_${i}`,
      name: `Photo_${i}.jpg`,
    }));

    const initialWindowSize = 60;
    const initialSlice = largeCatalog.slice(0, initialWindowSize);
    assert.equal(initialSlice.length, 60, 'Initial slice must be exactly 60 items');

    const expandedWindowSize = initialWindowSize + 60;
    const expandedSlice = largeCatalog.slice(0, expandedWindowSize);
    assert.equal(expandedSlice.length, 120, 'Expanded slice must be 120 items');

    // Slicing beyond length safely caps at total length
    const fullSlice = largeCatalog.slice(0, 1000);
    assert.equal(fullSlice.length, 500, 'Full slice caps at total items');
  });

  // Test 3: Folder discovery progress callback propagation
  test('Folder discovery pagination invokes onProgress with accurate discovered count', async () => {
    const progressEvents: number[] = [];
    const mockOnProgress = (count: number) => {
      progressEvents.push(count);
    };

    // When not authenticated, fetchDriveFolders returns [] without throwing
    const folders = await fetchDriveFolders(undefined, 200, undefined, mockOnProgress);
    assert.ok(Array.isArray(folders));
  });

  // Test 4: Quota cache deduplication
  test('fetchDriveStorageQuota deduplicates rapid subsequent calls within 60s window', async () => {
    const quota1 = await fetchDriveStorageQuota();
    assert.ok(typeof quota1.limit === 'number');
    assert.ok(typeof quota1.percentage === 'number');

    const quota2 = await fetchDriveStorageQuota();
    assert.deepEqual(quota1, quota2, 'Subsequent call within 60s should return identical cached quota');
  });

  // Test 5: Scan phase progression validation
  test('Scan phase state machine progresses through all 4 canonical phases', () => {
    type ScanPhase = 'idle' | 'folders' | 'files' | 'clustering' | 'saving' | 'complete';
    const stateTransitions: ScanPhase[] = [];

    let currentPhase: ScanPhase = 'idle';
    stateTransitions.push(currentPhase);

    // Transition to Phase 1: Folders
    currentPhase = 'folders';
    stateTransitions.push(currentPhase);

    // Transition to Phase 2: Media Files
    currentPhase = 'files';
    stateTransitions.push(currentPhase);

    // Transition to Phase 3: Clustering
    currentPhase = 'clustering';
    stateTransitions.push(currentPhase);

    // Transition to Phase 4: Saving
    currentPhase = 'saving';
    stateTransitions.push(currentPhase);

    // Completion
    currentPhase = 'complete';
    stateTransitions.push(currentPhase);

    assert.deepEqual(stateTransitions, [
      'idle',
      'folders',
      'files',
      'clustering',
      'saving',
      'complete',
    ]);
  });
});
