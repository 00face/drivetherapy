/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Themes Modal Picker
 * Interactive theme gallery supporting all 52 authentic Gmail themes
 * (Featured Photo Backgrounds, Modern Landscapes, Classic Tiled, Solid Palettes, and Custom Wallpapers).
 */

import React, { useState, useMemo } from 'react';
import { X, Check, Image as ImageIcon, Palette, Sparkles, Sliders, Type, RotateCcw, Moon, Sun } from 'lucide-react';
import { APP_THEMES, themeManager, Theme, GmailTheme, AreaAppearancePreferences } from '../services/themeEngine';
import { useTranslation } from '../i18n';

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThemeChanged?: (theme: Theme) => void;
  onOpenA11y?: () => void;
}

type ThemeCategoryFilter = 'all' | 'google-originals' | 'featured' | 'modern' | 'classic' | 'solid' | 'titan' | 'custom';

export const ThemeModal: React.FC<ThemeModalProps> = ({
  isOpen,
  onClose,
  onThemeChanged,
  onOpenA11y,
}) => {
  const { t } = useTranslation();
  const [activeTheme, setActiveTheme] = useState<Theme>(() => themeManager.getTheme());
  const [a11yPrefs, setA11yPrefs] = useState(() => themeManager.getA11yPrefs());
  const [wallpaperUrl, setWallpaperUrl] = useState<string>(activeTheme.wallpaperUrl || '');
  const [blur, setBlur] = useState<number>(activeTheme.blurAmount ?? 4);
  const [opacity, setOpacity] = useState<number>(activeTheme.cardOpacity ?? 0.85);
  const [categoryFilter, setCategoryFilter] = useState<ThemeCategoryFilter>('all');
  const [areaPrefs, setAreaPrefs] = useState<AreaAppearancePreferences>(() => themeManager.getAreaPrefs());

  const handleToggleWarmNight = (enabled: boolean) => {
    const updated = themeManager.setA11yPrefs({ warmNightMode: enabled });
    setA11yPrefs(updated);
    const newTheme = themeManager.getTheme();
    setActiveTheme(newTheme);
    if (onThemeChanged) onThemeChanged(newTheme);
  };

  const handleUpdateAreaPref = (partial: Partial<AreaAppearancePreferences>) => {
    const updated = themeManager.setAreaPrefs(partial);
    setAreaPrefs(updated);
  };

  const handleResetAreaPrefs = () => {
    const updated = themeManager.resetAreaPrefs();
    setAreaPrefs(updated);
  };

  const filteredThemes = useMemo(() => {
    if (categoryFilter === 'all') return APP_THEMES;
    if (categoryFilter === 'google-originals') {
      return APP_THEMES.filter((t) => t.brandGroup === 'google-originals');
    }
    if (categoryFilter === 'featured') {
      return APP_THEMES.filter((t) => t.category === 'featured');
    }
    if (categoryFilter === 'modern') {
      return APP_THEMES.filter((t) => t.category === 'modern');
    }
    if (categoryFilter === 'classic') {
      return APP_THEMES.filter((t) => t.category === 'classic');
    }
    if (categoryFilter === 'solid') {
      return APP_THEMES.filter((t) => t.category === 'solid' || t.category === 'preset');
    }
    if (categoryFilter === 'titan') {
      return APP_THEMES.filter((t) => t.category === 'titan');
    }
    return APP_THEMES;
  }, [categoryFilter]);

  if (!isOpen) return null;

  const handleSelectTheme = (themeId: string) => {
    const updated = themeManager.setTheme(themeId);
    setActiveTheme(updated);
    if (onThemeChanged) onThemeChanged(updated);
  };

  const handleApplyCustomWallpaper = () => {
    if (!wallpaperUrl.trim()) return;
    const updated = themeManager.setCustomWallpaper(wallpaperUrl.trim(), blur, opacity);
    setActiveTheme(updated);
    if (onThemeChanged) onThemeChanged(updated);
  };

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden flex flex-col max-h-[92vh] modal-card theme-card"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#1074B1] to-[#52B197] flex items-center justify-center text-white shadow-md">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-hint-inline" style={{ color: 'var(--theme-text)' }}>
                {t('theme.modalTitle')}
              </h2>
              <p className="text-xs opacity-75">
                {t('theme.modalSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl opacity-75 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
            aria-label={t('lightbox.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Pills */}
        <div
          className="px-6 py-2.5 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          style={{
            backgroundColor: 'rgba(var(--theme-surface-rgb), 0.65)',
            borderColor: 'var(--theme-border)',
          }}
        >
          {[
            { id: 'all', label: 'All Themes', count: APP_THEMES.length },
            { id: 'google-originals', label: 'Google Originals', count: APP_THEMES.filter((t) => t.brandGroup === 'google-originals').length },
            { id: 'featured', label: 'Featured Photos', count: APP_THEMES.filter((t) => t.category === 'featured').length },
            { id: 'modern', label: 'Landscapes & Art', count: APP_THEMES.filter((t) => t.category === 'modern').length },
            { id: 'classic', label: 'Classic Gmail', count: APP_THEMES.filter((t) => t.category === 'classic').length },
            { id: 'solid', label: 'Colors & High Contrast', count: APP_THEMES.filter((t) => t.category === 'solid' || t.category === 'preset').length },
            { id: 'titan', label: 'Titan Auger (Tech)', count: APP_THEMES.filter((t) => t.category === 'titan').length },
            { id: 'custom', label: 'Custom Wallpaper', count: null },
          ].map((cat) => {
            const isActive = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id as ThemeCategoryFilter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#1074B1] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <span>{cat.label}</span>
                {cat.count !== null && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {cat.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Theme Grid */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {categoryFilter !== 'custom' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
              {filteredThemes.map((theme) => {
                const isSelected = activeTheme.id === theme.id;
                const hasImage = Boolean(theme.wallpaperUrl || theme.previewUrl);

                return (
                  <button
                    key={theme.id}
                    onClick={() => handleSelectTheme(theme.id)}
                    title={theme.assetSourceLabel || t(theme.nameKey) || theme.nameKey}
                    className={`group h-28 rounded-2xl p-2.5 flex flex-col justify-between text-left transition-all relative overflow-hidden border-2 ${
                      isSelected
                        ? 'border-[#1074B1] ring-4 ring-[#1074B1]/20 shadow-md scale-[1.02]'
                        : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-400/60 hover:scale-[1.01]'
                    }`}
                    style={{
                      background: hasImage
                        ? `url("${theme.previewUrl || theme.wallpaperUrl}") center/cover no-repeat`
                        : theme.previewGradient || theme.background,
                    }}
                  >
                    {/* Dark gradient scrim on image backgrounds so text is always crystal clear */}
                    {hasImage && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 pointer-events-none" />
                    )}

                    <div className="flex items-center justify-between w-full relative z-10 gap-1">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-lg truncate max-w-[82%] ${
                          hasImage || theme.isDark
                            ? 'bg-black/60 text-white shadow-xs backdrop-blur-xs'
                            : 'bg-white/85 text-slate-900 shadow-xs'
                        }`}
                      >
                        {t(theme.nameKey) || theme.nameKey}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {theme.brandLogoUrl && (
                          <div className="w-6 h-6 rounded-lg bg-white/95 p-0.5 shadow-sm flex items-center justify-center">
                            <img
                              src={theme.brandLogoUrl}
                              alt=""
                              className="w-full h-full object-contain"
                              loading="lazy"
                            />
                          </div>
                        )}
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#1074B1] text-white flex items-center justify-center shadow-md shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 relative z-10">
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-white/50 shadow-sm shrink-0"
                        style={{ backgroundColor: theme.accent }}
                      />
                      <span
                        className={`text-[10px] font-medium truncate ${
                          hasImage || theme.isDark ? 'text-white/90 drop-shadow-xs' : 'text-slate-700'
                        }`}
                      >
                        {theme.assetType === 'original-wallpaper'
                          ? 'ORIGINAL WALLPAPER'
                          : theme.assetType === 'official-promo'
                          ? 'OFFICIAL PRESS ART'
                          : theme.assetType === 'brand-kit-palette'
                          ? 'BRAND KIT'
                          : theme.category.toUpperCase()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Custom Wallpaper Section */}
          {(categoryFilter === 'all' || categoryFilter === 'custom') && (
            <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#1074B1]" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {t('theme.custom')}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={wallpaperUrl}
                  onChange={(e) => setWallpaperUrl(e.target.value)}
                  placeholder="Enter wallpaper image URL (https://...)"
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1074B1]"
                />
                <button
                  onClick={handleApplyCustomWallpaper}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#1074B1] text-white hover:bg-[#1074B1]/90 transition-colors shadow-sm"
                >
                  Apply Wallpaper
                </button>
              </div>
              {wallpaperUrl && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex justify-between">
                      <span>{t('theme.blur')}</span>
                      <span>{blur}px</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="16"
                      value={blur}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setBlur(val);
                        themeManager.setCustomWallpaper(wallpaperUrl, val, opacity);
                      }}
                      className="w-full mt-1 accent-[#1074B1]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex justify-between">
                      <span>{t('theme.opacity')}</span>
                      <span>{Math.round(opacity * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0.3"
                      max="1.0"
                      step="0.05"
                      value={opacity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setOpacity(val);
                        themeManager.setCustomWallpaper(wallpaperUrl, blur, val);
                      }}
                      className="w-full mt-1 accent-[#1074B1]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Area Opacity & Glassmorphism Controls */}
          <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#1074B1]" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Workspace Area Opacity &amp; Glassmorphism
                </h3>
              </div>
              <button
                onClick={handleResetAreaPrefs}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-[#1074B1] dark:hover:text-[#52B197] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1 transition-colors"
                title="Reset opacities to defaults (Sidebar: 100% / 0px, Main Area: 42% / 10px)"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Defaults</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Sidebar Background Opacity & Blur */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Sidebar Background</span>
                  <span className="text-[10px] text-slate-400 font-mono">Default: 0% (100% Visible) / 0px</span>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Opacity</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {Math.round(areaPrefs.sidebarOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.02"
                    value={areaPrefs.sidebarOpacity}
                    onChange={(e) => handleUpdateAreaPref({ sidebarOpacity: parseFloat(e.target.value) })}
                    className="w-full mt-1 accent-[#1074B1]"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Blur</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {areaPrefs.sidebarBlur}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={areaPrefs.sidebarBlur}
                    onChange={(e) => handleUpdateAreaPref({ sidebarBlur: parseInt(e.target.value, 10) })}
                    className="w-full mt-1 accent-[#1074B1]"
                  />
                </div>
              </div>

              {/* Main Area Workspace Opacity & Blur */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Main Area Stage</span>
                  <span className="text-[10px] text-slate-400 font-mono">Default: 42% / 10px</span>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Opacity</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {Math.round(areaPrefs.mainOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="1.0"
                    step="0.01"
                    value={areaPrefs.mainOpacity}
                    onChange={(e) => handleUpdateAreaPref({ mainOpacity: parseFloat(e.target.value) })}
                    className="w-full mt-1 accent-[#1074B1]"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Blur</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {areaPrefs.mainBlur}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    step="1"
                    value={areaPrefs.mainBlur}
                    onChange={(e) => handleUpdateAreaPref({ mainBlur: parseInt(e.target.value, 10) })}
                    className="w-full mt-1 accent-[#1074B1]"
                  />
                </div>
              </div>
            </div>

            {/* Text Hinting Segmented Selector */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-[#1074B1]" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Text Hinting Style</span>
                </div>
                <span className="text-[10px] text-slate-400">WCAG Wallpaper Text Readability</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'inset', label: 'Inset (Default)', desc: 'Transparent inverted filter + hairline inset' },
                  { id: 'outlined', label: 'Outlined', desc: 'High-contrast text stroke & drop shadow' },
                  { id: 'none', label: 'None', desc: 'Standard unhinted plain text' },
                ].map((mode) => {
                  const isSelected = areaPrefs.textHinting === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => handleUpdateAreaPref({ textHinting: mode.id as any })}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        isSelected
                          ? 'border-[#1074B1] bg-[#1074B1]/10 text-[#1074B1] font-bold shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <span className="text-xs block">{mode.label}</span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight block mt-0.5">
                        {mode.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3 border-t flex items-center justify-between gap-4"
          style={{
            backgroundColor: 'rgba(var(--theme-surface-rgb), 0.65)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="flex items-center gap-3">
            {onOpenA11y && (
              <button
                onClick={() => {
                  onClose();
                  onOpenA11y();
                }}
                className="text-xs font-semibold text-[#1074B1] dark:text-[#67b7e6] hover:underline flex items-center gap-1"
              >
                <span>{t('a11y.title')} &rarr;</span>
              </button>
            )}

            {/* Warm Night Mode Switch */}
            <label
              className="flex items-center gap-2 cursor-pointer text-xs font-semibold px-2.5 py-1 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 transition-colors select-none shadow-2xs"
              title="Activate low-blue-light warm dark mode for all day themes (~3200K). Dedicated night templates like High Score, Terminal, and Titan are preserved."
            >
              <input
                type="checkbox"
                checked={!!a11yPrefs.warmNightMode}
                onChange={(e) => handleToggleWarmNight(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
              />
              <Moon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Warm Night Mode</span>
            </label>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export const GmailThemeModal = ThemeModal;
