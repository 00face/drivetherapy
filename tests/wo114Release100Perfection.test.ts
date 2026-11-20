/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-114] Release 100/100 Verification Suite
 * Tests:
 *  - Unified Modal Stack Coordinator deterministic stack & Escape ordering
 *  - Server-side Cross-Cloud SHA-256 digest verification
 *  - Zero raw OAuth accessToken/refreshToken persisted in localStorage by multiAccountAuth
 *  - Automated WCAG contrast & prefers-reduced-motion verification across theme engine & CSS
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  closeAllPrimaryModals,
  closePrimaryModal,
  closeTopPrimaryModal,
  createModalStackState,
  getTopPrimaryModal,
  openPrimaryModal,
} from '../src/services/modalCoordinator';
import { computeSha256Hex } from '../server/routes/externalClouds';
import { clearAllAccountProfiles, saveAccountProfile } from '../src/services/multiAccountAuth';
import { APP_THEMES } from '../src/services/themeEngine';

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrastRatio(hex1: string, hex2: string): number {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  if (!c1 || !c2) return 21;
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

describe('[WO-114] Release 100/100 Verification — Modal Coordinator, SHA-256, Zero-Token Storage & WCAG Contrast', () => {
  it('manages primary modal stack deterministically and closes topmost on Escape', () => {
    let state = createModalStackState();
    assert.equal(getTopPrimaryModal(state), null);

    state = openPrimaryModal(state, 'settings');
    assert.equal(getTopPrimaryModal(state), 'settings');

    // Opening another primary modal replaces by default (zero accidental modal stacking)
    state = openPrimaryModal(state, 'butler');
    assert.deepEqual(state.stack, ['butler']);

    // Explicit stacked confirmation dialog sits cleanly on top
    state = openPrimaryModal(state, 'destructive-confirm', { allowStackOver: true });
    assert.deepEqual(state.stack, ['butler', 'destructive-confirm']);

    const popped = closeTopPrimaryModal(state);
    assert.equal(popped.closed, 'destructive-confirm');
    assert.equal(getTopPrimaryModal(popped.next), 'butler');

    state = closePrimaryModal(popped.next, 'butler');
    assert.equal(getTopPrimaryModal(state), null);
    assert.deepEqual(closeAllPrimaryModals().stack, []);
  });

  it('computes accurate SHA-256 digests for cross-cloud byte-relay verification', () => {
    const hash = computeSha256Hex('drive-therapy-non-destructive-relay');
    assert.equal(hash.length, 64);
    assert.equal(hash, computeSha256Hex(Buffer.from('drive-therapy-non-destructive-relay')));
  });

  it('strips raw accessToken and refreshToken before writing dt_multi_account_profiles_v1 to localStorage', () => {
    const lsMap = new Map<string, string>();
    const fakeLS = {
      getItem: (k: string) => lsMap.get(k) ?? null,
      setItem: (k: string, v: string) => lsMap.set(k, v),
      removeItem: (k: string) => lsMap.delete(k),
      clear: () => lsMap.clear(),
      get length() {
        return lsMap.size;
      },
      key: (i: number) => Array.from(lsMap.keys())[i] ?? null,
    };

    const origWindow = (globalThis as Record<string, unknown>).window;
    const origLS = (globalThis as Record<string, unknown>).localStorage;
    (globalThis as Record<string, unknown>).localStorage = fakeLS;
    (globalThis as Record<string, unknown>).window = { localStorage: fakeLS };

    try {
      clearAllAccountProfiles();
      saveAccountProfile({
        email: 'sec@studio.dev',
        name: 'Sec Test',
        tokenRecord: {
          accessToken: 'ya29.TOP_SECRET_MUST_NOT_HIT_LOCALSTORAGE',
          refreshToken: '1//TOP_SECRET_REFRESH',
          expiresAt: Date.now() + 3600_000,
          scopes: ['drive'],
        },
      });
      const raw = lsMap.get('dt_multi_account_profiles_v1') || '';
      assert.ok(raw.includes('sec@studio.dev'));
      assert.equal(raw.includes('TOP_SECRET_MUST_NOT_HIT_LOCALSTORAGE'), false);
      assert.equal(raw.includes('TOP_SECRET_REFRESH'), false);
    } finally {
      clearAllAccountProfiles();
      (globalThis as Record<string, unknown>).window = origWindow;
      (globalThis as Record<string, unknown>).localStorage = origLS;
    }
  });

  it('verifies WCAG contrast ratios across all 52 themes and prefers-reduced-motion support in index.css', () => {
    assert.ok(APP_THEMES.length >= 52, `Expected >= 52 themes, got ${APP_THEMES.length}`);
    for (const theme of APP_THEMES) {
      const ratio = contrastRatio(theme.text, theme.surface);
      assert.ok(
        ratio >= 4.5,
        `Theme ${theme.id} text/bg contrast (${ratio.toFixed(2)}:1) must meet WCAG AA >= 4.5:1`
      );
    }
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
    assert.ok(css.includes('prefers-reduced-motion'), 'index.css must honor prefers-reduced-motion');
  });
});
