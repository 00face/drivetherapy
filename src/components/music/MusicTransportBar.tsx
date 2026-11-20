/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Music Transport Bar: track info, like, transport, scrubber, volume, captions, minimize.
 */

import React, { useState } from 'react';
import { ChevronDown, MoreVertical, Pause, PictureInPicture2, Play, Radio, Repeat, Share2, Shuffle, SkipBack, SkipForward, Subtitles, ThumbsDown, ThumbsUp, Volume2, VolumeX } from 'lucide-react';
import { googleMusicEngine, GoogleMusicState } from '../../services/googleMusicEngine';
import { formatTime } from './musicFormat';

interface MusicTransportBarProps {
  musicState: GoogleMusicState;
  showCaptions: boolean;
  onToggleCaptions: () => void;
  onPip: () => void;
  onClose: () => void;
  isPipActive?: boolean;
}

export const MusicTransportBar: React.FC<MusicTransportBarProps> = ({
  musicState,
  showCaptions,
  onToggleCaptions,
  onPip,
  onClose,
  isPipActive = false,
}) => {
  const currentTrack = musicState.currentTrack;
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  return (
<div
          className="px-5 py-3 border-t flex flex-col md:flex-row items-center justify-between gap-3 shrink-0"
          style={{
            backgroundColor: 'var(--theme-surface)',
            borderColor: 'var(--theme-border)',
          }}
        >
          {/* Left: Track Thumbnail, Title, Views/Likes, Thumbs Up/Down */}
          <div className="flex items-center gap-3 min-w-0 w-full md:w-auto">
            <div
              onClick={() => googleMusicEngine.setActiveView('nowplaying')}
              className="w-11 h-11 rounded-xl overflow-hidden shadow-md shrink-0 bg-slate-800 cursor-pointer hover:opacity-90 active:scale-95 transition-all group relative"
              title="Switch to Now Playing Stage"
            >
              <img
                src={currentTrack.albumArtUrl}
                alt={currentTrack.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>
            <div
              onClick={() => googleMusicEngine.setActiveView('nowplaying')}
              className="min-w-0 flex-1 md:max-w-xs cursor-pointer group"
              title="Switch to Now Playing Stage"
            >
              <div className="font-bold text-xs truncate leading-tight group-hover:text-sky-400 transition-colors">
                {currentTrack.title}
              </div>
              <div className="text-[10px] opacity-65 truncate mt-0.5">
                {[currentTrack.artist, currentTrack.album, currentTrack.format?.toUpperCase(), currentTrack.source === 'local' ? 'Local' : 'Drive'].filter(Boolean).join(' • ')}
              </div>
            </div>

            {/* Like & Dislike Controls */}
            <div className="flex items-center gap-1 shrink-0 ml-1">
              <button
                onClick={() => googleMusicEngine.toggleLikeCurrentTrack()}
                className={`p-2 rounded-xl transition-colors ${
                  currentTrack.isLiked
                    ? 'text-sky-500 bg-sky-500/10'
                    : 'opacity-65 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                title="Thumbs up"
              >
                <ThumbsUp className={`w-4 h-4 ${currentTrack.isLiked ? 'fill-sky-500' : ''}`} />
              </button>
              <button
                onClick={() =>
                  googleMusicEngine.rateTrack(
                    currentTrack.id,
                    googleMusicEngine.getTrackRating(currentTrack.id) === 'down' ? 'none' : 'down'
                  )
                }
                className={`p-2 rounded-xl transition-colors ${
                  googleMusicEngine.getTrackRating(currentTrack.id) === 'down'
                    ? 'text-rose-500 bg-rose-500/10'
                    : 'opacity-65 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                title="Thumbs down"
              >
                <ThumbsDown className="w-4 h-4" />
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="p-2 rounded-xl opacity-65 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  title="More actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showMoreMenu && (
                  <div
                    className="absolute bottom-full left-0 mb-2 w-48 rounded-2xl border p-2 shadow-2xl text-xs z-50 space-y-1 backdrop-blur-md"
                    style={{
                      backgroundColor: 'var(--theme-surface)',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        googleMusicEngine.startRadio(currentTrack.id);
                      }}
                      className="w-full p-2 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2"
                    >
                      <Radio className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Start Track Radio</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        onPip();
                      }}
                      className="w-full p-2 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2"
                    >
                      <PictureInPicture2 className="w-3.5 h-3.5 text-sky-500" />
                      <span>Picture-in-Picture</span>
                    </button>
                    <button
                      onClick={() => setShowMoreMenu(false)}
                      className="w-full p-2 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share Track</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center: Transport Controls & Scrubber */}
          <div className="flex flex-col items-center gap-1.5 w-full md:max-w-md">
            <div className="flex items-center gap-4 sm:gap-6">
              <button
                onClick={() => googleMusicEngine.toggleShuffle()}
                className={`p-1.5 rounded-lg transition-colors ${
                  musicState.isShuffle ? 'text-sky-500 font-bold' : 'opacity-50 hover:opacity-100'
                }`}
                title="Shuffle Queue"
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => googleMusicEngine.prev()}
                className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-transform active:scale-90"
                title="Previous Track"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={() => googleMusicEngine.togglePlay()}
                className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#1074B1] to-[#52B197] hover:opacity-95 text-white flex items-center justify-center shadow-md transition-transform active:scale-95"
                title={musicState.isPlaying ? 'Pause' : 'Play'}
              >
                {musicState.isPlaying ? (
                  <Pause className="w-5 h-5 fill-white" />
                ) : (
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                )}
              </button>

              <button
                onClick={() => googleMusicEngine.next()}
                className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-transform active:scale-90"
                title="Next Track"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                onClick={() => googleMusicEngine.toggleRepeat()}
                className={`p-1.5 rounded-lg transition-colors relative ${
                  musicState.repeatMode !== 'off' ? 'text-sky-500 font-bold' : 'opacity-50 hover:opacity-100'
                }`}
                title={`Repeat: ${musicState.repeatMode}`}
              >
                <Repeat className="w-3.5 h-3.5" />
                {musicState.repeatMode === 'one' && (
                  <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-sky-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                    1
                  </span>
                )}
              </button>
            </div>

            {/* Time scrubber */}
            <div className="w-full flex items-center gap-2 text-[10px] font-mono opacity-65">
              <span>{formatTime(musicState.currentTime)}</span>
              <input
                type="range"
                min="0"
                max={musicState.duration || 180}
                value={musicState.currentTime}
                onChange={(e) => googleMusicEngine.seek(parseFloat(e.target.value))}
                className="flex-1 h-1 accent-sky-500 cursor-pointer"
              />
              <span>{formatTime(musicState.duration)}</span>
            </div>
          </div>

          {/* Right: Volume, CC, Slide Down */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => googleMusicEngine.setVolume(musicState.volume === 0 ? 0.8 : 0)}
                className="opacity-70 hover:opacity-100"
              >
                {musicState.volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-500" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={musicState.volume}
                onChange={(e) => googleMusicEngine.setVolume(parseFloat(e.target.value))}
                className="w-18 accent-sky-500 h-1 cursor-pointer"
              />
            </div>

            {/* CC Subtitles Toggle */}
            <button
              onClick={() => onToggleCaptions()}
              className={`p-2 rounded-xl transition-colors ${
                showCaptions ? 'text-sky-500 bg-sky-500/10 font-bold' : 'opacity-50 hover:opacity-100'
              }`}
              title="Closed Captions / Lyrics Subtitles"
            >
              <Subtitles className="w-4 h-4" />
            </button>

            {/* Interactive Picture-in-Picture Toggle */}
            <button
              type="button"
              onClick={onPip}
              aria-pressed={isPipActive}
              className={`p-2 rounded-xl border transition-colors ${
                isPipActive
                  ? 'text-teal-500 bg-teal-500/15 border-teal-500/40 font-bold'
                  : 'border-transparent opacity-65 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title={isPipActive ? 'Close Picture-in-Picture' : 'Toggle Picture-in-Picture (PiP)'}
              aria-label={isPipActive ? 'Close Picture-in-Picture' : 'Toggle Picture-in-Picture'}
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

            {/* Down Chevron Minimize */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
              title="Minimize Player"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>
  );
};
