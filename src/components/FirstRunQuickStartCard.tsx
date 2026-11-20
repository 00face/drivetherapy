/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-106] Inline 3-Path First-Run Quick Start Card
 * Eliminates cold-start friction when the catalog has 0 indexed assets by giving
 * immediate 1-click entry into Google Drive/Photos, Local OS Folders, or External Clouds/Takeout.
 */

import React from 'react';
import { Archive, Cloud, Compass, FolderOpen, Globe, ShieldCheck } from 'lucide-react';
import { getPolluxPortraitUrl } from '../services/polluxTourAgent';

interface FirstRunQuickStartCardProps {
  isGoogleConnected: boolean;
  onConnectGoogle: () => void;
  onQuickScan: () => void;
  onImportLocalFolder: () => void;
  onOpenExternalClouds: () => void;
  onOpenTakeout: () => void;
  onOpenTour: () => void;
}

export const FirstRunQuickStartCard: React.FC<FirstRunQuickStartCardProps> = ({
  isGoogleConnected,
  onConnectGoogle,
  onQuickScan,
  onImportLocalFolder,
  onOpenExternalClouds,
  onOpenTakeout,
  onOpenTour,
}) => {
  return (
    <section
      aria-label="Drive Therapy Quick Start"
      className="my-4 rounded-3xl border p-5 sm:p-6 space-y-5 theme-card dt-motion-fade"
      style={{
        backgroundColor: 'var(--theme-surface)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <img
            src={getPolluxPortraitUrl()}
            alt="Pollux Studio Guide"
            className="w-16 h-16 object-contain overflow-visible shrink-0 drop-shadow-md"
          />
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
              Welcome to Drive Therapy — Choose Your Starting Library
            </h2>
            <p className="text-xs opacity-75 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>100% Non-Destructive · Original cloud &amp; local files are never modified automatically.</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenTour}
          className="min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <Compass className="w-4 h-4 text-[#52B197]" />
          <span>60s Pollux Tour</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Path 1: Google Drive & Photos */}
        <button
          type="button"
          onClick={isGoogleConnected ? onQuickScan : onConnectGoogle}
          className="p-4 rounded-2xl border text-left space-y-2 transition-colors hover:border-[#1074B1] hover:bg-black/5 dark:hover:bg-white/5 flex flex-col justify-between"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="space-y-1.5">
            <div className="w-9 h-9 rounded-xl bg-[#1074B1]/15 text-[#1074B1] dark:text-sky-300 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div className="text-sm font-extrabold">
              {isGoogleConnected ? 'Run Quick 300 Drive Scan' : '1. Connect Google Drive'}
            </div>
            <p className="text-xs opacity-75 leading-relaxed">
              {isGoogleConnected
                ? 'Your Google account is linked. Index your latest 300 Drive photos, RAWs, videos & audio.'
                : 'Sign in with Google OAuth 2.0 PKCE to browse Drive, Google Photos, and Music.'}
            </p>
          </div>
          <span className="text-xs font-bold text-[#1074B1] dark:text-sky-300 pt-1">
            {isGoogleConnected ? 'Start Quick Scan →' : 'Connect Google →'}
          </span>
        </button>

        {/* Path 2: Local OS Folder */}
        <button
          type="button"
          onClick={onImportLocalFolder}
          className="p-4 rounded-2xl border text-left space-y-2 transition-colors hover:border-[#52B197] hover:bg-black/5 dark:hover:bg-white/5 flex flex-col justify-between"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="space-y-1.5">
            <div className="w-9 h-9 rounded-xl bg-[#52B197]/15 text-[#1f6b56] dark:text-emerald-300 flex items-center justify-center">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div className="text-sm font-extrabold">2. Open Local Folder (Offline)</div>
            <p className="text-xs opacity-75 leading-relaxed">
              Index any local drive or SD card with 100% offline EXIF, perceptual dHash burst culling &amp; LUT editing.
            </p>
          </div>
          <span className="text-xs font-bold text-[#1f6b56] dark:text-emerald-300 pt-1">
            Browse Local Disk →
          </span>
        </button>

        {/* Path 3: External Clouds & Takeout */}
        <div
          className="p-4 rounded-2xl border text-left space-y-2 flex flex-col justify-between"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="space-y-1.5">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div className="text-sm font-extrabold">3. External Clouds &amp; Takeout</div>
            <p className="text-xs opacity-75 leading-relaxed">
              Connect Dropbox, OneDrive, Wasabi/S3, WebDAV, or reconcile Google Takeout archives.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              type="button"
              onClick={onOpenExternalClouds}
              className="min-h-[36px] px-2.5 py-1 rounded-lg bg-violet-600 text-white text-[11px] font-bold hover:bg-violet-700"
            >
              External Clouds
            </button>
            <button
              type="button"
              onClick={onOpenTakeout}
              className="min-h-[36px] px-2.5 py-1 rounded-lg border text-[11px] font-bold hover:bg-black/5 dark:hover:bg-white/10 inline-flex items-center gap-1"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Takeout</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
