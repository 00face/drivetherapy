import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectDisplayProfile, detectUaEngine } from '../src/services/adaptiveDisplayProfile.ts';
import { VISUALIZER_MODES, drawVisualizerFrame } from '../src/services/visualizerRenderer.ts';
import { findNextSpatialFocusable } from '../src/services/dpadNavigation.ts';
import { TOUR_TRACKS } from '../src/services/interactiveTourEngine.ts';
import { resolveReactiveGemColor } from '../src/components/FloatingGCommsButton.tsx';

describe('Media Player Visualizers, Interactive Tour, D-Pad & Adaptive Display Profile', () => {
  it('detects UA engines and display tiers accurately across Smart TV, Touch, 4K, Safari & Firefox', () => {
    assert.equal(detectUaEngine('Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0)'), 'smart-tv');
    assert.equal(detectUaEngine('Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0'), 'gecko-firefox');
    assert.equal(detectUaEngine('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'), 'webkit-safari');

    const tvProfile = detectDisplayProfile({ width: 1920, userAgent: 'Mozilla/5.0 (Web0S; Linux/SmartTV)' });
    assert.equal(tvProfile.displayTier, 'tv-tenfoot');
    assert.equal(tvProfile.inputMode, 'dpad');

    const touchProfile = detectDisplayProfile({ width: 390, coarsePointer: true, userAgent: 'Mozilla/5.0 Safari/605.1.15' });
    assert.equal(touchProfile.displayTier, 'compact-touch');
    assert.equal(touchProfile.inputMode, 'touch');

    const largeProfile = detectDisplayProfile({ width: 2560, coarsePointer: false, userAgent: 'Mozilla/5.0 Chrome/128.0' });
    assert.equal(largeProfile.displayTier, 'large-format');
  });

  it('renders all 5 FFT visualizer modes cleanly without throwing', () => {
    const calls: string[] = [];
    const mockCtx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      clearRect: () => calls.push('clear'),
      fillRect: () => calls.push('fillRect'),
      beginPath: () => calls.push('beginPath'),
      moveTo: () => calls.push('moveTo'),
      lineTo: () => calls.push('lineTo'),
      arc: () => calls.push('arc'),
      stroke: () => calls.push('stroke'),
      fill: () => calls.push('fill'),
      createLinearGradient: () => ({ addColorStop: () => {} }),
    };
    const spectrum = new Uint8Array(64).fill(128);
    assert.equal(VISUALIZER_MODES.length, 5);
    for (const m of VISUALIZER_MODES) {
      drawVisualizerFrame(mockCtx, 520, 84, spectrum, m.id, 0.5, true, false);
    }
    assert.ok(calls.includes('fillRect'));
    assert.ok(calls.includes('stroke'));
    assert.ok(calls.includes('fill'));
  });

  it('finds nearest spatial focusable element in 2D D-Pad navigation', () => {
    const active = { left: 100, top: 100, right: 200, bottom: 144, width: 100, height: 44 };
    const candidates = [
      { el: 'rightBtn', rect: { left: 260, top: 100, right: 360, bottom: 144, width: 100, height: 44 } },
      { el: 'downBtn', rect: { left: 100, top: 200, right: 200, bottom: 244, width: 100, height: 44 } },
      { el: 'farDownBtn', rect: { left: 400, top: 300, right: 500, bottom: 344, width: 100, height: 44 } },
    ];
    assert.equal(findNextSpatialFocusable(active, candidates, 'right'), 'rightBtn');
    assert.equal(findNextSpatialFocusable(active, candidates, 'down'), 'downBtn');
    assert.equal(findNextSpatialFocusable(active, candidates, 'left'), null);
  });

  it('provides 3 structured interactive tour tracks with valid steps', () => {
    assert.equal(TOUR_TRACKS.length, 3);
    assert.ok(TOUR_TRACKS[0].steps.length >= 4);
  });

  it('resolves reactive gemstone colors from Gemini & Google Chat activity', () => {
    assert.equal(resolveReactiveGemColor({}), 'diamond');
    assert.equal(resolveReactiveGemColor({ isActive: true, activeTab: 'gemini' }), 'sapphire');
    assert.equal(resolveReactiveGemColor({ isActive: true, activeTab: 'chat' }), 'emerald');
    assert.equal(resolveReactiveGemColor({ isScanning: true }), 'amber');
    assert.equal(resolveReactiveGemColor({ currentMode: 'culling' }), 'amethyst');
  });
});
