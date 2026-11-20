/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-099] Chat Theme & Decoration Customizer Popover
 * Shared by both Custom Google Chat and Castor (Gemini) inside G. Comms.
 * Features:
 *  - Blend with Drive Therapy Theme vs Override Theme switch
 *  - 6 Decoration Themes (Drive Sync, Material Swatches, Sakura Glow, Midnight Lantern, Pastel Pixel, RPG Tavern)
 *  - 14 Material 3 Two-Tone Color Swatches
 *  - Comfortable / Compact Density & Ornament / Unique Backdrop toggles
 */

import React from 'react';
import { Check, Palette, Sparkles, X } from 'lucide-react';
import {
  CHAT_COLOR_SWATCHES,
  CHAT_DECORATION_PRESETS,
  type ChatDecorationPrefs,
  getChatSwatchById,
} from '../services/chatDecorationEngine';

interface ChatThemeCustomizerPopoverProps {
  isOpen: boolean;
  prefs: ChatDecorationPrefs;
  onChange: (next: ChatDecorationPrefs) => void;
  onClose: () => void;
}

export const ChatThemeCustomizerPopover: React.FC<ChatThemeCustomizerPopoverProps> = ({
  isOpen,
  prefs,
  onChange,
  onClose,
}) => {
  if (!isOpen) return null;

  const activeSwatch = getChatSwatchById(prefs.swatchId);

  return (
    <div
      className="border-b px-4 py-3.5 space-y-3.5 text-xs shrink-0 max-h-[65vh] overflow-y-auto shadow-inner animate-in fade-in duration-150"
      style={{
        backgroundColor: 'var(--theme-surface)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text)',
      }}
      role="region"
      aria-label="Chat Decoration & Appearance Settings"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold">
          <Palette className="w-4 h-4" style={{ color: 'var(--theme-accent, #1557B0)' }} />
          <span>Chat Theme &amp; Decorations</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label="Close Chat Theme Customizer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Influence Mode: Blend with Drive Therapy vs Override */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold opacity-75">Theme Relationship</span>
        <div
          className="grid grid-cols-2 p-1 rounded-xl border gap-1"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <button
            type="button"
            onClick={() => onChange({ ...prefs, influenceMode: 'blend' })}
            className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
              prefs.influenceMode === 'blend'
                ? 'bg-[#1557B0] text-white shadow-xs'
                : 'opacity-75 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {prefs.influenceMode === 'blend' && <Check className="w-3.5 h-3.5" />}
            <span>Blend with Drive Therapy</span>
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...prefs, influenceMode: 'override' })}
            className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
              prefs.influenceMode === 'override'
                ? 'bg-[#1557B0] text-white shadow-xs'
                : 'opacity-75 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {prefs.influenceMode === 'override' && <Check className="w-3.5 h-3.5" />}
            <span>Override Theme</span>
          </button>
        </div>
      </div>

      {/* Decoration Theme Cards */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold opacity-75">Decoration Theme (Castor &amp; Google Chat)</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CHAT_DECORATION_PRESETS.map((preset) => {
            const active = prefs.decorationId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  onChange({
                    ...prefs,
                    decorationId: preset.id,
                    influenceMode:
                      preset.id === 'drive-sync' ? 'blend' : prefs.influenceMode,
                  })
                }
                className={`p-2 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                  active
                    ? 'ring-2 ring-[#1557B0] border-[#1557B0] shadow-xs'
                    : 'hover:brightness-105 opacity-90 hover:opacity-100'
                }`}
                style={{ borderColor: active ? undefined : 'var(--theme-border)' }}
              >
                <div
                  className="h-7 w-full rounded-lg flex items-center justify-between px-2"
                  style={{ background: preset.previewGradient }}
                >
                  {preset.hasOrnaments && <Sparkles className="w-3 h-3 text-white drop-shadow" />}
                  {active && (
                    <span className="ml-auto w-4 h-4 rounded-full bg-white text-[#1557B0] flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold truncate">{preset.name}</div>
                  <div className="text-[10px] opacity-65 line-clamp-1">{preset.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Material 3 Two-Tone Color Swatches (14 colors) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold opacity-75">
            Color: <span style={{ color: activeSwatch.primary }}>{activeSwatch.name}</span>
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {CHAT_COLOR_SWATCHES.map((swatch) => {
            const selected = prefs.swatchId === swatch.id;
            return (
              <button
                key={swatch.id}
                type="button"
                onClick={() => onChange({ ...prefs, swatchId: swatch.id })}
                title={swatch.name}
                aria-label={`Chat accent color ${swatch.name}`}
                aria-pressed={selected}
                className={`h-10 rounded-xl flex items-center justify-center border transition-transform ${
                  selected
                    ? 'border-slate-900 dark:border-white scale-105 ring-2 ring-[#1557B0]/40'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: 'rgba(var(--theme-surface-rgb, 240, 244, 248), 0.7)' }}
              >
                <span
                  className="w-6 h-6 rounded-full overflow-hidden border border-black/10 block shadow-2xs"
                  style={{
                    background: `linear-gradient(180deg, ${swatch.primary} 50%, ${swatch.soft} 50%)`,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Density & Feature Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t" style={{ borderColor: 'var(--theme-border)' }}>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold opacity-75 mr-1">Density:</span>
          {(['comfortable', 'compact'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onChange({ ...prefs, density: d })}
              className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize border transition-colors ${
                prefs.density === d
                  ? 'bg-[#1557B0] text-white border-[#1557B0]'
                  : 'opacity-75 hover:opacity-100'
              }`}
              style={{ borderColor: prefs.density === d ? undefined : 'var(--theme-border)' }}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold">
            <input
              type="checkbox"
              checked={prefs.showOrnaments}
              onChange={(e) => onChange({ ...prefs, showOrnaments: e.target.checked })}
              className="rounded accent-[#1557B0]"
            />
            <span>Ornaments</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold">
            <input
              type="checkbox"
              checked={prefs.showUniqueBackdrop}
              onChange={(e) => onChange({ ...prefs, showUniqueBackdrop: e.target.checked })}
              className="rounded accent-[#1557B0]"
            />
            <span>Chat Backdrop</span>
          </label>
        </div>
      </div>
    </div>
  );
};
