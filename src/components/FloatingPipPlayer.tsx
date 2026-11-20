/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Floating Picture-in-Picture (PiP) Context-Aware Overlay
 * Adapts layout & controls automatically based on contextMode and file format:
 *  - music-queue: Synced with Media Studio queue (Prev/Next, Shuffle, Repeat, Lyrics CC, Speed, Return to Studio)
 *  - standalone-media: Direct video/audio stream (Seek, Loop, Speed 0.5x-2x, Native PiP, Video Trimmer handoff)
 *  - reference-pin: Pinned photo/RAW (Zoom 50%-300%, Studio handoff) or Pinned code/markdown/PDF reference card
 *  - Interactive window chrome: Compact / Standard / Large presets + 4-corner viewport snap + collapse toggle
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Tv,
  Film,
  Music,
  Move,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Subtitles,
  ZoomIn,
  ZoomOut,
  Pin,
  Scissors,
  Sliders,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  FileText,
} from 'lucide-react';
import type { MediaAsset } from '../types';
import { universalMediaPlayer } from '../services/universalMediaPlayerEngine';
import { googleMusicEngine, GoogleMusicState } from '../services/googleMusicEngine';
import { resolveTrackUrl } from '../services/music/musicPlayback';
import { lookupFileFormat } from '../services/fileFormatEngine';
import {
  loadAssetContentSample,
  PipContextMode,
  resolveViewableAssetStreamUrl,
} from '../services/universalFileViewerEngine';

export interface FloatingPipPlayerProps {
  asset: MediaAsset | null;
  contextMode?: PipContextMode;
  onClose: () => void;
  onExpandFullscreen?: (asset: MediaAsset) => void;
  onOpenMusicPlayer?: () => void;
  onOpenEditor?: (asset: MediaAsset) => void;
  onTrimVideo?: (asset: MediaAsset) => void;
}

type PipWindowSize = 'compact' | 'standard' | 'large';

const SPEED_STEPS = [0.75, 1.0, 1.25, 1.5, 2.0];

function formatPipTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const FloatingPipPlayer: React.FC<FloatingPipPlayerProps> = ({
  asset,
  contextMode,
  onClose,
  onExpandFullscreen,
  onOpenMusicPlayer,
  onOpenEditor,
  onTrimVideo,
}) => {
  const [musicState, setMusicState] = useState<GoogleMusicState>(() => googleMusicEngine.getState());
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(120);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showCaptions, setShowCaptions] = useState(true);
  const [refZoom, setRefZoom] = useState(1.0);
  const [refText, setRefText] = useState('');
  const [copiedRef, setCopiedRef] = useState(false);
  const [sizeMode, setSizeMode] = useState<PipWindowSize>('standard');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      return { x: Math.max(12, window.innerWidth - 360), y: Math.max(12, window.innerHeight - 280) };
    }
    return { x: 100, y: 100 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number }>({
    mouseX: 0,
    mouseY: 0,
    posX: 0,
    posY: 0,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    return googleMusicEngine.subscribe((next) => setMusicState(next));
  }, []);

  const fmt = useMemo(
    () => (asset ? lookupFileFormat(asset.name, asset.mimeType) : null),
    [asset]
  );

  const isVideo = Boolean(
    asset && (fmt?.viewer === 'video-player' || asset.category === 'video')
  );
  const isAudio = Boolean(
    asset && (fmt?.viewer === 'audio-player' || asset.category === 'audio')
  );
  const effectiveContext: PipContextMode = useMemo(() => {
    if (contextMode) return contextMode;
    if (isVideo || isAudio) return 'standalone-media';
    return 'reference-pin';
  }, [contextMode, isVideo, isAudio]);

  const queueMediaUrl =
    effectiveContext === 'music-queue'
      ? resolveTrackUrl(musicState.currentTrack) || musicState.currentTrack.albumArtUrl
      : undefined;

  const mediaUrl = asset
    ? queueMediaUrl || resolveViewableAssetStreamUrl(asset) || asset.thumbnailUrl
    : undefined;

  const displayTitle =
    effectiveContext === 'music-queue'
      ? `${musicState.currentTrack.title} • ${musicState.currentTrack.artist}`
      : asset?.name || '';

  // Initialize playback or reference content when asset / context changes
  useEffect(() => {
    if (!asset) return;
    setRefZoom(1.0);
    setCurrentTime(0);

    if (effectiveContext === 'reference-pin') {
      if (fmt && fmt.viewer !== 'image-lightbox' && fmt.viewer !== 'raw-demosaic-viewer' && fmt.viewer !== 'pdf-viewer') {
        loadAssetContentSample(asset, 8192).then((sample) => setRefText(sample.text));
      } else {
        setRefText('');
      }
      return;
    }

    if (isVideo && videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else if (mediaUrl) {
      universalMediaPlayer.loadMedia(mediaUrl, displayTitle);
      universalMediaPlayer.setPlaybackRate(playbackSpeed);
      universalMediaPlayer.play();
      setIsPlaying(true);
    }
  }, [asset?.id, effectiveContext, musicState.currentTrack.id, isVideo, mediaUrl]);

  // Waveform animation loop for audio streams
  useEffect(() => {
    if (effectiveContext === 'reference-pin' || isVideo || isCollapsed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const waveform = universalMediaPlayer.getWaveformData();

      ctx.beginPath();
      ctx.strokeStyle = '#52B197';
      ctx.lineWidth = 2;

      for (let i = 0; i < canvas.width; i += 3) {
        const idx = Math.floor((i / canvas.width) * waveform.length);
        const val = waveform[idx] || 128;
        const normalized = (val - 128) / 128;
        const y =
          canvas.height / 2 +
          (isPlaying ? normalized * 24 : Math.sin(phase + i * 0.1) * 3);
        if (i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
      }

      ctx.stroke();
      phase += 0.08;
      animRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [effectiveContext, isVideo, isPlaying, isCollapsed]);

  // Dragging logic with viewport clamping
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const widthEstimate = sizeMode === 'large' ? 440 : sizeMode === 'compact' ? 288 : 340;

      const newX = Math.max(10, Math.min(window.innerWidth - widthEstimate, dragStartRef.current.posX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 160, dragStartRef.current.posY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, sizeMode]);

  if (!asset) return null;

  const snapCorner = (corner: 'tl' | 'tr' | 'bl' | 'br') => {
    if (typeof window === 'undefined') return;
    const widthEstimate = sizeMode === 'large' ? 448 : sizeMode === 'compact' ? 288 : 352;
    const heightEstimate = isCollapsed ? 64 : 290;
    const pad = 16;
    const x = corner === 'tl' || corner === 'bl' ? pad : Math.max(pad, window.innerWidth - widthEstimate - pad);
    const y = corner === 'tl' || corner === 'tr' ? pad : Math.max(pad, window.innerHeight - heightEstimate - pad - 48);
    setPosition({ x, y });
  };

  const handleTogglePlay = () => {
    if (isVideo && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } else {
      universalMediaPlayer.togglePlay();
      setIsPlaying((prev) => !prev);
    }
  };

  const handleCycleSpeed = () => {
    const idx = SPEED_STEPS.indexOf(playbackSpeed);
    const next = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
    setPlaybackSpeed(next);
    if (isVideo && videoRef.current) {
      videoRef.current.playbackRate = next;
    } else {
      universalMediaPlayer.setPlaybackRate(next);
    }
  };

  const handleTriggerNativePip = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      } catch (err) {
        console.warn('Native PiP not available:', err);
      }
    }
  };

  const widthClass =
    sizeMode === 'compact'
      ? 'w-72'
      : sizeMode === 'large'
      ? 'w-[420px] sm:w-[460px]'
      : 'w-80 sm:w-96';

  const contextLabel =
    effectiveContext === 'music-queue'
      ? 'Media Queue'
      : effectiveContext === 'reference-pin'
      ? 'Reference Pin'
      : 'Media Player';

  return (
    <div
      className={`fixed z-50 ${widthClass} rounded-2xl shadow-2xl border backdrop-blur-md overflow-hidden animate-in zoom-in-95 duration-150 select-none flex flex-col`}
      style={{
        left: position.x,
        top: position.y,
        backgroundColor: 'var(--theme-surface)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text-auto, var(--theme-text))',
      }}
      role="region"
      aria-label={`Floating PiP: ${displayTitle}`}
    >
      {/* Draggable Title & Context Chrome */}
      <div
        onMouseDown={(e) => {
          setIsDragging(true);
          dragStartRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            posX: position.x,
            posY: position.y,
          };
        }}
        className="px-2.5 py-1.5 border-b flex items-center justify-between gap-1 cursor-grab active:cursor-grabbing bg-black/5 dark:bg-white/5"
        style={{ borderColor: 'var(--theme-border)' }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Move className="w-3 h-3 opacity-50 shrink-0" />
          {effectiveContext === 'reference-pin' ? (
            <Pin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          ) : isVideo ? (
            <Film className="w-3.5 h-3.5 text-sky-500 shrink-0" />
          ) : (
            <Music className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          )}
          <span className="font-bold text-xs truncate max-w-[130px] sm:max-w-[175px]" title={displayTitle}>
            {displayTitle}
          </span>
          <span className="px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 text-[9px] font-mono font-bold uppercase shrink-0">
            {contextLabel}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
          {/* Window size cycle */}
          <button
            type="button"
            onClick={() =>
              setSizeMode((s) => (s === 'compact' ? 'standard' : s === 'standard' ? 'large' : 'compact'))
            }
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-[10px] font-mono font-bold opacity-75 hover:opacity-100"
            title={`Cycle PiP size (${sizeMode})`}
          >
            {sizeMode === 'compact' ? 'S' : sizeMode === 'standard' ? 'M' : 'L'}
          </button>

          {/* Collapse / Expand body */}
          <button
            type="button"
            onClick={() => setIsCollapsed((c) => !c)}
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 opacity-75 hover:opacity-100"
            title={isCollapsed ? 'Expand PiP stage' : 'Compact mini bar'}
            aria-label={isCollapsed ? 'Expand PiP stage' : 'Compact mini bar'}
          >
            {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {isVideo && (
            <button
              type="button"
              onClick={handleTriggerNativePip}
              className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 opacity-75 hover:opacity-100"
              title="Browser Native PiP"
              aria-label="Browser Native Picture-in-Picture"
            >
              <Tv className="w-3.5 h-3.5 text-sky-500" />
            </button>
          )}

          {onExpandFullscreen && (
            <button
              type="button"
              onClick={() => {
                onExpandFullscreen(asset);
                onClose();
              }}
              className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 opacity-75 hover:opacity-100"
              title="Expand to Universal Lightbox Viewer"
              aria-label="Expand to Fullscreen Viewer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 opacity-75 hover:opacity-100"
            title="Close PiP"
            aria-label="Close PiP Window"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive Stage Body */}
      {!isCollapsed && (
        <div className="relative bg-black flex items-center justify-center h-44 overflow-hidden">
          {effectiveContext === 'reference-pin' ? (
            fmt?.viewer === 'image-lightbox' || fmt?.viewer === 'raw-demosaic-viewer' ? (
              <img
                src={mediaUrl}
                alt={asset.name}
                style={{ transform: `scale(${refZoom})` }}
                className="w-full h-full object-contain transition-transform duration-150"
                crossOrigin="anonymous"
              />
            ) : fmt?.viewer === 'pdf-viewer' && mediaUrl ? (
              <iframe src={mediaUrl} title={asset.name} className="w-full h-full bg-white" />
            ) : (
              <div className="w-full h-full overflow-y-auto p-3 bg-slate-950 text-slate-200 font-mono text-[10px] leading-relaxed select-text">
                {refText || `${asset.name} (${fmt?.name || asset.extension})`}
              </div>
            )
          ) : isVideo ? (
            <video
              ref={videoRef}
              src={mediaUrl}
              poster={asset.thumbnailUrl}
              autoPlay
              playsInline
              loop={isLooping}
              muted={isMuted}
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                  setDuration(videoRef.current.duration || 120);
                }
              }}
              onEnded={() => setIsPlaying(false)}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-3 gap-2 relative">
              <canvas ref={canvasRef} width={320} height={64} className="w-full h-16" />
              <div className="text-[10px] font-mono text-slate-300 uppercase tracking-wider">
                {fmt?.extension || 'AUDIO'} • {effectiveContext === 'music-queue' ? 'Queue Sync' : 'Lossless Waveform'}
              </div>
              {effectiveContext === 'music-queue' && showCaptions && musicState.currentTrack.lyrics && (
                <div className="px-2.5 py-1 rounded-lg bg-white/10 text-white text-[10px] truncate max-w-[92%]">
                  {musicState.currentTrack.lyrics[0]}
                </div>
              )}
            </div>
          )}

          {/* Quick Corner Snap Pill Overlay */}
          <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-black/60 backdrop-blur-xs rounded-lg p-0.5 border border-white/10 opacity-75 hover:opacity-100">
            {(
              [
                { id: 'tl', label: '↖', title: 'Snap Top-Left' },
                { id: 'tr', label: '↗', title: 'Snap Top-Right' },
                { id: 'bl', label: '↙', title: 'Snap Bottom-Left' },
                { id: 'br', label: '↘', title: 'Snap Bottom-Right' },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => snapCorner(btn.id)}
                className="px-1.5 py-0.5 text-[10px] text-white hover:bg-white/20 rounded"
                title={btn.title}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Context-Specific Controls Bar */}
      {effectiveContext === 'reference-pin' ? (
        <div
          className="px-2.5 py-2 border-t flex items-center justify-between gap-2 text-xs"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          {fmt?.viewer === 'image-lightbox' || fmt?.viewer === 'raw-demosaic-viewer' ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setRefZoom((z) => Math.max(0.5, z - 0.25))}
                className="p-1.5 rounded-lg border border-slate-300/40 dark:border-slate-700 hover:bg-black/5 dark:hover:bg-white/10"
                title="Zoom Out"
                aria-label="Zoom Out Reference"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] font-bold px-1 tabular-nums">
                {Math.round(refZoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setRefZoom((z) => Math.min(3, z + 0.25))}
                className="p-1.5 rounded-lg border border-slate-300/40 dark:border-slate-700 hover:bg-black/5 dark:hover:bg-white/10"
                title="Zoom In"
                aria-label="Zoom In Reference"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(refText || asset.name);
                setCopiedRef(true);
                setTimeout(() => setCopiedRef(false), 1500);
              }}
              className="px-2.5 py-1.5 rounded-xl border border-slate-300/40 dark:border-slate-700 hover:bg-black/5 dark:hover:bg-white/10 text-[11px] font-semibold flex items-center gap-1"
            >
              {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedRef ? 'Copied' : 'Copy Text'}</span>
            </button>
          )}

          <div className="flex items-center gap-1">
            {onOpenEditor && (fmt?.viewer === 'image-lightbox' || fmt?.viewer === 'raw-demosaic-viewer') && (
              <button
                type="button"
                onClick={() => onOpenEditor(asset)}
                className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold flex items-center gap-1"
              >
                <Sliders className="w-3 h-3" />
                <span>Studio</span>
              </button>
            )}
            {onExpandFullscreen && (
              <button
                type="button"
                onClick={() => {
                  onExpandFullscreen(asset);
                  onClose();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-[#1074B1] hover:bg-[#0e6499] text-white text-[11px] font-bold flex items-center gap-1"
              >
                <FileText className="w-3 h-3" />
                <span>Open Full</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="p-2 border-t space-y-1.5 text-xs"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center justify-between gap-2">
            {effectiveContext === 'music-queue' && (
              <button
                type="button"
                onClick={() => googleMusicEngine.prev()}
                className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                title="Previous Track"
                aria-label="Previous Track"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={handleTogglePlay}
              className="p-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-transform active:scale-95 shrink-0"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-white" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
              )}
            </button>

            {effectiveContext === 'music-queue' && (
              <button
                type="button"
                onClick={() => googleMusicEngine.next()}
                className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                title="Next Track"
                aria-label="Next Track"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="flex-1 min-w-0 space-y-0.5">
              <input
                type="range"
                min="0"
                max={duration || 120}
                value={currentTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCurrentTime(val);
                  if (isVideo && videoRef.current) {
                    videoRef.current.currentTime = val;
                  } else {
                    universalMediaPlayer.seek(val);
                  }
                }}
                aria-label="Seek timeline"
                className="w-full h-1 accent-sky-500 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] font-mono opacity-70 tabular-nums">
                <span>{formatPipTime(currentTime)}</span>
                <span>{formatPipTime(duration)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsMuted((m) => !m);
                universalMediaPlayer.setVolume(isMuted ? 1.0 : 0);
              }}
              className="p-1.5 rounded-lg opacity-75 hover:opacity-100 shrink-0"
              title={isMuted ? 'Unmute' : 'Mute'}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Secondary Context-Aware Strip */}
          <div className="flex items-center justify-between gap-1 text-[10px]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCycleSpeed}
                className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-mono font-bold hover:opacity-100"
                title="Cycle Playback Speed"
              >
                {playbackSpeed}x
              </button>

              {effectiveContext === 'music-queue' ? (
                <>
                  <button
                    type="button"
                    onClick={() => googleMusicEngine.toggleShuffle()}
                    className={`p-1 rounded-md ${musicState.isShuffle ? 'text-sky-500 font-bold bg-sky-500/10' : 'opacity-65 hover:opacity-100'}`}
                    title="Shuffle Queue"
                  >
                    <Shuffle className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => googleMusicEngine.toggleRepeat()}
                    className={`p-1 rounded-md ${musicState.repeatMode !== 'off' ? 'text-sky-500 font-bold bg-sky-500/10' : 'opacity-65 hover:opacity-100'}`}
                    title={`Repeat: ${musicState.repeatMode}`}
                  >
                    <Repeat className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCaptions((c) => !c)}
                    className={`p-1 rounded-md ${showCaptions ? 'text-emerald-500 bg-emerald-500/10' : 'opacity-65 hover:opacity-100'}`}
                    title="Toggle Lyrics / Captions"
                  >
                    <Subtitles className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsLooping((l) => !l)}
                  className={`p-1 rounded-md ${isLooping ? 'text-emerald-500 bg-emerald-500/10 font-bold' : 'opacity-65 hover:opacity-100'}`}
                  title="Loop Clip"
                >
                  <Repeat className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1">
              {isVideo && onTrimVideo && (
                <button
                  type="button"
                  onClick={() => onTrimVideo(asset)}
                  className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-300 font-bold flex items-center gap-1 hover:bg-amber-500/25"
                >
                  <Scissors className="w-3 h-3" />
                  <span>Trim</span>
                </button>
              )}
              {effectiveContext === 'music-queue' && onOpenMusicPlayer && (
                <button
                  type="button"
                  onClick={onOpenMusicPlayer}
                  className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-300 font-bold hover:bg-sky-500/25"
                >
                  Return to Studio
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
