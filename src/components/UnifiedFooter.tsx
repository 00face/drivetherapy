/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unified Scalable Footer Dock
 * Adaptive responsive footer providing catalog metrics, centralized active scan HUD,
 * Theme switcher, Top 20 language selector, RTL/Vertical typography toggles, and QA shortcuts.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cloud,
  Palette,
  Globe,
  RefreshCw,
  Terminal,
  CheckCircle2,
  ChevronUp,
  Sparkles,
  HelpCircle,
  Eye,
  ShieldCheck,
  Bell,
  Clock,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Music,
  Disc3,
  PictureInPicture2,
  Search,
  X,
  SlidersHorizontal,
  FileText,
  FolderOpen,
  Sun,
  Moon,
} from 'lucide-react';
import { useTranslation, TOP_20_LANGUAGES } from '../i18n';
import { themeManager } from '../services/themeEngine';
import { useNotificationEngine } from '../services/notificationEngine';
import { googleMusicEngine, GoogleMusicState } from '../services/googleMusicEngine';
import { MediaAsset } from '../types';
import { searchUniversalConsole, UniversalSearchResult } from '../services/universalConsoleSearch';
import { loadKeepNotes } from '../services/keepNotesEngine';
import { loadCachedGoogleTasks } from '../services/googleTasksEngine';
import { loadCachedGoogleContacts } from '../services/googleContacts';

interface UnifiedFooterProps {
  totalAssetsCount: number;
  driveQuota?: {
    limit: number;
    usage: number;
    percentage: number;
    usageInDrive?: number;
  };
  hasChangesSnapshot?: boolean;
  isScanning?: boolean;
  scanStatus?: {
    phase: string;
    progress: number;
    count: number;
    rate: number;
    message: string;
  };
  onCancelScan?: () => void;
  onOpenLogs?: () => void;
  onOpenThemeModal: () => void;
  onOpenA11yModal?: () => void;
  onOpenShortcuts: () => void;
  isVimActive?: boolean;
  onToggleVim?: () => void;
  fontScale?: 'normal' | 'large' | 'xlarge';
  onFontScaleChange?: (scale: 'normal' | 'large' | 'xlarge') => void;
  onOpenNotifications?: () => void;
  onOpenCalendar?: () => void;
  onOpenGoogleMusic?: () => void;
  onOpenButler?: () => void;
  isPipActive?: boolean;
  onTogglePip?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchMode?: 'text' | 'semantic';
  onToggleSearchMode?: () => void;
  assets?: MediaAsset[];
  onExecuteConsoleAction?: (actionId: string, asset?: MediaAsset) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  userPhotoUrl?: string | null;
  userDisplayName?: string | null;
  onOpenPeopleView?: () => void;
}

export const UnifiedFooter: React.FC<UnifiedFooterProps> = ({
  totalAssetsCount,
  driveQuota,
  hasChangesSnapshot,
  isScanning = false,
  scanStatus,
  onCancelScan,
  onOpenLogs,
  onOpenThemeModal,
  onOpenA11yModal,
  onOpenShortcuts,
  isVimActive = false,
  onToggleVim,
  fontScale,
  onFontScaleChange,
  onOpenNotifications,
  onOpenCalendar,
  onOpenGoogleMusic,
  onOpenButler,
  isPipActive = false,
  onTogglePip,
  searchQuery = '',
  onSearchChange,
  searchMode = 'text',
  onToggleSearchMode,
  assets = [],
  onExecuteConsoleAction,
  isDarkMode = false,
  onToggleDarkMode,
  userPhotoUrl,
  userDisplayName,
  onOpenPeopleView,
}) => {
  const { unreadCount, priorityFlag, busyCount } = useNotificationEngine();
  const [musicState, setMusicState] = useState<GoogleMusicState>(() => googleMusicEngine.getState());

  useEffect(() => {
    const unsub = googleMusicEngine.subscribe((state) => {
      setMusicState(state);
    });
    return () => unsub();
  }, []);
  const {
    t,
    currentLanguage,
    setLanguage,
    isRtl,
    isVertical,
    supportsVerticalType,
    toggleVertical,
  } = useTranslation();

  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [currentFontScale, setCurrentFontScale] = useState<'normal' | 'large' | 'xlarge'>(
    () => fontScale || themeManager.getA11yPrefs().fontScale || 'normal'
  );

  useEffect(() => {
    if (fontScale) {
      setCurrentFontScale(fontScale);
    }
  }, [fontScale]);

  const handleStepFontScale = (direction: 'up' | 'down') => {
    const active = fontScale || currentFontScale;
    let next: 'normal' | 'large' | 'xlarge' = active;
    if (direction === 'up') {
      if (active === 'normal') next = 'large';
      else if (active === 'large') next = 'xlarge';
    } else {
      if (active === 'xlarge') next = 'large';
      else if (active === 'large') next = 'normal';
    }
    if (next !== active) {
      themeManager.setA11yPrefs({ fontScale: next });
      setCurrentFontScale(next);
      onFontScaleChange?.(next);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 GB';
    return `${(bytes / (1024 ** 3)).toFixed(1)} GB`;
  };

  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [activeResultIdx, setActiveResultIdx] = useState(0);
  const [resourceLimit, setResourceLimit] = useState(6);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [advType, setAdvType] = useState('any');
  const [advOwner, setAdvOwner] = useState('anyone');
  const [advWords, setAdvWords] = useState('');
  const [advItemName, setAdvItemName] = useState('');
  const [advLocation, setAdvLocation] = useState('anywhere');
  const [aiSources, setAiSources] = useState<{ drive: boolean; gmail: boolean; chat: boolean; photos: boolean; local: boolean }>(() => {
    try {
      const saved = localStorage.getItem('dt_ai_search_sources_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { drive: true, gmail: true, chat: false, photos: true, local: true };
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toggleAiSource = (key: keyof typeof aiSources) => {
    setAiSources((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('dt_ai_search_sources_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const applyAdvancedSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSearchChange) return;
    const tokens: string[] = [];
    if (advType !== 'any') tokens.push(`type:${advType}`);
    if (advLocation !== 'anywhere') tokens.push(`source:${advLocation}`);
    if (advOwner === 'me') tokens.push('owner:me');
    if (advWords.trim()) tokens.push(advWords.trim());
    if (advItemName.trim()) tokens.push(advItemName.trim());
    onSearchChange(tokens.join(' '));
    setIsFilterPopoverOpen(false);
    setIsConsoleOpen(true);
  };

  const dynamicPeopleFaces = useMemo(() => {
    const seen = new Map<string, { label: string; thumb?: string }>();
    for (const a of assets) {
      const faces = (a as any).faces || (a as any).faceLabels || [];
      if (Array.isArray(faces)) {
        for (const f of faces) {
          const label = typeof f === 'string' ? f : f?.name || f?.label;
          if (label && !seen.has(label)) {
            seen.set(label, { label, thumb: a.thumbnailUrl });
          }
          if (seen.size >= 5) break;
        }
      }
      if (seen.size >= 5) break;
    }
    return Array.from(seen.values());
  }, [assets]);

  const consoleResults = useMemo(() => {
    return searchUniversalConsole(searchQuery, {
      assets,
      keepNotes: loadKeepNotes(),
      tasks: loadCachedGoogleTasks(),
      contacts: loadCachedGoogleContacts(),
      resourceLimit,
    });
  }, [searchQuery, assets, resourceLimit]);

  const flatResults = useMemo(
    () => [...consoleResults.topResults, ...consoleResults.resources],
    [consoleResults]
  );

  const handleSelectConsoleResult = (item: UniversalSearchResult) => {
    setIsConsoleOpen(false);
    onExecuteConsoleAction?.(item.actionId, item.asset);
  };

  const toggleAtomicToken = (token: string) => {
    if (!onSearchChange) return;
    const parts = searchQuery.trim().split(/\s+/).filter(Boolean);
    const exists = parts.some((p) => p.toLowerCase() === token.toLowerCase());
    const next = exists
      ? parts.filter((p) => p.toLowerCase() !== token.toLowerCase()).join(' ')
      : [...parts, token].join(' ');
    onSearchChange(next);
    setIsConsoleOpen(true);
    searchInputRef.current?.focus();
  };

  const handleOmnibarKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsConsoleOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsConsoleOpen(true);
      setActiveResultIdx((i) => Math.min(Math.max(0, flatResults.length - 1), i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveResultIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter' && isConsoleOpen && flatResults[activeResultIdx]) {
      e.preventDefault();
      handleSelectConsoleResult(flatResults[activeResultIdx]);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <footer
      className="group/footer relative w-full min-h-[48px] py-1.5 border-t border-slate-200/80 dark:border-slate-800/80 px-3 sm:px-5 flex items-center justify-between gap-2.5 text-xs text-slate-600 dark:text-slate-300 shrink-0 z-40 select-none transition-colors duration-200 unified-footer-container"
      role="contentinfo"
      aria-label="Application Status and Universal Search Footer"
    >
      {/* 1. Left: Live Clock & Catalog Stats */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0 max-w-[42%] xl:max-w-none">
        {/* Left-Justified Live Clock Button (Google Calendar Integration) */}
        <button
          onClick={onOpenCalendar}
          className="flex items-center gap-1.5 px-2 py-1 rounded-xl border transition-all hover:opacity-90 active:scale-95 text-xs font-semibold shadow-xs sidebar-opaque-card shrink-0"
          style={{
            backgroundColor: 'var(--theme-surface)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text)',
          }}
          title="Current Time · Click to open Google Calendar schedule & shoot milestones"
          aria-label="Current Time and Calendar Schedule"
        >
          <Clock className="w-3.5 h-3.5 text-[#1074B1] shrink-0" />
          <span className="font-mono text-[11px] sm:text-xs font-bold">{timeString}</span>
        </button>

        {/* Butler Concierge Cockpit Launcher */}
        {onOpenButler && (
          <button
            onClick={onOpenButler}
            className="flex items-center gap-1.5 px-2 py-1 rounded-xl border transition-all hover:opacity-90 active:scale-95 text-xs font-semibold shadow-xs sidebar-opaque-card shrink-0"
            style={{
              backgroundColor: 'var(--theme-surface)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text)',
            }}
            title="Butler Concierge (Shift+B) · Google Services & User Options"
            aria-label="Butler Concierge"
          >
            {userPhotoUrl ? (
              <img
                src={userPhotoUrl}
                alt={userDisplayName || 'User Avatar'}
                className="w-4 h-4 rounded-full object-cover shrink-0 border border-[#1074B1]/50"
                referrerPolicy="no-referrer"
              />
            ) : userDisplayName ? (
              <span className="w-4 h-4 rounded-full bg-[#1074B1] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                {userDisplayName[0].toUpperCase()}
              </span>
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )}
            <span className="hidden xl:inline text-[11px] font-bold">
              {userDisplayName ? userDisplayName.split(' ')[0] : 'Butler'}
            </span>
          </button>
        )}

        {/* Catalog Stats & Storage Telemetry */}
        <div
          className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0 px-2 py-1 rounded-xl border sidebar-opaque-card"
          style={{
            backgroundColor: 'var(--theme-surface)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text)',
          }}
          data-tooltip={t('footer.catalogItems', { count: totalAssetsCount.toLocaleString() })}
          data-tooltip-align="left"
        >
          <div className="flex items-center gap-1.5 font-semibold truncate" style={{ color: 'var(--theme-text)' }}>
            <Cloud className="w-3.5 h-3.5 text-[#1074B1] shrink-0" />
            <span className="truncate text-[11px] sm:text-xs">
              {t('footer.catalogItems', { count: totalAssetsCount.toLocaleString() })}
            </span>
          </div>

          {driveQuota && (
            <div className="hidden md:flex items-center gap-1 text-[11px] opacity-80">
              <span>•</span>
              <span className="truncate">
                {formatSize(driveQuota.usage)} / {formatSize(driveQuota.limit)} ({driveQuota.percentage}%)
              </span>
            </div>
          )}

          {hasChangesSnapshot && (
            <div
              className="hidden xl:flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0"
              title={t('footer.deltaSync')}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden 2xl:inline">{t('footer.deltaSync')}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Center: Footer-Docked Universal Search Omnibar + Active Scan HUD */}
      <div className="flex items-center justify-center flex-1 min-w-[200px] max-w-2xl mx-2 gap-2">
        {onSearchChange && (
          <div className="relative flex-1 min-w-[180px] flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setIsConsoleOpen(true)}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setIsConsoleOpen(true);
                setActiveResultIdx(0);
              }}
              onKeyDown={handleOmnibarKeyDown}
              placeholder={
                searchMode === 'semantic'
                  ? t('header.searchPlaceholderAi')
                  : 'Search files, features, settings, formats (source:drive ext:mp4)...'
              }
              style={{
                backgroundColor: 'var(--theme-surface)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text)',
              }}
              className="w-full min-h-[36px] pl-8 pr-32 py-1 text-xs rounded-xl border focus:border-[#1074B1] placeholder-slate-400 focus:outline-none transition-all shadow-xs"
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('');
                    setActiveResultIdx(0);
                    searchInputRef.current?.focus();
                  }}
                  className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-slate-400"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              {onToggleSearchMode && (
                <button
                  type="button"
                  onClick={onToggleSearchMode}
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                    searchMode === 'semantic'
                      ? 'bg-[#1074B1] text-white'
                      : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                  title="Toggle Text / AI Search"
                >
                  {searchMode === 'semantic' ? '✨ AI' : '🔍'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsFilterPopoverOpen((v) => !v)}
                className={`p-1 rounded-md transition-colors ${
                  isFilterPopoverOpen ? 'bg-[#1074B1] text-white' : 'hover:bg-black/10 dark:hover:bg-white/10 text-slate-500'
                }`}
                title="Advanced Drive Search, AI Overview Sources & People Filters"
                aria-label="Open Search Filters"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsConsoleOpen((v) => !v)}
                className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#1074B1]/15 hover:bg-[#1074B1]/25 text-[#1074B1] text-[10px] font-bold"
              >
                <Search className="w-3 h-3" />
                <span>Search</span>
              </button>
            </div>

            {/* Drive Advanced Search, AI Overview Sources & People Circles Popover */}
            {isFilterPopoverOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsFilterPopoverOpen(false)} />
                <div
                  className="absolute left-0 right-0 bottom-full mb-2 rounded-2xl border shadow-2xl z-50 p-4 text-xs space-y-3 dt-drawer-enter"
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                >
                  <form onSubmit={applyAdvancedSearch} className="space-y-2">
                    <div className="flex items-center justify-between font-bold">
                      <span>Advanced Search</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAdvType('any');
                          setAdvOwner('anyone');
                          setAdvWords('');
                          setAdvItemName('');
                          setAdvLocation('anywhere');
                          onSearchChange('');
                        }}
                        className="text-[11px] text-[#1074B1] hover:underline"
                      >
                        Reset
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={advType}
                        onChange={(e) => setAdvType(e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                        aria-label="Filter by Type"
                      >
                        <option value="any">Type: Any</option>
                        <option value="image">Images</option>
                        <option value="raw">RAW</option>
                        <option value="video">Videos</option>
                        <option value="audio">Audio</option>
                        <option value="document">Documents</option>
                      </select>
                      <select
                        value={advLocation}
                        onChange={(e) => setAdvLocation(e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                        aria-label="Filter by Location"
                      >
                        <option value="anywhere">Location: Anywhere</option>
                        <option value="drive">Google Drive</option>
                        <option value="photos">Google Photos</option>
                        <option value="local">Local OS</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={advWords}
                        onChange={(e) => setAdvWords(e.target.value)}
                        placeholder="Has the words..."
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                      />
                      <input
                        type="text"
                        value={advItemName}
                        onChange={(e) => setAdvItemName(e.target.value)}
                        placeholder="Item name..."
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[10px] font-bold opacity-60 mr-1">AI Sources:</span>
                        {(['drive', 'gmail', 'chat', 'photos', 'local'] as const).map((src) => (
                          <button
                            key={src}
                            type="button"
                            onClick={() => toggleAiSource(src)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize border ${
                              aiSources[src]
                                ? 'bg-[#52B197]/15 text-[#52B197] border-[#52B197]/40'
                                : 'opacity-45 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {src}
                          </button>
                        ))}
                      </div>
                      <button
                        type="submit"
                        className="px-3 py-1 rounded-lg bg-[#1074B1] text-white font-bold shrink-0"
                      >
                        Search
                      </button>
                    </div>
                  </form>

                  {/* People Circles Filter (Dynamic from indexed faces) */}
                  <div className="pt-2 border-t flex items-center justify-between gap-2" style={{ borderColor: 'var(--theme-border)' }}>
                    <div className="flex items-center gap-2 overflow-x-auto">
                      {dynamicPeopleFaces.length > 0 ? (
                        dynamicPeopleFaces.map((f) => (
                          <button
                            key={f.label}
                            type="button"
                            onClick={() => {
                              onSearchChange(f.label);
                              setIsFilterPopoverOpen(false);
                            }}
                            className="flex flex-col items-center gap-0.5 shrink-0"
                            title={`Filter by ${f.label}`}
                          >
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-[#1074B1] bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                              {f.thumb ? <img src={f.thumb} alt={f.label} className="w-full h-full object-cover" /> : f.label[0]}
                            </div>
                          </button>
                        ))
                      ) : (
                        <span className="text-[11px] opacity-60">Index photos to surface People circles</span>
                      )}
                    </div>
                    {onOpenPeopleView && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsFilterPopoverOpen(false);
                          onOpenPeopleView();
                        }}
                        className="text-[11px] font-bold text-[#1074B1] hover:underline shrink-0"
                      >
                        See all people →
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {isConsoleOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsConsoleOpen(false)} />
                <div
                  className="absolute left-0 right-0 bottom-full mb-2 rounded-2xl border shadow-2xl z-50 overflow-hidden text-xs max-h-[65vh] flex flex-col"
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                  role="region"
                  aria-label="Universal Search Results"
                >
                  <div className="px-3 py-2 border-b flex flex-wrap items-center gap-1.5 bg-black/5 dark:bg-white/5" style={{ borderColor: 'var(--theme-border)' }}>
                    <SlidersHorizontal className="w-3.5 h-3.5 opacity-60 shrink-0" />
                    {[
                      { label: 'Files', token: 'type:file' },
                      { label: 'Features', token: 'type:feature' },
                      { label: 'Settings', token: 'type:setting' },
                      { label: 'Drive', token: 'source:drive' },
                      { label: 'Local', token: 'source:local' },
                      { label: 'Photos', token: 'source:photos' },
                      { label: 'Workspace', token: 'type:workspace' },
                      { label: 'Picked ★', token: 'status:picked' },
                    ].map((chip) => {
                      const active = searchQuery.toLowerCase().includes(chip.token);
                      return (
                        <button
                          key={chip.token}
                          type="button"
                          onClick={() => toggleAtomicToken(chip.token)}
                          className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                            active ? 'bg-[#1074B1] text-white border-[#1074B1]' : 'hover:border-[#1074B1]'
                          }`}
                          style={active ? undefined : { borderColor: 'var(--theme-border)' }}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="overflow-y-auto p-2 space-y-3">
                    {consoleResults.topResults.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider opacity-60">
                          Top results
                        </div>
                        <div className="space-y-0.5">
                          {consoleResults.topResults.map((item, idx) => {
                            const selected = idx === activeResultIdx;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectConsoleResult(item)}
                                className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-left flex items-center justify-between gap-3 transition-colors border ${
                                  selected
                                    ? 'border-dashed border-[#1074B1] bg-[#1074B1]/10'
                                    : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-[#1074B1] dark:text-sky-400 underline underline-offset-2 truncate">
                                    {item.title}
                                  </div>
                                  <div className="text-[11px] opacity-70 truncate">{item.subtitle}</div>
                                </div>
                                <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-[10px] font-bold shrink-0">
                                  {item.badge}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="px-2 py-1 flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-60">
                          Resources ({consoleResults.totalResources})
                        </span>
                        {consoleResults.totalResources > consoleResults.resources.length && (
                          <button
                            type="button"
                            onClick={() => setResourceLimit((n) => n + 12)}
                            className="text-[11px] font-bold text-[#1074B1] hover:underline"
                          >
                            Show more
                          </button>
                        )}
                      </div>
                      {consoleResults.resources.length === 0 ? (
                        <div className="px-3 py-2 text-[11px] opacity-60">
                          No matching resources for current atomic filters.
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {consoleResults.resources.map((item, rIdx) => {
                            const globalIdx = consoleResults.topResults.length + rIdx;
                            const selected = globalIdx === activeResultIdx;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectConsoleResult(item)}
                                className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-left flex items-center justify-between gap-3 transition-colors border ${
                                  selected
                                    ? 'border-dashed border-[#1074B1] bg-[#1074B1]/10'
                                    : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {item.asset ? (
                                    <FileText className="w-4 h-4 text-[#52B197] shrink-0" />
                                  ) : (
                                    <FolderOpen className="w-4 h-4 text-[#1074B1] shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <div className="font-bold text-[#1074B1] dark:text-sky-400 truncate">
                                      {item.title}
                                    </div>
                                    <div className="text-[11px] opacity-70 truncate">{item.subtitle}</div>
                                  </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-[10px] font-bold shrink-0">
                                  {item.badge}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {isScanning && scanStatus ? (
          <div className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-2 py-0.5 sm:px-2.5 sm:py-1 flex items-center justify-between gap-1.5 sm:gap-2 shadow-xs animate-pulse min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <RefreshCw className="w-3.5 h-3.5 text-[#1074B1] animate-spin shrink-0" />
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-[10px] sm:text-[11px] truncate">
                {scanStatus.message || t('footer.scanning')}
              </span>
              {scanStatus.rate > 0 && (
                <span className="hidden sm:inline text-[10px] text-slate-500 dark:text-slate-400 font-mono shrink-0">
                  {scanStatus.rate} f/s
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="w-12 sm:w-20 md:w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#1074B1] to-[#52B197] transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(5, scanStatus.progress))}%` }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                {scanStatus.progress}%
              </span>

              {onCancelScan && (
                <button
                  onClick={onCancelScan}
                  className="px-1.5 sm:px-2 py-0.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-bold transition-colors"
                >
                  {t('footer.cancel')}
                </button>
              )}

              {onOpenLogs && (
                <button
                  onClick={onOpenLogs}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5"
                  title={t('header.qaLogs')}
                  data-tooltip={t('header.qaLogs')}
                >
                  <Terminal className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            className="hidden lg:flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-xl border sidebar-opaque-card select-none group shrink-0 overflow-hidden"
            style={{
              backgroundColor: 'var(--theme-surface)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text)',
            }}
          >
            {/* Spinning/Pulsing Vinyl Album Art Thumbnail */}
            <div
              onClick={onOpenGoogleMusic}
              className="relative w-5 h-5 rounded-md overflow-hidden shrink-0 cursor-pointer shadow-2xs group-hover:scale-105 transition-transform"
              title="Open Google Music Player"
            >
              <img
                src={musicState.currentTrack.albumArtUrl}
                alt={musicState.currentTrack.title}
                className={`w-full h-full object-cover ${musicState.isPlaying ? 'animate-pulse' : ''}`}
                crossOrigin="anonymous"
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Music className="w-2.5 h-2.5 text-white" />
              </div>
            </div>

            {/* Marquee Track Title & Artist (Truncated) */}
            <div
              onClick={onOpenGoogleMusic}
              className="cursor-pointer max-w-[70px] sm:max-w-[95px] xl:max-w-[125px] min-w-0 truncate"
              title={`${musicState.currentTrack.title} • ${musicState.currentTrack.artist} (Click to open full player)`}
            >
              <div className="font-bold text-[10px] sm:text-[11px] truncate leading-tight hover:text-sky-500 transition-colors">
                {musicState.currentTrack.title}
              </div>
              <div className="text-[9px] opacity-60 truncate leading-tight font-mono">
                {musicState.currentTrack.artist}
              </div>
            </div>

            {/* Mini Transport Buttons */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => googleMusicEngine.prev()}
                className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
                title="Previous Track"
              >
                <SkipBack className="w-3 h-3" />
              </button>

              <button
                onClick={() => googleMusicEngine.togglePlay()}
                className="p-1 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 hover:bg-sky-500/25 transition-transform active:scale-90"
                title={musicState.isPlaying ? 'Pause' : 'Play'}
              >
                {musicState.isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.2" />}
              </button>

              <button
                onClick={() => googleMusicEngine.next()}
                className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
                title="Next Track"
              >
                <SkipForward className="w-3 h-3" />
              </button>
            </div>

            {/* Format Badge & Expand Slide-Up Button */}
            <div className="flex items-center gap-0.5 border-l pl-1 ml-0.5 shrink-0" style={{ borderColor: 'var(--theme-border)' }}>
              <span
                className="text-[9px] px-1 py-0.2 rounded font-mono uppercase font-bold opacity-60 bg-black/5 dark:bg-white/5 cursor-pointer hover:opacity-100"
                onClick={onOpenGoogleMusic}
                title={`Format: ${musicState.currentTrack.format}`}
              >
                {musicState.currentTrack.format}
              </span>

              {onTogglePip && (
                <button
                  type="button"
                  onClick={onTogglePip}
                  aria-pressed={isPipActive}
                  className={`p-1 rounded transition-colors ${
                    isPipActive
                      ? 'bg-teal-500/20 text-teal-600 dark:text-teal-300'
                      : 'hover:bg-sky-500/10 text-slate-500 dark:text-slate-300 opacity-80 hover:opacity-100'
                  }`}
                  title={isPipActive ? 'Close Picture-in-Picture' : 'Toggle Picture-in-Picture (PiP)'}
                  aria-label={isPipActive ? 'Close Picture-in-Picture' : 'Toggle Picture-in-Picture'}
                >
                  <PictureInPicture2 className="w-3 h-3" />
                </button>
              )}

              {onOpenGoogleMusic && (
                <button
                  onClick={onOpenGoogleMusic}
                  className="p-0.5 rounded hover:bg-sky-500/10 text-sky-600 dark:text-sky-400 opacity-80 hover:opacity-100 transition-colors"
                  title="Expand Player"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Right: Themes, Languages, Typography, Accessibility & Shortcuts (Condensed) */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
        {/* Procedural Vim Mode Indicator / Toggle */}
        <button
          onClick={onToggleVim}
          className={`px-1.5 py-1 rounded-xl text-[10px] font-mono font-bold transition-all hidden md:flex items-center gap-1 shrink-0 ${
            isVimActive
              ? 'bg-[#1074B1] text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
          }`}
          title="Procedural Vim Navigation Mode (j/k/h/l, gg, G, /, y)"
          data-tooltip="Procedural Vim Navigation (j/k/h/l, gg, G, /, y)"
          aria-label="Toggle Vim Navigation Mode"
        >
          <Terminal className="w-3 h-3 shrink-0" />
          <span className="hidden xl:inline">VIM</span>
        </button>

        {/* Accessibility & Sensory Hub Button */}
        {onOpenA11yModal && (
          <button
            onClick={onOpenA11yModal}
            className="px-1.5 sm:px-2 py-1 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-1 text-[11px] font-medium transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shrink-0"
            title={t('a11y.title')}
            data-tooltip={t('a11y.title')}
            aria-label={t('a11y.title')}
          >
            <Eye className="w-3.5 h-3.5 text-[#1074B1] shrink-0" />
            <span className="hidden 2xl:inline">A11y</span>
          </button>
        )}

        {/* Themes Button */}
        <button
          onClick={onOpenThemeModal}
          className="px-1.5 sm:px-2 py-1 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-1 text-[11px] font-medium transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shrink-0"
          title={t('theme.modalTitle')}
          data-tooltip={t('theme.modalTitle')}
        >
          <Palette className="w-3.5 h-3.5 text-[#1074B1] shrink-0" />
          <span className="hidden xl:inline">{t('footer.theme')}</span>
        </button>

        {/* Text Direction Toggle */}
        <button
          onClick={toggleVertical}
          className={`px-2 py-1 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1 shrink-0 border ${
            isVertical
              ? 'bg-[#1074B1] text-white border-[#1074B1] shadow-xs'
              : supportsVerticalType
              ? 'text-[#1074B1] dark:text-[#67b7e6] bg-[#1074B1]/10 hover:bg-[#1074B1]/20 border-[#1074B1]/30'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700'
          }`}
          data-tooltip={
            supportsVerticalType
              ? `${t('footer.verticalType')} (CJK: ${isVertical ? 'Vertical' : 'Horizontal'})`
              : `${t('footer.verticalType')}: ${isVertical ? 'Vertical' : 'Horizontal'}`
          }
          title={
            supportsVerticalType
              ? `${t('footer.verticalType')} (CJK)`
              : t('footer.verticalType')
          }
          aria-label={t('footer.verticalType')}
        >
          <span className="text-[11px] tracking-tight">Text</span>
          <span className="text-xs font-bold font-mono">{isVertical ? '↓' : '→'}</span>
          {supportsVerticalType && (
            <span className="text-[9px] uppercase tracking-wider hidden sm:inline opacity-80">
              {isVertical ? 'ON' : 'CJK'}
            </span>
          )}
        </button>

        {/* Minimal Text Scale Buttons (A- / 100% / A+) */}
        {onToggleDarkMode && (
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="min-h-[32px] min-w-[32px] px-2 py-1 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80 hover:border-[#1074B1] flex items-center justify-center transition-colors shrink-0"
            title={isDarkMode ? 'Switch to Day / Light Mode' : 'Switch to Night / Dark Mode'}
            aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <Sun className="w-3.5 h-3.5 text-[#BEBF61]" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-[#403993]" />
            )}
          </button>
        )}

        <div
          className="flex items-center rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80 p-0.5 text-xs font-semibold shrink-0 shadow-2xs"
          data-tooltip={`Text Scaling: ${
            (fontScale || currentFontScale) === 'large'
              ? '115% (Large)'
              : (fontScale || currentFontScale) === 'xlarge'
              ? '130% (X-Large)'
              : '100% (Normal)'
          }`}
          title="Adjust Text Scale (100% / 115% / 130%)"
          aria-label="Text Scaling Controls"
        >
          <button
            onClick={() => handleStepFontScale('down')}
            disabled={(fontScale || currentFontScale) === 'normal'}
            className="px-1.5 py-0.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors text-[10px] font-bold font-mono"
            title="Decrease text scale"
            aria-label="Decrease text scale"
          >
            A-
          </button>
          <span className="px-1 text-[10px] font-mono font-medium text-slate-600 dark:text-slate-300 select-none">
            {(fontScale || currentFontScale) === 'large'
              ? '115%'
              : (fontScale || currentFontScale) === 'xlarge'
              ? '130%'
              : '100%'}
          </span>
          <button
            onClick={() => handleStepFontScale('up')}
            disabled={(fontScale || currentFontScale) === 'xlarge'}
            className="px-1.5 py-0.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors text-[10px] font-bold font-mono"
            title="Increase text scale"
            aria-label="Increase text scale"
          >
            A+
          </button>
        </div>

        {/* Top 20 Languages Menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
            className="px-1.5 sm:px-2.5 py-1 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-1 text-[11px] font-medium transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shrink-0"
            title={t('footer.language')}
            data-tooltip={t('footer.language')}
            aria-expanded={isLangMenuOpen}
          >
            <Globe className="w-3.5 h-3.5 text-[#52B197] shrink-0" />
            <span className="uppercase font-bold text-[10px]">{currentLanguage}</span>
            <ChevronUp className="w-3 h-3 text-slate-400 shrink-0 hidden sm:inline" />
          </button>

          {isLangMenuOpen && (
            <>
              <div className="fixed inset-0 z-[99998] bg-black/10 backdrop-blur-[0.5px]" onClick={() => setIsLangMenuOpen(false)} />
              <div
                className="fixed bottom-12 right-2 sm:right-4 mb-1 w-56 max-w-[calc(100vw-24px)] max-h-72 overflow-y-auto rounded-2xl shadow-2xl border p-1.5 z-[99999] animate-in fade-in zoom-in-95 duration-100 text-xs custom-scrollbar theme-card"
                style={{
                  backgroundColor: 'var(--theme-surface)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text)',
                }}
                role="menu"
              >
                <div className="px-2.5 py-1 font-bold text-[10px] uppercase text-slate-400 tracking-wider">
                  Top 20 Global Languages
                </div>
                {TOP_20_LANGUAGES.map((lang) => {
                  const isSelected = currentLanguage === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setIsLangMenuOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between text-left transition-colors ${
                        isSelected
                          ? 'bg-[#1074B1] text-white font-bold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                      role="menuitem"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className="truncate">{lang.nativeName}</span>
                        <span className="text-[10px] opacity-70 truncate">({lang.name})</span>
                      </span>
                      {lang.dir === 'rtl' && (
                        <span className="text-[9px] px-1 py-0.2 bg-black/10 dark:bg-white/10 rounded font-mono shrink-0 ml-1">
                          RTL
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Notification Center Bell Trigger */}
        <button
          onClick={onOpenNotifications}
          className="relative p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1]"
          title={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
          data-tooltip={
            unreadCount > 0
              ? `${unreadCount} Unread Notifications`
              : priorityFlag
              ? `Status: ${priorityFlag}`
              : 'Notification Center'
          }
          aria-label="Notification Center"
        >
          <Bell className="w-3.5 h-3.5" />
          {unreadCount > 0 ? (
            <span
              className={`absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full text-[9px] font-bold text-white flex items-center justify-center shadow-xs ${
                priorityFlag === 'failure'
                  ? 'bg-red-500'
                  : priorityFlag === 'attention'
                  ? 'bg-purple-600'
                  : priorityFlag === 'busy'
                  ? 'bg-amber-500'
                  : 'bg-[#1074B1]'
              }`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : priorityFlag === 'busy' ? (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          ) : null}
        </button>

        {/* Keyboard Shortcuts Trigger */}
        <button
          onClick={onOpenShortcuts}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors shrink-0"
          title={t('footer.shortcuts')}
          data-tooltip={t('footer.shortcuts')}
          data-tooltip-align="right"
          aria-label={t('footer.shortcuts')}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>
    </footer>
  );
};
