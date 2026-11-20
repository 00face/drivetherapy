/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Professional Batch Export & Watermarking Modal
 * Provides web/print presets, 5-point anchor watermark overlays,
 * privacy EXIF scrubbing (GPS/serials), and instant ZIP archive packaging.
 */

import React, { useState } from 'react';
import {
  Download,
  X,
  Shield,
  Layers,
  Sparkles,
  CheckCircle2,
  Lock,
  Eye,
  Sliders,
  Archive,
  Loader2,
} from 'lucide-react';
import { MediaAsset } from '../types';
import {
  EXPORT_PRESETS,
  ExportPresetConfig,
  WatermarkOptions,
  packageBatchExportZip,
} from '../services/batchExporter';

interface BatchExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAssets: MediaAsset[];
  onComplete?: (exportedCount: number) => void;
}

export const BatchExportModal: React.FC<BatchExportModalProps> = ({
  isOpen,
  onClose,
  selectedAssets,
  onComplete,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('web_pro_2048');
  const [enableWatermark, setEnableWatermark] = useState<boolean>(true);
  const [watermarkText, setWatermarkText] = useState<string>('© Drive Therapy · Client Proof');
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkOptions['position']>('bottom-right');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.65);
  const [stripGps, setStripGps] = useState<boolean>(true);
  const [stripSerial, setStripSerial] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentPreset = EXPORT_PRESETS.find((p) => p.id === selectedPresetId) || EXPORT_PRESETS[0];

  const handleExport = async () => {
    if (selectedAssets.length === 0) {
      setErrorMsg('No assets selected for export.');
      return;
    }

    setIsExporting(true);
    setProgress(15);
    setErrorMsg(null);

    try {
      const watermarkOpts: WatermarkOptions | undefined = enableWatermark
        ? {
            enabled: true,
            type: 'text',
            text: watermarkText,
            position: watermarkPosition,
            opacity: watermarkOpacity,
            fontSize: 24,
          }
        : undefined;

      setProgress(40);

      const zipBytes = await packageBatchExportZip(
        selectedAssets,
        currentPreset,
        watermarkOpts,
        stripGps,
        stripSerial
      );

      setProgress(85);

      // Trigger instant browser download
      const blob = new Blob([zipBytes as any], { type: 'application/zip' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `drivetherapy_export_${selectedPresetId}_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);

      setProgress(100);
      onComplete?.(selectedAssets.length);
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Export packaging failed');
      setIsExporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-export-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 select-none"
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl border shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
        style={{
          backgroundColor: 'var(--theme-surface, #ffffff)',
          borderColor: 'var(--theme-border, #e2e8f0)',
          color: 'var(--theme-text, #0f172a)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#1074B1]/10 flex items-center justify-center text-[#1074B1]">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h2 id="batch-export-title" className="text-base font-bold tracking-tight">
                Batch Export &amp; Watermarking Studio
              </h2>
              <p className="text-xs opacity-75">
                Packaging {selectedAssets.length} selected {selectedAssets.length === 1 ? 'asset' : 'assets'} with custom profiles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Configuration Body */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar text-xs">
          {/* Preset Selector */}
          <div className="space-y-2">
            <label className="font-bold uppercase tracking-wider text-[11px] opacity-80 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#1074B1]" />
              <span>Target Export Preset</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {EXPORT_PRESETS.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={`p-3 rounded-2xl text-left border transition-all ${
                      isSelected
                        ? 'border-[#1074B1] bg-[#1074B1]/10 font-bold ring-2 ring-[#1074B1]/30 shadow-xs'
                        : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs">{preset.name}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#1074B1]" />}
                    </div>
                    <p className="text-[11px] opacity-75 line-clamp-2">{preset.description}</p>
                    <div className="mt-2 text-[10px] font-mono opacity-80">
                      {preset.maxDimension ? `Max ${preset.maxDimension}px · ` : 'Full Res · '}
                      {preset.quality ? `${Math.round(preset.quality * 100)}% Q` : 'Lossless'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Privacy & EXIF Scrubbing */}
          <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-xs text-emerald-800 dark:text-emerald-300">
                Privacy Shield &amp; Sensitive EXIF Stripping
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-black/20">
                <input
                  type="checkbox"
                  checked={stripGps}
                  onChange={(e) => setStripGps(e.target.checked)}
                  className="rounded text-[#1074B1] focus:ring-[#1074B1] w-4 h-4"
                />
                <span>Scrub GPS Coordinates (Prevent Location Leak)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-black/20">
                <input
                  type="checkbox"
                  checked={stripSerial}
                  onChange={(e) => setStripSerial(e.target.checked)}
                  className="rounded text-[#1074B1] focus:ring-[#1074B1] w-4 h-4"
                />
                <span>Scrub Camera Serial Numbers</span>
              </label>
            </div>
          </div>

          {/* Watermarking Studio */}
          <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#1074B1]" />
                <span className="font-bold text-xs">Proof Watermark Overlay</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-[11px] opacity-75 font-semibold">Enable Watermark</span>
                <input
                  type="checkbox"
                  checked={enableWatermark}
                  onChange={(e) => setEnableWatermark(e.target.checked)}
                  className="rounded text-[#1074B1] focus:ring-[#1074B1] w-4 h-4"
                />
              </label>
            </div>

            {enableWatermark && (
              <div className="space-y-3 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                <div>
                  <label className="block text-[11px] font-bold opacity-75 mb-1">Watermark Text</label>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="© 2026 Studio Name · Proof"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-black/5 dark:bg-white/5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1074B1]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Position Quadrant */}
                  <div>
                    <label className="block text-[11px] font-bold opacity-75 mb-1">Anchor Position</label>
                    <select
                      value={watermarkPosition}
                      onChange={(e) => setWatermarkPosition(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-black/5 dark:bg-white/5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1074B1]"
                    >
                      <option value="bottom-right">Bottom Right (Canonical Proof)</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="center">Center Stamp (Theft Protection)</option>
                      <option value="top-right">Top Right</option>
                      <option value="top-left">Top Left</option>
                    </select>
                  </div>

                  {/* Opacity Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold opacity-75">Overlay Opacity</label>
                      <span className="font-mono text-[11px] opacity-80">{Math.round(watermarkOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1.0}
                      step={0.05}
                      value={watermarkOpacity}
                      onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                      className="w-full h-2 accent-[#1074B1] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer Actions & Progress */}
        <div className="p-5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 bg-black/5 dark:bg-white/5">
          <div className="flex-1 min-w-0">
            {isExporting ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span>Compressing ZIP Archive...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-[#1074B1] transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <span className="text-[11px] opacity-75">
                Output: <strong className="font-mono">{selectedPresetId}.zip</strong> (Instant local generation)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || selectedAssets.length === 0}
              className="px-5 py-2.5 rounded-xl bg-[#1074B1] hover:bg-[#0d6194] text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Packaging...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Packaged ZIP</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
