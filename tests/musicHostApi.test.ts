import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createMusicHostRouter, MOODS_AND_GENRES } from '../src/services/music/musicHost';

describe('Google Music Host Express API (/api/music/*)', () => {
  const router = createMusicHostRouter();

  test('registers all required Google Music REST endpoints on router stack', () => {
    assert.ok(router);
    assert.strictEqual(typeof router, 'function');

    const registeredPaths = router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    const pathList = registeredPaths.map((r) => r.path);

    assert.ok(pathList.includes('/health'));
    assert.ok(pathList.includes('/home'));
    assert.ok(pathList.includes('/explore'));
    assert.ok(pathList.includes('/moods'));
    assert.ok(pathList.includes('/charts'));
    assert.ok(pathList.includes('/search'));
    assert.ok(pathList.includes('/search/suggestions'));
    assert.ok(pathList.includes('/radio/:trackId'));
    assert.ok(pathList.includes('/artist/:artistId'));
    assert.ok(pathList.includes('/album/:albumId'));
    assert.ok(pathList.includes('/lyrics/:trackId'));
    assert.ok(pathList.includes('/playlists'));
    assert.ok(pathList.includes('/playlists/:id'));
  });

  test('delivers comprehensive moods and genres taxonomy for Drive & Local Studio', () => {
    assert.ok(MOODS_AND_GENRES.length >= 8);
    const moodIds = MOODS_AND_GENRES.map((m) => m.id);

    assert.ok(moodIds.includes('chill'));
    assert.ok(moodIds.includes('focus'));
    assert.ok(moodIds.includes('workout'));
    assert.ok(moodIds.includes('commute'));
    assert.ok(moodIds.includes('party'));
    assert.ok(moodIds.includes('romance'));
    assert.ok(moodIds.includes('sleep'));
    assert.ok(moodIds.includes('energize'));

    for (const mood of MOODS_AND_GENRES) {
      assert.ok(mood.label.length > 0);
      assert.ok(mood.color.startsWith('#'));
      assert.ok(mood.genres.length > 0);
    }
  });

  test('simulates /home endpoint execution returning shelves and moods', async () => {
    const homeLayer = router.stack.find((l: any) => l.route?.path === '/home');
    assert.ok(homeLayer);

    let sentJson: any = null;
    const mockReq: any = { query: {} };
    const mockRes: any = {
      json: (data: any) => {
        sentJson = data;
      },
    };

    await (homeLayer as any).route.stack[0].handle(mockReq, mockRes, () => {});

    assert.ok(sentJson);
    assert.ok(Array.isArray(sentJson.shelves));
    assert.ok(sentJson.shelves.some((s: any) => s.id === 'shelf_quick_picks'));
    assert.ok(sentJson.shelves.some((s: any) => s.id === 'shelf_listen_again'));
    assert.ok(sentJson.shelves.some((s: any) => s.id === 'shelf_mixed_for_you'));
    assert.ok(sentJson.shelves.some((s: any) => s.id === 'shelf_recommended_videos'));
    assert.ok(Array.isArray(sentJson.moods));
  });

  test('simulates /search/suggestions autocomplete returning instant matches', async () => {
    const sugLayer = router.stack.find((l: any) => l.route?.path === '/search/suggestions');
    assert.ok(sugLayer);

    let sentJson: any = null;
    const mockReq: any = { query: { q: 'lofi' } };
    const mockRes: any = {
      json: (data: any) => {
        sentJson = data;
      },
    };

    await (sugLayer as any).route.stack[0].handle(mockReq, mockRes, () => {});

    assert.ok(sentJson);
    assert.strictEqual(sentJson.query, 'lofi');
    assert.ok(Array.isArray(sentJson.suggestions));
    assert.ok(sentJson.suggestions.length > 0);
  });

  test('simulates /radio/:trackId generating continuous station queue', async () => {
    const radioLayer = router.stack.find((l: any) => l.route?.path === '/radio/:trackId');
    assert.ok(radioLayer);

    let sentJson: any = null;
    const mockReq: any = { params: { trackId: 'track_lofi_01' } };
    const mockRes: any = {
      json: (data: any) => {
        sentJson = data;
      },
    };

    await (radioLayer as any).route.stack[0].handle(mockReq, mockRes, () => {});

    assert.ok(sentJson);
    assert.strictEqual(sentJson.seedTrack.id, 'track_lofi_01');
    assert.ok(Array.isArray(sentJson.tracks));
    assert.ok(sentJson.tracks.length >= 2);
    assert.strictEqual(sentJson.tracks[0].id, 'track_lofi_01');
  });

  test('simulates /artist/:artistId returning top songs, albums, and discography', async () => {
    const artistLayer = router.stack.find((l: any) => l.route?.path === '/artist/:artistId');
    assert.ok(artistLayer);

    let sentJson: any = null;
    const mockReq: any = { params: { artistId: 'Antigravity Sound Lab' } };
    const mockRes: any = {
      json: (data: any) => {
        sentJson = data;
      },
    };

    await (artistLayer as any).route.stack[0].handle(mockReq, mockRes, () => {});

    assert.ok(sentJson);
    assert.strictEqual(sentJson.name, 'Antigravity Sound Lab');
    assert.ok(Array.isArray(sentJson.topSongs));
    assert.ok(Array.isArray(sentJson.albums));
    assert.ok(Array.isArray(sentJson.similarArtists));
  });

  test('simulates /lyrics/:trackId GET and POST endpoints', async () => {
    const lyricsLayerGet = router.stack.find(
      (l: any) => l.route?.path === '/lyrics/:trackId' && l.route.methods.get
    );
    const lyricsLayerPost = router.stack.find(
      (l: any) => l.route?.path === '/lyrics/:trackId' && l.route.methods.post
    );

    assert.ok(lyricsLayerGet);
    assert.ok(lyricsLayerPost);

    // Save custom lyrics
    let postResult: any = null;
    const mockPostReq: any = {
      params: { trackId: 'test_track_x' },
      body: { lyrics: '[00:01.00] Custom Saved LRC Line' },
    };
    const mockPostRes: any = {
      json: (d: any) => {
        postResult = d;
      },
    };
    await (lyricsLayerPost as any).route.stack[0].handle(mockPostReq, mockPostRes, () => {});
    assert.strictEqual(postResult.success, true);

    // Retrieve saved lyrics
    let getResult: any = null;
    const mockGetReq: any = { params: { trackId: 'test_track_x' } };
    const mockGetRes: any = {
      json: (d: any) => {
        getResult = d;
      },
    };
    await (lyricsLayerGet as any).route.stack[0].handle(mockGetReq, mockGetRes, () => {});
    assert.strictEqual(getResult.hasLyrics, true);
    assert.strictEqual(getResult.lyrics, '[00:01.00] Custom Saved LRC Line');
  });

  test('simulates /playlists CRUD operations', async () => {
    const postPlLayer = router.stack.find(
      (l: any) => l.route?.path === '/playlists' && l.route.methods.post
    );
    const putPlLayer = router.stack.find(
      (l: any) => l.route?.path === '/playlists/:id' && l.route.methods.put
    );
    const deletePlLayer = router.stack.find(
      (l: any) => l.route?.path === '/playlists/:id' && l.route.methods.delete
    );

    // 1. Create playlist
    let createdPl: any = null;
    const createReq: any = {
      body: { title: 'Test CRUD Playlist', description: 'Testing playlist CRUD' },
    };
    const createRes: any = {
      status: (code: number) => ({
        json: (d: any) => {
          createdPl = d;
        },
      }),
      json: (d: any) => {
        createdPl = d;
      },
    };
    await (postPlLayer as any).route.stack[0].handle(createReq, createRes, () => {});
    assert.ok(createdPl);
    assert.strictEqual(createdPl.title, 'Test CRUD Playlist');
    const plId = createdPl.id;

    // 2. Update playlist
    let updatedPl: any = null;
    const updateReq: any = {
      params: { id: plId },
      body: { title: 'Updated CRUD Playlist' },
    };
    const updateRes: any = {
      json: (d: any) => {
        updatedPl = d;
      },
    };
    await (putPlLayer as any).route.stack[0].handle(updateReq, updateRes, () => {});
    assert.strictEqual(updatedPl.title, 'Updated CRUD Playlist');

    // 3. Delete playlist
    let deleteResult: any = null;
    const deleteReq: any = { params: { id: plId } };
    const deleteRes: any = {
      json: (d: any) => {
        deleteResult = d;
      },
    };
    await (deletePlLayer as any).route.stack[0].handle(deleteReq, deleteRes, () => {});
    assert.strictEqual(deleteResult.success, true);
  });
});
