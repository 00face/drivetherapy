/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Welcome Splash Screen Modal (Attachment 1 Architecture)
 * Converts welcome text and onboarding actions into a dismissible modal dialog
 * with persistent "Don't show on startup" option to keep the workspace clean.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import {
  X,
  Cloud,
  Sparkles,
  ShieldCheck,
  FolderPlus,
  PlayCircle,
  KeyRound,
  ExternalLink,
  Server,
  FileImage,
  CheckSquare,
  Square,
  ArrowRight,
} from 'lucide-react';

interface WelcomeSplashScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignIn: () => void;
  onMountLocalFolder: () => void;
  onImportFiles?: () => void;
  onLoadSampleShoot: () => void;
  isAuthenticating: boolean;
  onOpenDiagnostics?: () => void;
  onLaunchStandaloneAuth?: (auto?: boolean) => void;
  onOpenOAuthWizard?: () => void;
}

const STORAGE_KEY = 'dt_disable_welcome_splash_v1';

export const WelcomeSplashScreenModal: React.FC<WelcomeSplashScreenModalProps> = ({
  isOpen,
  onClose,
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

  const [dontShowAgain, setDontShowAgain] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleToggleDontShowAgain = () => {
    setDontShowAgain((prev) => {
      const next = !prev;
      try {
        if (next) {
          localStorage.setItem(STORAGE_KEY, 'true');
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {}
      return next;
    });
  };

  const handleDismiss = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      aria-modal="true"
      role="dialog"
      aria-label="Welcome to Drive Therapy"
      onClick={handleDismiss}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl theme-card overflow-hidden animate-in zoom-in-95 duration-150 relative"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle ambient decorative gradient blur */}
        <div className="absolute -top-16 -right-16 w-60 h-60 rounded-full bg-gradient-to-br from-[#1074B1]/15 to-[#52B197]/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-60 h-60 rounded-full bg-gradient-to-tr from-[#403993]/15 to-[#A61B7A]/15 blur-3xl pointer-events-none" />

        {/* Header / Dismiss */}
        <div className="p-5 border-b flex items-start justify-between gap-4 shrink-0 relative z-10" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1074B1]/10 dark:bg-[#1074B1]/25 text-[#1074B1] dark:text-[#67b7e6] text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-[#BEBF61]" />
              <span>{t('onboarding.badge')}</span>
            </div>
            <span className="text-xs text-slate-400 font-medium">Quick Start</span>
          </div>

          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Dismiss (Esc)"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar text-xs relative z-10">
          {/* Main Headline */}
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
              {t('onboarding.headline')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-normal max-w-xl">
              {t('onboarding.subhead')}
            </p>
          </div>

          {/* Value Proposition Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#1074B1]/10 flex items-center justify-center shrink-0">
                <Cloud className="w-4 h-4 text-[#1074B1]" />
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

            <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#52B197]/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-[#52B197]" />
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

            <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#A61B7A]/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-[#A61B7A]" />
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
          <div className="space-y-2.5 pt-1">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Choose How to Connect Your Catalog
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Primary Action: Official Sign in with Google */}
              <button
                onClick={() => {
                  onSignIn();
                  handleDismiss();
                }}
                disabled={isAuthenticating}
                className="min-h-[50px] px-3.5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-2xl shadow-xs transition-all active:scale-[0.98] flex items-center gap-3 text-xs font-semibold text-slate-800 dark:text-slate-100 text-left focus-visible:outline-2 focus-visible:outline-[#1074B1]"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200/60 dark:border-slate-600 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-bold block truncate">
                    {isAuthenticating ? t('header.connecting') : t('onboarding.connectDrive')}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">
                    Stream directly from your cloud archive
                  </span>
                </div>
              </button>

              {/* Standalone Window Quick Action */}
              {onLaunchStandaloneAuth && (
                <button
                  onClick={() => {
                    onLaunchStandaloneAuth(true);
                    handleDismiss();
                  }}
                  className="min-h-[50px] px-3.5 py-2.5 rounded-2xl bg-[#1074B1]/10 dark:bg-[#1074B1]/20 hover:bg-[#1074B1]/20 dark:hover:bg-[#1074B1]/30 text-[#1074B1] dark:text-[#67b7e6] text-xs font-bold border border-[#1074B1]/30 transition-all flex items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#1074B1]/15 text-[#1074B1] dark:text-[#67b7e6] flex items-center justify-center shrink-0">
                    <ExternalLink className="w-4 h-4 shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate">Open in New Window</span>
                    <span className="text-[10px] opacity-75 font-normal block truncate">
                      Bypasses iframe authentication blocks
                    </span>
                  </div>
                </button>
              )}

              {/* Secondary Action: Mount Local OS Folder */}
              <button
                onClick={() => {
                  onMountLocalFolder();
                  handleDismiss();
                }}
                className="min-h-[50px] px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-transparent transition-colors flex items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-[#52B197]"
              >
                <div className="w-8 h-8 rounded-xl bg-[#52B197]/15 text-[#52B197] flex items-center justify-center shrink-0">
                  <FolderPlus className="w-4 h-4 shrink-0" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-bold block truncate">{t('onboarding.browseLocal')}</span>
                  <span className="text-[10px] text-slate-400 block truncate">
                    Mount photos from SSD / Hard Drive
                  </span>
                </div>
              </button>

              {/* Local Media Files Picker Fallback */}
              {onImportFiles && (
                <button
                  onClick={() => {
                    onImportFiles();
                    handleDismiss();
                  }}
                  className="min-h-[50px] px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-transparent transition-colors flex items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#1074B1]/15 text-[#1074B1] flex items-center justify-center shrink-0">
                    <FileImage className="w-4 h-4 shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold block truncate">Mount Media (0MB Upload)</span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      Select specific image files directly
                    </span>
                  </div>
                </button>
              )}
            </div>

            {/* Load Sample Shoot button */}
            <div className="pt-1 flex items-center justify-between">
              <button
                onClick={() => {
                  onLoadSampleShoot();
                  handleDismiss();
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-[#1074B1] dark:hover:text-[#67b7e6] transition-colors flex items-center gap-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
              >
                <PlayCircle className="w-4 h-4" />
                <span>{t('onboarding.loadDemo')}</span>
              </button>

              <div className="flex items-center gap-2">
                {onOpenOAuthWizard && (
                  <button
                    onClick={() => {
                      handleDismiss();
                      onOpenOAuthWizard();
                    }}
                    className="text-[11px] font-semibold text-[#52B197] hover:underline flex items-center gap-1"
                  >
                    <Server className="w-3 h-3" />
                    <span>OAuth Wizard</span>
                  </button>
                )}
                {onOpenDiagnostics && (
                  <button
                    onClick={() => {
                      handleDismiss();
                      onOpenDiagnostics();
                    }}
                    className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 hover:underline flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>Diagnostics</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer: "Don't show again" Checkbox + Action Buttons */}
        <div
          className="p-4 border-t flex flex-wrap items-center justify-between gap-3 shrink-0 bg-slate-50/70 dark:bg-slate-900/70 text-xs relative z-10"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          {/* Checkbox to Disable Splash on Startup */}
          <button
            onClick={handleToggleDontShowAgain}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer select-none"
            title="Toggle splash screen appearance on application startup"
          >
            {dontShowAgain ? (
              <CheckSquare className="w-4 h-4 text-[#1074B1]" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span className="font-medium text-[11px]">
              Don&apos;t show this splash screen on startup
            </span>
          </button>

          <button
            onClick={handleDismiss}
            className="px-5 py-2 rounded-xl bg-[#1074B1] hover:bg-[#0e6397] text-white font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-[0.98]"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
