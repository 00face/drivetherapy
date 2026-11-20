/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-111] True Zero-Residue Atomic User Data Flush Verification Suite
 * Ensures "Flush Everything" wipes 100% of browser localStorage/sessionStorage PII,
 * resets ButlerEngine in-memory identity & services, and destroys server dt_sid sessions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';

import {
  destroySession,
  getExternalCloudSecret,
  getOrCreateSessionId,
  setExternalCloudSecret,
} from '../server/security/sessionVault';
import { butlerEngine } from '../src/services/butler/butlerEngine';
import { flushAllStorage } from '../src/services/storageJanitor';

function createMockReqRes(cookieHeader = '') {
  const headers: Record<string, string[]> = {};
  const req = {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    secure: false,
  } as unknown as Request;
  const res = {
    append(name: string, value: string) {
      const key = name.toLowerCase();
      headers[key] = headers[key] || [];
      headers[key].push(value);
    },
  } as unknown as Response;
  return { req, res, headers };
}

describe('[WO-111] True Zero-Residue Atomic User Data Flush', () => {
  it('destroys server-side encrypted dt_sid session vault and expires cookie', () => {
    const first = createMockReqRes();
    const sid = getOrCreateSessionId(first.req, first.res);
    setExternalCloudSecret(sid, 'dropbox', { accessToken: 'secret_dbx_token' });
    assert.equal(getExternalCloudSecret(sid, 'dropbox')?.accessToken, 'secret_dbx_token');

    const second = createMockReqRes(`dt_sid=${sid}`);
    const existed = destroySession(second.req, second.res);
    assert.equal(existed, true);
    assert.equal(getExternalCloudSecret(sid, 'dropbox'), null);
    const setCookies = second.headers['set-cookie'] || [];
    assert.ok(setCookies.some((c) => c.includes('dt_sid=') && c.includes('Max-Age=0')));
  });

  it('wipes 100% of localStorage/sessionStorage PII and resets ButlerEngine in memory on flushAllStorage()', async () => {
    const lsMap = new Map<string, string>([
      ['dt_multi_account_profiles_v1', JSON.stringify([{ id: 'u1', email: 'test@example.com', name: 'Test User' }])],
      ['dt_google_music_sub_accounts_v1', JSON.stringify([{ id: 'm1', name: 'Channel' }])],
      ['drive_auth_token', 'ya29.fake_token'],
      ['dt_external_cloud_connections_v1', JSON.stringify({ dropbox: { connected: true } })],
      ['dt_gemini_api_key_v1', 'AIzaSyFakeKey'],
      ['dt_google_chat_spaces_v1', JSON.stringify([{ name: 'spaces/123' }])],
    ]);
    const ssMap = new Map<string, string>([['dt_oauth_session_v2', 'obfuscated_token']]);

    const makeStorage = (m: Map<string, string>) => ({
      getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
      setItem: (k: string, v: string) => m.set(k, v),
      removeItem: (k: string) => m.delete(k),
      clear: () => m.clear(),
      get length() {
        return m.size;
      },
      key: (i: number) => Array.from(m.keys())[i] ?? null,
    });

    const origWindow = (globalThis as Record<string, unknown>).window;
    const origLS = (globalThis as Record<string, unknown>).localStorage;
    const origSS = (globalThis as Record<string, unknown>).sessionStorage;
    const origFetch = globalThis.fetch;

    const fakeLS = makeStorage(lsMap);
    const fakeSS = makeStorage(ssMap);
    (globalThis as Record<string, unknown>).localStorage = fakeLS;
    (globalThis as Record<string, unknown>).sessionStorage = fakeSS;
    (globalThis as Record<string, unknown>).window = {
      localStorage: fakeLS,
      sessionStorage: fakeSS,
    };
    let factoryResetCalled = false;
    globalThis.fetch = (async (input: string | URL | Request) => {
      if (String(input).includes('/api/system/factory-reset')) {
        factoryResetCalled = true;
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    }) as unknown as typeof fetch;

    try {
      // Hydrate ButlerEngine with the mock user profile first
      butlerEngine.hydrateFromStorage();
      assert.ok(butlerEngine.getState().accounts.length > 0, 'ButlerEngine should have hydrated mock account');

      const ok = await flushAllStorage();
      assert.equal(ok, true);
      assert.equal(lsMap.size, 0, 'ALL localStorage keys must be wiped');
      assert.equal(ssMap.size, 0, 'ALL sessionStorage keys must be wiped');
      assert.equal(factoryResetCalled, true, 'POST /api/system/factory-reset must be called');
      assert.equal(butlerEngine.getState().activeAccount, null, 'Butler activeAccount must be null');
      assert.equal(butlerEngine.getState().accounts.length, 0, 'Butler accounts must be empty');
      assert.equal(butlerEngine.getState().services.music.status, 'offline', 'Google Music service must be offline');
      assert.equal(butlerEngine.getState().services.drive.status, 'offline', 'Google Drive service must be offline');
    } finally {
      (globalThis as Record<string, unknown>).window = origWindow;
      (globalThis as Record<string, unknown>).localStorage = origLS;
      (globalThis as Record<string, unknown>).sessionStorage = origSS;
      globalThis.fetch = origFetch;
    }
  });
});
