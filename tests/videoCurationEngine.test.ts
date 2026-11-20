/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Video Curation & Trimming Engine Unit Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTimecode,
  parseTimecode,
  computeScrubTime,
  generateKeyframeSlices,
  validateTrimRange,
  generateLosslessFfmpegCommand,
} from '../src/services/videoCurationEngine';

describe('Professional Video Curation & Trimming Suite', () => {
  it('formats raw seconds into SMPTE timecode (MM:SS.ms)', () => {
    assert.equal(formatTimecode(0), '00:00.00');
    assert.equal(formatTimecode(65.4), '01:05.40');
    assert.equal(formatTimecode(3600), '60:00.00');
  });

  it('parses timecodes back to numeric seconds', () => {
    assert.equal(parseTimecode('01:05.40'), 65.4);
    assert.equal(parseTimecode('00:30'), 30);
  });

  it('computes relative scrub position accurately', () => {
    const duration = 120; // 2 minutes
    assert.equal(computeScrubTime(0.0, duration), 0);
    assert.equal(computeScrubTime(0.5, duration), 60);
    assert.equal(computeScrubTime(1.0, duration), 120);
    // Clamping checks
    assert.equal(computeScrubTime(-0.2, duration), 0);
    assert.equal(computeScrubTime(1.5, duration), 120);
  });

  it('generates uniform keyframe slices across timeline', () => {
    const slices = generateKeyframeSlices(60, 6);
    assert.equal(slices.length, 6);
    assert.equal(slices[0].timeOffset, 0);
    assert.equal(slices[1].timeOffset, 10);
    assert.equal(slices[2].timeOffset, 20);
  });

  it('validates trim boundary constraints and minimum clip length', () => {
    // Valid 5s clip in 30s video
    const valid = validateTrimRange(5, 10, 30);
    assert.equal(valid.valid, true);
    assert.equal(valid.clipDuration, 5);

    // Invalid: end <= start
    const invalidInvert = validateTrimRange(15, 10, 30);
    assert.equal(invalidInvert.valid, false);
    assert.ok(invalidInvert.error?.includes('greater'));

    // Invalid: end > duration
    const invalidOverflow = validateTrimRange(5, 35, 30);
    assert.equal(invalidOverflow.valid, false);
    assert.ok(invalidOverflow.error?.includes('exceed'));
  });

  it('generates lossless stream copy FFmpeg CLI string', () => {
    const cmd = generateLosslessFfmpegCommand('/videos/raw.mp4', '/videos/trimmed.mp4', 10.5, 25.0);
    assert.ok(cmd.startsWith('ffmpeg -ss 10.50'));
    assert.ok(cmd.includes('-c copy'));
    assert.ok(cmd.includes('"/videos/trimmed.mp4"'));
  });
});
