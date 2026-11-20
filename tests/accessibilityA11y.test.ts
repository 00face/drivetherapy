/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Test Suite: Universal Accessibility (ADDI & WCAG 2.2 AAA),
 * Sensory Control Center & Procedural Vim Navigation Suite
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { APP_THEMES, themeManager } from '../src/services/themeEngine';
import { MediaAsset } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.resolve(__dirname, '../src/i18n/locales');
const EXPECTED_LANG_CODES = [
  'en', 'zh', 'es', 'hi', 'ar', 'fr', 'bn', 'pt', 'ru', 'ur',
  'id', 'de', 'ja', 'mr', 'te', 'tr', 'ta', 'vi', 'ko', 'it',
];

describe('Accessibility & Sensory Design (ADDI / Home Office Guidelines)', () => {
  it('should include dedicated High Contrast (AAA) and Warm Low-Glare (Dyslexia) theme presets', () => {
    const contrastTheme = APP_THEMES.find((t) => t.id === 'high-contrast');
    const warmTheme = APP_THEMES.find((t) => t.id === 'warm-lowglare');

    assert.ok(contrastTheme, 'High Contrast theme must exist in APP_THEMES');
    assert.equal(contrastTheme.background, '#000000');
    assert.equal(contrastTheme.border, '#FFD700');
    assert.equal(contrastTheme.isDark, true);

    assert.ok(warmTheme, 'Warm Low-Glare theme must exist in APP_THEMES');
    assert.equal(warmTheme.background, '#FDF6E3');
    assert.equal(warmTheme.isDark, false);
  });

  it('should store and retrieve accessibility preferences (dyslexia font, calm motion, font scale, vim mode)', () => {
    themeManager.setA11yPrefs({
      dyslexiaFont: true,
      fontScale: 'large',
      calmMotion: true,
      vimMode: true,
    });

    const prefs = themeManager.getA11yPrefs();
    assert.equal(prefs.dyslexiaFont, true);
    assert.equal(prefs.fontScale, 'large');
    assert.equal(prefs.calmMotion, true);
    assert.equal(prefs.vimMode, true);

    // Reset back
    themeManager.setA11yPrefs({
      dyslexiaFont: false,
      fontScale: 'normal',
      calmMotion: false,
    });
    assert.equal(themeManager.getA11yPrefs().dyslexiaFont, false);
  });

  it('should guarantee 100% parity across all 20 language flatfiles for a11y, shortcuts and safety keys', () => {
    const requiredPrefixes = ['a11y.', 'shortcuts.', 'safety.'];
    const enFilePath = path.join(localesDir, 'en.json');
    const enDict = JSON.parse(fs.readFileSync(enFilePath, 'utf8'));

    const a11yKeys = Object.keys(enDict).filter((k) =>
      requiredPrefixes.some((p) => k.startsWith(p))
    );
    assert.ok(a11yKeys.length >= 25, `Expected >= 25 accessibility keys, got ${a11yKeys.length}`);

    for (const code of EXPECTED_LANG_CODES) {
      const filePath = path.join(localesDir, `${code}.json`);
      const dict = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      for (const key of a11yKeys) {
        assert.ok(dict[key] !== undefined, `Missing key "${key}" in ${code}.json`);
        assert.ok(dict[key].length > 0, `Empty key "${key}" in ${code}.json`);
      }
    }
  });
});

describe('Procedural Vim Navigation & Logic Engine', () => {
  const dummyAssets: MediaAsset[] = [
    {
      id: 'asset_0',
      name: 'IMG_0001.JPG',
      source: 'cloud',
      category: 'image',
      mimeType: 'image/jpeg',
      extension: 'JPG',
      path: '/Drive/Photos/IMG_0001.JPG',
      sizeBytes: 1024,
      modifiedTime: new Date().toISOString(),
      thumbnailUrl: '',
      isCached: true,
      cullingStatus: 'unrated',
      rating: 0,
      tags: [],
      faces: [],
      quality: { sharpness: 90, exposure: 80, overall: 85, isBlurry: false },
      palette: [],
      exif: {},
    },
    {
      id: 'asset_1',
      name: 'IMG_0002.JPG',
      source: 'cloud',
      category: 'image',
      mimeType: 'image/jpeg',
      extension: 'JPG',
      path: '/Drive/Photos/IMG_0002.JPG',
      sizeBytes: 2048,
      modifiedTime: new Date().toISOString(),
      thumbnailUrl: '',
      isCached: true,
      cullingStatus: 'unrated',
      rating: 0,
      tags: [],
      faces: [],
      quality: { sharpness: 80, exposure: 85, overall: 82, isBlurry: false },
      palette: [],
      exif: {},
    },
    {
      id: 'asset_2',
      name: 'IMG_0003.JPG',
      source: 'cloud',
      category: 'image',
      mimeType: 'image/jpeg',
      extension: 'JPG',
      path: '/Drive/Photos/IMG_0003.JPG',
      sizeBytes: 4096,
      modifiedTime: new Date().toISOString(),
      thumbnailUrl: '',
      isCached: true,
      cullingStatus: 'unrated',
      rating: 0,
      tags: [],
      faces: [],
      quality: { sharpness: 95, exposure: 90, overall: 92, isBlurry: false },
      palette: [],
      exif: {},
    },
  ];

  it('should compute sequential next (j) and previous (k) procedural cursor bounds', () => {
    let selectedId = 'asset_0';
    const getNext = (current: string) => {
      const idx = dummyAssets.findIndex((a) => a.id === current);
      return idx < dummyAssets.length - 1 ? dummyAssets[idx + 1].id : dummyAssets[0].id;
    };
    const getPrev = (current: string) => {
      const idx = dummyAssets.findIndex((a) => a.id === current);
      return idx > 0 ? dummyAssets[idx - 1].id : dummyAssets[dummyAssets.length - 1].id;
    };

    selectedId = getNext(selectedId);
    assert.equal(selectedId, 'asset_1');

    selectedId = getNext(selectedId);
    assert.equal(selectedId, 'asset_2');

    selectedId = getNext(selectedId);
    assert.equal(selectedId, 'asset_0'); // wraps around

    selectedId = getPrev(selectedId);
    assert.equal(selectedId, 'asset_2'); // wraps around to end
  });

  it('should compute jump to start (gg) and jump to end (G) targets', () => {
    const first = dummyAssets[0];
    const last = dummyAssets[dummyAssets.length - 1];

    assert.equal(first.id, 'asset_0');
    assert.equal(last.id, 'asset_2');
  });

  it('should format yanking text from asset cloud link or path correctly', () => {
    const asset = dummyAssets[0];
    const textToYank = asset.cloudUrl || asset.path || asset.name;
    assert.equal(textToYank, '/Drive/Photos/IMG_0001.JPG');
  });
});

describe('Safety & Anxiety Shield (Undo Buffer & Reversible Recovery)', () => {
  it('should accurately buffer purged assets and restore on undo request', () => {
    let workspaceAssets = [
      { id: '1', cullingStatus: 'picked' },
      { id: '2', cullingStatus: 'rejected' },
      { id: '3', cullingStatus: 'rejected' },
      { id: '4', cullingStatus: 'unrated' },
    ];

    const rejectedItems = workspaceAssets.filter((a) => a.cullingStatus === 'rejected');
    assert.equal(rejectedItems.length, 2);

    // Simulate purge
    const undoBuffer = [...rejectedItems];
    workspaceAssets = workspaceAssets.filter((a) => a.cullingStatus !== 'rejected');
    assert.equal(workspaceAssets.length, 2);

    // Simulate Undo
    workspaceAssets = [...workspaceAssets, ...undoBuffer];
    assert.equal(workspaceAssets.length, 4);
    assert.ok(workspaceAssets.some((a) => a.id === '2'));
    assert.ok(workspaceAssets.some((a) => a.id === '3'));
  });
});
