/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Interactive App Tour, Studio Guides & Walkthrough Overlay
 */

import React, { useEffect, useState } from 'react';
import {
  X,
  Compass,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  Tv,
  Cloud,
} from 'lucide-react';
import {
  TOUR_TRACKS,
  TourStep,
  loadTourProgress,
  saveTourProgress,
  markTrackCompleted,
} from '../services/interactiveTourEngine';
import { getPolluxPortraitUrl, getPolluxTourArtForStep } from '../services/polluxTourAgent';

interface InteractiveTourOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteStepAction?: (action: NonNullable<TourStep['targetAction']>) => void;
}

export const InteractiveTourOverlay: React.FC<InteractiveTourOverlayProps> = ({
  isOpen,
  onClose,
  onExecuteStepAction,
}) => {
  const [progress, setProgress] = useState(() => loadTourProgress());
  const [trackId, setTrackId] = useState<string>(() => loadTourProgress().lastTrackId || 'studio-tour');
  const [stepIndex, setStepIndex] = useState<number>(() => loadTourProgress().lastStepIndex || 0);

  const activeTrack = TOUR_TRACKS.find((tr) => tr.id === trackId) || TOUR_TRACKS[0];
  const safeIndex = Math.min(Math.max(0, stepIndex), activeTrack.steps.length - 1);
  const currentStep = activeTrack.steps[safeIndex];
  const polluxFrame = getPolluxTourArtForStep(activeTrack.id, safeIndex);

  useEffect(() => {
    saveTourProgress({ ...progress, lastTrackId: activeTrack.id, lastStepIndex: safeIndex });
  }, [activeTrack.id, safeIndex, progress]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') {
        setStepIndex((i) => Math.min(activeTrack.steps.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        setStepIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, activeTrack.steps.length]);

  if (!isOpen) return null;

  const trackIcon = (id: string) => {
    if (id === 'google-ecosystem-guide') return <Cloud className="w-4 h-4" />;
    if (id === 'tv-a11y-pro-guide') return <Tv className="w-4 h-4" />;
    return <Sparkles className="w-4 h-4" />;
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Interactive App Tour and Guides"
      >
        <div className="px-6 py-4 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-3">
            <img
              src={getPolluxPortraitUrl()}
              alt="Pollux — Drive Therapy Tour Guide"
              className="w-16 h-16 object-contain overflow-visible shrink-0 drop-shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold">Pollux’s Interactive Tour &amp; Studio Guides</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#1074B1]/15 text-[#1074B1] dark:text-sky-300">
                  Pollux Guide
                </span>
              </div>
              <p className="text-xs opacity-65">Use Arrow Keys to navigate steps · Esc to close</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center"
            aria-label="Close Interactive Tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Track Selector */}
        <div className="px-6 pt-3 pb-3 border-b flex flex-wrap gap-2" style={{ borderColor: 'var(--theme-border)' }}>
          {TOUR_TRACKS.map((tr) => {
            const done = progress.completedTracks.includes(tr.id);
            const active = tr.id === activeTrack.id;
            return (
              <button
                key={tr.id}
                onClick={() => {
                  setTrackId(tr.id);
                  setStepIndex(0);
                }}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  active ? 'bg-[#1074B1] text-white border-[#1074B1]' : 'hover:border-[#1074B1]'
                }`}
                style={active ? undefined : { borderColor: 'var(--theme-border)' }}
              >
                {trackIcon(tr.id)}
                <span>{tr.title}</span>
                {done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
            );
          })}
        </div>

        {/* Active Step Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Pollux Live Companion Banner */}
          <div
            className="rounded-2xl border p-3 flex flex-col sm:flex-row items-center gap-3.5"
            style={{
              backgroundColor: 'rgba(var(--theme-surface-rgb, 255, 255, 255), 0.55)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <img
              src={polluxFrame.sheetUrl}
              alt={polluxFrame.label}
              className="w-32 h-32 object-contain overflow-visible shrink-0 drop-shadow-md"
            />
            <div className="min-w-0 space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#1074B1] dark:text-sky-300">
                <Compass className="w-3.5 h-3.5" />
                <span>{polluxFrame.label}</span>
              </div>
              <p className="text-xs opacity-85 leading-relaxed">{polluxFrame.tip}</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs opacity-70 font-semibold">
            <span>{activeTrack.subtitle}</span>
            <span className="tabular-nums">
              Step {safeIndex + 1} / {activeTrack.steps.length}
            </span>
          </div>

          <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full bg-[#1074B1] transition-all duration-200"
              style={{ width: `${((safeIndex + 1) / activeTrack.steps.length) * 100}%` }}
            />
          </div>

          <div className="p-5 rounded-2xl border space-y-3 bg-black/5 dark:bg-white/5" style={{ borderColor: 'var(--theme-border)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-extrabold">{currentStep.title}</h3>
              {currentStep.shortcut && (
                <kbd className="px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold" style={{ borderColor: 'var(--theme-border)' }}>
                  {currentStep.shortcut}
                </kbd>
              )}
            </div>
            <p className="text-sm leading-relaxed opacity-85">{currentStep.description}</p>
            {currentStep.targetAction && currentStep.actionLabel && onExecuteStepAction && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onExecuteStepAction(currentStep.targetAction!);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#52B197] text-white text-xs font-bold inline-flex items-center gap-1.5 hover:opacity-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{currentStep.actionLabel}</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-2" style={{ borderColor: 'var(--theme-border)' }}>
          <button
            type="button"
            disabled={safeIndex === 0}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            className="min-h-[44px] px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-1 disabled:opacity-40"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {safeIndex < activeTrack.steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStepIndex((i) => Math.min(activeTrack.steps.length - 1, i + 1))}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1074B1] text-white text-xs font-bold flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setProgress(markTrackCompleted(activeTrack.id));
                onClose();
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete Guide</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
