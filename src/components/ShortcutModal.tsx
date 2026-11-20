/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Global Keyboard Shortcut Cheat-Sheet Modal (Attachment 1 Architecture - A+ Tier)
 * Accessible WCAG 2.2 AAA modal triggered by pressing '?' or clicking help.
 */

import React from 'react';
import { X, Keyboard, Zap, Play, Crop, Layers } from 'lucide-react';

interface ShortcutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutModal: React.FC<ShortcutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const sections = [
    {
      title: 'Photo Mechanic Speed Culling',
      icon: <Zap className="w-4 h-4 text-[#52B197]" />,
      shortcuts: [
        { key: 'P', label: 'Pick / Keep active photo' },
        { key: 'X', label: 'Reject / Dim active photo' },
        { key: 'U', label: 'Clear culling status' },
        { key: '1 - 5', label: 'Assign 1 to 5 star rating' },
        { key: '6 - 9', label: 'Assign Color Label (Red, Yellow, Green, Blue)' },
        { key: '0', label: 'Clear Color Label' },
        { key: 'C', label: 'Toggle Side-by-Side Dual Split Loupe' },
        { key: 'Space', label: 'Toggle 100% Zoom Loupe at cursor' },
        { key: '← / →', label: 'Previous / Next candidate photo' },
        { key: '⌘ / Ctrl + A', label: 'Select all photos in view' },
        { key: 'Esc', label: 'Clear multi-selection' },
      ],
    },
    {
      title: 'Cinematic Slideshow Theater',
      icon: <Play className="w-4 h-4 text-[#1074B1]" />,
      shortcuts: [
        { key: 'Space', label: 'Play / Pause slideshow' },
        { key: '← / →', label: 'Previous / Next slide' },
        { key: 'F', label: 'Toggle Fullscreen Mode' },
      ],
    },
    {
      title: 'Pixel Studio & Darkroom',
      icon: <Crop className="w-4 h-4 text-[#BEBF61]" />,
      shortcuts: [
        { key: 'Hold Click', label: 'Hold eye icon for unedited original' },
        { key: 'Rule of 3rds', label: 'Automatic AI focal crop' },
        { key: 'Horizon', label: '±45° micro horizon leveling slider' },
      ],
    },
    {
      title: 'Global Navigation',
      icon: <Layers className="w-4 h-4 text-[#403993]" />,
      shortcuts: [
        { key: '?', label: 'Open this shortcut reference modal' },
        { key: 'Drop Files', label: 'Drop folders anywhere onto the workspace' },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-title"
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#131B2C] border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 shadow-2xl space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1074B1]/15 text-[#1074B1] flex items-center justify-center">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 id="shortcut-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                Workstation Hotkey Reference
              </h2>
              <p className="text-xs text-slate-400">
                High-speed keyboard shortcuts for Photo Mechanic workflows
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close shortcuts modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto pr-1">
          {sections.map((sec, idx) => (
            <div key={idx} className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                {sec.icon}
                <span>{sec.title}</span>
              </h3>
              <div className="space-y-1.5">
                {sec.shortcuts.map((sc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50"
                  >
                    <span className="text-slate-600 dark:text-slate-300 text-[11px]">{sc.label}</span>
                    <kbd className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-mono font-bold text-slate-800 dark:text-slate-100 text-[11px] shadow-xs tabular-nums">
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-3 text-center">
          <p className="text-[11px] text-slate-400 font-mono">
            Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border text-slate-600 dark:text-slate-300">Esc</kbd> or click outside to dismiss.
          </p>
        </div>
      </div>
    </div>
  );
};
