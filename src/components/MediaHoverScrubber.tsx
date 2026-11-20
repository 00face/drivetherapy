/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Functional Media Hover Scrubber (Video Frames & Audio Scrub Preview)
 * Renders real video preview frames at all times (even without an external thumbnailUrl),
 * seeks currentTime smoothly on pointer move, and shows live SMPTE timecode + progress bar.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Film, Play, Volume2 } from 'lucide-react';
import type { MediaAsset } from '../types';
import { resolveViewableAssetStreamUrl } from '../services/universalFileViewerEngine';
import { computeScrubTime, formatTimecode } from '../services/videoCurationEngine';

export interface MediaHoverScrubberProps {
  asset: MediaAsset;
  className?: string;
}

export const MediaHoverScrubber: React.FC<MediaHoverScrubberProps> = ({ asset, className = '' }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [scrubPercent, setScrubPercent] = useState(0);
  const [durationSec, setDurationSec] = useState<number>(60);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingPctRef = useRef<number>(0);

  const streamUrl = useMemo(() => resolveViewableAssetStreamUrl(asset), [asset]);
  const isVideo = asset.category === 'video';
  const isAudio = asset.category === 'audio';
  const hasImageThumbnail =
    Boolean(asset.thumbnailUrl) &&
    !asset.thumbnailUrl.includes('/api/fs/stream') &&
    !/\.(mp4|mov|mkv|webm|avi|m4v)(\?|$)/i.test(asset.thumbnailUrl);

  useEffect(() => {
    setVideoReady(false);
    setVideoError(false);
  }, [asset.id, streamUrl]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const scheduleSeek = (pct: number) => {
    pendingPctRef.current = pct;
    if (!isVideo) return;
    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const v = videoRef.current;
      if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
      const targetTime = Math.max(0, Math.min(v.duration - 0.05, pendingPctRef.current * v.duration));
      if (!v.seeking && Math.abs(v.currentTime - targetTime) > 0.08) {
        try {
          v.currentTime = targetTime;
        } catch {
          // Ignore seek errors while stream metadata settles
        }
      }
    });
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isVideo && !isAudio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    setIsHovering(true);
    setScrubPercent(relX);
    scheduleSeek(relX);
  };

  return (
    <div
      className={`relative aspect-[4/3] bg-slate-900 overflow-hidden ${className}`}
      onMouseMove={handlePointerMove}
      onMouseLeave={() => {
        setIsHovering(false);
      }}
    >
      {/* Static Image Thumbnail (when asset actually provides an image thumbnail) */}
      {hasImageThumbnail && (
        <img
          src={asset.thumbnailUrl}
          alt={asset.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}

      {/* Persistent Video Element: renders real preview frame even when idle AND scrubs smoothly on hover */}
      {isVideo && streamUrl && !videoError && (
        <video
          ref={videoRef}
          src={`${streamUrl}#t=0.5`}
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => {
            const dur = e.currentTarget.duration;
            if (Number.isFinite(dur) && dur > 0) {
              setDurationSec(dur);
              setVideoReady(true);
              if (isHovering) scheduleSeek(pendingPctRef.current);
            }
          }}
          onLoadedData={() => setVideoReady(true)}
          onError={() => setVideoError(true)}
          className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-150 ${
            videoReady && (isHovering || !hasImageThumbnail) ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Clean Fallback Card when Video has no image thumbnail and is still loading or unsupported codec */}
      {isVideo && !hasImageThumbnail && (!videoReady || videoError) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-slate-300 bg-slate-900/90 pointer-events-none">
          <Film className="w-6 h-6 text-sky-400" />
          <span className="text-[11px] font-mono font-bold uppercase">{asset.extension || 'VIDEO'}</span>
        </div>
      )}

      {isAudio && !hasImageThumbnail && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-slate-300 bg-slate-900 pointer-events-none">
          <span className="text-[11px] font-mono font-bold uppercase opacity-75">{asset.extension || 'AUDIO'}</span>
        </div>
      )}

      {/* Idle Media Play / Audio Badge */}
      {isVideo && !isHovering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-xs flex items-center justify-center text-white shadow-md">
            <Play className="w-4 h-4 fill-white ml-0.5" />
          </div>
        </div>
      )}
      {isAudio && !isHovering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-xs flex items-center justify-center text-white shadow-md">
            <Volume2 className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      {/* Active Hover Scrubber Filmstrip Bar & Real Timecode */}
      {(isVideo || isAudio) && isHovering && (
        <div className="absolute inset-x-0 bottom-1 px-2 flex flex-col gap-1 pointer-events-none z-20">
          <div className="flex justify-between items-center text-[10px] font-mono text-white bg-black/80 px-2 py-0.5 rounded-md shadow-md backdrop-blur-xs tabular-nums">
            <span>{formatTimecode(computeScrubTime(scrubPercent, durationSec))}</span>
            <span className="text-[9px] text-cyan-300 font-bold uppercase tracking-wider">
              {isVideo ? (videoReady ? 'Live Frame' : 'Loading') : 'Audio Scrub'}
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-75"
              style={{ width: `${scrubPercent * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
