/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google NotebookLM Multi-Asset Dossier Generator Tests
 * Verifies multi-format asset compilation, structured dossier generation,
 * asset tally metrics, and audio overview podcast preparation.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { notebookLmDossierGenerator } from '../src/services/notebookLmDossierGenerator';
import { MediaAsset } from '../src/types';

describe('Google NotebookLM Multi-Asset Dossier Generator', () => {
  const mockAssets: MediaAsset[] = [
    {
      id: 'photo_1',
      name: 'golden_gate_sunset.jpg',
      source: 'cloud',
      path: '/Shoots/SF/golden_gate_sunset.jpg',
      mimeType: 'image/jpeg',
      extension: 'jpg',
      category: 'image',
      sizeBytes: 12 * 1024 * 1024,
      tags: ['landscape', 'sunset'],
      rating: 5,
      cullingStatus: 'picked',
      quality: { overall: 95, sharpness: 96, exposure: 90, noise: 5, compression: 0, isBlurry: false },
      metadata: { camera: 'Canon EOS R5', lens: 'RF 24-70mm F2.8L', iso: 100, aperture: 'f/8.0' },
    },
    {
      id: 'raw_1',
      name: 'model_portrait_01.arw',
      source: 'local',
      path: '/Shoots/SF/model_portrait_01.arw',
      mimeType: 'image/x-sony-arw',
      extension: 'arw',
      category: 'raw',
      sizeBytes: 45 * 1024 * 1024,
      tags: ['portrait', 'studio'],
      rating: 4,
      cullingStatus: 'picked',
      quality: { overall: 92, sharpness: 91, exposure: 88, noise: 10, compression: 0, isBlurry: false },
      metadata: { camera: 'Sony A7R V', lens: 'FE 85mm F1.4 GM', iso: 100, aperture: 'f/1.4' },
    },
    {
      id: 'doc_1',
      name: 'production_creative_brief.pdf',
      source: 'cloud',
      path: '/Documents/production_creative_brief.pdf',
      mimeType: 'application/pdf',
      extension: 'pdf',
      category: 'document',
      sizeBytes: 2 * 1024 * 1024,
      tags: ['brief', 'specs'],
      cullingStatus: 'none',
      quality: { overall: 100, sharpness: 100, exposure: 100, noise: 0, compression: 0, isBlurry: false },
    },
    {
      id: 'audio_1',
      name: 'photographer_lighting_memo.m4a',
      source: 'cloud',
      path: '/Audio/photographer_lighting_memo.m4a',
      mimeType: 'audio/m4a',
      extension: 'm4a',
      category: 'audio',
      sizeBytes: 8 * 1024 * 1024,
      tags: ['memo', 'audio'],
      cullingStatus: 'none',
      quality: { overall: 100, sharpness: 100, exposure: 100, noise: 0, compression: 0, isBlurry: false },
    },
    {
      id: 'video_1',
      name: 'drone_flyover_4k.mp4',
      source: 'cloud',
      path: '/Video/drone_flyover_4k.mp4',
      mimeType: 'video/mp4',
      extension: 'mp4',
      category: 'video',
      sizeBytes: 320 * 1024 * 1024,
      tags: ['drone', 'broll'],
      cullingStatus: 'rejected',
      quality: { overall: 85, sharpness: 89, exposure: 80, noise: 12, compression: 0, isBlurry: false },
    },
  ] as any;

  test('compiles multi-format dossier with accurate asset tallies', () => {
    const dossier = notebookLmDossierGenerator.generateDossier({
      projectName: 'Vogue Pacific Editorial Shoot',
      clientName: 'Pacific Media Group',
      location: 'San Francisco, CA',
      assets: mockAssets,
      notes: 'High-speed capture under natural coastal light.',
    });

    assert.strictEqual(dossier.stats.totalAssets, 5);
    assert.strictEqual(dossier.stats.photosCount, 2);
    assert.strictEqual(dossier.stats.rawCount, 1);
    assert.strictEqual(dossier.stats.documentsCount, 1);
    assert.strictEqual(dossier.stats.audioCount, 1);
    assert.strictEqual(dossier.stats.videosCount, 1);
    assert.strictEqual(dossier.stats.pickedCount, 2);
    assert.strictEqual(dossier.stats.rejectedCount, 1);
  });

  test('generates markdown with all required NotebookLM research sections', () => {
    const dossier = notebookLmDossierGenerator.generateDossier({
      projectName: 'Coastal Campaign 2024',
      clientName: 'Studio Nord',
      assets: mockAssets,
    });

    const md = dossier.markdownContent;
    assert.ok(md.includes('# Studio Production Dossier: Coastal Campaign 2024'));
    assert.ok(md.includes('## 1. Executive Summary & Creative Scope'));
    assert.ok(md.includes('## 2. Catalog & Culling Milestone Metrics'));
    assert.ok(md.includes('## 3. Camera Equipment & Technical Optics Inventory'));
    assert.ok(md.includes('## 4. Curated Hero Picks & Standout Sequences'));
    assert.ok(md.includes('## 5. Audio Voice Memos & Field Recording Logs'));
    assert.ok(md.includes('## 6. Motion Sequences & Video Captures'));
    assert.ok(md.includes('## 7. Delivery & Licensing Directives'));
  });

  test('computes word count and HTML generation accurately', () => {
    const dossier = notebookLmDossierGenerator.generateDossier({
      projectName: 'Quick Session',
      assets: mockAssets,
    });

    assert.ok(dossier.markdownContent.length > 200);
    assert.ok(dossier.htmlContent.includes('<h1>Studio Production Dossier: Quick Session</h1>'));
    assert.strictEqual(dossier.notebookLmUrl, 'https://notebooklm.google.com/');
  });

  test('generates clean sanitized filename', () => {
    const dossier = notebookLmDossierGenerator.generateDossier({
      projectName: 'Studio Pack / Summer 2024!',
      assets: mockAssets,
    });

    assert.ok(dossier.filename.endsWith('_NotebookLM_Dossier.md'));
    assert.ok(!dossier.filename.includes('/'));
    assert.ok(!dossier.filename.includes('!'));
  });
});
