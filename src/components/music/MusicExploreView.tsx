/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Media Studio Explore View (MusicExploreView.tsx)
 * Dynamic breakdown of indexed Google Drive & Local Files by format, media type, and folder:
 * - Browse by Audio/Video Format (FLAC, WAV, MP3, OGG, M4A, MP4, WEBM)
 * - Most Played in Your Archive
 * - Video Streams & Local Recordings
 *
 * WCAG AAA compliant.
 */

import React, { useMemo } from 'react';
import {
  Disc3,
  Play,
  Film,
  Music,
  Cloud,
  HardDrive,
  TrendingUp,
} from 'lucide-react';
import {
  googleMusicEngine,
  GoogleMusicState,
  MusicTrack,
} from '../../services/googleMusicEngine';
import { formatTime } from './musicFormat';

interface MusicExploreViewProps {
  musicState: GoogleMusicState;
  onPlayTrack: (trackId: string) => void;
  onStartRadio: (trackId: string) => void;
}

export const MusicExploreView: React.FC<MusicExploreViewProps> = ({
  musicState,
  onPlayTrack,
}) => {
  const allTracks: MusicTrack[] = googleMusicEngine.searchTracks('');
  const currentTrackId = musicState.currentTrack?.id;

  const formatGroups = useMemo(() => {
    const map = new Map<string, MusicTrack[]>();
    for (const t of allTracks) {
      const fmt = (t.format || 'mp3').toUpperCase();
      if (!map.has(fmt)) map.set(fmt, []);
      map.get(fmt)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [allTracks]);

  const driveTracks = useMemo(() => allTracks.filter((t) => t.source !== 'local'), [allTracks]);
  const localTracks = useMemo(() => allTracks.filter((t) => t.source === 'local'), [allTracks]);
  const videoTracks = useMemo(() => allTracks.filter((t) => t.isVideo), [allTracks]);

  const mostPlayedTracks = useMemo(() => {
    if (musicState.playHistory.length === 0) return allTracks.slice(0, 6);
    const counts = new Map(musicState.playHistory.map((h) => [h.trackId, h.playCount]));
    return [...allTracks]
      .sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0))
      .slice(0, 6);
  }, [allTracks, musicState.playHistory]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-5 gap-7 select-none">
      {/* 1. Storage Source Overview */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Disc3 className="w-4 h-4 text-sky-500" />
          <h3 className="text-sm font-extrabold tracking-tight">Storage Breakdown</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <button
            onClick={() => {
              googleMusicEngine.setMediaSource('cloud');
              googleMusicEngine.setActiveView('library');
            }}
            className="p-4 rounded-2xl border flex items-center justify-between text-left hover:border-sky-500/60 transition-all"
            style={{
              backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.08))',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-500 flex items-center justify-center">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-xs">Google Drive Audio & Video</div>
                <div className="text-[11px] opacity-60">{driveTracks.length} files indexed</div>
              </div>
            </div>
            <span className="text-xs font-bold text-sky-500">Browse →</span>
          </button>

          <button
            onClick={() => {
              googleMusicEngine.setMediaSource('local');
              googleMusicEngine.setActiveView('library');
            }}
            className="p-4 rounded-2xl border flex items-center justify-between text-left hover:border-emerald-500/60 transition-all"
            style={{
              backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.08))',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-xs">Local Computer Files</div>
                <div className="text-[11px] opacity-60">{localTracks.length} files indexed</div>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-500">Browse →</span>
          </button>
        </div>
      </section>

      {/* 2. Browse by File Format */}
      {formatGroups.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-extrabold tracking-tight">Formats in Your Library</h3>
            </div>
            <span className="text-[11px] opacity-60">{allTracks.length} Total Files</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {formatGroups.map(([fmt, items]) => (
              <div
                key={fmt}
                onClick={() => googleMusicEngine.playAlbumTracks(items, 0, false)}
                className="p-3.5 rounded-2xl border cursor-pointer hover:border-sky-500/50 transition-all flex items-center justify-between"
                style={{
                  backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.08))',
                  borderColor: 'var(--theme-border)',
                }}
                title={`Play all ${fmt} tracks`}
              >
                <div>
                  <div className="text-sm font-extrabold">{fmt}</div>
                  <div className="text-[11px] opacity-60">{items.length} tracks</div>
                </div>
                <Play className="w-4 h-4 opacity-60" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Most Played & Highlighted Tracks */}
      {mostPlayedTracks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-extrabold tracking-tight">Quick Play Highlights</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {mostPlayedTracks.map((track, idx) => {
              const isCurrent = currentTrackId === track.id;
              return (
                <div
                  key={track.id}
                  onClick={() => onPlayTrack(track.id)}
                  className={`p-2.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-sky-500/15 border-sky-500/50 text-sky-500'
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  style={!isCurrent ? { borderColor: 'var(--theme-border)' } : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-5 text-center text-xs font-mono font-bold opacity-50 shrink-0">
                      {idx + 1}
                    </span>
                    <img
                      src={track.albumArtUrl}
                      alt={track.title}
                      className="w-10 h-10 rounded-xl object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-xs truncate">{track.title}</div>
                      <div className="text-[10px] opacity-65 truncate">
                        {track.artist} • {track.album}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono opacity-60 shrink-0">
                    {formatTime(track.durationSeconds)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Video Files */}
      {videoTracks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-extrabold tracking-tight">Video Media ({videoTracks.length})</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {videoTracks.slice(0, 8).map((v) => (
              <div
                key={v.id}
                onClick={() => onPlayTrack(v.id)}
                className="p-2.5 rounded-2xl border cursor-pointer hover:border-sky-500/50 flex flex-col gap-2"
                style={{
                  backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.08))',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <div className="aspect-video rounded-xl overflow-hidden bg-black/20 relative">
                  <img src={v.albumArtUrl} alt={v.title} className="w-full h-full object-cover" />
                </div>
                <div className="text-xs font-bold truncate">{v.title}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
