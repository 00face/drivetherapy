import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildDriveBrowserQuery,
  getWorkspaceExportOptions,
} from '../src/services/googleDrive.ts';
import {
  mapPickedPhotoToAsset,
  groupPhotosByDate,
  mergeTakeoutSidecar,
} from '../src/services/googlePhotos.ts';
import {
  DEFAULT_GIF_RECIPE,
  estimateGifSizeBytes,
  generateGifFfmpegArgs,
} from '../src/services/gifStudioEngine.ts';
import { generateVideoEditFfmpegArgs } from '../src/services/videoCurationEngine.ts';

describe('Google Drive & Photos Parity, GIF Studio, Video Editor & Portable Build', () => {
  it('builds Google Drive Trash queries and Workspace export options accurately', () => {
    assert.equal(buildDriveBrowserQuery({ section: 'trash' }), 'trashed = true');
    assert.ok(buildDriveBrowserQuery({ section: 'my-drive', folderId: 'root' }).includes("'root' in parents"));

    const docExports = getWorkspaceExportOptions('application/vnd.google-apps.document');
    assert.ok(docExports.some((e) => e.ext === 'pdf'));
    assert.ok(docExports.some((e) => e.ext === 'docx'));
  });

  it('maps Google Photos Picker items, groups chronologically, and merges Takeout JSON sidecars', () => {
    const picked = mapPickedPhotoToAsset({
      id: 'gp_123',
      createTime: '2026-11-10T18:30:00Z',
      type: 'PHOTO',
      mediaFile: {
        baseUrl: 'https://lh3.googleusercontent.com/test123',
        mimeType: 'image/jpeg',
        filename: 'Sunset.jpg',
        mediaFileMetadata: {
          width: 4000,
          height: 3000,
          cameraMake: 'Google',
          cameraModel: 'Pixel 9 Pro',
        },
      },
    });

    assert.equal(picked.source, 'photos');
    assert.equal(picked.exif.camera, 'Google Pixel 9 Pro');
    assert.ok(picked.thumbnailUrl.startsWith('/api/photos/proxy?url='));

    const merged = mergeTakeoutSidecar(picked, {
      photoTakenTime: { timestamp: '1700000000' },
      geoData: { latitude: 30.2672, longitude: -97.7431 },
      people: [{ name: 'Alex' }],
      description: 'Golden hour skyline',
    });

    assert.equal(merged.aiDescription, 'Golden hour skyline');
    assert.equal(merged.faces[0]?.label, 'Alex');
    assert.deepEqual(merged.metadata?.gps, { lat: 30.2672, lng: -97.7431 });

    const grouped = groupPhotosByDate([picked, merged]);
    assert.equal(grouped.length, 2);
  });

  it('generates safe FFmpeg filter-complex args for GIF Studio (reverse, boomerang, palettegen)', () => {
    const args = generateGifFfmpegArgs('/tmp/in.mp4', '/tmp/out.gif', {
      ...DEFAULT_GIF_RECIPE,
      boomerang: true,
      speed: 2,
      colors: 128,
    });
    const filterIdx = args.indexOf('-filter_complex');
    assert.ok(filterIdx >= 0);
    assert.ok(args[filterIdx + 1].includes('palettegen=max_colors=128'));
    assert.ok(args[filterIdx + 1].includes('reverse'));
    assert.ok(estimateGifSizeBytes(DEFAULT_GIF_RECIPE) > 0);
  });

  it('generates lossless stream-copy args for trim-only and filter-graph args for video edits', () => {
    const lossless = generateVideoEditFfmpegArgs('/tmp/a.mp4', '/tmp/a_edited.mp4', {
      startTime: 1,
      endTime: 5,
      rotation: 0,
      flipH: false,
      flipV: false,
      cropAspect: 'free',
      speed: 1,
      muteAudio: false,
    });
    assert.equal(lossless.isLosslessCopy, true);
    assert.ok(lossless.args.includes('copy'));

    const transformed = generateVideoEditFfmpegArgs('/tmp/a.mp4', '/tmp/a_edited.mp4', {
      startTime: 1,
      endTime: 5,
      rotation: 90,
      flipH: true,
      flipV: false,
      cropAspect: '9:16',
      speed: 1.5,
      muteAudio: true,
    });
    assert.equal(transformed.isLosslessCopy, false);
    assert.ok(transformed.args.includes('-vf'));
    assert.ok(transformed.args.includes('-an'));
  });

  it('StorageSidebar provides a 3-tab Drive / Photos / Local switcher without truncation', () => {
    const sidebar = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/StorageSidebar.tsx'),
      'utf8'
    );
    assert.ok(sidebar.includes('grid-cols-3'));
    assert.ok(sidebar.includes("handleSwitchTab('photos')"));
    assert.ok(sidebar.includes('>Drive<'));
    assert.ok(sidebar.includes('>Photos<'));
    assert.ok(sidebar.includes('>Local<'));
  });

  it('App.tsx checks loadOAuthToken().accessToken in handleScanDrive and GooglePhotosView auto-loads on connect', () => {
    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    assert.ok(appSrc.includes('if (!user && !loadOAuthToken()?.accessToken)'));

    const photosViewSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/GooglePhotosView.tsx'),
      'utf8'
    );
    assert.ok(photosViewSrc.includes('autoLoadGooglePhotosLibrary()'));
  });
});
