/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * About Drive Therapy Modal & Interactive Walkthrough
 * Features overview, architectural breakdown, and developer profile:
 * Developer: 00face (https://github.com/00face/ | https://00face.github.io/)
 */

import React, { useEffect } from 'react';
import {
  X,
  ExternalLink,
  Github,
  Globe,
  Sparkles,
  Camera,
  Layers,
  Scissors,
  Users,
  HardDrive,
  ShieldCheck,
  Zap,
  FolderSync,
  Compass,
  Keyboard,
  Play,
  Heart,
  Code2,
} from 'lucide-react';
import { useTranslation } from '../i18n';

interface AboutAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWelcomeSplash?: () => void;
  onOpenShortcuts?: () => void;
}

export const AboutAppModal: React.FC<AboutAppModalProps> = ({
  isOpen,
  onClose,
  onOpenWelcomeSplash,
  onOpenShortcuts,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const coreFeatures = [
    {
      icon: <Zap className="w-4 h-4 text-[#52B197]" />,
      title: 'Speed Culling & Curation',
      desc: 'Keystroke culling (P/X/U, 1-5 stars) with automated burst grouping and sharpest hero detection.',
    },
    {
      icon: <Camera className="w-4 h-4 text-[#1074B1]" />,
      title: 'Native Camera RAW Demosaicing',
      desc: 'Direct in-browser WebAssembly decoding for Sony .ARW, Canon .CR3, Nikon .NEF, and Fuji .RAF.',
    },
    {
      icon: <Sparkles className="w-4 h-4 text-[#BEBF61]" />,
      title: '3D LUTs & Batch Edit Sync',
      desc: 'Kodak Portra, Fuji 400H recipes, Adobe .cube LUT import, and Ctrl+Shift+C / Ctrl+Shift+V burst sync.',
    },
    {
      icon: <Scissors className="w-4 h-4 text-[#A61B7A]" />,
      title: 'Lossless Video Trimmer & Scrubbing',
      desc: 'Hover filmstrip scrubbers and lossless in/out point trimming using stream copy commands.',
    },
    {
      icon: <Layers className="w-4 h-4 text-[#403993]" />,
      title: 'Tokenized Batch Renamer',
      desc: 'Rename 500+ items with live diffs using {date}, {camera}, {lens}, {seq:001}, and search-replace.',
    },
    {
      icon: <Users className="w-4 h-4 text-[#1074B1]" />,
      title: 'On-Device Face Recognition',
      desc: '100% private biometric face grouping running locally in memory without sending data to cloud servers.',
    },
    {
      icon: <Compass className="w-4 h-4 text-[#52B197]" />,
      title: 'Interactive World Map & Smart Albums',
      desc: 'EXIF GPS clustering on interactive map pins, plus auto-updating Smart Saved Collections.',
    },
    {
      icon: <ShieldCheck className="w-4 h-4 text-[#22C55E]" />,
      title: 'Non-Destructive Zero-Disk Architecture',
      desc: 'Streams previews directly from Google Drive and local disks keeping original camera files untouched.',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      aria-modal="true"
      role="dialog"
      aria-label="About Drive Therapy"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl theme-card overflow-hidden animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-5 border-b flex items-start justify-between gap-4 shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#403993] via-[#1074B1] to-[#52B197] flex items-center justify-center text-white font-extrabold text-xl shadow-lg shrink-0">
              DT
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight">Drive Therapy</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1074B1]/15 text-[#1074B1] dark:text-[#67b7e6] border border-[#1074B1]/30">
                  v2.2.0 Pro
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Non-Destructive Digital Asset Studio for Google Drive &amp; Local Media
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close (Esc)"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar text-xs">
          {/* Mission / Summary */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1074B1]/10 via-[#52B197]/10 to-transparent border border-[#1074B1]/20 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#BEBF61]" />
              <span>About the Application</span>
            </h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Drive Therapy is designed from the ground up for photographers, video creators, and archivists who store massive catalogs in Google Drive or local storage. It delivers lightning-fast speed culling, burst hero curation, true 100% RAW pixel-peeping, 3D LUT grading, and lossless video trimming directly inside modern browsers — without downloading gigabytes of cache files or altering source camera originals.
            </p>
          </div>

          {/* Feature Matrix Grid */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Core Capabilities &amp; Pro Workstation Tools
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {coreFeatures.map((feat, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/40 flex items-start gap-2.5"
                >
                  <div className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200/60 dark:border-slate-600 shrink-0">
                    {feat.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">{feat.title}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5">
                      {feat.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Developer Card (00face) */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#1074B1]" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Developer &amp; Creator
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">@00face</span>
            </div>

            <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
              Drive Therapy is engineered by <strong>00face</strong> as an open, accessible, high-performance web workstation that bridges professional creative workflows with cloud-native photo and video management.
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <a
                href="https://github.com/00face/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold text-xs flex items-center gap-2 hover:opacity-90 transition-opacity shadow-xs"
              >
                <Github className="w-3.5 h-3.5" />
                <span>github.com/00face</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>

              <a
                href="https://00face.github.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-[#1074B1] text-white font-semibold text-xs flex items-center gap-2 hover:bg-[#0e6397] transition-colors shadow-xs"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>00face.github.io</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className="p-4 border-t flex flex-wrap items-center justify-between gap-2.5 shrink-0 bg-slate-50/70 dark:bg-slate-900/70 text-xs"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-2">
            {onOpenWelcomeSplash && (
              <button
                onClick={() => {
                  onClose();
                  onOpenWelcomeSplash();
                }}
                className="px-3 py-1.5 rounded-xl bg-[#1074B1]/10 hover:bg-[#1074B1]/20 text-[#1074B1] dark:text-[#67b7e6] font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Welcome Tour</span>
              </button>
            )}

            {onOpenShortcuts && (
              <button
                onClick={() => {
                  onClose();
                  onOpenShortcuts();
                }}
                className="px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Hotkeys (?)</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-bold hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
