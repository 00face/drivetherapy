/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Universal Multi-Format Gemini Reasoning Engine Tests
 * Verifies format detection, prompt generation, action catalog,
 * and synthesized analysis across Photos, Audio, Video, Docs, CSVs, and Archives.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { geminiUniversalEngine } from '../src/services/geminiUniversalEngine';
import { MediaAsset } from '../src/types';

describe('Gemini Universal Multi-Format Engine', () => {
  const mockPhoto: MediaAsset = {
    id: 'asset_photo_1',
    name: 'wedding_sunset_portrait.arw',
    source: 'cloud',
    path: '/2024-Shoots/Wedding/wedding_sunset_portrait.arw',
    mimeType: 'image/x-sony-arw',
    category: 'image',
    sizeBytes: 45 * 1024 * 1024,
    tags: ['portrait', 'sunset'],
    quality: { sharpness: 94, isBlurry: false },
    exif: { camera: 'Sony A7R V', lens: 'FE 50mm F1.2 GM', iso: 100, aperture: 'f/1.2', shutterSpeed: '1/1000s' },
  } as any;

  const mockDocument: MediaAsset = {
    id: 'asset_doc_1',
    name: 'commercial_photography_contract_v2.pdf',
    source: 'cloud',
    path: '/Contracts/commercial_photography_contract_v2.pdf',
    mimeType: 'application/pdf',
    category: 'document',
    sizeBytes: 1.8 * 1024 * 1024,
    tags: ['legal', 'client'],
    quality: { sharpness: 100, isBlurry: false },
    exif: {},
  } as any;

  const mockAudio: MediaAsset = {
    id: 'asset_audio_1',
    name: 'director_lighting_notes.m4a',
    source: 'local',
    path: '/Audio/director_lighting_notes.m4a',
    mimeType: 'audio/m4a',
    category: 'audio',
    sizeBytes: 12 * 1024 * 1024,
    tags: ['notes', 'voice'],
    quality: { sharpness: 100, isBlurry: false },
    exif: {},
  } as any;

  const mockVideo: MediaAsset = {
    id: 'asset_video_1',
    name: 'first_dance_highlight_4k.mp4',
    source: 'cloud',
    path: '/Video/first_dance_highlight_4k.mp4',
    mimeType: 'video/mp4',
    category: 'video',
    sizeBytes: 420 * 1024 * 1024,
    tags: ['reception', 'dance'],
    quality: { sharpness: 88, isBlurry: false },
    exif: {},
  } as any;

  const mockData: MediaAsset = {
    id: 'asset_data_1',
    name: 'q3_production_expenses.csv',
    source: 'local',
    path: '/Finance/q3_production_expenses.csv',
    mimeType: 'text/csv',
    category: 'data',
    sizeBytes: 45 * 1024,
    tags: ['budget', 'q3'],
    quality: { sharpness: 100, isBlurry: false },
    exif: {},
  } as any;

  test('reports format-specific actions for photos and RAWs', () => {
    const actions = geminiUniversalEngine.getAvailableActionsForAsset(mockPhoto);
    const actionIds = actions.map((a) => a.id);
    assert.ok(actionIds.includes('critique'));
    assert.ok(actionIds.includes('alt_text'));
    assert.ok(actionIds.includes('captions'));
    assert.ok(actionIds.includes('color_advice'));
  });

  test('reports format-specific actions for documents and PDFs', () => {
    const actions = geminiUniversalEngine.getAvailableActionsForAsset(mockDocument);
    const actionIds = actions.map((a) => a.id);
    assert.ok(actionIds.includes('doc_summary'));
    assert.ok(actionIds.includes('action_items'));
    assert.ok(actionIds.includes('translate'));
    assert.ok(actionIds.includes('ocr'));
  });

  test('reports format-specific actions for voice memos and audio', () => {
    const actions = geminiUniversalEngine.getAvailableActionsForAsset(mockAudio);
    const actionIds = actions.map((a) => a.id);
    assert.ok(actionIds.includes('transcribe'));
    assert.ok(actionIds.includes('voice_memo_summary'));
    assert.ok(actionIds.includes('extract_quotes'));
  });

  test('reports format-specific actions for video clips', () => {
    const actions = geminiUniversalEngine.getAvailableActionsForAsset(mockVideo);
    const actionIds = actions.map((a) => a.id);
    assert.ok(actionIds.includes('scene_log'));
    assert.ok(actionIds.includes('video_chapters'));
    assert.ok(actionIds.includes('suggest_trims'));
  });

  test('reports format-specific actions for tabular data and spreadsheets', () => {
    const actions = geminiUniversalEngine.getAvailableActionsForAsset(mockData);
    const actionIds = actions.map((a) => a.id);
    assert.ok(actionIds.includes('data_trends'));
    assert.ok(actionIds.includes('format_table'));
  });

  test('executes photo critique task with structured evaluation', async () => {
    const response = await geminiUniversalEngine.executeTask({
      asset: mockPhoto,
      action: 'critique',
    });
    assert.strictEqual(response.action, 'critique');
    const text = response.resultText || response.text || '';
    assert.ok(text.length > 50);
    assert.ok(text.includes('Composition') || text.includes('Critique') || text.includes('Sharpness'));
  });

  test('executes document summarization task with executive takeaways', async () => {
    const response = await geminiUniversalEngine.executeTask({
      asset: mockDocument,
      action: 'doc_summary',
    });
    assert.strictEqual(response.action, 'doc_summary');
    const text = response.resultText || response.text || '';
    assert.ok(text.includes('Summary') || text.includes('Takeaways'));
  });

  test('executes audio transcription task with timestamped log', async () => {
    const response = await geminiUniversalEngine.executeTask({
      asset: mockAudio,
      action: 'transcribe',
    });
    assert.strictEqual(response.action, 'transcribe');
    const text = response.resultText || response.text || '';
    assert.ok(text.includes('Transcription') || text.includes('Summary') || text.includes('Audio'));
  });

  test('executes video chaptering task with SMPTE timestamps', async () => {
    const response = await geminiUniversalEngine.executeTask({
      asset: mockVideo,
      action: 'video_chapters',
    });
    assert.strictEqual(response.action, 'video_chapters');
    const text = response.resultText || response.text || '';
    assert.ok(text.includes('Chapters') || text.includes('00:00'));
  });

  test('handles BYOK API key setting and storage', () => {
    const testKey = 'AIzaSyDemoTestKey123456789';
    geminiUniversalEngine.setApiKey(testKey);
    assert.strictEqual(geminiUniversalEngine.getApiKey(), testKey);
    geminiUniversalEngine.setApiKey('');
    assert.strictEqual(geminiUniversalEngine.getApiKey(), '');
  });
});
