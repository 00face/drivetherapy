import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal storage shim so token-dependent URL resolution can be tested in Node
const makeStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
};
(globalThis as any).sessionStorage = makeStorage();
(globalThis as any).localStorage = makeStorage();

const { saveOAuthToken, clearOAuthToken } = await import('../src/services/oauthStorage');
const { mapDriveFileToTrack, mergeTracks, parseTitleArtist, inferFormat, fetchDriveMusicLibrary, buildAllCategoryPlaylists } = await import(
  '../src/services/music/musicLibrary'
);
const { resolveTrackUrl, resolveAssetUrl } = await import('../src/services/music/musicPlayback');
const { parseLrc, findActiveLyricIndex } = await import('../src/services/music/musicLyrics');
const {
  createUserPlaylist,
  addTrackToUserPlaylist,
  removeTrackFromUserPlaylist,
  deleteUserPlaylist,
  insertNextInQueue,
  moveInQueue,
  buildTrackRadioQueue,
} = await import('../src/services/music/musicQueueAndPlaylists');

const validToken = () => ({
  accessToken: 'tok_abc',
  acquiredAt: Date.now(),
  expiresAt: Date.now() + 3600_000,
  expiresIn: 3600,
  scopes: [],
  tokenType: 'Bearer' as const,
  provider: 'direct' as const,
});

describe('Music Library & Playback Modules', () => {
  beforeEach(() => clearOAuthToken());

  test('parses "Artist - Title" and falls back to generic artist', () => {
    assert.deepEqual(parseTitleArtist('Band - Song Name.mp3'), { artist: 'Band', title: 'Song Name' });
    assert.deepEqual(parseTitleArtist('plain.flac'), { artist: 'Unknown Artist', title: 'plain' });
  });

  test('infers format from extension then mime', () => {
    assert.equal(inferFormat('a.FLAC'), 'flac');
    assert.equal(inferFormat('a.bin', 'video/webm'), 'webm');
    assert.equal(inferFormat('a.bin', 'video/x-foo'), 'mp4');
    assert.equal(inferFormat('a.bin', 'audio/x-foo'), 'mp3');
  });

  test('maps Drive file to track with real duration, album from parent folder, video flag', () => {
    const t = mapDriveFileToTrack(
      {
        id: 'F1',
        name: 'Artist - Clip.mp4',
        mimeType: 'video/mp4',
        parents: ['P1'],
        videoMediaMetadata: { durationMillis: '61500' },
        starred: true,
      },
      new Map([['P1', 'My Folder']])
    );
    assert.equal(t.id, 'drive_F1');
    assert.equal(t.driveFileId, 'F1');
    assert.equal(t.durationSeconds, 62);
    assert.equal(t.album, 'My Folder');
    assert.equal(t.isVideo, true);
    assert.equal(t.isLiked, true);
  });

  test('mergeTracks deduplicates by id preserving first occurrence', () => {
    const a = mapDriveFileToTrack({ id: '1', name: 'a.mp3', mimeType: 'audio/mpeg' });
    const b = mapDriveFileToTrack({ id: '1', name: 'dup.mp3', mimeType: 'audio/mpeg' });
    const c = mapDriveFileToTrack({ id: '2', name: 'c.mp3', mimeType: 'audio/mpeg' });
    const merged = mergeTracks([a], [b, c]);
    assert.equal(merged.length, 2);
    assert.equal(merged[0].title, 'a');
  });

  test('resolveTrackUrl: drive tracks use stream proxy with session token; null when signed out', () => {
    const track = mapDriveFileToTrack({ id: 'X9', name: 's.mp3', mimeType: 'audio/mpeg' });
    assert.equal(resolveTrackUrl(track), null);
    saveOAuthToken(validToken());
    assert.equal(resolveTrackUrl(track), '/api/drive/stream/X9?access_token=tok_abc');
  });

  test('resolveTrackUrl: local OS paths use fs stream; unknown/demo tracks have no source', () => {
    const local = { ...mapDriveFileToTrack({ id: 'L', name: 'l.mp3' }), id: 'l1', driveFileId: undefined, source: 'local' as const, localPath: '/home/u/a b.mp3' };
    assert.equal(resolveTrackUrl(local), '/api/fs/stream?path=%2Fhome%2Fu%2Fa%20b.mp3');
    const demo = { ...local, id: 'demo', source: 'cloud' as const, localPath: undefined };
    assert.equal(resolveTrackUrl(demo), null);
  });

  test('fetchDriveMusicLibrary pages through the whole archive (>1 page) and reports progress', async () => {
    saveOAuthToken(validToken());
    const calls: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      calls.push(String(url));
      const page2 = String(url).includes('pageToken=T2');
      return {
        ok: true,
        json: async () =>
          page2
            ? { files: [{ id: 'b', name: 'b.mp4', mimeType: 'video/mp4' }] }
            : { files: [{ id: 'a', name: 'a.mp3', mimeType: 'audio/mpeg' }], nextPageToken: 'T2' },
      } as any;
    }) as any;
    try {
      let last = 0;
      const tracks = await fetchDriveMusicLibrary({ onProgress: (p) => (last = p.loaded) });
      assert.equal(tracks.length, 2);
      assert.equal(calls.length, 2);
      assert.ok(calls[0].includes('allDrives'));
      assert.equal(last, 2);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test('fetchDriveMusicLibrary returns [] when signed out', async () => {
    assert.deepEqual(await fetchDriveMusicLibrary(), []);
  });

  test('resolveAssetUrl: Drive/local catalog assets resolve to real streams, never the thumbnail', () => {
    assert.equal(resolveAssetUrl({ id: 'drive_Z1', source: 'cloud' }), null);
    saveOAuthToken(validToken());
    assert.equal(resolveAssetUrl({ id: 'drive_Z1', source: 'cloud' }), '/api/drive/stream/Z1?access_token=tok_abc');
    assert.equal(
      resolveAssetUrl({ id: 'x', source: 'local', path: '/mnt/a.mp4' }),
      '/api/fs/stream?path=%2Fmnt%2Fa.mp4'
    );
    assert.equal(resolveAssetUrl({ id: 'y', source: 'other', cloudUrl: 'https://example.com/v.mp4' }), 'https://example.com/v.mp4');
  });

  test('buildAllCategoryPlaylists populates all 6 categories dynamically', () => {
    const t1 = mapDriveFileToTrack({
      id: 'T1',
      name: 'Synth - Horizon.mp3',
      mimeType: 'audio/mpeg',
      starred: true,
      owners: [{ displayName: 'Owner A' }],
    });
    const t2 = mapDriveFileToTrack({
      id: 'T2',
      name: 'Deep Talk Episode 12.mp3',
      mimeType: 'audio/mpeg',
      videoMediaMetadata: { durationMillis: '900000' },
    });
    const cls = buildAllCategoryPlaylists({
      tracks: [t1, t2],
      accountName: 'Owner A',
      subAccountProfiles: [{ id: 'p1', name: 'Owner A', handle: '@ownera' }],
    });
    for (const cat of ['playlists', 'songs', 'albums', 'artists', 'profiles', 'podcasts'] as const) {
      assert.ok(
        cls.some((p) => p.category === cat),
        `Missing category ${cat}`
      );
    }
  });

  test('LRC parser computes timestamps and active line index accurately', () => {
    const parsed = parseLrc('[00:05.00] Line One\n[00:12.50] Line Two\n[00:25.00] Line Three');
    assert.equal(parsed.length, 3);
    assert.equal(findActiveLyricIndex(parsed, 1.0), -1);
    assert.equal(findActiveLyricIndex(parsed, 6.0), 0);
    assert.equal(findActiveLyricIndex(parsed, 13.0), 1);
    assert.equal(findActiveLyricIndex(parsed, 30.0), 2);
  });

  test('Playlist CRUD, mutable queue ordering, and Track Radio similarity scoring', () => {
    const s1 = mapDriveFileToTrack({ id: 'S1', name: 'Band A - One.mp3', mimeType: 'audio/mpeg' });
    const s2 = mapDriveFileToTrack({ id: 'S2', name: 'Band A - Two.mp3', mimeType: 'audio/mpeg' });
    const s3 = mapDriveFileToTrack({ id: 'S3', name: 'Other - Clip.mp4', mimeType: 'video/mp4' });

    const created = createUserPlaylist('acc_crud', { title: 'Test Mix', tracks: [s1] });
    assert.equal(created.tracks.length, 1);
    const added = addTrackToUserPlaylist('acc_crud', created.id, s2);
    assert.equal(added?.tracks.length, 2);
    const removed = removeTrackFromUserPlaylist('acc_crud', created.id, s1.id);
    assert.equal(removed?.tracks.length, 1);
    assert.equal(deleteUserPlaylist('acc_crud', created.id), true);

    const nextQ = insertNextInQueue([s1, s2, s3], 0, s3);
    assert.equal(nextQ.queue[1].id, s3.id);

    const moved = moveInQueue([s1, s2, s3], 0, 2, 0);
    assert.equal(moved.queue[0].id, s3.id);
    assert.equal(moved.currentIndex, 1);

    const radio = buildTrackRadioQueue(s1, [s1, s2, s3], 10);
    assert.equal(radio[0].id, s1.id);
    assert.equal(radio[1].id, s2.id); // Same artist ranked above video track s3
  });

  test('Drive and Local media track URL resolution and multi-source merging', () => {
    saveOAuthToken(validToken());
    const driveTrack = mapDriveFileToTrack({ id: 'D1', name: 'Band A - Studio Session.flac', mimeType: 'audio/flac' });
    const localTrack = {
      id: 'local_L1',
      title: 'Local Track',
      artist: 'Local Artist',
      album: 'Local Album',
      durationSeconds: 210,
      albumArtUrl: '',
      genre: 'Local Audio',
      format: 'mp3' as const,
      source: 'local' as const,
      localPath: '/home/user/Music/track.mp3',
    };

    assert.equal(resolveTrackUrl(driveTrack), '/api/drive/stream/D1?access_token=tok_abc');
    assert.equal(resolveTrackUrl(localTrack), '/api/fs/stream?path=%2Fhome%2Fuser%2FMusic%2Ftrack.mp3');

    const merged = mergeTracks([driveTrack], [localTrack]);
    assert.equal(merged.length, 2);
    assert.equal(merged.some((t) => t.id === 'drive_D1'), true);
    assert.equal(merged.some((t) => t.id === 'local_L1'), true);
  });
});
