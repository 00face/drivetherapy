/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-099] Custom Gchat & Castor Chat Decoration & Theme Engine
 * Supports:
 *  - Full synchronization / blending with the active Drive Therapy theme
 *  - Independent decoration theme overrides (Sakura Glow, Midnight Lantern, Pastel Pixel, RPG Tavern, Material Swatches)
 *  - 14 Material 3 two-tone color swatches
 *  - Comfortable / Compact density & optional bubble ornaments
 *  - Dedicated high-readability chat canvas backdrops
 */

export type ChatInfluenceMode = 'blend' | 'override';
export type ChatDensityMode = 'comfortable' | 'compact';
export type ChatDecorationId =
  | 'drive-sync'
  | 'material-swatch'
  | 'sakura-glow'
  | 'midnight-lantern'
  | 'pastel-pixel'
  | 'rpg-tavern';

export type ChatSwatchId =
  | 'sapphire'
  | 'orchid'
  | 'rose'
  | 'terracotta'
  | 'amber'
  | 'gold'
  | 'mocha'
  | 'olive'
  | 'sage'
  | 'emerald'
  | 'teal'
  | 'indigo'
  | 'lavender'
  | 'obsidian';

export interface ChatColorSwatch {
  id: ChatSwatchId;
  name: string;
  primary: string;
  soft: string;
  textOnPrimary: string;
}

export interface ChatDecorationPreset {
  id: ChatDecorationId;
  name: string;
  subtitle: string;
  isDarkOverride: boolean;
  previewGradient: string;
  overrideBg: string;
  overrideSurface: string;
  overrideBorder: string;
  overrideText: string;
  overrideMutedText: string;
  overrideAccent: string;
  overrideUserBubbleBg: string;
  overrideUserBubbleText: string;
  overridePeerBubbleBg: string;
  overridePeerBubbleText: string;
  overridePeerBubbleBorder: string;
  hasOrnaments: boolean;
}

export interface ChatDecorationPrefs {
  decorationId: ChatDecorationId;
  influenceMode: ChatInfluenceMode;
  swatchId: ChatSwatchId;
  density: ChatDensityMode;
  showOrnaments: boolean;
  showUniqueBackdrop: boolean;
}

export const CHAT_DECORATION_STORAGE_KEY = 'dt_chat_decoration_prefs_v1';

export const CHAT_COLOR_SWATCHES: readonly ChatColorSwatch[] = [
  { id: 'sapphire', name: 'Sapphire', primary: '#1557B0', soft: '#A8C7FA', textOnPrimary: '#FFFFFF' },
  { id: 'orchid', name: 'Orchid', primary: '#7E4A88', soft: '#E5A8ED', textOnPrimary: '#FFFFFF' },
  { id: 'rose', name: 'Rose', primary: '#8F3F65', soft: '#F59BBF', textOnPrimary: '#FFFFFF' },
  { id: 'terracotta', name: 'Terracotta', primary: '#8E463A', soft: '#F4A698', textOnPrimary: '#FFFFFF' },
  { id: 'amber', name: 'Amber', primary: '#8A4B14', soft: '#F4AE7A', textOnPrimary: '#FFFFFF' },
  { id: 'gold', name: 'Gold', primary: '#785B0D', soft: '#E3BE5E', textOnPrimary: '#FFFFFF' },
  { id: 'mocha', name: 'Mocha', primary: '#6E5649', soft: '#CDB3A3', textOnPrimary: '#FFFFFF' },
  { id: 'olive', name: 'Olive', primary: '#56611E', soft: '#B8C56E', textOnPrimary: '#FFFFFF' },
  { id: 'sage', name: 'Sage', primary: '#2F6538', soft: '#91CA9B', textOnPrimary: '#FFFFFF' },
  { id: 'emerald', name: 'Emerald', primary: '#0B6B54', soft: '#6ECAB4', textOnPrimary: '#FFFFFF' },
  { id: 'teal', name: 'Teal', primary: '#0B6278', soft: '#76C7DE', textOnPrimary: '#FFFFFF' },
  { id: 'indigo', name: 'Indigo', primary: '#4F528E', soft: '#B4B7F5', textOnPrimary: '#FFFFFF' },
  { id: 'lavender', name: 'Lavender', primary: '#6A4D8A', soft: '#D2B4F5', textOnPrimary: '#FFFFFF' },
  { id: 'obsidian', name: 'Obsidian', primary: '#1F242D', soft: '#525965', textOnPrimary: '#FFFFFF' },
] as const;

export const CHAT_DECORATION_PRESETS: readonly ChatDecorationPreset[] = [
  {
    id: 'drive-sync',
    name: 'Drive Therapy Sync',
    subtitle: 'Adapts directly to active app theme with a readable chat canvas',
    isDarkOverride: false,
    previewGradient: 'linear-gradient(135deg, #1074B1 0%, #52B197 100%)',
    overrideBg: '#F4F7FB',
    overrideSurface: 'rgba(255, 255, 255, 0.94)',
    overrideBorder: 'rgba(148, 163, 184, 0.35)',
    overrideText: '#0F172A',
    overrideMutedText: '#475569',
    overrideAccent: '#1557B0',
    overrideUserBubbleBg: '#1557B0',
    overrideUserBubbleText: '#FFFFFF',
    overridePeerBubbleBg: 'rgba(255, 255, 255, 0.96)',
    overridePeerBubbleText: '#0F172A',
    overridePeerBubbleBorder: 'rgba(148, 163, 184, 0.35)',
    hasOrnaments: false,
  },
  {
    id: 'material-swatch',
    name: 'Material 3 Swatches',
    subtitle: 'Two-tone Google Chat palette with selectable 14-color accent',
    isDarkOverride: false,
    previewGradient: 'linear-gradient(135deg, #1557B0 0%, #A8C7FA 100%)',
    overrideBg: '#F3F6FC',
    overrideSurface: '#FFFFFF',
    overrideBorder: '#D3E3FD',
    overrideText: '#1F2937',
    overrideMutedText: '#4B5563',
    overrideAccent: '#1557B0',
    overrideUserBubbleBg: '#1557B0',
    overrideUserBubbleText: '#FFFFFF',
    overridePeerBubbleBg: '#FFFFFF',
    overridePeerBubbleText: '#1F2937',
    overridePeerBubbleBorder: '#D3E3FD',
    hasOrnaments: false,
  },
  {
    id: 'sakura-glow',
    name: 'Sakura Blossom Glow',
    subtitle: 'Luminous plum glass frames, top heart beads & cherry blossom corners',
    isDarkOverride: true,
    previewGradient: 'linear-gradient(135deg, #1C1629 0%, #58355E 55%, #F9A8D4 100%)',
    overrideBg: '#161224',
    overrideSurface: 'rgba(28, 22, 43, 0.92)',
    overrideBorder: 'rgba(249, 168, 212, 0.42)',
    overrideText: '#FDF2F8',
    overrideMutedText: '#FBCFE8',
    overrideAccent: '#F472B6',
    overrideUserBubbleBg: 'linear-gradient(135deg, rgba(190, 24, 93, 0.88) 0%, rgba(126, 34, 206, 0.88) 100%)',
    overrideUserBubbleText: '#FFFFFF',
    overridePeerBubbleBg: 'rgba(34, 25, 48, 0.88)',
    overridePeerBubbleText: '#FFF1F7',
    overridePeerBubbleBorder: 'rgba(249, 168, 212, 0.65)',
    hasOrnaments: true,
  },
  {
    id: 'midnight-lantern',
    name: 'Midnight Lantern',
    subtitle: 'Crisp moonlit borders, subtle corner filigree & glowing lantern crest',
    isDarkOverride: true,
    previewGradient: 'linear-gradient(135deg, #0D0D14 0%, #27233A 55%, #93C5FD 100%)',
    overrideBg: '#0C0D14',
    overrideSurface: 'rgba(18, 20, 31, 0.94)',
    overrideBorder: 'rgba(203, 213, 225, 0.35)',
    overrideText: '#F8FAFC',
    overrideMutedText: '#CBD5E1',
    overrideAccent: '#93C5FD',
    overrideUserBubbleBg: 'linear-gradient(135deg, rgba(30, 41, 74, 0.95) 0%, rgba(55, 48, 107, 0.92) 100%)',
    overrideUserBubbleText: '#F8FAFC',
    overridePeerBubbleBg: 'rgba(22, 24, 38, 0.92)',
    overridePeerBubbleText: '#F1F5F9',
    overridePeerBubbleBorder: 'rgba(226, 232, 240, 0.52)',
    hasOrnaments: true,
  },
  {
    id: 'pastel-pixel',
    name: 'Pastel Pixel Kawaii',
    subtitle: 'Blush-pink, cream & espresso retro bubbles with pixel heart accents',
    isDarkOverride: false,
    previewGradient: 'linear-gradient(135deg, #FCE7F3 0%, #F9A8D4 55%, #27272A 100%)',
    overrideBg: '#F6F3F5',
    overrideSurface: 'rgba(255, 252, 253, 0.96)',
    overrideBorder: '#F3B8CE',
    overrideText: '#272024',
    overrideMutedText: '#6B5560',
    overrideAccent: '#BE185D',
    overrideUserBubbleBg: '#272024',
    overrideUserBubbleText: '#FFF5F8',
    overridePeerBubbleBg: '#FFEAF2',
    overridePeerBubbleText: '#272024',
    overridePeerBubbleBorder: '#F3B8CE',
    hasOrnaments: true,
  },
  {
    id: 'rpg-tavern',
    name: 'RPG Woodland Quest',
    subtitle: 'Deep forest-slate canvas with misty pine aura & chartreuse action accents',
    isDarkOverride: true,
    previewGradient: 'linear-gradient(135deg, #13211E 0%, #243B35 55%, #A3E635 100%)',
    overrideBg: '#121D1B',
    overrideSurface: 'rgba(22, 34, 31, 0.94)',
    overrideBorder: 'rgba(163, 230, 53, 0.28)',
    overrideText: '#ECFDF5',
    overrideMutedText: '#A7F3D0',
    overrideAccent: '#A3E635',
    overrideUserBubbleBg: 'rgba(34, 56, 48, 0.96)',
    overrideUserBubbleText: '#F7FEE7',
    overridePeerBubbleBg: 'rgba(26, 40, 36, 0.94)',
    overridePeerBubbleText: '#ECFDF5',
    overridePeerBubbleBorder: 'rgba(163, 230, 53, 0.36)',
    hasOrnaments: true,
  },
] as const;

export const DEFAULT_CHAT_DECORATION_PREFS: ChatDecorationPrefs = {
  decorationId: 'drive-sync',
  influenceMode: 'blend',
  swatchId: 'sapphire',
  density: 'comfortable',
  showOrnaments: true,
  showUniqueBackdrop: true,
};

export function getChatDecorationById(id: string): ChatDecorationPreset {
  return CHAT_DECORATION_PRESETS.find((p) => p.id === id) || CHAT_DECORATION_PRESETS[0];
}

export function getChatSwatchById(id: string): ChatColorSwatch {
  return CHAT_COLOR_SWATCHES.find((s) => s.id === id) || CHAT_COLOR_SWATCHES[0];
}

export function loadChatDecorationPrefs(): ChatDecorationPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_CHAT_DECORATION_PREFS };
  try {
    const raw = localStorage.getItem(CHAT_DECORATION_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CHAT_DECORATION_PREFS };
    const parsed = JSON.parse(raw);
    return {
      decorationId: getChatDecorationById(parsed.decorationId).id,
      influenceMode: parsed.influenceMode === 'override' ? 'override' : 'blend',
      swatchId: getChatSwatchById(parsed.swatchId).id,
      density: parsed.density === 'compact' ? 'compact' : 'comfortable',
      showOrnaments: parsed.showOrnaments !== false,
      showUniqueBackdrop: parsed.showUniqueBackdrop !== false,
    };
  } catch {
    return { ...DEFAULT_CHAT_DECORATION_PREFS };
  }
}

export function saveChatDecorationPrefs(prefs: ChatDecorationPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CHAT_DECORATION_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

export interface ResolvedChatDecoration {
  preset: ChatDecorationPreset;
  swatch: ChatColorSwatch;
  isOverridingTheme: boolean;
  shellBg: string;
  shellBorder: string;
  shellText: string;
  accentColor: string;
  canvasBgImage: string;
  canvasBgColor: string;
  userBubbleBg: string;
  userBubbleText: string;
  peerBubbleBg: string;
  peerBubbleText: string;
  peerBubbleBorder: string;
  peerBubbleShadow: string;
  messageGapClass: string;
  bubblePaddingClass: string;
}

/**
 * Resolves concrete CSS styles for both Castor (Gemini) and Custom Google Chat.
 * Guarantees crisp readability whether blending with the active Drive Therapy theme
 * or overriding it with a standalone decoration theme.
 */
export function resolveChatDecorationStyles(prefs: ChatDecorationPrefs): ResolvedChatDecoration {
  const preset = getChatDecorationById(prefs.decorationId);
  const swatch = getChatSwatchById(prefs.swatchId);
  const isOverride = prefs.influenceMode === 'override' && preset.id !== 'drive-sync';
  const useSwatchAccent = preset.id === 'material-swatch' || prefs.influenceMode === 'blend';
  const accentColor =
    preset.id === 'drive-sync'
      ? 'var(--theme-accent, #1557B0)'
      : isOverride && preset.id !== 'material-swatch'
      ? preset.overrideAccent
      : useSwatchAccent
      ? swatch.primary
      : preset.overrideAccent;

  // Unique readable chat canvas backdrop (soft radial + micro-dot grid so messages stay 100% legible)
  let canvasBgImage = 'none';
  if (prefs.showUniqueBackdrop) {
    if (preset.id === 'sakura-glow') {
      canvasBgImage = isOverride
        ? 'radial-gradient(circle at 18% 18%, rgba(244, 114, 182, 0.16), transparent 46%), radial-gradient(circle at 82% 78%, rgba(168, 85, 247, 0.16), transparent 50%), radial-gradient(rgba(249, 168, 212, 0.12) 1px, transparent 1px)'
        : 'radial-gradient(circle at 18% 18%, rgba(244, 114, 182, 0.14), transparent 48%), radial-gradient(circle at 84% 80%, rgba(var(--theme-surface-rgb, 255, 255, 255), 0.18), transparent 52%), radial-gradient(rgba(244, 114, 182, 0.12) 1px, transparent 1px)';
    } else if (preset.id === 'midnight-lantern') {
      canvasBgImage =
        'radial-gradient(circle at 50% 0%, rgba(147, 197, 253, 0.14), transparent 54%), radial-gradient(circle at 85% 90%, rgba(99, 102, 241, 0.14), transparent 48%), radial-gradient(rgba(226, 232, 240, 0.08) 1px, transparent 1px)';
    } else if (preset.id === 'pastel-pixel') {
      canvasBgImage =
        'radial-gradient(circle at 20% 20%, rgba(249, 168, 212, 0.22), transparent 45%), radial-gradient(circle at 80% 75%, rgba(251, 207, 232, 0.25), transparent 48%), radial-gradient(rgba(190, 24, 93, 0.09) 1.2px, transparent 1.2px)';
    } else if (preset.id === 'rpg-tavern') {
      canvasBgImage =
        'radial-gradient(circle at 25% 15%, rgba(163, 230, 53, 0.12), transparent 48%), radial-gradient(circle at 80% 85%, rgba(16, 185, 129, 0.14), transparent 52%), linear-gradient(180deg, rgba(18, 29, 27, 0.25) 0%, rgba(10, 18, 16, 0.45) 100%)';
    } else {
      // Drive Therapy Sync & Material Swatches: soft theme-adapted chat canvas
      canvasBgImage = `radial-gradient(circle at 16% 14%, color-mix(in srgb, ${accentColor} 12%, transparent), transparent 48%), radial-gradient(circle at 86% 86%, color-mix(in srgb, ${accentColor} 9%, transparent), transparent 52%), radial-gradient(color-mix(in srgb, var(--theme-text, #64748B) 10%, transparent) 1px, transparent 1px)`;
    }
  }

  const shellBg = isOverride ? preset.overrideSurface : 'var(--theme-surface)';
  const shellBorder = isOverride ? preset.overrideBorder : 'var(--theme-border)';
  const shellText = isOverride ? preset.overrideText : 'var(--theme-text)';
  const canvasBgColor = isOverride ? preset.overrideBg : 'var(--theme-bg, transparent)';

  const userBubbleBg = isOverride
    ? preset.id === 'material-swatch'
      ? swatch.primary
      : preset.overrideUserBubbleBg
    : preset.id === 'material-swatch'
    ? swatch.primary
    : 'var(--theme-accent, #1557B0)';

  const userBubbleText = isOverride
    ? preset.id === 'material-swatch'
      ? swatch.textOnPrimary
      : preset.overrideUserBubbleText
    : '#FFFFFF';

  const peerBubbleBg = isOverride ? preset.overridePeerBubbleBg : 'var(--theme-surface)';
  const peerBubbleText = isOverride ? preset.overridePeerBubbleText : 'var(--theme-text)';
  const peerBubbleBorder = isOverride
    ? preset.overridePeerBubbleBorder
    : preset.id === 'sakura-glow'
    ? 'rgba(244, 114, 182, 0.55)'
    : preset.id === 'midnight-lantern'
    ? 'rgba(147, 197, 253, 0.48)'
    : preset.id === 'pastel-pixel'
    ? '#F3B8CE'
    : preset.id === 'rpg-tavern'
    ? 'rgba(163, 230, 53, 0.42)'
    : 'var(--theme-border)';

  const peerBubbleShadow =
    preset.id === 'sakura-glow'
      ? '0 0 16px rgba(244, 114, 182, 0.22), inset 0 0 8px rgba(249, 168, 212, 0.10)'
      : preset.id === 'midnight-lantern'
      ? '0 0 14px rgba(147, 197, 253, 0.18), inset 0 0 6px rgba(255, 255, 255, 0.08)'
      : preset.id === 'rpg-tavern'
      ? '0 4px 14px rgba(0, 0, 0, 0.28)'
      : '0 1px 3px rgba(0, 0, 0, 0.08)';

  return {
    preset,
    swatch,
    isOverridingTheme: isOverride,
    shellBg,
    shellBorder,
    shellText,
    accentColor,
    canvasBgImage,
    canvasBgColor,
    userBubbleBg,
    userBubbleText,
    peerBubbleBg,
    peerBubbleText,
    peerBubbleBorder,
    peerBubbleShadow,
    messageGapClass: prefs.density === 'compact' ? 'space-y-2' : 'space-y-3.5',
    bubblePaddingClass: prefs.density === 'compact' ? 'px-2.5 py-2' : 'p-3.5',
  };
}
