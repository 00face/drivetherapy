/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dependency-Free Binary Audio Container Tag & UID Reader
 * Extracts embedded metadata and MusicBrainz / UFID / Release UIDs from the first ~64 KB of:
 *  - MP3 ID3v2.2 / ID3v2.3 / ID3v2.4 (TIT2, TPE1, TPE2, TALB, TRCK, TPOS, TYER, TDRC, TCON, UFID, TXXX)
 *  - FLAC (fLaC STREAMINFO sampleRate & totalSamples -> duration, VORBIS_COMMENT -> tags & MUSICBRAINZ_ALBUMID)
 *  - MP4 / M4A (moov/udta/meta/ilst -> ©nam, ©ART, aART, ©alb, trkn, disk, ©day, ©gen, MusicBrainz Album Id)
 */

export interface AudioTagMetadata {
  title?: string;
  artist?: string;
  albumArtist?: string;
  album?: string;
  trackNumber?: number;
  discNumber?: number;
  year?: number;
  genre?: string;
  durationSeconds?: number;
  albumUid?: string;
  trackUid?: string;
  uidSource?: 'musicbrainz' | 'ufid' | 'discogs' | 'tag-composite' | 'folder';
}

function decodeTextBytes(bytes: Uint8Array, encodingByte: number): string {
  try {
    if (encodingByte === 1 || encodingByte === 2) {
      // UTF-16 with or without BOM
      const isLe = bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe;
      const isBe = bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff;
      const start = isLe || isBe ? 2 : 0;
      const decoder = new TextDecoder(isBe || encodingByte === 2 ? 'utf-16be' : 'utf-16le', {
        fatal: false,
      });
      return decoder.decode(bytes.subarray(start)).replace(/\0+$/g, '').trim();
    }
    return new TextDecoder('utf-8', { fatal: false })
      .decode(bytes)
      .replace(/\0+$/g, '')
      .trim();
  } catch {
    return '';
  }
}

function readSynchsafeInt(b0: number, b1: number, b2: number, b3: number): number {
  return ((b0 & 0x7f) << 21) | ((b1 & 0x7f) << 14) | ((b2 & 0x7f) << 7) | (b3 & 0x7f);
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function parseSlashNumber(raw: string): number | undefined {
  const num = parseInt((raw || '').split('/')[0].trim(), 10);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

function parseYear(raw: string): number | undefined {
  const m = (raw || '').match(/\b(19\d{2}|20\d{2})\b/);
  return m ? parseInt(m[1], 10) : undefined;
}

/**
 * Parse ID3v2.3 / ID3v2.4 header + frames including UFID and TXXX MusicBrainz Album IDs.
 */
export function parseId3v2Tags(bytes: Uint8Array): AudioTagMetadata {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return {};
  }
  const majorVer = bytes[3];
  if (majorVer < 3 || majorVer > 4) return {};
  const tagSize = readSynchsafeInt(bytes[6], bytes[7], bytes[8], bytes[9]);
  const limit = Math.min(bytes.length, 10 + tagSize);

  const meta: AudioTagMetadata = {};
  let offset = 10;
  // Skip optional extended header
  if ((bytes[5] & 0x40) !== 0 && offset + 4 <= limit) {
    const extSize =
      majorVer === 4
        ? readSynchsafeInt(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
        : readUint32BE(bytes, offset);
    offset += Math.max(4, extSize);
  }

  while (offset + 10 <= limit) {
    const frameId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break;

    const frameSize =
      majorVer === 4
        ? readSynchsafeInt(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])
        : readUint32BE(bytes, offset + 4);
    offset += 10;
    if (frameSize <= 0 || offset + frameSize > limit) break;

    const payload = bytes.subarray(offset, offset + frameSize);
    offset += frameSize;

    if (frameId === 'UFID') {
      const nul = payload.indexOf(0);
      if (nul > 0 && nul + 1 < payload.length) {
        const owner = new TextDecoder('ascii').decode(payload.subarray(0, nul)).trim();
        const uidVal = new TextDecoder('utf-8', { fatal: false })
          .decode(payload.subarray(nul + 1))
          .replace(/\0+$/g, '')
          .trim();
        if (uidVal) {
          meta.trackUid = uidVal;
          if (!meta.albumUid && owner.toLowerCase().includes('musicbrainz')) {
            meta.albumUid = `mb:${uidVal}`;
            meta.uidSource = 'musicbrainz';
          } else if (!meta.albumUid) {
            meta.albumUid = `ufid:${uidVal}`;
            meta.uidSource = 'ufid';
          }
        }
      }
      continue;
    }

    if (frameId === 'TXXX' && payload.length > 2) {
      const enc = payload[0];
      const body = payload.subarray(1);
      const nul = body.indexOf(0);
      if (nul >= 0) {
        const key = decodeTextBytes(body.subarray(0, nul), enc).toLowerCase();
        const val = decodeTextBytes(body.subarray(nul + 1), enc);
        if (val && (key.includes('musicbrainz album id') || key === 'musicbrainz_albumid')) {
          meta.albumUid = `mb:${val}`;
          meta.uidSource = 'musicbrainz';
        } else if (val && key.includes('discogs_release_id')) {
          meta.albumUid = meta.albumUid || `discogs:${val}`;
          meta.uidSource = meta.uidSource || 'discogs';
        } else if (val && (key === 'albumartist' || key === 'album artist')) {
          meta.albumArtist = meta.albumArtist || val;
        }
      }
      continue;
    }

    if (frameId.startsWith('T') && payload.length > 1) {
      const val = decodeTextBytes(payload.subarray(1), payload[0]);
      if (!val) continue;
      if (frameId === 'TIT2') meta.title = val;
      else if (frameId === 'TPE1') meta.artist = val;
      else if (frameId === 'TPE2') meta.albumArtist = val;
      else if (frameId === 'TALB') meta.album = val;
      else if (frameId === 'TRCK') meta.trackNumber = parseSlashNumber(val);
      else if (frameId === 'TPOS') meta.discNumber = parseSlashNumber(val);
      else if (frameId === 'TYER' || frameId === 'TDRC') meta.year = parseYear(val);
      else if (frameId === 'TCON') meta.genre = val;
    }
  }

  return meta;
}

/**
 * Parse FLAC STREAMINFO (duration) + VORBIS_COMMENT metadata blocks.
 */
export function parseFlacTags(bytes: Uint8Array): AudioTagMetadata {
  if (bytes.length < 8 || bytes[0] !== 0x66 || bytes[1] !== 0x4c || bytes[2] !== 0x61 || bytes[3] !== 0x43) {
    return {};
  }
  const meta: AudioTagMetadata = {};
  let offset = 4;
  let isLast = false;

  while (!isLast && offset + 4 <= bytes.length) {
    const header = bytes[offset];
    isLast = (header & 0x80) !== 0;
    const blockType = header & 0x7f;
    const blockSize = (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += 4;
    if (offset + blockSize > bytes.length) break;

    const block = bytes.subarray(offset, offset + blockSize);
    offset += blockSize;

    // Type 0: STREAMINFO -> sampleRate & totalSamples
    if (blockType === 0 && block.length >= 18) {
      const sampleRate = (block[10] << 12) | (block[11] << 4) | (block[12] >> 4);
      const totalSamplesHigh = block[13] & 0x0f;
      const totalSamplesLow = readUint32BE(block, 14);
      const totalSamples = totalSamplesHigh * 4294967296 + totalSamplesLow;
      if (sampleRate > 0 && totalSamples > 0) {
        meta.durationSeconds = Math.round(totalSamples / sampleRate);
      }
    }

    // Type 4: VORBIS_COMMENT
    if (blockType === 4 && block.length >= 8) {
      let pos = 0;
      const vendorLen = readUint32LE(block, pos);
      pos += 4 + vendorLen;
      if (pos + 4 > block.length) continue;
      const commentCount = readUint32LE(block, pos);
      pos += 4;

      for (let i = 0; i < commentCount && pos + 4 <= block.length; i++) {
        const len = readUint32LE(block, pos);
        pos += 4;
        if (pos + len > block.length) break;
        const entry = new TextDecoder('utf-8', { fatal: false }).decode(block.subarray(pos, pos + len));
        pos += len;
        const eq = entry.indexOf('=');
        if (eq <= 0) continue;
        const key = entry.slice(0, eq).toUpperCase();
        const val = entry.slice(eq + 1).trim();
        if (!val) continue;

        if (key === 'TITLE') meta.title = val;
        else if (key === 'ARTIST') meta.artist = val;
        else if (key === 'ALBUMARTIST' || key === 'ALBUM ARTIST') meta.albumArtist = val;
        else if (key === 'ALBUM') meta.album = val;
        else if (key === 'TRACKNUMBER') meta.trackNumber = parseSlashNumber(val);
        else if (key === 'DISCNUMBER') meta.discNumber = parseSlashNumber(val);
        else if (key === 'DATE' || key === 'YEAR') meta.year = parseYear(val);
        else if (key === 'GENRE') meta.genre = val;
        else if (key === 'MUSICBRAINZ_ALBUMID') {
          meta.albumUid = `mb:${val}`;
          meta.uidSource = 'musicbrainz';
        } else if (key === 'MUSICBRAINZ_TRACKID') {
          meta.trackUid = val;
        }
      }
    }
  }

  return meta;
}

/**
 * Parse MP4 / M4A iTunes `ilst` metadata atoms within `moov`.
 */
export function parseMp4Tags(bytes: Uint8Array): AudioTagMetadata {
  const textMarker = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 65536)));
  if (!textMarker.includes('ftyp') && !textMarker.includes('moov')) return {};

  const meta: AudioTagMetadata = {};
  const atomTags: Array<[string, keyof AudioTagMetadata]> = [
    ['\u00a9nam', 'title'],
    ['\u00a9ART', 'artist'],
    ['aART', 'albumArtist'],
    ['\u00a9alb', 'album'],
    ['\u00a9gen', 'genre'],
  ];

  for (const [atom, field] of atomTags) {
    const idx = textMarker.indexOf(atom);
    if (idx < 0) continue;
    const dataIdx = textMarker.indexOf('data', idx);
    if (dataIdx < 0 || dataIdx - idx > 128 || dataIdx + 12 >= bytes.length) continue;
    const size = readUint32BE(bytes, dataIdx - 4);
    const payloadStart = dataIdx + 12;
    const payloadEnd = Math.min(bytes.length, dataIdx - 4 + size);
    if (payloadEnd > payloadStart) {
      const val = new TextDecoder('utf-8', { fatal: false })
        .decode(bytes.subarray(payloadStart, payloadEnd))
        .replace(/\0+$/g, '')
        .trim();
      if (val) (meta as Record<string, unknown>)[field] = val;
    }
  }

  const dayIdx = textMarker.indexOf('\u00a9day');
  if (dayIdx >= 0) {
    const dataIdx = textMarker.indexOf('data', dayIdx);
    if (dataIdx >= 0 && dataIdx + 12 < bytes.length) {
      const yrText = new TextDecoder('utf-8', { fatal: false }).decode(
        bytes.subarray(dataIdx + 12, Math.min(bytes.length, dataIdx + 24))
      );
      meta.year = parseYear(yrText);
    }
  }

  const trknIdx = textMarker.indexOf('trkn');
  if (trknIdx >= 0) {
    const dataIdx = textMarker.indexOf('data', trknIdx);
    if (dataIdx >= 0 && dataIdx + 16 <= bytes.length) {
      const trk = (bytes[dataIdx + 14] << 8) | bytes[dataIdx + 15];
      if (trk > 0 && trk < 999) meta.trackNumber = trk;
    }
  }

  return meta;
}

export function extractAudioTagsFromBuffer(bytes: Uint8Array, filename = ''): AudioTagMetadata {
  if (!bytes || bytes.length < 8) return {};
  const ext = (filename.split('.').pop() || '').toLowerCase();

  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return parseId3v2Tags(bytes);
  }
  if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return parseFlacTags(bytes);
  }
  if (ext === 'm4a' || ext === 'mp4' || ext === 'aac' || bytes[4] === 0x66) {
    return parseMp4Tags(bytes);
  }
  return {};
}

/**
 * Computes a deterministic canonical Album UID for accurate album grouping:
 *  1) Embedded MusicBrainz / UFID / Discogs Release UID
 *  2) Normalized AlbumArtist + Album (+ Year) composite UID
 *  3) Folder ID / path fallback so un-tagged directories never collapse into 'Drive Collection'
 */
export function computeCanonicalAlbumUid(params: {
  embeddedUid?: string;
  album?: string;
  albumArtist?: string;
  artist?: string;
  year?: number;
  folderIdOrPath?: string;
}): { albumUid: string; uidSource: NonNullable<AudioTagMetadata['uidSource']> } {
  if (params.embeddedUid && params.embeddedUid.trim()) {
    const clean = params.embeddedUid.trim();
    const uidSource: NonNullable<AudioTagMetadata['uidSource']> = clean.startsWith('mb:')
      ? 'musicbrainz'
      : clean.startsWith('discogs:')
      ? 'discogs'
      : 'ufid';
    return { albumUid: clean, uidSource };
  }

  const norm = (s?: string) =>
    (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const albumSlug = norm(params.album);
  const artistSlug = norm(params.albumArtist || params.artist);

  if (
    albumSlug &&
    albumSlug !== 'drive-collection' &&
    albumSlug !== 'local-music' &&
    albumSlug !== 'media-library'
  ) {
    const yr = params.year ? `-${params.year}` : '';
    const who = artistSlug && artistSlug !== 'unknown-artist' ? artistSlug : 'various';
    return { albumUid: `alb:${who}:${albumSlug}${yr}`, uidSource: 'tag-composite' };
  }

  if (params.folderIdOrPath) {
    return { albumUid: `fld:${norm(params.folderIdOrPath)}`, uidSource: 'folder' };
  }

  return { albumUid: `alb:collection:default`, uidSource: 'folder' };
}
