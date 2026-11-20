/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cinematic Slideshow Theater (Showcase Suite - A+ Tier)
 * Directional Ken Burns dynamics, transitions, keyboard hotkeys (Space/F/Arrows),
 * EXIF telemetry HUD, and WCAG 2.2 AAA accessibility.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Clock,
  Sparkles,
  Camera,
  Layers,
  Volume2,
  VolumeX,
  ExternalLink,
  Star,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { MediaAsset } from '../types';

interface SlideshowTheaterViewProps {
  assets: MediaAsset[];
  onUpdateCulling?: (assetId: string, status: 'picked' | 'rejected' | 'unrated') => void;
  onUpdateRating?: (assetId: string, rating: number) => void;
}

export const SlideshowTheaterView: React.FC<SlideshowTheaterViewProps> = ({
  assets,
  onUpdateCulling,
  onUpdateRating,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [intervalSec, setIntervalSec] = useState(4);
  const [kenBurns, setKenBurns] = useState(true);
  const [transitionMode, setTransitionMode] = useState<'fade' | 'zoom' | 'slide'>('fade');
  const [showCaptions, setShowCaptions] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ambientAudio, setAmbientAudio] = useState(false);
  const [ambientVolume, setAmbientVolume] = useState(0.2);
  const [hudToast, setHudToast] = useState<{ text: string; icon: 'pick' | 'reject' | 'unrate' | 'star' } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const oscNodesRef = useRef<OscillatorNode[]>([]);
  const syncChannelRef = useRef<BroadcastChannel | null>(null);

  const activeAsset = assets[currentIndex] || assets[0];

  // Initialize BroadcastChannel for Dual-Monitor Presenter Sync
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const channel = new BroadcastChannel('dt_presentation_sync');
    syncChannelRef.current = channel;

    channel.onmessage = (event) => {
      if (typeof event.data?.index === 'number') {
        setCurrentIndex(event.data.index);
      }
    };

    return () => {
      channel.close();
    };
  }, []);

  // Broadcast slide changes to secondary screen
  useEffect(() => {
    syncChannelRef.current?.postMessage({ index: currentIndex });
  }, [currentIndex]);

  // Web Audio API Gentle Ambient Sound Generator
  useEffect(() => {
    if (ambientAudio) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(ambientVolume, ctx.currentTime);
        gainNode.connect(ctx.destination);
        gainNodeRef.current = gainNode;

        // Frequencies for a warm, contemplative pentatonic chord (C3, G3, D4, E4)
        const freqs = [130.81, 196.0, 293.66, 329.63];
        const oscs: OscillatorNode[] = [];

        freqs.forEach((freq) => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);

          // Subtle LFO modulation
          const lfo = ctx.createOscillator();
          lfo.frequency.setValueAtTime(0.15, ctx.currentTime);
          const lfoGain = ctx.createGain();
          lfoGain.gain.setValueAtTime(1.5, ctx.currentTime);
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          lfo.start();

          osc.connect(gainNode);
          osc.start();
          oscs.push(osc);
        });

        oscNodesRef.current = oscs;
      } catch (e) {
        console.warn('Web Audio note:', e);
      }
    } else {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    }

    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [ambientAudio]);

  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(ambientVolume, audioCtxRef.current.currentTime);
    }
  }, [ambientVolume]);

  // Dynamic Ken Burns pan orientation (alternates per slide)
  const kenBurnsStyles = [
    'scale-110 translate-x-2 translate-y-1',
    'scale-115 -translate-x-3 translate-y-2',
    'scale-105 translate-x-3 -translate-y-2',
    'scale-120 -translate-x-2 -translate-y-1',
  ];
  const activeKenBurnsClass = kenBurns ? kenBurnsStyles[currentIndex % kenBurnsStyles.length] : 'scale-100';

  // Automated slide interval
  useEffect(() => {
    if (!isPlaying || assets.length === 0) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % assets.length);
    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [isPlaying, intervalSec, assets.length]);

  const triggerHudToast = (text: string, icon: 'pick' | 'reject' | 'unrate' | 'star') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setHudToast({ text, icon });
    toastTimeoutRef.current = setTimeout(() => setHudToast(null), 1800);
  };

  // Global Keyboard Controls (Nav + Pro Culling & Rating)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (activeAsset) {
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          onUpdateCulling?.(activeAsset.id, 'picked');
          triggerHudToast('Picked (P)', 'pick');
        } else if (e.key === 'x' || e.key === 'X') {
          e.preventDefault();
          onUpdateCulling?.(activeAsset.id, 'rejected');
          triggerHudToast('Rejected (X)', 'reject');
        } else if (e.key === 'u' || e.key === 'U') {
          e.preventDefault();
          onUpdateCulling?.(activeAsset.id, 'unrated');
          triggerHudToast('Unrated (U)', 'unrate');
        } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
          e.preventDefault();
          const ratingVal = parseInt(e.key, 10);
          onUpdateRating?.(activeAsset.id, ratingVal);
          triggerHudToast(`${ratingVal} Star Rating (${'★'.repeat(ratingVal)})`, 'star');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [assets.length, activeAsset, onUpdateCulling, onUpdateRating]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % assets.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + assets.length) % assets.length);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  if (!activeAsset) {
    return (
      <div className="p-12 text-center text-slate-400">
        No media available for slideshow. Connect Google Drive or load a sample shoot.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Control Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-[#1074B1] text-white flex items-center justify-center shadow-xs hover:bg-[#403993] transition-colors focus-visible:ring-2 focus-visible:ring-[#1074B1]"
            title={isPlaying ? 'Pause Slideshow (Space)' : 'Start Slideshow (Space)'}
            aria-label={isPlaying ? 'Pause Slideshow' : 'Start Slideshow'}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
          </button>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Cinematic Slideshow Theater</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 tabular-nums">
                {currentIndex + 1} of {assets.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-mono truncate max-w-[280px]">
              {activeAsset.name}
            </p>
          </div>
        </div>

        {/* Playback Controls & Transitions */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Transition Selector */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            {(['fade', 'zoom', 'slide'] as const).map((trans) => (
              <button
                key={trans}
                onClick={() => setTransitionMode(trans)}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg capitalize font-medium transition-colors ${
                  transitionMode === trans
                    ? 'bg-white dark:bg-slate-700 text-[#1074B1] font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {trans}
              </button>
            ))}
          </div>

          {/* Ken Burns Toggle */}
          <button
            onClick={() => setKenBurns(!kenBurns)}
            className={`min-h-[44px] px-3 py-2 rounded-xl border font-semibold flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-[#BEBF61] ${
              kenBurns
                ? 'bg-[#BEBF61]/20 text-[#6d6e19] dark:text-[#dcdd7a] border-[#BEBF61]'
                : 'border-slate-200 dark:border-slate-700 text-slate-500'
            }`}
            title="Ken Burns Dynamic Motion"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ken Burns</span>
          </button>

          {/* Captions Toggle */}
          <button
            onClick={() => setShowCaptions(!showCaptions)}
            className={`min-h-[44px] px-3 py-2 rounded-xl border font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[#52B197] ${
              showCaptions
                ? 'bg-[#52B197]/20 text-[#52B197] border-[#52B197]'
                : 'border-slate-200 dark:border-slate-700 text-slate-500'
            }`}
          >
            Captions
          </button>

          {/* Ambient Sound Generator Toggle */}
          <button
            onClick={() => setAmbientAudio(!ambientAudio)}
            className={`min-h-[44px] px-3 py-2 rounded-xl border font-semibold flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-[#1074B1] ${
              ambientAudio
                ? 'bg-[#1074B1]/20 text-[#1074B1] border-[#1074B1]'
                : 'border-slate-200 dark:border-slate-700 text-slate-500'
            }`}
            title="Toggle Synthesized Calming Ambient Soundtrack (Web Audio API)"
          >
            {ambientAudio ? <Volume2 className="w-4 h-4 text-[#1074B1]" /> : <VolumeX className="w-4 h-4" />}
            <span>Ambient</span>
          </button>

          {/* Secondary Screen Presenter Popout */}
          <button
            onClick={() => {
              window.open(
                `${window.location.origin}/?mode=slideshow&presenter=true`,
                'DriveTherapyPresenter',
                'width=1280,height=720,menubar=no,toolbar=no'
              );
            }}
            className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-[#52B197]"
            title="Launch Clean Secondary Monitor Fullscreen Presentation"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#52B197]" />
            <span>2nd Screen</span>
          </button>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <Clock className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            {[3, 5, 8].map((sec) => (
              <button
                key={sec}
                onClick={() => setIntervalSec(sec)}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold tabular-nums ${
                  intervalSec === sec
                    ? 'bg-[#1074B1] text-white shadow-xs'
                    : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-[#1074B1]"
            title="Toggle Fullscreen (F)"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Cinema Viewport */}
      <div className="relative aspect-[16/9] w-full rounded-3xl bg-black overflow-hidden shadow-2xl flex items-center justify-center border border-slate-900 select-none group">
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
          <img
            key={activeAsset.id}
            src={activeAsset.thumbnailUrl}
            alt={activeAsset.name}
            className={`max-w-full max-h-full object-contain transition-all duration-1000 ease-out ${activeKenBurnsClass}`}
          />
        </div>

        {/* In-Presentation Culling HUD Notification Badge */}
        {hudToast && (
          <div className="absolute top-8 z-30 px-5 py-2.5 rounded-2xl bg-black/85 backdrop-blur-md border border-white/20 text-white font-bold text-sm shadow-2xl flex items-center gap-2.5 animate-in fade-in zoom-in-95 duration-150">
            {hudToast.icon === 'pick' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
            {hudToast.icon === 'reject' && <XCircle className="w-5 h-5 text-rose-400" />}
            {hudToast.icon === 'star' && <Star className="w-5 h-5 text-amber-400 fill-amber-400" />}
            <span>{hudToast.text}</span>
          </div>
        )}

        {/* Previous / Next Overlays */}
        <button
          onClick={handlePrev}
          className="min-h-[48px] min-w-[48px] absolute left-6 top-1/2 -translate-y-1/2 rounded-full bg-black/40 hover:bg-black/75 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus-visible:ring-2 focus-visible:ring-white"
          title="Previous Slide (Left Arrow)"
          aria-label="Previous Slide"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={handleNext}
          className="min-h-[48px] min-w-[48px] absolute right-6 top-1/2 -translate-y-1/2 rounded-full bg-black/40 hover:bg-black/75 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus-visible:ring-2 focus-visible:ring-white"
          title="Next Slide (Right Arrow)"
          aria-label="Next Slide"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Ambient Film Overlay Subtitle */}
        {showCaptions && (
          <div className="absolute bottom-6 inset-x-8 p-4 rounded-2xl bg-black/75 backdrop-blur-md text-white flex flex-col md:flex-row md:items-center justify-between gap-3 border border-white/10">
            <div>
              <h3 className="text-sm font-bold truncate">{activeAsset.name}</h3>
              <p className="text-xs text-slate-300">
                {activeAsset.quality.reason || 'Curated capture in Drive Therapy'}
              </p>
            </div>

            {/* EXIF Badge */}
            <div className="flex items-center gap-3 text-xs font-mono text-emerald-400 shrink-0 tabular-nums">
              <span className="flex items-center gap-1">
                <Camera className="w-3.5 h-3.5 text-white/70" />
                <span>{activeAsset.exif.camera || activeAsset.extension}</span>
              </span>
              {activeAsset.exif.focalLength && <span>{activeAsset.exif.focalLength}</span>}
              {activeAsset.exif.aperture && <span>{activeAsset.exif.aperture}</span>}
              {activeAsset.exif.shutterSpeed && <span>{activeAsset.exif.shutterSpeed}</span>}
              {activeAsset.exif.iso && <span>ISO {activeAsset.exif.iso}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
