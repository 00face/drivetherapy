/**
 * gifService.ts - Multi-provider GIF Search Service
 * Supports Tenor (Google), GIPHY, and KLIPY with offline curated fallback library.
 */

export interface GifResult {
  id: string;
  title: string;
  url: string;
  previewUrl?: string;
  provider?: Provider;
  dims?: { width: number; height: number };
}

export type Provider = 'tenor' | 'giphy' | 'klipy';

// Curated offline library for instant previews & zero-key offline reliability
export const CURATED_OFFLINE_GIFS: GifResult[] = [
  {
    id: 'offline-celebrate-1',
    title: 'Drive Therapy - Cheers & Celebration',
    url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/200w.gif',
    provider: 'tenor'
  },
  {
    id: 'offline-applause-2',
    title: 'Standing Ovation & Applause',
    url: 'https://media.giphy.com/media/ytTYwIlbD1FBu/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/ytTYwIlbD1FBu/200w.gif',
    provider: 'tenor'
  },
  {
    id: 'offline-coding-3',
    title: 'Hacker Fast Typing Code',
    url: 'https://media.giphy.com/media/ule4akeXnY9Fb4bcN3/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/ule4akeXnY9Fb4bcN3/200w.gif',
    provider: 'giphy'
  },
  {
    id: 'offline-cat-4',
    title: 'Bongo Cat Jamming',
    url: 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/200w.gif',
    provider: 'klipy'
  },
  {
    id: 'offline-mindblown-5',
    title: 'Mind Blown Cosmic Explosion',
    url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w.gif',
    provider: 'tenor'
  },
  {
    id: 'offline-camera-6',
    title: 'Photographer Studio Flash',
    url: 'https://media.giphy.com/media/l41JGlwa1xYhkVczW/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/l41JGlwa1xYhkVczW/200w.gif',
    provider: 'giphy'
  },
  {
    id: 'offline-fire-7',
    title: 'This is Fine / Fire',
    url: 'https://media.giphy.com/media/QMHoU66sBXCAU/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/QMHoU66sBXCAU/200w.gif',
    provider: 'tenor'
  },
  {
    id: 'offline-dance-8',
    title: 'Dance Happy Party',
    url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/blSTtZehjAZ8I/200w.gif',
    provider: 'klipy'
  }
];

export class GifAPI {
  private apiKey: string;
  private provider: Provider;

  constructor(provider: Provider = 'tenor', apiKey: string = '') {
    this.provider = provider;
    this.apiKey = apiKey;
  }

  setProvider(provider: Provider, apiKey?: string) {
    this.provider = provider;
    if (apiKey !== undefined) {
      this.apiKey = apiKey;
    }
  }

  getProvider(): Provider {
    return this.provider;
  }

  async search(query: string, limit: number = 12): Promise<GifResult[]> {
    const trimmed = (query || '').trim();

    // If no API key provided or empty query, search/return curated fallback library
    if (!this.apiKey) {
      if (!trimmed) {
        return CURATED_OFFLINE_GIFS.slice(0, limit);
      }
      const lower = trimmed.toLowerCase();
      const filtered = CURATED_OFFLINE_GIFS.filter(g => 
        g.title.toLowerCase().includes(lower) || g.id.toLowerCase().includes(lower)
      );
      return filtered.length > 0 ? filtered.slice(0, limit) : CURATED_OFFLINE_GIFS.slice(0, limit);
    }

    const encodedQuery = encodeURIComponent(trimmed);
    let url = '';

    switch (this.provider) {
      case 'giphy':
        url = `https://api.giphy.com/v1/gifs/search?api_key=${this.apiKey}&q=${encodedQuery}&limit=${limit}`;
        break;
      case 'tenor':
        url = `https://tenor.googleapis.com/v2/search?key=${this.apiKey}&q=${encodedQuery}&limit=${limit}&media_filter=gif,tinygif`;
        break;
      case 'klipy':
        url = `https://api.klipy.com/api/v1/${this.apiKey}/gifs/search?q=${encodedQuery}&per_page=${limit}`;
        break;
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const data = await response.json();
      const results = this.normalizeResponse(data);
      if (results.length === 0) {
        return CURATED_OFFLINE_GIFS.slice(0, limit);
      }
      return results;
    } catch {
      // Fallback gracefully to offline curated collection on network/quota error
      return CURATED_OFFLINE_GIFS.slice(0, limit);
    }
  }

  normalizeResponse(data: unknown): GifResult[] {
    if (!data || typeof data !== 'object') return [];
    const record = data as Record<string, unknown>;

    if (this.provider === 'giphy') {
      const list = Array.isArray(record.data) ? record.data : [];
      return list.map((gif: any): GifResult => {
        const images = (gif.images || {}) as Record<string, Record<string, string>>;
        return {
          id: String(gif.id || Math.random()),
          title: String(gif.title || 'GIPHY'),
          url: images.original?.url || images.downsized?.url || '',
          previewUrl: images.fixed_height_small?.url || images.preview_gif?.url || images.original?.url,
          provider: 'giphy'
        };
      }).filter((g: GifResult) => !!g.url);
    }

    if (this.provider === 'tenor') {
      const list = Array.isArray(record.results) ? record.results : [];
      return list.map((gif: any): GifResult => {
        const media = (gif.media_formats || {}) as Record<string, Record<string, string>>;
        return {
          id: String(gif.id || Math.random()),
          title: String(gif.content_description || gif.title || 'Tenor GIF'),
          url: media.gif?.url || media.mediumgif?.url || '',
          previewUrl: media.tinygif?.url || media.nanogif?.url || media.gif?.url,
          provider: 'tenor'
        };
      }).filter((g: GifResult) => !!g.url);
    }

    if (this.provider === 'klipy') {
      const list = Array.isArray(record.data) ? record.data : [];
      return list.map((gif: any): GifResult => {
        const files = (gif.files || {}) as Record<string, Record<string, string>>;
        return {
          id: String(gif.id || Math.random()),
          title: String(gif.title || 'KLIPY GIF'),
          url: files.original?.url || files.gif?.url || '',
          previewUrl: files.preview?.url || files.original?.url,
          provider: 'klipy'
        };
      }).filter((g: GifResult) => !!g.url);
    }

    return [];
  }
}

// Global default singleton with Tenor default
export const defaultGifService = new GifAPI('tenor');
