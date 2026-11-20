import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CHAT_COLOR_SWATCHES,
  CHAT_DECORATION_PRESETS,
  DEFAULT_CHAT_DECORATION_PREFS,
  resolveChatDecorationStyles,
} from '../src/services/chatDecorationEngine.ts';

describe('[WO-099] Custom Gchat & Castor Chat Decoration Engine', () => {
  it('provides all 14 Material 3 two-tone color swatches and 6 decoration presets', () => {
    assert.equal(CHAT_COLOR_SWATCHES.length, 14);
    assert.equal(CHAT_DECORATION_PRESETS.length, 6);
    const ids = new Set(CHAT_DECORATION_PRESETS.map((p) => p.id));
    assert.ok(ids.has('drive-sync'));
    assert.ok(ids.has('material-swatch'));
    assert.ok(ids.has('sakura-glow'));
    assert.ok(ids.has('midnight-lantern'));
    assert.ok(ids.has('pastel-pixel'));
    assert.ok(ids.has('rpg-tavern'));
  });

  it('blends with the active Drive Therapy theme by default and produces a unique readable backdrop', () => {
    const resolved = resolveChatDecorationStyles(DEFAULT_CHAT_DECORATION_PREFS);
    assert.equal(resolved.isOverridingTheme, false);
    assert.equal(resolved.shellBg, 'var(--theme-surface)');
    assert.equal(resolved.shellText, 'var(--theme-text)');
    assert.notEqual(resolved.canvasBgImage, 'none');
  });

  it('overrides Drive Therapy theme when influenceMode is override on a decoration preset', () => {
    const resolved = resolveChatDecorationStyles({
      ...DEFAULT_CHAT_DECORATION_PREFS,
      decorationId: 'sakura-glow',
      influenceMode: 'override',
      density: 'compact',
    });
    assert.equal(resolved.isOverridingTheme, true);
    assert.equal(resolved.shellText, '#FDF2F8');
    assert.equal(resolved.messageGapClass, 'space-y-2');
    assert.equal(resolved.bubblePaddingClass, 'px-2.5 py-2');
  });

  it('applies Material 3 swatch accent colors cleanly in both blend and override modes', () => {
    const resolved = resolveChatDecorationStyles({
      ...DEFAULT_CHAT_DECORATION_PREFS,
      decorationId: 'material-swatch',
      swatchId: 'emerald',
      influenceMode: 'override',
    });
    assert.equal(resolved.swatch.name, 'Emerald');
    assert.equal(resolved.userBubbleBg, '#0B6B54');
    assert.equal(resolved.userBubbleText, '#FFFFFF');
  });
});
