/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Professional Video Curation & Trimming Engine (A+ Tier)
 * Hover filmstrip scrubbing math, timeline keyframe sampling,
 * lossless in/out boundary validation, and FFmpeg command generation.
 */

export interface VideoTrimRange {
  startTime: number; // in seconds
  endTime: number;   // in seconds
  duration: number;  // total video duration in seconds
}

export interface VideoKeyframeSlice {
  index: number;
  timeOffset: number; // in seconds
  percentage: number; // 0..100
  thumbnailUrl?: string;
}

/**
 * Format raw seconds into standard SMPTE timecode (HH:MM:SS.ms)
 */
export function formatTimecode(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';

  const mins = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  const wholeSecs = Math.floor(remainingSecs);
  const millis = Math.round((remainingSecs - wholeSecs) * 100);

  const mm = mins.toString().padStart(2, '0');
  const ss = wholeSecs.toString().padStart(2, '0');
  const ms = millis.toString().padStart(2, '0');

  return `${mm}:${ss}.${ms}`;
}

/**
 * Parse standard timecode string (MM:SS or MM:SS.ms) back into numeric seconds
 */
export function parseTimecode(tc: string): number {
  if (!tc) return 0;
  const parts = tc.trim().split(':');
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return mins * 60 + secs;
  }
  return parseFloat(tc) || 0;
}

/**
 * Compute video playback offset from cursor relative X position (0.0 to 1.0)
 */
export function computeScrubTime(relativeX: number, duration: number): number {
  if (duration <= 0) return 0;
  const clampedX = Math.max(0, Math.min(1.0, relativeX));
  return Math.round(clampedX * duration * 100) / 100;
}

/**
 * Generate uniform keyframe sample slice points across a video duration
 */
export function generateKeyframeSlices(duration: number, sliceCount = 8): VideoKeyframeSlice[] {
  const slices: VideoKeyframeSlice[] = [];
  if (duration <= 0 || sliceCount <= 0) return slices;

  const interval = duration / sliceCount;
  for (let i = 0; i < sliceCount; i++) {
    const timeOffset = Math.round(i * interval * 100) / 100;
    const percentage = Math.round((timeOffset / duration) * 100);
    slices.push({
      index: i,
      timeOffset,
      percentage,
    });
  }

  return slices;
}

/**
 * Validate video trimming boundaries
 */
export function validateTrimRange(
  startTime: number,
  endTime: number,
  totalDuration: number
): { valid: boolean; clipDuration: number; error?: string } {
  if (startTime < 0) {
    return { valid: false, clipDuration: 0, error: 'Start time cannot be negative' };
  }
  if (endTime > totalDuration + 0.1) {
    return { valid: false, clipDuration: 0, error: 'End time cannot exceed total duration' };
  }
  if (endTime <= startTime) {
    return { valid: false, clipDuration: 0, error: 'End time must be greater than start time' };
  }

  const clipDuration = Math.round((endTime - startTime) * 100) / 100;
  if (clipDuration < 0.2) {
    return { valid: false, clipDuration, error: 'Clip duration must be at least 0.2 seconds' };
  }

  return { valid: true, clipDuration };
}

/**
 * Generate native lossless FFmpeg copy command (stream copy without re-encoding)
 */
export function generateLosslessFfmpegCommand(
  inputPath: string,
  outputPath: string,
  startTime: number,
  endTime: number
): string {
  const duration = Math.max(0.1, endTime - startTime);
  const ss = startTime.toFixed(2);
  const t = duration.toFixed(2);
  return `ffmpeg -ss ${ss} -i "${inputPath}" -t ${t} -c copy "${outputPath}"`;
}

export type VideoCropAspect = 'free' | '16:9' | '9:16' | '1:1' | '4:5';

export interface VideoEditRecipe {
  startTime: number;
  endTime: number;
  rotation: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  cropAspect: VideoCropAspect;
  speed: 0.5 | 1 | 1.25 | 1.5 | 2;
  muteAudio: boolean;
  extractAudioOnly?: boolean;
}

/**
 * Build safe, argument-array FFmpeg parameters (zero shell interpolation) for
 * non-destructive video editing. Uses stream-copy when only trimming, or a
 * clean filter graph when rotation/flip/crop/speed/audio operations are requested.
 */
export function generateVideoEditFfmpegArgs(
  inputPath: string,
  outputPath: string,
  recipe: VideoEditRecipe
): { args: string[]; isLosslessCopy: boolean } {
  const duration = Math.max(0.2, recipe.endTime - recipe.startTime);

  if (recipe.extractAudioOnly) {
    return {
      isLosslessCopy: false,
      args: [
        '-y',
        '-ss', recipe.startTime.toFixed(2),
        '-i', inputPath,
        '-t', duration.toFixed(2),
        '-vn',
        '-c:a', 'libmp3lame',
        '-q:a', '2',
        outputPath,
      ],
    };
  }

  const hasVisualTransform =
    recipe.rotation !== 0 ||
    recipe.flipH ||
    recipe.flipV ||
    recipe.cropAspect !== 'free' ||
    recipe.speed !== 1;

  if (!hasVisualTransform && !recipe.muteAudio) {
    return {
      isLosslessCopy: true,
      args: [
        '-y',
        '-ss', recipe.startTime.toFixed(2),
        '-i', inputPath,
        '-t', duration.toFixed(2),
        '-c', 'copy',
        '-movflags', '+faststart',
        outputPath,
      ],
    };
  }

  const vFilters: string[] = [];
  if (recipe.rotation === 90) vFilters.push('transpose=1');
  else if (recipe.rotation === 180) vFilters.push('transpose=1,transpose=1');
  else if (recipe.rotation === 270) vFilters.push('transpose=2');

  if (recipe.flipH) vFilters.push('hflip');
  if (recipe.flipV) vFilters.push('vflip');

  if (recipe.cropAspect === '16:9') {
    vFilters.push("crop='min(iw,ih*16/9)':'min(ih,iw*9/16)'");
  } else if (recipe.cropAspect === '9:16') {
    vFilters.push("crop='min(iw,ih*9/16)':'min(ih,iw*16/9)'");
  } else if (recipe.cropAspect === '1:1') {
    vFilters.push("crop='min(iw,ih)':'min(iw,ih)'");
  } else if (recipe.cropAspect === '4:5') {
    vFilters.push("crop='min(iw,ih*4/5)':'min(ih,iw*5/4)'");
  }

  if (recipe.speed !== 1) {
    vFilters.push(`setpts=${(1 / recipe.speed).toFixed(4)}*PTS`);
  }

  const args: string[] = [
    '-y',
    '-ss', recipe.startTime.toFixed(2),
    '-i', inputPath,
    '-t', duration.toFixed(2),
  ];

  if (vFilters.length > 0) {
    args.push('-vf', vFilters.join(','));
  }

  if (recipe.muteAudio) {
    args.push('-an');
  } else if (recipe.speed !== 1) {
    args.push('-af', `atempo=${recipe.speed}`);
  }

  if (vFilters.length > 0) {
    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p');
  } else {
    args.push('-c:v', 'copy');
  }

  if (!recipe.muteAudio && recipe.speed !== 1) {
    args.push('-c:a', 'aac', '-b:a', '192k');
  } else if (!recipe.muteAudio) {
    args.push('-c:a', 'copy');
  }

  args.push('-movflags', '+faststart', outputPath);
  return { args, isLosslessCopy: false };
}
