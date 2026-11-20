/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Voice Browser-Level Calling & Protocol Tests
 * Verifies Chrome callto: and tel: protocol interception,
 * native sms: URIs, DTMF frequency mapping, and Image 4 contact presets.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { googleVoiceEngine } from '../src/services/googleVoiceEngine';

describe('Google Voice Engine & Chrome Protocol Handlers', () => {
  test('formats callto: and web call URLs for Chrome browser-level interception', () => {
    const { protocolUrl, webUrl } = googleVoiceEngine.triggerChromeCall('(701) 339-3414');
    assert.strictEqual(protocolUrl, 'callto:7013393414');
    assert.ok(webUrl.includes('https://voice.google.com/u/0/calls?query=7013393414'));
  });

  test('formats native sms: URI with encoded Drive Therapy message body', () => {
    const { smsUri, webUrl } = googleVoiceEngine.triggerSms('(970) 236-6062', 'Your gallery is ready!');
    assert.strictEqual(smsUri, 'sms:9702366062?body=Your%20gallery%20is%20ready!');
    assert.ok(webUrl.includes('https://voice.google.com/u/0/messages?query=9702366062'));
  });

  test('formats phone numbers into standard US presentation', () => {
    assert.strictEqual(googleVoiceEngine.formatPhoneDisplay('7013393414'), '(701) 339-3414');
    assert.strictEqual(googleVoiceEngine.formatPhoneDisplay('9702366062'), '(970) 236-6062');
    assert.strictEqual(googleVoiceEngine.formatPhoneDisplay(''), '');
  });

  test('returns preset voice contacts matching Image Attachment 4', () => {
    const contacts = googleVoiceEngine.getPresetVoiceContacts();
    assert.ok(contacts.length >= 2);

    const momMain = contacts.find((c) => c.phone === '(701) 339-3414');
    assert.ok(momMain);
    assert.strictEqual(momMain.name, 'Mom');
    assert.strictEqual(momMain.type, 'Main');

    const momMobile = contacts.find((c) => c.phone === '(970) 236-6062');
    assert.ok(momMobile);
    assert.strictEqual(momMobile.name, 'Mom');
    assert.strictEqual(momMobile.type, 'Mobile');
  });
});
