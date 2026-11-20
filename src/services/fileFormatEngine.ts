/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drive Therapy Universal File Metadata & Classification Engine
 * Fast O(1) indexed accessor over the flat-file format database (`fileFormatsDatabase.json`),
 * binary magic-byte & container sniffer, and dependency-free header metadata extractor.
 */

import rawDatabase from '../data/fileFormatsDatabase.json';
import type {
  FileClassificationResult,
  FileFormatDatabaseDocument,
  FileFormatDefinition,
  FormatDatabaseStats,
  UniversalFileMetadata,
} from '../types/fileFormats';
import type { MediaCategory } from '../types';

const COMPOUND_EXTENSIONS = ['TAR.GZ', 'TAR.BZ2', 'TAR.XZ', 'TAR.ZST'] as const;

const FALLBACK_BINARY_FORMAT: FileFormatDefinition = {
  extension: 'BIN',
  aliases: [],
  name: 'Unknown / Binary Data File',
  family: 'system_other',
  category: 'data',
  mimeTypes: ['application/octet-stream'],
  magicSignatures: [],
  metadataParsers: ['binary-header'],
  viewer: 'hex-inspector',
  editor: 'none',
  isStreamable: false,
  preservationGrade: 'Legacy',
  description: 'Unclassified binary or custom file extension.',
};

const databaseDoc: FileFormatDatabaseDocument = rawDatabase as FileFormatDatabaseDocument;
let runtimeFormats: FileFormatDefinition[] = [...(databaseDoc.formats || [])];

const extensionMap = new Map<string, FileFormatDefinition>();
const mimeMap = new Map<string, FileFormatDefinition>();

function rebuildIndexes(list: FileFormatDefinition[]): void {
  extensionMap.clear();
  mimeMap.clear();

  for (const item of list) {
    const primary = item.extension.toUpperCase();
    extensionMap.set(primary, item);
    for (const alias of item.aliases || []) {
      extensionMap.set(alias.toUpperCase(), item);
    }
    for (const rawMime of item.mimeTypes || []) {
      const normalized = rawMime.split(';')[0].trim().toLowerCase();
      if (normalized && !mimeMap.has(normalized)) {
        mimeMap.set(normalized, item);
      }
    }
  }
}

rebuildIndexes(runtimeFormats);

function extractExtensions(filenameOrExt: string): { primary: string; compound: string | null } {
  const cleaned = (filenameOrExt || '').trim();
  if (!cleaned) return { primary: '', compound: null };

  const base = cleaned.split('/').pop()?.split('\\').pop() || cleaned;
  const upperBase = base.toUpperCase();

  // Handle extensionless conventions like Dockerfile / Makefile
  if (!upperBase.includes('.')) {
    if (extensionMap.has(upperBase)) {
      return { primary: upperBase, compound: null };
    }
    return { primary: upperBase, compound: null };
  }

  for (const comp of COMPOUND_EXTENSIONS) {
    if (upperBase.endsWith(`.${comp}`)) {
      return { primary: comp.split('.').pop() || comp, compound: comp };
    }
  }

  const lastDot = upperBase.lastIndexOf('.');
  if (lastDot === 0) {
    // Dotfiles like .env or .gitignore
    const dotName = upperBase.slice(1);
    return { primary: dotName, compound: null };
  }

  const ext = upperBase.slice(lastDot + 1);
  return { primary: ext, compound: null };
}

function bytesMatch(buf: Uint8Array, offset: number, pattern: number[]): boolean {
  if (offset < 0 || buf.length < offset + pattern.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (buf[offset + i] !== pattern[i]) return false;
  }
  return true;
}

function asciiAt(buf: Uint8Array, offset: number, length: number): string {
  if (offset < 0 || buf.length < offset + length) return '';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += String.fromCharCode(buf[offset + i]);
  }
  return out;
}

/**
 * Inspects leading binary magic bytes & container sub-brands (RIFF, ISO-BMFF, TIFF/RAW, EBML, ZIP/OPC).
 */
export function sniffMagicBytes(headerBytes?: Uint8Array, filename = ''): FileFormatDefinition | null {
  if (!headerBytes || headerBytes.length < 2) return null;
  const { primary } = extractExtensions(filename);

  // 1. PNG (89 50 4E 47 0D 0A 1A 0A)
  if (bytesMatch(headerBytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return extensionMap.get(primary === 'APNG' ? 'APNG' : 'PNG') || null;
  }

  // 2. JPEG (FF D8 FF)
  if (bytesMatch(headerBytes, 0, [0xff, 0xd8, 0xff])) {
    return extensionMap.get('JPG') || null;
  }

  // 3. GIF (GIF87a / GIF89a)
  if (bytesMatch(headerBytes, 0, [0x47, 0x49, 0x46, 0x38])) {
    return extensionMap.get('GIF') || null;
  }

  // 4. RIFF Container (WEBP, WAV, AVI)
  if (bytesMatch(headerBytes, 0, [0x52, 0x49, 0x46, 0x46]) && headerBytes.length >= 12) {
    const fourcc = asciiAt(headerBytes, 8, 4);
    if (fourcc === 'WEBP') return extensionMap.get('WEBP') || null;
    if (fourcc === 'WAVE') return extensionMap.get('WAV') || null;
    if (fourcc === 'AVI ') return extensionMap.get('AVI') || null;
  }

  // 5. ISO-BMFF Container ('ftyp' at offset 4)
  if (bytesMatch(headerBytes, 4, [0x66, 0x74, 0x79, 0x70]) && headerBytes.length >= 12) {
    const brand = asciiAt(headerBytes, 8, 4);
    if (brand === 'crx ') return extensionMap.get('CR3') || null;
    if (['heic', 'heix', 'hevc', 'mif1', 'msf1'].includes(brand)) return extensionMap.get('HEIC') || null;
    if (brand === 'avif' || brand === 'avis') return extensionMap.get('AVIF') || null;
    if (brand === 'qt  ') return extensionMap.get('MOV') || null;
    if (['M4A ', 'M4B ', 'M4P ', 'F4A '].includes(brand)) return extensionMap.get('M4A') || null;
    if (brand.startsWith('3gp') || brand.startsWith('3g2')) return extensionMap.get('3GP') || null;
    if (primary === 'MOV' || primary === 'M4A' || primary === '3GP') {
      return extensionMap.get(primary) || null;
    }
    return extensionMap.get('MP4') || null;
  }

  // 6. Camera RAW & TIFF Containers
  if (bytesMatch(headerBytes, 0, [0x46, 0x55, 0x4a, 0x49, 0x46, 0x49, 0x4c, 0x4d])) {
    return extensionMap.get('RAF') || null;
  }
  if (bytesMatch(headerBytes, 0, [0x49, 0x49, 0x55, 0x00])) {
    return extensionMap.get('RW2') || null;
  }
  if (bytesMatch(headerBytes, 0, [0x49, 0x49, 0x52, 0x4f])) {
    return extensionMap.get('ORF') || null;
  }
  if (bytesMatch(headerBytes, 6, [0x48, 0x45, 0x41, 0x50, 0x43, 0x43, 0x44, 0x52])) {
    return extensionMap.get('CRW') || null;
  }
  if (bytesMatch(headerBytes, 0, [0x46, 0x4f, 0x56, 0x62])) {
    return extensionMap.get('X3F') || null;
  }
  if (
    bytesMatch(headerBytes, 0, [0x49, 0x49, 0x2a, 0x00]) ||
    bytesMatch(headerBytes, 0, [0x4d, 0x4d, 0x00, 0x2a])
  ) {
    if (bytesMatch(headerBytes, 8, [0x43, 0x52])) return extensionMap.get('CR2') || null;
    const rawHint = extensionMap.get(primary);
    if (rawHint && rawHint.category === 'raw') return rawHint;
    return extensionMap.get('TIFF') || null;
  }

  // 7. Other Raster / Design Images
  if (bytesMatch(headerBytes, 0, [0x38, 0x42, 0x50, 0x53])) return extensionMap.get('PSD') || null;
  if (bytesMatch(headerBytes, 0, [0x42, 0x4d])) return extensionMap.get('BMP') || null;
  if (bytesMatch(headerBytes, 0, [0x00, 0x00, 0x01, 0x00])) return extensionMap.get('ICO') || null;
  if (bytesMatch(headerBytes, 0, [0x69, 0x63, 0x6e, 0x73])) return extensionMap.get('ICNS') || null;
  if (bytesMatch(headerBytes, 0, [0x76, 0x2f, 0x31, 0x01])) return extensionMap.get('EXR') || null;
  if (bytesMatch(headerBytes, 0, [0x23, 0x3f, 0x52, 0x41, 0x44, 0x49, 0x41, 0x4e])) return extensionMap.get('HDR') || null;
  if (bytesMatch(headerBytes, 0, [0x71, 0x6f, 0x69, 0x66])) return extensionMap.get('QOI') || null;
  if (bytesMatch(headerBytes, 0, [0xff, 0x0a]) || bytesMatch(headerBytes, 0, [0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20])) {
    return extensionMap.get('JXL') || null;
  }
  if (bytesMatch(headerBytes, 0, [0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20])) return extensionMap.get('JP2') || null;
  if (bytesMatch(headerBytes, 0, [0x44, 0x44, 0x53, 0x20])) return extensionMap.get('DDS') || null;
  if (bytesMatch(headerBytes, 0, [0xab, 0x4b, 0x54, 0x58])) return extensionMap.get('KTX') || null;

  // 8. EBML (Matroska MKV / WebM)
  if (bytesMatch(headerBytes, 0, [0x1a, 0x45, 0xdf, 0xa3])) {
    if (primary === 'WEBM' || primary === 'WEBA') return extensionMap.get(primary) || null;
    const headerAscii = asciiAt(headerBytes, 0, Math.min(headerBytes.length, 64)).toLowerCase();
    if (headerAscii.includes('webm')) return extensionMap.get('WEBM') || null;
    return extensionMap.get('MKV') || null;
  }

  // 9. Audio & Video Binary Containers
  if (bytesMatch(headerBytes, 0, [0x66, 0x4c, 0x61, 0x43])) return extensionMap.get('FLAC') || null;
  if (bytesMatch(headerBytes, 0, [0x4f, 0x67, 0x67, 0x53])) {
    if (primary === 'OPUS' || primary === 'OGV' || primary === 'SPX') {
      return extensionMap.get(primary) || null;
    }
    return extensionMap.get('OGG') || null;
  }
  if (bytesMatch(headerBytes, 0, [0x46, 0x4f, 0x52, 0x4d]) && asciiAt(headerBytes, 8, 4) === 'AIFF') {
    return extensionMap.get('AIFF') || null;
  }
  if (bytesMatch(headerBytes, 0, [0x4d, 0x54, 0x68, 0x64])) return extensionMap.get('MID') || null;
  if (bytesMatch(headerBytes, 0, [0x46, 0x4c, 0x56, 0x01])) return extensionMap.get('FLV') || null;
  if (bytesMatch(headerBytes, 0, [0x06, 0x0e, 0x2b, 0x34])) return extensionMap.get('MXF') || null;
  if (
    bytesMatch(headerBytes, 0, [0x49, 0x44, 0x33]) ||
    (headerBytes.length >= 2 && headerBytes[0] === 0xff && (headerBytes[1] & 0xe0) === 0xe0 && (primary === 'MP3' || primary === ''))
  ) {
    return extensionMap.get('MP3') || null;
  }

  // MPEG Transport Stream 188-byte packet sync (disambiguates .ts video vs TypeScript)
  if (
    headerBytes.length >= 377 &&
    headerBytes[0] === 0x47 &&
    headerBytes[188] === 0x47 &&
    headerBytes[376] === 0x47
  ) {
    return extensionMap.get('MTS') || null;
  }

  // 10. Documents, Databases & Structured Formats
  if (bytesMatch(headerBytes, 0, [0x25, 0x50, 0x44, 0x46, 0x2d])) return extensionMap.get('PDF') || null;
  if (bytesMatch(headerBytes, 0, [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00])) {
    return extensionMap.get('SQLITE') || null;
  }
  if (bytesMatch(headerBytes, 0, [0x50, 0x41, 0x52, 0x31])) return extensionMap.get('PARQUET') || null;
  if (bytesMatch(headerBytes, 0, [0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a])) return extensionMap.get('HDF5') || null;
  if (bytesMatch(headerBytes, 0, [0x53, 0x49, 0x4d, 0x50, 0x4c, 0x45, 0x20, 0x20, 0x3d])) return extensionMap.get('FITS') || null;

  // 11. Archives & OPC ZIP Packages
  if (bytesMatch(headerBytes, 0, [0x50, 0x4b, 0x03, 0x04]) || bytesMatch(headerBytes, 0, [0x50, 0x4b, 0x05, 0x06])) {
    const extMatch = extensionMap.get(primary);
    if (extMatch && ['OPC / ZIP', 'EPUB', 'ZIP'].includes(extMatch.containerFormat || extMatch.extension)) {
      return extMatch;
    }
    if (extMatch && (extMatch.family === 'ebook' || extMatch.family === 'document' || extMatch.family === 'spreadsheet' || extMatch.family === 'presentation' || extMatch.family === 'executable_package' || extMatch.family === 'design_layout' || extMatch.extension === 'KMZ')) {
      return extMatch;
    }
    return extensionMap.get('ZIP') || null;
  }
  if (bytesMatch(headerBytes, 0, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return extensionMap.get('7Z') || null;
  if (bytesMatch(headerBytes, 0, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) return extensionMap.get('RAR') || null;
  if (bytesMatch(headerBytes, 0, [0x1f, 0x8b, 0x08])) return extensionMap.get('GZ') || null;
  if (bytesMatch(headerBytes, 0, [0x42, 0x5a, 0x68])) return extensionMap.get('BZ2') || null;
  if (bytesMatch(headerBytes, 0, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00])) return extensionMap.get('XZ') || null;
  if (bytesMatch(headerBytes, 0, [0x28, 0xb5, 0x2f, 0xfd])) return extensionMap.get('ZST') || null;
  if (bytesMatch(headerBytes, 257, [0x75, 0x73, 0x74, 0x61, 0x72])) return extensionMap.get('TAR') || null;

  // 12. Binaries, Fonts, 3D & Sidecars
  if (bytesMatch(headerBytes, 0, [0x00, 0x61, 0x73, 0x6d])) return extensionMap.get('WASM') || null;
  if (bytesMatch(headerBytes, 0, [0x7f, 0x45, 0x4c, 0x46])) return extensionMap.get('ELF') || null;
  if (bytesMatch(headerBytes, 0, [0x4d, 0x5a])) return extensionMap.get('EXE') || null;
  if (bytesMatch(headerBytes, 0, [0x67, 0x6c, 0x54, 0x46])) return extensionMap.get('GLB') || null;
  if (bytesMatch(headerBytes, 0, [0x77, 0x4f, 0x46, 0x32])) return extensionMap.get('WOFF2') || null;
  if (bytesMatch(headerBytes, 0, [0x77, 0x4f, 0x46, 0x46])) return extensionMap.get('WOFF') || null;
  if (bytesMatch(headerBytes, 0, [0x4f, 0x54, 0x54, 0x4f])) return extensionMap.get('OTF') || null;
  if (bytesMatch(headerBytes, 0, [0x00, 0x01, 0x00, 0x00])) {
    const extMatch = extensionMap.get(primary);
    if (!extMatch || extMatch.family === 'font') return extensionMap.get('TTF') || null;
  }
  if (bytesMatch(headerBytes, 36, [0x61, 0x63, 0x73, 0x70])) return extensionMap.get('ICC') || null;

  // 13. XML / SVG sniffing when header begins with markup
  const trimSample = asciiAt(headerBytes, 0, Math.min(headerBytes.length, 160)).trimStart().toLowerCase();
  if (trimSample.startsWith('<svg') || (trimSample.startsWith('<?xml') && trimSample.includes('<svg'))) {
    return extensionMap.get('SVG') || null;
  }
  if (trimSample.startsWith('<?xml') && (!primary || !extensionMap.has(primary))) {
    return extensionMap.get('XML') || null;
  }

  return null;
}

/**
 * O(1) lookup against canonical extensions, compound extensions, aliases, and MIME types.
 */
export function lookupFileFormat(filenameOrExt: string, mimeType?: string): FileFormatDefinition {
  const { primary, compound } = extractExtensions(filenameOrExt);

  if (compound && extensionMap.has(compound)) {
    return extensionMap.get(compound)!;
  }

  // Prioritize Google Workspace native MIME types cleanly
  const cleanMime = (mimeType || '').split(';')[0].trim().toLowerCase();
  if (cleanMime.startsWith('application/vnd.google-apps.') && mimeMap.has(cleanMime)) {
    return mimeMap.get(cleanMime)!;
  }

  if (primary && extensionMap.has(primary)) {
    return extensionMap.get(primary)!;
  }

  if (cleanMime && mimeMap.has(cleanMime)) {
    return mimeMap.get(cleanMime)!;
  }

  return FALLBACK_BINARY_FORMAT;
}

function formatHexPreview(bytes?: Uint8Array, limit = 64): { hex: string; ascii: string } {
  if (!bytes || bytes.length === 0) return { hex: '', ascii: '' };
  const slice = bytes.subarray(0, Math.min(bytes.length, limit));
  const hexParts: string[] = [];
  let ascii = '';
  for (let i = 0; i < slice.length; i++) {
    hexParts.push(slice[i].toString(16).toUpperCase().padStart(2, '0'));
    const c = slice[i];
    ascii += c >= 32 && c <= 126 ? String.fromCharCode(c) : '.';
  }
  return { hex: hexParts.join(' '), ascii };
}

/**
 * Dependency-free technical metadata parser reading binary container headers and text samples.
 */
export function extractUniversalFileMetadata(input: {
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
  modifiedTime?: string;
  headerBytes?: Uint8Array;
  textSample?: string;
  detectedBy?: UniversalFileMetadata['detectedBy'];
  format?: FileFormatDefinition;
}): UniversalFileMetadata {
  const fmt = input.format || lookupFileFormat(input.filename, input.mimeType);
  const { primary } = extractExtensions(input.filename);
  const header = input.headerBytes;

  const meta: UniversalFileMetadata = {
    extension: primary || fmt.extension,
    mimeType: input.mimeType || fmt.mimeTypes[0] || 'application/octet-stream',
    sizeBytes: input.sizeBytes,
    modifiedTime: input.modifiedTime,
    detectedBy: input.detectedBy || 'extension',
  };

  if (header && header.length > 0) {
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    const { hex, ascii } = formatHexPreview(header, 64);
    meta.headerHexPreview = hex;
    meta.headerAsciiPreview = ascii;

    // PNG IHDR parser
    if (bytesMatch(header, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) && header.length >= 26) {
      meta.width = view.getUint32(16, false);
      meta.height = view.getUint32(20, false);
      meta.dimensions = `${meta.width} × ${meta.height}`;
      meta.bitDepth = view.getUint8(24);
      const colorCode = view.getUint8(25);
      const colorNames: Record<number, string> = {
        0: 'Grayscale',
        2: 'RGB',
        3: 'Indexed',
        4: 'Grayscale+Alpha',
        6: 'RGBA',
      };
      meta.colorType = colorNames[colorCode] || `PNG Type ${colorCode}`;
    }

    // GIF LSD parser
    else if (bytesMatch(header, 0, [0x47, 0x49, 0x46, 0x38]) && header.length >= 10) {
      meta.width = view.getUint16(6, true);
      meta.height = view.getUint16(8, true);
      meta.dimensions = `${meta.width} × ${meta.height}`;
      meta.bitDepth = (header[10] & 0x07) + 1;
    }

    // BMP DIB parser
    else if (bytesMatch(header, 0, [0x42, 0x4d]) && header.length >= 30) {
      meta.width = view.getInt32(18, true);
      meta.height = Math.abs(view.getInt32(22, true));
      meta.dimensions = `${meta.width} × ${meta.height}`;
      meta.bitDepth = view.getUint16(28, true);
    }

    // JPEG SOF0/SOF1/SOF2 dimensions parser
    else if (bytesMatch(header, 0, [0xff, 0xd8, 0xff])) {
      let offset = 2;
      while (offset + 9 < header.length) {
        if (header[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = header[offset + 1];
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          meta.bitDepth = header[offset + 4];
          meta.height = view.getUint16(offset + 5, false);
          meta.width = view.getUint16(offset + 7, false);
          meta.dimensions = `${meta.width} × ${meta.height}`;
          break;
        }
        if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
          offset += 2;
        } else if (offset + 4 < header.length) {
          const segLen = view.getUint16(offset + 2, false);
          if (segLen < 2) break;
          offset += 2 + segLen;
        } else {
          break;
        }
      }
    }

    // WebP dimensions parser
    else if (bytesMatch(header, 0, [0x52, 0x49, 0x46, 0x46]) && asciiAt(header, 8, 4) === 'WEBP' && header.length >= 30) {
      const subChunk = asciiAt(header, 12, 4);
      if (subChunk === 'VP8X') {
        const wMinus1 = header[24] | (header[25] << 8) | (header[26] << 16);
        const hMinus1 = header[27] | (header[28] << 8) | (header[29] << 16);
        meta.width = wMinus1 + 1;
        meta.height = hMinus1 + 1;
        meta.dimensions = `${meta.width} × ${meta.height}`;
      } else if (subChunk === 'VP8L' && header[20] === 0x2f) {
        const b0 = header[21];
        const b1 = header[22];
        const b2 = header[23];
        const b3 = header[24];
        meta.width = 1 + (((b1 & 0x3f) << 8) | b0);
        meta.height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
        meta.dimensions = `${meta.width} × ${meta.height}`;
      } else if (subChunk === 'VP8 ') {
        meta.width = view.getUint16(26, true) & 0x3fff;
        meta.height = view.getUint16(28, true) & 0x3fff;
        meta.dimensions = `${meta.width} × ${meta.height}`;
      }
    }

    // WAV RIFF header parser
    else if (bytesMatch(header, 0, [0x52, 0x49, 0x46, 0x46]) && asciiAt(header, 8, 4) === 'WAVE' && header.length >= 44) {
      let pos = 12;
      let byteRate = 0;
      let dataSize = 0;
      while (pos + 8 <= header.length) {
        const chunkId = asciiAt(header, pos, 4);
        const chunkSize = view.getUint32(pos + 4, true);
        if (chunkId === 'fmt ' && pos + 24 <= header.length) {
          meta.channels = view.getUint16(pos + 10, true);
          meta.sampleRateHz = view.getUint32(pos + 12, true);
          byteRate = view.getUint32(pos + 16, true);
          meta.bitDepth = view.getUint16(pos + 22, true);
        } else if (chunkId === 'data') {
          dataSize = chunkSize;
        }
        if (chunkSize === 0 && pos + 8 >= header.length) break;
        pos += 8 + chunkSize + (chunkSize % 2);
      }
      if (byteRate > 0) {
        const effectiveDataBytes = dataSize || (input.sizeBytes ? Math.max(0, input.sizeBytes - 44) : 0);
        if (effectiveDataBytes > 0) {
          meta.durationSeconds = Math.round(effectiveDataBytes / byteRate);
        }
      }
    }

    // FLAC STREAMINFO header parser
    else if (bytesMatch(header, 0, [0x66, 0x4c, 0x61, 0x43]) && header.length >= 26) {
      const srHigh = view.getUint16(18, false);
      const srMid = header[20];
      const sampleRate = (srHigh << 4) | (srMid >> 4);
      const channels = ((srMid >> 1) & 0x07) + 1;
      const bpsHigh = srMid & 0x01;
      const bpsLow = header[21] >> 4;
      const bitDepth = ((bpsHigh << 4) | bpsLow) + 1;
      const totalSamplesHigh = header[21] & 0x0f;
      const totalSamplesLow = view.getUint32(22, false);
      const totalSamples = totalSamplesHigh * 0x100000000 + totalSamplesLow;

      if (sampleRate > 0) {
        meta.sampleRateHz = sampleRate;
        meta.channels = channels;
        meta.bitDepth = bitDepth;
        if (totalSamples > 0) {
          meta.durationSeconds = Math.round(totalSamples / sampleRate);
        }
      }
    }

    // PDF Version extractor
    else if (bytesMatch(header, 0, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
      const headStr = asciiAt(header, 0, Math.min(header.length, 32));
      const m = headStr.match(/%PDF-(\d\.\d)/);
      if (m) meta.pdfVersion = m[1];
    }

    // SQLite 3 binary header parser (first 100 bytes)
    else if (
      bytesMatch(header, 0, [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00]) &&
      header.length >= 100
    ) {
      const rawPageSize = view.getUint16(16, false);
      meta.sqlitePageSize = rawPageSize === 1 ? 65536 : rawPageSize;
      meta.sqlitePageCount = view.getUint32(28, false);
      const encCode = view.getUint32(56, false);
      meta.sqliteEncoding =
        encCode === 1 ? 'UTF-8' : encCode === 2 ? 'UTF-16le' : encCode === 3 ? 'UTF-16be' : `Code ${encCode}`;
      meta.sqliteWriteVersion = view.getUint32(96, false);
    }
  }

  // Text / Source / Structured Data / LUT / Subtitle header inspection
  let text = input.textSample;
  if (!text && header && header.length > 0 && (fmt.category === 'document' || fmt.category === 'data')) {
    const looksText = header.slice(0, Math.min(header.length, 256)).every(
      (b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126) || b >= 128
    );
    if (looksText) {
      try {
        text = new TextDecoder('utf-8', { fatal: false }).decode(header);
      } catch {}
    }
  }

  if (text && text.length > 0) {
    meta.encoding = 'UTF-8';
    const lines = text.split(/\r?\n/);
    meta.lineCount = lines.length;

    if (fmt.extension === 'JSON' || fmt.aliases.includes(primary)) {
      const trimmed = text.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            meta.jsonRootType = 'Array';
            meta.jsonKeyCount = parsed.length;
          } else if (parsed && typeof parsed === 'object') {
            meta.jsonRootType = 'Object';
            meta.jsonKeyCount = Object.keys(parsed).length;
          }
        } catch {
          meta.jsonRootType = trimmed.startsWith('[') ? 'Array (partial)' : 'Object (partial)';
        }
      }
    }

    if (fmt.extension === 'CSV' || primary === 'TSV' || primary === 'TAB') {
      const firstLine = lines.find((l) => l.trim().length > 0) || '';
      const delim = primary === 'TSV' || primary === 'TAB' || firstLine.includes('\t') ? '\t' : ',';
      meta.csvDelimiter = delim === '\t' ? 'TAB' : ',';
      meta.csvColumns = firstLine ? firstLine.split(delim).length : 0;
    }

    if (fmt.family === 'color_lut_sidecar') {
      const lutMatch = text.match(/LUT_3D_SIZE\s+(\d+)/i);
      if (lutMatch) meta.lut3dSize = Number.parseInt(lutMatch[1], 10);
    }

    if (fmt.family === 'subtitle_lyric') {
      const cueMatches = text.match(/(-->|\[\d{2}:\d{2})/g);
      if (cueMatches) meta.subtitleCueCount = cueMatches.length;
    }
  }

  return meta;
}

/**
 * Full classification pipeline combining binary magic-byte sniffing, compound extensions,
 * canonical extension + alias lookup, MIME mapping, and technical metadata extraction.
 */
export function classifyFile(input: {
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
  modifiedTime?: string;
  headerBytes?: Uint8Array;
  textSample?: string;
}): FileClassificationResult {
  const { primary, compound } = extractExtensions(input.filename);
  const magicMatch = sniffMagicBytes(input.headerBytes, input.filename);

  let format: FileFormatDefinition;
  let matchedBy: FileClassificationResult['matchedBy'];
  let matchedToken: string;

  if (magicMatch) {
    format = magicMatch;
    matchedBy = 'magic-bytes';
    matchedToken = magicMatch.extension;
  } else if (compound && extensionMap.has(compound)) {
    format = extensionMap.get(compound)!;
    matchedBy = 'compound-extension';
    matchedToken = compound;
  } else {
    const cleanMime = (input.mimeType || '').split(';')[0].trim().toLowerCase();
    if (cleanMime.startsWith('application/vnd.google-apps.') && mimeMap.has(cleanMime)) {
      format = mimeMap.get(cleanMime)!;
      matchedBy = 'mime-type';
      matchedToken = cleanMime;
    } else if (primary && extensionMap.has(primary)) {
      format = extensionMap.get(primary)!;
      matchedBy = 'extension';
      matchedToken = primary;
    } else if (cleanMime && mimeMap.has(cleanMime)) {
      format = mimeMap.get(cleanMime)!;
      matchedBy = 'mime-type';
      matchedToken = cleanMime;
    } else {
      format = FALLBACK_BINARY_FORMAT;
      matchedBy = 'fallback';
      matchedToken = primary || 'BIN';
    }
  }

  const metadata = extractUniversalFileMetadata({
    filename: input.filename,
    mimeType: input.mimeType || format.mimeTypes[0],
    sizeBytes: input.sizeBytes,
    modifiedTime: input.modifiedTime,
    headerBytes: input.headerBytes,
    textSample: input.textSample,
    detectedBy: matchedBy,
    format,
  });

  const resolvedMime =
    input.mimeType && input.mimeType !== 'application/octet-stream'
      ? input.mimeType
      : format.mimeTypes[0] || 'application/octet-stream';

  return {
    format,
    matchedBy,
    matchedToken,
    mimeType: resolvedMime,
    category: format.category,
    viewer: format.viewer,
    editor: format.editor,
    metadata,
  };
}

export function getAllFormatDefinitions(): FileFormatDefinition[] {
  return [...runtimeFormats];
}

export function searchFormatDatabase(
  query = '',
  filter?: {
    family?: string;
    category?: MediaCategory | 'all' | string;
    viewer?: string;
    editor?: string;
  }
): FileFormatDefinition[] {
  const q = query.trim().toLowerCase();
  return runtimeFormats.filter((f) => {
    if (filter?.family && filter.family !== 'all' && f.family !== filter.family) return false;
    if (filter?.category && filter.category !== 'all' && f.category !== filter.category) return false;
    if (filter?.viewer && filter.viewer !== 'all' && f.viewer !== filter.viewer) return false;
    if (filter?.editor && filter.editor !== 'all' && f.editor !== filter.editor) return false;
    if (!q) return true;
    return (
      f.extension.toLowerCase().includes(q) ||
      f.aliases.some((a) => a.toLowerCase().includes(q)) ||
      f.name.toLowerCase().includes(q) ||
      f.family.toLowerCase().includes(q) ||
      f.mimeTypes.some((m) => m.toLowerCase().includes(q)) ||
      f.description.toLowerCase().includes(q)
    );
  });
}

export function upsertFormatDefinition(def: FileFormatDefinition): FileFormatDefinition {
  const normalized: FileFormatDefinition = {
    ...def,
    extension: def.extension.replace(/^\./, '').toUpperCase(),
    aliases: (def.aliases || []).map((a) => a.replace(/^\./, '').toUpperCase()).filter(Boolean),
    mimeTypes: def.mimeTypes.length > 0 ? def.mimeTypes : [`application/x-${def.extension.toLowerCase()}`],
    magicSignatures: def.magicSignatures || [],
    metadataParsers: def.metadataParsers || [],
  };
  runtimeFormats = [
    ...runtimeFormats.filter((item) => item.extension !== normalized.extension),
    normalized,
  ].sort((a, b) => a.extension.localeCompare(b.extension));
  rebuildIndexes(runtimeFormats);
  return normalized;
}

export function getFormatDatabaseStats(): FormatDatabaseStats {
  const byCategory: Record<string, number> = {};
  const byFamily: Record<string, number> = {};
  const byViewer: Record<string, number> = {};
  const byEditor: Record<string, number> = {};
  const uniqueTokens = new Set<string>();

  for (const f of runtimeFormats) {
    uniqueTokens.add(f.extension);
    for (const a of f.aliases) uniqueTokens.add(a);
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    byFamily[f.family] = (byFamily[f.family] || 0) + 1;
    byViewer[f.viewer] = (byViewer[f.viewer] || 0) + 1;
    byEditor[f.editor] = (byEditor[f.editor] || 0) + 1;
  }

  return {
    totalFormats: runtimeFormats.length,
    totalExtensionsAndAliases: uniqueTokens.size,
    byCategory,
    byFamily,
    byViewer,
    byEditor,
  };
}
