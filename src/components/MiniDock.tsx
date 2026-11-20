/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Far-left Navigation Dock (Attachment 1 Architecture)
 * Supports expandable state with theme-adaptive high-contrast labels,
 * centered icon alignment, About modal trigger, i18n localization, and persistent user preference.
 */

import React, { useState } from 'react';
import {
  FolderKanban,
  SlidersHorizontal,
  Sparkles,
  Crop,
  Layers,
  PlayCircle,
  Server,
  Cloud,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Compass,
  Camera,
  FolderOpen,
  Database,
  Archive,
  FolderSync,
  Globe,
} from 'lucide-react';
import { ViewMode } from '../types';
import { useTranslation } from '../i18n';

interface MiniDockProps {
  currentMode: ViewMode;
  onSelectMode: (mode: ViewMode) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  cloudConnected: boolean;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
  onOpenCopilot?: () => void;
  driveQuotaPercent?: number;
  onOpenEcosystemHub?: () => void;
  onToggleStorageDrawer?: () => void;
  isStorageDrawerOpen?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onOpenStudio?: () => void;
}

export const MiniDock: React.FC<MiniDockProps> = ({
  currentMode,
  onSelectMode,
  cloudConnected,
  onOpenAbout,
  driveQuotaPercent = 0,
  onOpenEcosystemHub,
  onToggleStorageDrawer,
  isStorageDrawerOpen = false,
  onExpandedChange,
  onOpenStudio,
}) => {
  const { t } = useTranslation();

  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dt_dock_expanded_v1') === 'true';
    } catch {
      return false;
    }
  });

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('dt_dock_expanded_v1', String(next));
      } catch {}
      onExpandedChange?.(next);
      return next;
    });
  };

  const navGroups: {
    id: string;
    label: string;
    items: { mode: ViewMode; labelKey: string; fallbackLabel?: string; icon: React.ReactNode }[];
  }[] = [
    {
      id: 'browse',
      label: 'Browse',
      items: [
        { mode: 'files', labelKey: 'nav.files', icon: <FolderKanban className="w-5 h-5 shrink-0" /> },
        { mode: 'drive-browser', labelKey: 'nav.driveBrowser', icon: <Cloud className="w-5 h-5 shrink-0" /> },
        { mode: 'google-photos', labelKey: 'nav.googlePhotos', fallbackLabel: 'Google Photos', icon: <Camera className="w-5 h-5 shrink-0" /> },
        { mode: 'local-files', labelKey: 'nav.localFiles', icon: <Monitor className="w-5 h-5 shrink-0" /> },
      ],
    },
    {
      id: 'studio',
      label: 'Studio',
      items: [
        { mode: 'culling', labelKey: 'nav.culling', icon: <SlidersHorizontal className="w-5 h-5 shrink-0" /> },
        { mode: 'editor', labelKey: 'nav.editor', icon: <Crop className="w-5 h-5 shrink-0" /> },
        { mode: 'vision', labelKey: 'nav.vision', icon: <Sparkles className="w-5 h-5 shrink-0" /> },
        { mode: 'portfolio', labelKey: 'nav.portfolio', icon: <Layers className="w-5 h-5 shrink-0" /> },
        { mode: 'slideshow', labelKey: 'nav.slideshow', icon: <PlayCircle className="w-5 h-5 shrink-0" /> },
      ],
    },
    {
      id: 'system',
      label: 'Explore & Sync',
      items: [
        { mode: 'takeout', labelKey: 'nav.takeout', fallbackLabel: 'Google Takeout', icon: <Archive className="w-5 h-5 shrink-0" /> },
        { mode: 'cloud-sync', labelKey: 'nav.cloudSync', fallbackLabel: 'Cloud-to-Cloud Sync', icon: <FolderSync className="w-5 h-5 shrink-0" /> },
        { mode: 'external-clouds', labelKey: 'nav.externalClouds', fallbackLabel: 'External Clouds', icon: <Globe className="w-5 h-5 shrink-0" /> },
        { mode: 'map', labelKey: 'nav.map', icon: <Compass className="w-5 h-5 shrink-0" /> },
        { mode: 'providers', labelKey: 'nav.providers', icon: <Server className="w-5 h-5 shrink-0" /> },
      ],
    },
  ];

  return (
    <aside
      className={`dock-container ${
        isExpanded ? 'dock-expanded w-56 px-3' : 'dock-collapsed w-16 px-2'
      } shrink-0 border-r flex flex-col py-3 justify-between z-20 shadow-sm transition-[width,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] select-none h-full overflow-hidden`}
      style={{
        backgroundColor: 'var(--theme-surface)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text)',
      }}
      aria-label={t('aria.navigation')}
    >
      {/* Top Header / App Brand */}
      <div className="shrink-0 flex flex-col gap-2 pb-2 border-b" style={{ borderColor: 'var(--theme-border)' }}>
        <div
          className={`flex items-center ${
            isExpanded ? 'justify-between px-1 gap-2' : 'flex-col justify-center gap-2'
          }`}
        >
          <div className={`flex items-center ${isExpanded ? 'gap-2.5 min-w-0' : 'justify-center'}`}>
            <button
              onClick={onOpenAbout || (() => onSelectMode('files'))}
              className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#403993] via-[#1074B1] to-[#52B197] flex items-center justify-center text-white font-extrabold text-sm shadow-md hover:opacity-95 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1] shrink-0"
              title="About Drive Therapy & Walkthrough"
              aria-label="About Drive Therapy & Walkthrough"
            >
              DT
            </button>
            {isExpanded && (
              <span
                className="font-bold text-sm tracking-tight truncate cursor-pointer hover:opacity-80 transition-opacity"
                style={{ color: 'var(--theme-text)' }}
                onClick={onOpenAbout}
                title="About Drive Therapy"
              >
                {t('app.title')}
              </span>
            )}
          </div>

          <button
            onClick={toggleExpanded}
            className={`rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors opacity-75 hover:opacity-100 flex items-center justify-center shrink-0 ${
              isExpanded ? 'w-9 h-9' : 'w-11 h-9 mx-auto'
            }`}
            style={{ color: 'var(--theme-text)' }}
            title={isExpanded ? t('nav.collapse') : t('nav.expand')}
            aria-label={isExpanded ? t('nav.collapse') : t('nav.expand')}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Primary View Mode Switchers - Scrollable, Grouped & Centered */}
      <nav
        className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-2 py-2"
        aria-label={t('aria.workstation')}
      >
        {navGroups.map((group, groupIdx) => (
          <div key={group.id} className="flex flex-col gap-1">
            {groupIdx > 0 && (
              <div
                className={`${isExpanded ? 'mx-2 my-1' : 'mx-auto w-7 my-1'} h-px opacity-60`}
                style={{ backgroundColor: 'var(--theme-border)' }}
                role="separator"
              />
            )}
            {isExpanded && (
              <span className="px-2.5 pt-0.5 text-[10px] font-bold uppercase tracking-wider opacity-50">
                {group.label}
              </span>
            )}
            {group.items.map((item) => {
              const isActive = currentMode === item.mode;
              const translated = t(item.labelKey);
              const labelText = translated === item.labelKey && item.fallbackLabel ? item.fallbackLabel : translated;
              return (
                <button
                  key={item.mode}
                  onClick={() => onSelectMode(item.mode)}
                  data-active={isActive}
                  className={`dock-nav-item min-h-[44px] rounded-xl flex items-center transition-colors relative ${
                    isExpanded ? 'w-full px-2.5 justify-start' : 'w-11 h-11 justify-center mx-auto'
                  } ${
                    isActive
                      ? 'dock-item-active bg-[#1074B1] text-white shadow-md font-bold'
                      : 'hover:bg-black/5 dark:hover:bg-white/10 font-semibold'
                  }`}
                  style={{
                    color: isActive ? '#ffffff' : 'var(--theme-text)',
                  }}
                  title={labelText}
                  aria-label={labelText}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {/* Radiant active indicator on the leading edge */}
                  {isActive && (
                    <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] bg-white rounded-r-full shadow-xs" />
                  )}
                  <div
                    className={`flex items-center min-w-0 ${
                      isExpanded ? 'gap-2.5 w-full justify-start' : 'justify-center'
                    }`}
                  >
                    <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
                      {item.icon}
                      {item.mode === 'drive-browser' && (
                        <>
                          <span
                            className={`absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full border border-white dark:border-slate-900 ${
                              cloudConnected ? 'bg-emerald-500' : 'bg-[#A61B7A]'
                            }`}
                            aria-hidden="true"
                          />
                          <span
                            className="absolute -bottom-2 -right-2.5 px-1 min-w-[18px] h-3.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[8px] font-mono font-extrabold flex items-center justify-center shadow-xs"
                            aria-hidden="true"
                          >
                            {Math.round(driveQuotaPercent)}%
                          </span>
                        </>
                      )}
                    </div>
                    {isExpanded && (
                      <span
                        className="dock-nav-label text-xs font-semibold truncate text-left flex-1"
                        style={{ color: isActive ? '#ffffff' : 'var(--theme-text)' }}
                      >
                        {labelText}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}

        {/* Unified Storage Drawer, Google Studio & Workspace Hub Triggers */}
        <div className="flex flex-col gap-1 pt-2 border-t" style={{ borderColor: 'var(--theme-border)' }}>
          {onOpenStudio && (
            <button
              type="button"
              onClick={onOpenStudio}
              className={`min-h-[44px] rounded-xl flex items-center transition-colors hover:bg-black/5 dark:hover:bg-white/10 font-semibold ${
                isExpanded ? 'w-full px-2.5 justify-start gap-2.5' : 'w-11 h-11 justify-center mx-auto'
              }`}
              title="Google Studio Workbench (AI Studio, Apps Script & Looker Studio)"
              aria-label="Open Google Studio"
            >
              <Sparkles className="w-5 h-5 text-[#8B5CF6] shrink-0" />
              {isExpanded && <span className="dock-nav-label text-xs truncate">Studio</span>}
            </button>
          )}
          {onToggleStorageDrawer && (
            <button
              type="button"
              onClick={onToggleStorageDrawer}
              className={`min-h-[44px] rounded-xl flex items-center transition-colors ${
                isExpanded ? 'w-full px-2.5 justify-start gap-2.5' : 'w-11 h-11 justify-center mx-auto'
              } ${
                isStorageDrawerOpen
                  ? 'bg-[#1074B1]/15 text-[#1074B1] font-bold'
                  : 'hover:bg-black/5 dark:hover:bg-white/10 font-semibold'
              }`}
              title="Toggle Storage & Folders Drawer (B)"
              aria-label="Toggle Storage and Folders Drawer"
            >
              <FolderOpen className="w-5 h-5 text-[#1074B1] shrink-0" />
              {isExpanded && <span className="dock-nav-label text-xs truncate">Folders &amp; Storage</span>}
            </button>
          )}
          {onOpenEcosystemHub && (
            <button
              type="button"
              onClick={onOpenEcosystemHub}
              className={`min-h-[44px] rounded-xl flex items-center transition-colors hover:bg-black/5 dark:hover:bg-white/10 font-semibold ${
                isExpanded ? 'w-full px-2.5 justify-start gap-2.5' : 'w-11 h-11 justify-center mx-auto'
              }`}
              title="Google Workspace Hub (Keep · Gmail · Tasks · Classroom · GCS · Takeout)"
              aria-label="Open Google Workspace Hub"
            >
              <Database className="w-5 h-5 text-[#52B197] shrink-0" />
              {isExpanded && <span className="dock-nav-label text-xs truncate">Workspace Hub</span>}
            </button>
          )}
        </div>
      </nav>
    </aside>
  );
};
