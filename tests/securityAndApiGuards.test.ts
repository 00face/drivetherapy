import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Security Guards, Synchronous Picker Popup & Explicit Scan Control', () => {
  it('server.ts enforces isLoopbackRequest on all local fs and FFmpeg media edit routes', () => {
    const srv = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
    for (const route of [
      "app.post('/api/fs/delta-scan'",
      "app.post('/api/media/video-edit'",
      "app.post('/api/media/gif'",
    ]) {
      const idx = srv.indexOf(route);
      assert.ok(idx >= 0, `Missing route ${route}`);
      const snippet = srv.slice(idx, idx + 220);
      assert.ok(snippet.includes('isLoopbackRequest(req)'), `${route} must enforce isLoopbackRequest(req)`);
    }

    // SSRF allowlist on /api/photos/proxy
    const proxyIdx = srv.indexOf("app.get('/api/photos/proxy'");
    assert.ok(proxyIdx >= 0);
    const proxySnippet = srv.slice(proxyIdx, proxyIdx + 350);
    assert.ok(proxySnippet.includes('googleusercontent\\.com'));

    // Zero shell interpolation in FFmpeg execution
    assert.ok(srv.includes("execFile('ffmpeg'"));
    assert.ok(!srv.includes('execSync(`ffmpeg'));
  });

  it('GooglePhotosView opens picker window synchronously before async session call to avoid popup blocks', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/GooglePhotosView.tsx'),
      'utf8'
    );
    const syncOpenIdx = src.indexOf("window.open('about:blank', 'google_photos_picker'");
    const awaitSessionIdx = src.indexOf('await createGooglePhotosPickerSession()');
    assert.ok(syncOpenIdx > 0 && awaitSessionIdx > syncOpenIdx);
    assert.ok(src.includes('activePickerUri'));
  });

  it('App.tsx does not auto-trigger unbounded handleDeepScan() immediately upon OAuth sign-in', () => {
    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    const syncIdx = appSrc.indexOf('const handleSyncAuthToken');
    const syncBlock = appSrc.slice(syncIdx, syncIdx + 3200);
    assert.ok(!syncBlock.includes('handleDeepScan()'));
  });
});
