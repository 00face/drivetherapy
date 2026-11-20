/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Traditional Google Workspace Top Menu Bar (File, Edit, View, Workspace, Tools, Help)
 * Designed for desktop, tiling window managers (i3/Sway/Hyprland), GNOME/KDE, Windows/macOS,
 * and portable Electron builds. Keyboard-dismissible (Escape) and non-blocking.
 */

import React, { useEffect, useState } from 'react';
import { ChevronDown, Menu } from 'lucide-react';
import { ViewMode } from '../types';

export interface WorkspaceMenuBarProps {
  onImportLocalFolder: () => void;
  onQuickScan: () => void;
  onDeepScan: () => void;
  onSyncChanges: () => void;
  onOpenBatchExport: () => void;
  onToggleSidebar: () => void;
  onToggleDarkMode: () => void;
  onSelectMode: (mode: ViewMode) => void;
  onOpenWorkspaceHub: () => void;
  onOpenFavorites: () => void;
  onOpenStudio: () => void;
  onOpenOAuthWizard: () => void;
  onOpenDiagnostics: () => void;
  onOpenButler: () => void;
  onOpenSettings: () => void;
  onOpenTour: () => void;
  onOpenFormatDb: () => void;
  onOpenLogs: () => void;
  onOpenFullDiagnostic: () => void;
  onOpenCodex: () => void;
  onOpenShortcuts: () => void;
}

type MenuKey = 'file' | 'edit' | 'view' | 'workspace' | 'tools' | 'help';

interface MenuItemSpec {
  label: string;
  shortcut?: string;
  action: () => void;
  dividerBefore?: boolean;
}

export const WorkspaceMenuBar: React.FC<WorkspaceMenuBarProps> = (props) => {
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openMenu]);

  const menus: Record<MenuKey, { label: string; items: MenuItemSpec[] }> = {
    file: {
      label: 'File',
      items: [
        { label: 'Mount Local OS Folder...', action: props.onImportLocalFolder },
        { label: 'Quick 300 Drive Scan', action: props.onQuickScan, dividerBefore: true },
        { label: 'Deep Drive Scan', action: props.onDeepScan },
        { label: 'Batch Export / Portfolio...', action: props.onOpenBatchExport, dividerBefore: true },
      ],
    },
    edit: {
      label: 'Edit',
      items: [
        { label: 'Storage & Local CPU Models...', action: props.onOpenSettings },
        { label: 'Toggle Day / Night Theme', action: props.onToggleDarkMode },
      ],
    },
    view: {
      label: 'View',
      items: [
        { label: 'Asset Grid', action: () => props.onSelectMode('files') },
        { label: 'Drive Browser', action: () => props.onSelectMode('drive-browser') },
        { label: 'Google Photos', action: () => props.onSelectMode('google-photos') },
        { label: 'Photo Review (Culling)', action: () => props.onSelectMode('culling') },
        { label: 'World Map Studio', action: () => props.onSelectMode('map') },
        { label: 'Toggle Folders Drawer', shortcut: 'B', action: props.onToggleSidebar, dividerBefore: true },
      ],
    },
    workspace: {
      label: 'Workspace',
      items: [
        { label: 'Sync Drive Changes (Delta)', action: props.onSyncChanges },
        { label: 'Google Workspace Hub (Keep/Gmail/Tasks)', action: props.onOpenWorkspaceHub },
        { label: 'Google Favorites Launcher', action: props.onOpenFavorites },
        { label: 'Google Studio Workbench', action: props.onOpenStudio },
        { label: 'Butler Concierge & User Options', shortcut: 'Shift+B', action: props.onOpenButler, dividerBefore: true },
        { label: 'OAuth 2.0 Setup Wizard', action: props.onOpenOAuthWizard },
        { label: 'API Status & Free Services', action: props.onOpenDiagnostics },
      ],
    },
    tools: {
      label: 'Tools',
      items: [
        { label: 'Interactive Studio Tour', action: props.onOpenTour },
        { label: 'Format DB (310 Formats)', action: props.onOpenFormatDb },
        { label: 'QA Diagnostics & Logs', action: props.onOpenLogs },
        { label: 'Full Diagnostic Sweep (!)', action: props.onOpenFullDiagnostic, dividerBefore: true },
      ],
    },
    help: {
      label: 'Help',
      items: [
        { label: 'Drive Therapy Codex (?)', action: props.onOpenCodex },
        { label: 'Keyboard & Vim Shortcuts', shortcut: '?', action: props.onOpenShortcuts },
      ],
    },
  };

  return (
    <div
      className="w-full h-7 px-3 border-b border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-2 text-[11px] select-none shrink-0 z-40"
      style={{
        backgroundColor: 'var(--theme-surface)',
        color: 'var(--theme-text)',
      }}
      role="menubar"
      aria-label="Workspace Menu Bar"
    >
      <div className="flex items-center gap-0.5 overflow-x-auto">
        <span className="hidden sm:inline-flex items-center gap-1 pr-2 mr-1 font-bold opacity-70 border-r border-slate-300/60 dark:border-slate-700/60">
          <Menu className="w-3 h-3" />
          <span>Drive Therapy</span>
        </span>
        {(Object.keys(menus) as MenuKey[]).map((key) => {
          const isOpen = openMenu === key;
          return (
            <div key={key} className="relative">
              <button
                type="button"
                role="menuitem"
                aria-expanded={isOpen}
                onClick={() => setOpenMenu(isOpen ? null : key)}
                className={`px-2 py-0.5 rounded-md font-medium flex items-center gap-0.5 transition-colors ${
                  isOpen
                    ? 'bg-[#1074B1] text-white'
                    : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <span>{menus[key].label}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60 sm:hidden" />
              </button>

              {isOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                  <div
                    className="absolute left-0 mt-1 w-64 rounded-xl border shadow-2xl p-1 z-50 dt-drawer-enter"
                    style={{
                      backgroundColor: 'var(--theme-surface)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text)',
                    }}
                    role="menu"
                  >
                    {menus[key].items.map((item, idx) => (
                      <React.Fragment key={idx}>
                        {item.dividerBefore && (
                          <div className="my-1 border-t border-slate-200/70 dark:border-slate-800/70" />
                        )}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setOpenMenu(null);
                            item.action();
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-[#1074B1] hover:text-white flex items-center justify-between gap-2 text-xs font-medium transition-colors"
                        >
                          <span>{item.label}</span>
                          {item.shortcut && (
                            <kbd className="text-[10px] font-mono opacity-65">{item.shortcut}</kbd>
                          )}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <span className="hidden md:inline text-[10px] font-mono opacity-50">
        Workspace · Portable Ready
      </span>
    </div>
  );
};
