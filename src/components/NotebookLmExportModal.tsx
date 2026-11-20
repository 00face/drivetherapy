/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google NotebookLM Multi-Asset Dossier Export Modal
 * Compiles photo culls, audio transcripts, video logs, and PDF briefs
 * into a structured dossier ready for NotebookLM audio podcast generation.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  ExternalLink,
  Download,
  Copy,
  Check,
  Sparkles,
  FileText,
  Headphones,
  Camera,
  Film,
  CheckCircle2,
} from 'lucide-react';
import { MediaAsset } from '../types';
import {
  notebookLmDossierGenerator,
  GeneratedDossier,
} from '../services/notebookLmDossierGenerator';
import { useTranslation } from '../i18n';

interface NotebookLmExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: MediaAsset[];
  initialProjectName?: string;
}

export const NotebookLmExportModal: React.FC<NotebookLmExportModalProps> = ({
  isOpen,
  onClose,
  assets,
  initialProjectName = 'Commercial Photo & Video Production',
}) => {
  const { t } = useTranslation();

  const [projectName, setProjectName] = useState(initialProjectName);
  const [clientName, setClientName] = useState('Brand Studio Archive');
  const [location, setLocation] = useState('San Francisco, CA');
  const [notes, setNotes] = useState('Captured high-priority burst sequences and voice memos for client deliverables.');
  const [dossier, setDossier] = useState<GeneratedDossier | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewTab, setPreviewTab] = useState<'preview' | 'markdown'>('preview');

  useEffect(() => {
    if (isOpen) {
      const generated = notebookLmDossierGenerator.generateDossier({
        projectName,
        clientName,
        location,
        assets,
        notes,
      });
      setDossier(generated);
    }
  }, [isOpen, projectName, clientName, location, notes, assets.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !dossier) return null;

  const handleDownload = () => {
    notebookLmDossierGenerator.downloadMarkdown(dossier);
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(dossier.markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      aria-modal="true"
      role="dialog"
      aria-label="Export to Google NotebookLM"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl theme-card overflow-hidden animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-4 sm:p-5 border-b flex items-center justify-between gap-3 shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#52B197]/15 text-[#52B197] flex items-center justify-center font-bold shrink-0">
              <BookOpen className="w-5 h-5 text-[#52B197]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight">
                  NotebookLM Studio Dossier
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#52B197]/15 text-[#298d75] dark:text-[#52B197]">
                  Google AI Source
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Compiles multi-format assets into an AI podcast-ready research notebook
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

        {/* Configuration Bar */}
        <div className="p-4 border-b bg-slate-50/60 dark:bg-slate-800/40 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs" style={{ borderColor: 'var(--theme-border)' }}>
          <div>
            <label className="font-semibold block text-slate-600 dark:text-slate-300 mb-1">Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-xs"
            />
          </div>
          <div>
            <label className="font-semibold block text-slate-600 dark:text-slate-300 mb-1">Client / Subject</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-xs"
            />
          </div>
          <div>
            <label className="font-semibold block text-slate-600 dark:text-slate-300 mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-xs"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar space-y-4 text-xs">
          {/* Multi-Format Asset Tally Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#1074B1]" />
              <div>
                <span className="font-bold block">{dossier.stats.photosCount} Photos</span>
                <span className="text-[10px] text-slate-400">{dossier.stats.rawCount} RAW captures</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <Film className="w-4 h-4 text-[#A61B7A]" />
              <div>
                <span className="font-bold block">{dossier.stats.videosCount} Videos</span>
                <span className="text-[10px] text-slate-400">Motion takes</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <Headphones className="w-4 h-4 text-[#52B197]" />
              <div>
                <span className="font-bold block">{dossier.stats.audioCount} Voice Memos</span>
                <span className="text-[10px] text-slate-400">Audio notes</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <div>
                <span className="font-bold block">{dossier.stats.pickedCount} Approved</span>
                <span className="text-[10px] text-slate-400">{dossier.stats.rejectedCount} Culled out</span>
              </div>
            </div>
          </div>

          {/* Tab Switcher: Formatted Preview vs Raw Markdown */}
          <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--theme-border)' }}>
            <button
              onClick={() => setPreviewTab('preview')}
              className={`px-3 py-1 rounded-lg font-bold text-xs ${
                previewTab === 'preview'
                  ? 'bg-[#1074B1] text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Document Preview
            </button>
            <button
              onClick={() => setPreviewTab('markdown')}
              className={`px-3 py-1 rounded-lg font-bold text-xs ${
                previewTab === 'markdown'
                  ? 'bg-[#1074B1] text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Raw Markdown (.md)
            </button>
          </div>

          {/* Dossier Viewer */}
          <div
            className="p-4 rounded-2xl border font-sans text-xs leading-relaxed max-h-96 overflow-y-auto custom-scrollbar"
            style={{
              backgroundColor: 'var(--theme-surface)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text)',
            }}
          >
            {previewTab === 'preview' ? (
              <iframe
                title="NotebookLM Dossier Preview"
                sandbox=""
                srcDoc={dossier.htmlContent}
                className="w-full h-80 rounded-xl border-0 bg-white"
              />
            ) : (
              <pre className="font-mono text-[11px] whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                {dossier.markdownContent}
              </pre>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className="p-3.5 border-t flex flex-wrap items-center justify-between gap-2.5 shrink-0 bg-slate-50/70 dark:bg-slate-900/70 text-xs"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Markdown' : 'Copy Text'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-xl bg-[#1074B1]/10 hover:bg-[#1074B1]/20 text-[#1074B1] dark:text-[#67b7e6] font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Dossier (.md)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://notebooklm.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#1074B1] to-[#52B197] hover:opacity-95 text-white font-bold flex items-center gap-2 shadow-md transition-all active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4 text-[#BEBF61]" />
              <span>Open Google NotebookLM</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>

            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
