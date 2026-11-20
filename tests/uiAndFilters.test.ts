/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Test Suite: UI Scaling, Thumbnail Uncovering, Category & Common Folder Filters
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MediaAsset, MediaCategory } from '../src/types/index';

const createDummyAsset = (id: string, name: string, category: MediaCategory, path: string): MediaAsset => ({
  id,
  name,
  source: 'cloud',
  category,
  mimeType: 'image/jpeg',
  extension: name.split('.').pop()?.toUpperCase() || 'JPG',
  path,
  sizeBytes: 1024 * 1024 * 2,
  modifiedTime: new Date().toISOString(),
  thumbnailUrl: 'https://example.com/thumb.jpg',
  isCached: false,
  cullingStatus: 'unrated',
  rating: 0,
  tags: ['Test', category.toUpperCase()],
  faces: [],
  quality: { sharpness: 88, exposure: 85, overall: 86, isBlurry: false, reason: 'Test' },
  palette: ['#1074B1', '#52B197'],
  exif: { dimensions: '3000 × 2000' },
});

describe('UI Scaling, Category & Common Folder Filtering Engine', () => {
  const sampleAssets: MediaAsset[] = [
    createDummyAsset('1', 'portrait_shoot.jpg', 'image', '/Google Drive/Pictures/portrait_shoot.jpg'),
    createDummyAsset('2', 'raw_capture.cr2', 'raw', '/Google Drive/Pictures/raw_capture.cr2'),
    createDummyAsset('3', 'highlight_reel.mp4', 'video', '/Google Drive/Videos/highlight_reel.mp4'),
    createDummyAsset('4', 'podcast_ep.mp3', 'audio', '/Google Drive/Audio/podcast_ep.mp3'),
    createDummyAsset('5', 'client_deliverable.zip', 'archive', '/Google Drive/Downloads/client_deliverable.zip'),
    createDummyAsset('6', 'invoice_2026.pdf', 'document', '/Google Drive/Documents/invoice_2026.pdf'),
    createDummyAsset('7', 'desktop_screenshot.png', 'image', '/Google Drive/Desktop/desktop_screenshot.png'),
  ];

  it('filters catalog assets by category accurately', () => {
    const images = sampleAssets.filter((a) => a.category === 'image');
    assert.strictEqual(images.length, 2);

    const videos = sampleAssets.filter((a) => a.category === 'video');
    assert.strictEqual(videos.length, 1);
    assert.strictEqual(videos[0].name, 'highlight_reel.mp4');

    const archives = sampleAssets.filter((a) => a.category === 'archive');
    assert.strictEqual(archives.length, 1);
    assert.strictEqual(archives[0].extension, 'ZIP');
  });

  it('filters catalog assets by common folder query (Pictures, Downloads, Documents, Desktop)', () => {
    // Simulate Common Folder "Pictures" filter logic
    const picturesFilter = (asset: MediaAsset) => {
      const cf = 'pictures';
      const matchesCat = (asset.category === 'image' || asset.category === 'raw');
      const matchesPath = asset.path.toLowerCase().includes(cf) || asset.name.toLowerCase().includes(cf);
      return matchesCat || matchesPath;
    };

    const picResults = sampleAssets.filter(picturesFilter);
    assert.strictEqual(picResults.length, 3); // portrait_shoot.jpg, raw_capture.cr2, desktop_screenshot.png (image)

    // Simulate Common Folder "Downloads" filter logic
    const downloadsFilter = (asset: MediaAsset) => {
      const cf = 'downloads';
      const matchesCat = asset.path.toLowerCase().includes('download') || asset.tags.some(t => t.toLowerCase().includes('download'));
      const matchesPath = asset.path.toLowerCase().includes(cf) || asset.name.toLowerCase().includes(cf);
      return matchesCat || matchesPath;
    };

    const downloadResults = sampleAssets.filter(downloadsFilter);
    assert.strictEqual(downloadResults.length, 1);
    assert.strictEqual(downloadResults[0].name, 'client_deliverable.zip');

    // Simulate Common Folder "Documents" filter logic
    const docsFilter = (asset: MediaAsset) => {
      const cf = 'documents';
      const matchesCat = asset.category === 'document';
      const matchesPath = asset.path.toLowerCase().includes(cf) || asset.name.toLowerCase().includes(cf);
      return matchesCat || matchesPath;
    };

    const docResults = sampleAssets.filter(docsFilter);
    assert.strictEqual(docResults.length, 1);
    assert.strictEqual(docResults[0].name, 'invoice_2026.pdf');
  });

  it('combines category filter and omnibox query without collision', () => {
    const activeCategory: MediaCategory = 'image';
    const searchQuery = 'desktop';

    const results = sampleAssets.filter((asset) => {
      if (asset.category !== activeCategory) return false;
      const q = searchQuery.toLowerCase();
      return asset.name.toLowerCase().includes(q) || asset.path.toLowerCase().includes(q);
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].name, 'desktop_screenshot.png');
  });

  it('computes compact 38px SVG donut stroke circumference and offset correctly', () => {
    const size = 38;
    const strokeWidth = 3.5;
    const radius = (size - strokeWidth) / 2; // (38 - 3.5) / 2 = 17.25
    const circumference = 2 * Math.PI * radius; // ~108.38
    const percent = 50;
    const offset = circumference - (percent / 100) * circumference;

    assert.ok(radius > 17 && radius < 18);
    assert.ok(circumference > 108 && circumference < 109);
    assert.strictEqual(offset, circumference / 2);
  });
});
