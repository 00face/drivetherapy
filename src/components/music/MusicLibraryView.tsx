/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drive Therapy Media Library View (MusicLibraryView.tsx)
 * Unified library view for Google Drive and Local Files:
 * - Category filter pills: Playlists, Songs, Albums, Artists, Podcasts
 * - Dynamic Album & Artist Grid resolved from indexed Drive and Local tracks
 * - Songs tracklist table with duration and like actions
 * - Liked Music auto-playlist banner
 * - New playlist creation trigger
 * - Unified source switcher: All | Google Drive | Local Files
 *
 * WCAG AAA compliant.
 */

import React, { useState, useMemo } from 'react';
import {
  ThumbsUp,
  Plus,
  Cloud,
  HardDrive,
  ListMusic,
  Disc3,
  Play,
  Pause,
  Film,
  Music,
  User,
  Radio,
  Clock,
  Shuffle,
} from 'lucide-react';
import {
  googleMusicEngine,
  GoogleMusicState,
  MusicFilterCategory,
  MusicPlaylist,
  MusicTrack,
} from '../../services/googleMusicEngine';
import { formatTime } from './musicFormat';

interface MusicLibraryViewProps {
  musicState: GoogleMusicState;
  filteredPlaylists: MusicPlaylist[];
  filteredTracks: MusicTrack[];
  onPlayTrack: (trackId: string) => void;
  onSelectPlaylist: (playlistId: string) => void;
}

const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80';

export const MusicLibraryView: React.FC<MusicLibraryViewProps> = ({
  musicState,
  filteredPlaylists,
  filteredTracks,
  onPlayTrack,
  onSelectPlaylist,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [playlistDesc, setPlaylistDesc] = useState('');

  const filterCategories: { id: MusicFilterCategory; label: string }[] = [
    { id: 'playlists', label: 'Playlists' },
    { id: 'songs', label: 'Songs' },
    { id: 'albums', label: 'Albums' },
    { id: 'artists', label: 'Artists' },
    { id: 'podcasts', label: 'Podcasts' },
  ];

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistTitle.trim()) return;
    googleMusicEngine.createPlaylist(playlistTitle.trim(), playlistDesc.trim());
    setPlaylistTitle('');
    setPlaylistDesc('');
    setShowCreateModal(false);
  };

  const currentTrackId = musicState.currentTrack?.id;
  const allLibraryTracks = useMemo(() => googleMusicEngine.searchTracks(''), [filteredTracks]);
  const availableTracks: MusicTrack[] = filteredTracks.length > 0 ? filteredTracks : allLibraryTracks;

  // 1. Dynamic Albums resolution from both filteredPlaylists and all library tracks
  const dynamicAlbums = useMemo(() => {
    const playlistAlbums = filteredPlaylists.filter(
      (p) => p.itemType === 'album' || p.category === 'albums'
    );
    const seen = new Set<string>(playlistAlbums.map((p) => p.title.toLowerCase().trim()));

    const albumMap = new Map<string, MusicTrack[]>();
    for (const track of availableTracks) {
      const alb = (track.album || 'Drive Collection').trim();
      if (!albumMap.has(alb)) albumMap.set(alb, []);
      albumMap.get(alb)!.push(track);
    }

    const trackAlbums: MusicPlaylist[] = [];
    for (const [title, tracks] of albumMap.entries()) {
      if (!seen.has(title.toLowerCase().trim())) {
        seen.add(title.toLowerCase().trim());
        const first = tracks[0];
        trackAlbums.push({
          id: `pl_album_${encodeURIComponent(title)}`,
          title,
          description: `Album • ${first?.artist || 'Unknown Artist'} • ${tracks.length} tracks`,
          coverUrl: first?.albumArtUrl || DEFAULT_COVER,
          tracks,
          category: 'albums',
          itemType: 'album',
          author: first?.artist || 'Unknown Artist',
          trackCount: tracks.length,
          year: first?.year,
        });
      }
    }

    const merged = [...playlistAlbums, ...trackAlbums];
    if (musicState.activeSort === 'alpha') {
      merged.sort((a, b) => a.title.localeCompare(b.title));
    }
    return merged;
  }, [filteredPlaylists, availableTracks, musicState.activeSort]);

  // 2. Dynamic Artists resolution
  const dynamicArtists = useMemo(() => {
    const playlistArtists = filteredPlaylists.filter(
      (p) => p.itemType === 'artist' || p.category === 'artists'
    );
    const seen = new Set<string>(playlistArtists.map((p) => p.title.toLowerCase().trim()));

    const artistMap = new Map<string, MusicTrack[]>();
    for (const track of availableTracks) {
      const art = (track.artist || 'Unknown Artist').trim();
      if (!artistMap.has(art)) artistMap.set(art, []);
      artistMap.get(art)!.push(track);
    }

    const trackArtists: MusicPlaylist[] = [];
    for (const [title, tracks] of artistMap.entries()) {
      if (!seen.has(title.toLowerCase().trim())) {
        seen.add(title.toLowerCase().trim());
        trackArtists.push({
          id: `pl_artist_${encodeURIComponent(title)}`,
          title,
          description: `Artist • ${tracks.length} tracks`,
          coverUrl: tracks[0]?.albumArtUrl || DEFAULT_COVER,
          tracks,
          category: 'artists',
          itemType: 'artist',
          author: title,
          trackCount: tracks.length,
        });
      }
    }

    const merged = [...playlistArtists, ...trackArtists];
    if (musicState.activeSort === 'alpha') {
      merged.sort((a, b) => a.title.localeCompare(b.title));
    }
    return merged;
  }, [filteredPlaylists, availableTracks, musicState.activeSort]);

  // 3. Resolve display items based on activeCategory
  const activeCategory = musicState.activeCategory;
  const isAlbumsCategory = activeCategory === 'albums';
  const isSongsCategory = activeCategory === 'songs';
  const isArtistsCategory = activeCategory === 'artists';

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-5 gap-5 select-none">
      {/* 1. Category Filter Pills & Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
          <button
            onClick={() => googleMusicEngine.setFilterCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 border ${
              activeCategory === 'all'
                ? 'bg-white text-black border-white shadow-xs'
                : 'border-transparent bg-black/5 dark:bg-white/10 opacity-75 hover:opacity-100'
            }`}
          >
            All
          </button>
          {filterCategories.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => googleMusicEngine.setFilterCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 border ${
                  active
                    ? 'bg-white text-black border-white shadow-xs'
                    : 'border-transparent bg-black/5 dark:bg-white/10 opacity-75 hover:opacity-100'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Play All & Shuffle Master Actions */}
          <button
            onClick={() => googleMusicEngine.playAllAccountTracks(false)}
            className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white flex items-center gap-1.5 text-xs font-bold transition-all shadow-xs"
            title="Play all music in this account's catalog"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Play All</span>
          </button>
          <button
            onClick={() => googleMusicEngine.playAllAccountTracks(true)}
            className="px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/10 transition-colors shadow-xs"
            style={{ borderColor: 'var(--theme-border)' }}
            title="Shuffle all music in this account's catalog"
          >
            <Shuffle className="w-3.5 h-3.5 text-sky-500" />
            <span>Shuffle</span>
          </button>

          {/* New Playlist Trigger */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/10 transition-colors shadow-xs"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <Plus className="w-3.5 h-3.5 text-sky-500" />
            <span>New Playlist</span>
          </button>

          {/* All | Drive | Local Switcher */}
          <div
            className="flex items-center p-0.5 rounded-xl border text-xs font-semibold"
            style={{
              backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.15))',
              borderColor: 'var(--theme-border)',
            }}
          >
            <button
              onClick={() => googleMusicEngine.setMediaSource('all')}
              className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-all ${
                musicState.activeMediaSource === 'all'
                  ? 'bg-slate-800 dark:bg-white text-white dark:text-black font-bold shadow-xs'
                  : 'opacity-70 hover:opacity-100'
              }`}
              title="All Media (Google Drive & Local)"
            >
              <span>All</span>
            </button>
            <button
              onClick={() => googleMusicEngine.setMediaSource('cloud')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                musicState.activeMediaSource === 'cloud'
                  ? 'bg-sky-500 text-white font-bold shadow-xs'
                  : 'opacity-70 hover:opacity-100'
              }`}
              title="Google Drive Media"
            >
              <Cloud className="w-3 h-3" />
              <span>Drive</span>
            </button>
            <button
              onClick={() => googleMusicEngine.setMediaSource('local')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                musicState.activeMediaSource === 'local'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'opacity-70 hover:opacity-100'
              }`}
              title="Local Disk Files"
            >
              <HardDrive className="w-3 h-3" />
              <span>Local</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Liked Music Hero Auto-Playlist Card (Only on 'all' or 'playlists') */}
      {(activeCategory === 'all' || activeCategory === 'playlists') && (
        <div
          onClick={() => onSelectPlaylist('pl_liked_music')}
          className="p-5 rounded-3xl border flex items-center justify-between cursor-pointer hover:border-sky-500/50 hover:shadow-xl transition-all group relative overflow-hidden bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-sky-500/20"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-4 min-w-0 z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-500 to-indigo-600 flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform shrink-0">
              <ThumbsUp className="w-8 h-8 fill-white" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white inline-block mb-1">
                Auto Playlist
              </span>
              <h3 className="text-base font-extrabold group-hover:text-sky-400 transition-colors truncate">
                Liked Music
              </h3>
              <p className="text-xs opacity-75 truncate">
                All songs and tracks you have starred or thumbs-upped
              </p>
            </div>
          </div>

          <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg group-hover:scale-110 active:scale-95 transition-transform shrink-0 z-10">
            <Play className="w-5 h-5 fill-black ml-0.5" />
          </div>
        </div>
      )}

      {/* 3. SONGS VIEW: Tracklist Table (Media Studio) */}
      {isSongsCategory ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-70">
              Songs ({availableTracks.length})
            </h4>
          </div>

          {availableTracks.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center opacity-60 gap-3">
              <Music className="w-12 h-12 stroke-[1.5]" />
              <p className="text-sm font-semibold">No songs found in your library.</p>
              <p className="text-xs max-w-sm">Connect your Google Drive or mount Local Drive to index your music.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {availableTracks.map((track: MusicTrack, idx: number) => {
                const isPlayingThis = currentTrackId === track.id && musicState.isPlaying;
                const isSelectedThis = currentTrackId === track.id;

                return (
                  <div
                    key={track.id}
                    onClick={() => onPlayTrack(track.id)}
                    className={`group px-3 py-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                      isSelectedThis
                        ? 'bg-sky-500/10 border-sky-500 text-sky-600 dark:text-sky-400'
                        : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5 hover:border-black/10'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Number or Animated Equalizer */}
                      <div className="w-6 text-center text-xs font-mono opacity-50 shrink-0">
                        {isPlayingThis ? (
                          <div className="flex items-end justify-center gap-0.5 h-3">
                            <span className="w-0.5 h-3 bg-sky-500 animate-pulse" />
                            <span className="w-0.5 h-2 bg-sky-500 animate-pulse delay-75" />
                            <span className="w-0.5 h-3 bg-sky-500 animate-pulse delay-150" />
                          </div>
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>

                      {/* Cover Thumbnail */}
                      <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs relative bg-black/20 shrink-0">
                        <img
                          src={track.albumArtUrl || DEFAULT_COVER}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          {isPlayingThis ? (
                            <Pause className="w-4 h-4 fill-white text-white" />
                          ) : (
                            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                          )}
                        </div>
                      </div>

                      {/* Title & Artist */}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs truncate group-hover:text-sky-500 transition-colors">
                          {track.title}
                        </div>
                        <div className="text-[11px] opacity-65 truncate mt-0.5 flex items-center gap-1.5">
                          <span>{track.artist || 'Unknown Artist'}</span>
                          {track.isVideo && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/15 text-sky-500 font-bold border border-sky-500/20">
                              Video
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Album Name */}
                    <div className="hidden md:block w-48 text-xs opacity-60 truncate">
                      {track.album || '—'}
                    </div>

                    {/* Duration & Actions */}
                    <div className="flex items-center gap-3 shrink-0 text-xs font-mono opacity-70">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          googleMusicEngine.rateTrack(track.id, track.isLiked ? 'none' : 'up');
                        }}
                        className={`p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
                          track.isLiked ? 'text-sky-500 opacity-100' : 'opacity-40 hover:opacity-100'
                        }`}
                        title={track.isLiked ? 'Unlike' : 'Like'}
                      >
                        <ThumbsUp className={`w-3.5 h-3.5 ${track.isLiked ? 'fill-sky-500' : ''}`} />
                      </button>
                      <span className="w-10 text-right">{formatTime(track.durationSeconds || 0)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* 4. ALBUMS, ARTISTS, PLAYLISTS & ALL GRID (Unified Studio Layout) */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-70">
              {isAlbumsCategory
                ? `Albums (${dynamicAlbums.length})`
                : isArtistsCategory
                ? `Artists (${dynamicArtists.length})`
                : activeCategory === 'all'
                ? 'All Collections'
                : `${activeCategory.toUpperCase()} (${filteredPlaylists.length})`}
            </h4>
          </div>

          {/* Grid Render */}
          {(() => {
            const items = isAlbumsCategory
              ? dynamicAlbums
              : isArtistsCategory
              ? dynamicArtists
              : filteredPlaylists;

            if (items.length === 0) {
              return (
                <div className="py-12 flex flex-col items-center justify-center text-center opacity-60 gap-3">
                  <Disc3 className="w-12 h-12 stroke-[1.5]" />
                  <p className="text-sm font-semibold">
                    {isAlbumsCategory
                      ? 'No albums discovered in your library.'
                      : isArtistsCategory
                      ? 'No artists discovered in your library.'
                      : 'No playlists or collections found.'}
                  </p>
                  <p className="text-xs max-w-sm">
                    Connect Google Drive or Local Drive to automatically group your tracks into albums and artist collections.
                  </p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {items.map((item) => {
                  const isProfile = item.itemType === 'profile';
                  const isArtist = item.itemType === 'artist' || isArtistsCategory;
                  const isAlbum = item.itemType === 'album' || isAlbumsCategory;

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (isArtist) {
                          googleMusicEngine.navigateToArtist(item.title);
                        } else if (isAlbum) {
                          googleMusicEngine.navigateToAlbum(item.title);
                        } else {
                          onSelectPlaylist(item.id);
                        }
                      }}
                      className="group p-3 rounded-2xl border transition-all cursor-pointer hover:border-sky-500/50 hover:shadow-xl flex flex-col gap-2.5"
                      style={{
                        backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.1))',
                        borderColor: 'var(--theme-border)',
                      }}
                    >
                      {/* Artwork (Square with rounded corners, or Circle for Artists) */}
                      <div
                        className={`w-full aspect-square overflow-hidden shadow-xs relative bg-black/20 ${
                          isProfile || isArtist ? 'rounded-full' : 'rounded-2xl'
                        }`}
                      >
                        <img
                          src={item.coverUrl || DEFAULT_COVER}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.tracks && item.tracks.length > 0) {
                              googleMusicEngine.playAlbumTracks(item.tracks, 0, false);
                            } else {
                              onSelectPlaylist(item.id);
                            }
                          }}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                          title="Play Album"
                        >
                          <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-transform">
                            <Play className="w-4 h-4 fill-black ml-0.5" />
                          </div>
                        </div>
                        {item.trackCount && !isArtist && !isProfile && (
                          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 text-white text-[9px] font-mono font-bold backdrop-blur-xs">
                            {item.trackCount} tracks
                          </span>
                        )}
                      </div>

                      {/* Details (Album Title, Album • Artist • Year) */}
                      <div className="min-w-0">
                        <h5 className="font-bold text-xs truncate group-hover:text-sky-400 transition-colors">
                          {item.title}
                        </h5>
                        <p className="text-[11px] opacity-65 truncate mt-0.5">
                          {isProfile
                            ? `Profile • ${item.author || '@channel'}`
                            : isArtist
                            ? `Artist • ${item.trackCount || item.tracks?.length || 0} tracks`
                            : isAlbum
                            ? `Album • ${item.author || 'Various Artists'}${item.year ? ` • ${item.year}` : ''}`
                            : `Playlist • ${item.author || 'Drive Therapy'}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* 5. Create Playlist Modal Drawer */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-70 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--theme-surface)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text)',
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--theme-border)' }}>
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-sky-500" />
                <span>Create New Playlist</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-xs opacity-60 hover:opacity-100 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePlaylist} className="space-y-3 text-xs">
              <div>
                <label className="font-bold opacity-75 block mb-1">Playlist Title *</label>
                <input
                  type="text"
                  required
                  value={playlistTitle}
                  onChange={(e) => setPlaylistTitle(e.target.value)}
                  placeholder="e.g. Late Night Coding Sessions"
                  className="w-full p-2.5 rounded-xl border focus:border-sky-500 focus:outline-none"
                  style={{
                    backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.1))',
                    borderColor: 'var(--theme-border)',
                  }}
                />
              </div>

              <div>
                <label className="font-bold opacity-75 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={playlistDesc}
                  onChange={(e) => setPlaylistDesc(e.target.value)}
                  placeholder="Add an optional description"
                  className="w-full p-2.5 rounded-xl border focus:border-sky-500 focus:outline-none"
                  style={{
                    backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.1))',
                    borderColor: 'var(--theme-border)',
                  }}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border font-bold opacity-75 hover:opacity-100"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-xs"
                >
                  Create Playlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
