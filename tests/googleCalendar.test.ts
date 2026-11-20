/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Calendar Integration Tests
 * Verifies URL template formatting, UTC date parsing,
 * and shoot milestone preset generation.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { googleCalendarEngine } from '../src/services/googleCalendarEngine';

describe('Google Calendar Integration Engine', () => {
  test('formats timed event date to UTC ISO compact string (YYYYMMDDTHHmmssZ)', () => {
    // 2026-11-10 14:30:00 UTC
    const date = new Date(Date.UTC(2026, 10, 10, 14, 30, 0));
    const formatted = googleCalendarEngine.formatGoogleCalendarDate(date, false);
    assert.strictEqual(formatted, '20261110T143000Z');
  });

  test('formats all-day event date to YYYYMMDD', () => {
    const date = new Date(Date.UTC(2026, 10, 10));
    const formatted = googleCalendarEngine.formatGoogleCalendarDate(date, true);
    assert.strictEqual(formatted, '20261110');
  });

  test('constructs valid Google Calendar event template URL with all parameters', () => {
    const start = new Date(Date.UTC(2026, 10, 15, 18, 0, 0));
    const end = new Date(Date.UTC(2026, 10, 15, 19, 0, 0));

    const url = googleCalendarEngine.generateGoogleCalendarUrl({
      title: 'Commercial Shoot Review',
      startDate: start,
      endDate: end,
      location: 'Google Meet',
      description: 'Reviewing 24 hero picks in Drive Therapy',
    });

    assert.ok(url.startsWith('https://calendar.google.com/calendar/render?'));
    const parsed = new URL(url);
    assert.strictEqual(parsed.searchParams.get('action'), 'TEMPLATE');
    assert.strictEqual(parsed.searchParams.get('text'), 'Commercial Shoot Review');
    assert.strictEqual(parsed.searchParams.get('dates'), '20261115T180000Z/20261115T190000Z');
    assert.strictEqual(parsed.searchParams.get('location'), 'Google Meet');
    assert.ok(parsed.searchParams.get('details')?.includes('Reviewing 24 hero picks'));
  });

  test('generates shoot milestone presets with project name and hero counts', () => {
    const presets = googleCalendarEngine.getShootMilestonePresets('Autumn Lookbook 2026', 15);
    assert.strictEqual(presets.length, 3);

    const reviewPreset = presets.find((p) => p.id === 'review_call');
    assert.ok(reviewPreset);
    assert.ok(reviewPreset.name.includes('Autumn Lookbook 2026'));
    assert.ok(reviewPreset.descriptionTemplate.includes('15 approved hero selections'));

    const deadlinePreset = presets.find((p) => p.id === 'culling_deadline');
    assert.ok(deadlinePreset);
    assert.ok(deadlinePreset.name.includes('Culling Approval'));
  });
});
