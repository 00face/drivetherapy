/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Smart Collections & Dynamic Saved Searches Unit Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  matchesSmartQuery,
  evaluateSmartCollection,
  DEFAULT_SMART_COLLECTIONS,
  createSmartCollection,
  SmartCollection,
} from '../src/services/smartCollections';
import { MediaAsset } from '../src/types';

describe('Smart Collections & Dynamic Saved Queries Engine', () => {
  const mockAssets: MediaAsset[] = [
    {
      id: 'a1',
      name: 'Hero_Shot.ARW',
      mimeType: 'image/x-sony-arw',
      size: 45 * 1024 * 1024,
      rating: 5,
      isPicked: true,
      cameraModel: 'Sony A1',
      tags: ['wedding', 'portrait'],
    },
    {
      id: 'a2',
      name: 'Candid_02.jpg',
      mimeType: 'image/jpeg',
      size: 8 * 1024 * 1024,
      rating: 3,
      isPicked: false,
      isRejected: true,
      cameraModel: 'Sony A7IV',
      tags: ['wedding', 'reception'],
    },
    {
      id: 'a3',
      name: 'Highlight_Reel.mp4',
      mimeType: 'video/mp4',
      size: 150 * 1024 * 1024,
      rating: 4,
      isPicked: true,
      tags: ['video', 'wedding'],
    },
  ] as any;

  it('matches rating tokens: stars:5 and stars:>=4', () => {
    assert.equal(matchesSmartQuery(mockAssets[0], 'stars:5'), true);
    assert.equal(matchesSmartQuery(mockAssets[1], 'stars:5'), false);

    assert.equal(matchesSmartQuery(mockAssets[0], 'stars:>=4'), true);
    assert.equal(matchesSmartQuery(mockAssets[2], 'stars:>=4'), true);
    assert.equal(matchesSmartQuery(mockAssets[1], 'stars:>=4'), false);
  });

  it('matches type tokens: type:raw, type:image, type:video', () => {
    assert.equal(matchesSmartQuery(mockAssets[0], 'type:raw'), true);
    assert.equal(matchesSmartQuery(mockAssets[1], 'type:raw'), false);
    assert.equal(matchesSmartQuery(mockAssets[2], 'type:video'), true);
    assert.equal(matchesSmartQuery(mockAssets[1], 'type:image'), true);
  });

  it('matches status tokens: status:picked and status:rejected', () => {
    assert.equal(matchesSmartQuery(mockAssets[0], 'status:picked'), true);
    assert.equal(matchesSmartQuery(mockAssets[1], 'status:picked'), false);
    assert.equal(matchesSmartQuery(mockAssets[1], 'status:rejected'), true);
  });

  it('matches file size thresholds: size:>20mb', () => {
    assert.equal(matchesSmartQuery(mockAssets[0], 'size:>20mb'), true); // 45MB
    assert.equal(matchesSmartQuery(mockAssets[1], 'size:>20mb'), false); // 8MB
    assert.equal(matchesSmartQuery(mockAssets[2], 'size:>20mb'), true); // 150MB
  });

  it('evaluates dynamic Smart Collections in real time against assets', () => {
    const fiveStarCol: SmartCollection = {
      id: 'sc_test_1',
      name: '5 Stars',
      query: 'stars:5',
      createdAt: Date.now(),
    };

    const results = evaluateSmartCollection(fiveStarCol, mockAssets);
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'a1');
  });

  it('provides 4 standard default smart collections', () => {
    assert.equal(DEFAULT_SMART_COLLECTIONS.length, 4);
    assert.ok(DEFAULT_SMART_COLLECTIONS.some((c) => c.query === 'stars:5'));
    assert.ok(DEFAULT_SMART_COLLECTIONS.some((c) => c.query === 'type:raw'));
  });
});
