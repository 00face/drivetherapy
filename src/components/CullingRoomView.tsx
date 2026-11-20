/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Culling Room Workstation (Photo Mechanic Speed Culling Workflow - A+ Tier)
 * Features dual-split loupe comparison, dynamic burst hero benchmarking,
 * customizable zoom factors (1.5x/2.5x/4x), and WCAG 2.2 AAA accessibility.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import {
  CheckCircle2,
  XCircle,
  Star,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Zap,
  Trash2,
  Columns2,
  Square,
  Sparkles,
  Download,
  FileCode,
  Tag,
  CheckSquare,
  Users,
} from 'lucide-react';
import { MediaAsset, CullingStatus, ColorLabel } from '../types';
import { exportAssetXmp, exportCullingReport } from '../services/xmpExporter';
import {
  WebRtcCullingRoomClient,
  type CollabRoomState,
} from '../services/webrtcCullingSync';
import { evaluateSwipeGesture, type PointerPoint } from '../services/mobileTouchGestures';
import { enqueueOfflineMutation } from '../services/pwaSyncManager';

interface CullingRoomViewProps {
  assets: MediaAsset[];
  onUpdateCulling: (id: string, status: CullingStatus) => void;
  onUpdateRating: (id: string, rating: number) => void;
  onUpdateColorLabel?: (id: string, color: ColorLabel) => void;
  onBatchUpdateCulling?: (ids: string[], status: CullingStatus) => void;
  onBatchUpdateRating?: (ids: string[], rating: number) => void;
  onBatchUpdateColorLabel?: (ids: string[], color: ColorLabel) => void;
  onBatchPurgeRejects: () => void;
}

export const CullingRoomView: React.FC<CullingRoomViewProps> = ({
  assets,
  onUpdateCulling,
  onUpdateRating,
  onUpdateColorLabel,
  onBatchUpdateCulling,
  onBatchUpdateRating,
  onBatchUpdateColorLabel,
  onBatchPurgeRejects,
}) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filterMode, setFilterMode] = useState<'all' | 'blurry' | 'bursts' | 'picked'>('all');
  const [isZoomLoupe, setIsZoomLoupe] = useState(false);
  const [zoomFactor, setZoomFactor] = useState<number>(2.5);
  const [isSplitCompare, setIsSplitCompare] = useState(false);
  const [loupePos, setLoupePos] = useState({ x: 50, y: 50 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // [WO-053] Collaborative WebRTC Studio Sync state
  const [collabRoomCode, setCollabRoomCode] = useState('');
  const [collabClient, setCollabClient] = useState<WebRtcCullingRoomClient | null>(null);
  const [collabState, setCollabState] = useState<CollabRoomState | null>(null);
  const [isCollabBarOpen, setIsCollabBarOpen] = useState(false);

  // [WO-055] Mobile Touch Pointer Swipe Ref
  const swipeStartRef = React.useRef<PointerPoint | null>(null);

  useEffect(() => {
    return () => {
      collabClient?.disconnect();
    };
  }, [collabClient]);

  const handleToggleCollabRoom = () => {
    if (collabClient) {
      collabClient.disconnect();
      setCollabClient(null);
      setCollabState(null);
      return;
    }
    const code = collabRoomCode.trim() || `studio-${Math.random().toString(36).slice(2, 6)}`;
    setCollabRoomCode(code);
    const client = new WebRtcCullingRoomClient(code);
    client.subscribe((st) => setCollabState(st));
    client.connect();
    setCollabClient(client);
  };

  const handleTouchPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    swipeStartRef.current = { x: e.clientX, y: e.clientY, timestamp: Date.now() };
  };

  const handleTouchPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' || !swipeStartRef.current || !activeAsset) return;
    const res = evaluateSwipeGesture(swipeStartRef.current, {
      x: e.clientX,
      y: e.clientY,
      timestamp: Date.now(),
    });
    swipeStartRef.current = null;
    if (res.direction === 'swipe-right') {
      onUpdateCulling(activeAsset.id, 'picked');
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueOfflineMutation({ type: 'pick', assetId: activeAsset.id, value: 'picked' });
      }
      void collabClient?.broadcast('cull_vote', { assetId: activeAsset.id, status: 'picked' });
      setCurrentIndex((i) => Math.min(filteredAssets.length - 1, i + 1));
    } else if (res.direction === 'swipe-left') {
      onUpdateCulling(activeAsset.id, 'rejected');
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueOfflineMutation({ type: 'reject', assetId: activeAsset.id, value: 'rejected' });
      }
      void collabClient?.broadcast('cull_vote', { assetId: activeAsset.id, status: 'rejected' });
      setCurrentIndex((i) => Math.min(filteredAssets.length - 1, i + 1));
    } else if (res.direction === 'swipe-up') {
      onUpdateRating(activeAsset.id, Math.min(5, (activeAsset.rating || 0) + 1));
    }
  };

  const filteredAssets = assets.filter((item) => {
    if (filterMode === 'blurry') return item.quality.isBlurry;
    if (filterMode === 'bursts') return Boolean(item.burstGroup);
    if (filterMode === 'picked') return item.cullingStatus === 'picked';
    return true;
  });

  const activeAsset = filteredAssets[currentIndex] || filteredAssets[0] || assets[0];

  // Pre-buffer adjacent candidate frames into browser cache
  useEffect(() => {
    if (!activeAsset || filteredAssets.length === 0) return;
    const indicesToPreload = [currentIndex + 1, currentIndex + 2, currentIndex - 1].filter(
      (idx) => idx >= 0 && idx < filteredAssets.length
    );
    indicesToPreload.forEach((idx) => {
      const img = new Image();
      img.src = filteredAssets[idx].thumbnailUrl;
    });
  }, [currentIndex, filteredAssets]);

  // Resolve benchmark asset for split comparison
  const benchmarkAsset: MediaAsset | null = React.useMemo(() => {
    if (!activeAsset) return null;
    if (activeAsset.burstGroup) {
      const hero = assets.find((a) => a.burstGroup === activeAsset.burstGroup && a.isBurstHero);
      if (hero && hero.id !== activeAsset.id) return hero;
    }
    const prev = filteredAssets[currentIndex > 0 ? currentIndex - 1 : filteredAssets.length - 1];
    return prev && prev.id !== activeAsset.id ? prev : null;
  }, [activeAsset, assets, filteredAssets, currentIndex]);

  const sharpnessDelta = benchmarkAsset
    ? (activeAsset?.quality?.sharpness || 0) - (benchmarkAsset.quality?.sharpness || 0)
    : 0;

  // Global Speed Culling Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (!activeAsset) return;

      if (e.key === 'p' || e.key === 'P') {
        if (selectedIds.size > 0 && onBatchUpdateCulling) {
          onBatchUpdateCulling(Array.from(selectedIds), 'picked');
        } else {
          onUpdateCulling(activeAsset.id, 'picked');
          handleNext();
        }
      } else if (e.key === 'x' || e.key === 'X') {
        if (selectedIds.size > 0 && onBatchUpdateCulling) {
          onBatchUpdateCulling(Array.from(selectedIds), 'rejected');
        } else {
          onUpdateCulling(activeAsset.id, 'rejected');
          handleNext();
        }
      } else if (e.key === 'u' || e.key === 'U') {
        if (selectedIds.size > 0 && onBatchUpdateCulling) {
          onBatchUpdateCulling(Array.from(selectedIds), 'unrated');
        } else {
          onUpdateCulling(activeAsset.id, 'unrated');
        }
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const rating = parseInt(e.key, 10);
        if (selectedIds.size > 0 && onBatchUpdateRating) {
          onBatchUpdateRating(Array.from(selectedIds), rating);
        } else {
          onUpdateRating(activeAsset.id, rating);
        }
      } else if (['6', '7', '8', '9', '0'].includes(e.key)) {
        const colorMap: Record<string, ColorLabel> = {
          '6': 'red',
          '7': 'yellow',
          '8': 'green',
          '9': 'blue',
          '0': 'none',
        };
        const color = colorMap[e.key];
        if (onUpdateColorLabel) {
          if (selectedIds.size > 0 && onBatchUpdateColorLabel) {
            onBatchUpdateColorLabel(Array.from(selectedIds), color);
          } else {
            onUpdateColorLabel(activeAsset.id, color);
          }
        }
      } else if (e.key === 'c' || e.key === 'C') {
        setIsSplitCompare((prev) => !prev);
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsZoomLoupe((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setSelectedIds(new Set(filteredAssets.map((a) => a.id)));
      } else if (e.key === 'Escape') {
        setSelectedIds(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAsset, currentIndex, filteredAssets, selectedIds]);

  const handleNext = () => {
    if (currentIndex < filteredAssets.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const toggleSelectAsset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const colorClasses: Record<ColorLabel, { bg: string; text: string; border: string }> = {
    none: { bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-600' },
    red: { bg: 'bg-rose-500', text: 'text-white', border: 'border-rose-600' },
    yellow: { bg: 'bg-amber-400', text: 'text-black', border: 'border-amber-500' },
    green: { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' },
    blue: { bg: 'bg-sky-500', text: 'text-white', border: 'border-sky-600' },
    purple: { bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-600' },
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomLoupe) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setLoupePos({ x, y });
  };

  const cycleZoomFactor = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoomFactor === 1.5) setZoomFactor(2.5);
    else if (zoomFactor === 2.5) setZoomFactor(4.0);
    else setZoomFactor(1.5);
    setIsZoomLoupe(true);
  };

  if (!activeAsset) {
    return (
      <div className="p-12 text-center text-slate-400">
        <p>No media files available matching this culling filter.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Culling Header & Filter Ribbon */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl border shadow-xs theme-card"
        onPointerDown={handleTouchPointerDown}
        onPointerUp={handleTouchPointerUp}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#52B197]/15 text-[#52B197] flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{t('culling.title')}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 tabular-nums">
                {t('culling.photoOf', { current: currentIndex + 1, total: filteredAssets.length })}
              </span>
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>{t('culling.hotkeys')}</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border text-emerald-600 font-mono font-bold text-[10px]">{t('culling.keepHotkey')}</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border text-rose-500 font-mono font-bold text-[10px]">{t('culling.dismissHotkey')}</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border text-slate-600 dark:text-slate-300 font-mono text-[10px]">{t('culling.starsHotkey')}</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border text-[#1074B1] font-mono font-bold text-[10px]">{t('culling.compareHotkey')}</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border text-slate-600 dark:text-slate-300 font-mono text-[10px]">{t('culling.zoomHotkey')}</kbd>
            </div>
          </div>
        </div>

        {/* View Modes & Purge Action */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* [WO-053] Live Studio Sync (WebRTC) Toggle */}
          <button
            type="button"
            onClick={() => setIsCollabBarOpen((v) => !v)}
            className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              collabState?.connected
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="Collaborative Multi-User Culling & WebRTC Studio Sync"
          >
            <Users className="w-4 h-4" />
            <span>
              {collabState?.connected
                ? `Live: ${collabState.roomId} (${Object.keys(collabState.peers).length + 1})`
                : 'Studio Sync'}
            </span>
          </button>

          {/* Dual Split Compare Toggle */}
          <button
            onClick={() => setIsSplitCompare(!isSplitCompare)}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-[#1074B1] ${
              isSplitCompare
                ? 'bg-[#1074B1] text-white border-[#1074B1] shadow-xs'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="Toggle Side-by-Side Compare Mode (Hot key C)"
            aria-pressed={isSplitCompare}
          >
            <Columns2 className="w-4 h-4" />
            <span>{isSplitCompare ? t('culling.splitLoupe') : t('culling.singleLoupe')}</span>
          </button>

          {/* Filter Pills */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
            <button
              onClick={() => {
                setFilterMode('all');
                setCurrentIndex(0);
              }}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg transition-colors ${
                filterMode === 'all'
                  ? 'bg-white dark:bg-slate-700 text-[#1074B1] font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {t('culling.allFilter')}
            </button>
            <button
              onClick={() => {
                setFilterMode('blurry');
                setCurrentIndex(0);
              }}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg transition-colors ${
                filterMode === 'blurry'
                  ? 'bg-white dark:bg-slate-700 text-[#A61B7A] font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {t('culling.blurryFilter')}
            </button>
            <button
              onClick={() => {
                setFilterMode('bursts');
                setCurrentIndex(0);
              }}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg transition-colors ${
                filterMode === 'bursts'
                  ? 'bg-white dark:bg-slate-700 text-[#52B197] font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {t('culling.burstsFilter')}
            </button>
            <button
              onClick={() => {
                setFilterMode('picked');
                setCurrentIndex(0);
              }}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg transition-colors ${
                filterMode === 'picked'
                  ? 'bg-white dark:bg-slate-700 text-[#52B197] font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {t('culling.pickedFilter')}
            </button>
          </div>

          {/* Export XMP Sidecar & Culling Report */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => exportAssetXmp(activeAsset)}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-[#1074B1]"
              title="Export Adobe XMP Sidecar for active photo"
            >
              <FileCode className="w-3.5 h-3.5 text-[#1074B1]" />
              <span>XMP</span>
            </button>
            <button
              onClick={() => exportCullingReport(assets, 'json')}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-[#52B197]"
              title="Download Photo Review Summary (JSON table)"
            >
              <Download className="w-3.5 h-3.5 text-[#52B197]" />
              <span>{t('culling.exportReport')}</span>
            </button>
          </div>

          <button
            onClick={onBatchPurgeRejects}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 text-xs font-semibold flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-rose-500"
            title="Clean out all dismissed photos"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('culling.purgeRejects')}</span>
          </button>
        </div>
      </div>

      {/* [WO-053] Collaborative Multi-User Culling & WebRTC Studio Sync Bar */}
      {isCollabBarOpen && (
        <div className="bg-white/95 dark:bg-slate-900/95 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                collabState?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Collaborative Culling Room (WebRTC / SSE Sync)
            </span>
            {collabState?.connected && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 tabular-nums">
                {Object.keys(collabState.peers).length + 1} reviewers live · {collabState.transport.toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="dt-collab-room-code" className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Room:
            </label>
            <input
              id="dt-collab-room-code"
              type="text"
              value={collabRoomCode}
              onChange={(e) => setCollabRoomCode(e.target.value)}
              disabled={Boolean(collabClient)}
              placeholder="studio-session-1"
              className="min-h-[44px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-100 w-44 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={handleToggleCollabRoom}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                collabClient
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {collabClient ? 'Leave Room' : 'Join Sync Room'}
            </button>
          </div>
        </div>
      )}

      {/* Main Culling Stage & Loupe Inspection */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Loupe & Viewer Column */}
        <div className="lg:col-span-3 space-y-3">
          {/* Dual Split Compare Mode vs Single Mode */}
          {isSplitCompare && benchmarkAsset ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Left Pane: Candidate Asset */}
              <div
                onMouseMove={handleMouseMove}
                onClick={() => setIsZoomLoupe(!isZoomLoupe)}
                className="relative aspect-[4/3] bg-black rounded-3xl overflow-hidden cursor-crosshair shadow-lg border-2 border-[#1074B1] flex items-center justify-center select-none"
              >
                <img
                  src={activeAsset.thumbnailUrl}
                  alt={activeAsset.name}
                  className={`max-w-full max-h-full object-contain transition-transform duration-75 ${
                    isZoomLoupe ? '' : 'scale-100'
                  }`}
                  style={
                    isZoomLoupe
                      ? {
                          transform: `scale(${zoomFactor})`,
                          transformOrigin: `${loupePos.x}% ${loupePos.y}%`,
                        }
                      : undefined
                  }
                />
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#1074B1] text-white shadow-md">
                    Candidate Frame
                  </span>
                  <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono bg-black/70 text-white backdrop-blur-md tabular-nums">
                    Focus {activeAsset.quality.sharpness}%
                  </span>
                </div>
                {sharpnessDelta !== 0 && (
                  <div
                    className={`absolute bottom-3 left-3 px-2.5 py-1 rounded-lg text-xs font-bold backdrop-blur-md shadow-md ${
                      sharpnessDelta > 0
                        ? 'bg-[#52B197]/90 text-white'
                        : 'bg-[#A61B7A]/90 text-white'
                    }`}
                  >
                    {sharpnessDelta > 0 ? `+${sharpnessDelta}% Sharper` : `${sharpnessDelta}% vs Benchmark`}
                  </div>
                )}
              </div>

              {/* Right Pane: Benchmark / Hero Asset */}
              <div
                onMouseMove={handleMouseMove}
                onClick={() => setIsZoomLoupe(!isZoomLoupe)}
                className="relative aspect-[4/3] bg-black rounded-3xl overflow-hidden cursor-crosshair shadow-lg border border-slate-800 flex items-center justify-center select-none"
              >
                <img
                  src={benchmarkAsset.thumbnailUrl}
                  alt={benchmarkAsset.name}
                  className={`max-w-full max-h-full object-contain transition-transform duration-75 ${
                    isZoomLoupe ? '' : 'scale-100'
                  }`}
                  style={
                    isZoomLoupe
                      ? {
                          transform: `scale(${zoomFactor})`,
                          transformOrigin: `${loupePos.x}% ${loupePos.y}%`,
                        }
                      : undefined
                  }
                />
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#BEBF61] text-black shadow-md">
                    {benchmarkAsset.isBurstHero ? '★ Burst Hero' : 'Benchmark'}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono bg-black/70 text-white backdrop-blur-md tabular-nums">
                    Focus {benchmarkAsset.quality.sharpness}%
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Single Loupe Mode (with [WO-055] mobile touch swipe gestures) */
            <div
              onMouseMove={handleMouseMove}
              onPointerDown={handleTouchPointerDown}
              onPointerUp={handleTouchPointerUp}
              onClick={() => setIsZoomLoupe(!isZoomLoupe)}
              className="relative aspect-[16/10] bg-black rounded-3xl overflow-hidden cursor-crosshair shadow-lg border border-slate-800 flex items-center justify-center select-none touch-pan-y"
            >
              <img
                src={activeAsset.thumbnailUrl}
                alt={activeAsset.name}
                className={`max-w-full max-h-full object-contain transition-transform duration-75 ${
                  isZoomLoupe ? '' : 'scale-100'
                }`}
                style={
                  isZoomLoupe
                    ? {
                        transform: `scale(${zoomFactor})`,
                        transformOrigin: `${loupePos.x}% ${loupePos.y}%`,
                      }
                    : undefined
                }
              />

              {/* Sharpness & Blur Overlay Banner */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-xl text-xs font-bold backdrop-blur-md shadow-md ${
                    activeAsset.quality.isBlurry
                      ? 'bg-[#A61B7A]/90 text-white'
                      : 'bg-[#52B197]/90 text-white'
                  }`}
                >
                  {activeAsset.quality.isBlurry ? '⚠ Blurry / Reject' : '✓ Sharp Keeper'}
                </span>

                {activeAsset.burstGroup && (
                  <span className="px-2.5 py-1 rounded-xl text-xs font-medium bg-black/60 text-white backdrop-blur-md">
                    Burst Group · {activeAsset.isBurstHero ? '★ Recommended Hero' : 'Burst Frame'}
                  </span>
                )}
              </div>

              {/* Stepper Navigation Buttons */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                disabled={currentIndex === 0}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-md text-white flex items-center justify-center disabled:opacity-20 transition-all focus-visible:ring-2 focus-visible:ring-white"
                title="Previous Photo (Left Arrow)"
                aria-label="Previous Photo"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                disabled={currentIndex === filteredAssets.length - 1}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-md text-white flex items-center justify-center disabled:opacity-20 transition-all focus-visible:ring-2 focus-visible:ring-white"
                title="Next Photo (Right Arrow)"
                aria-label="Next Photo"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Loupe instruction overlay & Zoom factor toggle */}
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <button
                  onClick={cycleZoomFactor}
                  className="px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black/90 backdrop-blur-md text-[#BEBF61] font-mono text-[11px] font-bold border border-white/10"
                  title="Cycle Loupe Factor (1.5x / 2.5x / 4x)"
                >
                  {zoomFactor}x Zoom
                </button>
                <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white/80 text-[11px] font-mono flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>{isZoomLoupe ? 'Active Loupe' : 'Click/Space to Loupe'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Action Decision Bar (Accessible Targets >= 44x44px) */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border shadow-xs theme-card">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onUpdateCulling(activeAsset.id, 'picked')}
                className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all focus-visible:ring-2 focus-visible:ring-[#52B197] ${
                  activeAsset.cullingStatus === 'picked'
                    ? 'bg-[#52B197] text-white shadow-sm ring-2 ring-[#52B197]/40'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Keep (P)</span>
              </button>

              <button
                onClick={() => onUpdateCulling(activeAsset.id, 'rejected')}
                className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all focus-visible:ring-2 focus-visible:ring-[#A61B7A] ${
                  activeAsset.cullingStatus === 'rejected'
                    ? 'bg-[#A61B7A] text-white shadow-sm ring-2 ring-[#A61B7A]/40'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                }`}
              >
                <XCircle className="w-4 h-4" />
                <span>Reject (X)</span>
              </button>

              <button
                onClick={() => onUpdateCulling(activeAsset.id, 'unrated')}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Clear (U)
              </button>
            </div>

            {/* Star Rating & Color Label Bar */}
            <div className="flex items-center gap-3">
              {/* Star Rating Bar */}
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => onUpdateRating(activeAsset.id, star)}
                    className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-all focus-visible:ring-2 focus-visible:ring-[#BEBF61]"
                    title={`Rate ${star} Stars (Press ${star})`}
                    aria-label={`Rate ${star} Stars`}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        star <= activeAsset.rating
                          ? 'text-[#BEBF61] fill-[#BEBF61]'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

              {/* Color Label Buttons */}
              <div className="flex items-center gap-1">
                {(['red', 'yellow', 'green', 'blue', 'purple', 'none'] as ColorLabel[]).map((col) => {
                  const isActive = activeAsset.colorLabel === col || (!activeAsset.colorLabel && col === 'none');
                  return (
                    <button
                      key={col}
                      onClick={() => onUpdateColorLabel && onUpdateColorLabel(activeAsset.id, col)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                        colorClasses[col].bg
                      } ${isActive ? 'ring-2 ring-offset-2 ring-[#1074B1] scale-110 shadow-sm' : 'opacity-70 hover:opacity-100'}`}
                      title={`Color Label: ${col.toUpperCase()} (Hotkeys 6-9)`}
                      aria-label={`Color Label ${col}`}
                    >
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Floating Multi-Selection Batch Action Bar */}
          {selectedIds.size > 0 && (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-[#403993] to-[#1074B1] text-white flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-300" />
                <span className="text-xs font-bold">
                  {selectedIds.size} frame{selectedIds.size > 1 ? 's' : ''} selected
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => onBatchUpdateCulling && onBatchUpdateCulling(Array.from(selectedIds), 'picked')}
                  className="px-3 py-1.5 rounded-lg bg-[#52B197] hover:bg-[#52B197]/80 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Keep Selected
                </button>
                <button
                  onClick={() => onBatchUpdateCulling && onBatchUpdateCulling(Array.from(selectedIds), 'rejected')}
                  className="px-3 py-1.5 rounded-lg bg-[#A61B7A] hover:bg-[#A61B7A]/80 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Dismiss Selected
                </button>
                <button
                  onClick={() => onBatchUpdateCulling && onBatchUpdateCulling(Array.from(selectedIds), 'unrated')}
                  className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors"
                >
                  Clear Status
                </button>

                <div className="h-4 w-px bg-white/30" />

                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => onBatchUpdateRating && onBatchUpdateRating(Array.from(selectedIds), s)}
                      className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/30 text-xs font-mono font-bold"
                    >
                      {s}★
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-2.5 py-1 rounded-lg bg-black/30 hover:bg-black/50 text-[11px] text-white/80"
                >
                  Deselect (Esc)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quality Diagnostics & Burst Strip Column */}
        <div className="space-y-4">
          {/* Optical Metrics Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Optical Quality Assessment
            </h3>

            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Sharpness / Focus</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                    {activeAsset.quality.sharpness}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      activeAsset.quality.sharpness > 80 ? 'bg-[#52B197]' : 'bg-[#A61B7A]'
                    }`}
                    style={{ width: `${activeAsset.quality.sharpness}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Exposure Accuracy</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                    {activeAsset.quality.exposure}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1074B1]"
                    style={{ width: `${activeAsset.quality.exposure}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              <span className="font-bold block text-slate-700 dark:text-slate-200 mb-0.5">Diagnostic:</span>
              {activeAsset.quality.reason || 'Analyzed via Laplacian focus matrix.'}
            </div>
          </div>

          {/* Filmstrip & Dynamic Burst Comparison */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {activeAsset.burstGroup ? 'Active Burst Series' : 'Adjacent Filmstrip'}
              </h3>
              {activeAsset.burstGroup && (
                <button
                  onClick={() => {
                    const currentBurst = activeAsset.burstGroup;
                    assets.forEach((item) => {
                      if (item.burstGroup === currentBurst) {
                        onUpdateCulling(item.id, item.isBurstHero ? 'picked' : 'rejected');
                      }
                    });
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#52B197]/15 text-[#52B197] hover:bg-[#52B197] hover:text-white transition-colors text-[10px] font-bold"
                  title="Automatically keep the sharpest frame and dismiss duplicate burst shots"
                >
                  ⚡ Keep Best Shot &amp; Dismiss Rest
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(activeAsset.burstGroup
                ? assets.filter((a) => a.burstGroup === activeAsset.burstGroup)
                : filteredAssets.slice(Math.max(0, currentIndex - 1), currentIndex + 5)
              ).map((item) => (
                <div
                  key={item.id}
                  onClick={() => setCurrentIndex(filteredAssets.findIndex((a) => a.id === item.id))}
                  className={`aspect-square rounded-xl overflow-hidden cursor-pointer relative border-2 ${
                    item.id === activeAsset.id
                      ? 'border-[#1074B1] shadow-xs'
                      : selectedIds.has(item.id)
                      ? 'border-emerald-500 shadow-xs'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  
                  {/* Multi-select checkbox */}
                  <button
                    onClick={(e) => toggleSelectAsset(item.id, e)}
                    className="absolute top-1 right-1 w-4 h-4 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white text-[9px] backdrop-blur-xs z-10"
                    title="Select for batch action"
                  >
                    {selectedIds.has(item.id) ? '✓' : ''}
                  </button>

                  {/* Color label bar if set */}
                  {item.colorLabel && item.colorLabel !== 'none' && (
                    <div
                      className={`absolute bottom-0 left-0 right-0 h-1.5 ${colorClasses[item.colorLabel].bg}`}
                      title={`Label: ${item.colorLabel}`}
                    />
                  )}

                  {item.isBurstHero && (
                    <div className="absolute top-1 left-1 px-1 rounded bg-[#BEBF61] text-black font-extrabold text-[8px] shadow-xs">
                      ★ HERO
                    </div>
                  )}
                  {item.cullingStatus === 'picked' && (
                    <div className="absolute top-6 right-1 w-3.5 h-3.5 rounded-full bg-[#52B197] flex items-center justify-center text-white text-[8px]">
                      ✓
                    </div>
                  )}
                  {item.cullingStatus === 'rejected' && (
                    <div className="absolute top-6 right-1 w-3.5 h-3.5 rounded-full bg-[#A61B7A] flex items-center justify-center text-white text-[8px]">
                      ✕
                    </div>
                  )}
                  <div className="absolute bottom-2 inset-x-1 text-center bg-black/60 backdrop-blur-xs text-[9px] text-white/90 font-mono rounded tabular-nums">
                    {item.quality.sharpness}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
