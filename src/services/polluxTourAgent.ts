/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-100 / WO-102] Pollux — Interactive Tour & Walkthrough Guide Agent
 * Pairs Pollux's sliced transparent individual chibi sprites (with signature glasses & hazel eyes)
 * with Drive Therapy's App Tours & Codex Walkthroughs.
 */

export interface PolluxTourFrame {
  sheetUrl: string;
  label: string;
  tip: string;
}

export const POLLUX_CHIBI_SHEETS: readonly string[] = [
  '12_pollux_outfit_23_casual_tech.png',
  '01_pollux_outfits_01_02.png',
  '02_pollux_outfits_03_04.png',
  '03_pollux_outfits_05_06.png',
  '04_pollux_outfits_07_08.png',
  '05_pollux_outfits_09_10.png',
  '06_pollux_outfits_11_12.png',
  '07_pollux_outfits_13_14.png',
  '08_pollux_outfits_15_16.png',
  '09_pollux_outfits_17_18.png',
  '10_pollux_outfits_19_20.png',
  '11_pollux_outfits_21_22.png',
  '13_pollux_heavy_eva_combat_suit.png',
] as const;

const POLLUX_TOUR_EXPRESSIONS = [
  '02_Happy.png',
  '03_Confident.png',
  '06_Excited.png',
  '15_Curious.png',
  '01_Neutral.png',
  '07_Proud.png',
] as const;

export function getPolluxSheetUrl(fileName: string): string {
  return `/api/castor-pollux/pollux/${encodeURIComponent(fileName)}`;
}

export function getPolluxSpriteUrl(outfitId = 'P-01', expressionFile = '02_Happy.png'): string {
  return `/characters/pollux/${encodeURIComponent(outfitId)}/${encodeURIComponent(expressionFile)}?v=bust2`;
}

export function getPolluxPortraitUrl(): string {
  return '/characters/pollux/P-23/02_Happy.png?v=bust2';
}

export function getCastorPolluxSharedUrl(): string {
  return '/api/castor-pollux/shared/00_castor_pollux_base_armor.png';
}

export function getPolluxTourArtForStep(trackId: string, stepIndex: number): PolluxTourFrame {
  const outfitNum =
    trackId === 'google-ecosystem-guide'
      ? 3
      : trackId === 'tv-a11y-pro-guide'
      ? 24
      : stepIndex === 0
      ? 23
      : 1;
  const outfitId = `P-${String(outfitNum).padStart(2, '0')}`;
  const expr = POLLUX_TOUR_EXPRESSIONS[Math.max(0, stepIndex) % POLLUX_TOUR_EXPRESSIONS.length];
  return {
    sheetUrl: getPolluxSpriteUrl(outfitId, expr),
    label: `Pollux · ${outfitId} · ${expr.replace(/^\d+_|\.png$/g, '')}`,
    tip:
      trackId === 'tv-a11y-pro-guide'
        ? 'Pollux tip: Try AR Spatial or Transparent Liquid Glass mode in Settings → Display & Spatial!'
        : trackId === 'google-ecosystem-guide'
        ? 'Pollux tip: Every Google Drive, Photos, Takeout & Cloud Sync action stays 100% non-destructive.'
        : 'Pollux tip: Press Arrow keys to step through, or ⌘, anytime to open the AAA Settings Hub.',
  };
}
