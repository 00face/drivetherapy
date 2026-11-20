/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Professional Lossless Video Trimmer & Curation Suite
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTimecode,
  parseTimecode,
  computeScrubTime,
  generateKeyframeSlices,
  validateTrimRange,
  generateLosslessFfmpegCommand,
} from '../src/services/videoCurationEngine';

describe('Professional Lossless Video Trimmer Suite', () => {
  test('formats seconds into accurate SMPTE timecode (MM:SS.ms)', () => {
    assert.strictEqual(formatTimecode(0), '00:00.00');
    assert.strictEqual(formatTimecode(9.45), '00:09.45');
    assert.strictEqual(formatTimecode(65.12), '01:05.12');
    assert.strictEqual(formatTimecode(3661.05), '61:01.05');
  });

  test('parses SMPTE timecode back into accurate seconds', () => {
    assert.strictEqual(parseTimecode('00:00.00'), 0);
    assert.strictEqual(parseTimecode('01:05.12'), 65.12);
    assert.strictEqual(parseTimecode('00:30'), 30);
  });

  test('computes video scrub position from cursor relative X coordinates', () => {
    const duration = 120; // 2 minutes
    assert.strictEqual(computeScrubTime(0.0, duration), 0);
    assert.strictEqual(computeScrubTime(0.5, duration), 60);
    assert.strictEqual(computeScrubTime(1.0, duration), 120);
    // Boundary clamps
    assert.strictEqual(computeScrubTime(-0.2, duration), 0);
    assert.strictEqual(computeScrubTime(1.5, duration), 120);
  });

  test('generates uniform keyframe slices across video duration', () => {
    const slices = generateKeyframeSlices(60, 6);
    assert.strictEqual(slices.length, 6);
    assert.strictEqual(slices[0].timeOffset, 0);
    assert.strictEqual(slices[1].timeOffset, 10);
    assert.strictEqual(slices[5].timeOffset, 50);
  });

  test('validates trim boundary constraints and minimum clip lengths', () => {
    const total = 45.0;

    // Valid range
    const valid = validateTrimRange(5.0, 15.5, total);
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.clipDuration, 10.5);

    // Negative start
    const neg = validateTrimRange(-1.0, 10.0, total);
    assert.strictEqual(neg.valid, false);

    // End before start
    const inverted = validateTrimRange(20.0, 10.0, total);
    assert.strictEqual(inverted.valid, false);

    // Clip too short (<0.2s)
    const tooShort = validateTrimRange(10.0, 10.1, total);
    assert.strictEqual(tooShort.valid, false);

    // End exceeds total duration
    const outOfBounds = validateTrimRange(10.0, 50.0, total);
    assert.strictEqual(outOfBounds.valid, false);
  });

  test('generates standard lossless copy FFmpeg CLI string without re-encoding', () => {
    const input = '/home/user/Videos/B-Roll_4K.mp4';
    const output = '/home/user/Videos/B-Roll_4K_trimmed.mp4';
    const cmd = generateLosslessFfmpegCommand(input, output, 12.5, 27.8);

    assert.ok(cmd.includes('ffmpeg'));
    assert.ok(cmd.includes('-ss 12.50'));
    assert.ok(cmd.includes('-i "/home/user/Videos/B-Roll_4K.mp4"'));
    assert.ok(cmd.includes('-t 15.30'));
    assert.ok(cmd.includes('-c copy'));
    assert.ok(cmd.includes('"/home/user/Videos/B-Roll_4K_trimmed.mp4"'));
  });
});
