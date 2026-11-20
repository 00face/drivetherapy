/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Media Studio Client API (musicApi.ts)
 * Client-side interface to /api/music/* with offline fallback and cache support.
 *
 * Erasable Syntax Doctrine: Zero enum/namespace, pure interfaces and types.
 */

import { loadOAuthToken } from '../oauthStorage';
import type { HostMusicShelf, HostMoodCategory } from './musicHost';
import type { MusicTrack, MusicPlaylist } from '../googleMusicEngine';

export interface MusicHomeResponse {
  moods: HostMoodCategory[];
  activeMood: string | null;
  shelves: HostMusicShelf[];
  totalTracks: number;
}

export interface MusicExploreResponse {
  newReleases: any[];
  charts: {
    topSongs: any[];
    topVideos: any[];
    topArtists: any[];
  };
  moodCategories: HostMoodCategory[];
}

export interface MusicSearchResponse {
  query: string;
  category: string;
  songs: any[];
  videos: any[];
  albums: any[];
  artists: any[];
  playlists: any[];
  totalCount: number;
}

export interface MusicArtistResponse {
  id: string;
  name: string;
  avatarUrl: string;
  catalogCountLabel: string;
  bio: string;
  topSongs: any[];
  albums: any[];
  singles: any[];
  similarArtists: any[];
}

export interface MusicAlbumResponse {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  year: number;
  trackCount: number;
  totalDurationSeconds: number;
  tracks: any[];
}

export class MusicApiClient {
  private getHeaders(): Record<string, string> {
    const token = loadOAuthToken()?.accessToken;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  public async getHomeFeed(mood?: string): Promise<MusicHomeResponse> {
    try {
      const qs = mood ? `?mood=${encodeURIComponent(mood)}` : '';
      const res = await fetch(`/api/music/home${qs}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      // Fallback offline empty structure
      return { moods: [], activeMood: null, shelves: [], totalTracks: 0 };
    }
  }

  public async getExploreFeed(): Promise<MusicExploreResponse> {
    try {
      const res = await fetch('/api/music/explore', {
        headers: this.getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return {
        newReleases: [],
        charts: { topSongs: [], topVideos: [], topArtists: [] },
        moodCategories: [],
      };
    }
  }

  public async getMoods(): Promise<HostMoodCategory[]> {
    try {
      const res = await fetch('/api/music/moods', { headers: this.getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.moods || [];
    } catch {
      return [];
    }
  }

  public async getCharts(country = 'GLOBAL'): Promise<any> {
    try {
      const res = await fetch(`/api/music/charts?country=${encodeURIComponent(country)}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return { country, topSongs: [], topVideos: [] };
    }
  }

  public async getSearchSuggestions(query: string): Promise<string[]> {
    if (!query.trim()) return [];
    try {
      const res = await fetch(`/api/music/search/suggestions?q=${encodeURIComponent(query.trim())}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.suggestions || [];
    } catch {
      return [];
    }
  }

  public async search(query: string, category = 'all'): Promise<MusicSearchResponse> {
    try {
      const res = await fetch(
        `/api/music/search?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`,
        { headers: this.getHeaders() }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return {
        query,
        category,
        songs: [],
        videos: [],
        albums: [],
        artists: [],
        playlists: [],
        totalCount: 0,
      };
    }
  }

  public async getRadioStation(trackId: string): Promise<any> {
    try {
      const res = await fetch(`/api/music/radio/${encodeURIComponent(trackId)}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return null;
    }
  }

  public async getArtistProfile(artistId: string): Promise<MusicArtistResponse | null> {
    try {
      const res = await fetch(`/api/music/artist/${encodeURIComponent(artistId)}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return null;
    }
  }

  public async getAlbumDetails(albumId: string): Promise<MusicAlbumResponse | null> {
    try {
      const res = await fetch(`/api/music/album/${encodeURIComponent(albumId)}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return null;
    }
  }

  public async getLyrics(trackId: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/music/lyrics/${encodeURIComponent(trackId)}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.lyrics || null;
    } catch {
      return null;
    }
  }

  public async saveLyrics(trackId: string, lyrics: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/music/lyrics/${encodeURIComponent(trackId)}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ lyrics }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async getPlaylists(): Promise<any[]> {
    try {
      const res = await fetch('/api/music/playlists', { headers: this.getHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.playlists || [];
    } catch {
      return [];
    }
  }

  public async createPlaylist(params: {
    title: string;
    description?: string;
    coverUrl?: string;
    initialTracks?: any[];
  }): Promise<any> {
    try {
      const res = await fetch('/api/music/playlists', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return null;
    }
  }

  public async deletePlaylist(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/music/playlists/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const musicApi = new MusicApiClient();
