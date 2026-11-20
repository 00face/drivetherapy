/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Batch Renamer Modal Component (A+ Tier)
 * Interactive live side-by-side diff preview, token insertion chips,
 * preset management, collision warnings, and batch execution progress.
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  X,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Settings,
  RefreshCw,
  Sliders,
  Type,
  Search,
} from 'lucide-react';
import { MediaAsset } from '../types';
import {
  BatchRenamePatternConfig,
  generateBatchRenamePreview,
  BATCH_RENAME_PRESETS,
} from '../services/batchRenamer';

interface BatchRenamerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAssets: MediaAsset[];
  onExecuteRename: (renames: Array<{ asset: MediaAsset; newName: string }>) => Promise<void>;
}

export const BatchRenamerModal: React.FC<BatchRenamerModalProps> = ({
  isOpen,
  onClose,
  selectedAssets,
  onExecuteRename,
}) => {
  const [pattern, setPattern] = useState('{date:YYYYMMDD}_{camera}_{seq:001}');
  const [startSeq, setStartSeq] = useState(1);
  const [seqStep, setSeqStep] = useState(1);
  const [searchString, setSearchString] = useState('');
  const [replaceString, setReplaceString] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [caseTransformation, setCaseTransformation] = useState<'none' | 'lowercase' | 'uppercase' | 'titlecase'>('none');
  const [spaceReplacement, setSpaceReplacement] = useState<'none' | 'underscore' | 'hyphen'>('underscore');
  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState(0);

  const config: BatchRenamePatternConfig = useMemo(() => ({
    pattern,
    startSequence: startSeq,
    sequenceStep: seqStep,
    searchString: searchString.trim() || undefined,
    replaceString,
    useRegex,
    caseTransformation,
    spaceReplacement,
  }), [pattern, startSeq, seqStep, searchString, replaceString, useRegex, caseTransformation, spaceReplacement]);

  const previews = useMemo(() => {
    return generateBatchRenamePreview(selectedAssets, config);
  }, [selectedAssets, config]);

  const hasCollisions = useMemo(() => {
    return previews.some((p) => p.hasCollision);
  }, [previews]);

  if (!isOpen) return null;

  const handleInsertToken = (token: string) => {
    setPattern((prev) => `${prev}${token}`);
  };

  const handleApplyPreset = (presetPattern: string) => {
    setPattern(presetPattern);
  };

  const handleCommit = async () => {
    if (hasCollisions || isExecuting) return;
    setIsExecuting(true);
    setProgress(10);

    const renames = previews.map((p, idx) => ({
      asset: selectedAssets[idx],
      newName: p.newFilenameWithExt,
    }));

    try {
      await onExecuteRename(renames);
      setProgress(100);
      setTimeout(() => {
        setIsExecuting(false);
        onClose();
      }, 400);
    } catch {
      setIsExecuting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-renamer-title"
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all theme-card"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
      >
        {/* Top Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-[#1074B1]/10 text-[#1074B1] dark:text-[#38BDF8]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 id="batch-renamer-title" className="text-base font-bold tracking-tight">
                Tokenized Batch Renamer
              </h2>
              <p className="text-xs text-hint-inline">
                Renaming {selectedAssets.length} selected assets with live side-by-side diff
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isExecuting}
            className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Configuration Controls */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Presets Bar */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-hint-inline">
              Quick Presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              {BATCH_RENAME_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleApplyPreset(p.pattern)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                    pattern === p.pattern
                      ? 'bg-[#1074B1] text-white border-[#1074B1] shadow-xs'
                      : 'border-slate-200/80 dark:border-slate-700/80 hover:border-[#1074B1] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  title={p.description}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Pattern Builder Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold block" htmlFor="rename-pattern-input">
              Pattern Formula
            </label>
            <div className="flex gap-2">
              <input
                id="rename-pattern-input"
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="{date:YYYYMMDD}_{camera}_{seq:001}"
                className="flex-1 px-3.5 py-2 rounded-xl text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-black/40 focus:outline-hidden focus:ring-2 focus:ring-[#1074B1]"
              />
              <button
                onClick={() => setPattern('{filename}')}
                className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-black/5 dark:hover:bg-white/5"
                title="Reset to original filename"
              >
                Reset
              </button>
            </div>

            {/* Token Insertion Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-hint-inline mr-1">
                Insert:
              </span>
              {[
                { label: '+ Date', token: '{date:YYYYMMDD}' },
                { label: '+ Time', token: '{time:HHmmss}' },
                { label: '+ Seq (001)', token: '{seq:001}' },
                { label: '+ Camera', token: '{camera}' },
                { label: '+ Lens', token: '{lens}' },
                { label: '+ ISO', token: '{iso}' },
                { label: '+ Aperture', token: '{aperture}' },
                { label: '+ Rating', token: '{stars}' },
                { label: '+ Filename', token: '{filename}' },
              ].map((chip) => (
                <button
                  key={chip.token}
                  onClick={() => handleInsertToken(chip.token)}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-800/80 hover:bg-[#1074B1]/15 hover:text-[#1074B1] border border-slate-200/60 dark:border-slate-700/60 transition-colors"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sequence & Search Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-slate-200/60 dark:border-slate-800/60 text-xs">
            {/* Seq start */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-hint-inline">Start Sequence</label>
              <input
                type="number"
                min={1}
                value={startSeq}
                onChange={(e) => setStartSeq(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-black/40"
              />
            </div>

            {/* Find / Replace */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-hint-inline">Find Text / Regex</label>
              <input
                type="text"
                value={searchString}
                onChange={(e) => setSearchString(e.target.value)}
                placeholder="Optional text to replace"
                className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-black/40"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-hint-inline">Replace With</label>
              <input
                type="text"
                value={replaceString}
                onChange={(e) => setReplaceString(e.target.value)}
                placeholder="Replacement text"
                className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-black/40"
              />
            </div>
          </div>

          {/* Live Side-by-Side Diff Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">
                Live Diff Preview ({previews.length} assets)
              </span>
              {hasCollisions ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[11px] font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Collision Detected: Adjust formula to ensure unique names</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>All filenames unique and safe</span>
                </div>
              )}
            </div>

            <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-black/5 dark:bg-white/5 border-b border-slate-200/60 dark:border-slate-800 sticky top-0 backdrop-blur-sm">
                  <tr>
                    <th className="py-2 px-3 font-semibold text-hint-inline">#</th>
                    <th className="py-2 px-3 font-semibold text-hint-inline">Original Filename</th>
                    <th className="py-2 px-3 font-semibold text-hint-inline"></th>
                    <th className="py-2 px-3 font-semibold text-hint-inline">New Filename</th>
                    <th className="py-2 px-3 font-semibold text-hint-inline">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 font-mono text-[11px]">
                  {previews.map((item, index) => (
                    <tr
                      key={item.assetId}
                      className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                        item.hasCollision ? 'bg-rose-500/10' : ''
                      }`}
                    >
                      <td className="py-2 px-3 opacity-60">{index + 1}</td>
                      <td className="py-2 px-3 truncate max-w-[200px]" title={item.originalName}>
                        {item.originalName}
                      </td>
                      <td className="py-2 px-1 text-slate-400">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </td>
                      <td
                        className={`py-2 px-3 font-bold truncate max-w-[260px] ${
                          item.hasCollision ? 'text-rose-600 dark:text-rose-400' : 'text-[#1074B1] dark:text-[#38BDF8]'
                        }`}
                        title={item.newFilenameWithExt}
                      >
                        {item.newFilenameWithExt}
                      </td>
                      <td className="py-2 px-3">
                        {item.hasCollision ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                            Collision
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                            Ready
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div
          className="flex items-center justify-between px-6 py-4 border-t shrink-0 bg-black/5 dark:bg-white/5"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="text-xs text-hint-inline">
            Non-destructive: Updates catalog metadata and disk handles safely
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isExecuting}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-black/5 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={handleCommit}
              disabled={hasCollisions || isExecuting || previews.length === 0}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#1074B1] hover:bg-[#0d5d8e] text-white shadow-md disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-2"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Renaming...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Apply Batch Rename ({previews.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
