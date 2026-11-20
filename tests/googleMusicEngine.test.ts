import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { googleMusicEngine, MusicTrack } from '../src/services/googleMusicEngine';
import {
  groupSubAccountsByGoogleAccount,
  mergeDiscoveredChannels,
  sanitizeSubAccountList,
} from '../src/services/music/musicAccounts';
import type { MediaAsset } from '../src/types';

function makeTrack(id: string, overrides: Partial<MusicTrack> = {}): MusicTrack {
  return {
    id,
    title: `Studio Track ${id}`,
    artist: 'Session Artist',
    album: 'Drive Archive',
    durationSeconds: 185,
    albumArtUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80',
    genre: 'Ambient',
    format: 'flac',
    source: 'cloud',
    driveFileId: id.startsWith('drive_') ? id.replace(/^drive_/, '') : `file_${id}`,
    ...overrides,
  };
}

function makeMediaAsset(id: string, overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id,
    name: `${id} - Night Reel.mp3`,
    source: 'cloud',
    category: 'audio',
    mimeType: 'audio/mpeg',
    extension: 'mp3',
    path: `/Drive/${id}.mp3`,
    sizeBytes: 4096000,
    duration: 210,
    modifiedTime: '2026-11-17T00:00:00Z',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
    isCached: false,
    cullingStatus: 'unrated',
    rating: 0,
    tags: ['Ambient'],
    faces: [],
    quality: { sharpness: 90, isBlurry: false },
    palette: ['#0f172a', '#38bdf8'],
    exif: {},
    ...overrides,
  };
}

describe('Google Drive & Local Media Engine', () => {
  beforeEach(() => {
    googleMusicEngine.pause();
    googleMusicEngine.setFilterCategory('all');
    googleMusicEngine.setSortOption('recent');
    googleMusicEngine.setMediaSource('all');
    googleMusicEngine.switchSubAccount('acc_studio_primary');
  });

  test('lists default Drive & Local studio playlists', () => {
    const playlists = googleMusicEngine.getPlaylists();
    assert.ok(playlists.length >= 2);
    assert.strictEqual(playlists.some((p) => p.id === 'pl_drive_all'), true);
    assert.strictEqual(playlists.some((p) => p.id === 'pl_liked_music'), true);
  });

  test('searches tracks by title, artist, album, and genre', () => {
    const driveTrack = makeTrack('drive_alpha', {
      title: 'Midnight Field Recording',
      artist: 'Clara Vance',
      album: 'Cloud Stems Vol. 1',
      genre: 'Acoustic',
      source: 'cloud',
    });
    const localTrack = makeTrack('local_beta', {
      title: 'Tape Loop Four',
      artist: 'Studio Desk',
      album: 'Disk Sessions',
      genre: 'Electronic',
      source: 'local',
      localPath: '/home/user/Music/tape_loop_four.flac',
    });
    const pl = googleMusicEngine.createPlaylist('Search Fixture', 'Test playlist', [driveTrack, localTrack]);
    googleMusicEngine.selectPlaylist(pl.id);

    const byTitle = googleMusicEngine.searchTracks('Midnight Field');
    assert.strictEqual(byTitle.some((t) => t.id === 'drive_alpha'), true);

    const byArtist = googleMusicEngine.searchTracks('Studio Desk');
    assert.strictEqual(byArtist.some((t) => t.id === 'local_beta'), true);

    const byGenre = googleMusicEngine.searchTracks('Electronic');
    assert.strictEqual(byGenre.some((t) => t.id === 'local_beta'), true);

    const allInPl = googleMusicEngine.searchTracks('');
    assert.strictEqual(allInPl.length, 2);

    googleMusicEngine.deletePlaylist(pl.id);
  });

  test('manages track queue and next/prev progression', () => {
    const t1 = makeTrack('q1', { title: 'Opening Reel' });
    const t2 = makeTrack('q2', { title: 'Middle Cut' });
    const t3 = makeTrack('q3', { title: 'Closing Take' });

    googleMusicEngine.playAlbumTracks([t1, t2, t3], 0, false);
    assert.strictEqual(googleMusicEngine.getCurrentTrack().id, 'q1');

    googleMusicEngine.next();
    assert.strictEqual(googleMusicEngine.getCurrentTrack().id, 'q2');

    googleMusicEngine.next();
    assert.strictEqual(googleMusicEngine.getCurrentTrack().id, 'q3');

    googleMusicEngine.prev();
    assert.strictEqual(googleMusicEngine.getCurrentTrack().id, 'q2');
  });

  test('toggles shuffle and repeat modes', () => {
    const initial = googleMusicEngine.getState();
    const initialShuffle = initial.isShuffle;
    googleMusicEngine.toggleShuffle();
    assert.strictEqual(googleMusicEngine.getState().isShuffle, !initialShuffle);

    googleMusicEngine.toggleRepeat();
    assert.strictEqual(googleMusicEngine.getState().repeatMode, 'one');
    googleMusicEngine.toggleRepeat();
    assert.strictEqual(googleMusicEngine.getState().repeatMode, 'off');
    googleMusicEngine.toggleRepeat();
    assert.strictEqual(googleMusicEngine.getState().repeatMode, 'all');
  });

  test('notifies listeners on state changes', () => {
    let notifications = 0;
    const unsubscribe = googleMusicEngine.subscribe(() => {
      notifications++;
    });

    googleMusicEngine.setAutoplay(false);
    googleMusicEngine.setAutoplay(true);
    assert.ok(notifications >= 2);
    unsubscribe();
  });

  test('lists sub-accounts and defaults to Local Studio Session', () => {
    const accounts = googleMusicEngine.getSubAccounts();
    assert.ok(accounts.length >= 1);
    const active = googleMusicEngine.getActiveSubAccount();
    assert.strictEqual(active.id, 'acc_studio_primary');
    assert.strictEqual(active.accountType, 'local');
  });

  test('switches sub-accounts and swaps active library catalog', () => {
    const second = googleMusicEngine.addSubAccount({
      name: 'Mastering Vault',
      email: 'vault@studio.example',
      roleLabel: 'Drive Workspace',
      accountType: 'workspace_sub',
    });

    const trackInVault = makeTrack('vault_t1', { title: 'Master Buss 24bit' });
    const vaultPl = googleMusicEngine.createPlaylist('Vault Stems', 'Workspace Vault', [trackInVault]);

    googleMusicEngine.switchSubAccount('acc_studio_primary');
    assert.strictEqual(googleMusicEngine.getActiveSubAccount().id, 'acc_studio_primary');
    assert.strictEqual(
      googleMusicEngine.getPlaylists().some((p) => p.id === vaultPl.id),
      false
    );

    googleMusicEngine.switchSubAccount(second.id);
    assert.strictEqual(googleMusicEngine.getActiveSubAccount().id, second.id);
    assert.strictEqual(
      googleMusicEngine.getPlaylists().some((p) => p.id === vaultPl.id),
      true
    );

    googleMusicEngine.deletePlaylist(vaultPl.id);
    googleMusicEngine.removeSubAccount(second.id);
  });

  test('dynamically registers and switches to new Google Drive workspace profile', () => {
    const created = googleMusicEngine.addSubAccount({
      name: 'Field Audio Archive',
      email: 'field@studio.example',
      handle: '@fieldaudio',
      roleLabel: 'Google Drive Folder Profile',
      accountType: 'workspace_sub',
    });

    assert.strictEqual(googleMusicEngine.getActiveSubAccount().id, created.id);
    assert.strictEqual(created.handle, '@fieldaudio');
    assert.strictEqual(created.accountType, 'workspace_sub');
    assert.strictEqual(created.roleLabel, 'Google Drive Folder Profile');

    googleMusicEngine.removeSubAccount(created.id);
  });

  test('filters playlists and library items by category and sort order', () => {
    const plZ = googleMusicEngine.createPlaylist('Zulu Sessions', 'Z playlist', [makeTrack('fz')]);
    const plA = googleMusicEngine.createPlaylist('Alpha Sessions', 'A playlist', [makeTrack('fa')]);

    googleMusicEngine.setFilterCategory('playlists');
    googleMusicEngine.setSortOption('alpha');

    const filtered = googleMusicEngine.getFilteredPlaylists();
    assert.ok(filtered.length >= 2);
    for (let i = 1; i < filtered.length; i++) {
      assert.ok(filtered[i - 1].title.localeCompare(filtered[i].title) <= 0);
    }

    googleMusicEngine.deletePlaylist(plZ.id);
    googleMusicEngine.deletePlaylist(plA.id);
  });

  test('manages video mode, lyrics, details tab, and like toggle', () => {
    const track = makeTrack('video_1', {
      title: 'Concert Reel',
      isVideo: true,
      source: 'local',
      localPath: '/home/user/Videos/concert_reel.mp4',
    });
    googleMusicEngine.playAlbumTracks([track], 0, false);

    const beforeVideo = googleMusicEngine.getState().isVideoMode;
    googleMusicEngine.toggleVideoMode();
    assert.strictEqual(googleMusicEngine.getState().isVideoMode, !beforeVideo);

    googleMusicEngine.setActiveTab('details');
    assert.strictEqual(googleMusicEngine.getState().activeTab, 'details');

    googleMusicEngine.setTrackLyrics(track.id, '[00:05.00] First line\n[00:12.00] Second line');
    const parsedLyrics = googleMusicEngine.getParsedLyrics(track);
    assert.strictEqual(parsedLyrics.length, 2);
    assert.strictEqual(parsedLyrics[0].text, 'First line');

    const wasLiked = Boolean(googleMusicEngine.getCurrentTrack().isLiked);
    googleMusicEngine.toggleLikeCurrentTrack();
    assert.strictEqual(Boolean(googleMusicEngine.getCurrentTrack().isLiked), !wasLiked);
  });

  test('supports dual media source switching and PiP state harmonization', () => {
    googleMusicEngine.setMediaSource('local');
    assert.strictEqual(googleMusicEngine.getState().activeMediaSource, 'local');

    googleMusicEngine.setMediaSource('cloud');
    assert.strictEqual(googleMusicEngine.getState().activeMediaSource, 'cloud');

    googleMusicEngine.setMediaSource('all');
    assert.strictEqual(googleMusicEngine.getState().activeMediaSource, 'all');

    googleMusicEngine.setPipActive(true);
    assert.strictEqual(googleMusicEngine.getState().isPipActive, true);
    googleMusicEngine.setPipActive(false);
    assert.strictEqual(googleMusicEngine.getState().isPipActive, false);
  });

  test('dynamically partitions media libraries and respects active account context', async () => {
    const a1 = googleMusicEngine.addSubAccount({
      name: 'Acoustic Room',
      email: 'acoustic@studio.example',
      accountType: 'workspace_sub',
    });
    const pl1 = googleMusicEngine.createPlaylist('Room Mics', 'Room mics', [makeTrack('rm_1')]);

    const a2 = googleMusicEngine.addSubAccount({
      name: 'Film Scoring',
      email: 'score@studio.example',
      accountType: 'workspace_sub',
    });
    const pl2 = googleMusicEngine.createPlaylist('Brass Cues', 'Brass stems', [makeTrack('br_1')]);

    googleMusicEngine.switchSubAccount(a1.id);
    assert.strictEqual(googleMusicEngine.getPlaylists().some((p) => p.id === pl1.id), true);
    assert.strictEqual(googleMusicEngine.getPlaylists().some((p) => p.id === pl2.id), false);

    googleMusicEngine.switchSubAccount(a2.id);
    assert.strictEqual(googleMusicEngine.getPlaylists().some((p) => p.id === pl2.id), true);
    assert.strictEqual(googleMusicEngine.getPlaylists().some((p) => p.id === pl1.id), false);

    googleMusicEngine.deletePlaylist(pl2.id);
    googleMusicEngine.switchSubAccount(a1.id);
    googleMusicEngine.deletePlaylist(pl1.id);
    googleMusicEngine.removeSubAccount(a2.id);
    googleMusicEngine.removeSubAccount(a1.id);
  });

  test('dynamically synchronizes authenticated Google User profile without hardcoding', () => {
    googleMusicEngine.syncGoogleUserProfile({
      name: 'Jordan Vance',
      email: 'jordan.vance@studio.example',
    });

    const active = googleMusicEngine.getActiveSubAccount();
    assert.strictEqual(active.id, 'acc_studio_primary');
    assert.strictEqual(active.name, 'Jordan Vance');
    assert.strictEqual(active.email, 'jordan.vance@studio.example');
    assert.strictEqual(active.accountType, 'primary');
  });

  test('resolves discovered Drive profiles, supports playlist CRUD, radio, ratings & LRC', () => {
    const merged = mergeDiscoveredChannels(
      [],
      'editor@studio.example',
      'Studio Editor',
      undefined,
      [
        {
          id: 'drive_ws_1',
          name: 'Shared Scoring Drive',
          handle: '@scoringdrive',
          roleLabel: 'Google Workspace Profile',
          accountType: 'workspace_sub',
        },
      ]
    );
    assert.strictEqual(merged.some((a) => a.id === 'drive_ws_1' && a.accountType === 'workspace_sub'), true);

    const t1 = makeTrack('crud_1', { title: 'Foley Pass One', genre: 'Soundtrack', bpm: 92 });
    const t2 = makeTrack('crud_2', { title: 'Foley Pass Two', genre: 'Soundtrack', bpm: 94 });

    const created = googleMusicEngine.createPlaylist('Foley Cuts', 'Raw passes', [t1]);
    assert.strictEqual(created.tracks.length, 1);

    const renamed = googleMusicEngine.renamePlaylist(created.id, 'Foley Final Cuts', 'Approved takes');
    assert.strictEqual(renamed?.title, 'Foley Final Cuts');

    const added = googleMusicEngine.addTrackToPlaylist(created.id, t2);
    assert.strictEqual(added?.tracks.length, 2);

    const removed = googleMusicEngine.removeTrackFromPlaylist(created.id, t1.id);
    assert.strictEqual(removed?.tracks.length, 1);

    googleMusicEngine.rateTrack(t2.id, 'down');
    assert.strictEqual(googleMusicEngine.getTrackRating(t2.id), 'down');
    googleMusicEngine.rateTrack(t2.id, 'up');
    assert.strictEqual(googleMusicEngine.getTrackRating(t2.id), 'up');

    const station = googleMusicEngine.startRadio(t2.id);
    assert.ok(station.length >= 1);
    assert.strictEqual(station[0].id, t2.id);

    googleMusicEngine.setTrackLyrics(t2.id, ['[00:01.00] Intro tone', '[00:04.50] Fade out']);
    const lines = googleMusicEngine.getParsedLyrics(t2);
    assert.strictEqual(lines.length, 2);
    assert.strictEqual(lines[1].text, 'Fade out');

    const deleted = googleMusicEngine.deletePlaylist(created.id);
    assert.strictEqual(deleted, true);
  });

  test('resiliently handles corrupted sub-accounts lacking id without crashing', () => {
    const sanitized = sanitizeSubAccountList([
      null,
      undefined,
      { name: 'Corrupt Entry Without Id' },
      { id: 'valid_drive_prof', name: 'Valid Profile', email: 'ok@studio.example' },
    ] as any[]);

    assert.strictEqual(sanitized.length, 1);
    assert.strictEqual(sanitized[0].id, 'valid_drive_prof');

    const switched = googleMusicEngine.switchSubAccount('nonexistent_account_id');
    assert.ok(switched.id);
  });

  test('playAlbumTracks loads all album tracks into queue and plays in sequence', () => {
    const tracks = [
      makeTrack('alb_1', { title: 'Track One' }),
      makeTrack('alb_2', { title: 'Track Two' }),
      makeTrack('alb_3', { title: 'Track Three' }),
    ];

    googleMusicEngine.playAlbumTracks(tracks, 1, false);
    assert.strictEqual(googleMusicEngine.getCurrentTrack().id, 'alb_2');
    assert.strictEqual(googleMusicEngine.getState().isPlaying, true);
    assert.strictEqual(googleMusicEngine.getState().isShuffle, false);

    googleMusicEngine.next();
    assert.strictEqual(googleMusicEngine.getCurrentTrack().id, 'alb_3');
  });

  test('playAlbumTracks with shuffle=true randomizes queue while retaining all tracks', () => {
    const tracks = Array.from({ length: 8 }, (_, idx) => makeTrack(`shuf_${idx}`, { title: `Stem ${idx}` }));
    googleMusicEngine.playAlbumTracks(tracks, 0, true);

    const state = googleMusicEngine.getState();
    assert.strictEqual(state.isShuffle, true);
    assert.strictEqual(state.isPlaying, true);
    const activeIds = new Set(tracks.map((t) => t.id));
    assert.strictEqual(activeIds.has(googleMusicEngine.getCurrentTrack().id), true);
  });

  test('openPlayerWithAsset loads asset, converts to MusicTrack, and populates queue with siblings', () => {
    const target = makeMediaAsset('drive_target', {
      name: 'Kira - Cloud Horizon.flac',
      extension: 'flac',
      mimeType: 'audio/flac',
      source: 'cloud',
    });
    const sibling = makeMediaAsset('local_sibling', {
      name: 'Desk - Warmth.wav',
      extension: 'wav',
      mimeType: 'audio/wav',
      source: 'local',
      localPath: '/home/user/Music/Desk - Warmth.wav',
    });

    googleMusicEngine.openPlayerWithAsset(target, true, [sibling, target]);

    const current = googleMusicEngine.getCurrentTrack();
    assert.strictEqual(current.id, 'drive_target');
    assert.strictEqual(current.title, 'Cloud Horizon');
    assert.strictEqual(current.artist, 'Kira');
    assert.strictEqual(current.source, 'cloud');
    assert.strictEqual(googleMusicEngine.getState().isPlaying, true);

    googleMusicEngine.prev();
    assert.strictEqual(googleMusicEngine.getCurrentTrack().id, 'local_sibling');
    assert.strictEqual(googleMusicEngine.getCurrentTrack().source, 'local');
  });

  test('onPlayerOpened handshake executes cleanly without throws and preserves state', () => {
    assert.doesNotThrow(() => {
      googleMusicEngine.onPlayerOpened();
    });
    const state = googleMusicEngine.getState();
    assert.ok(['home', 'explore', 'library', 'artist', 'album', 'nowplaying'].includes(state.activeView));
  });

  test('setFilterCategory routes activeView to library for collection pills and home for all', () => {
    googleMusicEngine.setActiveView('home');
    googleMusicEngine.setFilterCategory('albums');
    assert.strictEqual(googleMusicEngine.getState().activeView, 'library');

    googleMusicEngine.setFilterCategory('all');
    assert.strictEqual(googleMusicEngine.getState().activeView, 'home');
  });

  test('setActiveView supports nowplaying stage mode', () => {
    googleMusicEngine.setActiveView('nowplaying');
    assert.strictEqual(googleMusicEngine.getState().activeView, 'nowplaying');
    googleMusicEngine.setActiveView('home');
  });

  test('groupSubAccountsByGoogleAccount groups Drive & Local profiles under their respective Google account emails', () => {
    const groups = groupSubAccountsByGoogleAccount(
      [
        {
          id: 'acc_1',
          name: 'Primary User',
          email: 'user1@studio.example',
          handle: '@user1',
          accountType: 'primary',
        },
        {
          id: 'acc_1_ws',
          name: 'Team Folder',
          email: 'user1@studio.example',
          handle: '@team1',
          accountType: 'workspace_sub',
        },
        {
          id: 'acc_local',
          name: 'Local Session',
          email: 'local@drivetherapy.local',
          handle: '@local',
          accountType: 'local',
        },
      ],
      'user1@studio.example'
    );

    assert.strictEqual(groups.length, 2);
    assert.strictEqual(groups[0].email, 'user1@studio.example');
    assert.strictEqual(groups[0].isPrimary, true);
    assert.strictEqual(groups[0].channels.length, 2);
    assert.strictEqual(groups[1].email, 'local@drivetherapy.local');
    assert.strictEqual(groups[1].isPrimary, false);
  });
});
