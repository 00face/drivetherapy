/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Themes & Wallpaper Engine
 * Curated theme styles, color palettes, full 52 Gmail themes catalog, and custom wallpaper management.
 */

import { GMAIL_THEMES_CATALOG, WarmNightVariant, GmailThemeItem } from './gmailThemesCatalog';

export const DEDICATED_NIGHT_THEME_IDS = new Set<string>([
  'gmail_highscore',
  'gmail_highscore_composed',
  'gmail_terminal',
  'gmail_basicblack',
  'gmail_darkwarm',
  'gmail_eggplant',
  'gmail_ninja',
  'gmail_ninja_composed',
  'gmail_teahouse',
  'google-dark',
  'gemini-design',
  'google-firebase',
  'google-play-games',
  'google-android',
  'google-youtube',
  'google-notebooklm',
  'google-tilt-brush',
  'google-stadia',
  'google-earth',
  'google-maps',
  'google-search',
  'google-marketing-platform',
  'workspace-meet',
  'high-contrast',
  'titan-mechanicus',
  'titan-mars-forge',
  'titan-ryza-plasma',
  'titan-cogitator-amber',
  'titan-cogitator-green',
  'titan-noosphere',
  'titan-synthwave',
  'titan-cyberpunk',
  'titan-dracula',
  'gmail_custom_0',
  'cosmos-planets',
  'woodland-turf',
  'ocean-beach',
  'sunset-pastel',
  'warm-timber',
  'modern-lavender',
  'gmail_android',
  'gmail_phantasea',
  'gmail_graffiti',
  'gmail_planets',
  'gmail_gizmos',
  'gmail_turf',
  'gmail_treetops',
]);

export interface Theme {
  id: string;
  nameKey: string;
  category: 'preset' | 'custom' | 'featured' | 'modern' | 'classic' | 'solid' | 'titan';
  background: string;
  canvasColor?: string;
  surface: string;
  border: string;
  text: string;
  accent: string;
  previewGradient: string;
  isDark: boolean;
  wallpaperUrl?: string;
  wallpaperRepeat?: string;
  wallpaperPosition?: string;
  wallpaperSize?: string;
  previewUrl?: string;
  headerUrl?: string;
  headerTileUrl?: string;
  headerHeight?: number;
  headerRepeat?: string;
  headerPosition?: string;
  headerSize?: string;
  footerUrl?: string;
  footerTileUrl?: string;
  footerHeight?: number;
  footerRepeat?: string;
  footerPosition?: string;
  footerSize?: string;
  composedWallpaperUrl?: string;
  blurAmount?: number; // 0-20px
  cardOpacity?: number; // 0.2 - 1.0
  backgroundType?: 'fullscreen' | 'tiled' | 'solid';
  scrapeKey?: string;
  hasDedicatedNight?: boolean;
  warmNightVariant?: WarmNightVariant;
  /** Authentic Google product logo / icon copied unmodified from official brand kit */
  brandLogoUrl?: string;
  /** Strict provenance class distinguishing original wallpapers, press art, and brand kit palettes */
  assetType?: 'original-wallpaper' | 'official-promo' | 'brand-kit-palette';
  /** Human-readable provenance label for Theme Picker badges & tooltips */
  assetSourceLabel?: string;
  /** Original Google publication or hosted asset URL */
  assetSourceUrl?: string;
  /** Filter group for the Theme Picker UI */
  brandGroup?: 'google-originals';
}

export type GmailTheme = Theme;

export interface AccessibilityPreferences {
  dyslexiaFont: boolean;
  fontScale: 'normal' | 'large' | 'xlarge';
  calmMotion: boolean;
  vimMode: boolean;
  warmNightMode?: boolean;
}

export interface AreaAppearancePreferences {
  sidebarOpacity: number; // 0.0 - 1.0 (default: 0.0 -> 100% visible wallpaper behind sidebar)
  sidebarBlur: number;    // 0 - 25px (default: 0)
  mainOpacity: number;    // 0.0 - 1.0 (default: 0.42)
  mainBlur: number;       // 0 - 25px (default: 10)
  dockOpacity: number;    // 0.0 - 1.0 (default: 0.90)
  headerOpacity: number;  // 0.0 - 1.0 (default: 0.92)
  textHinting: 'inset' | 'outlined' | 'none'; // default: 'inset'
}

export const DEFAULT_AREA_PREFS: AreaAppearancePreferences = {
  sidebarOpacity: 0.0,
  sidebarBlur: 0,
  mainOpacity: 0.42,
  mainBlur: 10,
  dockOpacity: 0.90,
  headerOpacity: 0.92,
  textHinting: 'inset',
};

const BASE_PRESETS: Theme[] = [
  {
    id: 'default-light',
    nameKey: 'theme.light',
    category: 'preset',
    background: '#F4F7FB',
    surface: 'rgba(255, 255, 255, 0.92)',
    border: 'rgba(226, 232, 240, 0.85)',
    text: '#1E293B',
    accent: '#1074B1',
    previewGradient: 'linear-gradient(135deg, #F4F7FB 0%, #FFFFFF 100%)',
    isDark: false,
  },
  {
    id: 'labs',
    nameKey: 'Labs',
    category: 'preset',
    background: '#F3EFEA',
    surface: 'rgba(243, 239, 234, 0.92)',
    border: '#E1D7CB',
    text: '#323232',
    accent: '#5E9BFF',
    previewGradient: 'linear-gradient(135deg, #F3EFEA 0%, #FCC934 45%, #5E9BFF 100%)',
    isDark: false,
  },
  {
    id: 'gemini-design',
    nameKey: 'Gemini Design',
    category: 'preset',
    background: '#000000',
    surface: 'rgba(18, 17, 12, 0.94)',
    border: '#32302A',
    text: '#FFFFFF',
    accent: '#8AB4F8',
    previewGradient: 'linear-gradient(135deg, #000000 0%, #4285F4 38%, #A142F4 70%, #FAE366 100%)',
    isDark: true,
  },
  {
    id: 'google-stadia',
    nameKey: 'Google Stadia (2019)',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'official-promo',
    assetSourceLabel: 'Google Blog (2019) · Stadia Launch Press Artwork',
    assetSourceUrl: 'https://blog.google/products-and-platforms/products/stadia/stadia-launches-today/',
    background: '#160812',
    surface: 'rgba(28, 12, 22, 0.88)',
    border: 'rgba(255, 90, 54, 0.34)',
    text: '#FFF5F7',
    accent: '#FF6B4A',
    wallpaperUrl: '/themes/originals/google-stadia-2019.jpg',
    wallpaperSize: 'cover',
    wallpaperPosition: 'center',
    wallpaperRepeat: 'no-repeat',
    previewGradient: 'linear-gradient(135deg, #160812 0%, #9B1B53 45%, #FF4C1D 82%, #FF8A65 100%)',
    isDark: true,
  },
  {
    id: 'google-maps',
    nameKey: 'Google Maps (Earth View)',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'original-wallpaper',
    assetSourceLabel: 'Google Earth View · 1,522-Photo Satellite Slideshow',
    assetSourceUrl: 'https://earthview.withgoogle.com/',
    background: '#0C1814',
    surface: 'rgba(15, 28, 24, 0.88)',
    border: 'rgba(52, 211, 153, 0.30)',
    text: '#F0FDF4',
    accent: '#34D399',
    previewUrl: '/themes/originals/earth-view-1893.jpg',
    previewGradient: 'linear-gradient(135deg, #0C1814 0%, #137333 52%, #34D399 100%)',
    isDark: true,
  },
  {
    id: 'google-earth',
    nameKey: 'Google Earth View',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'original-wallpaper',
    assetSourceLabel: 'Google Earth View · Original Satellite Slideshow',
    assetSourceUrl: 'https://www.gstatic.com/prettyearth/assets/full/1003.jpg',
    background: '#0A1622',
    surface: 'rgba(13, 25, 38, 0.86)',
    border: 'rgba(96, 165, 250, 0.30)',
    text: '#F0F9FF',
    accent: '#60A5FA',
    previewUrl: '/themes/originals/google-earth-view-1003.jpg',
    previewGradient: 'linear-gradient(135deg, #0A1622 0%, #1D4ED8 50%, #34D399 100%)',
    isDark: true,
  },
  {
    id: 'google-chrome',
    nameKey: 'Google Chrome (Artist Series)',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'original-wallpaper',
    assetSourceLabel: 'Google Blog · Chrome Rising Artists Cross-Fade Series',
    assetSourceUrl: 'https://storage.googleapis.com/gweb-uniblog-publish-prod/original_images/Kaitlin.png',
    background: '#F8FAFD',
    surface: 'rgba(255, 255, 255, 0.91)',
    border: '#D8E2F0',
    text: '#1F2937',
    accent: '#1557B0',
    previewUrl: '/themes/originals/google-chrome-artist-kaitlin.png',
    previewGradient: 'linear-gradient(135deg, #EA4335 0%, #FBBC04 35%, #34A853 68%, #4285F4 100%)',
    isDark: false,
  },
  {
    id: 'google-tilt-brush',
    nameKey: 'Tilt Brush VR',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'official-promo',
    assetSourceLabel: 'Google Tilt Brush · Vibrant VR Brushwork Canvas',
    assetSourceUrl: 'https://blog.google/products-and-platforms/products/google-ar-vr/tilt-brush/',
    background: '#0E081A',
    surface: 'rgba(18, 10, 32, 0.88)',
    border: 'rgba(56, 189, 248, 0.32)',
    text: '#F8FAFC',
    accent: '#38BDF8',
    wallpaperUrl: '/themes/wallpapers/google-tilt-brush.jpg',
    wallpaperSize: 'cover',
    wallpaperPosition: 'center',
    wallpaperRepeat: 'no-repeat',
    previewGradient: 'linear-gradient(135deg, #0E081A 0%, #A855F7 35%, #38BDF8 68%, #FB923C 100%)',
    isDark: true,
  },
  {
    id: 'google-cloud',
    nameKey: 'Google Cloud',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    assetSourceLabel: 'Google Cloud · Architectural Ribbon Backdrop',
    background: '#F4F8FF',
    surface: 'rgba(255, 255, 255, 0.93)',
    border: '#D2E3FC',
    text: '#1F2937',
    accent: '#1557B0',
    previewGradient: 'linear-gradient(135deg, #4285F4 0%, #EA4335 35%, #FBBC04 70%, #34A853 100%)',
    isDark: false,
  },
  {
    id: 'google-sky',
    nameKey: 'Google Brand Sky',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'official-promo',
    assetSourceLabel: 'Google Partner Marketing Hub · Official Brand Art',
    background: '#EAF3FC',
    surface: 'rgba(248, 251, 255, 0.90)',
    border: '#C5DCF5',
    text: '#1E293B',
    accent: '#1557B0',
    wallpaperUrl: '/themes/originals/google-sky-brand.jpg',
    wallpaperSize: 'cover',
    wallpaperPosition: 'center',
    wallpaperRepeat: 'no-repeat',
    previewGradient: 'linear-gradient(135deg, #93C5FD 0%, #F87171 38%, #34D399 70%, #60A5FA 100%)',
    isDark: false,
  },
  {
    id: 'google-firebase',
    nameKey: 'Firebase',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    brandLogoUrl: '/themes/logos/firebase.svg',
    assetSourceLabel: 'Official Firebase Brand Kit · Logomark SVG & Ember Grid',
    background: '#0E131F',
    surface: 'rgba(20, 27, 42, 0.92)',
    border: 'rgba(255, 202, 40, 0.28)',
    text: '#F8FAFC',
    accent: '#FFCA28',
    previewGradient: 'linear-gradient(135deg, #121826 0%, #DD2C00 48%, #FFA000 78%, #FFCA28 100%)',
    isDark: true,
  },
  {
    id: 'google-android',
    nameKey: 'Android',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    assetSourceLabel: 'Android · Full-Bleed Dark Material You Backdrop',
    background: '#0A1612',
    surface: 'rgba(18, 28, 24, 0.90)',
    border: 'rgba(61, 220, 132, 0.30)',
    text: '#F1F5F9',
    accent: '#3DDC84',
    previewGradient: 'linear-gradient(135deg, #073042 0%, #1B5E20 55%, #3DDC84 100%)',
    isDark: true,
  },
  {
    id: 'google-youtube',
    nameKey: 'YouTube (20th Anniv.)',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'official-promo',
    assetSourceLabel: 'Google Blog · YouTube 20th Anniversary Artwork',
    assetSourceUrl: 'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/YT20_LOGO.width-1200.format-webp.webp',
    background: '#0F0F0F',
    surface: 'rgba(28, 28, 28, 0.91)',
    border: 'rgba(255, 59, 92, 0.30)',
    text: '#F9FAFB',
    accent: '#FF4D6A',
    wallpaperUrl: '/themes/originals/google-youtube-20th.webp',
    wallpaperSize: 'cover',
    wallpaperPosition: 'center',
    wallpaperRepeat: 'no-repeat',
    previewGradient: 'linear-gradient(135deg, #0F0F0F 0%, #99001A 60%, #FF0033 100%)',
    isDark: true,
  },
  {
    id: 'google-search',
    nameKey: 'Google Search',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    assetSourceLabel: 'Google Search · Prismatic Dark Lens Backdrop',
    background: '#0E121B',
    surface: 'rgba(22, 26, 36, 0.91)',
    border: 'rgba(138, 180, 248, 0.30)',
    text: '#F8FAFC',
    accent: '#8AB4F8',
    previewGradient: 'linear-gradient(135deg, #12151C 0%, #4285F4 45%, #34A853 100%)',
    isDark: true,
  },
  {
    id: 'google-pay',
    nameKey: 'Google Pay',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    brandLogoUrl: '/themes/logos/google-pay.svg',
    assetSourceLabel: 'Official Google Pay Brand Kit & Luminous Ribbon',
    background: '#F5F9FF',
    surface: 'rgba(255, 255, 255, 0.92)',
    border: '#D2E3FC',
    text: '#1E293B',
    accent: '#1557B0',
    previewGradient: 'linear-gradient(135deg, #4285F4 0%, #34A853 45%, #FBBC04 75%, #EA4335 100%)',
    isDark: false,
  },
  {
    id: 'google-ads',
    nameKey: 'Google Ads',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    assetSourceLabel: 'Official Google Ads Brand Palette & Ribbon Backdrop',
    background: '#F6F9FE',
    surface: 'rgba(255, 255, 255, 0.93)',
    border: '#D2E3FC',
    text: '#1E293B',
    accent: '#1557B0',
    previewGradient: 'linear-gradient(135deg, #FBBC04 0%, #4285F4 60%, #34A853 100%)',
    isDark: false,
  },
  {
    id: 'google-analytics',
    nameKey: 'Google Analytics',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    assetSourceLabel: 'Official Google Analytics Brand Palette & Telemetry Grid',
    background: '#FFFBF2',
    surface: 'rgba(255, 255, 255, 0.94)',
    border: '#FDE68A',
    text: '#1E293B',
    accent: '#B35900',
    previewGradient: 'linear-gradient(135deg, #F9AB00 0%, #B35900 100%)',
    isDark: false,
  },
  {
    id: 'google-marketing-platform',
    nameKey: 'Google Marketing Platform',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'official-promo',
    assetSourceLabel: 'Google Blog (2018) · Feathered & Smoothed GMP Animation',
    assetSourceUrl: 'https://storage.googleapis.com/gweb-uniblog-publish-prod/original_images/GMP_Logo_Animation_Loop_kqdSyht.gif',
    background: '#0F172A',
    surface: 'rgba(20, 29, 49, 0.91)',
    border: 'rgba(66, 133, 244, 0.32)',
    text: '#F8FAFC',
    accent: '#60A5FA',
    previewUrl: '/themes/originals/google-marketing-platform-2018.gif',
    previewGradient: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 55%, #34A853 100%)',
    isDark: true,
  },
  {
    id: 'google-play',
    nameKey: 'Google Play',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    assetSourceLabel: 'Official Google Play Prismatic Facet Backdrop',
    background: '#F6FBF9',
    surface: 'rgba(255, 255, 255, 0.95)',
    border: '#DCE5E1',
    text: '#1E293B',
    accent: '#017552',
    previewGradient: 'linear-gradient(135deg, #00D2FF 0%, #00F076 35%, #FFC900 70%, #FF3A44 100%)',
    isDark: false,
  },
  {
    id: 'google-play-games',
    nameKey: 'Google Play Games',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    assetSourceLabel: 'Official Google Play Games Neon Arcade Backdrop',
    background: '#0B120F',
    surface: 'rgba(20, 28, 24, 0.94)',
    border: 'rgba(0, 230, 118, 0.28)',
    text: '#F1F5F9',
    accent: '#00E676',
    previewGradient: 'linear-gradient(135deg, #0F1412 0%, #00A152 55%, #00E676 100%)',
    isDark: true,
  },
  {
    id: 'google-notebooklm',
    nameKey: 'NotebookLM',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    brandLogoUrl: '/themes/logos/workspace-gemini.png',
    assetSourceLabel: 'Official Google AI / NotebookLM Constellation Backdrop',
    background: '#10141E',
    surface: 'rgba(25, 30, 43, 0.94)',
    border: 'rgba(138, 180, 248, 0.25)',
    text: '#F1F5F9',
    accent: '#8AB4F8',
    previewGradient: 'linear-gradient(135deg, #13161F 0%, #3B82F6 55%, #34D399 100%)',
    isDark: true,
  },
  {
    id: 'workspace-docs',
    nameKey: 'Google Docs',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    brandLogoUrl: '/themes/logos/workspace-docs.png',
    assetSourceLabel: 'Official Google Workspace 2026 Brand Kit',
    background: '#F5F9FF',
    surface: 'rgba(255, 255, 255, 0.94)',
    border: '#D3E3FD',
    text: '#1F2937',
    accent: '#1557B0',
    previewGradient: 'linear-gradient(135deg, #E8F0FE 0%, #4285F4 100%)',
    isDark: false,
  },
  {
    id: 'workspace-sheets',
    nameKey: 'Google Sheets',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    brandLogoUrl: '/themes/logos/workspace-sheets.png',
    assetSourceLabel: 'Official Google Workspace 2026 Brand Kit',
    background: '#F2FAF5',
    surface: 'rgba(255, 255, 255, 0.94)',
    border: '#CEEAD6',
    text: '#1F2937',
    accent: '#137333',
    previewGradient: 'linear-gradient(135deg, #E6F4EA 0%, #137333 100%)',
    isDark: false,
  },
  {
    id: 'workspace-slides',
    nameKey: 'Google Slides',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    brandLogoUrl: '/themes/logos/workspace-slides.png',
    assetSourceLabel: 'Official Google Workspace 2026 Brand Kit',
    background: '#FFFBF0',
    surface: 'rgba(255, 255, 255, 0.94)',
    border: '#FEEFC3',
    text: '#1F2937',
    accent: '#B45309',
    previewGradient: 'linear-gradient(135deg, #FEF7E0 0%, #F4B400 100%)',
    isDark: false,
  },
  {
    id: 'workspace-keep',
    nameKey: 'Google Keep',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    brandLogoUrl: '/themes/logos/workspace-keep.png',
    assetSourceLabel: 'Official Google Workspace 2026 Brand Kit',
    background: '#FEF7DF',
    surface: 'rgba(255, 253, 245, 0.94)',
    border: '#F9E79F',
    text: '#292524',
    accent: '#B45309',
    previewGradient: 'linear-gradient(135deg, #FEF9E7 0%, #FBBC04 100%)',
    isDark: false,
  },
  {
    id: 'workspace-meet',
    nameKey: 'Google Meet',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    brandLogoUrl: '/themes/logos/workspace-meet.png',
    assetSourceLabel: 'Official Google Workspace 2026 Brand Kit',
    background: '#0C1A18',
    surface: 'rgba(20, 38, 36, 0.92)',
    border: 'rgba(0, 172, 193, 0.30)',
    text: '#F0FDFA',
    accent: '#2DD4BF',
    previewGradient: 'linear-gradient(135deg, #0F1F1D 0%, #00897B 55%, #34A853 100%)',
    isDark: true,
  },
  {
    id: 'workspace-photos',
    nameKey: 'Google Photos',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    brandLogoUrl: '/themes/logos/workspace-drive.png',
    assetSourceLabel: 'Official Google Photos Brand Palette',
    background: '#F8FAFD',
    surface: 'rgba(255, 255, 255, 0.94)',
    border: '#E2E8F0',
    text: '#1E293B',
    accent: '#1557B0',
    previewGradient: 'linear-gradient(135deg, #EA4335 0%, #FBBC04 33%, #34A853 66%, #4285F4 100%)',
    isDark: false,
  },
  {
    id: 'workspace-calendar',
    nameKey: 'Google Calendar',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    brandLogoUrl: '/themes/logos/workspace-calendar.png',
    assetSourceLabel: 'Official Google Workspace 2026 Brand Kit',
    background: '#F2F7FF',
    surface: 'rgba(255, 255, 255, 0.94)',
    border: '#D2E3FC',
    text: '#1E293B',
    accent: '#1557B0',
    previewGradient: 'linear-gradient(135deg, #1557B0 0%, #4285F4 60%, #34A853 100%)',
    isDark: false,
  },
  {
    id: 'google-forms',
    nameKey: 'Google Forms',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    brandLogoUrl: '/themes/logos/workspace-forms.png',
    assetSourceLabel: 'Official Google Workspace 2026 Brand Kit',
    background: '#F7F3FF',
    surface: 'rgba(255, 255, 255, 0.93)',
    border: '#DDD6FE',
    text: '#1F2937',
    accent: '#6D28D9',
    previewGradient: 'linear-gradient(135deg, #EDE9FE 0%, #6D28D9 100%)',
    isDark: false,
  },
  {
    id: 'google-classroom',
    nameKey: 'Google Classroom',
    category: 'preset',
    brandGroup: 'google-originals',
    assetType: 'brand-kit-palette',
    brandLogoUrl: '/themes/logos/workspace-classroom.png',
    assetSourceLabel: 'Official Google Classroom Brand Kit',
    background: '#F0F9F4',
    surface: 'rgba(255, 255, 255, 0.94)',
    border: '#C6EBD5',
    text: '#1E293B',
    accent: '#137333',
    previewGradient: 'linear-gradient(135deg, #137333 0%, #34A853 60%, #FBBC04 100%)',
    isDark: false,
  },
  {
    id: 'google-dark',
    nameKey: 'theme.dark',
    category: 'preset',
    background: '#202124',
    surface: 'rgba(45, 46, 48, 0.92)',
    border: 'rgba(95, 99, 104, 0.4)',
    text: '#E8EAED',
    accent: '#8AB4F8',
    previewGradient: 'linear-gradient(135deg, #202124 0%, #303134 100%)',
    isDark: true,
  },
  {
    id: 'high-contrast',
    nameKey: 'theme.contrast',
    category: 'preset',
    background: '#000000',
    surface: 'rgba(12, 12, 12, 0.98)',
    border: '#FFD700',
    text: '#FFFFFF',
    accent: '#00FFFF',
    previewGradient: 'linear-gradient(135deg, #000000 0%, #1A1A1A 100%)',
    isDark: true,
  },
  {
    id: 'warm-lowglare',
    nameKey: 'theme.warmLowGlare',
    category: 'preset',
    background: '#FDF6E3',
    surface: 'rgba(255, 250, 240, 0.94)',
    border: 'rgba(211, 200, 175, 0.7)',
    text: '#2D2820',
    accent: '#A65D20',
    previewGradient: 'linear-gradient(135deg, #FDF6E3 0%, #F5ECCB 100%)',
    isDark: false,
  },
  {
    id: 'ocean-beach',
    nameKey: 'theme.beach',
    category: 'preset',
    background: '#004D40',
    surface: 'rgba(0, 77, 64, 0.85)',
    border: 'rgba(128, 203, 196, 0.3)',
    text: '#E0F2F1',
    accent: '#26A69A',
    previewGradient: 'linear-gradient(135deg, #004D40 0%, #00897B 50%, #80CBC4 100%)',
    isDark: true,
  },
  {
    id: 'cosmos-planets',
    nameKey: 'theme.planets',
    category: 'preset',
    background: '#0D0E1C',
    surface: 'rgba(24, 26, 51, 0.88)',
    border: 'rgba(140, 158, 255, 0.25)',
    text: '#E8EAF6',
    accent: '#7986CB',
    previewGradient: 'linear-gradient(135deg, #0D0E1C 0%, #1A237E 60%, #5C6BC0 100%)',
    isDark: true,
  },
  {
    id: 'woodland-turf',
    nameKey: 'theme.turf',
    category: 'preset',
    background: '#1B3520',
    surface: 'rgba(27, 53, 32, 0.88)',
    border: 'rgba(165, 214, 167, 0.25)',
    text: '#E8F5E9',
    accent: '#66BB6A',
    previewGradient: 'linear-gradient(135deg, #1B3520 0%, #2E7D32 60%, #81C784 100%)',
    isDark: true,
  },
  {
    id: 'sunset-pastel',
    nameKey: 'theme.sunset',
    category: 'preset',
    background: '#4A1525',
    surface: 'rgba(74, 21, 37, 0.88)',
    border: 'rgba(244, 143, 177, 0.25)',
    text: '#FCE4EC',
    accent: '#F06292',
    previewGradient: 'linear-gradient(135deg, #4A1525 0%, #C2185B 60%, #F48FB1 100%)',
    isDark: true,
  },
  {
    id: 'warm-timber',
    nameKey: 'theme.wood',
    category: 'preset',
    background: '#271D18',
    surface: 'rgba(46, 34, 28, 0.88)',
    border: 'rgba(188, 170, 164, 0.25)',
    text: '#EFEBE9',
    accent: '#A1887F',
    previewGradient: 'linear-gradient(135deg, #271D18 0%, #4E342E 60%, #8D6E63 100%)',
    isDark: true,
  },
  {
    id: 'modern-lavender',
    nameKey: 'theme.lavender',
    category: 'preset',
    background: '#241432',
    surface: 'rgba(45, 26, 62, 0.88)',
    border: 'rgba(206, 147, 216, 0.25)',
    text: '#F3E5F5',
    accent: '#BA68C8',
    previewGradient: 'linear-gradient(135deg, #241432 0%, #6A1B9A 60%, #CE93D8 100%)',
    isDark: true,
  },
];

export const TITAN_THEMES: Theme[] = [
  {
    id: 'titan-mechanicus',
    nameKey: 'Mechanicus Cyan',
    category: 'titan',
    background: '#0d1117',
    surface: 'rgba(22, 27, 34, 0.95)',
    border: 'rgba(56, 189, 248, 0.35)',
    text: '#e6edf3',
    accent: '#00ffff',
    previewGradient: 'linear-gradient(135deg, #0d1117 0%, #083344 60%, #00ffff 100%)',
    isDark: true,
  },
  {
    id: 'titan-mars-forge',
    nameKey: 'Mars Forge Rust',
    category: 'titan',
    background: '#1a0d0a',
    surface: 'rgba(38, 19, 15, 0.95)',
    border: 'rgba(239, 68, 68, 0.35)',
    text: '#fde8e8',
    accent: '#ef4444',
    previewGradient: 'linear-gradient(135deg, #1a0d0a 0%, #451a03 60%, #ef4444 100%)',
    isDark: true,
  },
  {
    id: 'titan-ryza-plasma',
    nameKey: 'Ryza Plasma',
    category: 'titan',
    background: '#140c1c',
    surface: 'rgba(32, 18, 48, 0.95)',
    border: 'rgba(217, 70, 239, 0.35)',
    text: '#fae8ff',
    accent: '#d946ef',
    previewGradient: 'linear-gradient(135deg, #140c1c 0%, #581c87 60%, #d946ef 100%)',
    isDark: true,
  },
  {
    id: 'titan-cogitator-amber',
    nameKey: 'Cogitator Amber',
    category: 'titan',
    background: '#120f04',
    surface: 'rgba(31, 26, 8, 0.95)',
    border: 'rgba(245, 158, 11, 0.35)',
    text: '#fef3c7',
    accent: '#f59e0b',
    previewGradient: 'linear-gradient(135deg, #120f04 0%, #451a03 60%, #f59e0b 100%)',
    isDark: true,
  },
  {
    id: 'titan-cogitator-green',
    nameKey: 'Cogitator Phosphor',
    category: 'titan',
    background: '#051408',
    surface: 'rgba(10, 31, 15, 0.95)',
    border: 'rgba(34, 197, 94, 0.35)',
    text: '#dcfce7',
    accent: '#22c55e',
    previewGradient: 'linear-gradient(135deg, #051408 0%, #14532d 60%, #22c55e 100%)',
    isDark: true,
  },
  {
    id: 'titan-noosphere',
    nameKey: 'Noosphere Ethereal',
    category: 'titan',
    background: '#08111e',
    surface: 'rgba(15, 27, 48, 0.95)',
    border: 'rgba(96, 165, 250, 0.35)',
    text: '#eff6ff',
    accent: '#60a5fa',
    previewGradient: 'linear-gradient(135deg, #08111e 0%, #1e3a8a 60%, #60a5fa 100%)',
    isDark: true,
  },
  {
    id: 'titan-synthwave',
    nameKey: 'Synthwave Retro',
    category: 'titan',
    background: '#180e29',
    surface: 'rgba(36, 19, 64, 0.95)',
    border: 'rgba(244, 63, 94, 0.35)',
    text: '#ffe4e6',
    accent: '#f43f5e',
    previewGradient: 'linear-gradient(135deg, #180e29 0%, #831843 50%, #f43f5e 100%)',
    isDark: true,
  },
  {
    id: 'titan-cyberpunk',
    nameKey: 'Cyberpunk Neon',
    category: 'titan',
    background: '#090d16',
    surface: 'rgba(17, 24, 39, 0.95)',
    border: 'rgba(250, 204, 21, 0.35)',
    text: '#fef08a',
    accent: '#facc15',
    previewGradient: 'linear-gradient(135deg, #090d16 0%, #1e1b4b 60%, #00ffff 100%)',
    isDark: true,
  },
  {
    id: 'titan-dracula',
    nameKey: 'Dracula Legacy',
    category: 'titan',
    background: '#282a36',
    surface: 'rgba(40, 42, 54, 0.95)',
    border: 'rgba(189, 147, 249, 0.35)',
    text: '#f8f8f2',
    accent: '#ff79c6',
    previewGradient: 'linear-gradient(135deg, #282a36 0%, #44475a 60%, #bd93f9 100%)',
    isDark: true,
  },
];

const GMAIL_MAPPED_THEMES: Theme[] = GMAIL_THEMES_CATALOG.map((g) => ({
  id: g.id,
  nameKey: g.name,
  category: g.category,
  background: g.background,
  canvasColor: g.canvasColor,
  surface: g.surface,
  border: g.border,
  text: g.text,
  accent: g.accent,
  previewGradient: g.previewGradient
    ? g.previewGradient
    : g.wallpaperUrl
    ? `url("${g.previewUrl || g.wallpaperUrl}")`
    : `linear-gradient(135deg, ${g.surface} 0%, ${g.background} 100%)`,
  isDark: g.isDark,
  wallpaperUrl: g.wallpaperUrl,
  wallpaperRepeat: g.wallpaperRepeat,
  wallpaperPosition: g.wallpaperPosition,
  wallpaperSize: g.wallpaperSize,
  previewUrl: g.previewUrl,
  headerUrl: g.headerUrl,
  headerTileUrl: g.headerTileUrl,
  headerHeight: g.headerHeight,
  headerRepeat: g.headerRepeat,
  headerPosition: g.headerPosition,
  headerSize: g.headerSize,
  footerUrl: g.footerUrl,
  footerTileUrl: g.footerTileUrl,
  footerHeight: g.footerHeight,
  footerRepeat: g.footerRepeat,
  footerPosition: g.footerPosition,
  footerSize: g.footerSize,
  composedWallpaperUrl: g.composedWallpaperUrl,
  blurAmount: 0,
  cardOpacity: 0.88,
  backgroundType: g.backgroundType,
  scrapeKey: g.scrapeKey,
  hasDedicatedNight: g.hasDedicatedNight,
  warmNightVariant: g.warmNightVariant,
}));

export const APP_THEMES: Theme[] = [
  ...BASE_PRESETS,
  ...TITAN_THEMES,
  ...GMAIL_MAPPED_THEMES,
];

export const GMAIL_THEMES: Theme[] = APP_THEMES;

const STORAGE_KEY = 'dt_app_theme_v2';
const LEGACY_STORAGE_KEY = 'dt_gmail_theme_v1';
const A11Y_STORAGE_KEY = 'dt_a11y_prefs_v1';
const AREA_STORAGE_KEY = 'dt_theme_area_prefs_v2';

export class ThemeManager {
  private activeThemeId = 'default-light';
  private customWallpaperUrl = '';
  private customBlur = 4;
  private customOpacity = 0.85;

  private a11yPrefs: AccessibilityPreferences = {
    dyslexiaFont: false,
    fontScale: 'normal',
    calmMotion: false,
    vimMode: true,
  };

  private areaPrefs: AreaAppearancePreferences = {
    ...DEFAULT_AREA_PREFS,
  };

  private listeners: Set<(theme: Theme) => void> = new Set();

  constructor() {
    this.load();
    if (typeof window !== 'undefined') {
      this.applyToDOM();
    }
  }

  public subscribe(fn: (theme: Theme) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    const theme = this.getTheme();
    this.listeners.forEach((fn) => {
      try { fn(theme); } catch {}
    });
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.activeThemeId = parsed.activeThemeId || 'default-light';
        this.customWallpaperUrl = parsed.customWallpaperUrl || '';
        this.customBlur = parsed.customBlur ?? 4;
        this.customOpacity = parsed.customOpacity ?? 0.85;
      }
    } catch {
      // Fallback to default
    }

    try {
      const a11yRaw = localStorage.getItem(A11Y_STORAGE_KEY);
      if (a11yRaw) {
        this.a11yPrefs = { ...this.a11yPrefs, ...JSON.parse(a11yRaw) };
      }
    } catch {}

    try {
      const areaRaw = localStorage.getItem(AREA_STORAGE_KEY);
      if (areaRaw) {
        this.areaPrefs = { ...DEFAULT_AREA_PREFS, ...JSON.parse(areaRaw) };
      }
    } catch {}
  }

  public save(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          activeThemeId: this.activeThemeId,
          customWallpaperUrl: this.customWallpaperUrl,
          customBlur: this.customBlur,
          customOpacity: this.customOpacity,
        })
      );
    } catch {}

    try {
      localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(this.a11yPrefs));
    } catch {}

    try {
      localStorage.setItem(AREA_STORAGE_KEY, JSON.stringify(this.areaPrefs));
    } catch {}
  }

  public getA11yPrefs(): AccessibilityPreferences {
    return { ...this.a11yPrefs };
  }

  public setA11yPrefs(prefs: Partial<AccessibilityPreferences>): AccessibilityPreferences {
    this.a11yPrefs = { ...this.a11yPrefs, ...prefs };
    this.save();
    this.applyToDOM();
    return this.getA11yPrefs();
  }

  public getAreaPrefs(): AreaAppearancePreferences {
    return { ...this.areaPrefs };
  }

  public setAreaPrefs(prefs: Partial<AreaAppearancePreferences>): AreaAppearancePreferences {
    this.areaPrefs = { ...this.areaPrefs, ...prefs };
    this.save();
    this.applyToDOM();
    return this.getAreaPrefs();
  }

  public resetAreaPrefs(): AreaAppearancePreferences {
    this.areaPrefs = { ...DEFAULT_AREA_PREFS };
    this.save();
    this.applyToDOM();
    return this.getAreaPrefs();
  }

  public getTheme(): GmailTheme {
    let baseTheme: GmailTheme;
    const found = GMAIL_THEMES.find((t) => t.id === this.activeThemeId);
    if (found) {
      baseTheme = found;
    } else if (this.activeThemeId === 'custom-wallpaper') {
      baseTheme = {
        id: 'custom-wallpaper',
        nameKey: 'theme.custom',
        category: 'custom',
        background: '#111827',
        surface: `rgba(17, 24, 39, ${this.customOpacity})`,
        border: 'rgba(255, 255, 255, 0.15)',
        text: '#F9FAFB',
        accent: '#38BDF8',
        previewGradient: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
        isDark: true,
        wallpaperUrl: this.customWallpaperUrl,
        blurAmount: this.customBlur,
        cardOpacity: this.customOpacity,
      };
    } else {
      baseTheme = GMAIL_THEMES[0];
    }

    // Warm Night Mode Transformation:
    // If warm night mode is active, provide a warmer color temperature dark variant (~3200K)
    // STRICT CONSTRAINT: Do not replace night themes for themes that already have night templates
    if (this.a11yPrefs.warmNightMode) {
      if (!DEDICATED_NIGHT_THEME_IDS.has(baseTheme.id) && !baseTheme.hasDedicatedNight) {
        if (baseTheme.warmNightVariant) {
          return {
            ...baseTheme,
            background: baseTheme.warmNightVariant.background || baseTheme.background,
            surface: baseTheme.warmNightVariant.surface,
            border: baseTheme.warmNightVariant.border,
            text: baseTheme.warmNightVariant.text,
            accent: baseTheme.warmNightVariant.accent,
            isDark: true,
          };
        } else {
          // Dynamic warm night fallback for light/day themes
          return {
            ...baseTheme,
            surface: 'rgba(28, 25, 22, 0.94)',
            border: 'rgba(130, 110, 90, 0.5)',
            text: '#F5EBE1',
            isDark: true,
          };
        }
      }
    }

    return baseTheme;
  }

  public setTheme(themeId: string): GmailTheme {
    this.activeThemeId = themeId;
    this.save();
    this.applyToDOM();
    this.notify();
    return this.getTheme();
  }

  public setCustomWallpaper(url: string, blur = 4, opacity = 0.85): GmailTheme {
    this.activeThemeId = 'custom-wallpaper';
    this.customWallpaperUrl = url;
    this.customBlur = blur;
    this.customOpacity = opacity;
    this.save();
    this.applyToDOM();
    this.notify();
    return this.getTheme();
  }

  public applyToDOM(): void {
    if (typeof document === 'undefined') return;

    const theme = this.getTheme();
    const root = document.documentElement;

    root.style.setProperty('--theme-bg', theme.background);
    root.style.setProperty('--theme-surface', theme.surface);
    root.style.setProperty('--theme-border', theme.border);
    root.style.setProperty('--theme-text', theme.text);
    root.style.setProperty('--theme-accent', theme.accent);

    const [sr, sg, sb] = parseColorToRgb(theme.surface);
    root.style.setProperty('--theme-surface-rgb', `${sr}, ${sg}, ${sb}`);
    const [br, bg, bb] = parseColorToRgb(theme.background);
    root.style.setProperty('--theme-bg-rgb', `${br}, ${bg}, ${bb}`);

    // Smart Text Contrast Resolution
    const smartSurface = resolveSmartTextContrast(theme.surface);
    const smartBg = resolveSmartTextContrast(theme.background);
    root.style.setProperty('--theme-text-auto', smartSurface.textColor);
    root.style.setProperty('--theme-text-subtle-auto', smartSurface.subtextColor);
    root.style.setProperty('--theme-bg-text-auto', smartBg.textColor);
    root.style.setProperty('--theme-bg-is-light', smartBg.isLightBackground ? '1' : '0');
    root.style.setProperty('--theme-surface-is-light', smartSurface.isLightBackground ? '1' : '0');

    // Titan Auger UI Mode activation
    if (theme.category === 'titan') {
      root.setAttribute('data-titan-theme', theme.id);
      root.classList.add('titan-theme-active');
      if (document.body) document.body.classList.add('titan-theme-active');
    } else {
      root.removeAttribute('data-titan-theme');
      root.classList.remove('titan-theme-active');
      if (document.body) document.body.classList.remove('titan-theme-active');
    }

    // Area-by-area opacity and blur CSS variables
    root.style.setProperty('--theme-sidebar-opacity', String(this.areaPrefs.sidebarOpacity));
    root.style.setProperty('--theme-sidebar-blur', `${this.areaPrefs.sidebarBlur}px`);
    root.style.setProperty('--theme-main-opacity', String(this.areaPrefs.mainOpacity));
    root.style.setProperty('--theme-main-blur', `${this.areaPrefs.mainBlur}px`);
    root.style.setProperty('--theme-dock-opacity', String(this.areaPrefs.dockOpacity));
    root.style.setProperty('--theme-header-opacity', String(this.areaPrefs.headerOpacity));
    root.style.setProperty('--theme-text-hinting', this.areaPrefs.textHinting);

    if (theme.isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Apply Accessibility Preferences to document.body
    if (document.body) {
      if (this.a11yPrefs.dyslexiaFont) {
        document.body.classList.add('dyslexia-font');
      } else {
        document.body.classList.remove('dyslexia-font');
      }

      if (this.a11yPrefs.calmMotion) {
        document.body.classList.add('calm-motion');
      } else {
        document.body.classList.remove('calm-motion');
      }

      document.body.classList.remove('font-scale-large', 'font-scale-xlarge');
      if (this.a11yPrefs.fontScale === 'large') {
        document.body.classList.add('font-scale-large');
      } else if (this.a11yPrefs.fontScale === 'xlarge') {
        document.body.classList.add('font-scale-xlarge');
      }

      // Text Hinting Class Binding
      document.body.classList.remove('text-hinting-inset', 'text-hinting-outline', 'text-hinting-none');
      if (this.areaPrefs.textHinting === 'inset') {
        document.body.classList.add('text-hinting-inset');
      } else if (this.areaPrefs.textHinting === 'outlined') {
        document.body.classList.add('text-hinting-outline');
      } else {
        document.body.classList.add('text-hinting-none');
      }

      // Warm Night Mode Body Class
      if (this.a11yPrefs.warmNightMode) {
        document.body.classList.add('warm-night-active');
      } else {
        document.body.classList.remove('warm-night-active');
      }

      // Special Theme Aesthetic Classes
      const specificClasses = ['theme-terminal', 'theme-candy', 'theme-highscore', 'theme-classic-composite'];
      document.body.classList.remove(...specificClasses);
      if (theme.id === 'gmail_terminal') {
        document.body.classList.add('theme-terminal');
      } else if (theme.id === 'gmail_candy') {
        document.body.classList.add('theme-candy');
      } else if (theme.id === 'gmail_highscore') {
        document.body.classList.add('theme-highscore');
      }
      if (theme.category === 'classic') {
        document.body.classList.add('theme-classic-composite');
      }
    }

    // Multi-Layer Wallpaper & Composited Banners injection inside isolated z-index: 0 background stage
    let stageContainer = document.getElementById('dt-theme-stage');
    if (!stageContainer && document.body) {
      stageContainer = document.createElement('div');
      stageContainer.id = 'dt-theme-stage';
      stageContainer.className = 'fixed inset-0 pointer-events-none z-0 overflow-hidden';
      document.body.prepend(stageContainer);
    }

    let wpContainer = document.getElementById('dt-theme-wallpaper');
    let headerBanner = document.getElementById('dt-theme-header-banner');
    let footerBanner = document.getElementById('dt-theme-footer-banner');

    if (theme.wallpaperUrl) {
      if (stageContainer) {
        stageContainer.style.display = 'block';
        stageContainer.style.backgroundColor = theme.canvasColor || theme.background || 'transparent';
      }

      if (!wpContainer) {
        wpContainer = document.createElement('div');
        wpContainer.id = 'dt-theme-wallpaper';
        wpContainer.className = 'absolute inset-0 pointer-events-none transition-all duration-300';
        (stageContainer || document.body).appendChild(wpContainer);
      } else if (stageContainer && wpContainer.parentElement !== stageContainer) {
        stageContainer.appendChild(wpContainer);
      }

      wpContainer.style.display = 'block';
      wpContainer.style.backgroundColor = theme.canvasColor || 'transparent';
      wpContainer.style.backgroundImage = `url("${theme.wallpaperUrl}")`;
      wpContainer.style.filter = `blur(${theme.blurAmount || 0}px)`;
      wpContainer.style.opacity = '1';

      if (theme.wallpaperRepeat || theme.wallpaperPosition || theme.wallpaperSize) {
        wpContainer.style.backgroundRepeat = theme.wallpaperRepeat || 'repeat';
        wpContainer.style.backgroundSize = theme.wallpaperSize || 'auto';
        wpContainer.style.backgroundPosition = theme.wallpaperPosition || 'top left';
        wpContainer.style.imageRendering =
          theme.id === 'gmail_highscore' || theme.id === 'gmail_terminal' ? 'pixelated' : 'auto';
      } else if (theme.id === 'gmail_highscore') {
        wpContainer.style.backgroundRepeat = 'repeat';
        wpContainer.style.backgroundSize = 'auto';
        wpContainer.style.backgroundPosition = 'top center';
        wpContainer.style.imageRendering = 'pixelated';
      } else if (theme.id === 'gmail_ninja') {
        wpContainer.style.backgroundRepeat = 'repeat';
        wpContainer.style.backgroundSize = 'auto';
        wpContainer.style.backgroundPosition = 'top center';
        wpContainer.style.imageRendering = 'auto';
      } else if (theme.backgroundType === 'tiled') {
        wpContainer.style.backgroundRepeat = 'repeat';
        wpContainer.style.backgroundSize = 'auto';
        wpContainer.style.backgroundPosition = 'top left';
        wpContainer.style.imageRendering = 'auto';
      } else {
        wpContainer.style.backgroundRepeat = 'no-repeat';
        wpContainer.style.backgroundSize = 'cover';
        wpContainer.style.backgroundPosition = 'center';
        wpContainer.style.imageRendering = 'auto';
      }

      // Top Header Banner Layer (e.g. Highscore horizon, Ninja roofline, Candy clouds, Tree canopy, Tea House moon & sky)
      if (theme.headerUrl || theme.headerTileUrl) {
        if (!headerBanner) {
          headerBanner = document.createElement('div');
          headerBanner.id = 'dt-theme-header-banner';
          headerBanner.className = 'absolute top-0 left-0 right-0 pointer-events-none transition-all duration-300';
          (stageContainer || document.body).appendChild(headerBanner);
        } else if (stageContainer && headerBanner.parentElement !== stageContainer) {
          stageContainer.appendChild(headerBanner);
        }
        headerBanner.style.display = 'block';
        headerBanner.style.top = '0px';
        headerBanner.style.height = `${theme.headerHeight || 120}px`;

        if (theme.headerUrl && theme.headerTileUrl) {
          headerBanner.style.backgroundImage = `url("${theme.headerUrl}"), url("${theme.headerTileUrl}")`;
          headerBanner.style.backgroundRepeat = `${theme.headerRepeat || 'no-repeat'}, repeat-x`;
          headerBanner.style.backgroundPosition = `${theme.headerPosition || 'top left'}, top left`;
          headerBanner.style.backgroundSize = 'auto, auto';
        } else if (theme.headerUrl) {
          headerBanner.style.backgroundImage = `url("${theme.headerUrl}")`;
          headerBanner.style.backgroundRepeat = theme.headerRepeat || 'repeat-x';
          headerBanner.style.backgroundPosition = theme.headerPosition || 'top center';
          headerBanner.style.backgroundSize = theme.headerSize || 'auto';
        } else if (theme.headerTileUrl) {
          headerBanner.style.backgroundImage = `url("${theme.headerTileUrl}")`;
          headerBanner.style.backgroundRepeat = 'repeat-x';
          headerBanner.style.backgroundPosition = 'top left';
          headerBanner.style.backgroundSize = theme.headerSize || 'auto';
        }

        headerBanner.style.opacity = '1';
        if (theme.id === 'gmail_highscore') {
          headerBanner.style.imageRendering = 'pixelated';
        } else {
          headerBanner.style.imageRendering = 'auto';
        }
      } else if (headerBanner) {
        headerBanner.style.display = 'none';
        headerBanner.style.opacity = '0';
      }

      // Bottom Footer Banner Layer (e.g. Ninja snow hills, Candy characters, Tea House lanterns + hills, Tree flowers + grass, Android robot)
      if (theme.footerUrl || theme.footerTileUrl) {
        if (!footerBanner) {
          footerBanner = document.createElement('div');
          footerBanner.id = 'dt-theme-footer-banner';
          footerBanner.className = 'absolute bottom-0 left-0 right-0 pointer-events-none transition-all duration-300';
          (stageContainer || document.body).appendChild(footerBanner);
        } else if (stageContainer && footerBanner.parentElement !== stageContainer) {
          stageContainer.appendChild(footerBanner);
        }
        footerBanner.style.display = 'block';
        footerBanner.style.bottom = '0px';
        footerBanner.style.height = `${theme.footerHeight || 80}px`;

        if (theme.footerUrl && theme.footerTileUrl) {
          footerBanner.style.backgroundImage = `url("${theme.footerUrl}"), url("${theme.footerTileUrl}")`;
          footerBanner.style.backgroundRepeat = `${theme.footerRepeat || 'no-repeat'}, repeat-x`;
          footerBanner.style.backgroundPosition = `${theme.footerPosition || 'bottom right'}, bottom left`;
          footerBanner.style.backgroundSize = 'auto, auto';
        } else if (theme.footerUrl) {
          footerBanner.style.backgroundImage = `url("${theme.footerUrl}")`;
          footerBanner.style.backgroundRepeat = theme.footerRepeat || 'no-repeat';
          footerBanner.style.backgroundPosition = theme.footerPosition || 'bottom center';
          footerBanner.style.backgroundSize = theme.footerSize || 'auto';
        } else if (theme.footerTileUrl) {
          footerBanner.style.backgroundImage = `url("${theme.footerTileUrl}")`;
          footerBanner.style.backgroundRepeat = 'repeat-x';
          footerBanner.style.backgroundPosition = 'bottom left';
          footerBanner.style.backgroundSize = theme.footerSize || 'auto';
        }

        footerBanner.style.opacity = '1';
        if (theme.id.includes('highscore') || theme.id === 'gmail_busstop') {
          footerBanner.style.imageRendering = 'pixelated';
        } else {
          footerBanner.style.imageRendering = 'auto';
        }
      } else if (footerBanner) {
        footerBanner.style.display = 'none';
        footerBanner.style.opacity = '0';
      }

      if (document.body) {
        document.body.classList.add('theme-has-wallpaper');
        document.body.style.background = 'transparent';
      }
      root.classList.add('theme-has-wallpaper');
      root.style.background = 'transparent';
    } else {
      // Solid Color Themes: Clean canvas, paint pure background color, hide banners
      if (stageContainer) {
        stageContainer.style.display = 'none';
      }
      if (wpContainer) {
        wpContainer.style.display = 'none';
        wpContainer.style.opacity = '0';
      }
      if (headerBanner) {
        headerBanner.style.display = 'none';
        headerBanner.style.opacity = '0';
      }
      if (footerBanner) {
        footerBanner.style.display = 'none';
        footerBanner.style.opacity = '0';
      }

      if (document.body) {
        document.body.classList.remove('theme-has-wallpaper');
        document.body.style.backgroundColor = theme.background;
        document.body.style.background = theme.background;
      }
      root.classList.remove('theme-has-wallpaper');
      root.style.backgroundColor = theme.background;
      root.style.background = theme.background;
    }
  }
}

export const themeManager = new ThemeManager();

export interface SmartContrastResult {
  textColor: string;
  subtextColor: string;
  isLightBackground: boolean;
  contrastRatio: number;
}

export function resolveSmartTextContrast(
  backgroundColor: string,
  preferredLight = '#F8FAFC',
  preferredDark = '#0F172A'
): SmartContrastResult {
  const [r, g, b] = parseColorToRgb(backgroundColor);
  const lum = getRelativeLuminance(r, g, b);
  const ratioWithLight = 1.05 / (lum + 0.05);
  const ratioWithDark = (lum + 0.05) / 0.05;

  const isLightBackground = lum >= 0.40;
  const textColor = isLightBackground ? preferredDark : preferredLight;
  const subtextColor = isLightBackground ? '#475569' : '#94A3B8';
  const contrastRatio = isLightBackground ? ratioWithDark : ratioWithLight;

  return {
    textColor,
    subtextColor,
    isLightBackground,
    contrastRatio,
  };
}

/**
 * WCAG 2.1 AA/AAA Color Contrast Calculation Utilities
 * Relative luminance formula: L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 * Contrast ratio: (L1 + 0.05) / (L2 + 0.05)
 */
export function parseColorToRgb(colorStr: string): [number, number, number] {
  const str = colorStr.trim();
  if (str.startsWith('#')) {
    const hex = str.slice(1);
    if (hex.length === 3) {
      const r = Number.parseInt(hex[0] + hex[0], 16);
      const g = Number.parseInt(hex[1] + hex[1], 16);
      const b = Number.parseInt(hex[2] + hex[2], 16);
      return [r, g, b];
    }
    const num = Number.parseInt(hex.slice(0, 6), 16);
    if (!Number.isNaN(num)) {
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
  }
  const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return [Math.trunc(Number(match[1])), Math.trunc(Number(match[2])), Math.trunc(Number(match[3]))];
  }
  return [0, 0, 0];
}

export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const s = val / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function calculateContrastRatio(color1: string, color2: string): number {
  const [r1, g1, b1] = parseColorToRgb(color1);
  const [r2, g2, b2] = parseColorToRgb(color2);
  const l1 = getRelativeLuminance(r1, g1, b1);
  const l2 = getRelativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
