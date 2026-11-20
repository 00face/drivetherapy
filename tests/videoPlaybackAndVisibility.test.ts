import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { MediaAsset } from '../src/types/index.ts';
import { resolveViewableAssetStreamUrl } from '../src/services/universalFileViewerEngine.ts';

describe('Video Visibility & Stream Playback Regression Suite', () => {
  test('resolveViewableAssetStreamUrl resolves local /home/face/Videos MP4 via path even without localPath', () => {
    const videoAsset: MediaAsset = {
      id: 'local_os_test_mp4',
      name: 'Feral Lantern explainer.mp4',
      source: 'local',
      category: 'video',
      mimeType: 'video/mp4',
      extension: 'MP4',
      path: '/home/face/Videos/Feral Lantern explainer.mp4',
      sizeBytes: 40875851,
      modifiedTime: '2026-11-08T09:09:57.208Z',
      thumbnailUrl: '',
      isCached: true,
      cullingStatus: 'unrated',
      rating: 0,
      tags: ['Computer', 'VIDEO'],
      faces: [],
      quality: { sharpness: 90, exposure: 90, overall: 90, isBlurry: false },
      palette: [],
      exif: {},
    };

    const url = resolveViewableAssetStreamUrl(videoAsset);
    assert.equal(
      url,
      '/api/fs/stream?path=%2Fhome%2Fface%2FVideos%2FFeral%20Lantern%20explainer.mp4'
    );
  });

  test('LocalFileManagerView sets localPath and avoids passing video streamUrl as image thumbnailUrl', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/LocalFileManagerView.tsx'),
      'utf8'
    );
    assert.ok(src.includes('localPath: file.path'), 'mapOsFileToAsset must populate localPath');
    assert.ok(
      src.includes("file.category === 'image' || file.category === 'raw' ? file.streamUrl : ''"),
      'mapOsFileToAsset must not assign video/audio streamUrl to thumbnailUrl'
    );
  });
});
