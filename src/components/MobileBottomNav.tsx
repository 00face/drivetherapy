/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-106] Compact Mobile Bottom Navigation Bar (< 640px)
 * Gives phone / compact-touch users one-thumb WCAG AAA (>= 44px) access to core studios + Castor.
 */

import React from 'react';
import { Camera, Cloud, FolderKanban, Globe, Sparkles } from 'lucide-react';
import type { ViewMode } from '../types';

interface MobileBottomNavProps {
  currentMode: ViewMode;
  onSelectMode: (mode: ViewMode) => void;
  onToggleCopilot: () => void;
  isCopilotOpen: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentMode,
  onSelectMode,
  onToggleCopilot,
  isCopilotOpen,
}) => {
  const items: Array<{ id: ViewMode; label: string; icon: React.ReactNode }> = [
    { id: 'files', label: 'Files', icon: <FolderKanban className="w-4 h-4" /> },
    { id: 'drive-browser', label: 'Drive', icon: <Cloud className="w-4 h-4" /> },
    { id: 'google-photos', label: 'Photos', icon: <Camera className="w-4 h-4" /> },
    { id: 'external-clouds', label: 'Clouds', icon: <Globe className="w-4 h-4" /> },
  ];

  return (
    <nav
      aria-label="Mobile Studio Navigation"
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t px-2 py-1 flex items-center justify-around backdrop-blur-md"
      style={{
        backgroundColor: 'rgba(var(--theme-surface-rgb, 15, 23, 42), 0.92)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text)',
      }}
    >
      {items.map((item) => {
        const active = currentMode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectMode(item.id)}
            aria-current={active ? 'page' : undefined}
            className={`min-h-[44px] min-w-[52px] px-2 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors ${
              active ? 'text-[#1074B1] dark:text-sky-300 bg-[#1074B1]/15' : 'opacity-75'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onToggleCopilot}
        aria-pressed={isCopilotOpen}
        className={`min-h-[44px] min-w-[52px] px-2 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors ${
          isCopilotOpen ? 'text-violet-500 bg-violet-500/15' : 'opacity-75'
        }`}
      >
        <Sparkles className="w-4 h-4" />
        <span>Castor</span>
      </button>
    </nav>
  );
};
