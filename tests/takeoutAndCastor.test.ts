import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  redactSecretsAegis,
  matchTakeoutSidecar,
  dedupePhotoAssets,
  parseCastorOrTakeoutRecords,
  exportToPolluxJsonl,
  exportToPolluxHtml,
} from '../src/services/takeoutAndCastorEngine.ts';
import type { MediaAsset } from '../src/types/index.ts';

function makeAsset(id: string, name: string, sizeBytes: number): MediaAsset {
  return {
    id,
    name,
    source: 'photos',
    category: 'image',
    mimeType: 'image/jpeg',
    extension: 'JPG',
    path: `Google Photos/${name}`,
    sizeBytes,
    modifiedTime: '2026-11-18T00:00:00Z',
    thumbnailUrl: '',
    isCached: false,
    cullingStatus: 'unrated',
    rating: 0,
    tags: [],
    faces: [],
    quality: { sharpness: 90, exposure: 90, overall: 90, isBlurry: false },
    palette: [],
    exif: {},
  };
}

describe('Castor & Pollux × Drive Therapy Universal Takeout & Multi-Batch Picker', () => {
  it('redacts API keys, Bearer tokens, and OAuth secrets via Aegis', () => {
    const res = redactSecretsAegis(
      'key=AIzaSyDummyKey12345678901234567890 auth=Bearer ya29.testtoken123456789012345'
    );
    assert.ok(res.redactedCount >= 2);
    assert.equal(res.text.includes('AIzaSy'), false);
    assert.equal(res.text.includes('ya29.'), false);
  });

  it('matches both legacy .json and modern .supplemental-metadata.json Takeout sidecars', () => {
    const sidecars = new Map<string, any>([
      ['img_001.jpg.supplemental-metadata', { photoTakenTime: { timestamp: '1700000000' } }],
      ['img_002.jpg', { photoTakenTime: { timestamp: '1700000100' } }],
    ]);
    assert.equal(matchTakeoutSidecar('IMG_001.JPG', sidecars)?.photoTakenTime?.timestamp, '1700000000');
    assert.equal(matchTakeoutSidecar('IMG_002.JPG', sidecars)?.photoTakenTime?.timestamp, '1700000100');
  });

  it('deduplicates multi-batch Google Photos Picker items by ID and fingerprint', () => {
    const existing = [makeAsset('p1', 'sunset.jpg', 1024), makeAsset('p2', 'beach.jpg', 2048)];
    const incoming = [
      makeAsset('p1', 'sunset.jpg', 1024),
      makeAsset('p2_dup', 'beach.jpg', 2048),
      makeAsset('p3', 'mountain.jpg', 4096),
    ];
    const { unique, skippedDuplicates } = dedupePhotoAssets(existing, incoming);
    assert.equal(unique.length, 1);
    assert.equal(unique[0].id, 'p3');
    assert.equal(skippedDuplicates, 2);
  });

  it('parses Gemini Takeout, AI Studio, Antigravity transcript.jsonl & Castor JSONL and exports Pollux HTML/JSONL', () => {
    const agyJsonl = [
      JSON.stringify({ step_index: 1, type: 'USER_INPUT', content: 'Inspect token AIzaSySecretKey1234567890123456789' }),
      JSON.stringify({ step_index: 2, type: 'PLANNER_RESPONSE', content: 'Verified <script>safe</script> pipeline' }),
    ].join('\n');
    const agyRecords = parseCastorOrTakeoutRecords(agyJsonl, 'transcript.jsonl');
    assert.equal(agyRecords.length, 1);
    assert.equal(agyRecords[0].source, 'antigravity');
    assert.equal(agyRecords[0].prompt.includes('AIzaSy'), false);
    assert.ok(agyRecords[0].redactedCount >= 1);

    const aiStudioJson = JSON.stringify({
      runSettings: { model: 'gemini-2.5-flash' },
      chunkedPrompt: {
        chunks: [
          { role: 'user', text: 'Summarize shoot' },
          { role: 'model', text: '12 hero frames picked' },
        ],
      },
    });
    const studioRecords = parseCastorOrTakeoutRecords(aiStudioJson, 'studio.json');
    assert.equal(studioRecords.length, 1);
    assert.equal(studioRecords[0].source, 'ai-studio');

    const geminiTakeoutJson = JSON.stringify([
      { header: 'Gemini Apps', title: 'Prompted Organize photos', time: '2026-11-18T00:00:00Z', safeHtmlItem: [{ html: '<p>Grouped by burst</p>' }] },
    ]);
    const geminiRecords = parseCastorOrTakeoutRecords(geminiTakeoutJson, 'MyActivity.json');
    assert.equal(geminiRecords.length, 1);
    assert.equal(geminiRecords[0].source, 'takeout-gemini');

    const jsonl = exportToPolluxJsonl([...agyRecords, ...studioRecords, ...geminiRecords]);
    assert.equal(jsonl.split('\n').length, 3);

    const html = exportToPolluxHtml(agyRecords, 'Test Pollux');
    assert.equal(html.includes('<script>safe'), false);
    assert.ok(html.includes('&lt;script&gt;safe&lt;/script&gt;'));
  });

  it('server.ts protects /api/takeout/* routes with isLoopbackRequest', () => {
    const srv = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
    assert.ok(srv.includes("app.post('/api/takeout/scan-folder'"));
    assert.ok(srv.includes("app.post('/api/takeout/save-archive'"));
  });
});
