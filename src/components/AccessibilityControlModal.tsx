/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Accessibility & Sensory Control Center Modal
 * Comprehensive WCAG 2.2 AAA & ADDI Home Office compliance controls:
 * - High Contrast (AAA) & Low-Glare Warm reading palettes
 * - Dyslexia-friendly typography toggle (Lexend / OpenDyslexic)
 * - Text scale controls (100%, 115%, 130%)
 * - Calm Sensory / Reduced Motion mode (Autism Spectrum ease)
 * - Procedural Vim keyboard navigation toggle
 */

import React from 'react';
import {
  X,
  Sun,
  Moon,
  Sparkles,
  Eye,
  Type,
  Minimize2,
  Terminal,
  CheckCircle2,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from '../i18n';
import { themeManager, AccessibilityPreferences, APP_THEMES, AreaAppearancePreferences } from '../services/themeEngine';

interface AccessibilityControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTheme: (themeId: string) => void;
  activeThemeId: string;
}

export const AccessibilityControlModal: React.FC<AccessibilityControlModalProps> = ({
  isOpen,
  onClose,
  onApplyTheme,
  activeThemeId,
}) => {
  const { t } = useTranslation();
  const [prefs, setPrefs] = React.useState<AccessibilityPreferences>(themeManager.getA11yPrefs());
  const [areaPrefs, setAreaPrefs] = React.useState<AreaAppearancePreferences>(themeManager.getAreaPrefs());

  if (!isOpen) return null;

  const updatePref = (partial: Partial<AccessibilityPreferences>) => {
    const updated = themeManager.setA11yPrefs(partial);
    setPrefs(updated);
  };

  const updateAreaPref = (partial: Partial<AreaAppearancePreferences>) => {
    const updated = themeManager.setAreaPrefs(partial);
    setAreaPrefs(updated);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-modal-title"
    >
      <div
        className="w-full max-w-xl border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] modal-card theme-card"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#1074B1]/10 text-[#1074B1] dark:bg-[#1074B1]/25 dark:text-[#67b7e6] flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h2 id="a11y-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t('a11y.title')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                WCAG 2.2 AAA &amp; ADDI Universal Accessibility Suite
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
            aria-label="Close Accessibility Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Section 1: Contrast & Sensory Reading Themes */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              {t('a11y.contrast')}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Default Light/Dark */}
              <button
                onClick={() => onApplyTheme('default-light')}
                className={`p-3 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                  activeThemeId === 'default-light'
                    ? 'border-[#1074B1] ring-2 ring-[#1074B1]/20 bg-slate-50 dark:bg-slate-800'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="w-full h-8 rounded-lg bg-gradient-to-r from-slate-100 to-white border border-slate-200 mb-2" />
                <span className="font-semibold text-xs block text-slate-800 dark:text-slate-200">
                  {t('a11y.standard')}
                </span>
                <span className="text-[10px] text-slate-400">Balanced Light</span>
              </button>

              {/* High Contrast AAA */}
              <button
                onClick={() => onApplyTheme('high-contrast')}
                className={`p-3 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                  activeThemeId === 'high-contrast'
                    ? 'border-yellow-400 ring-2 ring-yellow-400/30 bg-black text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-black text-white hover:border-yellow-400'
                }`}
              >
                <div className="w-full h-8 rounded-lg bg-black border border-yellow-400 flex items-center justify-center mb-2">
                  <span className="text-yellow-400 font-mono font-bold text-xs">AAA 7:1</span>
                </div>
                <span className="font-semibold text-xs block text-yellow-300">
                  {t('a11y.highContrast')}
                </span>
                <span className="text-[10px] text-slate-400">Pure Black &amp; Vivid Accents</span>
              </button>

              {/* Warm Low Glare (Dyslexia / Irlen) */}
              <button
                onClick={() => onApplyTheme('warm-lowglare')}
                className={`p-3 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                  activeThemeId === 'warm-lowglare'
                    ? 'border-[#A65D20] ring-2 ring-[#A65D20]/20 bg-[#FDF6E3]'
                    : 'border-slate-200 dark:border-slate-700 bg-[#FDF6E3] hover:border-[#A65D20]'
                }`}
              >
                <div className="w-full h-8 rounded-lg bg-[#F5ECCB] border border-[#D3C8AF] mb-2" />
                <span className="font-semibold text-xs block text-[#2D2820]">
                  {t('a11y.warmLowGlare')}
                </span>
                <span className="text-[10px] text-[#7A6B54]">Soft Cream / No Glare</span>
              </button>
            </div>
          </div>

          {/* Section 2: Text Sizing */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              {t('a11y.fontSize')}
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'normal', label: t('a11y.fontNormal'), desc: '100%' },
                { id: 'large', label: t('a11y.fontLarge'), desc: '115%' },
                { id: 'xlarge', label: t('a11y.fontXLarge'), desc: '130%' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => updatePref({ fontScale: s.id as any })}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    prefs.fontScale === s.id
                      ? 'border-[#1074B1] bg-[#1074B1]/10 text-[#1074B1] font-bold shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="text-xs block">{s.label}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Neurodiversity & Cognitive Toggles */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Sensory &amp; Cognitive Preferences
            </span>
            <div className="space-y-2.5">
              {/* Dyslexia Font Toggle */}
              <label className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Type className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">
                      {t('a11y.dyslexiaFont')}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Weighted baseline, wide tracking, and generous line height for effortless reading.
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.dyslexiaFont}
                  onChange={(e) => updatePref({ dyslexiaFont: e.target.checked })}
                  className="w-5 h-5 rounded-lg text-[#1074B1] focus:ring-[#1074B1] cursor-pointer"
                />
              </label>

              {/* Calm Sensory / Reduced Motion */}
              <label className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <Minimize2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">
                      {t('a11y.calmMotion')}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Disables rotating spinners, animated pulses, and smooth sliding to prevent sensory fatigue.
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.calmMotion}
                  onChange={(e) => updatePref({ calmMotion: e.target.checked })}
                  className="w-5 h-5 rounded-lg text-[#52B197] focus:ring-[#52B197] cursor-pointer"
                />
              </label>

              {/* Warm Night Mode (~3200K) */}
              <label className="p-3.5 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/30 flex items-center justify-between cursor-pointer hover:bg-amber-500/10 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Moon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">
                      Warm Night Mode (~3200K)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Low-blue-light warm dark variant for day themes. Preserves authentic night templates (High Score, Terminal, Titan).
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={!!prefs.warmNightMode}
                  onChange={(e) => updatePref({ warmNightMode: e.target.checked })}
                  className="w-5 h-5 rounded-lg text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
              </label>

              {/* Procedural Vim Mode Toggle */}
              <label className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#1074B1]/10 text-[#1074B1] dark:text-[#67b7e6] flex items-center justify-center">
                    <Terminal className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">
                      {t('a11y.vimMode')}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Navigate with j/k/h/l, jump with gg/G, focus with /, and yank links with y without mouse.
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.vimMode}
                  onChange={(e) => updatePref({ vimMode: e.target.checked })}
                  className="w-5 h-5 rounded-lg text-[#1074B1] focus:ring-[#1074B1] cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Section 4: Text Hinting & Wallpaper Legibility */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Text Hinting &amp; Wallpaper Legibility
              </span>
              <span className="text-[10px] text-slate-400 font-mono">WCAG 2.2 Contrast Hinting</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                {
                  id: 'inset',
                  title: 'Inset (Default)',
                  desc: 'Inverted filter with inset border for max legibility across photos.',
                },
                {
                  id: 'outlined',
                  title: 'Outlined',
                  desc: 'High-contrast text stroke & multi-directional drop shadow.',
                },
                {
                  id: 'none',
                  title: 'None',
                  desc: 'Standard unhinted plain typography without filters.',
                },
              ].map((mode) => {
                const isSelected = areaPrefs.textHinting === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => updateAreaPref({ textHinting: mode.id as any })}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-[#1074B1] ring-2 ring-[#1074B1]/20 bg-[#1074B1]/10 text-[#1074B1] font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-xs block font-semibold">{mode.title}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block leading-tight">
                      {mode.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>Preferences saved locally</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#1074B1] text-white font-bold text-xs hover:bg-[#0d6296] transition-colors shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
