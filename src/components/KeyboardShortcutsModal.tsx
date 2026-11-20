/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Procedural Keyboard & Vim Navigation Palette Modal
 * Displays complete keyboard and procedural Vim shortcuts for mouse-free
 * high-speed catalog navigation, culling, and inspection.
 */

import React from 'react';
import { X, Keyboard, Terminal, Zap, Search, Eye } from 'lucide-react';
import { useTranslation } from '../i18n';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isVimEnabled: boolean;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  isVimEnabled,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const sections = [
    {
      title: t('shortcuts.navigation'),
      icon: <Terminal className="w-4 h-4 text-[#1074B1]" />,
      shortcuts: [
        { key: 'j  or  ↓', desc: t('shortcuts.vimNext') },
        { key: 'k  or  ↑', desc: t('shortcuts.vimPrev') },
        { key: 'h  or  ←', desc: 'Select left item in grid' },
        { key: 'l  or  →', desc: 'Select right item in grid' },
        { key: 'gg', desc: t('shortcuts.vimTop') },
        { key: 'G', desc: t('shortcuts.vimBottom') },
        { key: '/', desc: t('shortcuts.vimSearch') },
        { key: 'y', desc: t('shortcuts.vimYank') },
      ],
    },
    {
      title: t('shortcuts.culling'),
      icon: <Zap className="w-4 h-4 text-[#52B197]" />,
      shortcuts: [
        { key: 'p', desc: t('shortcuts.pick') },
        { key: 'x  or  d', desc: t('shortcuts.reject') },
        { key: 'u', desc: 'Clear rating / unrate photo' },
        { key: '1 - 5', desc: t('shortcuts.rating') },
        { key: 'Space / z', desc: t('shortcuts.loupe') },
        { key: 'c', desc: t('shortcuts.compare') },
      ],
    },
    {
      title: 'General & Studio',
      icon: <Eye className="w-4 h-4 text-purple-500" />,
      shortcuts: [
        { key: '?', desc: 'Toggle this keyboard shortcut palette' },
        { key: 'Esc', desc: 'Close open dialogs or unfocus search' },
        { key: 'Enter', desc: 'Open full-size lightbox preview' },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
    >
      <div
        className="w-full max-w-2xl border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] modal-card theme-card"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#52B197]/15 text-[#52B197] flex items-center justify-center">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="shortcuts-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {t('shortcuts.title')}
                </h2>
                {isVimEnabled && (
                  <span className="px-2 py-0.5 rounded-md bg-[#1074B1] text-white text-[10px] font-mono font-bold">
                    VIM ACTIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Speed shortcuts for rapid motor-free navigation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
            aria-label="Close Shortcuts Palette"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {sections.map((sec) => (
            <div key={sec.title} className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                {sec.icon}
                <span>{sec.title}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sec.shortcuts.map((sc) => (
                  <div
                    key={sc.key}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
                      {sc.desc}
                    </span>
                    <kbd className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono font-bold text-[11px] shrink-0 shadow-2xs">
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 text-xs text-slate-500">
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border font-mono">Esc</kbd> anytime to dismiss</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#52B197] text-white font-bold text-xs hover:bg-[#459c84] transition-colors shadow-xs"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
