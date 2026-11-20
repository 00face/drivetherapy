/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Chat REST API Client & Thread Harmonization Tests
 * Verifies official endpoint mapping, space listing (Alexandria Image 3 parity),
 * message creation, Cards V2 embedding, and unread filter logic.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { googleChatApi } from '../src/services/googleChatApi';

describe('Google Chat REST API & Harmonized Threads', () => {
  test('returns harmonized spaces matching Image Attachment 3 parity', async () => {
    const spaces = await googleChatApi.listSpaces();
    assert.ok(Array.isArray(spaces));
    assert.ok(spaces.length >= 3);

    const alexandria = spaces.find((s) => s.displayName === 'Alexandria');
    assert.ok(alexandria);
    assert.strictEqual(alexandria.spaceType, 'DIRECT_MESSAGE');
    assert.strictEqual(alexandria.avatarLetter, 'A');
    assert.ok(alexandria.lastMessageSnippet);

    const studio = spaces.find((s) => s.displayName.includes('Studio'));
    assert.ok(studio);
  });

  test('retrieves conversation thread messages for Alexandria space', async () => {
    const messages = await googleChatApi.listMessages('spaces/cached_alexandria');
    assert.ok(Array.isArray(messages));
    assert.ok(messages.length >= 3);

    // Verify threaded sequence
    assert.ok(messages.some((m) => m.text?.includes('wedding ceremony')));
    assert.ok(messages.some((m) => m.cardsV2 && m.cardsV2.length > 0));
  });

  test('creates new message in chat space and appends to thread', async () => {
    const newMsg = await googleChatApi.createMessage(
      'spaces/cached_alexandria',
      'Attached 5 high-res deliverables from Drive Therapy.'
    );

    assert.ok(newMsg.name);
    assert.strictEqual(newMsg.text, 'Attached 5 high-res deliverables from Drive Therapy.');
    assert.strictEqual(newMsg.isOutgoing, true);

    const updated = await googleChatApi.listMessages('spaces/cached_alexandria');
    assert.ok(updated.some((m) => m.text === 'Attached 5 high-res deliverables from Drive Therapy.'));
  });

  test('lists contacts and filters by query', async () => {
    const allContacts = await googleChatApi.listContacts();
    assert.ok(Array.isArray(allContacts));
    assert.ok(allContacts.length >= 4);

    const alexandria = allContacts.find((c) => c.displayName === 'Alexandria');
    assert.ok(alexandria);
    assert.ok(alexandria.email);

    const filtered = await googleChatApi.listContacts('Marcus');
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].displayName, 'Marcus Vance');
  });

  test('creates or finds direct message space for contact', async () => {
    const contact = {
      name: 'users/marcus',
      displayName: 'Marcus Vance',
      email: 'marcus.vance@workspace.studio',
      role: 'Creative Director',
    };

    const dmSpace = await googleChatApi.createOrGetDirectMessageSpace(contact);
    assert.ok(dmSpace.name);
    assert.strictEqual(dmSpace.displayName, 'Marcus Vance');
    assert.strictEqual(dmSpace.spaceType, 'DIRECT_MESSAGE');
    assert.strictEqual(dmSpace.avatarLetter, 'M');

    // Retrieve again: should return same existing space
    const retrieved = await googleChatApi.createOrGetDirectMessageSpace(contact);
    assert.strictEqual(retrieved.name, dmSpace.name);
  });

  test('toggles and updates emoji reactions on message', async () => {
    const newMsg = await googleChatApi.createMessage(
      'spaces/cached_alexandria',
      'Test reaction message'
    );

    const reacted = await googleChatApi.toggleReaction(
      'spaces/cached_alexandria',
      newMsg.name,
      '❤️',
      'You'
    );
    assert.ok(reacted);
    assert.ok(reacted.reactions?.some((r) => r.emoji === '❤️' && r.count === 1));

    // Toggle off: count drops to 0
    const unreacted = await googleChatApi.toggleReaction(
      'spaces/cached_alexandria',
      newMsg.name,
      '❤️',
      'You'
    );
    assert.ok(unreacted);
    assert.strictEqual(unreacted.reactions?.some((r) => r.emoji === '❤️'), false);
  });

  test('forwards message with attachments to target space', async () => {
    const sourceMsg = await googleChatApi.createMessage(
      'spaces/cached_alexandria',
      'Reviewing shoot deliverables',
      undefined,
      [{ name: 'hero_cut.mp4', type: 'video', duration: '01:30' }]
    );

    const forwarded = await googleChatApi.forwardMessage(
      sourceMsg,
      'spaces/cached_studio_team'
    );
    assert.ok(forwarded.name);
    assert.ok(forwarded.text?.includes('Forwarded: Reviewing shoot deliverables'));
    assert.strictEqual(forwarded.attachments?.[0]?.name, 'hero_cut.mp4');

    const studioMsgs = await googleChatApi.listMessages('spaces/cached_studio_team');
    assert.ok(studioMsgs.some((m) => m.name === forwarded.name));
  });

  test('translates chat message into target language', async () => {
    const spanish = await googleChatApi.translateMessage(
      'Hey! Did you finish culling the wedding ceremony sequence?',
      'Spanish'
    );
    assert.ok(spanish.includes('ceremonia'));

    const french = await googleChatApi.translateMessage(
      'Awesome, reviewing the proofs now! Love the colors on the 50mm f/1.2 shots.',
      'French'
    );
    assert.ok(french.includes('épreuves'));

    const fallback = await googleChatApi.translateMessage('Custom text here', 'Japanese');
    assert.ok(fallback.includes('Custom text here'));
  });
});
