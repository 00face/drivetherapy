import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GifAPI, defaultGifService, CURATED_OFFLINE_GIFS } from '../src/services/gifService';

describe('GIF Search API Service', () => {
  test('normalizes Tenor API format correctly', () => {
    const api = new GifAPI('tenor', 'mock-key');
    const mockTenorResponse = {
      results: [
        {
          id: 'tenor-1',
          content_description: 'Celebration Confetti',
          media_formats: {
            gif: { url: 'https://media.tenor.com/confetti.gif' },
            tinygif: { url: 'https://media.tenor.com/confetti-tiny.gif' }
          }
        }
      ]
    };

    const normalized = api.normalizeResponse(mockTenorResponse);
    assert.strictEqual(normalized.length, 1);
    assert.strictEqual(normalized[0].id, 'tenor-1');
    assert.strictEqual(normalized[0].title, 'Celebration Confetti');
    assert.strictEqual(normalized[0].url, 'https://media.tenor.com/confetti.gif');
    assert.strictEqual(normalized[0].previewUrl, 'https://media.tenor.com/confetti-tiny.gif');
    assert.strictEqual(normalized[0].provider, 'tenor');
  });

  test('normalizes GIPHY API format correctly', () => {
    const api = new GifAPI('giphy', 'mock-key');
    const mockGiphyResponse = {
      data: [
        {
          id: 'giphy-1',
          title: 'Dancing Cat',
          images: {
            original: { url: 'https://media.giphy.com/cat.gif' },
            fixed_height_small: { url: 'https://media.giphy.com/cat-small.gif' }
          }
        }
      ]
    };

    const normalized = api.normalizeResponse(mockGiphyResponse);
    assert.strictEqual(normalized.length, 1);
    assert.strictEqual(normalized[0].id, 'giphy-1');
    assert.strictEqual(normalized[0].title, 'Dancing Cat');
    assert.strictEqual(normalized[0].url, 'https://media.giphy.com/cat.gif');
    assert.strictEqual(normalized[0].previewUrl, 'https://media.giphy.com/cat-small.gif');
    assert.strictEqual(normalized[0].provider, 'giphy');
  });

  test('normalizes KLIPY API format correctly', () => {
    const api = new GifAPI('klipy', 'mock-key');
    const mockKlipyResponse = {
      data: [
        {
          id: 'klipy-1',
          title: 'Applause High Five',
          files: {
            original: { url: 'https://media.klipy.com/applause.gif' },
            preview: { url: 'https://media.klipy.com/applause-preview.gif' }
          }
        }
      ]
    };

    const normalized = api.normalizeResponse(mockKlipyResponse);
    assert.strictEqual(normalized.length, 1);
    assert.strictEqual(normalized[0].id, 'klipy-1');
    assert.strictEqual(normalized[0].title, 'Applause High Five');
    assert.strictEqual(normalized[0].url, 'https://media.klipy.com/applause.gif');
    assert.strictEqual(normalized[0].previewUrl, 'https://media.klipy.com/applause-preview.gif');
    assert.strictEqual(normalized[0].provider, 'klipy');
  });

  test('falls back to offline curated library when no API key is set', async () => {
    const api = new GifAPI('tenor', '');
    const results = await api.search('');
    assert.ok(results.length > 0);
    assert.strictEqual(results[0].id, CURATED_OFFLINE_GIFS[0].id);

    const filtered = await api.search('coding');
    assert.ok(filtered.length > 0);
    assert.strictEqual(filtered.some(g => g.title.toLowerCase().includes('coding') || g.id.includes('coding')), true);
  });

  test('allows switching provider dynamically', () => {
    const api = new GifAPI('tenor');
    assert.strictEqual(api.getProvider(), 'tenor');
    api.setProvider('giphy');
    assert.strictEqual(api.getProvider(), 'giphy');
    api.setProvider('klipy');
    assert.strictEqual(api.getProvider(), 'klipy');
  });
});
