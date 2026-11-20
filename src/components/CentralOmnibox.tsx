/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Central Omnibox & Header (Attachment 1 Architecture - A+ Tier)
 * Interactive AI provider switcher, semantic natural language search toggle,
 * Google Workspace Auth status, and WCAG 2.2 AAA accessibility.
 */

import React, { useState } from 'react';
import {
  Sparkles,
  User as UserIcon,
  LogOut,
  CheckCircle2,
  ChevronRight,
  KeyRound,
  Wand2,
  RefreshCw,
  Settings,
  Compass,
  PanelLeft,
  Rocket,
  HelpCircle,
  LayoutGrid,
  AlertOctagon,
} from 'lucide-react';
import { CodexHelpBadge } from './CodexHelpBadge';
import { CodexTopicId } from '../services/codexContent';
import { User } from 'firebase/auth';
import { MediaAsset, ProviderConfig } from '../types';
import { useTranslation } from '../i18n';
import { DisplayTier } from '../services/adaptiveDisplayProfile';
import { StudioTooltip } from './StudioTooltip';

interface CentralOmniboxProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activePath: string;
  activeProviderName: string;
  providers?: ProviderConfig[];
  activeProviderId?: string;
  onSelectProvider?: (id: string) => void;
  searchMode?: 'text' | 'semantic';
  onToggleSearchMode?: () => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  isAuthenticating: boolean;
  onOpenDiagnostics?: () => void;
  onOpenOAuthWizard?: () => void;
  onDeepScan?: () => void;
  isScanning?: boolean;
  scanStatus?: {
    phase: string;
    progress: number;
    count: number;
    rate: number;
    message: string;
    pageCount?: number;
    heartbeatTime?: number;
    lastError?: string;
  };
  onCancelScan?: () => void;
  onOpenSettings?: () => void;
  onOpenLogs?: () => void;
  onOpenCopilot?: () => void;
  onOpenGoogleMusic?: () => void;
  onOpenButler?: () => void;
  onOpenFormatDb?: () => void;
  assets?: MediaAsset[];
  onExecuteConsoleAction?: (actionId: string, asset?: MediaAsset) => void;
  onOpenTour?: () => void;
  displayTier?: DisplayTier | 'auto';
  onChangeDisplayTier?: (tier: DisplayTier | 'auto') => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  pickedCount?: number;
  rejectedCount?: number;
  totalAssetsCount?: number;
  onOpenCulling?: () => void;
  onOpenCodex?: (topicId?: CodexTopicId) => void;
  onOpenFavorites?: () => void;
  onOpenFullDiagnostic?: () => void;
}

export const CentralOmnibox: React.FC<CentralOmniboxProps> = ({
  searchQuery,
  onSearchChange,
  activePath,
  activeProviderName,
  providers = [],
  activeProviderId,
  onSelectProvider,
  searchMode = 'text',
  onToggleSearchMode,
  user,
  onSignIn,
  onSignOut,
  isAuthenticating,
  onOpenDiagnostics,
  onOpenOAuthWizard,
  onDeepScan,
  isScanning = false,
  scanStatus,
  onCancelScan,
  onOpenSettings,
  onOpenLogs,
  onOpenCopilot,
  onOpenGoogleMusic,
  onOpenButler,
  onOpenFormatDb,
  assets = [],
  onExecuteConsoleAction,
  onOpenTour,
  displayTier = 'auto',
  onChangeDisplayTier,
  isSidebarCollapsed = false,
  onToggleSidebar,
  pickedCount = 0,
  rejectedCount = 0,
  totalAssetsCount = 0,
  onOpenCulling,
  onOpenCodex,
  onOpenFavorites,
  onOpenFullDiagnostic,
}) => {
  const { t } = useTranslation();

  return (
    <header className="group/header w-full min-h-[48px] py-1.5 px-3 sm:px-5 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2.5 shrink-0 z-30 select-none omnibox-header-container transition-colors duration-200">
      {/* Left: Sidebar Toggle & Breadcrumb (Omnibox moved to Footer) */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {onToggleSidebar && (
          <StudioTooltip label={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'} shortcut="B">
            <button
              type="button"
              onClick={onToggleSidebar}
              className="min-h-[38px] min-w-[38px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-[#1074B1] flex items-center justify-center shrink-0 transition-all"
              aria-label={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <PanelLeft className="w-4 h-4 text-[#1074B1]" />
            </button>
          </StudioTooltip>
        )}

        {/* Path Breadcrumb */}
        <div
          className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-xl border truncate sidebar-opaque-card"
          style={{
            backgroundColor: 'var(--theme-surface)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text)',
          }}
        >
          <span className="font-semibold" style={{ color: 'var(--theme-text)' }}>Drive Therapy</span>
          <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0" />
          <span className="truncate opacity-85">{activePath}</span>
        </div>
      </div>

      {/* Right: Photo Review Status Pill, Active AI Engine Selector & Google Workspace Auth Profile */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Compact Photo Review Status Pill (Moved to Header; G. Comms moved to Floating Gemstone FAB) */}
        <button
          type="button"
          onClick={onOpenCulling || onOpenCopilot}
          className="hidden md:flex min-h-[38px] items-center gap-2 px-3 py-1 rounded-xl border sidebar-opaque-card hover:border-[#A61B7A]/60 text-xs font-semibold transition-all shrink-0"
          style={{
            backgroundColor: 'var(--theme-surface)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text)',
          }}
          title="Open Photo Review & Culling Studio"
          aria-label="Photo Review Status"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#A61B7A] shrink-0" />
          <span className="font-bold">Photo Review</span>
          <span className="text-[11px] opacity-75 font-mono tabular-nums">
            {pickedCount} Kept · {rejectedCount} Dis ·{' '}
            {totalAssetsCount > 0
              ? Math.round(((pickedCount + rejectedCount) / totalAssetsCount) * 100)
              : 0}
            %
          </span>
        </button>

        {/* Fun Tour Mode Launcher */}
        {onOpenTour && (
          <StudioTooltip label="Launch Interactive Studio Tour">
            <button
              type="button"
              onClick={onOpenTour}
              className="group/tour min-h-[40px] min-w-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-[#A61B7A] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all shrink-0"
              aria-label="Launch Interactive Tour Mode"
            >
              <Rocket className="w-4 h-4 text-[#A61B7A] transition-transform duration-300 group-hover/tour:-rotate-12 group-hover/tour:scale-110 shrink-0" />
              <span className="hidden xl:inline">Tour</span>
            </button>
          </StudioTooltip>
        )}

        {/* (?) Drive Therapy Codex (Walkthroughs, FAQ, Glossary & Use Cases) */}
        {onOpenCodex && (
          <StudioTooltip label="Drive Therapy Codex: Walkthroughs, FAQ, Glossary & Use Cases">
            <button
              type="button"
              onClick={() => onOpenCodex()}
              className="min-h-[40px] min-w-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-[#1074B1] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all shrink-0"
              aria-label="Open Drive Therapy Codex"
            >
              <HelpCircle className="w-4 h-4 text-[#1074B1] shrink-0" />
              <span className="hidden xl:inline">Codex</span>
            </button>
          </StudioTooltip>
        )}

        <CodexHelpBadge topicId="header-omnibox" onOpenCodex={(id) => onOpenCodex?.(id)} />

        {onOpenFullDiagnostic && (
          <StudioTooltip label="Run Temporary Full Diagnostic Sweep (!)">
            <button
              type="button"
              onClick={onOpenFullDiagnostic}
              className="min-h-[38px] min-w-[38px] px-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs transition-all shrink-0"
              aria-label="Run Full Diagnostic Sweep"
            >
              <AlertOctagon className="w-4 h-4 shrink-0" />
            </button>
          </StudioTooltip>
        )}

        {onOpenFavorites && (
          <StudioTooltip label="Google Favorites Launcher">
            <button
              type="button"
              onClick={onOpenFavorites}
              className="min-h-[38px] min-w-[38px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-[#1074B1] flex items-center justify-center shadow-xs transition-all shrink-0"
              aria-label="Open Google Favorites"
            >
              <LayoutGrid className="w-4 h-4 text-[#1074B1] shrink-0" />
            </button>
          </StudioTooltip>
        )}

        {onOpenCopilot && (
          <StudioTooltip label="Open G. Comms (Gemini, Chat & Voice)">
            <button
              type="button"
              onClick={onOpenCopilot}
              className="min-h-[38px] min-w-[38px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-[#52B197] flex items-center justify-center shadow-xs transition-all shrink-0"
              aria-label="Open G. Comms"
            >
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            </button>
          </StudioTooltip>
        )}

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="min-h-[44px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[#1074B1] shrink-0"
            title="Settings & Session Control: Manage storage, prune ghost files, and control active sessions"
            aria-label="Settings and Session Control"
          >
            <Settings className="w-3.5 h-3.5 text-[#1074B1] shrink-0" />
            <span className="hidden lg:inline">{t('header.settingsAndSessions')}</span>
          </button>
        )}

        {/* User Account / Google Sign-In */}
        {user ? (
          <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-slate-200 dark:border-slate-800 shrink-0">
            {isScanning && scanStatus ? (
              <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 bg-amber-500/10 border border-amber-500/30 px-2 sm:px-2.5 py-0.5 rounded-xl text-xs">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-500 shrink-0" />
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-amber-700 dark:text-amber-300 text-[10px] leading-tight truncate">
                    {scanStatus.phase === 'folders'
                      ? 'Folders'
                      : scanStatus.phase === 'files'
                      ? 'Indexing'
                      : scanStatus.phase === 'clustering'
                      ? 'Bursts'
                      : scanStatus.phase === 'saving'
                      ? 'Saving'
                      : 'Scanning'}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    {scanStatus.progress}%
                  </span>
                </div>
              </div>
            ) : onDeepScan ? (
              <button
                onClick={onDeepScan}
                className="min-h-[40px] px-3 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[#1074B1] bg-[#1074B1]/10 hover:bg-[#1074B1]/20 border-[#1074B1]/30 text-[#1074B1] dark:text-[#67b7e6] active:scale-[0.98] shrink-0"
                title="Deep Scan: Index entire Google Drive recursively without item limits"
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{t('header.deepScan')}</span>
              </button>
            ) : null}

            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User Profile'}
                className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#1074B1] text-white flex items-center justify-center font-bold text-xs shrink-0">
                {(user.displayName || user.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="hidden lg:flex flex-col text-left truncate max-w-[100px]">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {user.displayName || 'Account'}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                <CheckCircle2 className="w-2.5 h-2.5 shrink-0" /> {t('header.driveConnected')}
              </span>
            </div>
            <button
              onClick={onSignOut}
              className="min-h-[40px] min-w-[40px] p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center focus-visible:ring-2 focus-visible:ring-rose-500 shrink-0"
              title="Sign out of Google Drive"
              aria-label="Sign out of Google Drive"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              onClick={onSignIn}
              disabled={isAuthenticating}
              className="min-h-[40px] flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs transition-all active:scale-[0.98] text-xs font-medium text-slate-700 dark:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1] shrink-0"
              title="Connect Google Drive with permission from the app's users"
            >
              {/* Google Sign-in SVG Icon */}
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span className="hidden sm:inline">{isAuthenticating ? t('header.connecting') : t('header.connectDrive')}</span>
              <span className="sm:hidden">{isAuthenticating ? '...' : t('header.connect')}</span>
            </button>
          </div>
        )}

        {onOpenOAuthWizard && (
          <button
            onClick={onOpenOAuthWizard}
            className="min-h-[40px] min-w-[40px] p-2 text-slate-500 hover:text-[#52B197] dark:text-slate-400 dark:hover:text-[#52B197] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52B197] shrink-0"
            title="Google OAuth 2.0 Setup Wizard"
            aria-label="Google OAuth 2.0 Setup Wizard"
          >
            <Wand2 className="w-4 h-4" />
          </button>
        )}

        {onOpenDiagnostics && (
          <button
            onClick={onOpenDiagnostics}
            className="min-h-[40px] min-w-[40px] p-2 text-slate-500 hover:text-[#1074B1] dark:text-slate-400 dark:hover:text-[#67b7e6] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1] shrink-0"
            title="Google Drive Diagnostics, API Status & Direct Token Connector"
            aria-label="Google Drive Diagnostics, API Status and Direct Token Connector"
          >
            <KeyRound className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
