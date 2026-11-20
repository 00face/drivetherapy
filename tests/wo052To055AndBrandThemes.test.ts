import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { APP_THEMES, DEDICATED_NIGHT_THEME_IDS } from '../src/services/themeEngine.ts';
import {
  EARTH_VIEW_IDS,
  LOCAL_EARTH_VIEW_FALLBACKS,
  getEarthViewImageUrl,
} from '../src/services/earthViewCatalog.ts';
import { GOOGLE_BRAND_BACKDROP_IDS } from '../src/components/GoogleBrandBackdrop.tsx';
import { buildFfmpegHlsArgs, getHlsPlaylistUrl } from '../src/services/hlsStreamingEngine.ts';
import {
  createInitialCollabRoomState,
  applyCollabMessage,
} from '../src/services/webrtcCullingSync.ts';
import {
  signWebhookPayload,
  verifyWebhookSignature,
  buildExportCompleteCardV2,
  buildCullingSummaryCardV2,
} from '../src/services/workspaceWebhookMesh.ts';
import { evaluateSwipeGesture } from '../src/services/mobileTouchGestures.ts';
import {
  saveOfflineSyncQueue,
  enqueueOfflineMutation,
  flushOfflineSyncQueue,
} from '../src/services/pwaSyncManager.ts';

describe('[WO-095 / WO-096] Authentic Google Originals & Brand Themes', () => {
  const expectedBrandThemeIds = [
    'google-cloud',
    'google-earth',
    'google-chrome',
    'google-tilt-brush',
    'google-stadia',
    'google-sky',
    'google-firebase',
    'google-android',
    'google-youtube',
    'google-search',
    'google-pay',
    'google-ads',
    'google-analytics',
    'google-marketing-platform',
    'google-play',
    'google-play-games',
    'google-maps',
    'google-notebooklm',
    'workspace-docs',
    'workspace-sheets',
    'workspace-slides',
    'workspace-keep',
    'workspace-meet',
    'workspace-photos',
    'workspace-calendar',
    'google-forms',
    'google-classroom',
  ];

  it('registers all 27 Google Originals & Workspace themes with valid provenance', () => {
    const themeMap = new Map(APP_THEMES.map((t) => [t.id, t]));
    const validTypes = new Set(['original-wallpaper', 'official-promo', 'brand-kit-palette']);
    for (const id of expectedBrandThemeIds) {
      const theme = themeMap.get(id);
      assert.ok(theme, `Missing expected Google Originals theme: ${id}`);
      assert.ok(theme.nameKey.length > 0, `Theme ${id} must have a non-empty nameKey`);
      assert.ok(theme.accent.startsWith('#'), `Theme ${id} accent must be hex color`);
      assert.equal(theme.brandGroup, 'google-originals', `Theme ${id} must belong to google-originals`);
      assert.ok(theme.assetType && validTypes.has(theme.assetType), `Theme ${id} must have valid assetType`);
    }
  });

  it('verifies every local wallpaperUrl and brandLogoUrl resolves on disk and manifest.json has SHA-256 receipts', () => {
    const publicDir = path.resolve(process.cwd(), 'public');
    const originals = APP_THEMES.filter((t) => t.brandGroup === 'google-originals');
    assert.ok(originals.length >= 27);

    for (const theme of originals) {
      if (theme.wallpaperUrl?.startsWith('/')) {
        const filePath = path.join(publicDir, theme.wallpaperUrl);
        assert.ok(fs.existsSync(filePath), `Missing wallpaper file on disk for ${theme.id}: ${filePath}`);
      }
      if (theme.brandLogoUrl?.startsWith('/')) {
        const logoPath = path.join(publicDir, theme.brandLogoUrl);
        assert.ok(fs.existsSync(logoPath), `Missing brand logo file on disk for ${theme.id}: ${logoPath}`);
      }
    }

    const manifestPath = path.join(publicDir, 'themes/originals/manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'Expected public/themes/originals/manifest.json to exist');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.ok(manifest.verifiedCount >= 25, `Expected >=25 verified original assets, got ${manifest.verifiedCount}`);
    assert.ok(
      manifest.records.some((r: { id: string; sha256?: string }) => r.id === 'google-earth-view' && Boolean(r.sha256)),
      'Expected SHA-256 receipt for google-earth-view'
    );
  });

  it('marks dark Google Originals themes in DEDICATED_NIGHT_THEME_IDS', () => {
    const expectedDark = [
      'google-firebase',
      'google-play-games',
      'google-android',
      'google-youtube',
      'google-notebooklm',
      'google-tilt-brush',
      'google-stadia',
      'google-earth',
      'google-maps',
      'google-search',
      'google-marketing-platform',
      'workspace-meet',
    ];
    for (const id of expectedDark) {
      assert.ok(
        DEDICATED_NIGHT_THEME_IDS.has(id),
        `Dark brand theme ${id} should be in DEDICATED_NIGHT_THEME_IDS`
      );
    }
  });

  it('enforces WCAG 2.1 AAA text (>=7.0:1) and AA accent (>=4.5:1) contrast on all 27 Google Originals + Gemini Design', () => {
    const hexToRgb = (h: string): [number, number, number] | null => {
      const m = h.trim().match(/^#([0-9a-f]{6})$/i);
      if (!m) return null;
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const parseColor = (c: string, bg: [number, number, number]): [number, number, number] => {
      const h = hexToRgb(c);
      if (h) return h;
      const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m) return bg;
      const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
      return [
        Math.round(parseInt(m[1], 10) * a + bg[0] * (1 - a)),
        Math.round(parseInt(m[2], 10) * a + bg[1] * (1 - a)),
        Math.round(parseInt(m[3], 10) * a + bg[2] * (1 - a)),
      ];
    };
    const luminance = ([r, g, b]: [number, number, number]) => {
      const [rs, gs, bs] = [r, g, b].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };
    const contrast = (a: [number, number, number], b: [number, number, number]) => {
      const l1 = luminance(a);
      const l2 = luminance(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };

    const targets = APP_THEMES.filter(
      (t) => t.brandGroup === 'google-originals' || t.id === 'gemini-design'
    );
    assert.ok(targets.length >= 28);
    for (const t of targets) {
      const bg = hexToRgb(t.background) || [255, 255, 255];
      const surf = parseColor(t.surface, bg);
      const txt = parseColor(t.text, bg);
      const acc = parseColor(t.accent, bg);
      const txtRatio = contrast(txt, surf);
      const accRatio = contrast(acc, surf);
      assert.ok(
        txtRatio >= 7.0,
        `Theme ${t.id} text/surface contrast ${txtRatio.toFixed(2)}:1 is below 7.0:1 AAA`
      );
      assert.ok(
        accRatio >= 4.5,
        `Theme ${t.id} accent/surface contrast ${accRatio.toFixed(2)}:1 is below 4.5:1 AA`
      );
      if (t.brandGroup === 'google-originals') {
        assert.ok(
          Boolean(t.wallpaperUrl) || GOOGLE_BRAND_BACKDROP_IDS.has(t.id),
          `Theme ${t.id} must have either a wallpaperUrl or a GoogleBrandBackdrop`
        );
      }
    }
  });

  it('ships full deduplicated Earth View catalog (>=1500 IDs) and verified offline fallback JPEGs', () => {
    assert.ok(EARTH_VIEW_IDS.length >= 1500, `Expected >=1500 Earth View IDs, got ${EARTH_VIEW_IDS.length}`);
    assert.equal(getEarthViewImageUrl(1893), 'https://www.gstatic.com/prettyearth/assets/full/1893.jpg');
    const publicDir = path.resolve(process.cwd(), 'public');
    for (const fallback of LOCAL_EARTH_VIEW_FALLBACKS) {
      assert.ok(
        fs.existsSync(path.join(publicDir, fallback)),
        `Missing local Earth View fallback on disk: ${fallback}`
      );
    }
  });

  it('[WO-098] isolates ambient theme backdrops behind static chrome and themes secondary header', () => {
    const root = process.cwd();
    const backdrops = [
      'src/components/GoogleBrandBackdrop.tsx',
      'src/components/GeminiDesignBackground.tsx',
      'src/components/LabsThemeBackground.tsx',
    ];
    for (const rel of backdrops) {
      const content = fs.readFileSync(path.join(root, rel), 'utf8');
      assert.ok(content.includes('-z-10'), `${rel} must use -z-10 to stay behind all app chrome`);
      assert.ok(!content.includes('fixed inset-0 pointer-events-none overflow-hidden z-0'), `${rel} must not use z-0 over static chrome`);
    }
    const ribbon = fs.readFileSync(path.join(root, 'src/components/QuickAccessRibbon.tsx'), 'utf8');
    assert.ok(ribbon.includes('relative z-20 secondary-header-container'), 'QuickAccessRibbon must have relative z-20 secondary-header-container');
    const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
    assert.ok(app.includes('relative isolate'), 'App root shell must use isolate for -z-10 backdrops');
  });
});

describe('[WO-052] Adaptive HLS Transcode Engine', () => {
  it('builds valid FFmpeg HLS arguments with .m3u8 playlist and seg_%04d.ts chunks', () => {
    const args = buildFfmpegHlsArgs({
      inputSource: '/tmp/clip_4k.mp4',
      outputDir: '/tmp/hls-job-1',
      segmentDurationSec: 4,
      maxHeight: 1080,
    });
    assert.ok(args.includes('-i'));
    assert.ok(args.includes('/tmp/clip_4k.mp4'));
    assert.ok(args.includes('libx264'));
    assert.ok(args.includes('/tmp/hls-job-1/seg_%04d.ts'));
    assert.equal(args[args.length - 1], '/tmp/hls-job-1/index.m3u8');
  });

  it('formats encoded HLS playlist URLs', () => {
    assert.equal(getHlsPlaylistUrl('hls_123'), '/api/media/hls/hls_123/index.m3u8');
  });
});

describe('[WO-053] Collaborative Multi-User Culling & WebRTC Studio Sync', () => {
  it('merges peer_join, cursor_move, cull_vote, and peer_leave into room state', () => {
    let state = createInitialCollabRoomState('studio-alpha');
    state = applyCollabMessage(state, {
      roomId: 'studio-alpha',
      peerId: 'peer-1',
      peerName: 'Lead Photographer',
      type: 'peer_join',
      timestamp: 1000,
    });
    assert.equal(state.peers['peer-1']?.peerName, 'Lead Photographer');

    state = applyCollabMessage(state, {
      roomId: 'studio-alpha',
      peerId: 'peer-1',
      peerName: 'Lead Photographer',
      type: 'cursor_move',
      timestamp: 1100,
      payload: { x: 42, y: 68 },
    });
    assert.deepEqual(state.peers['peer-1']?.cursor, { x: 42, y: 68 });

    state = applyCollabMessage(state, {
      roomId: 'studio-alpha',
      peerId: 'peer-1',
      peerName: 'Lead Photographer',
      type: 'cull_vote',
      timestamp: 1200,
      payload: { assetId: 'img-99', status: 'picked' },
    });
    assert.equal(state.votes['img-99']?.['peer-1'], 'picked');

    state = applyCollabMessage(state, {
      roomId: 'studio-alpha',
      peerId: 'peer-1',
      peerName: 'Lead Photographer',
      type: 'peer_leave',
      timestamp: 1300,
    });
    assert.equal(state.peers['peer-1'], undefined);
  });
});

describe('[WO-054] Google Workspace Bot Gateway & Webhook Event Mesh', () => {
  it('signs and verifies HMAC-SHA256 webhook payloads', async () => {
    const secret = 'studio-webhook-secret-key';
    const body = JSON.stringify({ event: 'export_complete', count: 24 });
    const sig = await signWebhookPayload(secret, body);
    assert.ok(sig.startsWith('sha256='));
    assert.equal(await verifyWebhookSignature(secret, body, sig), true);
    assert.equal(await verifyWebhookSignature(secret, body + 'tampered', sig), false);
    assert.equal(await verifyWebhookSignature('wrong-secret', body, sig), false);
  });

  it('builds valid Google Chat Card V2 payloads for export & culling summaries', () => {
    const exportCard = buildExportCompleteCardV2({
      projectName: 'Autumn Lookbook',
      exportedCount: 48,
      presetName: 'Client Proof WebP',
      driveFolderUrl: 'https://drive.google.com/drive/folders/abc123',
    });
    assert.equal(exportCard.cardsV2.length, 1);
    assert.ok(exportCard.cardsV2[0].card.header.title.includes('Autumn Lookbook'));

    const cullCard = buildCullingSummaryCardV2({
      projectName: 'Editorial Shoot',
      pickedCount: 18,
      rejectedCount: 42,
      totalCount: 60,
    });
    assert.equal(cullCard.cardsV2.length, 1);
    assert.ok(cullCard.cardsV2[0].card.header.title.includes('Editorial Shoot'));
  });
});

describe('[WO-055] Mobile Touch Ergonomics & Offline PWA Sync', () => {
  it('classifies directional swipes and ignores short taps', () => {
    assert.equal(
      evaluateSwipeGesture({ x: 100, y: 200, timestamp: 1000 }, { x: 240, y: 210, timestamp: 1180 })
        .direction,
      'swipe-right'
    );
    assert.equal(
      evaluateSwipeGesture({ x: 240, y: 200, timestamp: 1000 }, { x: 100, y: 195, timestamp: 1180 })
        .direction,
      'swipe-left'
    );
    assert.equal(
      evaluateSwipeGesture({ x: 150, y: 300, timestamp: 1000 }, { x: 155, y: 160, timestamp: 1180 })
        .direction,
      'swipe-up'
    );
    assert.equal(
      evaluateSwipeGesture({ x: 150, y: 160, timestamp: 1000 }, { x: 152, y: 300, timestamp: 1180 })
        .direction,
      'swipe-down'
    );
    assert.equal(
      evaluateSwipeGesture({ x: 150, y: 150, timestamp: 1000 }, { x: 165, y: 155, timestamp: 1080 })
        .direction,
      'none'
    );
  });

  it('enqueues and flushes offline curation mutations reliably', async () => {
    saveOfflineSyncQueue([]);
    enqueueOfflineMutation({ type: 'pick', assetId: 'a1', value: true });
    enqueueOfflineMutation({ type: 'rating', assetId: 'a2', value: 5 });

    const seen: string[] = [];
    const result = await flushOfflineSyncQueue(async (item) => {
      seen.push(`${item.type}:${item.assetId}`);
      return item.assetId === 'a1';
    });

    assert.deepEqual(seen, ['pick:a1', 'rating:a2']);
    assert.equal(result.processed, 1);
    assert.equal(result.remaining, 1);
    saveOfflineSyncQueue([]);
  });
});
