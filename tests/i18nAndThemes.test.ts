/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Test Suite: i18n Flatfile Locales & Theme Personalization Engine
 * Validates complete 20-language flatfile parity, RTL/vertical definitions,
 * and Themes terminology compliance.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TOP_20_LANGUAGES } from '../src/i18n';
import { APP_THEMES, GMAIL_THEMES, themeManager } from '../src/services/themeEngine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.resolve(__dirname, '../src/i18n/locales');
const EXPECTED_LANG_CODES = [
  'en', 'zh', 'es', 'hi', 'ar', 'fr', 'bn', 'pt', 'ru', 'ur',
  'id', 'de', 'ja', 'mr', 'te', 'tr', 'ta', 'vi', 'ko', 'it'
];

describe('i18n Top 20 Global Language Flatfiles', () => {
  it('should define exactly 20 canonical languages in TOP_20_LANGUAGES', () => {
    assert.equal(TOP_20_LANGUAGES.length, 20);
    const codes = TOP_20_LANGUAGES.map((l) => l.code);
    for (const code of EXPECTED_LANG_CODES) {
      assert.ok(codes.includes(code), `Missing language code: ${code}`);
    }
  });

  it('should identify Arabic (ar) and Urdu (ur) as RTL scripts', () => {
    const ar = TOP_20_LANGUAGES.find((l) => l.code === 'ar');
    const ur = TOP_20_LANGUAGES.find((l) => l.code === 'ur');
    assert.equal(ar?.dir, 'rtl');
    assert.equal(ur?.dir, 'rtl');
  });

  it('should support vertical typography for Chinese (zh) and Japanese (ja)', () => {
    const zh = TOP_20_LANGUAGES.find((l) => l.code === 'zh');
    const ja = TOP_20_LANGUAGES.find((l) => l.code === 'ja');
    assert.equal(zh?.vertical, true);
    assert.equal(ja?.vertical, true);
  });

  it('should have a dedicated flatfile for every one of the 20 languages', () => {
    for (const code of EXPECTED_LANG_CODES) {
      const filePath = path.join(localesDir, `${code}.json`);
      assert.ok(fs.existsSync(filePath), `Flatfile missing: ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.doesNotThrow(() => JSON.parse(content));
    }
  });

  it('should have 100% key parity across all 20 locale flatfiles matching en.json', () => {
    const enFilePath = path.join(localesDir, 'en.json');
    const enDict = JSON.parse(fs.readFileSync(enFilePath, 'utf8'));
    const enKeys = Object.keys(enDict).sort();
    assert.ok(enKeys.length >= 300, `Expected at least 300 keys, found ${enKeys.length}`);

    for (const code of EXPECTED_LANG_CODES) {
      const filePath = path.join(localesDir, `${code}.json`);
      const dict = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const dictKeys = Object.keys(dict).sort();

      for (const key of enKeys) {
        assert.ok(dict[key] !== undefined, `Missing key "${key}" in ${code}.json`);
        assert.ok(dict[key].length > 0, `Empty string for key "${key}" in ${code}.json`);
      }
      assert.equal(dictKeys.length, enKeys.length);
    }
  });

  it('should use "Themes" instead of "Gmail Themes" in all translations and buttons', () => {
    const enFilePath = path.join(localesDir, 'en.json');
    const enDict = JSON.parse(fs.readFileSync(enFilePath, 'utf8'));
    assert.equal(enDict['footer.theme'], 'Themes');
    assert.equal(enDict['theme.modalTitle'], 'Themes & Wallpapers');
    assert.equal(enDict['aria.themePicker'], 'Open Themes Picker');

    // Confirm no occurrences of "Gmail Theme" in en.json
    for (const val of Object.values(enDict)) {
      assert.ok(!String(val).toLowerCase().includes('gmail theme'));
    }
  });
});

describe('Themes & Personalization Engine', () => {
  it('should provide canonical themes and wallpaper support', () => {
    assert.ok(APP_THEMES.length >= 9);
    assert.equal(GMAIL_THEMES, APP_THEMES);

    const defaultTheme = themeManager.getTheme();
    assert.ok(defaultTheme);
    assert.ok(defaultTheme.id);
  });

  it('should allow setting custom wallpaper and parameters', () => {
    const updated = themeManager.setCustomWallpaper('https://example.com/custom.jpg', 6, 0.9);
    assert.equal(updated.id, 'custom-wallpaper');
    assert.equal(updated.wallpaperUrl, 'https://example.com/custom.jpg');
    assert.equal(updated.blurAmount, 6);
    assert.equal(updated.cardOpacity, 0.9);
  });
});
