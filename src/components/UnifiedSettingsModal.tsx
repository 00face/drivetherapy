/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-102] AAA 2-Column Sidebar Settings Hub
 * Unifies General, Appearance & Themes, Display & Spatial Modes, Text Hinting & Accessibility,
 * Storage & Cloud Accounts, AI / Castor & Pollux, Takeout & Cloud Sync, and Privacy/Diagnostics
 * into a single searchable, ease-in/ease-out AAA Settings modal (Shortcut: Ctrl/Cmd+,).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Bot,
  Cloud,
  Database,
  Eye,
  Globe,
  Monitor,
  Palette,
  Search,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  type AccessibilityPreferences,
  type AreaAppearancePreferences,
  themeManager,
} from '../services/themeEngine';
import {
  DISPLAY_TIER_CYCLE_ORDER,
  getDisplayTierLabel,
  type DisplayTier,
} from '../services/adaptiveDisplayProfile';
import { TOP_20_LANGUAGES, useTranslation } from '../i18n';

export type SettingsSectionId =
  | 'general'
  | 'appearance'
  | 'display'
  | 'accessibility'
  | 'storage'
  | 'ai-agents'
  | 'cloud-takeout'
  | 'privacy';

interface UnifiedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  displayTier: DisplayTier | 'auto';
  onChangeDisplayTier: (tier: DisplayTier | 'auto') => void;
  onOpenThemePicker: () => void;
  onOpenLegacyStorage: () => void;
  onOpenCastorWardrobe?: () => void;
  onOpenTakeout?: () => void;
  onOpenCloudSync?: () => void;
  onOpenDiagnostics?: () => void;
}

const SECTIONS: Array<{
  id: SettingsSectionId;
  label: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'general', label: 'General & Language', keywords: 'language locale region startup general', icon: Globe },
  { id: 'appearance', label: 'Appearance & Themes', keywords: 'theme wallpaper opacity blur dark light', icon: Palette },
  { id: 'display', label: 'Display & Spatial', keywords: 'mobile tablet tv ar spatial transparent liquid glass', icon: Monitor },
  { id: 'accessibility', label: 'Typography & Hinting', keywords: 'text hinting dyslexia font scale calm motion vim', icon: Eye },
  { id: 'storage', label: 'Storage & Accounts', keywords: 'oauth drive local cache flush smart clean indexeddb', icon: Database },
  { id: 'ai-agents', label: 'AI, Castor & Pollux', keywords: 'gemini castor pollux wardrobe models local search', icon: Bot },
  { id: 'cloud-takeout', label: 'Takeout & Cloud Sync', keywords: 'takeout multicloud dropbox onedrive s3 sync', icon: Cloud },
  { id: 'privacy', label: 'Privacy & Diagnostics', keywords: 'security loopback aegis logs diagnostics reset', icon: ShieldCheck },
];

export const UnifiedSettingsModal: React.FC<UnifiedSettingsModalProps> = ({
  isOpen,
  onClose,
  displayTier,
  onChangeDisplayTier,
  onOpenThemePicker,
  onOpenLegacyStorage,
  onOpenCastorWardrobe,
  onOpenTakeout,
  onOpenCloudSync,
  onOpenDiagnostics,
}) => {
  const { currentLanguage, setLanguage } = useTranslation();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [a11yPrefs, setA11yPrefs] = useState<AccessibilityPreferences>(() => themeManager.getA11yPrefs());
  const [areaPrefs, setAreaPrefs] = useState<AreaAppearancePreferences>(() => themeManager.getAreaPrefs());

  useEffect(() => {
    if (!isOpen) return;
    setA11yPrefs(themeManager.getA11yPrefs());
    setAreaPrefs(themeManager.getAreaPrefs());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter(
      (s) => s.label.toLowerCase().includes(q) || s.keywords.includes(q)
    );
  }, [searchQuery]);

  if (!isOpen) return null;

  const updateA11y = (partial: Partial<AccessibilityPreferences>) => {
    const next = themeManager.setA11yPrefs(partial);
    setA11yPrefs(next);
  };

  const updateArea = (partial: Partial<AreaAppearancePreferences>) => {
    const next = themeManager.setAreaPrefs(partial);
    setAreaPrefs(next);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Drive Therapy Settings Hub"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-4 bg-black/60 backdrop-blur-sm dt-motion-fade"
      onClick={onClose}
    >
      <div
        className="w-full lg:w-[calc(100vw-2rem)] xl:w-[calc(100vw-3rem)] max-w-none h-[92vh] max-h-none rounded-2xl lg:rounded-3xl border shadow-2xl overflow-hidden flex flex-col sm:flex-row dt-motion-modal"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Navigation Sidebar */}
        <aside
          className="w-full sm:w-64 lg:w-72 xl:w-80 border-b sm:border-b-0 sm:border-r p-3.5 lg:p-5 flex flex-col gap-3 shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 font-extrabold text-sm">
              <Settings className="w-4 h-4 text-[#1557B0] dark:text-sky-400" />
              <span>Settings</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10"
              aria-label="Close Settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 opacity-55" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings..."
              className="w-full min-h-[38px] pl-8 pr-3 py-1.5 rounded-xl border text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-[#1557B0]"
              style={{ borderColor: 'var(--theme-border)' }}
            />
          </div>

          <nav className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-y-auto no-scrollbar">
            {filteredSections.map((sec) => {
              const Icon = sec.icon;
              const active = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 whitespace-nowrap transition-all shrink-0 ${
                    active
                      ? 'bg-[#1557B0] text-white shadow-xs'
                      : 'opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{sec.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Detail Pane */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div
            className="px-6 py-4 border-b flex items-center justify-between gap-2 shrink-0"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <div>
              <h2 className="text-base font-extrabold">
                {SECTIONS.find((s) => s.id === activeSection)?.label}
              </h2>
              <p className="text-[11px] opacity-65">
                Changes apply immediately and persist locally across sessions.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="hidden sm:flex min-h-[40px] min-w-[40px] rounded-xl items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              aria-label="Close Settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
            {activeSection === 'general' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl border space-y-3" style={{ borderColor: 'var(--theme-border)' }}>
                  <div className="font-bold text-sm">Language &amp; Region (20 Locales)</div>
                  <p className="opacity-70">Choose your interface language. Arabic (ar) and Urdu (ur) enable native RTL layout.</p>
                  <select
                    value={currentLanguage}
                    onChange={(e) => setLanguage(e.target.value as any)}
                    className="w-full max-w-xs min-h-[44px] px-3 rounded-xl border font-semibold bg-transparent"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    {TOP_20_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                        {lang.nativeName} ({lang.name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {activeSection === 'appearance' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl border flex items-center justify-between gap-3" style={{ borderColor: 'var(--theme-border)' }}>
                  <div>
                    <div className="font-bold text-sm">Theme &amp; Wallpaper Gallery (79+ Presets)</div>
                    <p className="opacity-70">Browse Google Originals, Gemini Design, Earth View Slideshow, Classic Gmail &amp; Titan themes.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenThemePicker();
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1557B0] hover:bg-[#10468f] text-white font-bold shrink-0"
                  >
                    Open Theme Gallery
                  </button>
                </div>

                <div className="p-4 rounded-2xl border space-y-3" style={{ borderColor: 'var(--theme-border)' }}>
                  <div className="font-bold text-sm flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#1557B0] dark:text-sky-400" />
                    <span>Stage Glass Opacity &amp; Blur</span>
                  </div>
                  <label className="block space-y-1">
                    <div className="flex justify-between">
                      <span>Main Stage Opacity</span>
                      <span className="font-mono tabular-nums">{Math.round(areaPrefs.mainOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={areaPrefs.mainOpacity}
                      onChange={(e) => updateArea({ mainOpacity: parseFloat(e.target.value) })}
                      className="w-full accent-[#1557B0]"
                    />
                  </label>
                  <label className="block space-y-1">
                    <div className="flex justify-between">
                      <span>Backdrop Blur</span>
                      <span className="font-mono tabular-nums">{areaPrefs.mainBlur}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={24}
                      step={1}
                      value={areaPrefs.mainBlur}
                      onChange={(e) => updateArea({ mainBlur: parseInt(e.target.value, 10) })}
                      className="w-full accent-[#1557B0]"
                    />
                  </label>
                </div>
              </div>
            )}

            {activeSection === 'display' && (
              <div className="p-4 rounded-2xl border space-y-3" style={{ borderColor: 'var(--theme-border)' }}>
                <div className="font-bold text-sm">Adaptive Multi-Device &amp; Spatial Display Profile</div>
                <p className="opacity-70">
                  Optimize hit targets, typography, and optical translucency for Small Screens, Phones, Tablets, Desktops, 4K Large Format, 10-ft TVs, AR Spatial (visionOS/XR), or Transparent OLED Liquid Glass displays.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DISPLAY_TIER_CYCLE_ORDER.map((tier) => {
                    const active = displayTier === tier;
                    return (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => onChangeDisplayTier(tier)}
                        className={`min-h-[44px] px-3 py-2 rounded-xl border font-bold text-left transition-all ${
                          active
                            ? 'bg-[#1557B0] text-white border-[#1557B0] shadow-xs'
                            : 'hover:bg-black/5 dark:hover:bg-white/10'
                        }`}
                        style={active ? undefined : { borderColor: 'var(--theme-border)' }}
                      >
                        {getDisplayTierLabel(tier)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeSection === 'accessibility' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl border space-y-3" style={{ borderColor: 'var(--theme-border)' }}>
                  <div className="font-bold text-sm">Optical Text Hinting</div>
                  <p className="opacity-70">
                    Choose how text contrasts over rich wallpapers and transparent glass surfaces.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'inset', label: 'Optical Scrim', desc: 'Frosted pill backing' },
                        { id: 'outlined', label: 'Soft Halo', desc: 'Sub-pixel shadow' },
                        { id: 'none', label: 'Crisp Native', desc: 'Zero overlay' },
                      ] as const
                    ).map((opt) => {
                      const active = areaPrefs.textHinting === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateArea({ textHinting: opt.id })}
                          className={`min-h-[52px] p-2.5 rounded-xl border text-left transition-all ${
                            active ? 'bg-[#1557B0] text-white border-[#1557B0]' : 'hover:bg-black/5 dark:hover:bg-white/10'
                          }`}
                          style={active ? undefined : { borderColor: 'var(--theme-border)' }}
                        >
                          <div className="font-bold">{opt.label}</div>
                          <div className="text-[10px] opacity-80">{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border space-y-3" style={{ borderColor: 'var(--theme-border)' }}>
                  <div className="font-bold text-sm">Typography &amp; Sensory Comfort</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['normal', 'large', 'xlarge'] as const).map((scale) => (
                      <button
                        key={scale}
                        type="button"
                        onClick={() => updateA11y({ fontScale: scale })}
                        className={`min-h-[40px] rounded-xl border font-bold capitalize ${
                          a11yPrefs.fontScale === scale ? 'bg-[#1557B0] text-white border-[#1557B0]' : ''
                        }`}
                        style={a11yPrefs.fontScale === scale ? undefined : { borderColor: 'var(--theme-border)' }}
                      >
                        {scale}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center justify-between min-h-[40px] cursor-pointer">
                    <span className="font-semibold">Dyslexia-Friendly Font (Lexend / OpenDyslexic)</span>
                    <input
                      type="checkbox"
                      checked={a11yPrefs.dyslexiaFont}
                      onChange={(e) => updateA11y({ dyslexiaFont: e.target.checked })}
                      className="w-4 h-4 accent-[#1557B0]"
                    />
                  </label>
                  <label className="flex items-center justify-between min-h-[40px] cursor-pointer">
                    <span className="font-semibold">Calm Motion (Pauses animations &amp; slideshows)</span>
                    <input
                      type="checkbox"
                      checked={a11yPrefs.calmMotion}
                      onChange={(e) => updateA11y({ calmMotion: e.target.checked })}
                      className="w-4 h-4 accent-[#1557B0]"
                    />
                  </label>
                  <label className="flex items-center justify-between min-h-[40px] cursor-pointer">
                    <span className="font-semibold">Procedural Vim Keyboard Navigation (j/k/gg/G)</span>
                    <input
                      type="checkbox"
                      checked={a11yPrefs.vimMode}
                      onChange={(e) => updateA11y({ vimMode: e.target.checked })}
                      className="w-4 h-4 accent-[#1557B0]"
                    />
                  </label>
                </div>
              </div>
            )}

            {activeSection === 'storage' && (
              <div className="p-4 rounded-2xl border space-y-3" style={{ borderColor: 'var(--theme-border)' }}>
                <div className="font-bold text-sm">Storage, Multi-Account OAuth &amp; Local Cache Manager</div>
                <p className="opacity-70">
                  Inspect IndexedDB record counts, switch Google Workspace accounts, manage mounted host folders, or run Smart Clean.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLegacyStorage();
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1557B0] hover:bg-[#10468f] text-white font-bold inline-flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Open Storage &amp; Cache Controls</span>
                </button>
              </div>
            )}

            {activeSection === 'ai-agents' && (
              <div className="p-4 rounded-2xl border space-y-3" style={{ borderColor: 'var(--theme-border)' }}>
                <div className="font-bold text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#1557B0] dark:text-sky-400" />
                  <span>Castor (Gemini Chat) &amp; Pollux (Tours &amp; Walkthroughs)</span>
                </div>
                <p className="opacity-70">
                  Both Castor (24 outfits × 16 expressions) and Pollux now use individual sliced transparent PNG sprites with zero-key local fallback.
                </p>
                {onOpenCastorWardrobe && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCastorWardrobe();
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1557B0] hover:bg-[#10468f] text-white font-bold"
                  >
                    Open Castor 24-Outfit Wardrobe
                  </button>
                )}
              </div>
            )}

            {activeSection === 'cloud-takeout' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl border space-y-2.5" style={{ borderColor: 'var(--theme-border)' }}>
                  <div className="font-bold text-sm flex items-center gap-2">
                    <Archive className="w-4 h-4 text-[#1557B0] dark:text-sky-400" />
                    <span>Google Takeout Studio</span>
                  </div>
                  <p className="opacity-70">Repair photo sidecars, deduplicate exports, and scrub secrets with Aegis Shield.</p>
                  {onOpenTakeout && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenTakeout();
                      }}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1557B0] text-white font-bold"
                    >
                      Launch Takeout Studio
                    </button>
                  )}
                </div>
                <div className="p-4 rounded-2xl border space-y-2.5" style={{ borderColor: 'var(--theme-border)' }}>
                  <div className="font-bold text-sm flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-emerald-500" />
                    <span>Cloud-to-Cloud Sync Hub</span>
                  </div>
                  <p className="opacity-70">Direct Google Photos → Drive transfer and external cloud connectors.</p>
                  {onOpenCloudSync && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCloudSync();
                      }}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-bold"
                    >
                      Launch Cloud Sync Hub
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'privacy' && (
              <div className="p-4 rounded-2xl border space-y-3" style={{ borderColor: 'var(--theme-border)' }}>
                <div className="font-bold text-sm">Security Posture &amp; Diagnostics</div>
                <ul className="space-y-1.5 opacity-80 list-disc pl-4">
                  <li>All local OS filesystem APIs strictly enforce loopback-only access.</li>
                  <li>Zero <code className="px-1 rounded bg-black/10 dark:bg-white/10">dangerouslySetInnerHTML</code> across the UI; HTML previews render in zero-script sandboxed iframes.</li>
                  <li>Original cloud and host files are never mutated automatically.</li>
                </ul>
                {onOpenDiagnostics && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenDiagnostics();
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl border font-bold hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    Open Full Diagnostics &amp; OAuth Inspector
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
