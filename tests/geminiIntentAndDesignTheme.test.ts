import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectGeminiChatIntent,
  mapPromptToPhotosCategories,
} from '../src/services/geminiIntentRouter';
import { detectRequestedArtStyle } from '../src/services/localImageStylizer';
import {
  buildGeminiWorkspaceSnapshot,
  formatWorkspaceSystemPrompt,
} from '../src/services/geminiWorkspaceContext';
import { APP_THEMES, DEDICATED_NIGHT_THEME_IDS } from '../src/services/themeEngine';

describe('Gemini Multi-Tool Intent Router, Mounted OS Telemetry & Gemini Design Theme', () => {
  it('routes "find a picture of a cat in my google photos" to google_photos_search with PETS/ANIMALS categories', () => {
    const intent = detectGeminiChatIntent('find a picture of a cat in my google photos');
    assert.equal(intent.type, 'google_photos_search');
    assert.equal(intent.extractedQuery, 'cat');
    assert.ok(intent.photosCategories.includes('PETS'));
    assert.ok(intent.photosCategories.includes('ANIMALS'));
  });

  it('routes "please locate copies of my resume in google drive" to google_drive_search for "resume"', () => {
    const intent = detectGeminiChatIntent('please locate copies of my resume in google drive');
    assert.equal(intent.type, 'google_drive_search');
    assert.equal(intent.extractedQuery, 'resume');
  });

  it('routes "make the selected photo anime style" to image_style_transfer with anime preset', () => {
    const intent = detectGeminiChatIntent('make the selected photo anime style', true);
    assert.equal(intent.type, 'image_style_transfer');
    assert.equal(intent.artStyle, 'anime');
    assert.equal(detectRequestedArtStyle('turn this into a watercolor painting'), 'watercolor');
    assert.equal(detectRequestedArtStyle('cyberpunk neon look'), 'cyberpunk');
  });

  it('enforces Sacred Non-Destructive Integrity on silent delete/overwrite prompts', () => {
    const intent = detectGeminiChatIntent('delete all blurry photos from my drive');
    assert.equal(intent.type, 'destructive_guard');
  });

  it('maps natural-language concepts to Google Photos content categories', () => {
    assert.ok(mapPromptToPhotosCategories('sunset mountain landscape').includes('LANDSCAPES'));
    assert.ok(mapPromptToPhotosCategories('tax receipt scan').includes('RECEIPTS'));
  });

  it('tracks live mounted vs unindexed host OS locations in workspace snapshot & prompt', () => {
    const snapshot = buildGeminiWorkspaceSnapshot({
      allAssets: [],
      folders: [{ id: 'loc_pic', name: 'Pictures', source: 'local', path: '/home/user/Pictures', itemCount: 12 }],
      mountedOsLocations: [
        { id: 'pictures', name: 'Pictures', path: '/home/user/Pictures' },
        { id: 'documents', name: 'Documents', path: '/home/user/Documents' },
      ],
      oauthToken: null,
    });

    assert.equal(snapshot.storage.mountedOsLocations.length, 2);
    assert.equal(snapshot.storage.mountedOsLocations[0].isIndexed, true);
    assert.equal(snapshot.storage.mountedOsLocations[1].isIndexed, false);

    const sysPrompt = formatWorkspaceSystemPrompt(snapshot);
    assert.ok(sysPrompt.includes('Live Mounted OS Locations:'));
    assert.ok(sysPrompt.includes('Pictures (/home/user/Pictures) [indexed]'));
    assert.ok(sysPrompt.includes('Documents (/home/user/Documents) [mounted-unindexed]'));
  });

  it('registers the Gemini Design theme from Google Design guidelines with AAA obsidian palette', () => {
    const geminiTheme = APP_THEMES.find((t) => t.id === 'gemini-design');
    assert.ok(geminiTheme, 'gemini-design theme must be registered in APP_THEMES');
    assert.equal(geminiTheme.nameKey, 'Gemini Design');
    assert.equal(geminiTheme.background, '#000000');
    assert.equal(geminiTheme.text, '#FFFFFF');
    assert.equal(geminiTheme.border, '#32302A');
    assert.equal(geminiTheme.isDark, true);
    assert.ok(DEDICATED_NIGHT_THEME_IDS.has('gemini-design'));
  });
});
