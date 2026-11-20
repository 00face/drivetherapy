import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { BUTLER_SERVICE_SCOPES } from '../src/services/butler/types';
import { butlerEngine } from '../src/services/butler/butlerEngine';
import { isValidSubAccount, sanitizeSubAccountList } from '../src/services/music/musicAccounts';
import { createButlerHostRouter } from '../src/services/butler/butlerHost';

describe('Butler Engine & Concierge Service Mesh', () => {
  beforeEach(() => {
    butlerEngine.hydrateFromStorage();
  });

  test('enforces strict OAuth scope isolation across Drive, Music and Workspace to prevent Error 400', () => {
    const driveScopes = BUTLER_SERVICE_SCOPES.drive;
    const musicScopes = BUTLER_SERVICE_SCOPES.music;
    const workspaceScopes = BUTLER_SERVICE_SCOPES.workspace;
    const geminiScopes = BUTLER_SERVICE_SCOPES.gemini;

    // Invariant 1: Drive requires drive.file and drive.readonly, but NEVER youtube.readonly
    assert.ok(driveScopes.includes('https://www.googleapis.com/auth/drive.file'));
    assert.ok(driveScopes.includes('https://www.googleapis.com/auth/drive.readonly'));
    assert.strictEqual(driveScopes.includes('https://www.googleapis.com/auth/youtube.readonly'), false);

    // Invariant 2: Music requires youtube.readonly, but NEVER drive.file
    assert.ok(musicScopes.includes('https://www.googleapis.com/auth/youtube.readonly'));
    assert.strictEqual(musicScopes.includes('https://www.googleapis.com/auth/drive.file'), false);

    // Invariant 3: Workspace contains calendar / chat, but NEVER drive.file or youtube.readonly
    assert.ok(workspaceScopes.includes('https://www.googleapis.com/auth/calendar.events'));
    assert.strictEqual(workspaceScopes.includes('https://www.googleapis.com/auth/drive.file'), false);
    assert.strictEqual(workspaceScopes.includes('https://www.googleapis.com/auth/youtube.readonly'), false);

    // Invariant 4: Gemini requires zero external scopes (BYOK / proxy)
    assert.strictEqual(geminiScopes.length, 0);
  });

  test('validates and sanitizes corrupt sub-account objects to eliminate undefined id crashes', () => {
    // Test isValidSubAccount directly
    assert.strictEqual(isValidSubAccount(null), false);
    assert.strictEqual(isValidSubAccount(undefined), false);
    assert.strictEqual(isValidSubAccount('string'), false);
    assert.strictEqual(isValidSubAccount(42), false);
    assert.strictEqual(isValidSubAccount({}), false);
    assert.strictEqual(isValidSubAccount({ id: null }), false);
    assert.strictEqual(isValidSubAccount({ id: 12345 }), false);
    assert.strictEqual(isValidSubAccount({ id: '' }), false);
    assert.strictEqual(isValidSubAccount({ id: 'valid_id' }), false); // missing email
    assert.strictEqual(isValidSubAccount({ id: 'valid_id', email: 'test@example.com' }), true);
    assert.strictEqual(isValidSubAccount({ id: 'valid_id', email: 'test@example.com', name: 'Valid User' }), true);

    // Test sanitizeSubAccountList directly
    const rawCorruptList = [
      null,
      undefined,
      { title: 'no id here' },
      { id: '' },
      { id: null },
      { id: 999 },
      { id: 'acc_no_email', name: 'Alpha' },
      { id: 'acc_ok_1', name: 'Alpha', email: 'alpha@example.com' },
      { id: 'acc_ok_2', name: 'Beta', email: 'beta@example.com' },
    ];

    const sanitized = sanitizeSubAccountList(rawCorruptList);
    assert.strictEqual(sanitized.length, 2);
    assert.strictEqual(sanitized[0].id, 'acc_ok_1');
    assert.strictEqual(sanitized[1].id, 'acc_ok_2');
  });

  test('butlerEngine maintains active state, telemetry and notifies listeners', () => {
    const state = butlerEngine.getState();
    assert.ok(state);
    assert.ok(state.services);
    assert.strictEqual(state.services.drive.id, 'drive');
    assert.strictEqual(state.services.workspace.id, 'workspace');
    assert.strictEqual(state.services.music.id, 'music');
    assert.strictEqual(state.services.gemini.id, 'gemini');

    assert.ok(state.accounts.length > 0);
    for (const acc of state.accounts) {
      assert.strictEqual(typeof acc.id, 'string');
      assert.ok(acc.id.length > 0);
    }

    // Subscribe listener
    let updates = 0;
    const unsubscribe = butlerEngine.subscribe((st) => {
      if (st) updates++;
    });

    assert.ok(updates >= 1);
    unsubscribe();
  });

  test('creates Butler Host Express Router with all required service endpoints', () => {
    const router = createButlerHostRouter({
      clientId: 'mock-client-id',
      clientSecret: 'mock-client-secret',
      redirectUri: 'http://localhost:3011/api/auth/google/callback',
    } as any);

    assert.ok(router);
    assert.strictEqual(typeof router, 'function');

    // Inspect registered routes on router stack
    const registeredPaths = router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => layer.route.path);

    assert.ok(registeredPaths.includes('/health'));
    assert.ok(registeredPaths.includes('/auth/config'));
    assert.ok(registeredPaths.includes('/auth/url'));
    assert.ok(registeredPaths.includes('/auth/session'));
    assert.ok(registeredPaths.includes('/drive/quota'));
    assert.ok(registeredPaths.includes('/drive/stream/:fileId'));
    assert.ok(registeredPaths.includes('/workspace/status'));
  });
});
