/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GIF Studio Modal (GifStudioModal.tsx)
 * Dedicated animated GIF inspector, speed/FPS tuning, reverse/boomerang looping,
 * resize & palette optimization, and Video-to-GIF conversion.
 */

import React, { useEffect, useState } from 'react';
import {
  X,
  Film,
  Sparkles,
  Download,
  Copy,
  Check,
  Repeat,
  ArrowLeftRight,
  Gauge,
} from 'lucide-react';
import { MediaAsset } from '../types';
import {
  DEFAULT_GIF_RECIPE,
  GifEditRecipe,
  estimateGifSizeBytes,
  generateGifFfmpegArgs,
} from '../services/gifStudioEngine';
import { resolveViewableAssetStreamUrl } from '../services/universalFileViewerEngine';

interface GifStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: MediaAsset | null;
  onExportSuccess?: (outputPath: string) => void;
}

export const GifStudioModal: React.FC<GifStudioModalProps> = ({
  isOpen,
  onClose,
  asset,
  onExportSuccess,
}) => {
  const [recipe, setRecipe] = useState<GifEditRecipe>(DEFAULT_GIF_RECIPE);
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    if (!asset) return;
    setRecipe({
      ...DEFAULT_GIF_RECIPE,
      endTime: Math.min(15, Math.max(1, asset.duration || 8)),
    });
    setStatusMessage(null);
  }, [asset]);

  if (!isOpen || !asset) return null;

  const isVideoSource = asset.category === 'video' || asset.mimeType?.startsWith('video/');
  const previewUrl = resolveViewableAssetStreamUrl(asset);
  const inputPath = asset.localPath || asset.path || asset.name;
  const outputPath = inputPath.replace(/\.[^.]+$/, '') + '_edited.gif';
  const ffmpegCli = ['ffmpeg', ...generateGifFfmpegArgs(inputPath, outputPath, recipe)].join(' ');
  const estimatedKB = Math.round(estimateGifSizeBytes(recipe) / 1024);

  const handleExport = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      if (asset.source === 'local' && asset.localPath) {
        const res = await fetch('/api/media/gif', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputPath: asset.localPath, recipe }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'GIF export failed');
        setStatusMessage(`Saved non-destructive GIF copy: ${data.fileName} (${Math.round((data.sizeBytes || 0) / 1024)} KB)`);
        onExportSuccess?.(data.outputPath);
      } else {
        await navigator.clipboard.writeText(ffmpegCli).catch(() => {});
        setStatusMessage('Cloud/remote asset: FFmpeg GIF command copied to clipboard for local render.');
      }
    } catch (err: any) {
      setStatusMessage(err?.message || 'GIF export error.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="GIF Studio"
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#A61B7A]/15 text-[#A61B7A]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                GIF Studio {isVideoSource ? '• Video to GIF' : '• Animated GIF Editor'}
              </h2>
              <p className="text-xs opacity-65 truncate max-w-md">{asset.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] rounded-xl hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center"
            aria-label="Close GIF Studio"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Live Preview Surface */}
          <div className="w-full aspect-video max-h-[260px] rounded-2xl bg-black overflow-hidden flex items-center justify-center border" style={{ borderColor: 'var(--theme-border)' }}>
            {isVideoSource ? (
              <video src={previewUrl} controls muted loop playsInline className="w-full h-full object-contain" />
            ) : (
              <img src={previewUrl} alt={asset.name} className="w-full h-full object-contain" />
            )}
          </div>

          {/* Trim Range */}
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 font-semibold">
              <span>Start Time (s)</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={recipe.startTime}
                onChange={(e) => setRecipe((r) => ({ ...r, startTime: Math.max(0, Number(e.target.value)) }))}
                className="w-full px-3 py-2 rounded-xl border bg-transparent font-mono"
                style={{ borderColor: 'var(--theme-border)' }}
              />
            </label>
            <label className="space-y-1 font-semibold">
              <span>End Time (s)</span>
              <input
                type="number"
                min={0.2}
                step={0.1}
                value={recipe.endTime}
                onChange={(e) => setRecipe((r) => ({ ...r, endTime: Math.max(r.startTime + 0.2, Number(e.target.value)) }))}
                className="w-full px-3 py-2 rounded-xl border bg-transparent font-mono"
                style={{ borderColor: 'var(--theme-border)' }}
              />
            </label>
          </div>

          {/* Speed, FPS, Resolution, Palette */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="space-y-1 font-semibold">
              <span className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5" /> Speed</span>
              <select
                value={recipe.speed}
                onChange={(e) => setRecipe((r) => ({ ...r, speed: Number(e.target.value) as GifEditRecipe['speed'] }))}
                className="w-full px-2.5 py-2 rounded-xl border bg-transparent"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <option value={0.25}>0.25x</option>
                <option value={0.5}>0.5x</option>
                <option value={1}>1.0x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2.0x</option>
                <option value={4}>4.0x</option>
              </select>
            </label>

            <label className="space-y-1 font-semibold">
              <span className="flex items-center gap-1"><Film className="w-3.5 h-3.5" /> FPS</span>
              <select
                value={recipe.fps}
                onChange={(e) => setRecipe((r) => ({ ...r, fps: Number(e.target.value) as GifEditRecipe['fps'] }))}
                className="w-full px-2.5 py-2 rounded-xl border bg-transparent"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <option value={10}>10 fps</option>
                <option value={15}>15 fps</option>
                <option value={24}>24 fps</option>
                <option value={30}>30 fps</option>
              </select>
            </label>

            <label className="space-y-1 font-semibold">
              <span>Width</span>
              <select
                value={recipe.width}
                onChange={(e) => setRecipe((r) => ({ ...r, width: Number(e.target.value) as GifEditRecipe['width'] }))}
                className="w-full px-2.5 py-2 rounded-xl border bg-transparent"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <option value={0}>Original</option>
                <option value={720}>720px</option>
                <option value={480}>480px</option>
                <option value={360}>360px</option>
                <option value={240}>240px</option>
              </select>
            </label>

            <label className="space-y-1 font-semibold">
              <span>Palette</span>
              <select
                value={recipe.colors}
                onChange={(e) => setRecipe((r) => ({ ...r, colors: Number(e.target.value) as GifEditRecipe['colors'] }))}
                className="w-full px-2.5 py-2 rounded-xl border bg-transparent"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <option value={64}>64 colors (Compact)</option>
                <option value={128}>128 colors</option>
                <option value={256}>256 colors (Crisp)</option>
              </select>
            </label>
          </div>

          {/* Motion Direction Toggles */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setRecipe((r) => ({ ...r, reverse: !r.reverse, boomerang: false }))}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 ${
                recipe.reverse ? 'bg-[#A61B7A] text-white border-[#A61B7A]' : ''
              }`}
              style={recipe.reverse ? undefined : { borderColor: 'var(--theme-border)' }}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Reverse</span>
            </button>

            <button
              type="button"
              onClick={() => setRecipe((r) => ({ ...r, boomerang: !r.boomerang, reverse: false }))}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 ${
                recipe.boomerang ? 'bg-[#1074B1] text-white border-[#1074B1]' : ''
              }`}
              style={recipe.boomerang ? undefined : { borderColor: 'var(--theme-border)' }}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Boomerang Loop</span>
            </button>

            <span className="ml-auto font-mono opacity-75">Est. output: ~{estimatedKB} KB</span>
          </div>

          {statusMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 font-semibold">
              {statusMessage}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--theme-border)' }}>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(ffmpegCli).catch(() => {});
              setCopiedCmd(true);
              setTimeout(() => setCopiedCmd(false), 2000);
            }}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCmd ? 'FFmpeg Copied' : 'Copy FFmpeg CLI'}</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExport}
            className="min-h-[40px] px-5 py-2 rounded-xl bg-gradient-to-r from-[#A61B7A] to-[#1074B1] text-white text-xs font-bold flex items-center gap-2 shadow-sm hover:opacity-95 disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Rendering GIF...' : 'Save Edited GIF Copy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
