/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Media Studio Artist Detail View (MusicArtistView.tsx)
 * Displays artist profile, catalog track count, albums, and playable tracks.
 * - Artist banner, catalog stats, bio
 * - Top Songs list with play buttons and durations
 * - Discography albums & singles
 * - Similar artists recommendations
 *
 * WCAG AAA compliant.
 */

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Radio,
  Play,
  Shuffle,
  Disc3,
  Users,
  Film,
  Music,
} from 'lucide-react';
import {
  googleMusicEngine,
  GoogleMusicState,
  MusicTrack,
} from '../../services/googleMusicEngine';
import { musicApi, MusicArtistResponse } from '../../services/music/musicApi';
import { formatTime } from './musicFormat';

interface MusicArtistViewProps {
  artistId: string;
  musicState: GoogleMusicState;
  onPlayTrack: (trackId: string) => void;
  onStartRadio: (trackId: string) => void;
  onBack: () => void;
}

export const MusicArtistView: React.FC<MusicArtistViewProps> = ({
  artistId,
  musicState,
  onPlayTrack,
  onStartRadio,
  onBack,
}) => {
  const [artistData, setArtistData] = useState<MusicArtistResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    musicApi
      .getArtistProfile(artistId)
      .then((data) => {
        if (active) {
          setArtistData(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [artistId]);

  const currentTrackId = musicState.currentTrack?.id;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-5 gap-6 select-none">
      {/* Back button */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-2 rounded-xl border flex items-center gap-1.5 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-xs opacity-60">
          <Disc3 className="w-5 h-5 animate-spin mr-2 text-sky-500" />
          <span>Loading artist profile…</span>
        </div>
      )}

      {artistData && (
        <>
          {/* 1. Artist Hero Header */}
          <div
            className="p-6 rounded-3xl border flex flex-col sm:flex-row items-center gap-6 shadow-sm"
            style={{
              backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.1))',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden shadow-2xl shrink-0 border-2 border-white/20">
              <img
                src={artistData.avatarUrl}
                alt={artistData.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 text-center sm:text-left min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                Official Artist Profile
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate mt-1">
                {artistData.name}
              </h2>
              <p className="text-xs opacity-75 font-medium mt-1">
                {artistData.catalogCountLabel}
              </p>
              {artistData.bio && (
                <p className="text-xs opacity-60 mt-2 max-w-xl line-clamp-2">
                  {artistData.bio}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-center sm:justify-start gap-2.5 mt-4">
                <button
                  onClick={() => {
                    if (artistData.topSongs[0]) onPlayTrack(artistData.topSongs[0].id);
                  }}
                  className="px-4 py-2 rounded-xl bg-white text-black font-extrabold text-xs flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-transform"
                >
                  <Play className="w-3.5 h-3.5 fill-black" />
                  <span>Play</span>
                </button>
                <button
                  onClick={() => {
                    if (artistData.topSongs[0]) onStartRadio(artistData.topSongs[0].id);
                  }}
                  className="px-3.5 py-2 rounded-xl border font-bold text-xs flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  <Radio className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Radio</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Top Songs List */}
          {artistData.topSongs && artistData.topSongs.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wider opacity-70">
                Top Songs
              </h3>

              <div className="space-y-1.5">
                {artistData.topSongs.map((track, idx) => {
                  const isCurrent = currentTrackId === track.id;
                  return (
                    <div
                      key={track.id}
                      onClick={() => onPlayTrack(track.id)}
                      className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                        isCurrent
                          ? 'border-sky-500 bg-sky-500/15 text-sky-400 font-bold'
                          : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 text-center font-mono text-xs font-bold opacity-60">
                          {idx + 1}
                        </span>
                        <img
                          src={track.albumArtUrl}
                          alt=""
                          className="w-10 h-10 rounded-xl object-cover shrink-0 shadow-xs"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate group-hover:text-sky-400 transition-colors">
                            {track.title}
                          </div>
                          <div className="text-[10px] opacity-65 truncate">
                            {track.album || artistData.name}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {track.isVideo && (
                          <Film className="w-3.5 h-3.5 text-sky-400 opacity-80" />
                        )}
                        <span className="text-[10px] font-mono opacity-60">
                          {formatTime(track.durationSeconds)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 3. Discography / Albums Grid */}
          {artistData.albums && artistData.albums.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wider opacity-70">
                Albums &amp; Singles
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {artistData.albums.map((album) => (
                  <div
                    key={album.id}
                    onClick={() => googleMusicEngine.navigateToAlbum(album.title)}
                    className="p-2.5 rounded-2xl border transition-all cursor-pointer hover:border-sky-500/50 hover:shadow-lg flex flex-col gap-2 group"
                    style={{
                      backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.1))',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    <div className="w-full aspect-square rounded-xl overflow-hidden shadow-xs relative bg-black/20">
                      <img
                        src={album.coverUrl}
                        alt={album.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs truncate group-hover:text-sky-400">
                        {album.title}
                      </h4>
                      <p className="text-[10px] opacity-60 truncate">
                        {album.year} • Album
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 4. Similar Artists */}
          {artistData.similarArtists && artistData.similarArtists.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wider opacity-70">
                Fans Also Like
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {artistData.similarArtists.map((sim) => (
                  <div
                    key={sim.id}
                    onClick={() => googleMusicEngine.navigateToArtist(sim.name)}
                    className="p-3 rounded-2xl border flex flex-col items-center text-center cursor-pointer hover:border-sky-500/50 transition-all group"
                    style={{
                      backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.1))',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    <div className="w-16 h-16 rounded-full overflow-hidden shadow-md group-hover:scale-105 transition-transform mb-2">
                      <img
                        src={sim.avatarUrl}
                        alt={sim.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="font-bold text-xs truncate w-full group-hover:text-sky-400">
                      {sim.name}
                    </div>
                    <div className="text-[10px] opacity-60 truncate w-full">
                      {sim.genre}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};
