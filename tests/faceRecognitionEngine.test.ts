/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * On-Device Facial Recognition Engine Unit Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  euclideanDistance,
  cosineSimilarity,
  clusterFacesIntoPeople,
  DetectedFace,
} from '../src/services/faceRecognitionEngine';

describe('On-Device Facial Recognition & People Clustering Engine', () => {
  it('calculates Euclidean distance and Cosine similarity accurately', () => {
    const vecA = new Float32Array([1.0, 0.0, 0.0]);
    const vecB = new Float32Array([1.0, 0.0, 0.0]);
    const vecC = new Float32Array([0.0, 1.0, 0.0]);

    assert.equal(euclideanDistance(vecA, vecB), 0);
    assert.equal(cosineSimilarity(vecA, vecB), 1.0);

    assert.ok(euclideanDistance(vecA, vecC) > 1.4);
    assert.equal(cosineSimilarity(vecA, vecC), 0.0);
  });

  it('clusters identical face embeddings into the same person profile', () => {
    // Person 1: Face 1 & 2 (similar vectors)
    const face1: DetectedFace = {
      id: 'f1',
      assetId: 'img1',
      box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      descriptor: new Float32Array([0.5, 0.5, 0.1, 0.0]),
      confidence: 0.98,
    };
    const face2: DetectedFace = {
      id: 'f2',
      assetId: 'img2',
      box: { x: 0.2, y: 0.1, width: 0.2, height: 0.2 },
      descriptor: new Float32Array([0.51, 0.49, 0.1, 0.0]), // very close to f1
      confidence: 0.95,
    };

    // Person 2: Face 3 (orthogonal vector)
    const face3: DetectedFace = {
      id: 'f3',
      assetId: 'img3',
      box: { x: 0.3, y: 0.3, width: 0.2, height: 0.2 },
      descriptor: new Float32Array([0.0, 0.0, 0.9, 0.9]),
      confidence: 0.92,
    };

    const clusters = clusterFacesIntoPeople([face1, face2, face3], 0.2);
    assert.equal(clusters.size, 2);

    const cluster0 = clusters.get(0);
    assert.ok(cluster0);
    assert.equal(cluster0.length, 2);
    assert.ok(cluster0.some((f) => f.id === 'f1'));
    assert.ok(cluster0.some((f) => f.id === 'f2'));

    const cluster1 = clusters.get(1);
    assert.ok(cluster1);
    assert.equal(cluster1.length, 1);
    assert.equal(cluster1[0].id, 'f3');
  });
});
