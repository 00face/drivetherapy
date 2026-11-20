/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  getPolluxPortraitUrl,
  getPolluxSpriteUrl,
} from '../src/services/polluxTourAgent.ts';

describe('[WO-102] Castor/Pollux Sliced Sprites, Optical Text Hinting, AAA Settings, 20-Locale i18n & Motion', () => {
  it('verifies sliced transparent Castor & Pollux individual sprites exist on disk', () => {
    const publicDir = path.resolve(process.cwd(), 'public');
    assert.ok(
      fs.existsSync(path.join(publicDir, 'characters/castor/C-01/02_Happy.png')),
      'Missing sliced Castor C-01 Happy sprite'
    );
    assert.ok(
      fs.existsSync(path.join(publicDir, 'characters/castor/C-01/12_Scared.png')),
      'Missing repaired Castor C-01 Scared sprite'
    );
    assert.ok(
      fs.existsSync(path.join(publicDir, getPolluxPortraitUrl().split('?')[0])),
      'Missing repaired Pollux portrait sprite'
    );
    assert.ok(
      fs.existsSync(path.join(publicDir, getPolluxSpriteUrl('P-01', '03_Confident.png').split('?')[0])),
      'Missing sliced Pollux P-01 Confident sprite'
    );
  });

  it('verifies upgraded Optical Text Hinting & unified ease-in/ease-out motion tokens in index.css', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
    assert.ok(!css.includes('backdrop-filter: invert(1)'), 'Harsh invert(1) text hinting must be removed');
    assert.ok(css.includes('--motion-ease-enter:'), 'Missing --motion-ease-enter motion token');
    assert.ok(css.includes('--motion-ease-exit:'), 'Missing --motion-ease-exit motion token');
    assert.ok(css.includes('--motion-ease-standard:'), 'Missing --motion-ease-standard motion token');
  });

  it('verifies 100% key parity, placeholder integrity, and accurate native core translations across all 20 locales', () => {
    const localesDir = path.resolve(process.cwd(), 'src/i18n/locales');
    const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8')) as Record<string, string>;
    const enKeys = Object.keys(en);
    const files = fs.readdirSync(localesDir).filter((f) => f.endsWith('.json'));
    assert.equal(files.length, 20, 'Expected exactly 20 locale files');

    const extractPlaceholders = (s: string) => (s.match(/\{[a-zA-Z0-9_]+\}/g) || []).sort();

    for (const file of files) {
      const loc = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8')) as Record<string, string>;
      assert.equal(Object.keys(loc).length, enKeys.length, `${file} key count mismatch`);
      assert.ok(loc['nav.takeout'], `${file} missing nav.takeout`);
      assert.ok(loc['nav.cloudSync'], `${file} missing nav.cloudSync`);

      if (file !== 'en.json') {
        assert.notEqual(loc['ribbon.title'], en['ribbon.title'], `${file} ribbon.title must be natively translated`);
        assert.notEqual(loc['nav.culling'], en['nav.culling'], `${file} nav.culling must be natively translated`);
      }

      for (const k of enKeys) {
        assert.ok(typeof loc[k] === 'string' && loc[k].length > 0, `${file} empty key ${k}`);
        assert.deepEqual(
          extractPlaceholders(loc[k]),
          extractPlaceholders(en[k]),
          `${file} placeholder mismatch on key ${k}`
        );
      }
    }
  });
});
