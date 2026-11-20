/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Adaptive Display, Small Screen, Mobile, Tablet, Large-Format, 10-Foot TV,
 * AR Spatial & Transparent OLED / Liquid Glass Profile Engine
 */

export type DisplayTier =
  | 'small-screen'
  | 'mobile-phone'
  | 'tablet'
  | 'compact-touch'
  | 'desktop'
  | 'large-format'
  | 'tv-tenfoot'
  | 'ar-spatial'
  | 'transparent-oled';

export type InputMode = 'touch' | 'pointer' | 'dpad' | 'gaze-pinch';
export type UaEngine = 'webkit-safari' | 'gecko-firefox' | 'chromium-pwa' | 'smart-tv' | 'xr-spatial' | 'chromium';

export interface AdaptiveDisplayProfile {
  displayTier: DisplayTier;
  inputMode: InputMode;
  uaEngine: UaEngine;
  isOverride: boolean;
}

export const DISPLAY_TIER_CYCLE_ORDER: readonly Array<DisplayTier | 'auto'>[number][] = [
  'auto',
  'small-screen',
  'mobile-phone',
  'tablet',
  'desktop',
  'large-format',
  'tv-tenfoot',
  'ar-spatial',
  'transparent-oled',
] as const;

export const VALID_DISPLAY_TIERS = new Set<DisplayTier>([
  'small-screen',
  'mobile-phone',
  'tablet',
  'compact-touch',
  'desktop',
  'large-format',
  'tv-tenfoot',
  'ar-spatial',
  'transparent-oled',
]);

export function getDisplayTierLabel(tier: DisplayTier | 'auto'): string {
  switch (tier) {
    case 'small-screen':
      return 'Small Screen';
    case 'mobile-phone':
      return 'Mobile Phone';
    case 'tablet':
      return 'Tablet';
    case 'compact-touch':
      return 'Compact Touch';
    case 'desktop':
      return 'Desktop';
    case 'large-format':
      return 'Large Format';
    case 'tv-tenfoot':
      return 'TV (10-ft)';
    case 'ar-spatial':
      return 'AR Spatial';
    case 'transparent-oled':
      return 'Transparent Glass';
    default:
      return 'Auto';
  }
}

const OVERRIDE_KEY = 'dt_display_profile_override_v1';

export function detectUaEngine(userAgent: string, isStandalone = false): UaEngine {
  const ua = (userAgent || '').toLowerCase();
  if (/(visionos|oculus|quest|pico|hololens|magicleap|xreal|webxr|android xr)/.test(ua)) {
    return 'xr-spatial';
  }
  if (/(tizen|web0s|webos|bravia|smarttv|smart-tv|appletv|aft|crkey|xbox|playstation|googletv|android tv)/.test(ua)) {
    return 'smart-tv';
  }
  if (/firefox\//.test(ua)) {
    return 'gecko-firefox';
  }
  if (/safari\//.test(ua) && !/(chrome|chromium|crios|edg|opr)/.test(ua)) {
    return 'webkit-safari';
  }
  if (isStandalone) {
    return 'chromium-pwa';
  }
  return 'chromium';
}

export function detectDisplayProfile(params?: {
  width?: number;
  coarsePointer?: boolean;
  userAgent?: string;
  isStandalone?: boolean;
  overrideTier?: DisplayTier | 'auto' | null;
}): AdaptiveDisplayProfile {
  const width =
    params?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const coarsePointer =
    params?.coarsePointer ??
    (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false);
  const ua =
    params?.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const isStandalone =
    params?.isStandalone ??
    (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false);

  const uaEngine = detectUaEngine(ua, isStandalone);
  const override = params?.overrideTier;

  if (override && override !== 'auto') {
    const inputMode: InputMode =
      override === 'tv-tenfoot'
        ? 'dpad'
        : override === 'ar-spatial'
        ? 'gaze-pinch'
        : override === 'small-screen' ||
          override === 'mobile-phone' ||
          override === 'tablet' ||
          override === 'compact-touch'
        ? 'touch'
        : 'pointer';
    return {
      displayTier: override,
      inputMode,
      uaEngine,
      isOverride: true,
    };
  }

  let displayTier: DisplayTier = 'desktop';
  let inputMode: InputMode = coarsePointer ? 'touch' : 'pointer';

  if (uaEngine === 'xr-spatial') {
    displayTier = 'ar-spatial';
    inputMode = 'gaze-pinch';
  } else if (uaEngine === 'smart-tv') {
    displayTier = 'tv-tenfoot';
    inputMode = 'dpad';
  } else if (width < 360) {
    displayTier = 'small-screen';
    inputMode = 'touch';
  } else if (coarsePointer || width < 768) {
    displayTier = 'compact-touch';
    inputMode = 'touch';
  } else if (width <= 1024) {
    displayTier = 'tablet';
    inputMode = coarsePointer ? 'touch' : 'pointer';
  } else if (width >= 1920) {
    displayTier = 'large-format';
  }

  return {
    displayTier,
    inputMode,
    uaEngine,
    isOverride: false,
  };
}

export function loadDisplayTierOverride(): DisplayTier | 'auto' {
  try {
    const val = localStorage.getItem(OVERRIDE_KEY) as DisplayTier | null;
    if (val && VALID_DISPLAY_TIERS.has(val)) {
      return val;
    }
  } catch {}
  return 'auto';
}

export function saveDisplayTierOverride(tier: DisplayTier | 'auto'): void {
  try {
    if (tier === 'auto') {
      localStorage.removeItem(OVERRIDE_KEY);
    } else {
      localStorage.setItem(OVERRIDE_KEY, tier);
    }
  } catch {}
}

export function applyAdaptiveDisplayProfile(profile: AdaptiveDisplayProfile): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-display-tier', profile.displayTier);
  root.setAttribute('data-input-mode', profile.inputMode);
  root.setAttribute('data-ua-engine', profile.uaEngine);
}
