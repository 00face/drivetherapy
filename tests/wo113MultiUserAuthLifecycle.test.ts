/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-113] Multi-User Sign-In / Sign-Out / Re-Sign-In & Concurrent Multi-Account Isolation Tests
 * Covers:
 *  - Single-user Sign-In -> Sign-Out -> Re-Sign-In lifecycle
 *  - Concurrent User A + User B signed in simultaneously
 *  - Option 1 strict per-account catalog isolation (cloud assets scoped by ownerEmail, local shared)
 *  - Sign out User A while User B remains active and untouched
 *  - Sign out all accounts with zero residual PII or vault tokens
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';

import {
  clearAllGoogleAccountTokens,
  getActiveGoogleEmail,
  getGoogleAccountToken,
  getOrCreateSessionId,
  listGoogleAccountEmails,
  removeGoogleAccountToken,
  setActiveGoogleAccount,
  setGoogleAccountToken,
} from '../server/security/sessionVault';
import {
  clearAllAccountProfiles,
  filterAssetsForActiveAccount,
  getActiveAccountProfile,
  loadAccountProfiles,
  removeAccountProfileByEmail,
  saveAccountProfile,
} from '../src/services/multiAccountAuth';
import { butlerEngine } from '../src/services/butler/butlerEngine';

function mockReqRes() {
  const req = { headers: {}, secure: false } as unknown as Request;
  const res = { append() {} } as unknown as Response;
  return { req, res };
}

describe('[WO-113] Multi-User Sign-In / Sign-Out / Re-Sign-In & Concurrent Isolation', () => {
  it('supports User A sign-in -> sign-out -> re-sign-in cleanly on server vault and client profiles', () => {
    clearAllAccountProfiles();
    const { req, res } = mockReqRes();
    const sid = getOrCreateSessionId(req, res);

    // 1. User A signs in
    setGoogleAccountToken(sid, 'alice@studio.dev', { accessToken: 'tok_a1' });
    saveAccountProfile({
      email: 'alice@studio.dev',
      name: 'Alice',
      tokenRecord: { accessToken: 'tok_a1', expiresAt: Date.now() + 3600_000, scopes: ['drive'] },
    });
    assert.equal(getActiveGoogleEmail(sid), 'alice@studio.dev');
    assert.equal(getActiveAccountProfile()?.email, 'alice@studio.dev');

    // 2. User A signs out
    removeGoogleAccountToken(sid, 'alice@studio.dev');
    const afterOut = removeAccountProfileByEmail('alice@studio.dev');
    assert.equal(afterOut.remaining.length, 0);
    assert.equal(afterOut.nextActive, null);
    assert.equal(getActiveGoogleEmail(sid), null);
    assert.equal(getGoogleAccountToken(sid, 'alice@studio.dev'), null);

    // 3. User A signs back in with fresh token
    setGoogleAccountToken(sid, 'alice@studio.dev', { accessToken: 'tok_a2' });
    saveAccountProfile({
      email: 'alice@studio.dev',
      name: 'Alice',
      tokenRecord: { accessToken: 'tok_a2', expiresAt: Date.now() + 3600_000, scopes: ['drive'] },
    });
    assert.equal(getActiveGoogleEmail(sid), 'alice@studio.dev');
    assert.equal(getGoogleAccountToken(sid, 'alice@studio.dev')?.accessToken, 'tok_a2');
    assert.equal(getActiveAccountProfile()?.email, 'alice@studio.dev');
    clearAllAccountProfiles();
  });

  it('supports concurrent User A + User B signed in, switching, single sign-out, and sign-out all', async () => {
    clearAllAccountProfiles();
    const { req, res } = mockReqRes();
    const sid = getOrCreateSessionId(req, res);

    // Sign in User A and User B concurrently
    setGoogleAccountToken(sid, 'alice@studio.dev', { accessToken: 'tok_alice' });
    setGoogleAccountToken(sid, 'bob@studio.dev', { accessToken: 'tok_bob' });
    saveAccountProfile({
      email: 'alice@studio.dev',
      name: 'Alice',
      tokenRecord: { accessToken: 'tok_alice', expiresAt: Date.now() + 3600_000, scopes: ['drive'] },
    });
    saveAccountProfile({
      email: 'bob@studio.dev',
      name: 'Bob',
      tokenRecord: { accessToken: 'tok_bob', expiresAt: Date.now() + 3600_000, scopes: ['drive'] },
    });

    assert.deepEqual(listGoogleAccountEmails(sid).sort(), ['alice@studio.dev', 'bob@studio.dev']);
    assert.equal(loadAccountProfiles().length, 2);
    assert.equal(getActiveAccountProfile()?.email, 'bob@studio.dev');

    // Switch active account back to User A
    assert.equal(setActiveGoogleAccount(sid, 'alice@studio.dev'), true);
    assert.equal(getActiveGoogleEmail(sid), 'alice@studio.dev');
    await butlerEngine.switchAccountByEmail('alice@studio.dev');
    assert.equal(getActiveAccountProfile()?.email, 'alice@studio.dev');

    // Sign out User A ONLY -> User B automatically becomes active and stays signed in
    removeGoogleAccountToken(sid, 'alice@studio.dev');
    const nextEmail = await butlerEngine.signOutAccount('alice@studio.dev');
    assert.equal(nextEmail, 'bob@studio.dev');
    assert.equal(getActiveGoogleEmail(sid), 'bob@studio.dev');
    assert.equal(getGoogleAccountToken(sid, 'alice@studio.dev'), null);
    assert.equal(getGoogleAccountToken(sid, 'bob@studio.dev')?.accessToken, 'tok_bob');

    // Sign out ALL accounts -> zero residual state
    const cleared = clearAllGoogleAccountTokens(sid);
    assert.equal(cleared, 1);
    await butlerEngine.signOutAllAccounts();
    assert.equal(listGoogleAccountEmails(sid).length, 0);
    assert.equal(loadAccountProfiles().length, 0);
    assert.equal(butlerEngine.getState().activeAccount, null);
  });

  it('[Option 1] strictly isolates cloud/photos assets per active email while keeping local assets shared', () => {
    const mixed = [
      { id: '1', source: 'cloud', ownerEmail: 'alice@studio.dev' },
      { id: '2', source: 'photos', ownerEmail: 'bob@studio.dev' },
      { id: '3', source: 'local' },
    ];
    assert.deepEqual(
      filterAssetsForActiveAccount(mixed, 'alice@studio.dev').map((a) => a.id),
      ['1', '3']
    );
    assert.deepEqual(
      filterAssetsForActiveAccount(mixed, 'bob@studio.dev').map((a) => a.id),
      ['2', '3']
    );
    assert.deepEqual(
      filterAssetsForActiveAccount(mixed, null).map((a) => a.id),
      ['3']
    );
  });
});
