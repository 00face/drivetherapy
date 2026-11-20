import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { googleMusicEngine } from '../src/services/googleMusicEngine.ts';

describe('Lightbox Rules-of-Hooks (#310) & /api/fs/scan-media Loop Prevention', () => {
  test('LightboxModal has zero React hooks after its top-level early return null', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/LightboxModal.tsx'),
      'utf8'
    );
    const earlyRetIdx = source.indexOf('if (!asset || !contextSpec) return null;');
    assert.ok(earlyRetIdx > 0, 'Expected early return guard in LightboxModal.tsx');

    const afterEarlyReturn = source.slice(earlyRetIdx);
    const hookMatch = afterEarlyReturn.match(/\b(useState|useEffect|useMemo|useRef|useCallback)\s*\(/);
    assert.equal(
      hookMatch,
      null,
      `Found hook call (${hookMatch?.[0]}) after early return in LightboxModal.tsx`
    );
  });

  test('GoogleMusicEngine.scanLocalDriveMedia deduplicates concurrent & cooldown calls to /api/fs/scan-media', async () => {
    // Allow singleton constructor init to settle first
    await googleMusicEngine.scanLocalDriveMedia(false);

    const originalFetch = globalThis.fetch;
    let scanCalls = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/fs/scan-media')) {
        scanCalls++;
        return new Response(JSON.stringify({ success: true, tracks: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    try {
      // Within 30s cooldown, rapid concurrent & sequential non-forced calls trigger 0 extra network requests
      await Promise.all([
        googleMusicEngine.scanLocalDriveMedia(false),
        googleMusicEngine.scanLocalDriveMedia(false),
        googleMusicEngine.scanLocalDriveMedia(false),
        googleMusicEngine.scanLocalDriveMedia(false),
      ]);
      await googleMusicEngine.scanLocalDriveMedia(false);
      assert.equal(scanCalls, 0, 'Cooldown should prevent redundant /api/fs/scan-media calls');

      // Force=true bypasses cooldown when user clicks Rescan, and concurrent force=false piggybacks
      await Promise.all([
        googleMusicEngine.scanLocalDriveMedia(true),
        googleMusicEngine.scanLocalDriveMedia(false),
        googleMusicEngine.scanLocalDriveMedia(false),
      ]);
      assert.equal(scanCalls, 1, 'Expected 1 /api/fs/scan-media call for forced rescan + concurrent callers');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
