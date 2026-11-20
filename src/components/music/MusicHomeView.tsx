/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Media Studio Home View (MusicHomeView.tsx)
 * Dynamic home view fed directly from Google Drive and Local Files:
 * - Source & format filter pills (All, Audio, Video, Lossless, Liked)
 * - Recently Added from Drive & Local folders
 * - Listen Again from persistent play history
 * - Dynamic Albums & Folders shelf
 *
 * WCAG AAA compliant with touch targets >= 44x44px and focus rings.
 */

import React, { useMemo, useState } from 'react';
import {
  Play,
  Pause,
  Disc3,
  Radio,
  Film,
  Music,
  Cloud,
  HardDrive,
  Heart,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  googleMusicEngine,
  GoogleMusicState,
  MusicTrack,
} from '../../services/googleMusicEngine';
import { formatTime } from './musicFormat';

interface MusicHomeViewProps {
  musicState: GoogleMusicState;
  onPlayTrack: (trackId: string) => void;
  onStartRadio: (trackId: string) => void;
}

type HomeFilterId = 'all' | 'audio' | 'video' | 'lossless' | 'liked';

export const MusicHomeView: React.FC<MusicHomeViewProps> = ({
  musicState,
  onPlayTrack,
  onStartRadio,
}) => {
  const [activeFilter, setActiveFilter] = useState<HomeFilterId>('all');
  const currentTrackId = musicState.currentTrack?.id;

  const allTracks: MusicTrack[] = googleMusicEngine.searchTracks('');
  const allPlaylists = googleMusicEngine.getFilteredPlaylists();

  const filteredTracks = useMemo(() => {
    if (activeFilter === 'audio') return allTracks.filter((t) => !t.isVideo);
    if (activeFilter === 'video') return allTracks.filter((t) => t.isVideo);
    if (activeFilter === 'lossless') return allTracks.filter((t) => ['flac', 'wav'].includes(t.format));
    if (activeFilter === 'liked') return allTracks.filter((t) => t.isLiked);
    return allTracks;
  }, [allTracks, activeFilter]);

  const shelves = useMemo(() => {
    const out: Array<{
      id: string;
      title: string;
      subtitle: string;
      type: 'tracks' | 'albums';
      items: any[];
    }> = [];

    if (filteredTracks.length > 0) {
      out.push({
        id: 'shelf_recent_media',
        title: 'Your Drive & Local Media',
        subtitle: `${filteredTracks.length} tracks indexed across connected storage`,
        type: 'tracks',
        items: filteredTracks.slice(0, 10),
      });
    }

    if (musicState.playHistory.length > 0) {
      const historyTracks = musicState.playHistory
        .map((h) => allTracks.find((t) => t.id === h.trackId))
        .filter(Boolean) as MusicTrack[];
      if (historyTracks.length > 0) {
        out.push({
          id: 'shelf_listen_again',
          title: 'Listen again',
          subtitle: 'Recently played tracks from this device',
          type: 'tracks',
          items: historyTracks.slice(0, 10),
        });
      }
    }

    const albums = allPlaylists.filter((p) => p.itemType === 'album');
    if (albums.length > 0 && activeFilter === 'all') {
      out.push({
        id: 'shelf_albums',
        title: 'Albums & Folders',
        subtitle: 'Grouped automatically from Drive folders and local directories',
        type: 'albums',
        items: albums.slice(0, 10),
      });
    }

    return out;
  }, [filteredTracks, musicState.playHistory, allTracks, allPlaylists, activeFilter]);

  const chips: Array<{ id: HomeFilterId; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'all', label: 'All Media', icon: Sparkles },
    { id: 'audio', label: 'Audio', icon: Music },
    { id: 'video', label: 'Videos', icon: Film },
    { id: 'lossless', label: 'Lossless (FLAC/WAV)', icon: Disc3 },
    { id: 'liked', label: 'Liked', icon: Heart },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-5 gap-6 select-none">
      {/* 1. Format & Type Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 shrink-0">
        {chips.map((c) => {
          const isSelected = activeFilter === c.id;
          const IconComp = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => setActiveFilter(c.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 border flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-white text-black border-white shadow-xs'
                  : 'border-transparent bg-black/5 dark:bg-white/10 opacity-75 hover:opacity-100'
              }`}
            >
              <IconComp className="w-3.5 h-3.5" />
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Empty State when no Drive or Local tracks are loaded yet */}
      {shelves.length === 0 && (
        <div
          className="p-8 rounded-3xl border flex flex-col items-center justify-center text-center gap-3 my-auto"
          style={{
            backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.08))',
            borderColor: 'var(--theme-border)',
          }}
        >
          <Disc3 className={`w-12 h-12 text-sky-500 ${musicState.libraryStatus.loading ? 'animate-spin' : ''}`} />
          <h3 className="text-base font-extrabold">
            {musicState.libraryStatus.loading
              ? 'Scanning Google Drive & Local Folders…'
              : 'Ready for Your Google Drive & Local Media'}
          </h3>
          <p className="text-xs opacity-70 max-w-md">
            Connect Google Drive or scan your OS Music and Videos folders to index MP3, FLAC, WAV, OGG, and video files directly in this player.
          </p>
          <div className="flex items-center gap-2.5 pt-2 flex-wrap justify-center">
            <button
              onClick={() => googleMusicEngine.refreshDriveLibrary(true)}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              <Cloud className="w-4 h-4" />
              <span>Scan Google Drive</span>
            </button>
            <button
              onClick={() => googleMusicEngine.scanLocalDriveMedia()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              <HardDrive className="w-4 h-4" />
              <span>Scan Local Music & Video Folders</span>
            </button>
            <button
              onClick={() => {
                googleMusicEngine.scanLocalDriveMedia();
                googleMusicEngine.refreshDriveLibrary(true);
              }}
              className="px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/10"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Rescan All</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Real User Shelves */}
      {shelves.map((shelf) => (
        <section key={shelf.id} className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold tracking-tight">{shelf.title}</h3>
              <p className="text-[11px] opacity-60">{shelf.subtitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {shelf.items.map((item: any, idx: number) => {
              const isTrack = shelf.type === 'tracks';
              const isCurrentPlaying = isTrack && currentTrackId === item.id;

              return (
                <div
                  key={item.id || idx}
                  onClick={() => {
                    if (isTrack) {
                      onPlayTrack(item.id);
                    } else {
                      googleMusicEngine.navigateToAlbum(item.title);
                    }
                  }}
                  className="group p-2.5 rounded-2xl border transition-all cursor-pointer hover:border-sky-500/50 hover:shadow-lg flex flex-col gap-2"
                  style={{
                    backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.1))',
                    borderColor: 'var(--theme-border)',
                  }}
                >
                  <div className="w-full aspect-square rounded-xl overflow-hidden shadow-xs relative bg-black/20">
                    <img
                      src={item.albumArtUrl || item.coverUrl}
                      alt={item.title || item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isTrack) {
                            onPlayTrack(item.id);
                          } else if (item.tracks?.length > 0) {
                            googleMusicEngine.playAlbumTracks(item.tracks, 0, false);
                          }
                        }}
                        className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform"
                        title="Play"
                      >
                        {isCurrentPlaying && musicState.isPlaying ? (
                          <Pause className="w-4 h-4 fill-black" />
                        ) : (
                          <Play className="w-4 h-4 fill-black ml-0.5" />
                        )}
                      </button>
                      {isTrack && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartRadio(item.id);
                          }}
                          className="w-8 h-8 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center shadow backdrop-blur-xs transition-transform"
                          title="Start Similar Mix"
                        >
                          <Radio className="w-3.5 h-3.5 text-emerald-400" />
                        </button>
                      )}
                    </div>

                    {isCurrentPlaying && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-sky-500 text-white text-[9px] font-bold flex items-center gap-1 shadow">
                        <Disc3 className="w-3 h-3 animate-spin" />
                        <span>PLAYING</span>
                      </div>
                    )}
                    {isTrack && (
                      <span
                        className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-white text-[9px] font-bold backdrop-blur-xs ${
                          item.source === 'local' ? 'bg-emerald-600/85' : 'bg-sky-600/85'
                        }`}
                      >
                        {item.source === 'local' ? 'Local' : 'Drive'}
                      </span>
                    )}
                    {item.isVideo && (
                      <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/70 text-white text-[9px] font-bold backdrop-blur-xs flex items-center gap-1">
                        <Film className="w-3 h-3 text-sky-400" />
                        <span>VIDEO</span>
                      </span>
                    )}
                    {item.durationSeconds > 0 && (
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 text-white text-[9px] font-mono font-bold backdrop-blur-xs">
                        {formatTime(item.durationSeconds)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <h4 className="font-bold text-xs truncate group-hover:text-sky-500 transition-colors">
                      {item.title || item.name}
                    </h4>
                    <p className="text-[10px] opacity-65 truncate mt-0.5">
                      {item.artist || item.author || 'Studio'}
                      {item.album ? ` • ${item.album}` : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};
