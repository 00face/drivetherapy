import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCanonicalAlbumUid,
  extractAudioTagsFromBuffer,
  parseFlacTags,
  parseId3v2Tags,
} from '../src/services/music/audioTagReader.ts';
import { buildAllCategoryPlaylists, mapDriveFileToTrack } from '../src/services/music/musicLibrary.ts';

function buildId3v2Frame(id: string, textValue: string): number[] {
  const textBytes = Array.from(Buffer.from(textValue, 'utf8'));
  const payload = [3, ...textBytes]; // UTF-8 encoding byte (3)
  const size = payload.length;
  return [
    ...Array.from(Buffer.from(id, 'ascii')),
    (size >>> 24) & 0xff,
    (size >>> 16) & 0xff,
    (size >>> 8) & 0xff,
    size & 0xff,
    0,
    0,
    ...payload,
  ];
}

function buildTxxxFrame(key: string, val: string): number[] {
  const payload = [3, ...Array.from(Buffer.from(key, 'utf8')), 0, ...Array.from(Buffer.from(val, 'utf8'))];
  const size = payload.length;
  return [
    ...Array.from(Buffer.from('TXXX', 'ascii')),
    (size >>> 24) & 0xff,
    (size >>> 16) & 0xff,
    (size >>> 8) & 0xff,
    size & 0xff,
    0,
    0,
    ...payload,
  ];
}

describe('Google Drive Indexing Speed & Music Player UID Tag / Album Grouping Suite', () => {
  test('ID3v2 parser extracts TIT2, TPE1, TPE2, TALB, TRCK, TYER, TCON and TXXX MusicBrainz Album UID', () => {
    const frames = [
      ...buildId3v2Frame('TIT2', 'Midnight Drive'),
      ...buildId3v2Frame('TPE1', 'The Midnight'),
      ...buildId3v2Frame('TPE2', 'The Midnight'),
      ...buildId3v2Frame('TALB', 'Endless Summer'),
      ...buildId3v2Frame('TRCK', '03/12'),
      ...buildId3v2Frame('TPOS', '1/1'),
      ...buildId3v2Frame('TYER', '2016'),
      ...buildId3v2Frame('TCON', 'Synthwave'),
      ...buildTxxxFrame('MusicBrainz Album Id', 'mb-release-998877'),
    ];
    const tagSize = frames.length;
    const header = [
      0x49,
      0x44,
      0x33,
      3,
      0,
      0,
      (tagSize >>> 21) & 0x7f,
      (tagSize >>> 14) & 0x7f,
      (tagSize >>> 7) & 0x7f,
      tagSize & 0x7f,
    ];
    const buf = new Uint8Array([...header, ...frames]);
    const parsed = parseId3v2Tags(buf);

    assert.equal(parsed.title, 'Midnight Drive');
    assert.equal(parsed.artist, 'The Midnight');
    assert.equal(parsed.albumArtist, 'The Midnight');
    assert.equal(parsed.album, 'Endless Summer');
    assert.equal(parsed.trackNumber, 3);
    assert.equal(parsed.discNumber, 1);
    assert.equal(parsed.year, 2016);
    assert.equal(parsed.genre, 'Synthwave');
    assert.equal(parsed.albumUid, 'mb:mb-release-998877');
    assert.equal(parsed.uidSource, 'musicbrainz');

    const auto = extractAudioTagsFromBuffer(buf, 'song.mp3');
    assert.equal(auto.albumUid, 'mb:mb-release-998877');
  });

  test('FLAC parser extracts STREAMINFO duration and VORBIS_COMMENT MUSICBRAINZ_ALBUMID', () => {
    // 44100 Hz, 441000 samples -> 10 seconds
    const streamInfo = new Uint8Array(34);
    streamInfo[10] = (44100 >> 12) & 0xff;
    streamInfo[11] = (44100 >> 4) & 0xff;
    streamInfo[12] = (44100 & 0x0f) << 4;
    const totalSamples = 441000;
    streamInfo[14] = (totalSamples >>> 24) & 0xff;
    streamInfo[15] = (totalSamples >>> 16) & 0xff;
    streamInfo[16] = (totalSamples >>> 8) & 0xff;
    streamInfo[17] = totalSamples & 0xff;

    const comments = [
      'TITLE=FLAC Master',
      'ARTIST=Analog Band',
      'ALBUM=Studio Sessions',
      'TRACKNUMBER=2',
      'DATE=2024',
      'MUSICBRAINZ_ALBUMID=flac-uuid-42',
    ];
    const commentChunks: number[] = [0, 0, 0, 0]; // 0-len vendor
    commentChunks.push(comments.length, 0, 0, 0);
    for (const c of comments) {
      const b = Array.from(Buffer.from(c, 'utf8'));
      commentChunks.push(b.length & 0xff, (b.length >> 8) & 0xff, (b.length >> 16) & 0xff, (b.length >> 24) & 0xff, ...b);
    }

    const flacBytes = new Uint8Array([
      0x66,
      0x4c,
      0x61,
      0x43,
      0x00,
      0,
      0,
      34,
      ...streamInfo,
      0x84,
      commentChunks.length & 0xff,
      (commentChunks.length >> 8) & 0xff,
      (commentChunks.length >> 16) & 0xff,
      ...commentChunks,
    ]);
    // Fix big-endian blockSize for type 4 header at index 4+4+34
    const type4Off = 4 + 4 + 34;
    flacBytes[type4Off + 1] = (commentChunks.length >> 16) & 0xff;
    flacBytes[type4Off + 2] = (commentChunks.length >> 8) & 0xff;
    flacBytes[type4Off + 3] = commentChunks.length & 0xff;

    const parsed = parseFlacTags(flacBytes);
    assert.equal(parsed.durationSeconds, 10);
    assert.equal(parsed.title, 'FLAC Master');
    assert.equal(parsed.album, 'Studio Sessions');
    assert.equal(parsed.trackNumber, 2);
    assert.equal(parsed.year, 2024);
    assert.equal(parsed.albumUid, 'mb:flac-uuid-42');
  });

  test('Canonical Album UID grouping merges compilation/album tracks and sorts by disc & track number', () => {
    const uid1 = computeCanonicalAlbumUid({
      embeddedUid: 'mb:release-1',
      album: 'Greatest Hits',
      artist: 'Artist A',
    });
    assert.equal(uid1.albumUid, 'mb:release-1');
    assert.equal(uid1.uidSource, 'musicbrainz');

    const folderMap = new Map<string, string>([['fld_1', 'Synth Album']]);
    const t2 = {
      ...mapDriveFileToTrack({ id: 'f2', name: 'Artist B - Track Two.mp3', parents: ['fld_1'] }, folderMap),
      albumUid: 'mb:release-1',
      uidSource: 'musicbrainz' as const,
      album: 'Compilation Vol. 1',
      albumArtist: 'Various Artists',
      trackNumber: 2,
      discNumber: 1,
    };
    const t1 = {
      ...mapDriveFileToTrack({ id: 'f1', name: 'Artist A - Track One.mp3', parents: ['fld_1'] }, folderMap),
      albumUid: 'mb:release-1',
      uidSource: 'musicbrainz' as const,
      album: 'Compilation Vol. 1',
      albumArtist: 'Various Artists',
      trackNumber: 1,
      discNumber: 1,
    };

    const playlists = buildAllCategoryPlaylists({
      tracks: [t2, t1],
      accountName: 'Tester',
    });
    const albums = playlists.filter((p) => p.category === 'albums');
    assert.equal(albums.length, 1, 'Tracks sharing Album UID should group into 1 canonical album');
    assert.equal(albums[0].tracks[0].trackNumber, 1, 'Album tracks should sort by trackNumber ascending');
    assert.equal(albums[0].tracks[1].trackNumber, 2);
    assert.equal(albums[0].author, 'Various Artists');
  });
});
