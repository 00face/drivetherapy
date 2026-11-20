/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Music Side Panel: UP NEXT / LYRICS / DETAILS / RELATED tabs.
 */

import React, { useState } from 'react';
import { Bookmark, Check, Disc3, ListPlus, Radio, Send, X } from 'lucide-react';
import { googleMusicEngine, GoogleMusicState, GoogleMusicSubAccount, MusicPlaylist, MusicTrack } from '../../services/googleMusicEngine';
import { findActiveLyricIndex } from '../../services/music/musicLyrics';
import { formatTime } from './musicFormat';

interface MusicSidePanelProps {
  musicState: GoogleMusicState;
  filteredTracks: MusicTrack[];
  filteredPlaylists: MusicPlaylist[];
  activeSubAccount: GoogleMusicSubAccount;
  newNoteText: string;
  setNewNoteText: (v: string) => void;
  handleAddNote: (e: React.FormEvent) => void;
}

export const MusicSidePanel: React.FC<MusicSidePanelProps> = ({
  musicState,
  filteredTracks,
  filteredPlaylists,
  activeSubAccount,
  newNoteText,
  setNewNoteText,
  handleAddNote,
}) => {
  const currentTrack: MusicTrack = musicState.currentTrack;
  const [savedQueueNotice, setSavedQueueNotice] = useState(false);
  const [editingLyrics, setEditingLyrics] = useState(false);
  const [draftLyrics, setDraftLyrics] = useState('');

  const handleSaveQueue = () => {
    const activePl = googleMusicEngine.getActivePlaylist();
    const title = `${activePl?.title || 'Queue'} (${new Date().toLocaleDateString()})`;
    googleMusicEngine.saveQueueAsPlaylist(title);
    setSavedQueueNotice(true);
    setTimeout(() => setSavedQueueNotice(false), 2000);
  };

  const handleSaveLyrics = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTrack || !draftLyrics.trim()) return;
    googleMusicEngine.setTrackLyrics(currentTrack.id, draftLyrics);
    setEditingLyrics(false);
    setDraftLyrics('');
  };

  const activeLyricIdx = findActiveLyricIndex(musicState.parsedLyrics, musicState.currentTime);

  return (
<div
                  className="w-full lg:w-96 flex flex-col min-h-0 bg-black/5 dark:bg-black/20 select-none"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  {/* 4 Tab Segmented Headers */}
                  <div
                    className="flex items-center border-b text-xs font-bold shrink-0"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    {[
                      { id: 'up_next', label: 'UP NEXT' },
                      { id: 'lyrics', label: 'LYRICS' },
                      { id: 'details', label: 'DETAILS' },
                      { id: 'related', label: 'RELATED' },
                    ].map((tab) => {
                      const active = musicState.activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() =>
                            googleMusicEngine.setActiveTab(tab.id as any)
                          }
                          className={`flex-1 py-3 text-center border-b-2 transition-all font-bold ${
                            active
                              ? 'border-white text-white font-extrabold'
                              : 'border-transparent opacity-60 hover:opacity-100 hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab 1: UP NEXT Queue */}
                  {musicState.activeTab === 'up_next' && (
                    <div className="flex-1 flex flex-col min-h-0 p-4 gap-3 overflow-y-auto">
                      {/* Playing from row with Save bookmark */}
                      <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--theme-border)' }}>
                        <div>
                          <span className="text-[10px] uppercase font-bold opacity-60 block">Playing from</span>
                          <span className="text-xs font-bold leading-tight truncate block max-w-[200px]">
                            {googleMusicEngine.getActivePlaylist().title}
                          </span>
                        </div>
                        <button
                          onClick={handleSaveQueue}
                          className="px-2.5 py-1 rounded-xl border flex items-center gap-1.5 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/10"
                          style={{ borderColor: 'var(--theme-border)' }}
                          title="Save Current Queue as User Playlist"
                        >
                          {savedQueueNotice ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Bookmark className="w-3.5 h-3.5 text-sky-500" />
                          )}
                          <span>{savedQueueNotice ? 'Saved' : 'Save'}</span>
                        </button>
                      </div>

                      {/* Autoplay Switch Toggle (Image 3) */}
                      <div className="flex items-center justify-between py-1">
                        <div>
                          <div className="text-xs font-bold">Autoplay</div>
                          <div className="text-[10px] opacity-60">
                            Add similar content to the end of the queue
                          </div>
                        </div>
                        <button
                          onClick={() => googleMusicEngine.setAutoplay(!musicState.autoplay)}
                          className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${
                            musicState.autoplay ? 'bg-sky-500' : 'bg-gray-600'
                          }`}
                          aria-label="Toggle Autoplay"
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white transition-transform ${
                              musicState.autoplay ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Queue Tracklist */}
                      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-60">
                        {filteredTracks.map((track, qIdx) => {
                          const isCurrent = currentTrack.id === track.id;
                          return (
                            <div
                              key={track.id}
                              onClick={() => googleMusicEngine.playTrack(track.id)}
                              className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer group ${
                                isCurrent
                                  ? 'bg-sky-500/15 border-sky-500 text-sky-600 dark:text-sky-300 shadow-xs'
                                  : 'hover:bg-black/5 dark:hover:bg-white/5 border-transparent'
                              }`}
                              style={!isCurrent ? { borderColor: 'var(--theme-border)' } : undefined}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-2xs">
                                  <img
                                    src={track.albumArtUrl}
                                    alt={track.title}
                                    className="w-full h-full object-cover"
                                  />
                                  {isCurrent && musicState.isPlaying && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                      <Disc3 className="w-4 h-4 text-emerald-400 animate-spin" />
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <div className="font-bold text-xs truncate group-hover:text-sky-500 transition-colors">
                                    {track.title}
                                  </div>
                                  <div className="text-[11px] opacity-65 truncate font-medium">
                                    {track.artist}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    googleMusicEngine.playNext(track);
                                  }}
                                  className="opacity-0 group-hover:opacity-80 hover:opacity-100 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
                                  title="Play Next"
                                >
                                  <ListPlus className="w-3.5 h-3.5 text-sky-500" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    googleMusicEngine.startRadio(track.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-80 hover:opacity-100 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
                                  title="Start Radio"
                                >
                                  <Radio className="w-3.5 h-3.5 text-emerald-500" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    googleMusicEngine.removeFromQueue(qIdx);
                                  }}
                                  className="opacity-0 group-hover:opacity-70 hover:opacity-100 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
                                  title="Remove from Queue"
                                >
                                  <X className="w-3 h-3 text-rose-500" />
                                </button>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono uppercase font-bold opacity-60 border" style={{ borderColor: 'var(--theme-border)' }}>
                                  {track.format}
                                </span>
                                <span className="text-[11px] font-mono opacity-60">
                                  {formatTime(track.durationSeconds)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tab 2: LYRICS */}
                  {musicState.activeTab === 'lyrics' && (
                    <div className="flex-1 p-5 overflow-y-auto space-y-4">
                      <div className="border-b pb-2 flex items-center justify-between gap-2" style={{ borderColor: 'var(--theme-border)' }}>
                        <div>
                          <h4 className="font-bold text-sm">{currentTrack.title}</h4>
                          <p className="text-xs opacity-60">{currentTrack.artist} • LRC Synced Lyrics</p>
                        </div>
                        <button
                          onClick={() => setEditingLyrics(!editingLyrics)}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg border hover:bg-black/5 dark:hover:bg-white/10"
                          style={{ borderColor: 'var(--theme-border)' }}
                        >
                          {editingLyrics ? 'Cancel' : 'Edit / Paste LRC'}
                        </button>
                      </div>

                      {editingLyrics ? (
                        <form onSubmit={handleSaveLyrics} className="space-y-2 text-xs">
                          <textarea
                            rows={8}
                            value={draftLyrics}
                            onChange={(e) => setDraftLyrics(e.target.value)}
                            placeholder="[00:12.00] First line...&#10;[00:18.50] Second line..."
                            className="w-full p-3 rounded-xl border focus:border-sky-500 focus:outline-none font-mono"
                            style={{
                              backgroundColor: 'var(--theme-surface)',
                              borderColor: 'var(--theme-border)',
                              color: 'var(--theme-text)',
                            }}
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 rounded-xl bg-sky-600 text-white font-bold"
                          >
                            Save Lyrics
                          </button>
                        </form>
                      ) : musicState.parsedLyrics.length > 0 ? (
                        <div className="space-y-2.5 font-medium text-sm leading-relaxed opacity-90">
                          {musicState.parsedLyrics.map((line, idx) => (
                            <p
                              key={idx}
                              onClick={() => {
                                if (line.timeSec >= 0) googleMusicEngine.seek(line.timeSec);
                              }}
                              className={`transition-colors py-1 px-2 rounded-lg ${
                                line.timeSec >= 0 ? 'cursor-pointer' : ''
                              } ${
                                idx === activeLyricIdx
                                  ? 'bg-sky-500/20 text-sky-400 font-bold'
                                  : 'opacity-70 hover:opacity-100'
                              }`}
                            >
                              {line.text}
                            </p>
                          ))}
                        </div>
                      ) : currentTrack.lyrics && currentTrack.lyrics.length > 0 ? (
                        <div className="space-y-3 font-medium text-sm leading-relaxed opacity-90">
                          {currentTrack.lyrics.map((line, idx) => (
                            <p key={idx} className="py-1 px-2 rounded-lg opacity-80">
                              {line}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-10 opacity-60 text-xs">
                          No lyrics stored for this track yet. Click Edit / Paste LRC above to add synced lyrics.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 3: DETAILS */}
                  {musicState.activeTab === 'details' && (
                    <div className="flex-1 flex flex-col min-h-0 p-4 gap-3">
                      {/* File Metadata Card */}
                      <div
                        className="p-3 rounded-xl border space-y-1.5 text-[11px]"
                        style={{
                          backgroundColor: 'var(--theme-surface)',
                          borderColor: 'var(--theme-border)',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold uppercase tracking-wider text-[10px] opacity-60">
                            Media Source
                          </span>
                          <span className="font-semibold text-sky-500">
                            {currentTrack.source === 'local' ? 'Local Computer' : 'Google Drive'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold uppercase tracking-wider text-[10px] opacity-60 shrink-0">
                            Album / Folder
                          </span>
                          <span className="truncate font-medium">{currentTrack.album}</span>
                        </div>
                        {currentTrack.albumArtist && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold uppercase tracking-wider text-[10px] opacity-60 shrink-0">
                              Album Artist
                            </span>
                            <span className="truncate font-medium">{currentTrack.albumArtist}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold uppercase tracking-wider text-[10px] opacity-60 shrink-0">
                            Track / Year
                          </span>
                          <span className="font-mono text-[10px] tabular-nums">
                            {currentTrack.discNumber ? `D${currentTrack.discNumber}-` : ''}
                            {currentTrack.trackNumber ? `#${currentTrack.trackNumber}` : '—'}
                            {currentTrack.year ? ` • ${currentTrack.year}` : ''}
                          </span>
                        </div>
                        {currentTrack.albumUid && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold uppercase tracking-wider text-[10px] opacity-60 shrink-0">
                              Album UID ({currentTrack.uidSource || 'tag'})
                            </span>
                            <span
                              className="truncate font-mono text-[10px] text-emerald-500 max-w-[165px]"
                              title={currentTrack.albumUid}
                            >
                              {currentTrack.albumUid}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold uppercase tracking-wider text-[10px] opacity-60 shrink-0">
                            Format / Genre
                          </span>
                          <span className="uppercase font-mono text-[10px]">
                            {currentTrack.format} • {currentTrack.genre}
                          </span>
                        </div>
                        {(currentTrack.localPath || currentTrack.driveFileId) && (
                          <div className="pt-1 border-t text-[10px] opacity-70 truncate font-mono" style={{ borderColor: 'var(--theme-border)' }} title={currentTrack.localPath || currentTrack.driveFileId}>
                            {currentTrack.localPath || `Drive ID: ${currentTrack.driveFileId}`}
                          </div>
                        )}
                      </div>

                      {/* Add Note Input */}
                      <form onSubmit={handleAddNote} className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'var(--theme-border)' }}>
                        <div className="w-7 h-7 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {activeSubAccount?.name?.charAt(0) || 'U'}
                        </div>
                        <input
                          type="text"
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          placeholder="Add a track note..."
                          className="flex-1 px-3 py-1.5 text-xs rounded-xl border focus:border-sky-500 focus:outline-none"
                          style={{
                            backgroundColor: 'var(--theme-surface)',
                            borderColor: 'var(--theme-border)',
                            color: 'var(--theme-text)',
                          }}
                        />
                        <button
                          type="submit"
                          disabled={!newNoteText.trim()}
                          className="p-2 rounded-xl bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40 transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>

                      {/* Track Notes Feed */}
                      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                        {currentTrack.notes && currentTrack.notes.length > 0 ? (
                          currentTrack.notes.map((note) => (
                            <div key={note.id} className="flex gap-2.5 text-xs">
                              <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                                {note.avatarUrl ? (
                                  <img src={note.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  note.author.charAt(0)
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold truncate">{note.author}</span>
                                  <span className="text-[10px] opacity-50">{note.timeAgo}</span>
                                </div>
                                <p className="opacity-85 mt-1 leading-normal break-words">
                                  {note.text}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 opacity-60 text-xs">
                            No track notes yet. Add session notes or mix cues above.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tab 4: RELATED */}
                  {musicState.activeTab === 'related' && (
                    <div className="flex-1 p-4 overflow-y-auto space-y-3">
                      <div className="text-xs font-bold opacity-70 uppercase tracking-wider">
                        Suggested Content
                      </div>
                      {filteredPlaylists.slice(0, 5).map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            googleMusicEngine.selectPlaylist(item.id);
                            if (item.tracks[0]) googleMusicEngine.playTrack(item.tracks[0].id);
                          }}
                          className="flex items-center gap-3 p-2 rounded-xl border hover:border-sky-500/50 cursor-pointer transition-colors"
                          style={{ borderColor: 'var(--theme-border)' }}
                        >
                          <img
                            src={item.coverUrl}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <h6 className="font-bold text-xs truncate">{item.title}</h6>
                            <p className="text-[11px] opacity-60 truncate">
                              {item.author} • {item.trackCount || 8} tracks
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
  );
};
