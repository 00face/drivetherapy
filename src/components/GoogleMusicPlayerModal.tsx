/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drive Therapy Media Studio Player Modal
 * Unified audio & video listening environment for Google Drive & Local Disk files:
 * - Multi-Account Google Drive Profile Switcher & Local Session manager
 * - Unified Source Filter: All Media | Google Drive | Local Files
 * - Filter Categories: [Playlists] [Songs] [Albums] [Artists] [Profiles] [Podcasts] & Sort
 * - Harmonized Video Screen & 4-Tab Panel: [UP NEXT], [LYRICS], [DETAILS], [RELATED]
 * - Spinning vinyl turntable with 64-band audio spectrum visualizer & 3-band parametric EQ
 * - Bottom persistent playback control bar with thumbs up/down, source info, CC, repeat, shuffle
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Search,
  Music,
  Disc3,
  Sliders,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ListMusic,
  Radio,
  Clock,
  Gauge,
  Check,
  Plus,
  Users,
  ArrowLeft,
  UserPlus,
  LogOut,
  ThumbsUp,
  ThumbsDown,
  MoreVertical,
  Subtitles,
  Maximize2,
  PictureInPicture2,
  HardDrive,
  Cloud,
  Film,
  History,
  Bookmark,
  Share2,
  Send,
  MessageSquare,
  FileAudio,
  FolderOpen,
  RefreshCw,
  Home,
  Compass,
  Library,
} from 'lucide-react';
import {
  googleMusicEngine,
  GoogleMusicState,
  MusicTrack,
  MusicFilterCategory,
  MusicSortOption,
  GoogleMusicSubAccount,
} from '../services/googleMusicEngine';
import { MusicAccountsDrawer } from './music/MusicAccountsDrawer';
import { MusicTransportBar } from './music/MusicTransportBar';
import { MusicSidePanel } from './music/MusicSidePanel';
import { MusicHomeView } from './music/MusicHomeView';
import { MusicExploreView } from './music/MusicExploreView';
import { MusicLibraryView } from './music/MusicLibraryView';
import { MusicArtistView } from './music/MusicArtistView';
import { MusicAlbumView } from './music/MusicAlbumView';
import { formatTime } from './music/musicFormat';
import { universalMediaPlayer } from '../services/universalMediaPlayerEngine';
import {
  VISUALIZER_MODES,
  VisualizerMode,
  drawVisualizerFrame,
} from '../services/visualizerRenderer';
import { startDirectServerOAuth } from '../services/googleDrive';
import { MediaAsset } from '../types';

interface GoogleMusicPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPip?: (asset: MediaAsset) => void;
  onClosePip?: () => void;
  isPipActive?: boolean;
  user?: any;
}

export const GoogleMusicPlayerModal: React.FC<GoogleMusicPlayerModalProps> = ({
  isOpen,
  onClose,
  onOpenPip,
  onClosePip,
  isPipActive = false,
  user,
}) => {
  const [musicState, setMusicState] = useState<GoogleMusicState>(() =>
    googleMusicEngine.getState()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [bass, setBass] = useState(0);
  const [mid, setMid] = useState(0);
  const [treble, setTreble] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showCaptions, setShowCaptions] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Account Drawer State
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountHandle, setNewAccountHandle] = useState('');
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const [newAccountRole, setNewAccountRole] = useState('');
  const [newAccountType] = useState<GoogleMusicSubAccount['accountType']>('workspace_sub');

  // Track Notes interaction
  const [newNoteText, setNewNoteText] = useState('');
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>(() => {
    try {
      const saved = localStorage.getItem('dt_visualizer_mode_v1') as VisualizerMode | null;
      return saved && VISUALIZER_MODES.some((m) => m.id === saved) ? saved : 'spectrum';
    } catch {
      return 'spectrum';
    }
  });
  const [videoFitMode, setVideoFitMode] = useState<'contain' | 'cover'>('contain');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageHostRef = useRef<HTMLDivElement>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const openedHandshakeRef = useRef(false);

  // Sync state from engine
  useEffect(() => {
    const unsub = googleMusicEngine.subscribe((state) => {
      setMusicState(state);
    });
    return () => unsub();
  }, []);

  // Fetch search autocomplete suggestions
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(() => {
      const q = searchQuery.trim().toLowerCase();
      const matches = googleMusicEngine.searchTracks(q);
      const unique = Array.from(
        new Set(
          matches.flatMap((t) => [t.title, t.artist, t.album].filter((v) => v && v.toLowerCase().includes(q)))
        )
      ).slice(0, 8);
      setSearchSuggestions(unique);
      setShowSuggestions(unique.length > 0);
    }, 100);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Sync user account media & Google profile once per open session (prevents scan-media re-render loop)
  const userEmail = user?.email || '';
  const userDisplayName = user?.displayName || '';
  const userPhotoUrl = user?.photoURL || '';
  useEffect(() => {
    if (!isOpen) {
      openedHandshakeRef.current = false;
      return;
    }
    if (openedHandshakeRef.current) return;
    openedHandshakeRef.current = true;

    try {
      if (userEmail) {
        googleMusicEngine.syncGoogleUserProfile({
          name: userDisplayName || userEmail.split('@')[0],
          email: userEmail,
          avatarUrl: userPhotoUrl || undefined,
        });
      }
      googleMusicEngine.onPlayerOpened();
    } catch (err) {
      console.warn('[MusicPlayer] Failed to perform opening handshake:', err);
    }
  }, [isOpen, userEmail, userDisplayName, userPhotoUrl]);

  // In-player keyboard ergonomics (Space, j/k, Left/Right, Up/Down, m, Esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          googleMusicEngine.togglePlay();
          break;
        case 'j':
          e.preventDefault();
          googleMusicEngine.next();
          break;
        case 'k':
          e.preventDefault();
          googleMusicEngine.prev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          googleMusicEngine.seek(musicState.currentTime + 5);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          googleMusicEngine.seek(Math.max(0, musicState.currentTime - 5));
          break;
        case 'ArrowUp':
          e.preventDefault();
          googleMusicEngine.setVolume(Math.min(1.5, musicState.volume + 0.05));
          break;
        case 'ArrowDown':
          e.preventDefault();
          googleMusicEngine.setVolume(Math.max(0, musicState.volume - 0.05));
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          googleMusicEngine.setVolume(musicState.volume > 0 ? 0 : 0.85);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, musicState.currentTime, musicState.volume, onClose]);

  // Mount the engine's shared media element into the stage; park it off-screen (still in DOM) otherwise
  // so audio keeps playing when the stage unmounts (detached media elements auto-pause).
  useEffect(() => {
    const el = googleMusicEngine.getMediaElement();
    const host = stageHostRef.current;
    if (!el) return;
    if (isOpen && host) {
      googleMusicEngine.attachMediaToStage(host);
      videoRef.current = el;
    } else {
      googleMusicEngine.attachMediaToStage(null);
    }
    return () => {
      googleMusicEngine.attachMediaToStage(null);
    };
  }, [isOpen, musicState.isVideoMode, musicState.activeView, musicState.activeCategory]);

  // Visualizer render loop for vinyl mode
  useEffect(() => {
    if (!isOpen || musicState.isVideoMode) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isCalmMotion = () =>
      typeof document !== 'undefined' &&
      (document.body.classList.contains('calm-motion') ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    let angle = 0;

    const drawFrame = () => {
      const spectrum = universalMediaPlayer.getFrequencySpectrum();
      drawVisualizerFrame(
        ctx,
        canvas.width,
        canvas.height,
        spectrum,
        visualizerMode,
        angle,
        musicState.isPlaying,
        isCalmMotion()
      );
    };

    const render = () => {
      drawFrame();
      if (isCalmMotion()) {
        return;
      }
      angle += 0.05;
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isOpen, musicState.isPlaying, musicState.isVideoMode, visualizerMode]);

  useEffect(() => {
    try {
      localStorage.setItem('dt_visualizer_mode_v1', visualizerMode);
    } catch {}
  }, [visualizerMode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'v' || e.key === 'V') {
        setVisualizerMode((prev) => {
          const idx = VISUALIZER_MODES.findIndex((m) => m.id === prev);
          return VISUALIZER_MODES[(idx + 1) % VISUALIZER_MODES.length].id;
        });
      } else if (e.key === 'f' || e.key === 'F') {
        const target = googleMusicEngine.getMediaElement() || stageContainerRef.current;
        target?.requestFullscreen?.();
      } else if (e.key === 'ArrowLeft') {
        googleMusicEngine.seek(Math.max(0, musicState.currentTime - 10));
      } else if (e.key === 'ArrowRight') {
        googleMusicEngine.seek(musicState.currentTime + 10);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, musicState.currentTime]);

  const isNowPlayingStageVisible =
    musicState.activeView === 'nowplaying' ||
    (musicState.activeView === 'home' && musicState.activeCategory === 'all');

  useEffect(() => {
    if (!isOpen || !musicState.isVideoMode || !isNowPlayingStageVisible || !musicState.isPlaying) {
      return;
    }
    const el = stageContainerRef.current;
    if (!el || typeof el.scrollIntoView !== 'function') return;
    const calm =
      document.body.classList.contains('calm-motion') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'nearest' });
  }, [isOpen, musicState.isVideoMode, isNowPlayingStageVisible, musicState.isPlaying, musicState.currentTrack?.id]);

  if (!isOpen) return null;

  const currentTrack = musicState.currentTrack;
  const filteredTracks = googleMusicEngine.searchTracks(searchQuery);
  const filteredPlaylists = googleMusicEngine.getFilteredPlaylists();
  const subAccounts = googleMusicEngine.getSubAccounts();
  const activeSubAccount = musicState.activeSubAccount || subAccounts[0];
  const primaryUser = activeSubAccount?.primaryUser || {
    name: activeSubAccount?.name || 'Studio Account',
    email: activeSubAccount?.email || 'studio@drivetherapy.internal',
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    googleMusicEngine.seek(val);
  };

  const handleEqChange = (type: 'bass' | 'mid' | 'treble', val: number) => {
    if (type === 'bass') setBass(val);
    if (type === 'mid') setMid(val);
    if (type === 'treble') setTreble(val);
    universalMediaPlayer.setEqualizer(
      type === 'bass' ? val : bass,
      type === 'mid' ? val : mid,
      type === 'treble' ? val : treble
    );
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    universalMediaPlayer.setPlaybackRate(speed);
  };

  // Harmonized PiP Integration: interactive toggle bridging native PiP and context-aware FloatingPipPlayer
  const handleOpenPip = async () => {
    if ((isPipActive || musicState.isPipActive) && onClosePip) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture().catch(() => {});
      }
      googleMusicEngine.setPipActive(false);
      onClosePip();
      return;
    }

    const el = videoRef.current ?? googleMusicEngine.getMediaElement();
    if (
      el &&
      currentTrack.isVideo &&
      document.pictureInPictureEnabled &&
      !document.pictureInPictureElement
    ) {
      try {
        await el.requestPictureInPicture();
        googleMusicEngine.setPipActive(true);
        el.addEventListener('leavepictureinpicture', () => googleMusicEngine.setPipActive(false), { once: true });
        return;
      } catch (err) {
        console.info('Native PiP unavailable, using in-app floating player:', err);
      }
    }

    const pipAsset: MediaAsset = {
      id: currentTrack.id,
      name: `${currentTrack.artist} - ${currentTrack.title}`,
      source: currentTrack.source === 'local' ? 'local' : 'cloud',
      category: currentTrack.isVideo ? 'video' : 'audio',
      mimeType: currentTrack.mimeType || (currentTrack.isVideo ? 'video/mp4' : `audio/${currentTrack.format}`),
      extension: currentTrack.format,
      path: currentTrack.localPath || currentTrack.videoUrl || currentTrack.albumArtUrl,
      cloudUrl: currentTrack.videoUrl || undefined,
      thumbnailUrl: currentTrack.albumArtUrl,
      sizeBytes: 0,
      modifiedTime: new Date().toISOString(),
      isCached: true,
      cullingStatus: 'unrated',
      rating: 0,
      tags: ['music', currentTrack.genre],
      faces: [],
      quality: { sharpness: 0, exposure: 0, overall: 0, isBlurry: false },
      palette: [],
      exif: {} as any,
    } as MediaAsset;

    // Hand playback to the floating player so two players never play at once
    googleMusicEngine.pause();
    googleMusicEngine.setPipActive(true);
    onOpenPip?.(pipAsset);
  };

  const handleSwitchAccount = (id: string) => {
    googleMusicEngine.switchSubAccount(id);
    setIsAccountDrawerOpen(false);
  };

  const handleCreateSubAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim() || !newAccountEmail.trim()) return;
    googleMusicEngine.addSubAccount({
      name: newAccountName.trim(),
      handle: newAccountHandle.trim() || undefined,
      email: newAccountEmail.trim(),
      roleLabel: newAccountRole.trim() || 'Drive Profile',
      accountType: newAccountType,
    });
    setNewAccountName('');
    setNewAccountHandle('');
    setNewAccountEmail('');
    setNewAccountRole('');
    setShowAddAccountModal(false);
    setIsAccountDrawerOpen(false);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    const authorName = activeSubAccount?.name || 'Local User';
    if (!currentTrack.notes) {
      currentTrack.notes = [];
    }
    currentTrack.notes.unshift({
      id: `note_${Date.now()}`,
      author: authorName,
      timeAgo: 'Just now',
      text: newNoteText.trim(),
    });
    setNewNoteText('');
  };

  const filterCategories: { id: MusicFilterCategory; label: string }[] = [
    { id: 'playlists', label: 'Playlists' },
    { id: 'songs', label: 'Songs' },
    { id: 'albums', label: 'Albums' },
    { id: 'artists', label: 'Artists' },
    { id: 'profiles', label: 'Owners' },
    { id: 'podcasts', label: 'Podcasts' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Media Studio Player"
      className="fixed inset-0 z-60 bg-black/75 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div
        className="w-full h-[94vh] rounded-t-3xl border-t shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 relative"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* =========================================================================
            TOP HEADER BAR: Title, Unified Source Switcher (All | Drive | Local), Search, Profile
           ========================================================================= */}
        <div
          className="px-5 py-3 border-b flex items-center justify-between gap-4 shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          {/* Left: Brand & Unified Source Switcher */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#1074B1] to-[#52B197] flex items-center justify-center text-white shadow-xs shrink-0">
              <Disc3
                className={`w-4 h-4 ${musicState.isPlaying ? 'animate-spin' : ''}`}
                style={{ animationDuration: '4s' }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold leading-tight">Media Studio Player</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#1074B1]/10 text-[#1074B1] border border-[#1074B1]/20">
                  {currentTrack.format.toUpperCase()} Lossless Studio
                </span>
                {musicState.libraryStatus.loading && (
                  <span className="flex items-center gap-1 text-[10px] text-sky-400 font-medium animate-pulse ml-0.5" title="Synchronizing Google Drive & local media library in background">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    <span className="hidden sm:inline">Syncing...</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] opacity-65 leading-tight">
                {currentTrack.genre} • {currentTrack.source === 'local' ? 'Local File' : 'Google Drive'}
              </p>
            </div>

            {/* Segmented Unified Source Switcher (All | Google Drive | Local Files) */}
            <div
              className="hidden xl:flex items-center p-0.5 rounded-xl border ml-2 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.15))',
                borderColor: 'var(--theme-border)',
              }}
            >
              <button
                onClick={() => googleMusicEngine.setMediaSource('all')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                  musicState.activeMediaSource === 'all'
                    ? 'bg-slate-800 dark:bg-white text-white dark:text-black shadow-xs font-bold'
                    : 'opacity-70 hover:opacity-100'
                }`}
                title="Combined Google Drive & Local Files Library"
              >
                <span>All Media</span>
              </button>
              <button
                onClick={() => googleMusicEngine.setMediaSource('cloud')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                  musicState.activeMediaSource === 'cloud'
                    ? 'bg-sky-500 text-white shadow-xs font-bold'
                    : 'opacity-70 hover:opacity-100'
                }`}
                title="Google Drive Audio & Video Archive"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Google Drive</span>
              </button>
              <button
                onClick={() => googleMusicEngine.setMediaSource('local')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                  musicState.activeMediaSource === 'local'
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'opacity-70 hover:opacity-100'
                }`}
                title="Local Computer Disk Storage & Files"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Local Files</span>
              </button>
            </div>

            {/* Three-Pillar View Switcher: Home / Explore / Library / Now Playing */}
            <nav className="flex items-center gap-1 ml-2">
              <button
                onClick={() => googleMusicEngine.setActiveView('home')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  musicState.activeView === 'home'
                    ? 'bg-white text-black shadow-xs'
                    : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Home</span>
              </button>
              <button
                onClick={() => googleMusicEngine.setActiveView('explore')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  musicState.activeView === 'explore'
                    ? 'bg-white text-black shadow-xs'
                    : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Explore</span>
              </button>
              <button
                onClick={() => googleMusicEngine.setActiveView('library')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  musicState.activeView === 'library'
                    ? 'bg-white text-black shadow-xs'
                    : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <Library className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Library</span>
              </button>
              <button
                onClick={() => googleMusicEngine.setActiveView('nowplaying')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  musicState.activeView === 'nowplaying'
                    ? 'bg-white text-black shadow-xs'
                    : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Switch to Now Playing Turntable Stage"
              >
                <Disc3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Now Playing</span>
              </button>
            </nav>
          </div>

          {/* Center: Search Bar (Image 3 Parity) */}
          <div className="flex-1 max-w-xl hidden md:flex items-center gap-2">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 opacity-50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search songs, albums, artists, or Drive/local files"
                className="w-full pl-9 pr-10 py-1.5 text-xs rounded-xl border focus:border-sky-500 focus:outline-none transition-all"
                style={{
                  backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.1))',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text)',
                }}
              />
              <button
                onClick={() => {
                  googleMusicEngine.setSortOption('recent');
                  const recent = googleMusicEngine.getPlayHistory()[0];
                  setSearchQuery(recent && !searchQuery ? recent.artist : '');
                }}
                className="absolute right-2.5 top-2 opacity-60 hover:opacity-100 text-xs font-mono"
                title={`Play history (${musicState.playHistory.length} played)`}
              >
                <History className="w-3.5 h-3.5" />
              </button>

              {/* Autocomplete Dropdown */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 mt-1.5 rounded-2xl border shadow-2xl p-2 z-50 animate-in fade-in duration-100"
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-border)',
                  }}
                >
                  <div className="text-[10px] uppercase font-bold opacity-50 px-2 py-1">
                    Suggestions
                  </div>
                  {searchSuggestions.map((sug) => (
                    <div
                      key={sug}
                      onClick={() => {
                        setSearchQuery(sug);
                        setShowSuggestions(false);
                      }}
                      className="px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer text-xs font-medium truncate flex items-center gap-2"
                    >
                      <Search className="w-3 h-3 opacity-40 shrink-0" />
                      <span className="truncate">{sug}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Account Button (Image 1 Trigger), EQ & Slide Down */}
          <div className="flex items-center gap-2">
            {/* Account Switcher Pill */}
            <button
              onClick={() => setIsAccountDrawerOpen(true)}
              className="px-2.5 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold hover:border-sky-500/50 transition-colors shadow-xs"
              style={{
                backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.15))',
                borderColor: 'var(--theme-border)',
              }}
              title="Switch Google Drive Account & Local Session"
              aria-label="Open Accounts Drawer"
            >
              <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 bg-sky-500 flex items-center justify-center text-[10px] text-white font-bold">
                {activeSubAccount?.avatarUrl ? (
                  <img
                    src={activeSubAccount.avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{activeSubAccount?.name?.charAt(0) || 'U'}</span>
                )}
              </div>
              <div className="text-left hidden sm:block max-w-[130px] truncate">
                <span className="truncate block leading-tight text-[11px] font-bold">
                  {activeSubAccount?.name}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] opacity-60 truncate font-mono">
                    {activeSubAccount?.handle || '@drive'}
                  </span>
                  {activeSubAccount?.accountType === 'local' && (
                    <span className="text-[8px] px-1 py-0.2 rounded font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 shrink-0">
                      Local
                    </span>
                  )}
                  {activeSubAccount?.accountType === 'workspace_sub' && (
                    <span className="text-[8px] px-1 py-0.2 rounded font-bold bg-purple-500/15 text-purple-500 border border-purple-500/25 shrink-0">
                      Drive
                    </span>
                  )}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5" />
            </button>

            {/* Rescan Drive & Local OS Folders + Enrich UID Tags */}
            <button
              onClick={() => {
                googleMusicEngine.scanLocalDriveMedia(true);
                googleMusicEngine.refreshDriveLibrary(true);
              }}
              className="min-h-[40px] px-2.5 rounded-xl transition-all border border-transparent opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              title="Rescan Google Drive & Local OS Music/Video Folders"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-500 ${musicState.libraryStatus.loading ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline">Rescan</span>
            </button>
            <button
              onClick={() => {
                void googleMusicEngine.enrichActiveAccountTags();
              }}
              className="min-h-[40px] px-2.5 rounded-xl transition-all border border-transparent opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              title="Read Embedded ID3/FLAC/MP4 Tags & MusicBrainz Album UIDs"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden xl:inline">Enrich UIDs</span>
            </button>

            {/* EQ Button */}
            <button
              onClick={() => setShowEqualizer(!showEqualizer)}
              className={`p-2 rounded-xl transition-all border flex items-center gap-1.5 text-xs font-semibold ${
                showEqualizer
                  ? 'bg-sky-500/10 border-sky-500 text-sky-600 dark:text-sky-400'
                  : 'border-transparent opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title="Parametric Equalizer & DSP"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">EQ & DSP</span>
            </button>

            {/* Minimize / Slide Down */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
              title="Slide Down"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Search Bar (<768px responsive fallback) */}
        <div className="px-4 py-2 border-b md:hidden shrink-0" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-2.5 opacity-50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search songs, albums, artists, or UIDs..."
              aria-label="Search music library"
              className="w-full min-h-[40px] pl-9 pr-4 text-xs rounded-xl border focus:border-sky-500 focus:outline-none"
              style={{
                backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.1))',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text)',
              }}
            />
          </div>
        </div>

        {/* =========================================================================
            MAIN WORKSPACE BODY (Unified across All | Google Drive | Local Files)
           ========================================================================= */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Filter Pills & Sort Row (Image 2 Parity) */}
              <div
                className="px-5 py-2.5 border-b flex items-center justify-between gap-3 shrink-0 overflow-x-auto scrollbar-none"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                {/* Filter Pills */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => googleMusicEngine.setFilterCategory('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 border ${
                      musicState.activeCategory === 'all'
                        ? 'bg-white text-black border-white shadow-xs'
                        : 'border-transparent bg-black/5 dark:bg-white/10 opacity-80 hover:opacity-100'
                    }`}
                  >
                    All
                  </button>
                  {filterCategories.map((cat) => {
                    const active = musicState.activeCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => googleMusicEngine.setFilterCategory(cat.id)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 border ${
                          active
                            ? 'bg-white text-black border-white shadow-xs'
                            : 'border-transparent bg-black/5 dark:bg-white/10 opacity-80 hover:opacity-100'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-1.5 shrink-0 text-xs font-bold opacity-80">
                  <select
                    value={musicState.activeSort}
                    onChange={(e) =>
                      googleMusicEngine.setSortOption(e.target.value as MusicSortOption)
                    }
                    className="px-3 py-1.5 rounded-xl border bg-transparent font-medium cursor-pointer text-xs focus:outline-none"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <option value="recent">Recent activity ⌵</option>
                    <option value="added">Recently added</option>
                    <option value="played">Most played</option>
                    <option value="alpha">A to Z</option>
                  </select>
                </div>
              </div>

              {/* Two-Column Stage: Left (Video / Vinyl + Cards Grid) & Right (4-Tab Panel) */}
              <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                {/* Left Column: Player Stage & Catalog Grid */}
                <div
                  className="flex-1 flex flex-col min-h-0 overflow-y-auto border-b lg:border-b-0 lg:border-r p-5 gap-5"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  {/* Mode Selector Toggle: Video vs Vinyl Audio (Now Playing Stage) */}
                  {isNowPlayingStageVisible && (
                    <>
                      <div className="flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                      <span className="text-xs font-bold opacity-75">Player Engine:</span>
                      <div
                        className="flex items-center p-0.5 rounded-xl border text-xs font-semibold"
                        style={{
                          backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.15))',
                          borderColor: 'var(--theme-border)',
                        }}
                      >
                        <button
                          onClick={() => {
                            if (!musicState.isVideoMode) googleMusicEngine.toggleVideoMode();
                          }}
                          className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                            musicState.isVideoMode
                              ? 'bg-sky-500 text-white font-bold shadow-xs'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                        >
                          <Film className="w-3.5 h-3.5" />
                          <span>Video Mode</span>
                        </button>
                        <button
                          onClick={() => {
                            if (musicState.isVideoMode) googleMusicEngine.toggleVideoMode();
                          }}
                          className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                            !musicState.isVideoMode
                              ? 'bg-sky-500 text-white font-bold shadow-xs'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                        >
                          <Disc3 className="w-3.5 h-3.5" />
                          <span>Song / Vinyl</span>
                        </button>
                      </div>
                    </div>

                    {/* PiP & Fullscreen Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleOpenPip}
                        aria-pressed={isPipActive || musicState.isPipActive}
                        className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-colors ${
                          isPipActive || musicState.isPipActive
                            ? 'bg-teal-500/20 border-teal-500/50 text-teal-400'
                            : 'hover:bg-black/5 dark:hover:bg-white/10'
                        }`}
                        style={
                          isPipActive || musicState.isPipActive
                            ? undefined
                            : { borderColor: 'var(--theme-border)' }
                        }
                        title={
                          isPipActive || musicState.isPipActive
                            ? 'Close Picture-in-Picture'
                            : 'Harmonized Picture-in-Picture Mini-Player'
                        }
                      >
                        <PictureInPicture2 className="w-3.5 h-3.5 text-sky-500" />
                        <span className="hidden sm:inline">
                          {isPipActive || musicState.isPipActive ? 'PiP Active' : 'PiP Window'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {musicState.playbackError && (
                    <div className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-500 text-xs flex items-center justify-between gap-3">
                      <span>{musicState.playbackError}</span>
                      <button onClick={() => googleMusicEngine.play()} className="font-bold underline shrink-0">
                        Retry
                      </button>
                    </div>
                  )}
                  {musicState.libraryStatus.loading && (
                    <div className="px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-500 text-[11px] font-semibold">
                      Indexing your archive… {musicState.libraryStatus.count} tracks found
                    </div>
                  )}

                  {/* Stage Display: Video Mode Screen (Image 3) OR Vinyl Visualizer */}
                  {musicState.isVideoMode ? (
                    <div ref={stageContainerRef} className="relative w-full aspect-video max-h-[380px] rounded-2xl overflow-hidden bg-black border shadow-2xl flex items-center justify-center group dt-stage-enter" style={{ borderColor: 'var(--theme-border)' }}>
                      {/* Real playback surface: the engine's shared media element is mounted here */}
                      <div
                        ref={stageHostRef}
                        className={`absolute inset-0 w-full h-full ${
                          videoFitMode === 'cover' ? '[&>video]:object-cover' : '[&>video]:object-contain'
                        }`}
                      />

                      {/* Real timecode overlay */}
                      <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-none">
                        <span className="px-2 py-0.5 rounded-md bg-black/60 text-white/90 font-mono text-xs">
                          {formatTime(musicState.currentTime)} / {formatTime(musicState.duration)}
                        </span>
                      </div>

                      {/* Floating Action Controls on Video */}
                      <div className="absolute top-4 right-4 flex items-center gap-2 opacity-85 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setVideoFitMode((m) => (m === 'contain' ? 'cover' : 'contain'))}
                          className="min-h-[44px] px-3 rounded-xl bg-black/60 hover:bg-black/90 text-white text-xs font-bold backdrop-blur-md transition-transform active:scale-95 border border-white/20"
                          title="Toggle Video Fit (Contain / Fill)"
                        >
                          {videoFitMode === 'contain' ? 'Fit' : 'Fill'}
                        </button>
                        <button
                          onClick={handleOpenPip}
                          className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition-transform active:scale-95 border border-white/20 flex items-center justify-center"
                          title="Open Picture-in-Picture Mini-Player"
                        >
                          <PictureInPicture2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const target = googleMusicEngine.getMediaElement() || stageContainerRef.current;
                            target?.requestFullscreen?.();
                          }}
                          className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition-transform active:scale-95 border border-white/20 flex items-center justify-center"
                          title="Fullscreen (F)"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Big Center Play Overlay (if paused) */}
                      {!musicState.isPlaying && (
                        <button
                          onClick={() => googleMusicEngine.play()}
                          className="absolute w-16 h-16 rounded-full bg-sky-500/90 text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-transform"
                        >
                          <Play className="w-7 h-7 fill-white ml-1" />
                        </button>
                      )}

                      {/* Captions Display */}
                      {showCaptions && currentTrack.lyrics && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-xl bg-black/80 text-white text-xs font-semibold backdrop-blur-md max-w-[80%] text-center border border-white/10 shadow-lg">
                          {currentTrack.lyrics[
                            Math.floor(
                              (musicState.currentTime / (currentTrack.durationSeconds || 180)) *
                                currentTrack.lyrics.length
                            ) % currentTrack.lyrics.length
                          ]}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Vinyl Mode Stage with Spinning Turntable & Canvas Visualizer */
                    <div className="w-full flex flex-col items-center justify-center py-4 gap-4">
                      <div className="relative group my-2">
                        <div
                          className={`w-44 h-44 sm:w-52 sm:h-52 rounded-full bg-slate-900 border-4 border-slate-800 shadow-2xl flex items-center justify-center relative overflow-hidden ${
                            musicState.isPlaying ? 'animate-spin' : ''
                          }`}
                          style={{ animationDuration: '6s' }}
                        >
                          <div className="absolute inset-2 rounded-full border border-white/5 pointer-events-none" />
                          <div className="absolute inset-6 rounded-full border border-white/5 pointer-events-none" />
                          <div className="absolute inset-10 rounded-full border border-white/5 pointer-events-none" />
                          <img
                            src={currentTrack.albumArtUrl}
                            alt={currentTrack.title}
                            className="w-22 h-22 sm:w-26 sm:h-26 rounded-full object-cover shadow-inner border-2 border-white/30"
                            crossOrigin="anonymous"
                          />
                          <div className="absolute w-4 h-4 rounded-full bg-slate-900 border-2 border-white/40" />
                        </div>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-sky-600 text-white text-[10px] font-bold shadow-md uppercase tracking-wider">
                          {currentTrack.format} • Studio Master
                        </div>
                      </div>

                      {/* 5-Mode Visualizer Switcher & Live FFT Canvas */}
                      <div className="w-full max-w-xl space-y-2">
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {VISUALIZER_MODES.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setVisualizerMode(m.id)}
                              className={`min-h-[44px] px-3 py-1 rounded-xl border text-[11px] font-bold transition-colors ${
                                visualizerMode === m.id
                                  ? 'bg-[#1074B1] text-white border-[#1074B1]'
                                  : 'hover:border-[#1074B1]/60 opacity-80'
                              }`}
                              style={visualizerMode === m.id ? undefined : { borderColor: 'var(--theme-border)' }}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                        <div
                          className="w-full h-24 rounded-2xl border p-2.5 flex items-center justify-center bg-black/5 dark:bg-black/30"
                          style={{ borderColor: 'var(--theme-border)' }}
                        >
                          <canvas
                            ref={canvasRef}
                            width={520}
                            height={84}
                            className="w-full h-full rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Parametric Equalizer Dropdown (if toggled) */}
                  {showEqualizer && (
                    <div
                      className="w-full p-3.5 rounded-2xl border bg-black/5 dark:bg-white/5 animate-in fade-in duration-150 space-y-3"
                      style={{ borderColor: 'var(--theme-border)' }}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                          <Sliders className="w-3.5 h-3.5" />
                          <span>3-Band Studio Equalizer (Web Audio API)</span>
                        </span>
                        <span className="text-[10px] opacity-60">Low • Mid • High</span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <div className="text-[10px] font-bold opacity-70">Bass (100Hz)</div>
                          <input
                            type="range"
                            min="-12"
                            max="12"
                            value={bass}
                            onChange={(e) => handleEqChange('bass', parseFloat(e.target.value))}
                            className="w-full accent-sky-500 mt-1"
                          />
                          <div className="text-[10px] font-mono">{bass > 0 ? `+${bass}` : bass} dB</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold opacity-70">Mid (1kHz)</div>
                          <input
                            type="range"
                            min="-12"
                            max="12"
                            value={mid}
                            onChange={(e) => handleEqChange('mid', parseFloat(e.target.value))}
                            className="w-full accent-emerald-500 mt-1"
                          />
                          <div className="text-[10px] font-mono">{mid > 0 ? `+${mid}` : mid} dB</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold opacity-70">Treble (4kHz)</div>
                          <input
                            type="range"
                            min="-12"
                            max="12"
                            value={treble}
                            onChange={(e) => handleEqChange('treble', parseFloat(e.target.value))}
                            className="w-full accent-amber-500 mt-1"
                          />
                          <div className="text-[10px] font-mono">{treble > 0 ? `+${treble}` : treble} dB</div>
                        </div>
                      </div>

                      <div className="pt-2 border-t flex items-center justify-between text-[11px]" style={{ borderColor: 'var(--theme-border)' }}>
                        <span className="font-bold opacity-70">Playback Speed</span>
                        <div className="flex items-center gap-1">
                          {[0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
                            <button
                              key={s}
                              onClick={() => handleSpeedChange(s)}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                playbackSpeed === s
                                  ? 'bg-sky-500 text-white border-sky-500'
                                  : 'border-transparent opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
                              }`}
                            >
                              {s}x
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

                  {/* Modular Three-Pillar View Switcher: Home / Explore / Library / Artist / Album */}
                  <div className="flex-1 flex flex-col min-h-0">
                    {musicState.activeView === 'home' && (
                      <MusicHomeView
                        musicState={musicState}
                        onPlayTrack={(id) => googleMusicEngine.playTrack(id)}
                        onStartRadio={(id) => googleMusicEngine.startRadio(id)}
                      />
                    )}

                    {musicState.activeView === 'explore' && (
                      <MusicExploreView
                        musicState={musicState}
                        onPlayTrack={(id) => googleMusicEngine.playTrack(id)}
                        onStartRadio={(id) => googleMusicEngine.startRadio(id)}
                      />
                    )}

                    {musicState.activeView === 'library' && (
                      <MusicLibraryView
                        musicState={musicState}
                        filteredPlaylists={filteredPlaylists}
                        filteredTracks={filteredTracks}
                        onPlayTrack={(id) => googleMusicEngine.playTrack(id)}
                        onSelectPlaylist={(plId) => {
                          googleMusicEngine.selectPlaylist(plId);
                          const pl = googleMusicEngine.getActivePlaylist();
                          if (pl?.tracks[0]) googleMusicEngine.playTrack(pl.tracks[0].id);
                        }}
                      />
                    )}

                    {musicState.activeView === 'artist' && (
                      <MusicArtistView
                        artistId={musicState.selectedArtistId || ''}
                        musicState={musicState}
                        onPlayTrack={(id) => googleMusicEngine.playTrack(id)}
                        onStartRadio={(id) => googleMusicEngine.startRadio(id)}
                        onBack={() => googleMusicEngine.setActiveView('library')}
                      />
                    )}

                    {musicState.activeView === 'album' && (
                      <MusicAlbumView
                        albumId={musicState.selectedAlbumId || ''}
                        musicState={musicState}
                        onPlayTrack={(id) => googleMusicEngine.playTrack(id)}
                        onPlayAlbum={(tracks, startIdx, shuffle) =>
                          googleMusicEngine.playAlbumTracks(tracks, startIdx, shuffle)
                        }
                        onStartRadio={(id) => googleMusicEngine.startRadio(id)}
                        onBack={() => googleMusicEngine.setActiveView('library')}
                      />
                    )}
                  </div>
                </div>

                {/* Right Column: 4 Tabs Panel (UP NEXT, LYRICS, DETAILS, RELATED) */}
                <MusicSidePanel
                  musicState={musicState}
                  filteredTracks={filteredTracks}
                  filteredPlaylists={filteredPlaylists}
                  activeSubAccount={activeSubAccount}
                  newNoteText={newNoteText}
                  setNewNoteText={setNewNoteText}
                  handleAddNote={handleAddNote}
                />
              </div>
            </div>

          {/* =========================================================================
              GOOGLE DRIVE & LOCAL ACCOUNTS DRAWER
             ========================================================================= */}
          {isAccountDrawerOpen && (
            <MusicAccountsDrawer
              subAccounts={subAccounts}
              activeAccountId={activeSubAccount.id}
              primaryUser={primaryUser}
              onSwitch={handleSwitchAccount}
              onClose={() => setIsAccountDrawerOpen(false)}
              onConnectOAuth={() => startDirectServerOAuth({ service: 'drive', prompt: 'select_account consent' })}
              onRefreshChannels={() => googleMusicEngine.discoverRemoteSubAccounts()}
              onSignOut={() => {
                googleMusicEngine.clearDriveLibrary();
                setIsAccountDrawerOpen(false);
              }}
            />
          )}
        </div>

        {/* =========================================================================
            PERSISTENT BOTTOM PLAYER BAR (Image 3 Parity)
           ========================================================================= */}
        <MusicTransportBar
          musicState={musicState}
          showCaptions={showCaptions}
          onToggleCaptions={() => setShowCaptions(!showCaptions)}
          onPip={handleOpenPip}
          onClose={onClose}
          isPipActive={Boolean(isPipActive || musicState.isPipActive)}
        />
      </div>

      {/* =========================================================================
          CONNECT / ADD SUB-ACCOUNT MODAL (Zero Hardcoding)
         ========================================================================= */}
      {showAddAccountModal && (
        <div
          className="fixed inset-0 z-70 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowAddAccountModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl animate-in zoom-in-95 space-y-4"
            style={{
              backgroundColor: 'var(--theme-surface)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--theme-border)' }}>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm">Add Media Profile</h4>
              </div>
              <button
                onClick={() => setShowAddAccountModal(false)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubAccount} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1 opacity-80">Profile Name</label>
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="e.g. Studio Master"
                  className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:border-sky-500"
                  style={{
                    backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.2))',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                  required
                />
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-80">Handle</label>
                <input
                  type="text"
                  value={newAccountHandle}
                  onChange={(e) => setNewAccountHandle(e.target.value)}
                  placeholder="e.g. @studio"
                  className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:border-sky-500"
                  style={{
                    backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.2))',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                />
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-80">Account Email / Identifier</label>
                <input
                  type="email"
                  value={newAccountEmail}
                  onChange={(e) => setNewAccountEmail(e.target.value)}
                  placeholder="e.g. user@example.com"
                  className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:border-sky-500"
                  style={{
                    backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.2))',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                  required
                />
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-80">Storage Label</label>
                <input
                  type="text"
                  value={newAccountRole}
                  onChange={(e) => setNewAccountRole(e.target.value)}
                  placeholder="e.g. Google Drive Archive"
                  className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:border-sky-500"
                  style={{
                    backgroundColor: 'var(--theme-surface-deep, rgba(0,0,0,0.2))',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="px-3 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-xs transition-colors"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
