/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Workspace Multi-Channel Messenger Tests
 * Verifies Google Chat Card V2 generation, Google Voice SMS formatting,
 * segment calculation, Gmail URL construction, and contact directory storage.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { googleWorkspaceMessenger } from '../src/services/googleWorkspaceMessenger';

describe('Google Workspace Multi-Channel Messenger', () => {
  beforeEach(() => {
    // Clear any test storage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  test('constructs valid Google Chat Cards V2 schema with project details', () => {
    const cardPayload = googleWorkspaceMessenger.buildGoogleChatCard({
      projectName: 'Nike Editorial Campaign',
      clientName: 'Wieden+Kennedy',
      heroCount: 18,
      totalAssetsCount: 240,
      driveUrl: 'https://drive.google.com/drive/folders/test123',
      assetName: 'hero_motion_shot.jpg',
      customNotes: 'Client review requested before 4 PM.',
    });

    assert.ok(cardPayload.cardsV2);
    assert.strictEqual(cardPayload.cardsV2.length, 1);

    const firstCard = cardPayload.cardsV2[0].card;
    assert.strictEqual(firstCard.header.title, 'Drive Therapy — Nike Editorial Campaign');
    assert.ok(firstCard.sections.length >= 2);

    // Verify widgets
    const statusSection = firstCard.sections[0];
    assert.ok(statusSection.widgets.some((w) => w.decoratedText?.text?.includes('Wieden+Kennedy')));
    assert.ok(statusSection.widgets.some((w) => w.decoratedText?.text?.includes('18 Hero Picks')));

    // Verify button link
    const lastSection = firstCard.sections[firstCard.sections.length - 1];
    const button = lastSection.widgets[0].buttonList.buttons[0];
    assert.strictEqual(button.text, 'Open Google Drive Gallery');
    assert.strictEqual(button.onClick.openLink.url, 'https://drive.google.com/drive/folders/test123');
  });

  test('formats rich markdown for Google Chat Spaces', () => {
    const md = googleWorkspaceMessenger.formatGoogleChatMarkdown({
      projectName: 'Coastal Lookbook',
      clientName: 'Studio Pacific',
      heroCount: 12,
      totalAssetsCount: 95,
      driveUrl: 'https://drive.google.com/file/123',
    });

    assert.ok(md.includes('📸 *Drive Therapy Production Delivery: Coastal Lookbook*'));
    assert.ok(md.includes('*Client:* Studio Pacific'));
    assert.ok(md.includes('*Status:* 12 Hero Picks approved'));
    assert.ok(md.includes('https://drive.google.com/file/123'));
  });

  test('formats Google Voice SMS across all 4 templates', () => {
    const payload = {
      projectName: 'Wedding Fall 2026',
      clientName: 'Sarah & David',
      heroCount: 45,
      driveUrl: 'https://drive.google.com/d/abc',
    };

    const galleryReady = googleWorkspaceMessenger.formatGoogleVoiceSms('gallery_ready', payload);
    assert.ok(galleryReady.includes('Hi Sarah & David!'));
    assert.ok(galleryReady.includes('45 approved hero picks'));
    assert.ok(galleryReady.includes('https://drive.google.com/d/abc'));
    assert.ok(galleryReady.includes('Sent via Drive Therapy'));

    const cullingDeadline = googleWorkspaceMessenger.formatGoogleVoiceSms('culling_deadline', payload);
    assert.ok(cullingDeadline.includes('please review and confirm your selections'));

    const invoiceBrief = googleWorkspaceMessenger.formatGoogleVoiceSms('invoice_brief', payload);
    assert.ok(invoiceBrief.includes('production files and deliverables'));

    const custom = googleWorkspaceMessenger.formatGoogleVoiceSms('custom', {
      ...payload,
      customNotes: 'Custom direct text message for client.',
    });
    assert.strictEqual(custom, 'Custom direct text message for client.');
  });

  test('calculates SMS characters and segment splits correctly', () => {
    const shortText = 'Hi Sarah! Your gallery is ready: https://drive.google.com';
    const shortMetrics = googleWorkspaceMessenger.calculateSmsSegments(shortText);
    assert.strictEqual(shortMetrics.segments, 1);
    assert.strictEqual(shortMetrics.chars, shortText.length);

    // Multi-segment text > 160 chars
    const longText = 'A'.repeat(200);
    const longMetrics = googleWorkspaceMessenger.calculateSmsSegments(longText);
    assert.strictEqual(longMetrics.segments, 2);
    assert.strictEqual(longMetrics.chars, 200);
  });

  test('validates US and international phone numbers', () => {
    assert.strictEqual(googleWorkspaceMessenger.validatePhoneNumber('(555) 123-4567'), true);
    assert.strictEqual(googleWorkspaceMessenger.validatePhoneNumber('+15551234567'), true);
    assert.strictEqual(googleWorkspaceMessenger.validatePhoneNumber('5551234567'), true);
    assert.strictEqual(googleWorkspaceMessenger.validatePhoneNumber('123'), false);
    assert.strictEqual(googleWorkspaceMessenger.validatePhoneNumber(''), false);
  });

  test('constructs valid Google Voice web and native sms: URIs', () => {
    const phone = '(555) 123-4567';
    const text = 'Gallery ready!';

    const webUrl = googleWorkspaceMessenger.buildGoogleVoiceWebUrl(phone, text);
    assert.ok(webUrl.includes('https://voice.google.com/u/0/messages?query=5551234567'));

    const smsUri = googleWorkspaceMessenger.buildSmsUri(phone, text);
    assert.strictEqual(smsUri, 'sms:5551234567?body=Gallery%20ready!');
  });

  test('constructs valid web Gmail composer URL', () => {
    const gmailUrl = googleWorkspaceMessenger.buildGmailComposeUrl({
      to: 'client@vogue.com',
      subject: 'Photo Delivery',
      body: 'Here are the proofs.',
    });

    assert.ok(gmailUrl.startsWith('https://mail.google.com/mail/?'));
    const parsed = new URL(gmailUrl);
    assert.strictEqual(parsed.searchParams.get('to'), 'client@vogue.com');
    assert.strictEqual(parsed.searchParams.get('su'), 'Photo Delivery');
    assert.strictEqual(parsed.searchParams.get('body'), 'Here are the proofs.');
  });
});
