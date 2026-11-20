import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { googleMusicEngine } from '../src/services/googleMusicEngine.ts';
import type { MediaAsset } from '../src/types/index.ts';

describe('UX, Sidebar Nav, Safe Animations & Video Playback Transitions', () => {
  it('automatically transitions to nowplaying + video mode when playing a video asset or advancing into a video track', () => {
    const audioAsset: MediaAsset = {
      id: 'local_audio_1',
      name: 'Ambient Track.mp3',
      source: 'local',
      category: 'audio',
      mimeType: 'audio/mpeg',
      extension: 'MP3',
      sizeBytes: 2048000,
      path: '/home/face/Music/Ambient Track.mp3',
      localPath: '/home/face/Music/Ambient Track.mp3',
      modifiedTime: new Date().toISOString(),
      thumbnailUrl: '',
      isCached: true,
      cullingStatus: 'unrated',
      rating: 0,
      tags: [],
      faces: [],
      quality: { sharpness: 90, exposure: 90, overall: 90, isBlurry: false },
      palette: [],
      exif: {},
    };

    const videoAsset: MediaAsset = {
      id: 'local_video_1',
      name: 'Feral Lantern explainer.mp4',
      source: 'local',
      category: 'video',
      mimeType: 'video/mp4',
      extension: 'MP4',
      sizeBytes: 40875851,
      path: '/home/face/Videos/Feral Lantern explainer.mp4',
      localPath: '/home/face/Videos/Feral Lantern explainer.mp4',
      modifiedTime: new Date().toISOString(),
      thumbnailUrl: '',
      isCached: true,
      cullingStatus: 'unrated',
      rating: 0,
      tags: [],
      faces: [],
      quality: { sharpness: 90, exposure: 90, overall: 90, isBlurry: false },
      palette: [],
      exif: {},
    };

    // Start from Library view playing an audio track
    googleMusicEngine.setActiveView('library');
    googleMusicEngine.openPlayerWithAsset(audioAsset, true, [audioAsset, videoAsset]);
    let state = googleMusicEngine.getState();
    assert.equal(state.isVideoMode, false);
    assert.equal(state.activeView, 'library');

    // Advancing to the next track (which is a video) must automatically switch to nowplaying + video mode
    googleMusicEngine.next();
    state = googleMusicEngine.getState();
    assert.equal(state.currentTrack?.isVideo, true);
    assert.equal(state.isVideoMode, true);
    assert.equal(state.activeView, 'nowplaying');

    // Going back to the audio track clears video mode
    googleMusicEngine.prev();
    state = googleMusicEngine.getState();
    assert.equal(state.isVideoMode, false);

    // Direct openPlayerWithAsset on a video from any view (e.g., explore) jumps straight to nowplaying + video mode
    googleMusicEngine.setActiveView('explore');
    googleMusicEngine.openPlayerWithAsset(videoAsset, true, [videoAsset]);
    state = googleMusicEngine.getState();
    assert.equal(state.isVideoMode, true);
    assert.equal(state.activeView, 'nowplaying');

    googleMusicEngine.pause();
  });

  it('MiniDock centers collapsed nav icons, groups navigation semantically, and avoids infinite animate-pulse', () => {
    const miniDockSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/MiniDock.tsx'),
      'utf8'
    );
    assert.ok(miniDockSrc.includes("isExpanded ? 'gap-2.5 w-full justify-start' : 'justify-center'"));
    assert.ok(miniDockSrc.includes('navGroups'));
    assert.ok(!miniDockSrc.includes('animate-pulse'));
  });

  it('index.css defines reduced-motion-safe stage/modal animations disabled under calm-motion and prefers-reduced-motion', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
    assert.ok(css.includes('.dt-stage-enter'));
    assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
    assert.ok(css.includes('body.calm-motion .dt-stage-enter'));
  });

  it('no component in src/components invokes React hooks after a component-level early return null', () => {
    const violations: string[] = [];
    const scanDir = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) scanDir(full);
        else if (full.endsWith('.tsx')) {
          const lines = fs.readFileSync(full, 'utf8').split('\n');
          let earlyRetLine = -1;
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^export\s+(const|function)\s+[A-Z]/.test(line)) {
              earlyRetLine = -1;
            }
            if (/^  if\s*\(/.test(line) && /return\s+null;/.test(lines.slice(i, i + 4).join(' '))) {
              earlyRetLine = i + 1;
            }
            if (
              earlyRetLine > 0 &&
              /^  (const\s+.*=\s*)?(useEffect|useMemo|useCallback|useState|useRef)\s*\(/.test(line)
            ) {
              violations.push(`${path.relative(process.cwd(), full)}:${i + 1} (early return at L${earlyRetLine})`);
            }
          }
        }
      }
    };
    scanDir(path.resolve(process.cwd(), 'src/components'));
    assert.deepEqual(violations, []);
  });
});
