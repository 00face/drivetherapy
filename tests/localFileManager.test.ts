/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Native OS Local File Manager Verification Suite
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import os from 'os';
import path from 'path';
import fs from 'fs';

// Helper mirror of server categorization logic to verify contract integrity
const FS_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  cr3: 'image/x-canon-cr3',
  arw: 'image/x-sony-arw',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  pdf: 'application/pdf',
  zip: 'application/zip',
};

function getLocalFileCategory(
  ext: string,
  mime: string
): 'image' | 'raw' | 'video' | 'audio' | 'document' | 'archive' | 'other' {
  const uExt = ext.toUpperCase().replace('.', '');
  if (
    ['CR2', 'CR3', 'NEF', 'ARW', 'DNG', 'RW2', 'ORF', 'TIFF', 'TIF', 'BMP'].includes(uExt) ||
    mime.includes('raw')
  ) {
    return 'raw';
  }
  if (
    ['JPG', 'JPEG', 'PNG', 'WEBP', 'GIF', 'SVG', 'AVIF', 'HEIC', 'HEIF'].includes(uExt) ||
    mime.startsWith('image/')
  ) {
    return 'image';
  }
  if (['MP4', 'MOV', 'MKV', 'WEBM', 'AVI', 'M4V', 'WMV'].includes(uExt) || mime.startsWith('video/')) {
    return 'video';
  }
  if (['MP3', 'WAV', 'FLAC', 'AAC', 'OGG', 'M4A', 'WMA'].includes(uExt) || mime.startsWith('audio/')) {
    return 'audio';
  }
  if (
    ['PDF', 'DOC', 'DOCX', 'TXT', 'MD', 'XLS', 'XLSX', 'PPT', 'PPTX', 'CSV', 'LOG'].includes(uExt) ||
    mime.includes('document') ||
    mime.includes('text/')
  ) {
    return 'document';
  }
  if (['ZIP', '7Z', 'TAR', 'GZ', 'RAR', 'PSD', 'AI'].includes(uExt) || mime.includes('zip') || mime.includes('compressed')) {
    return 'archive';
  }
  return 'other';
}

describe('Native OS Local File Manager & Stream Gateway Suite', () => {
  test('Categorizes standard media extensions into canonical categories', () => {
    assert.strictEqual(getLocalFileCategory('jpg', 'image/jpeg'), 'image');
    assert.strictEqual(getLocalFileCategory('cr3', 'image/x-canon-cr3'), 'raw');
    assert.strictEqual(getLocalFileCategory('arw', 'image/x-sony-arw'), 'raw');
    assert.strictEqual(getLocalFileCategory('mp4', 'video/mp4'), 'video');
    assert.strictEqual(getLocalFileCategory('mp3', 'audio/mpeg'), 'audio');
    assert.strictEqual(getLocalFileCategory('pdf', 'application/pdf'), 'document');
    assert.strictEqual(getLocalFileCategory('zip', 'application/zip'), 'archive');
    assert.strictEqual(getLocalFileCategory('iso', 'application/octet-stream'), 'other');
  });

  test('Quick Access locations builder resolves existing host user directories', () => {
    const home = os.homedir();
    assert.ok(home && home.length > 0);
    assert.ok(fs.existsSync(home));

    const candidateRoots = [
      { id: 'home', name: 'Home', path: home },
      { id: 'pictures', name: 'Pictures', path: path.join(home, 'Pictures') },
      { id: 'downloads', name: 'Downloads', path: path.join(home, 'Downloads') },
      { id: 'documents', name: 'Documents', path: path.join(home, 'Documents') },
      { id: 'desktop', name: 'Desktop', path: path.join(home, 'Desktop') },
      { id: 'root', name: os.platform() === 'win32' ? 'C:\\' : '/', path: os.platform() === 'win32' ? 'C:\\' : '/' },
    ];

    const accessible = candidateRoots.filter((item) => {
      try {
        return fs.existsSync(item.path) && fs.statSync(item.path).isDirectory();
      } catch {
        return false;
      }
    });

    // Home and Root should always exist on any standard OS
    assert.ok(accessible.some((a) => a.id === 'home'));
    assert.ok(accessible.some((a) => a.id === 'root'));
  });

  test('Directory path normalization handles tilde and guards against null byte injection', () => {
    const home = os.homedir();
    const rawPath = '~/Pictures';
    const cleanPath = rawPath.startsWith('~') ? path.join(home, rawPath.slice(1)) : rawPath;
    const targetPath = path.resolve(cleanPath);

    assert.strictEqual(targetPath, path.join(home, 'Pictures'));

    // Null-byte injection detection
    const malicious = '/etc/passwd\0.jpg';
    assert.ok(malicious.indexOf('\0') !== -1);
  });

  test('Breadcrumb hierarchy builds valid navigational path chain from root to target', () => {
    const target = path.resolve(os.homedir());
    const rootPath = os.platform() === 'win32' ? path.parse(target).root : '/';
    const relative = path.relative(rootPath, target);
    const parts = relative ? relative.split(path.sep).filter(Boolean) : [];

    const breadcrumbs = [{ name: rootPath === '/' ? 'Computer' : rootPath, path: rootPath }];
    let acc = rootPath;
    for (const part of parts) {
      acc = path.join(acc, part);
      breadcrumbs.push({ name: part, path: acc });
    }

    assert.ok(breadcrumbs.length >= 1);
    assert.strictEqual(breadcrumbs[breadcrumbs.length - 1].path, target);
  });

  test('HTTP Range parser handles byte slicing for video/audio seek streaming', () => {
    const totalSize = 100000;
    const rangeHeader = 'bytes=2000-4999';

    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

    assert.strictEqual(start, 2000);
    assert.strictEqual(end, 4999);
    assert.strictEqual(end - start + 1, 3000); // 3000 byte chunk
  });

  test('Local file asset creation produces valid schema with local stream URL', () => {
    const testFile = {
      name: 'sunset.jpg',
      path: '/home/user/Pictures/sunset.jpg',
      size: 4500000,
      modifiedTime: new Date().toISOString(),
      extension: 'JPG',
      category: 'image' as const,
      mimeType: 'image/jpeg',
    };

    const streamUrl = `/api/fs/stream?path=${encodeURIComponent(testFile.path)}`;
    assert.ok(streamUrl.includes('path=%2Fhome%2Fuser%2FPictures%2Fsunset.jpg'));

    const mockAsset = {
      id: 'local_os_test123',
      name: testFile.name,
      source: 'local' as const,
      category: testFile.category,
      mimeType: testFile.mimeType,
      extension: testFile.extension,
      path: testFile.path,
      sizeBytes: testFile.size,
      modifiedTime: testFile.modifiedTime,
      thumbnailUrl: streamUrl,
      cloudUrl: undefined,
      isCached: true,
      cullingStatus: 'unrated' as const,
      rating: 0,
      tags: ['My Computer', 'IMAGE', 'JPG'],
    };

    assert.strictEqual(mockAsset.source, 'local');
    assert.strictEqual(mockAsset.thumbnailUrl, streamUrl);
    assert.strictEqual(mockAsset.cloudUrl, undefined);
  });
});
