/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Quick Access Media Ribbon (Attachment 1 Architecture)
 */

import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Camera,
  Video,
  Music,
  Archive,
  FileText,
  Download,
  FilterX,
  Zap,
  RefreshCw,
  X,
  LayoutGrid,
  ChevronDown,
  Compass,
  Monitor,
  Terminal,
  Database,
} from 'lucide-react';
import { MediaCategory } from '../types';
import { useTranslation } from '../i18n';
import { CodexHelpBadge } from './CodexHelpBadge';
import { CodexTopicId } from '../services/codexContent';
import {
  DISPLAY_TIER_CYCLE_ORDER,
  getDisplayTierLabel,
  type DisplayTier,
} from '../services/adaptiveDisplayProfile';

interface QuickAccessRibbonProps {
  selectedCategory: MediaCategory | 'all';
  onSelectCategory: (category: MediaCategory | 'all') => void;
  categoryCounts: Record<string, number>;
  variant?: 'cards' | 'secondary-header';
  onQuickScan?: () => void;
  onDeepScan?: () => void;
  isScanning?: boolean;
  scanType?: 'quick' | 'deep' | 'folder' | 'delta' | null;
  cloudConnected?: boolean;
  onCancelScan?: () => void;
  onOpenTour?: () => void;
  onOpenLogs?: () => void;
  onOpenFormatDb?: () => void;
  displayTier?: DisplayTier | 'auto';
  onChangeDisplayTier?: (tier: DisplayTier | 'auto') => void;
  onOpenCodex?: (topicId?: CodexTopicId) => void;
}

export const QuickAccessRibbon: React.FC<QuickAccessRibbonProps> = ({
  selectedCategory,
  onSelectCategory,
  categoryCounts,
  variant = 'secondary-header',
  onQuickScan,
  onDeepScan,
  isScanning = false,
  scanType = null,
  cloudConnected = false,
  onCancelScan,
  onOpenTour,
  onOpenLogs,
  onOpenFormatDb,
  displayTier = 'auto',
  onChangeDisplayTier,
  onOpenCodex,
}) => {
  const { t } = useTranslation();
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const categories: {
    id: MediaCategory | 'all';
    label: string;
    icon: React.ReactNode;
    colorBg: string;
    colorText: string;
  }[] = [
    {
      id: 'image',
      label: t('filter.images'),
      icon: <ImageIcon className="w-3.5 h-3.5" />,
      colorBg: 'bg-[#403993]/10 dark:bg-[#403993]/25',
      colorText: 'text-[#403993] dark:text-[#a59eed]',
    },
    {
      id: 'raw',
      label: t('filter.raw'),
      icon: <Camera className="w-3.5 h-3.5" />,
      colorBg: 'bg-[#52B197]/10 dark:bg-[#52B197]/25',
      colorText: 'text-[#52B197] dark:text-[#8ee1cc]',
    },
    {
      id: 'video',
      label: t('filter.videos'),
      icon: <Video className="w-3.5 h-3.5" />,
      colorBg: 'bg-[#A61B7A]/10 dark:bg-[#A61B7A]/25',
      colorText: 'text-[#A61B7A] dark:text-[#f485d1]',
    },
    {
      id: 'audio',
      label: t('filter.audio'),
      icon: <Music className="w-3.5 h-3.5" />,
      colorBg: 'bg-[#BEBF61]/15 dark:bg-[#BEBF61]/25',
      colorText: 'text-[#8a8b29] dark:text-[#dcdd7a]',
    },
    {
      id: 'archive',
      label: t('filter.archive'),
      icon: <Archive className="w-3.5 h-3.5" />,
      colorBg: 'bg-[#1074B1]/10 dark:bg-[#1074B1]/25',
      colorText: 'text-[#1074B1] dark:text-[#67b7e6]',
    },
    {
      id: 'document',
      label: t('filter.document'),
      icon: <FileText className="w-3.5 h-3.5" />,
      colorBg: 'bg-slate-200/60 dark:bg-slate-700/60',
      colorText: 'text-slate-700 dark:text-slate-200',
    },
  ];

  if (variant === 'secondary-header') {
    return (
      <div
        className="relative z-20 secondary-header-container w-full px-3 sm:px-4 py-1.5 border-b flex items-center justify-between gap-1.5 shrink-0 select-none text-xs"
        style={{
          backgroundColor: 'rgba(var(--theme-surface-rgb, 255, 255, 255), 0.78)',
          borderColor: 'var(--theme-border, rgba(226, 232, 240, 0.7))',
          color: 'var(--theme-text, inherit)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
        role="navigation"
        aria-label="Quick Access Media Filters"
      >
        {/* Responsive Zero-Scroll Filter Strip (adapts labels cleanly to viewport width) */}
        <div className="flex items-center flex-wrap sm:flex-nowrap gap-1 flex-1 min-w-0">
          {/* Quick 300 Scan & Deep Scan Controls */}
          {(onQuickScan || onDeepScan) && (
            <div
              className="flex items-center gap-1 shrink-0 mr-1 pr-1.5 border-r"
              style={{ borderColor: 'var(--theme-border, rgba(148, 163, 184, 0.35))' }}
            >
              {onQuickScan && (
                <button
                  type="button"
                  onClick={onQuickScan}
                  disabled={isScanning}
                  data-active={isScanning && scanType === 'quick' ? 'true' : undefined}
                  className={`min-h-[32px] px-2 py-1 rounded-lg flex items-center gap-1 border font-bold transition-colors shrink-0 ${
                    isScanning && scanType === 'quick'
                      ? 'bg-[#52B197] text-white border-[#52B197]'
                      : 'border-[#52B197]/45 bg-[#52B197]/15 text-[#1f6b56] dark:text-[#8ee1cc] hover:bg-[#52B197]/25'
                  } disabled:opacity-60`}
                  title={cloudConnected ? 'Quick Scan: Index latest 300 Drive items' : 'Quick 300 Scan (Connect Drive first)'}
                  aria-label="Quick 300 Scan"
                >
                  <Zap className={`w-3.5 h-3.5 shrink-0 ${isScanning && scanType === 'quick' ? 'animate-pulse' : ''}`} />
                  <span className="hidden lg:inline">Quick 300</span>
                </button>
              )}
              {onDeepScan && (
                <button
                  type="button"
                  onClick={onDeepScan}
                  disabled={isScanning}
                  data-active={isScanning && scanType === 'deep' ? 'true' : undefined}
                  className={`min-h-[32px] px-2 py-1 rounded-lg flex items-center gap-1 border font-bold transition-colors shrink-0 ${
                    isScanning && scanType === 'deep'
                      ? 'bg-[#1074B1] text-white border-[#1074B1]'
                      : 'border-[#1074B1]/45 bg-[#1074B1]/15 text-[#0c5a8a] dark:text-[#7cc4f0] hover:bg-[#1074B1]/25'
                  } disabled:opacity-60`}
                  title={cloudConnected ? 'Deep Scan: Index entire Google Drive without item limits' : 'Deep Scan (Connect Drive first)'}
                  aria-label="Deep Scan"
                >
                  <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isScanning && scanType === 'deep' ? 'animate-spin' : ''}`} />
                  <span className="hidden lg:inline">Deep Scan</span>
                </button>
              )}
              {isScanning && onCancelScan && (
                <button
                  type="button"
                  onClick={onCancelScan}
                  className="min-h-[32px] px-2 py-1 rounded-lg border border-rose-400/60 bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25 font-bold flex items-center gap-1 shrink-0"
                  title="Cancel Active Scan"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Stop</span>
                </button>
              )}
            </div>
          )}

          <span className="hidden 2xl:inline text-[10px] font-bold uppercase tracking-wider opacity-70 mr-1 shrink-0">
            {t('ribbon.title')}
          </span>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                data-active={isActive ? 'true' : undefined}
                onClick={() => onSelectCategory(isActive ? 'all' : cat.id)}
                title={`${cat.label} (${categoryCounts[cat.id] || 0})`}
                aria-label={`${cat.label} (${categoryCounts[cat.id] || 0})`}
                className={`min-h-[32px] px-2 py-1 rounded-lg flex items-center gap-1 border transition-colors shrink-0 ${
                  isActive
                    ? 'bg-[#1074B1] text-white border-[#1074B1] font-bold shadow-2xs'
                    : 'border-transparent hover:bg-black/10 dark:hover:bg-white/10 font-semibold'
                }`}
                style={
                  isActive
                    ? undefined
                    : { color: 'var(--theme-text, inherit)' }
                }
              >
                <span className={isActive ? 'text-white' : cat.colorText}>{cat.icon}</span>
                <span className="hidden xl:inline">{cat.label}</span>
                <span className={`text-[10px] font-mono tabular-nums ${isActive ? 'opacity-90' : 'opacity-70'}`}>
                  {categoryCounts[cat.id] || 0}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            data-active={selectedCategory === 'all' ? 'true' : undefined}
            onClick={() => onSelectCategory('all')}
            title={`${t('ribbon.allTypes')} (${categoryCounts.all || 0})`}
            aria-label={`${t('ribbon.allTypes')} (${categoryCounts.all || 0})`}
            className={`min-h-[32px] px-2 py-1 rounded-lg flex items-center gap-1 border transition-colors shrink-0 ml-auto ${
              selectedCategory === 'all'
                ? 'bg-[#1074B1]/15 text-[#0c5a8a] dark:text-sky-300 border-[#1074B1]/45 font-bold'
                : 'border-transparent hover:bg-black/10 dark:hover:bg-white/10 font-semibold opacity-85'
            }`}
          >
            <span className="hidden md:inline">{t('ribbon.allTypes')}</span>
            <span className="text-[10px] font-mono tabular-nums opacity-80">{categoryCounts.all || 0}</span>
          </button>
        </div>

        {/* Right Controls: Studio Tools Dropdown & Help Badge (outside overflow-x-auto so dropdown never clips) */}
        <div className="flex items-center gap-1.5 shrink-0">
        {(onOpenTour || onChangeDisplayTier || onOpenLogs || onOpenFormatDb) && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsToolsMenuOpen((v) => !v)}
              className="min-h-[32px] px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all shrink-0 hover:brightness-110"
              style={{
                backgroundColor: 'var(--theme-surface)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text)',
              }}
              aria-label="Open Studio Tools Menu"
              aria-expanded={isToolsMenuOpen}
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--theme-accent, #1074B1)' }} />
              <span>Tools</span>
              <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
            </button>

            {isToolsMenuOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsToolsMenuOpen(false)} />
                <div
                  className="absolute right-0 mt-2 w-64 rounded-2xl shadow-2xl p-2 z-50 text-xs border space-y-1 dt-drawer-enter"
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                >
                  {onOpenTour && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onOpenTour();
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2 font-semibold"
                    >
                      <Compass className="w-4 h-4 text-[#52B197]" />
                      <span>App Tour &amp; Guides</span>
                    </button>
                  )}
                  {onChangeDisplayTier && (
                    <button
                      type="button"
                      onClick={() => {
                        const order = DISPLAY_TIER_CYCLE_ORDER;
                        const currentIdx = order.indexOf(displayTier);
                        const next = order[(currentIdx + 1) % order.length];
                        onChangeDisplayTier(next);
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between font-semibold"
                    >
                      <span className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-[#1074B1]" />
                        <span>Display Mode</span>
                      </span>
                      <span className="text-[10px] font-bold uppercase text-[#1074B1] dark:text-sky-300">
                        {getDisplayTierLabel(displayTier)}
                      </span>
                    </button>
                  )}
                  {onOpenLogs && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onOpenLogs();
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2 font-semibold"
                    >
                      <Terminal className="w-4 h-4 text-cyan-500" />
                      <span>QA Diagnostics &amp; Logs</span>
                    </button>
                  )}
                  {onOpenFormatDb && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onOpenFormatDb();
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2 font-semibold"
                    >
                      <Database className="w-4 h-4 text-[#1074B1]" />
                      <span>Format DB (310 Formats)</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <CodexHelpBadge topicId="quick-access" onOpenCodex={(id) => onOpenCodex?.(id)} />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3.5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          {t('ribbon.title')}
        </h2>
        {selectedCategory !== 'all' && (
          <button
            onClick={() => onSelectCategory('all')}
            className="text-xs text-[#1074B1] hover:underline flex items-center gap-1 font-medium"
          >
            <FilterX className="w-3 h-3" />
            <span>{t('ribbon.showAll', { count: categoryCounts.all || 0 })}</span>
          </button>
        )}
      </div>

      <div className="ribbon-categories-grid">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const count = categoryCounts[cat.id] || 0;

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(isSelected ? 'all' : cat.id)}
              data-active={isSelected}
              className={`min-h-[72px] py-2.5 px-2.5 rounded-xl flex flex-col items-center justify-center gap-1.5 border transition-all active:scale-[0.98] quick-access-card ${
                isSelected
                  ? 'border-[var(--theme-accent,#1074B1)] bg-[var(--theme-accent,#1074B1)]/15 shadow-sm ring-2 ring-[var(--theme-accent,#1074B1)]/30 font-bold'
                  : 'hover:border-[var(--theme-accent,#1074B1)] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cat.colorBg} ${cat.colorText}`}>
                {cat.icon}
              </div>
              <div className="text-center w-full min-w-0">
                <span className="block text-xs font-bold ui-card-title leading-tight">
                  {cat.label}
                </span>
                <span className="block text-[10px] font-mono ui-card-meta mt-0.5 tabular-nums">
                  {t('ribbon.itemCount', { count })}
                </span>
              </div>
            </button>
          );
        })}

        {/* Clear / All button */}
        <button
          onClick={() => onSelectCategory('all')}
          data-active={selectedCategory === 'all'}
          className={`min-h-[72px] py-2.5 px-2.5 rounded-xl flex flex-col items-center justify-center gap-1.5 border border-dashed transition-all active:scale-[0.98] quick-access-card ${
            selectedCategory === 'all'
              ? 'bg-[var(--theme-accent,#1074B1)]/15 border-[var(--theme-accent,#1074B1)] text-[var(--theme-accent,#1074B1)] ring-2 ring-[var(--theme-accent,#1074B1)]/30 font-bold'
              : 'border-slate-300 dark:border-slate-700 hover:border-[var(--theme-accent,#1074B1)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <div className="w-7 h-7 rounded-lg border border-dashed border-current flex items-center justify-center shrink-0">
            <span className="text-xs font-bold leading-none">∞</span>
          </div>
          <span className="text-xs font-bold ui-card-title">{t('filter.all')}</span>
        </button>
      </div>
    </div>
  );
};
