/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Onboarding Hero Gate (Zero-Dummy-Data Initial State)
 * Optimized compact layout, centered squircle button icons,
 * high-contrast theme-adaptive links, and reduced vertical footprint.
 */

import React from 'react';
import { useTranslation } from '../i18n';
import {
  Cloud,
  Sparkles,
  ShieldCheck,
  FolderPlus,
  PlayCircle,
  KeyRound,
  ExternalLink,
  Server,
  FileImage,
} from 'lucide-react';

interface OnboardingHeroGateProps {
  onSignIn: () => void;
  onMountLocalFolder: () => void;
  onImportFiles?: () => void;
  onLoadSampleShoot: () => void;
  isAuthenticating: boolean;
  onOpenDiagnostics?: () => void;
  onLaunchStandaloneAuth?: (auto?: boolean) => void;
  onOpenOAuthWizard?: () => void;
}

export const OnboardingHeroGate: React.FC<OnboardingHeroGateProps> = ({
  onSignIn,
  onMountLocalFolder,
  onImportFiles,
  onLoadSampleShoot,
  isAuthenticating,
  onOpenDiagnostics,
  onLaunchStandaloneAuth,
  onOpenOAuthWizard,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className="max-w-3xl mx-auto my-3 sm:my-4 p-5 sm:p-6 rounded-2xl border shadow-lg relative overflow-hidden theme-card transition-all"
      style={{
        backgroundColor: 'var(--theme-surface)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text)',
      }}
    >
      {/* Subtle ambient decorative gradient blur */}
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-gradient-to-br from-[#1074B1]/15 to-[#52B197]/15 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-gradient-to-tr from-[#403993]/15 to-[#A61B7A]/15 blur-2xl pointer-events-none" />

      <div className="relative z-10 space-y-4">
        {/* Top App Badge & Headline Group */}
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-0.5 rounded-full bg-[#1074B1]/10 dark:bg-[#1074B1]/25 text-[#1074B1] dark:text-[#67b7e6] text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-[#BEBF61]" />
            <span>{t('onboarding.badge')}</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
            {t('onboarding.headline')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl leading-normal">
            {t('onboarding.subhead')}
          </p>
        </div>

        {/* Compact Value Proposition Micro-Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#1074B1]/10 flex items-center justify-center shrink-0">
              <Cloud className="w-3.5 h-3.5 text-[#1074B1]" />
            </div>
            <div className="text-xs min-w-0">
              <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                {t('onboarding.cloudStreamTitle')}
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block truncate">
                {t('onboarding.cloudStreamDesc')}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#52B197]/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-[#52B197]" />
            </div>
            <div className="text-xs min-w-0">
              <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                {t('onboarding.speedCullingTitle')}
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block truncate">
                {t('onboarding.speedCullingDesc')}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#A61B7A]/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-[#A61B7A]" />
            </div>
            <div className="text-xs min-w-0">
              <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                {t('onboarding.safeTitle')}
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block truncate">
                {t('onboarding.safeDesc')}
              </span>
            </div>
          </div>
        </div>

        {/* Action Gate with Centered Squircle Buttons */}
        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* Primary Action: Official Sign in with Google */}
            <button
              onClick={onSignIn}
              disabled={isAuthenticating}
              className="min-h-[48px] px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-2xl shadow-xs transition-all active:scale-[0.98] flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1]"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200/60 dark:border-slate-600 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
              </div>
              <span className="leading-tight truncate">
                {isAuthenticating ? t('header.connecting') : t('onboarding.connectDrive')}
              </span>
            </button>

            {/* Standalone Window Quick Action */}
            {onLaunchStandaloneAuth && (
              <button
                onClick={() => onLaunchStandaloneAuth(true)}
                className="min-h-[48px] px-3 py-2 rounded-2xl bg-[#1074B1]/10 dark:bg-[#1074B1]/20 hover:bg-[#1074B1]/20 dark:hover:bg-[#1074B1]/30 text-[#1074B1] dark:text-[#67b7e6] text-xs font-bold border border-[#1074B1]/30 transition-all flex items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1]"
                title="Open Google Sign In in a new standalone window bypassing iframe restrictions"
              >
                <div className="w-8 h-8 rounded-xl bg-[#1074B1]/15 text-[#1074B1] dark:text-[#67b7e6] flex items-center justify-center shrink-0">
                  <ExternalLink className="w-4 h-4 shrink-0" />
                </div>
                <span className="leading-tight truncate">Open in New Window</span>
              </button>
            )}

            {/* Secondary Action: Mount Local OS Folder */}
            <button
              onClick={onMountLocalFolder}
              className="min-h-[48px] px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-transparent transition-colors flex items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52B197]"
            >
              <div className="w-8 h-8 rounded-xl bg-[#52B197]/15 text-[#52B197] flex items-center justify-center shrink-0">
                <FolderPlus className="w-4 h-4 shrink-0" />
              </div>
              <span className="leading-tight truncate">{t('onboarding.browseLocal')}</span>
            </button>

            {/* Local Media Files Picker Fallback */}
            {onImportFiles && (
              <button
                onClick={onImportFiles}
                className="min-h-[48px] px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-transparent transition-colors flex items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1]"
              >
                <div className="w-8 h-8 rounded-xl bg-[#1074B1]/15 text-[#1074B1] flex items-center justify-center shrink-0">
                  <FileImage className="w-4 h-4 shrink-0" />
                </div>
                <span className="leading-tight truncate">Mount Media (0MB Upload)</span>
              </button>
            )}
          </div>

          {/* Tertiary Action: Load Demo Shoot */}
          <div className="pt-2 flex justify-center sm:justify-start">
            <button
              onClick={onLoadSampleShoot}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-[#1074B1] dark:hover:text-[#67b7e6] transition-colors flex items-center gap-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>{t('onboarding.loadDemo')}</span>
            </button>
          </div>
        </div>

        {/* High-Contrast Secondary Links & Privacy Assurance */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            {onOpenOAuthWizard && (
              <button
                onClick={onOpenOAuthWizard}
                className="px-2.5 py-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-[#298d75] dark:text-[#52B197] border border-slate-200/70 dark:border-slate-700/70 transition-colors flex items-center gap-1.5 shadow-2xs focus-visible:outline-2 focus-visible:outline-[#52B197]"
              >
                <Server className="w-3.5 h-3.5 shrink-0" />
                <span>Custom Google Cloud Setup (OAuth Wizard)</span>
              </button>
            )}

            {onOpenDiagnostics && (
              <button
                onClick={onOpenDiagnostics}
                className="px-2.5 py-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700/70 transition-colors flex items-center gap-1.5 shadow-2xs focus-visible:outline-2 focus-visible:outline-[#1074B1]"
              >
                <KeyRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Diagnostics &amp; Direct Token</span>
              </button>
            )}
          </div>

          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Files stream directly from Drive into memory — zero local disk bloat.
          </p>
        </div>
      </div>
    </div>
  );
};
