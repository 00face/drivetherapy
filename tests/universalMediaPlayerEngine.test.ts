import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { 
  universalMediaPlayer
} from '../src/services/universalMediaPlayerEngine';

describe('Universal Media Player Engine', () => {
  test('identifies FLAC magic header bytes', () => {
    const flacBytes = new Uint8Array([0x66, 0x4c, 0x61, 0x43, 0x00, 0x00, 0x00, 0x22]);
    const res = universalMediaPlayer.detectFormat('audio.flac', flacBytes);
    assert.strictEqual(res.format, 'flac');
    assert.strictEqual(res.mediaType, 'audio');
  });

  test('identifies OGG container magic header bytes', () => {
    const oggBytes = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00]);
    const res = universalMediaPlayer.detectFormat('audio.ogg', oggBytes);
    assert.strictEqual(res.format, 'ogg');
    assert.strictEqual(res.mediaType, 'audio');
  });

  test('identifies MP3 ID3 header and sync frames', () => {
    const id3Bytes = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00]);
    const res = universalMediaPlayer.detectFormat('song.mp3', id3Bytes);
    assert.strictEqual(res.format, 'mp3');
    assert.strictEqual(res.mediaType, 'audio');
  });

  test('identifies WAV/RIFF header bytes', () => {
    const wavBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 
      0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20
    ]);
    const res = universalMediaPlayer.detectFormat('capture.wav', wavBytes);
    assert.strictEqual(res.format, 'wav');
    assert.strictEqual(res.mediaType, 'audio');
  });

  test('identifies MP4/MOV ftyp container', () => {
    const mp4Bytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 
      0x69, 0x73, 0x6f, 0x6d
    ]);
    const res = universalMediaPlayer.detectFormat('take1.mp4', mp4Bytes);
    assert.strictEqual(res.format, 'mp4');
    assert.strictEqual(res.mediaType, 'video');
  });

  test('parses metadata from filenames and buffers', () => {
    const meta = universalMediaPlayer.parseMetadata('Focus_Session_192kHz.flac');
    assert.strictEqual(meta.format, 'flac');
    assert.strictEqual(meta.mediaType, 'audio');
    assert.strictEqual(meta.title, 'Focus_Session_192kHz');
  });

  test('manages gain booster bounds and volume', () => {
    universalMediaPlayer.setVolume(1.25);
    assert.strictEqual(universalMediaPlayer.getState().volume, 1.25);

    // Clamps master gain between 0.0 and 1.5 (150% booster)
    universalMediaPlayer.setVolume(2.5);
    assert.strictEqual(universalMediaPlayer.getState().volume, 1.5);
    universalMediaPlayer.setVolume(-0.5);
    assert.strictEqual(universalMediaPlayer.getState().volume, 0.0);
  });

  test('configures variable playback speed correctly', () => {
    universalMediaPlayer.setPlaybackRate(1.5);
    assert.strictEqual(universalMediaPlayer.getState().playbackRate, 1.5);

    universalMediaPlayer.setPlaybackRate(0.5);
    assert.strictEqual(universalMediaPlayer.getState().playbackRate, 0.5);

    // Clamping limits (up to 3.0x)
    universalMediaPlayer.setPlaybackRate(4.0);
    assert.strictEqual(universalMediaPlayer.getState().playbackRate, 3.0);
  });

  test('configures A-B loop repetition points', () => {
    universalMediaPlayer.setLoopA(10.5);
    universalMediaPlayer.setLoopB(25.0);
    const state = universalMediaPlayer.getState();
    assert.strictEqual(state.loopA, 10.5);
    assert.strictEqual(state.loopB, 25.0);
    assert.strictEqual(state.isLoopActive, true);

    universalMediaPlayer.clearLoop();
    const cleared = universalMediaPlayer.getState();
    assert.strictEqual(cleared.loopA, null);
    assert.strictEqual(cleared.loopB, null);
    assert.strictEqual(cleared.isLoopActive, false);
  });
});
