/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Multi-Account Google Drive Profile Switcher Unit Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveAccountProfile,
  switchActiveAccount,
  removeAccountProfile,
  getActiveAccountProfile,
  loadAccountProfiles,
} from '../src/services/multiAccountAuth';

describe('Multi-Account Google Drive Profile Switcher Suite', () => {
  it('registers and stores multiple distinct Google account profiles', () => {
    const acc1 = saveAccountProfile({
      id: 'acc_personal',
      email: 'alex.photo@gmail.com',
      name: 'Alex Personal',
      tokenRecord: {
        accessToken: 'ya29.mock_personal_token',
        expiresAt: Date.now() + 3600000,
      },
    });

    const acc2 = saveAccountProfile({
      id: 'acc_studio',
      email: 'studio@weddingagency.com',
      name: 'Agency Studio',
      tokenRecord: {
        accessToken: 'ya29.mock_agency_token',
        expiresAt: Date.now() + 3600000,
      },
    });

    assert.equal(acc1.email, 'alex.photo@gmail.com');
    assert.equal(acc2.email, 'studio@weddingagency.com');

    const all = loadAccountProfiles();
    assert.ok(all.length >= 2);
  });

  it('switches active account profile seamlessly', () => {
    const switched = switchActiveAccount('acc_studio');
    assert.ok(switched);
    assert.equal(switched?.id, 'acc_studio');
    assert.equal(switched?.isActive, true);

    const active = getActiveAccountProfile();
    assert.equal(active?.id, 'acc_studio');
    assert.equal(active?.email, 'studio@weddingagency.com');
  });

  it('removes account profile and re-assigns active status gracefully', () => {
    const remaining = removeAccountProfile('acc_studio');
    assert.ok(remaining.every((p) => p.id !== 'acc_studio'));

    const active = getActiveAccountProfile();
    assert.ok(active);
    assert.equal(active?.id, 'acc_personal');
  });

  it('keeps distinct Brand Sub-Accounts under one email and activates newly signed-in accounts', () => {
    saveAccountProfile(
      {
        id: 'yt_ch_primary',
        email: 'creator@example.com',
        name: 'Creator Main',
        tokenRecord: { accessToken: 'tok_main', expiresAt: Date.now() + 3600000 },
      },
      { setActive: true }
    );
    saveAccountProfile(
      {
        id: 'yt_ch_brand',
        email: 'creator@example.com',
        name: 'Creator Brand Channel',
        tokenRecord: { accessToken: 'tok_brand', expiresAt: Date.now() + 3600000 },
      },
      { setActive: true }
    );

    const all = loadAccountProfiles().filter((p) => p.email === 'creator@example.com');
    assert.equal(all.length, 2);
    assert.equal(getActiveAccountProfile()?.id, 'yt_ch_brand');
  });
});
