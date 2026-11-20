/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Professional Lossless Video Trimmer Modal (A+ Pro Feature)
 * In/Out point trimming, SMPTE timecodes, visual scrub bar,
 * lossless FFmpeg command generator, and instant clip packaging.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Scissors,
  X,
  Play,
  Pause,
  Copy,
  Check,
  Download,
  AlertCircle,
  Film,
  RotateCcw,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  VolumeX,
  Volume2,
  Music,
  Sparkles,
} from 'lucide-react';
import { MediaAsset } from '../types';
import {
  formatTimecode,
  validateTrimRange,
  generateVideoEditFfmpegArgs,
  VideoCropAspect,
  VideoEditRecipe,
} from '../services/videoCurationEngine';
import { resolveViewableAssetStreamUrl } from '../services/universalFileViewerEngine';

export interface VideoTrimmerModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: MediaAsset | null;
  onTrimComplete?: (result: { startTime: number; endTime: number; duration: number; outputPath?: string }) => void;
  onOpenGifStudio?: (asset: MediaAsset) => void;
}

export const VideoTrimmerModal: React.FC<VideoTrimmerModalProps> = ({
  isOpen,
  onClose,
  asset,
  onTrimComplete,
  onOpenGifStudio,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(asset?.duration || 30);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(asset?.duration || 30);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [cropAspect, setCropAspect] = useState<VideoCropAspect>('free');
  const [speed, setSpeed] = useState<0.5 | 1 | 1.25 | 1.5 | 2>(1);
  const [muteAudio, setMuteAudio] = useState(false);
  const [extractAudioOnly, setExtractAudioOnly] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // Sync state when asset changes
  useEffect(() => {
    if (asset) {
      const dur = asset.duration && asset.duration > 0 ? asset.duration : 30;
      setTotalDuration(dur);
      setStartTime(0);
      setEndTime(dur);
      setCurrentTime(0);
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setCropAspect('free');
      setSpeed(1);
      setMuteAudio(false);
      setExtractAudioOnly(false);
      setIsPlaying(false);
      setExportComplete(false);
      setExportMessage(null);
    }
  }, [asset]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    videoRef.current.muted = muteAudio;
  }, [speed, muteAudio]);

  // Video time update handler
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.currentTime >= endTime) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.duration > 0) {
      const d = videoRef.current.duration;
      setTotalDuration(d);
      setEndTime(d);
    }
  };

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === '[') {
        e.preventDefault();
        setMarkIn();
      } else if (e.key === ']') {
        e.preventDefault();
        setMarkOut();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepTime(-0.1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepTime(0.1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentTime, startTime, endTime, totalDuration]);

  if (!isOpen || !asset) return null;

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (currentTime >= endTime || currentTime < startTime) {
        videoRef.current.currentTime = startTime;
        setCurrentTime(startTime);
      }
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const stepTime = (delta: number) => {
    if (!videoRef.current) return;
    const next = Math.max(0, Math.min(totalDuration, currentTime + delta));
    videoRef.current.currentTime = next;
    setCurrentTime(next);
  };

  const setMarkIn = () => {
    const newStart = Math.min(currentTime, Math.max(0, endTime - 0.2));
    setStartTime(newStart);
  };

  const setMarkOut = () => {
    const newEnd = Math.max(currentTime, Math.min(totalDuration, startTime + 0.2));
    setEndTime(newEnd);
  };

  const resetTrim = () => {
    setStartTime(0);
    setEndTime(totalDuration);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const validation = validateTrimRange(startTime, endTime, totalDuration);

  const editRecipe: VideoEditRecipe = {
    startTime,
    endTime,
    rotation,
    flipH,
    flipV,
    cropAspect,
    speed,
    muteAudio,
    extractAudioOnly,
  };

  // Compute FFmpeg args & display CLI string
  const inPath = asset.localPath || asset.path || asset.name;
  const outPath = extractAudioOnly
    ? inPath.replace(/(\.[^.]+)$/, '_audio.mp3')
    : inPath.replace(/(\.[^.]+)$/, '_edited$1');
  const { args: ffmpegArgs, isLosslessCopy } = generateVideoEditFfmpegArgs(inPath, outPath, editRecipe);
  const ffmpegCommand = ['ffmpeg', ...ffmpegArgs.map((a) => (a.includes(' ') ? `"${a}"` : a))].join(' ');
  const videoStreamSrc = resolveViewableAssetStreamUrl(asset);

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(ffmpegCommand);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleExecuteTrim = async () => {
    if (!validation.valid) return;
    setIsExporting(true);
    setExportMessage(null);
    try {
      const localInput = asset.localPath || (asset.source === 'local' ? asset.path : '');
      if (localInput) {
        const res = await fetch('/api/media/video-edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputPath: localInput, recipe: editRecipe }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Video edit export failed');
        setExportComplete(true);
        setExportMessage(`Saved non-destructive copy: ${data.fileName} (${Math.round((data.sizeBytes || 0) / 1024)} KB)`);
        onTrimComplete?.({
          startTime,
          endTime,
          duration: validation.clipDuration,
          outputPath: data.outputPath,
        });
      } else {
        await navigator.clipboard.writeText(ffmpegCommand).catch(() => {});
        setExportComplete(true);
        setExportMessage('Cloud video: FFmpeg edit command copied to clipboard.');
      }
    } catch (err: any) {
      setExportMessage(err?.message || 'Video export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  // Timeline scrub calculation
  const startPercent = totalDuration > 0 ? (startTime / totalDuration) * 100 : 0;
  const endPercent = totalDuration > 0 ? (endTime / totalDuration) * 100 : 100;
  const playheadPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = clickRatio * totalDuration;
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
    }
    setCurrentTime(targetTime);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Basic Video Editor {isLosslessCopy ? '• Lossless Trim' : '• FFmpeg Filter Graph'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                {asset.name} • Non-destructive copy export
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Stage */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div className="relative aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center group shadow-inner">
            {videoStreamSrc ? (
              <video
                ref={videoRef}
                src={videoStreamSrc}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain transition-transform"
                style={{
                  transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                }}
                playsInline
                crossOrigin="anonymous"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                <Film className="w-12 h-12 stroke-[1.5]" />
                <span className="text-xs">Video preview stream</span>
              </div>
            )}

            {/* Play/Pause Overlay */}
            <button
              onClick={togglePlayPause}
              className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Play/Pause (Space)"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
            </button>
          </div>

          {/* Timeline Bar */}
          <div className="space-y-2">
            <div
              className="relative h-9 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer select-none overflow-hidden border border-slate-200 dark:border-slate-700"
              onClick={handleTimelineClick}
            >
              {/* Active Trim Range Highlight */}
              <div
                className="absolute top-0 bottom-0 bg-amber-500/25 border-x-2 border-amber-500 transition-all pointer-events-none"
                style={{
                  left: `${startPercent}%`,
                  width: `${Math.max(0, endPercent - startPercent)}%`,
                }}
              />

              {/* Playhead Indicator */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-blue-500 z-10 transition-all pointer-events-none shadow"
                style={{ left: `${playheadPercent}%` }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 -ml-[3px] -mt-0.5 shadow" />
              </div>

              {/* Timecode markers */}
              <div className="absolute inset-0 flex justify-between items-center px-3 text-[10px] text-slate-400 font-mono pointer-events-none">
                <span>00:00.00</span>
                <span>{formatTimecode(totalDuration)}</span>
              </div>
            </div>

            {/* In / Out Mark Buttons & Timecode Inputs */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlayPause}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <button
                  onClick={setMarkIn}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Mark In Point ([)"
                >
                  <span>Mark In [</span>
                  <span className="font-mono text-[11px] font-bold">({formatTimecode(startTime)})</span>
                </button>

                <button
                  onClick={setMarkOut}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Mark Out Point (])"
                >
                  <span>Mark Out ]</span>
                  <span className="font-mono text-[11px] font-bold">({formatTimecode(endTime)})</span>
                </button>

                <button
                  onClick={resetTrim}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Reset to Full Video"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Current Playhead & Trim Duration */}
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500">
                  Current: <strong className="font-mono text-slate-800 dark:text-slate-200">{formatTimecode(currentTime)}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-medium">
                  Clip: <strong className="font-mono">{validation.clipDuration.toFixed(2)}s</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Basic Video Editing Controls: Rotate, Flip, Crop Aspect, Speed, Mute, Extract Audio, GIF */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setRotation((r) => (((r + 90) % 360) as 0 | 90 | 180 | 270))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold flex items-center gap-1 hover:border-amber-500"
              title="Rotate 90 degrees"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{rotation}°</span>
            </button>

            <button
              type="button"
              onClick={() => setFlipH((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg border font-semibold flex items-center gap-1 ${
                flipH ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-300 dark:border-slate-700'
              }`}
              title="Flip Horizontal"
            >
              <FlipHorizontal2 className="w-3.5 h-3.5" />
              <span>Flip H</span>
            </button>

            <button
              type="button"
              onClick={() => setFlipV((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg border font-semibold flex items-center gap-1 ${
                flipV ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-300 dark:border-slate-700'
              }`}
              title="Flip Vertical"
            >
              <FlipVertical2 className="w-3.5 h-3.5" />
              <span>Flip V</span>
            </button>

            <select
              value={cropAspect}
              onChange={(e) => setCropAspect(e.target.value as VideoCropAspect)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
              title="Crop Aspect Ratio"
            >
              <option value="free">Crop: Original</option>
              <option value="16:9">Crop: 16:9</option>
              <option value="9:16">Crop: 9:16 Vertical</option>
              <option value="1:1">Crop: 1:1 Square</option>
              <option value="4:5">Crop: 4:5 Portrait</option>
            </select>

            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value) as 0.5 | 1 | 1.25 | 1.5 | 2)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
              title="Playback & Export Speed"
            >
              <option value={0.5}>0.5x Speed</option>
              <option value={1}>1.0x Speed</option>
              <option value={1.25}>1.25x Speed</option>
              <option value={1.5}>1.5x Speed</option>
              <option value={2}>2.0x Speed</option>
            </select>

            <button
              type="button"
              onClick={() => setMuteAudio((m) => !m)}
              className={`px-2.5 py-1.5 rounded-lg border font-semibold flex items-center gap-1 ${
                muteAudio ? 'bg-rose-500 text-white border-rose-500' : 'border-slate-300 dark:border-slate-700'
              }`}
              title="Mute / Strip Audio Track"
            >
              {muteAudio ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{muteAudio ? 'Muted' : 'Audio On'}</span>
            </button>

            <button
              type="button"
              onClick={() => setExtractAudioOnly((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg border font-semibold flex items-center gap-1 ${
                extractAudioOnly ? 'bg-sky-500 text-white border-sky-500' : 'border-slate-300 dark:border-slate-700'
              }`}
              title="Extract MP3 Audio Track Only"
            >
              <Music className="w-3.5 h-3.5" />
              <span>Extract MP3</span>
            </button>

            {onOpenGifStudio && (
              <button
                type="button"
                onClick={() => onOpenGifStudio(asset)}
                className="ml-auto px-2.5 py-1.5 rounded-lg bg-[#A61B7A]/15 text-[#A61B7A] font-bold flex items-center gap-1 hover:bg-[#A61B7A]/25"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Convert to GIF</span>
              </button>
            )}
          </div>

          {exportMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-xs font-semibold">
              {exportMessage}
            </div>
          )}

          {/* Validation Notice if Error */}
          {!validation.valid && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{validation.error}</span>
            </div>
          )}

          {/* Lossless FFmpeg CLI String */}
          <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 text-xs space-y-1.5 font-mono">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans">
              <span>Native Lossless FFmpeg Command</span>
              <button
                onClick={handleCopyCommand}
                className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold"
              >
                {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCmd ? 'Copied CLI Command!' : 'Copy Command'}</span>
              </button>
            </div>
            <div className="p-2 rounded bg-black/60 overflow-x-auto select-all text-[11px] text-emerald-400">
              {ffmpegCommand}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span>Hotkeys:</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono">Space</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono">[</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono">]</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono">← / →</kbd>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!validation.valid || isExporting}
              onClick={handleExecuteTrim}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white shadow flex items-center gap-2 transition-colors"
            >
              {exportComplete ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Trimmed & Ready</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>{isExporting ? 'Packaging Clip...' : 'Export Trimmed Video'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
