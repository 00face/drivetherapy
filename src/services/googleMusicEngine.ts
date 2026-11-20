/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drive Therapy Audio & Video Media Studio Engine
 * Unified engine powered strictly by Google Drive media & local OS filesystem archives:
 * - Multi-Account Google Drive OAuth profiles & local disk sessions
 * - Dual/Unified Workspace Source Filter: All Media | Google Drive | Local Files
 * - Dynamic Filter Categories (Playlists, Songs, Albums, Artists, Profiles, Podcasts) & Sorting
 * - Video & Lossless Audio playback with SMPTE timecode, PiP integration, LRC Lyrics & Autoplay
 * - Web Audio API 3-Band EQ DSP Pipeline for Drive HTTP 206 streams and local files
 */

import { universalMediaPlayer } from './universalMediaPlayerEngine';
import { loadAccountProfiles } from './multiAccountAuth';
import { loadAssets, loadFolders, getMeta, setMeta, deleteMeta } from './catalogDb';
import { loadOAuthToken } from './oauthStorage';
import { DiscoveredGoogleChannel, updateDriveFileStar } from './googleDrive';
import { MusicPlaybackController, resolveTrackUrl } from './music/musicPlayback';
import {
  fetchDriveMusicLibrary,
  fetchLocalDiskMusicLibrary,
  mergeTracks,
  buildAllCategoryPlaylists,
  enrichDriveTracksWithAudioTags,
} from './music/musicLibrary';
import {
  SUB_ACCOUNTS_STORAGE_KEY,
  persistSubAccounts as persistSubAccountsStore,
  syncAccountsWithMultiAuth,
  mergeDiscoveredChannels,
  activateProfileTokenForSubAccount,
  discoverRemoteSubAccounts as discoverRemoteAccountsService,
  sanitizeSubAccountList,
  createInitialGuestAccounts,
} from './music/musicAccounts';
import {
  TrackRatingValue,
  PlayHistoryEntry,
  getUserPlaylists,
  createUserPlaylist,
  renameUserPlaylist,
  deleteUserPlaylist,
  addTrackToUserPlaylist,
  removeTrackFromUserPlaylist,
  insertNextInQueue,
  appendToQueue,
  removeFromQueueAt,
  moveInQueue,
  buildTrackRadioQueue,
  getPlayHistory as loadPlayHistory,
  recordTrackPlay,
  clearPlayHistory as clearPlayHistoryStore,
  getTrackRatings,
  setTrackRating,
} from './music/musicQueueAndPlaylists';
import { ParsedLyricLine, parseLrc, getSavedTrackLyrics, saveTrackLyrics } from './music/musicLyrics';
import { generateRadioStation, getNextAutoplayRecommendations } from './music/musicRadio';
import { MediaAsset } from '../types';

export type GoogleMusicViewMode = 'home' | 'explore' | 'library' | 'artist' | 'album' | 'nowplaying';

export type MusicFilterCategory =
  | 'all'
  | 'playlists'
  | 'songs'
  | 'albums'
  | 'artists'
  | 'profiles'
  | 'podcasts';

export type MusicSortOption = 'recent' | 'added' | 'played' | 'alpha';

export interface TrackNoteItem {
  id: string;
  author: string;
  avatarUrl?: string;
  timeAgo: string;
  text: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  albumArtist?: string;
  album: string;
  albumUid?: string;
  uidSource?: 'musicbrainz' | 'ufid' | 'discogs' | 'tag-composite' | 'folder';
  trackUid?: string;
  trackNumber?: number;
  discNumber?: number;
  durationSeconds: number;
  albumArtUrl: string;
  genre: string;
  format: 'flac' | 'ogg' | 'mp3' | 'wav' | 'mp4' | 'webm' | 'm4a' | 'aac' | 'mov' | 'mkv';
  driveFileId?: string;
  mimeType?: string;
  bpm?: number;
  year?: number;
  modifiedAt?: number;
  ownerName?: string;
  ownerAvatarUrl?: string;
  isSynthesized?: boolean;
  isVideo?: boolean;
  videoUrl?: string;
  lyrics?: string[];
  notes?: TrackNoteItem[];
  source?: 'cloud' | 'local';
  localPath?: string;
  subCategory?: MusicFilterCategory;
  isLiked?: boolean;
  rating?: TrackRatingValue;
}

export interface MusicPlaylist {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  tracks: MusicTrack[];
  category?: MusicFilterCategory;
  itemType?: 'playlist' | 'album' | 'artist' | 'profile' | 'podcast';
  author?: string;
  trackCount?: number;
  roleLabel?: string;
  isPinned?: boolean;
  year?: number;
}

export interface GoogleMusicSubAccount {
  id: string;
  name: string;
  email: string;
  handle: string;
  roleLabel?: string;
  avatarUrl?: string;
  accountType: 'primary' | 'workspace_sub' | 'local';
  primaryUser?: {
    name: string;
    email: string;
  };
}

export interface GoogleMusicState {
  currentTrack: MusicTrack;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  activePlaylistId: string;
  queue: MusicTrack[];
  activeSubAccount: GoogleMusicSubAccount;
  subAccounts: GoogleMusicSubAccount[];
  activeView: GoogleMusicViewMode;
  selectedArtistId: string | null;
  selectedAlbumId: string | null;
  activeMediaSource: 'all' | 'cloud' | 'local';
  activeCategory: MusicFilterCategory;
  activeSort: MusicSortOption;
  autoplay: boolean;
  activeTab: 'up_next' | 'lyrics' | 'details' | 'related';
  isVideoMode: boolean;
  isPipActive: boolean;
  playbackError: string | null;
  libraryStatus: { loading: boolean; count: number };
  playHistory: PlayHistoryEntry[];
  parsedLyrics: ParsedLyricLine[];
}

export type GoogleMusicListener = (state: GoogleMusicState) => void;

const LIBRARY_CACHE_META_KEY = 'music_library_cache_v1';

export class GoogleMusicEngine {
  private playlists: MusicPlaylist[] = [];
  private subAccounts: GoogleMusicSubAccount[] = [];
  private activeSubAccountId = 'acc_studio_primary';
  private accountPlaylistsMap: Map<string, MusicPlaylist[]> = new Map();
  private accountTracksMap: Map<string, MusicTrack[]> = new Map();
  private accountDriveTracksMap: Map<string, MusicTrack[]> = new Map();
  private accountLibraryFetchAtMap: Map<string, number> = new Map();
  private libraryPromiseMap: Map<string, Promise<void>> = new Map();
  private localScanPromise: Promise<void> | null = null;
  private lastLocalScanAt = 0;
  private customQueue: MusicTrack[] | null = null;

  private currentTrackIndex = 0;
  private isPlaying = false;
  private currentTime = 0;
  private duration = 0;
  private volume = 0.85;
  private isShuffle = false;
  private repeatMode: 'off' | 'all' | 'one' = 'all';
  private activePlaylistId = 'pl_drive_all';

  private activeView: GoogleMusicViewMode = 'home';
  private selectedArtistId: string | null = null;
  private selectedAlbumId: string | null = null;

  private activeMediaSource: 'all' | 'cloud' | 'local' = 'all';
  private activeCategory: MusicFilterCategory = 'all';
  private activeSort: MusicSortOption = 'recent';
  private autoplay = true;
  private activeTab: 'up_next' | 'lyrics' | 'details' | 'related' = 'up_next';
  private isVideoMode = false;
  private isPipActive = false;

  private localTracks: MusicTrack[] = [];
  private listeners: Set<GoogleMusicListener> = new Set();
  private synthInterval: any = null;
  private synthCtx: AudioContext | null = null;
  private synthGain: GainNode | null = null;

  private playbackError: string | null = null;
  private libraryStatus = { loading: false, count: 0 };
  private playback = new MusicPlaybackController({
    onTime: (t, d) => {
      this.currentTime = t;
      if (d > 0 && Number.isFinite(d)) this.duration = d;
      if (d > 0 && d - t <= 5) {
        this.preloadNextTrack();
      }
      this.emitState();
    },
    onEnded: () => this.handleTrackEnded(),
    onError: (msg) => {
      this.playbackError = msg;
      this.isPlaying = false;
      this.emitState();
    },
    onPlayState: (playing) => {
      if (this.isPlaying !== playing && this.playback.hasSource()) {
        this.isPlaying = playing;
        this.emitState();
      }
    },
  });

  private preloadNextTrack(): void {
    const queue = this.getCurrentQueueTracks();
    if (this.currentTrackIndex + 1 < queue.length) {
      this.playback.preloadNextTrack(queue[this.currentTrackIndex + 1]);
    }
  }

  constructor() {
    this.initCatalog();
    this.initDynamicSubAccounts();
    this.syncUserAccountMedia(true).catch(() => {});
  }

  private initCatalog(): void {
    this.playlists = [
      {
        id: 'pl_drive_all',
        title: 'Drive & Local Library',
        description: 'All audio and video files discovered across Google Drive and Local Folders.',
        coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80',
        tracks: [],
        category: 'playlists',
        itemType: 'playlist',
        author: 'Media Studio',
        isPinned: true,
        trackCount: 0,
      },
      {
        id: 'pl_liked_music',
        title: 'Liked Music',
        description: 'Starred and thumbed-up tracks from Google Drive and Local Files.',
        coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80',
        tracks: [],
        category: 'playlists',
        itemType: 'playlist',
        author: 'Auto Playlist',
        isPinned: true,
        trackCount: 0,
      },
    ];
  }

  /**
   * Initializes dynamic Google Drive & local studio profiles with zero hardcoded mock channels.
   */
  private initDynamicSubAccounts(): void {
    let saved: GoogleMusicSubAccount[] = [];

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(SUB_ACCOUNTS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          saved = sanitizeSubAccountList(parsed).filter(
            (s) => !s.id.startsWith('yt_') && s.id !== 'acc_brand_lofi' && s.id !== 'acc_commercial_score'
          );
        }
      } catch (err) {
        console.warn('Failed to parse saved sub-accounts:', err);
      }
    }

    if (saved.length === 0) {
      saved = createInitialGuestAccounts();
    }

    // Synchronize dynamically with registered multiAccountAuth Google profiles
    try {
      const googleProfiles = loadAccountProfiles();
      if (googleProfiles.length > 0) {
        const synced = syncAccountsWithMultiAuth(saved, googleProfiles);
        this.subAccounts = synced.accounts;
        const savedActiveId = typeof localStorage !== 'undefined' ? localStorage.getItem('dt_google_music_active_sub_account_v1') : null;
        if (savedActiveId && this.subAccounts.some((s) => s.id === savedActiveId)) {
          this.activeSubAccountId = savedActiveId;
        } else {
          this.activeSubAccountId = synced.activeAccountId;
        }
        persistSubAccountsStore(this.subAccounts);
        return;
      }
    } catch {}

    this.subAccounts = saved;
    const savedActiveId = typeof localStorage !== 'undefined' ? localStorage.getItem('dt_google_music_active_sub_account_v1') : null;
    if (savedActiveId && this.subAccounts.some((s) => s.id === savedActiveId)) {
      this.activeSubAccountId = savedActiveId;
    } else {
      this.activeSubAccountId = saved[0]?.id || 'acc_studio_primary';
    }
    this.persistSubAccounts();
  }

  private persistSubAccounts(): void {
    persistSubAccountsStore(this.subAccounts);
  }

  // --- Sub-Media Account Management (Zero Hardcoding) ---

  /**
   * Dynamically propagate the authenticated Google User Profile & discovered Brand Channels into GoogleMusicEngine.
   * Strips legacy mock channels once a real Google session is active.
   */
  public syncGoogleUserProfile(profile: {
    name?: string;
    email: string;
    avatarUrl?: string;
    channels?: DiscoveredGoogleChannel[];
  }): void {
    if (!profile.email) return;
    const cleanName = profile.name?.trim() || profile.email.split('@')[0];

    if (profile.channels && profile.channels.length > 0) {
      this.subAccounts = mergeDiscoveredChannels(
        this.subAccounts,
        profile.email,
        cleanName,
        profile.avatarUrl,
        profile.channels
      );
      if (!this.subAccounts.some((s) => s.id === this.activeSubAccountId)) {
        this.activeSubAccountId = this.subAccounts[0]?.id || 'acc_studio_primary';
      }
    } else {
      const profiles = loadAccountProfiles();
      if (profiles.length > 0) {
        const synced = syncAccountsWithMultiAuth(this.subAccounts, profiles);
        this.subAccounts = synced.accounts;
        const savedActiveId = typeof localStorage !== 'undefined' ? localStorage.getItem('dt_google_music_active_sub_account_v1') : null;
        if (savedActiveId && this.subAccounts.some((s) => s.id === savedActiveId)) {
          this.activeSubAccountId = savedActiveId;
        } else {
          const matched = this.subAccounts.find((s) => s.email.toLowerCase() === profile.email.toLowerCase());
          if (matched) this.activeSubAccountId = matched.id;
        }
      } else {
        this.subAccounts = mergeDiscoveredChannels(
          this.subAccounts,
          profile.email,
          cleanName,
          profile.avatarUrl,
          []
        );
        const savedActiveId = typeof localStorage !== 'undefined' ? localStorage.getItem('dt_google_music_active_sub_account_v1') : null;
        if (savedActiveId && this.subAccounts.some((s) => s.id === savedActiveId)) {
          this.activeSubAccountId = savedActiveId;
        } else {
          this.activeSubAccountId = 'acc_studio_primary';
        }
      }
    }

    this.persistSubAccounts();
    this.emitState();
  }

  /**
   * Query server `/api/auth/google/accounts` to resolve authenticated Google Drive profile metadata.
   */
  public async discoverRemoteSubAccounts(): Promise<GoogleMusicSubAccount[]> {
    const { accounts } = await discoverRemoteAccountsService(this.subAccounts);
    this.subAccounts = accounts;
    this.emitState();
    await this.syncUserAccountMedia();
    return this.getSubAccounts();
  }

  public getSubAccounts(): GoogleMusicSubAccount[] {
    return [...this.subAccounts];
  }

  public getActiveSubAccount(): GoogleMusicSubAccount {
    const found = this.subAccounts.find((s) => s && s.id === this.activeSubAccountId);
    if (found) return found;
    const first = this.subAccounts.find((s) => s && typeof s.id === 'string');
    if (first) return first;
    return createInitialGuestAccounts()[0];
  }

  public switchSubAccount(subAccountId: string): GoogleMusicSubAccount {
    if (!subAccountId || typeof subAccountId !== 'string') {
      return this.getActiveSubAccount();
    }
    let target = this.subAccounts.find((s) => s && s.id === subAccountId);
    if (!target) {
      target = this.getActiveSubAccount();
    }

    this.activeSubAccountId = target.id;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('dt_google_music_active_sub_account_v1', target.id);
      }
    } catch {}
    this.customQueue = null;
    const firstPl = this.getPlaylists()[0];
    if (firstPl) this.activePlaylistId = firstPl.id;

    // Activate matching multiAccountAuth OAuth credentials if this sub-account has an independent token
    activateProfileTokenForSubAccount(target.id);

    this.currentTrackIndex = 0;
    this.currentTime = 0;
    this.duration = this.getCurrentTrack()?.durationSeconds || 0;

    this.syncUserAccountMedia(true).catch(() => {});

    if (this.isPlaying) {
      this.startCurrentTrack();
    }

    this.emitState();
    return target;
  }

  public addSubAccount(params: {
    name: string;
    email: string;
    handle?: string;
    roleLabel?: string;
    accountType?: GoogleMusicSubAccount['accountType'];
    avatarUrl?: string;
  }): GoogleMusicSubAccount {
    const id = `acc_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const username = params.email ? params.email.split('@')[0] : 'drive';

    const newAccount: GoogleMusicSubAccount = {
      id,
      name: params.name.trim(),
      email: params.email.trim(),
      handle: params.handle?.trim() || `@${username}`,
      roleLabel: params.roleLabel?.trim() || 'Drive Profile',
      accountType: params.accountType || 'workspace_sub',
      avatarUrl:
        params.avatarUrl ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      primaryUser: this.getActiveSubAccount()?.primaryUser,
    };

    this.subAccounts.push(newAccount);
    this.activeSubAccountId = id;
    this.persistSubAccounts();
    this.emitState();
    return newAccount;
  }

  public removeSubAccount(subAccountId: string): void {
    if (this.subAccounts.length <= 1) return;
    this.subAccounts = this.subAccounts.filter((s) => s.id !== subAccountId);
    if (this.activeSubAccountId === subAccountId) {
      this.activeSubAccountId = this.subAccounts[0]?.id || '';
    }
    this.persistSubAccounts();
    this.emitState();
  }

  // --- Dynamic Account Media Sync (Google Drive & Local Files) ---

  /** Page through the user's Google Drive archive (audio+video) and scan OS local media folders. */
  public refreshDriveLibrary(force = false): Promise<void> {
    const accId = this.activeSubAccountId;
    const existingPromise = this.libraryPromiseMap.get(accId);
    if (existingPromise && !force) return existingPromise;
    const lastAt = this.accountLibraryFetchAtMap.get(accId) || 0;
    const fresh = Date.now() - lastAt < 10 * 60 * 1000;
    const currentCached = this.accountDriveTracksMap.get(accId) || [];
    if (fresh && !force) return Promise.resolve();

    this.libraryStatus = { loading: true, count: currentCached.length + this.localTracks.length };
    this.emitState();

    const cacheKey = `${LIBRARY_CACHE_META_KEY}_${accId}`;

    const task = (async () => {
      let loaded = 0;
      try {
        const email = loadOAuthToken()?.userEmail || this.getActiveSubAccount()?.email;
        if (currentCached.length === 0 && email) {
          try {
            const cached = (await getMeta(cacheKey)) || (await getMeta(LIBRARY_CACHE_META_KEY));
            if (cached && cached.email === email && Array.isArray(cached.tracks) && cached.tracks.length > 0) {
              this.accountDriveTracksMap.set(accId, cached.tracks);
              await this.syncUserAccountMedia(false);
            }
          } catch {
            /* cache is optional */
          }
        }

        const folderNames = new Map<string, string>();
        try {
          for (const f of await loadFolders()) folderNames.set(f.id.replace(/^drive_/, ''), f.name);
        } catch {
          /* folder names are optional */
        }
        const [driveTracks] = await Promise.all([
          fetchDriveMusicLibrary({
            folderNames: folderNames.size > 0 ? folderNames : undefined,
            resolveFolderNames: folderNames.size === 0,
            onProgress: (p) => {
              this.libraryStatus = { loading: !p.done, count: p.loaded + this.localTracks.length };
              this.emitState();
            },
          }),
          this.scanLocalDriveMedia(false),
        ]);
        const osLocalTracks = this.localTracks;

        if (osLocalTracks.length > 0) {
          this.localTracks = mergeTracks(osLocalTracks, this.localTracks);
        }

        loaded = driveTracks.length + osLocalTracks.length;
        if (driveTracks.length > 0) {
          this.accountDriveTracksMap.set(accId, driveTracks);
          const now = Date.now();
          this.accountLibraryFetchAtMap.set(accId, now);
          setMeta(cacheKey, {
            email,
            tracks: driveTracks,
            fetchedAt: now,
          }).catch(() => {});

          // Progressive background ID3v2/FLAC/MP4 tag + Album UID enrichment
          void enrichDriveTracksWithAudioTags(driveTracks, {
            concurrency: 6,
            maxTracks: 120,
            onBatchEnriched: (enriched) => {
              this.accountDriveTracksMap.set(accId, enriched);
              void this.syncUserAccountMedia(false);
            },
          });
        }
      } finally {
        const latest = this.accountDriveTracksMap.get(accId) || [];
        this.libraryStatus = { loading: false, count: latest.length + this.localTracks.length };
        this.libraryPromiseMap.delete(accId);
      }
      if (loaded > 0 || this.localTracks.length > 0) {
        await this.syncUserAccountMedia(false);
      } else {
        this.emitState();
      }
    })();

    this.libraryPromiseMap.set(accId, task);
    return task;
  }

  /** Trigger on-demand ID3v2 / FLAC / MP4 tag & Album UID enrichment for active account Drive tracks. */
  public async enrichActiveAccountTags(): Promise<number> {
    const accId = this.activeSubAccountId;
    const current = this.accountDriveTracksMap.get(accId) || [];
    if (current.length === 0) return 0;
    const enriched = await enrichDriveTracksWithAudioTags(current, {
      concurrency: 6,
      maxTracks: 200,
    });
    this.accountDriveTracksMap.set(accId, enriched);
    await this.syncUserAccountMedia(false);
    return enriched.length;
  }

  /** Forget the signed-in user's Drive archive (call on sign out). */
  public clearDriveLibrary(): void {
    const cacheKey = `${LIBRARY_CACHE_META_KEY}_${this.activeSubAccountId}`;
    this.accountDriveTracksMap.clear();
    this.accountLibraryFetchAtMap.clear();
    this.libraryPromiseMap.clear();
    this.customQueue = null;
    this.libraryStatus = { loading: false, count: this.localTracks.length };
    deleteMeta(LIBRARY_CACHE_META_KEY).catch(() => {});
    deleteMeta(cacheKey).catch(() => {});
    this.accountPlaylistsMap.clear();
    this.accountTracksMap.clear();
    this.playback.stop();
    this.isPlaying = false;
    this.syncUserAccountMedia(false).catch(() => {});
    this.emitState();
  }

  public async syncUserAccountMedia(force: boolean = false): Promise<void> {
    if (force) {
      this.refreshDriveLibrary(true).catch(() => {});
    } else {
      this.refreshDriveLibrary(false).catch(() => {});
    }
    try {
      const catalogAssets = await loadAssets();
      const mediaAssets = catalogAssets.filter(
        (a) => a.category === 'audio' || a.category === 'video'
      );
      const cachedDriveTracks = this.accountDriveTracksMap.get(this.activeSubAccountId) || [];
      const ratings = getTrackRatings(this.activeSubAccountId);

      const catalogTracks: MusicTrack[] = mediaAssets.map((a) => {
        const ext = (a.extension || 'mp3').toLowerCase();
        const format =
          ext === 'flac' ? 'flac' :
          ext === 'ogg' ? 'ogg' :
          ext === 'wav' ? 'wav' :
          ext === 'mp4' ? 'mp4' :
          ext === 'webm' ? 'webm' : 'mp3';

        let title = a.name.replace(/\.[^/.]+$/, '');
        let artist = 'Unknown Artist';
        if (title.includes(' - ')) {
          const parts = title.split(' - ');
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        }

        const pathParts = (a.path || '').split('/').filter(Boolean);
        const albumName = pathParts.length > 1
          ? pathParts[pathParts.length - 2]
          : (a.source === 'local' ? 'Local Files' : 'Google Drive');

        return {
          id: a.id,
          driveFileId: a.source === 'local' ? undefined : a.id.replace(/^drive_/, ''),
          mimeType: a.mimeType,
          title,
          artist,
          album: albumName,
          durationSeconds: 0,
          albumArtUrl: a.thumbnailUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80',
          genre: a.category === 'video' ? 'Video Stream' : (a.source === 'local' ? 'Local Audio' : 'Drive Audio'),
          format,
          isVideo: a.category === 'video',
          source: a.source === 'local' ? 'local' : 'cloud',
          localPath: a.source === 'local' ? a.path : undefined,
          videoUrl: a.category === 'video' ? a.cloudUrl || a.path : undefined,
          subCategory: 'songs',
          modifiedAt: a.modifiedTime ? Date.parse(a.modifiedTime) : undefined,
        };
      });

      const mergedAll: MusicTrack[] = mergeTracks(cachedDriveTracks, catalogTracks, this.localTracks).map((t) => {
        const r = ratings[t.id];
        return r ? { ...t, rating: r, isLiked: r === 'up' } : t;
      });

      const sourceFiltered =
        this.activeMediaSource === 'cloud'
          ? mergedAll.filter((t) => t.source !== 'local')
          : this.activeMediaSource === 'local'
            ? mergedAll.filter((t) => t.source === 'local')
            : mergedAll;

      if (sourceFiltered.length > 0 || mergedAll.length > 0) {
        const userPlaylists = getUserPlaylists(this.activeSubAccountId);
        const activeAccountPlaylists = buildAllCategoryPlaylists({
          tracks: sourceFiltered,
          userPlaylists,
          accountName: this.getActiveSubAccount()?.name || 'Google Drive User',
          subAccountProfiles: this.subAccounts.map((s) => ({
            id: s.id,
            name: s.name,
            handle: s.handle,
            avatarUrl: s.avatarUrl,
            roleLabel: s.roleLabel,
          })),
        });

        this.accountPlaylistsMap.set(this.activeSubAccountId, activeAccountPlaylists);
        this.accountTracksMap.set(this.activeSubAccountId, sourceFiltered);
      } else {
        const userPlaylists = getUserPlaylists(this.activeSubAccountId);
        this.accountPlaylistsMap.set(this.activeSubAccountId, [...userPlaylists, ...this.playlists]);
        this.accountTracksMap.set(this.activeSubAccountId, []);
      }
      this.emitState();
    } catch (err) {
      console.warn('[GoogleMusicEngine] Note during account media scan:', err);
    }
  }

  // --- Catalog, Filters & Sorting ---

  public getPlaylists(): MusicPlaylist[] {
    return this.accountPlaylistsMap.get(this.activeSubAccountId) || this.playlists;
  }

  private getCurrentQueueTracks(): MusicTrack[] {
    if (this.customQueue && this.customQueue.length > 0) {
      return this.customQueue;
    }
    return this.getActivePlaylist().tracks;
  }

  public getActivePlaylist(): MusicPlaylist {
    const currentPlaylists = this.getPlaylists();
    return currentPlaylists.find((p) => p.id === this.activePlaylistId) || currentPlaylists[0] || this.playlists[0];
  }

  public getCurrentTrack(): MusicTrack {
    const tracks = this.getCurrentQueueTracks();
    return (
      tracks[this.currentTrackIndex] ||
      tracks[0] ||
      this.playlists[0]?.tracks[0] || {
        id: 'studio_standby',
        title: 'No Media Selected',
        artist: 'Google Drive & Local Files',
        album: 'Media Library',
        durationSeconds: 0,
        albumArtUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80',
        genre: 'Ready',
        format: 'mp3',
        source: 'local',
      }
    );
  }

  public setFilterCategory(cat: MusicFilterCategory): void {
    this.activeCategory = cat;
    if (cat === 'all') {
      if (this.activeView === 'library') {
        this.activeView = 'home';
      }
    } else {
      this.activeView = 'library';
    }
    this.emitState();
  }

  public setSortOption(sort: MusicSortOption): void {
    this.activeSort = sort;
    this.emitState();
  }

  public setAutoplay(val: boolean): void {
    this.autoplay = val;
    this.emitState();
  }

  public setActiveTab(tab: 'up_next' | 'lyrics' | 'details' | 'related'): void {
    this.activeTab = tab;
    this.emitState();
  }

  public setActiveView(view: GoogleMusicViewMode): void {
    this.activeView = view;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('dt_google_music_last_view_v1', view);
      }
    } catch {}
    this.emitState();
  }

  public navigateToArtist(artistId: string): void {
    this.selectedArtistId = artistId;
    this.activeView = 'artist';
    this.emitState();
  }

  public navigateToAlbum(albumId: string): void {
    this.selectedAlbumId = albumId;
    this.activeView = 'album';
    this.emitState();
  }

  public toggleVideoMode(): void {
    this.isVideoMode = !this.isVideoMode;
    this.emitState();
  }

  public setPipActive(active: boolean): void {
    this.isPipActive = active;
    this.emitState();
  }

  // --- Full-Capability Google Music API: Ratings, Playlist CRUD, Queue, Radio, History & LRC ---

  public getTrackRating(trackId: string): TrackRatingValue {
    const map = getTrackRatings(this.activeSubAccountId);
    if (map[trackId]) return map[trackId];
    const t = this.getAllTracksFlat().find((x) => x.id === trackId);
    return t?.isLiked ? 'up' : 'none';
  }

  public rateTrack(trackId: string, rating: TrackRatingValue): void {
    setTrackRating(this.activeSubAccountId, trackId, rating);
    const liked = rating === 'up';
    for (const pl of this.getPlaylists()) {
      for (const t of pl.tracks) {
        if (t.id === trackId) {
          t.isLiked = liked;
          t.rating = rating;
        }
      }
    }
    if (this.customQueue) {
      for (const t of this.customQueue) {
        if (t.id === trackId) {
          t.isLiked = liked;
          t.rating = rating;
        }
      }
    }
    // Sync star state back to Google Drive when backed by a cloud file
    const driveId = trackId.startsWith('drive_') ? trackId.replace(/^drive_/, '') : '';
    if (driveId && rating !== 'none') {
      updateDriveFileStar(driveId, liked).catch(() => {});
    }
    this.syncUserAccountMedia(true).catch(() => {});
    this.emitState();
  }

  public toggleLikeCurrentTrack(): void {
    const track = this.getCurrentTrack();
    if (!track) return;
    const nextRating: TrackRatingValue = track.isLiked ? 'none' : 'up';
    this.rateTrack(track.id, nextRating);
  }

  public createPlaylist(title: string, description?: string, initialTracks?: MusicTrack[]): MusicPlaylist {
    const pl = createUserPlaylist(this.activeSubAccountId, {
      title,
      description,
      tracks: initialTracks,
      author: this.getActiveSubAccount()?.name,
    });
    const list = this.getPlaylists();
    this.accountPlaylistsMap.set(this.activeSubAccountId, [pl, ...list.filter((p) => p.id !== pl.id)]);
    this.emitState();
    return pl;
  }

  public renamePlaylist(playlistId: string, title: string, description?: string): MusicPlaylist | null {
    const updated = renameUserPlaylist(this.activeSubAccountId, playlistId, title, description);
    if (!updated) return null;
    const list = this.getPlaylists().map((p) => (p.id === playlistId ? updated : p));
    this.accountPlaylistsMap.set(this.activeSubAccountId, list);
    this.emitState();
    return updated;
  }

  public deletePlaylist(playlistId: string): boolean {
    const ok = deleteUserPlaylist(this.activeSubAccountId, playlistId);
    if (!ok) return false;
    const list = this.getPlaylists().filter((p) => p.id !== playlistId);
    this.accountPlaylistsMap.set(this.activeSubAccountId, list);
    if (this.activePlaylistId === playlistId && list[0]) {
      this.activePlaylistId = list[0].id;
    }
    this.emitState();
    return true;
  }

  public addTrackToPlaylist(playlistId: string, track: MusicTrack): MusicPlaylist | null {
    const updated = addTrackToUserPlaylist(this.activeSubAccountId, playlistId, track);
    if (!updated) return null;
    const list = this.getPlaylists().map((p) => (p.id === playlistId ? updated : p));
    this.accountPlaylistsMap.set(this.activeSubAccountId, list);
    this.emitState();
    return updated;
  }

  public removeTrackFromPlaylist(playlistId: string, trackId: string): MusicPlaylist | null {
    const updated = removeTrackFromUserPlaylist(this.activeSubAccountId, playlistId, trackId);
    if (!updated) return null;
    const list = this.getPlaylists().map((p) => (p.id === playlistId ? updated : p));
    this.accountPlaylistsMap.set(this.activeSubAccountId, list);
    this.emitState();
    return updated;
  }

  public saveQueueAsPlaylist(title: string): MusicPlaylist {
    return this.createPlaylist(title, 'Saved from active playback queue', this.getCurrentQueueTracks());
  }

  public playNext(track: MusicTrack): void {
    const res = insertNextInQueue(this.getCurrentQueueTracks(), this.currentTrackIndex, track);
    this.customQueue = res.queue;
    this.currentTrackIndex = res.currentIndex;
    this.emitState();
  }

  public addToQueue(track: MusicTrack): void {
    this.customQueue = appendToQueue(this.getCurrentQueueTracks(), track);
    this.emitState();
  }

  public removeFromQueue(index: number): void {
    const res = removeFromQueueAt(this.getCurrentQueueTracks(), this.currentTrackIndex, index);
    this.customQueue = res.queue;
    this.currentTrackIndex = res.currentIndex;
    this.emitState();
  }

  public reorderQueue(fromIdx: number, toIdx: number): void {
    const res = moveInQueue(this.getCurrentQueueTracks(), this.currentTrackIndex, fromIdx, toIdx);
    this.customQueue = res.queue;
    this.currentTrackIndex = res.currentIndex;
    this.emitState();
  }

  public clearQueue(): void {
    const cur = this.getCurrentTrack();
    this.customQueue = cur ? [cur] : [];
    this.currentTrackIndex = 0;
    this.emitState();
  }

  public startRadio(seedTrackId?: string): MusicTrack[] {
    const all = this.getAllTracksFlat();
    const seed = (seedTrackId ? all.find((t) => t.id === seedTrackId) : null) || this.getCurrentTrack();
    if (!seed) return [];
    const station = generateRadioStation(seed, all, 25);
    this.customQueue = station.tracks;
    this.currentTrackIndex = 0;
    this.currentTime = 0;
    this.duration = seed.durationSeconds || this.duration;
    this.isPlaying = true;
    this.isVideoMode = Boolean(seed.isVideo);
    this.startCurrentTrack();
    return station.tracks;
  }

  public getPlayHistory(): PlayHistoryEntry[] {
    return loadPlayHistory(this.activeSubAccountId);
  }

  public clearPlayHistory(): void {
    clearPlayHistoryStore(this.activeSubAccountId);
    this.emitState();
  }

  public setTrackLyrics(trackId: string, linesOrLrc: string[] | string): void {
    const lines = Array.isArray(linesOrLrc) ? linesOrLrc : linesOrLrc.split(/\r?\n/).filter(Boolean);
    saveTrackLyrics(trackId, lines);
    for (const pl of this.getPlaylists()) {
      for (const t of pl.tracks) {
        if (t.id === trackId) t.lyrics = lines;
      }
    }
    this.emitState();
  }

  public getParsedLyrics(track?: MusicTrack): ParsedLyricLine[] {
    const target = track || this.getCurrentTrack();
    if (!target) return [];
    const saved = getSavedTrackLyrics(target.id);
    const lines = saved || target.lyrics || [];
    return lines.length > 0 ? parseLrc(lines.join('\n')) : [];
  }

  private getAllTracksFlat(): MusicTrack[] {
    const all = [
      ...(this.accountTracksMap.get(this.activeSubAccountId) || []),
      ...this.getPlaylists().flatMap((p) => p.tracks),
      ...this.localTracks,
    ];
    return mergeTracks(all);
  }

  public getFilteredPlaylists(): MusicPlaylist[] {
    const currentPlaylists = this.getPlaylists();
    let result = [...currentPlaylists];

    if (this.activeCategory !== 'all') {
      result = result.filter(
        (p) => p.category === this.activeCategory || (p.itemType ? `${p.itemType}s` : '') === this.activeCategory
      );
    }

    if (this.activeSort === 'alpha') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (this.activeSort === 'added') {
      result.reverse();
    } else if (this.activeSort === 'played') {
      const counts = new Map(this.getPlayHistory().map((h) => [h.trackId, h.playCount]));
      result.sort((a, b) => {
        const sumA = a.tracks.reduce((acc, t) => acc + (counts.get(t.id) || 0), 0);
        const sumB = b.tracks.reduce((acc, t) => acc + (counts.get(t.id) || 0), 0);
        return sumB - sumA;
      });
    } else if (this.activeSort === 'recent') {
      const lastPlayed = new Map(this.getPlayHistory().map((h) => [h.trackId, h.playedAt]));
      result.sort((a, b) => {
        const latestA = Math.max(0, ...a.tracks.map((t) => lastPlayed.get(t.id) || t.modifiedAt || 0));
        const latestB = Math.max(0, ...b.tracks.map((t) => lastPlayed.get(t.id) || t.modifiedAt || 0));
        return latestB - latestA;
      });
    }

    return result;
  }

  public searchTracks(query: string): MusicTrack[] {
    const pl = this.getActivePlaylist();
    if (!query.trim()) return pl.tracks;
    const q = query.trim().toLowerCase();
    const currentPlaylists = this.accountPlaylistsMap.get(this.activeSubAccountId) || this.playlists;
    const all = currentPlaylists.flatMap((p) => p.tracks);
    const seen = new Set<string>();
    return all.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q)
      );
    });
  }

  // --- Media Source Filter Mode (All | Google Drive | Local Files) ---

  public setMediaSource(source: 'all' | 'cloud' | 'local'): void {
    this.activeMediaSource = source;
    if (source === 'local' || source === 'all') {
      this.scanLocalDriveMedia(false).catch(() => {});
    }
    this.syncUserAccountMedia(source === 'cloud').catch(() => {});
    this.currentTrackIndex = 0;
    this.currentTime = 0;
    this.emitState();
  }

  public async scanLocalDriveMedia(force = false): Promise<void> {
    if (!force && this.localScanPromise) {
      return this.localScanPromise;
    }
    if (!force && this.lastLocalScanAt > 0 && Date.now() - this.lastLocalScanAt < 30_000) {
      return;
    }

    this.lastLocalScanAt = Date.now();
    const task = (async () => {
      try {
        const [osScanned, catalogAssets] = await Promise.all([
          fetchLocalDiskMusicLibrary(),
          loadAssets().catch(() => []),
        ]);
        const localAudioVideo = catalogAssets.filter(
          (a) => a.source === 'local' && (a.category === 'audio' || a.category === 'video')
        );

        const fromCatalog: MusicTrack[] = localAudioVideo.map((a) => {
          const ext = (a.extension || 'mp3').toLowerCase();
          const format =
            ext === 'flac' ? 'flac' :
            ext === 'ogg' ? 'ogg' :
            ext === 'wav' ? 'wav' :
            ext === 'mp4' ? 'mp4' :
            ext === 'webm' ? 'webm' : 'mp3';

          let title = (a.name || 'Untitled').replace(/\.[^/.]+$/, '');
          let artist = 'Local Disk';
          if (title.includes(' - ')) {
            const parts = title.split(' - ');
            artist = parts[0].trim();
            title = parts.slice(1).join(' - ').trim();
          }
          const pathParts = (a.path || '').split('/').filter(Boolean);
          const albumName = pathParts.length > 1 ? pathParts[pathParts.length - 2] : 'Local Computer Media';

          return {
            id: a.id,
            title,
            artist,
            album: albumName,
            durationSeconds: 0,
            albumArtUrl: a.thumbnailUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80',
            genre: a.category === 'video' ? 'Local Video' : 'Local Audio',
            format,
            isVideo: a.category === 'video',
            source: 'local',
            localPath: a.path,
            modifiedAt: a.modifiedTime ? Date.parse(a.modifiedTime) : undefined,
          };
        });

        this.localTracks = mergeTracks(osScanned, fromCatalog);
        this.lastLocalScanAt = Date.now();
        await this.syncUserAccountMedia(false);
        this.emitState();
      } catch (e) {
        console.warn('Local media scan note:', e);
      } finally {
        this.localScanPromise = null;
      }
    })();

    this.localScanPromise = task;
    return task;
  }

  // --- Player Transport Controls & Synthesizer Pipeline ---

  /**
   * Synchronize video/audio stage mode and auto-navigate to Now Playing whenever
   * a video track is launched so the user immediately sees the playing video.
   */
  private syncPlaybackStageForTrack(track: MusicTrack | undefined): void {
    const isVideo = Boolean(track?.isVideo);
    this.isVideoMode = isVideo;
    if (isVideo) {
      this.activeView = 'nowplaying';
    }
  }

  public playTrack(trackId: string): void {
    this.customQueue = null;
    let pl = this.getActivePlaylist();
    let idx = pl.tracks.findIndex((t) => t.id === trackId);
    if (idx < 0) {
      const parentPl = this.getPlaylists().find((p) => p.tracks.some((t) => t.id === trackId));
      if (parentPl) {
        this.activePlaylistId = parentPl.id;
        pl = parentPl;
        idx = pl.tracks.findIndex((t) => t.id === trackId);
      }
    }
    if (idx < 0) {
      const fromAccount = this.getAllTracksFlat().find((t) => t.id === trackId);
      if (fromAccount) {
        this.customQueue = [fromAccount];
        idx = 0;
      }
    }
    const queue = this.getCurrentQueueTracks();
    if (idx >= 0 && queue[idx]) {
      this.currentTrackIndex = idx;
      this.currentTime = 0;
      this.duration = queue[idx].durationSeconds || this.duration;
    }
    this.isPlaying = true;
    this.playbackError = null;
    this.syncPlaybackStageForTrack(this.getCurrentTrack());
    this.startCurrentTrack();
    this.emitState();
  }

  public playAlbumTracks(tracks: MusicTrack[], startIndex: number = 0, shuffle: boolean = false): void {
    if (!tracks || tracks.length === 0) return;
    this.isShuffle = shuffle;
    const workingQueue = shuffle ? [...tracks].sort(() => Math.random() - 0.5) : [...tracks];
    const initialIndex = shuffle ? 0 : Math.max(0, Math.min(startIndex, workingQueue.length - 1));
    this.customQueue = workingQueue;
    this.currentTrackIndex = initialIndex;
    this.currentTime = 0;
    this.duration = workingQueue[initialIndex]?.durationSeconds || 0;
    this.isPlaying = true;
    this.playbackError = null;
    this.syncPlaybackStageForTrack(this.getCurrentTrack());
    this.startCurrentTrack();
    this.emitState();
  }

  /**
   * Enqueue all tracks across the active user account into continuous playback.
   */
  public playAllAccountTracks(shuffle: boolean = false): void {
    const all = this.getAllTracksFlat();
    if (all.length === 0) return;
    this.playAlbumTracks(all, 0, shuffle);
  }

  /**
   * Convert a workspace MediaAsset into a normalized MusicTrack.
   */
  public mediaAssetToTrack(asset: MediaAsset): MusicTrack {
    const ext = (asset.extension || (asset.category === 'video' ? 'mp4' : 'mp3')).toLowerCase();
    const format =
      ext === 'flac' ? 'flac' :
      ext === 'ogg' ? 'ogg' :
      ext === 'wav' ? 'wav' :
      ext === 'mp4' ? 'mp4' :
      ext === 'webm' ? 'webm' : 'mp3';

    let title = (asset.name || 'Untitled').replace(/\.[^/.]+$/, '');
    let artist = 'Studio Entity';
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }

    const isVideo = asset.category === 'video';
    const driveFileId = asset.source === 'cloud' ? ((asset as any).cloudId || asset.id.replace(/^drive_/, '')) : undefined;

    return {
      id: asset.id,
      title,
      artist,
      album: isVideo ? 'Video Studio' : 'Media Library',
      durationSeconds: asset.duration || 180,
      albumArtUrl: asset.thumbnailUrl || (isVideo
        ? 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=300&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80'),
      genre: isVideo ? 'Video Production' : (asset.tags?.[0] || 'Studio Sound'),
      format,
      bpm: 80,
      year: new Date(asset.modifiedTime || Date.now()).getFullYear(),
      isVideo,
      isLiked: Boolean(asset.cullingStatus === 'picked' || (asset.rating && asset.rating > 0)),
      source: asset.source === 'local' ? 'local' : 'cloud',
      driveFileId,
      videoUrl: isVideo ? (asset.cloudUrl || asset.path) : undefined,
      localPath: asset.localPath || asset.path,
    };
  }

  /**
   * Direct target opening: Cues a specific MediaAsset from the workspace and loads siblings into queue.
   */
  public openPlayerWithAsset(
    asset: MediaAsset,
    autoplay: boolean = true,
    siblingAssets: MediaAsset[] = []
  ): void {
    if (!asset) return;
    const targetTrack = this.mediaAssetToTrack(asset);

    const relevantSiblings = siblingAssets.filter(
      (a) => a.category === 'audio' || a.category === 'video'
    );

    let queueTracks: MusicTrack[] = [];
    if (relevantSiblings.length > 0) {
      queueTracks = relevantSiblings.map((s) => this.mediaAssetToTrack(s));
    } else {
      queueTracks = [targetTrack];
    }

    let targetIdx = queueTracks.findIndex((t) => t.id === targetTrack.id);
    if (targetIdx < 0) {
      queueTracks.unshift(targetTrack);
      targetIdx = 0;
    }

    this.customQueue = queueTracks;
    this.currentTrackIndex = targetIdx;
    this.currentTime = 0;
    this.duration = targetTrack.durationSeconds || 180;
    this.syncPlaybackStageForTrack(targetTrack);
    this.playbackError = null;

    if (autoplay) {
      this.isPlaying = true;
      this.startCurrentTrack();
    }
    this.emitState();
  }

  /**
   * Add a MediaAsset directly into the Up Next queue.
   */
  public addAssetToQueue(asset: MediaAsset): void {
    if (!asset) return;
    const track = this.mediaAssetToTrack(asset);
    this.addToQueue(track);
  }

  /**
   * Media Player Opening Handshake: Un-suspends AudioContext, restores saved view and Drive account,
   * triggers Drive & local OS folder scans cleanly.
   */
  public onPlayerOpened(): void {
    // 1. Un-suspend Web Audio chain on user interaction
    try {
      universalMediaPlayer.resumeAudioContext();
    } catch {}

    // 2. Restore last visited view (defaulting to 'home')
    try {
      if (typeof localStorage !== 'undefined') {
        const savedView = localStorage.getItem('dt_google_music_last_view_v1') as GoogleMusicViewMode;
        if (savedView && ['home', 'explore', 'library', 'artist', 'album'].includes(savedView)) {
          this.activeView = savedView;
        }
      }
    } catch {}

    // 3. Ensure active Google Drive profile selection is preserved
    try {
      if (typeof localStorage !== 'undefined') {
        const savedActiveId = localStorage.getItem('dt_google_music_active_sub_account_v1');
        if (savedActiveId && this.subAccounts.some((s) => s.id === savedActiveId) && this.activeSubAccountId !== savedActiveId) {
          this.switchSubAccount(savedActiveId);
        }
      }
    } catch {}

    // 4. Refresh authenticated Drive profile metadata
    this.discoverRemoteSubAccounts().catch(() => {});

    // 5. Scan local OS Music/Video folders and Google Drive archive concurrently (respecting TTL cooldown)
    this.scanLocalDriveMedia(false).catch(() => {});
    this.refreshDriveLibrary(false).catch(() => {});

    this.emitState();
  }

  /** Shared media element (audio + video) so the UI stage and PiP use the real player. */
  public getMediaElement(): HTMLVideoElement | null {
    return this.playback.getElement();
  }

  /** Mount or park the shared HTML5 video/audio element cleanly. */
  public attachMediaToStage(host: HTMLElement | null): void {
    this.playback.attachToStage(host);
  }

  /** Whether the current track has a real playable source (vs. the offline synth fallback). */
  public hasRealSource(): boolean {
    return Boolean(resolveTrackUrl(this.getCurrentTrack()));
  }

  private handleTrackEnded(): void {
    if (this.repeatMode === 'one') {
      this.playback.seek(0);
      void this.playback.play();
      return;
    }
    const queue = this.getCurrentQueueTracks();
    const atEnd = this.currentTrackIndex >= queue.length - 1;
    if (this.autoplay) {
      if (atEnd) {
        // Infinite dynamic radio expansion
        const cur = this.getCurrentTrack();
        const all = this.getAllTracksFlat();
        const recs = getNextAutoplayRecommendations(cur, queue, all, 10);
        if (recs.length > 0) {
          this.customQueue = [...queue, ...recs];
          this.next();
          return;
        }
      }
      if (!atEnd || this.repeatMode === 'all' || this.isShuffle) {
        this.next();
        return;
      }
    }
    this.isPlaying = false;
    this.emitState();
  }

  /** Load + play the current track through the real player; fall back to the synth only for tracks without a source. */
  private startCurrentTrack(): void {
    const track = this.getCurrentTrack();
    if (track && this.isPlaying) {
      recordTrackPlay(this.activeSubAccountId, track);
    }
    if (track && resolveTrackUrl(track) && this.playback.getElement()) {
      this.stopSynthesizer();
      this.playback.load(track, this.isPlaying, this.volume).then((ok) => {
        if (!ok) this.startSynthesizer();
      });
    } else {
      this.playback.stop();
      if (this.isPlaying) this.startSynthesizer();
    }
    this.emitState();
  }

  public selectPlaylist(playlistId: string): void {
    const pl = this.getPlaylists().find((p) => p.id === playlistId);
    if (pl) {
      this.customQueue = null;
      this.activePlaylistId = playlistId;
      this.currentTrackIndex = 0;
      this.currentTime = 0;
      this.duration = pl.tracks[0]?.durationSeconds || 0;
      this.emitState();
    }
  }

  public play(): void {
    this.isPlaying = true;
    this.playbackError = null;
    this.syncPlaybackStageForTrack(this.getCurrentTrack());
    if (this.playback.hasSource() && this.hasRealSource()) {
      void this.playback.play();
    } else {
      this.startCurrentTrack();
    }
    this.emitState();
  }

  public pause(): void {
    this.isPlaying = false;
    this.playback.pause();
    this.stopSynthesizer();
    this.emitState();
  }

  public togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public next(): void {
    const tracks = this.getCurrentQueueTracks();
    if (tracks.length === 0) return;
    if (this.isShuffle) {
      this.currentTrackIndex = Math.floor(Math.random() * tracks.length);
    } else {
      this.currentTrackIndex = (this.currentTrackIndex + 1) % tracks.length;
    }
    const nextTrack = this.getCurrentTrack();
    this.currentTime = 0;
    this.duration = nextTrack?.durationSeconds || this.duration;
    this.playbackError = null;
    this.syncPlaybackStageForTrack(nextTrack);
    if (this.isPlaying) this.startCurrentTrack();
    this.emitState();
  }

  public prev(): void {
    const tracks = this.getCurrentQueueTracks();
    if (tracks.length === 0) return;
    if (this.currentTime > 3) {
      this.currentTime = 0;
    } else {
      this.currentTrackIndex = (this.currentTrackIndex - 1 + tracks.length) % tracks.length;
      this.currentTime = 0;
    }
    const prevTrack = this.getCurrentTrack();
    this.duration = prevTrack?.durationSeconds || this.duration;
    this.playbackError = null;
    this.syncPlaybackStageForTrack(prevTrack);
    if (this.isPlaying) this.startCurrentTrack();
    else this.playback.seek(0);
    this.emitState();
  }

  public seek(seconds: number): void {
    this.currentTime = Math.max(0, Math.min(seconds, this.duration));
    universalMediaPlayer.seek(this.currentTime);
    this.playback.seek(this.currentTime);
    this.emitState();
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(vol, 1.5));
    universalMediaPlayer.setVolume(this.volume);
    this.playback.setVolume(this.volume);
    if (this.synthGain) {
      this.synthGain.gain.setValueAtTime(this.volume * 0.15, this.synthCtx?.currentTime || 0);
    }
    this.emitState();
  }

  public toggleShuffle(): void {
    this.isShuffle = !this.isShuffle;
    this.emitState();
  }

  public toggleRepeat(): void {
    if (this.repeatMode === 'off') this.repeatMode = 'all';
    else if (this.repeatMode === 'all') this.repeatMode = 'one';
    else this.repeatMode = 'off';
    this.emitState();
  }

  // --- Web Audio Melodic Synthesizer Engine ---

  private startSynthesizer(): void {
    this.stopSynthesizer();
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.synthCtx || this.synthCtx.state === 'closed') {
        this.synthCtx = new AudioContextClass();
      }
      if (this.synthCtx.state === 'suspended') {
        this.synthCtx.resume().catch(() => {});
      }

      this.synthGain = this.synthCtx.createGain();
      this.synthGain.gain.setValueAtTime(this.volume * 0.15, this.synthCtx.currentTime);
      this.synthGain.connect(this.synthCtx.destination);

      this.synthInterval = setInterval(() => {
        if (!this.isPlaying) return;
        this.currentTime += 1;
        if (this.currentTime >= this.duration) {
          if (this.repeatMode === 'one') {
            this.currentTime = 0;
          } else if (this.autoplay) {
            this.next();
          } else {
            this.pause();
          }
        }
        this.emitState();

        if (this.synthCtx && this.synthGain && this.currentTime % 2 === 0) {
          this.playAmbientChord(this.currentTime);
        }
      }, 1000);
    } catch {}
  }

  private playAmbientChord(timeIndex: number): void {
    if (!this.synthCtx || !this.synthGain) return;
    const notes = [220, 261.63, 293.66, 329.63, 392.0, 440, 523.25];
    const baseFreq = notes[timeIndex % notes.length];

    const osc = this.synthCtx.createOscillator();
    const noteGain = this.synthCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, this.synthCtx.currentTime);

    noteGain.gain.setValueAtTime(0.001, this.synthCtx.currentTime);
    noteGain.gain.exponentialRampToValueAtTime(0.08, this.synthCtx.currentTime + 0.3);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, this.synthCtx.currentTime + 1.8);

    osc.connect(noteGain);
    noteGain.connect(this.synthGain);

    osc.start();
    osc.stop(this.synthCtx.currentTime + 1.9);
  }

  private stopSynthesizer(): void {
    clearInterval(this.synthInterval);
    if (this.synthCtx && this.synthCtx.state === 'running') {
      try {
        this.synthCtx.suspend().catch(() => {});
      } catch {}
    }
  }

  public getState(): GoogleMusicState {
    const currentTrack = this.getCurrentTrack();
    return {
      currentTrack,
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.volume,
      isShuffle: this.isShuffle,
      repeatMode: this.repeatMode,
      activePlaylistId: this.activePlaylistId,
      queue: this.getCurrentQueueTracks(),
      activeSubAccount: this.getActiveSubAccount(),
      subAccounts: this.getSubAccounts(),
      activeView: this.activeView,
      selectedArtistId: this.selectedArtistId,
      selectedAlbumId: this.selectedAlbumId,
      activeMediaSource: this.activeMediaSource,
      activeCategory: this.activeCategory,
      activeSort: this.activeSort,
      autoplay: this.autoplay,
      activeTab: this.activeTab,
      isVideoMode: this.isVideoMode,
      isPipActive: this.isPipActive,
      playbackError: this.playbackError,
      libraryStatus: { ...this.libraryStatus },
      playHistory: this.getPlayHistory(),
      parsedLyrics: this.getParsedLyrics(currentTrack),
    };
  }

  public subscribe(listener: GoogleMusicListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private emitState(): void {
    const s = this.getState();
    for (const listener of this.listeners) {
      listener(s);
    }
  }
}

export const googleMusicEngine = new GoogleMusicEngine();
