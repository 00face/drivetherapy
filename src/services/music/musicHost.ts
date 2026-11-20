/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dedicated Express Media Studio Host Router (/api/music/*)
 * Powers Drive Therapy local & Google Drive media playback endpoints:
 * - /home: Personalized shelves (Quick picks, Listen again, Mixed for you, Moods, Videos)
 * - /explore: New releases, Charts (Top songs/videos/artists), Moods & Genres directory
 * - /moods: Comprehensive taxonomy of moods and genres
 * - /charts: Ranked tracks by plays, likes, and trending velocity
 * - /search: Multi-category faceted search across songs, videos, albums, artists, playlists
 * - /search/suggestions: Real-time query autocomplete dropdown suggestions
 * - /radio/:trackId: Dynamic seed-based radio station generation
 * - /artist/:artistId: Artist profile, top tracks, discography albums & singles, similar artists
 * - /album/:albumId: Album tracklist, total duration, release year, credits
 * - /playlists: Full playlist management CRUD (create, update, delete, reorder)
 * - /lyrics/:trackId: Synchronized LRC or plaintext lyrics storage and retrieval
 *
 * Erasable Syntax Doctrine: Zero enum/namespace, pure interfaces and types.
 * Zero-Key Offline Resilience: Gracefully synthesizes and serves rich catalogs offline.
 */

import { Router, Request, Response } from 'express';

export interface HostMusicTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationSeconds: number;
  albumArtUrl: string;
  genre: string;
  format: string;
  bpm?: number;
  year?: number;
  isVideo?: boolean;
  videoUrl?: string;
  viewCount?: string;
  likeCount?: string;
  isLiked?: boolean;
  playCount?: number;
}

export interface HostMusicShelf {
  id: string;
  title: string;
  subtitle?: string;
  type: 'tracks' | 'albums' | 'artists' | 'playlists' | 'videos';
  items: any[];
}

export interface HostMoodCategory {
  id: string;
  label: string;
  color: string;
  icon: string;
  description: string;
  genres: string[];
}

// Canonical curated moods and genres taxonomy for Drive & Local Studio
export const MOODS_AND_GENRES: HostMoodCategory[] = [
  {
    id: 'chill',
    label: 'Chill & Relax',
    color: '#38BDF8',
    icon: 'Coffee',
    description: 'Laid-back beats, lo-fi textures, and peaceful instrumental tones.',
    genres: ['Lo-Fi', 'Ambient', 'Downtempo', 'Chillhop'],
  },
  {
    id: 'focus',
    label: 'Deep Focus & Study',
    color: '#818CF8',
    icon: 'Brain',
    description: 'Calm ambient frequencies and repetitive rhythms for productivity.',
    genres: ['Ambient', 'Classical', 'Minimalism', 'Binaural'],
  },
  {
    id: 'workout',
    label: 'Energy & Workout',
    color: '#F43F5E',
    icon: 'Zap',
    description: 'High-BPM electronic, pulse-pounding rhythm, and motivating crescendos.',
    genres: ['Electronic', 'Drum & Bass', 'Synthwave', 'EDM'],
  },
  {
    id: 'commute',
    label: 'Commute & Travel',
    color: '#F59E0B',
    icon: 'Car',
    description: 'Engaging soundscapes and melodic travels for roads, trains, and flights.',
    genres: ['Indie', 'Alternative', 'Lo-Fi', 'Pop'],
  },
  {
    id: 'party',
    label: 'Party & Celebration',
    color: '#EC4899',
    icon: 'PartyPopper',
    description: 'Upbeat tracks, infectious grooves, and dancefloor anthems.',
    genres: ['Dance', 'House', 'Funk', 'Hip-Hop'],
  },
  {
    id: 'romance',
    label: 'Romance & Sunset',
    color: '#FB7185',
    icon: 'Heart',
    description: 'Intimate melodies, acoustic strings, and warm sunset harmony.',
    genres: ['R&B', 'Acoustic', 'Soul', 'Jazz'],
  },
  {
    id: 'sleep',
    label: 'Sleep & Nightcap',
    color: '#6366F1',
    icon: 'Moon',
    description: 'Whispering drones, gentle piano, and delta wave acoustic washes.',
    genres: ['Ambient', 'Neo-Classical', 'Drone', 'Piano'],
  },
  {
    id: 'energize',
    label: 'Feel Good & Boost',
    color: '#10B981',
    icon: 'Sparkles',
    description: 'Bright melodies, sparkling chords, and uplifting studio tracks.',
    genres: ['Synthpop', 'Indie Pop', 'Electro Swing', 'Soul'],
  },
];

// Curated default tracks with diverse genres for offline zero-key bootstrap
const SEED_CATALOG: HostMusicTrack[] = [
  {
    id: 'track_lofi_01',
    title: 'Rainy Window Resonance',
    artist: 'Antigravity Sound Lab',
    album: 'Zero-G Lo-Fi Sessions',
    durationSeconds: 168,
    albumArtUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
    genre: 'Lo-Fi',
    format: 'flac',
    bpm: 78,
    year: 2026,
    isVideo: false,
    viewCount: '1.4M',
    likeCount: '84K',
    playCount: 1420,
    isLiked: true,
  },
  {
    id: 'track_synth_02',
    title: 'Neon Drift 2088',
    artist: 'GlassBoy & Cyberwave',
    album: 'Future Horizons EP',
    durationSeconds: 215,
    albumArtUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80',
    genre: 'Synthwave',
    format: 'mp3',
    bpm: 118,
    year: 2026,
    isVideo: true,
    viewCount: '2.8M',
    likeCount: '190K',
    playCount: 2850,
    isLiked: true,
  },
  {
    id: 'track_ambient_03',
    title: 'Atmospheric Depths',
    artist: 'Antigravity Sound Lab',
    album: 'Zero-G Lo-Fi Sessions',
    durationSeconds: 310,
    albumArtUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80',
    genre: 'Ambient',
    format: 'flac',
    bpm: 62,
    year: 2026,
    isVideo: false,
    viewCount: '920K',
    likeCount: '51K',
    playCount: 940,
    isLiked: false,
  },
  {
    id: 'track_classical_04',
    title: 'Nocturne for Solitary Moons',
    artist: 'Clara Vane Ensemble',
    album: 'Celestial Reverie',
    durationSeconds: 242,
    albumArtUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
    genre: 'Classical',
    format: 'flac',
    bpm: 68,
    year: 2025,
    isVideo: false,
    viewCount: '640K',
    likeCount: '38K',
    playCount: 680,
    isLiked: false,
  },
  {
    id: 'track_jazz_05',
    title: 'Midnight in Shibuya',
    artist: 'Tokyo Blue Quartet',
    album: 'Rhythm & Rain',
    durationSeconds: 278,
    albumArtUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=500&auto=format&fit=crop&q=80',
    genre: 'Jazz',
    format: 'wav',
    bpm: 92,
    year: 2026,
    isVideo: false,
    viewCount: '1.1M',
    likeCount: '72K',
    playCount: 1120,
    isLiked: true,
  },
  {
    id: 'track_dnb_06',
    title: 'Sub-Orbital Hyperdrive',
    artist: 'Quantum Pulse',
    album: 'Kinetic Vectors',
    durationSeconds: 194,
    albumArtUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=500&auto=format&fit=crop&q=80',
    genre: 'Drum & Bass',
    format: 'mp3',
    bpm: 174,
    year: 2026,
    isVideo: true,
    viewCount: '3.4M',
    likeCount: '210K',
    playCount: 3410,
    isLiked: false,
  },
  {
    id: 'track_indie_07',
    title: 'Golden Hour Coastline',
    artist: 'Pacific Meridian',
    album: 'Saltwater & Film',
    durationSeconds: 204,
    albumArtUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=80',
    genre: 'Indie',
    format: 'mp3',
    bpm: 104,
    year: 2025,
    isVideo: false,
    viewCount: '870K',
    likeCount: '44K',
    playCount: 890,
    isLiked: false,
  },
  {
    id: 'track_electronic_08',
    title: 'Digital Horizon V',
    artist: 'GlassBoy & Cyberwave',
    album: 'Future Horizons EP',
    durationSeconds: 226,
    albumArtUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80',
    genre: 'Electronic',
    format: 'flac',
    bpm: 124,
    year: 2026,
    isVideo: true,
    viewCount: '1.9M',
    likeCount: '115K',
    playCount: 1980,
    isLiked: true,
  },
];

// In-memory persistent lyrics and custom user playlists store
const storedLyrics = new Map<string, string>([
  [
    'track_lofi_01',
    '[00:00.00] (Gentle rain pitter-patter)\n[00:12.00] Tape reels softly turning\n[00:24.00] Echoes through the glass\n[00:48.00] Frequency washes over the quiet room\n[01:12.00] Breathing in the chill evening air\n[01:36.00] Drifting into zero gravity',
  ],
  [
    'track_synth_02',
    '[00:00.00] (Arpeggiated synth pulses)\n[00:15.00] Neon lines cutting through the haze\n[00:30.00] Accelerating down the digital highway\n[00:45.00] The pulse of 2088 calls us home\n[01:15.00] Speed of light, reflections in chrome\n[01:45.00] We will never look back',
  ],
]);

const inMemoryPlaylists = new Map<string, any>([
  [
    'pl_curated_lofi',
    {
      id: 'pl_curated_lofi',
      title: 'Deep Studio Chillout',
      description: 'Handcrafted chillhop, warm tape hiss, and relaxing vinyl textures.',
      coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
      author: 'Google Music Curators',
      tracks: [SEED_CATALOG[0], SEED_CATALOG[2], SEED_CATALOG[4]],
      isPinned: true,
    },
  ],
  [
    'pl_curated_synth',
    {
      id: 'pl_curated_synth',
      title: 'Night Drive Cyberwave',
      description: 'Luminous basslines and retrofuturistic synth arpeggios.',
      coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80',
      author: 'Studio Curators',
      tracks: [SEED_CATALOG[1], SEED_CATALOG[5], SEED_CATALOG[7]],
      isPinned: true,
    },
  ],
]);

export function createMusicHostRouter(): Router {
  const router = Router();

  // 1. Health check & Capabilities
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'online',
      service: 'google_music_host',
      version: '2.2.0',
      capabilities: [
        'home_discovery',
        'explore_charts',
        'moods_and_genres',
        'instant_autocomplete',
        'procedural_radio',
        'artist_discography',
        'album_views',
        'playlist_crud',
        'synced_lrc_lyrics',
      ],
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Home Discovery Feed
  router.get('/home', (req: Request, res: Response) => {
    const moodFilter = typeof req.query.mood === 'string' ? req.query.mood.toLowerCase() : '';

    let tracks = [...SEED_CATALOG];
    if (moodFilter) {
      const moodConfig = MOODS_AND_GENRES.find((m) => m.id === moodFilter);
      if (moodConfig) {
        const matchingGenres = new Set(moodConfig.genres.map((g) => g.toLowerCase()));
        tracks = tracks.filter((t) => matchingGenres.has(t.genre.toLowerCase()));
      }
    }

    const quickPicks = tracks.slice(0, 5);
    const listenAgain = [...tracks].sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 4);
    const mixedForYou = Array.from(inMemoryPlaylists.values());
    const recommendedVideos = tracks.filter((t) => t.isVideo);
    const forgottenFavorites = tracks.slice(2, 6);

    const shelves: HostMusicShelf[] = [
      {
        id: 'shelf_quick_picks',
        title: 'Quick picks',
        subtitle: 'Start radio with songs you love',
        type: 'tracks',
        items: quickPicks,
      },
      {
        id: 'shelf_listen_again',
        title: 'Listen again',
        subtitle: 'Recent favorites from your library',
        type: 'tracks',
        items: listenAgain,
      },
      {
        id: 'shelf_mixed_for_you',
        title: 'Mixed for you',
        subtitle: 'Personalized studio mixes & compilations',
        type: 'playlists',
        items: mixedForYou,
      },
      {
        id: 'shelf_recommended_videos',
        title: 'Recommended music videos',
        subtitle: 'Watch in high definition or switch to audio',
        type: 'videos',
        items: recommendedVideos,
      },
      {
        id: 'shelf_forgotten_favorites',
        title: 'Forgotten favorites',
        subtitle: 'Rediscover gems in your archive',
        type: 'tracks',
        items: forgottenFavorites,
      },
    ];

    res.json({
      moods: MOODS_AND_GENRES,
      activeMood: moodFilter || null,
      shelves,
      totalTracks: tracks.length,
    });
  });

  // 3. Explore & Studio Catalog Formats
  router.get('/explore', (_req: Request, res: Response) => {
    const newReleases = [...SEED_CATALOG]
      .sort((a, b) => (b.year || 2025) - (a.year || 2025))
      .slice(0, 6);

    const topSongs = [...SEED_CATALOG]
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, 8);

    const topVideos = SEED_CATALOG.filter((t) => t.isVideo).slice(0, 4);

    // Group top artists
    const artistMap = new Map<string, { name: string; avatarUrl: string; genre: string; trackCount: number }>();
    for (const t of SEED_CATALOG) {
      if (!artistMap.has(t.artist)) {
        artistMap.set(t.artist, {
          name: t.artist,
          avatarUrl: t.albumArtUrl,
          genre: t.genre,
          trackCount: 0,
        });
      }
      artistMap.get(t.artist)!.trackCount++;
    }
    const topArtists = Array.from(artistMap.values());

    res.json({
      newReleases,
      charts: {
        topSongs,
        topVideos,
        topArtists,
      },
      moodCategories: MOODS_AND_GENRES,
    });
  });

  // 4. Moods & Genres Directory
  router.get('/moods', (_req: Request, res: Response) => {
    res.json({
      moods: MOODS_AND_GENRES,
    });
  });

  // 5. Global & Regional Charts
  router.get('/charts', (req: Request, res: Response) => {
    const country = typeof req.query.country === 'string' ? req.query.country.toUpperCase() : 'GLOBAL';
    const songs = [...SEED_CATALOG].sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
    const videos = SEED_CATALOG.filter((t) => t.isVideo);

    res.json({
      country,
      trending: songs.slice(0, 5),
      topSongs: songs,
      topVideos: videos,
      updatedAt: new Date().toISOString(),
    });
  });

  // 6. Search Autocomplete Suggestions (instant as user types)
  router.get('/search/suggestions', (req: Request, res: Response) => {
    const q = (typeof req.query.q === 'string' ? req.query.q : '').trim().toLowerCase();
    if (!q) {
      res.json({ query: '', suggestions: [] });
      return;
    }

    const qClean = q.replace(/[^a-z0-9]/gi, '');
    const suggestions = new Set<string>();

    const matches = (haystack: string) => {
      const lower = haystack.toLowerCase();
      if (lower.includes(q)) return true;
      if (qClean && lower.replace(/[^a-z0-9]/gi, '').includes(qClean)) return true;
      return false;
    };

    for (const t of SEED_CATALOG) {
      if (matches(t.title)) suggestions.add(t.title);
      if (matches(t.artist)) suggestions.add(t.artist);
      if (matches(t.album)) suggestions.add(t.album);
      if (matches(t.genre)) suggestions.add(t.genre);
    }

    for (const m of MOODS_AND_GENRES) {
      if (matches(m.label)) suggestions.add(m.label);
      for (const g of m.genres) {
        if (matches(g)) suggestions.add(g);
      }
    }

    res.json({
      query: q,
      suggestions: Array.from(suggestions).slice(0, 8),
    });
  });

  // 7. Multi-Category Search (songs, videos, albums, artists, playlists)
  router.get('/search', (req: Request, res: Response) => {
    const q = (typeof req.query.q === 'string' ? req.query.q : '').trim().toLowerCase();
    const category = typeof req.query.category === 'string' ? req.query.category.toLowerCase() : 'all';

    if (!q) {
      res.json({
        query: '',
        category,
        songs: SEED_CATALOG.slice(0, 5),
        videos: SEED_CATALOG.filter((t) => t.isVideo),
        albums: [],
        artists: [],
        playlists: Array.from(inMemoryPlaylists.values()),
      });
      return;
    }

    const matchedTracks = SEED_CATALOG.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q)
    );

    const songs = matchedTracks.filter((t) => !t.isVideo);
    const videos = matchedTracks.filter((t) => t.isVideo);

    // Group matched albums
    const albumMap = new Map<string, any>();
    for (const t of matchedTracks) {
      if (!albumMap.has(t.album)) {
        albumMap.set(t.album, {
          id: `album_${encodeURIComponent(t.album)}`,
          title: t.album,
          artist: t.artist,
          coverUrl: t.albumArtUrl,
          year: t.year || 2026,
          trackCount: 0,
        });
      }
      albumMap.get(t.album)!.trackCount++;
    }

    // Group matched artists
    const artistMap = new Map<string, any>();
    for (const t of matchedTracks) {
      if (!artistMap.has(t.artist)) {
        artistMap.set(t.artist, {
          id: `artist_${encodeURIComponent(t.artist)}`,
          name: t.artist,
          avatarUrl: t.albumArtUrl,
          genre: t.genre,
        });
      }
    }

    // Matched playlists
    const playlists = Array.from(inMemoryPlaylists.values()).filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.author?.toLowerCase().includes(q)
    );

    res.json({
      query: q,
      category,
      songs,
      videos,
      albums: Array.from(albumMap.values()),
      artists: Array.from(artistMap.values()),
      playlists,
      totalCount: matchedTracks.length + playlists.length,
    });
  });

  // 8. Seed-based Radio Station Generator (/api/music/radio/:trackId)
  router.get('/radio/:trackId', (req: Request, res: Response) => {
    const trackId = req.params.trackId;
    const seed = SEED_CATALOG.find((t) => t.id === trackId) || SEED_CATALOG[0];

    // Similarity scoring algorithm:
    // +50 for same artist, +35 for same genre, +20 for close BPM (+-20)
    const scored = SEED_CATALOG.map((cand) => {
      let score = 0;
      if (cand.id === seed.id) score = 1000;
      if (cand.artist === seed.artist) score += 50;
      if (cand.genre === seed.genre) score += 35;
      if (cand.bpm && seed.bpm && Math.abs(cand.bpm - seed.bpm) <= 20) score += 20;
      return { track: cand, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const radioQueue = scored.map((s) => s.track);

    res.json({
      seedTrack: seed,
      stationName: `${seed.title} Radio`,
      description: `Continuous station inspired by ${seed.artist} and ${seed.genre}`,
      tracks: radioQueue,
    });
  });

  // 9. Artist Profile & Discography (/api/music/artist/:artistId)
  router.get('/artist/:artistId', (req: Request, res: Response) => {
    const rawId = decodeURIComponent(req.params.artistId).replace(/^artist_/, '');
    const artistTracks = SEED_CATALOG.filter(
      (t) => t.artist.toLowerCase() === rawId.toLowerCase() || t.artist === rawId
    );

    const canonicalName = artistTracks[0]?.artist || rawId;
    const heroCover = artistTracks[0]?.albumArtUrl || SEED_CATALOG[0].albumArtUrl;
    const topSongs = [...artistTracks].sort((a, b) => (b.playCount || 0) - (a.playCount || 0));

    // Albums
    const albumMap = new Map<string, any>();
    for (const t of artistTracks) {
      if (!albumMap.has(t.album)) {
        albumMap.set(t.album, {
          id: `album_${encodeURIComponent(t.album)}`,
          title: t.album,
          artist: canonicalName,
          coverUrl: t.albumArtUrl,
          year: t.year || 2026,
          tracks: [],
        });
      }
      albumMap.get(t.album)!.tracks.push(t);
    }

    // Similar artists
    const genre = artistTracks[0]?.genre;
    const similarArtists = SEED_CATALOG.filter(
      (t) => t.artist !== canonicalName && (!genre || t.genre === genre)
    )
      .map((t) => ({
        id: `artist_${encodeURIComponent(t.artist)}`,
        name: t.artist,
        avatarUrl: t.albumArtUrl,
        genre: t.genre,
      }))
      .slice(0, 4);

    res.json({
      id: `artist_${encodeURIComponent(canonicalName)}`,
      name: canonicalName,
      avatarUrl: heroCover,
      catalogCountLabel: `${topSongs.length} tracks in catalog`,
      bio: `${canonicalName} artist collection resolved from your local & Google Drive media library.`,
      topSongs,
      albums: Array.from(albumMap.values()),
      singles: artistTracks.filter((t) => t.isVideo || t.durationSeconds < 240),
      similarArtists,
    });
  });

  // 10. Album Details & Full Tracklist (/api/music/album/:albumId)
  router.get('/album/:albumId', (req: Request, res: Response) => {
    const rawId = decodeURIComponent(req.params.albumId).replace(/^album_/, '');
    const albumTracks = SEED_CATALOG.filter(
      (t) => t.album.toLowerCase() === rawId.toLowerCase() || t.album === rawId
    );

    const canonicalTitle = albumTracks[0]?.album || rawId;
    const artist = albumTracks[0]?.artist || 'Various Artists';
    const coverUrl = albumTracks[0]?.albumArtUrl || SEED_CATALOG[0].albumArtUrl;
    const year = albumTracks[0]?.year || 2026;
    const totalDurationSeconds = albumTracks.reduce((sum, t) => sum + (t.durationSeconds || 0), 0);

    res.json({
      id: `album_${encodeURIComponent(canonicalTitle)}`,
      title: canonicalTitle,
      artist,
      coverUrl,
      year,
      trackCount: albumTracks.length,
      totalDurationSeconds,
      tracks: albumTracks.map((t, idx) => ({ ...t, trackNumber: idx + 1 })),
    });
  });

  // 11. Synchronized LRC Lyrics (/api/music/lyrics/:trackId)
  router.get('/lyrics/:trackId', (req: Request, res: Response) => {
    const trackId = req.params.trackId;
    const lrc = storedLyrics.get(trackId) || null;
    res.json({
      trackId,
      hasLyrics: Boolean(lrc),
      lyrics: lrc,
      format: 'lrc',
    });
  });

  router.post('/lyrics/:trackId', (req: Request, res: Response) => {
    const trackId = req.params.trackId;
    const lyrics = typeof req.body.lyrics === 'string' ? req.body.lyrics.trim() : '';

    if (!lyrics) {
      res.status(400).json({ error: 'Missing or empty lyrics payload' });
      return;
    }

    storedLyrics.set(trackId, lyrics);
    res.json({
      success: true,
      trackId,
      lyricsLength: lyrics.length,
      updatedAt: new Date().toISOString(),
    });
  });

  // 12. Playlist CRUD Endpoints
  router.get('/playlists', (_req: Request, res: Response) => {
    res.json({
      playlists: Array.from(inMemoryPlaylists.values()),
    });
  });

  router.post('/playlists', (req: Request, res: Response) => {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const coverUrl =
      typeof req.body.coverUrl === 'string' && req.body.coverUrl.trim()
        ? req.body.coverUrl.trim()
        : SEED_CATALOG[0].albumArtUrl;

    if (!title) {
      res.status(400).json({ error: 'Title is required for playlist creation' });
      return;
    }

    const id = `pl_user_${Date.now()}`;
    const newPlaylist = {
      id,
      title,
      description,
      coverUrl,
      author: 'Studio User',
      tracks: Array.isArray(req.body.initialTracks) ? req.body.initialTracks : [],
      isPinned: false,
      createdAt: Date.now(),
    };

    inMemoryPlaylists.set(id, newPlaylist);
    res.status(201).json(newPlaylist);
  });

  router.put('/playlists/:id', (req: Request, res: Response) => {
    const id = req.params.id;
    const existing = inMemoryPlaylists.get(id);

    if (!existing) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    if (typeof req.body.title === 'string' && req.body.title.trim()) {
      existing.title = req.body.title.trim();
    }
    if (typeof req.body.description === 'string') {
      existing.description = req.body.description.trim();
    }
    if (Array.isArray(req.body.tracks)) {
      existing.tracks = req.body.tracks;
    }

    inMemoryPlaylists.set(id, existing);
    res.json(existing);
  });

  router.delete('/playlists/:id', (req: Request, res: Response) => {
    const id = req.params.id;
    const deleted = inMemoryPlaylists.delete(id);
    if (!deleted) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }
    res.json({ success: true, id });
  });

  return router;
}
