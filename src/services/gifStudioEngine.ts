/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GIF Studio Engine
 * Non-destructive animated GIF inspection, FPS/speed tuning, reverse/boomerang loops,
 * palette optimization, and Video-to-GIF FFmpeg argument generation.
 */

export interface GifEditRecipe {
  startTime: number;
  endTime: number;
  fps: 10 | 15 | 24 | 30;
  speed: 0.25 | 0.5 | 1 | 1.5 | 2 | 4;
  width: 0 | 720 | 480 | 360 | 240; // 0 = original width
  reverse: boolean;
  boomerang: boolean;
  colors: 64 | 128 | 256;
  loopCount: number; // 0 = infinite loop
}

export const DEFAULT_GIF_RECIPE: GifEditRecipe = {
  startTime: 0,
  endTime: 10,
  fps: 15,
  speed: 1,
  width: 480,
  reverse: false,
  boomerang: false,
  colors: 256,
  loopCount: 0,
};

/**
 * Estimate output GIF size in bytes based on resolution, FPS, duration, and color palette.
 */
export function estimateGifSizeBytes(
  recipe: GifEditRecipe,
  sourceWidth = 640,
  sourceHeight = 360
): number {
  const rawDuration = Math.max(0.2, recipe.endTime - recipe.startTime);
  const effectiveDuration = (rawDuration / recipe.speed) * (recipe.boomerang ? 2 : 1);
  const totalFrames = Math.max(1, Math.round(effectiveDuration * recipe.fps));
  const outW = recipe.width > 0 ? recipe.width : sourceWidth;
  const outH = Math.round((sourceHeight / Math.max(1, sourceWidth)) * outW);
  const bytesPerPixel = recipe.colors <= 64 ? 0.14 : recipe.colors <= 128 ? 0.19 : 0.24;
  return Math.round(totalFrames * outW * outH * bytesPerPixel);
}

/**
 * Build safe FFmpeg argument list using split + palettegen + paletteuse for crisp GIF output.
 */
export function generateGifFfmpegArgs(
  inputPath: string,
  outputPath: string,
  recipe: GifEditRecipe
): string[] {
  const duration = Math.max(0.2, recipe.endTime - recipe.startTime);
  const filters: string[] = [`fps=${recipe.fps}`];

  if (recipe.speed !== 1) {
    filters.push(`setpts=${(1 / recipe.speed).toFixed(4)}*PTS`);
  }
  if (recipe.width > 0) {
    filters.push(`scale=${recipe.width}:-1:flags=lanczos`);
  }
  if (recipe.reverse && !recipe.boomerang) {
    filters.push('reverse');
  }

  let filterComplex: string;
  if (recipe.boomerang) {
    filterComplex = `[0:v]${filters.join(',')},split[fwd][revsrc];[revsrc]reverse[rev];[fwd][rev]concat=n=2:v=1:a=0,split[s0][s1];[s0]palettegen=max_colors=${recipe.colors}:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`;
  } else {
    filterComplex = `[0:v]${filters.join(',')},split[s0][s1];[s0]palettegen=max_colors=${recipe.colors}:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`;
  }

  return [
    '-y',
    '-ss', recipe.startTime.toFixed(2),
    '-t', duration.toFixed(2),
    '-i', inputPath,
    '-filter_complex', filterComplex,
    '-loop', String(Math.max(0, recipe.loopCount)),
    outputPath,
  ];
}
