/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Universal Format-Driven File Viewer, Parser & Context-Menu Spec Engine
 * Bridges the flat-file format database (fileFormatEngine.ts) into UI viewers,
 * non-destructive inline editors, context-aware PiP modes, and RMB menus.
 */

import type { MediaAsset } from '../types';
import type {
  FileFormatDefinition,
  FormatEditorKind,
  FormatViewerKind,
} from '../types/fileFormats';
import { classifyFile, lookupFileFormat } from './fileFormatEngine';
import { resolveAssetUrl } from './music/musicPlayback';

export type PipContextMode = 'music-queue' | 'standalone-media' | 'reference-pin';
export type EditorRouteKind =
  | 'pixel-studio'
  | 'video-trimmer'
  | 'music-eq-studio'
  | 'cad-3d-studio'
  | 'shader-studio'
  | 'heightmap-studio'
  | 'lightbox-inline-editor';

export interface ContextMenuSpec {
  format: FileFormatDefinition;
  viewerLabel: string;
  editorLabel: string | null;
  editorRoute: EditorRouteKind | null;
  pipMode: 'media' | 'reference' | null;
  pipLabel: string | null;
  isMediaPlayerCompatible: boolean;
  isSubtitleOrLyric: boolean;
  categoryActions: string[];
}

export interface LoadedAssetSample {
  text: string;
  bytes: Uint8Array;
  isSynthesizedFallback: boolean;
}

export interface ParsedCsvGrid {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

export interface ZipDirectoryEntry {
  name: string;
  compressedBytes: number;
  uncompressedBytes: number;
  isDirectory: boolean;
}

export interface Wavefront3dSummary {
  vertexCount: number;
  normalCount: number;
  faceCount: number;
  vertices: Array<[number, number, number]>;
  edges: Array<[number, number]>;
}

export interface CubeLutData {
  title: string;
  size3d: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  sampleTriplets: Array<[number, number, number]>;
}

const VIEWER_LABELS: Record<FormatViewerKind, string> = {
  'image-lightbox': 'Open in Image Lightbox',
  'raw-demosaic-viewer': 'Open in RAW Demosaic Viewer',
  'video-player': 'Open in Video Theatre',
  'audio-player': 'Open in Audio Waveform Viewer',
  'pdf-viewer': 'Open in PDF Reader',
  'document-reader': 'Open in Document Reader',
  'markdown-viewer': 'Open in Markdown Reader',
  'spreadsheet-grid': 'Open in Spreadsheet Grid',
  'code-viewer': 'Open in Code & Syntax Viewer',
  'json-tree-viewer': 'Open in JSON Tree Viewer',
  'archive-inspector': 'Inspect Archive Package',
  'sqlite-inspector': 'Inspect Database Header & Schema',
  '3d-preview': 'Open in 3D Mesh Previewer',
  'shader-viewer': 'Open in Live GLSL Shader Viewer',
  'heightmap-viewer': 'Open in Heightmap & Map Viewer',
  'font-specimen': 'Open Font Specimen Preview',
  'hex-inspector': 'Inspect Binary Header & Hex',
  'download-only': 'Inspect Package Details',
};

const EDITOR_LABELS: Record<FormatEditorKind, string | null> = {
  'pixel-editor': 'Edit in Pixel Studio',
  'raw-developer': 'Develop RAW in Darkroom',
  'video-trimmer': 'Trim in Lossless Video Trimmer',
  'audio-dsp-tagger': 'Edit in 3-Band EQ & Audio Studio',
  'text-code-editor': 'Edit Text / Code In-Place',
  'csv-table-editor': 'Edit Spreadsheet Cells',
  'metadata-xmp-editor': 'Edit Non-Destructive XMP Metadata',
  'lut-adjuster': 'Inspect & Adjust 3D LUT Curve',
  'cad-3d-editor': 'Open in 3D Editor (TinkerCad / Sculpt / Wings3D)',
  'shader-editor': 'Edit Live Shader in Shader Studio',
  'heightmap-terrain-editor': 'Edit Terrain & Export 3D STL Map',
  none: null,
};

const EDITOR_ROUTES: Record<FormatEditorKind, EditorRouteKind | null> = {
  'pixel-editor': 'pixel-studio',
  'raw-developer': 'pixel-studio',
  'video-trimmer': 'video-trimmer',
  'audio-dsp-tagger': 'music-eq-studio',
  'text-code-editor': 'lightbox-inline-editor',
  'csv-table-editor': 'lightbox-inline-editor',
  'metadata-xmp-editor': 'lightbox-inline-editor',
  'lut-adjuster': 'lightbox-inline-editor',
  'cad-3d-editor': 'cad-3d-studio',
  'shader-editor': 'shader-studio',
  'heightmap-terrain-editor': 'heightmap-studio',
  none: null,
};

/**
 * Resolve a streamable or previewable URL for any MediaAsset (local disk, blob, or Google Drive).
 */
export function resolveViewableAssetStreamUrl(asset: MediaAsset): string {
  const localFilePath =
    asset.localPath || (asset.source === 'local' && asset.path ? asset.path : '');
  if (localFilePath && localFilePath.startsWith('/')) {
    return `/api/fs/stream?path=${encodeURIComponent(localFilePath)}`;
  }
  const resolved = resolveAssetUrl(asset);
  if (resolved) return resolved;
  if (asset.thumbnailUrl) return asset.thumbnailUrl;
  return asset.cloudUrl || '';
}

/**
 * Compute full format-aware viewer, editor, PiP, media player, and studio capabilities for RMB menus & UI routing.
 */
export function getContextMenuSpecForAsset(asset: MediaAsset): ContextMenuSpec {
  const format = lookupFileFormat(asset.name, asset.mimeType);
  const viewerLabel = VIEWER_LABELS[format.viewer] || 'Open Viewer';

  // Special case: .CUBE / color LUT sidecar gets interactive LUT adjuster even if metadataParsers lists lut-3d
  const effectiveEditor: FormatEditorKind =
    format.family === 'color_lut_sidecar' && format.editor === 'none'
      ? 'lut-adjuster'
      : format.editor;

  const editorLabel = EDITOR_LABELS[effectiveEditor];
  const editorRoute = EDITOR_ROUTES[effectiveEditor];

  const isPlayableAudio = format.viewer === 'audio-player' || asset.category === 'audio';
  const isPlayableVideo = format.viewer === 'video-player' || asset.category === 'video';
  const isMediaPlayerCompatible = isPlayableAudio || isPlayableVideo;
  const isSubtitleOrLyric = format.family === 'subtitle_lyric';

  const canPinReference =
    format.viewer === 'image-lightbox' ||
    format.viewer === 'raw-demosaic-viewer' ||
    format.viewer === 'pdf-viewer' ||
    format.viewer === 'markdown-viewer' ||
    format.viewer === 'document-reader' ||
    format.viewer === 'code-viewer' ||
    format.viewer === 'json-tree-viewer' ||
    format.viewer === '3d-preview' ||
    format.viewer === 'shader-viewer' ||
    format.viewer === 'heightmap-viewer';

  const pipMode: 'media' | 'reference' | null = isMediaPlayerCompatible
    ? 'media'
    : canPinReference
    ? 'reference'
    : null;

  const pipLabel =
    pipMode === 'media'
      ? 'Toggle Picture-in-Picture (PiP)'
      : pipMode === 'reference'
      ? 'Pin Reference to PiP'
      : null;

  const categoryActions: string[] = [];
  if (asset.category === 'image' || asset.category === 'raw') {
    categoryActions.push('culling-review', 'slideshow', 'batch-export', 'sharpness-check', 'burst-hero');
  }
  if (isPlayableVideo) {
    categoryActions.push('video-trimmer');
  }
  if (isMediaPlayerCompatible) {
    categoryActions.push('play-music-studio', 'queue-music');
  }
  if (isSubtitleOrLyric) {
    categoryActions.push('load-lyrics');
  }
  categoryActions.push('ai-inspector', 'notebooklm-dossier', 'inspect-format-db');

  return {
    format,
    viewerLabel,
    editorLabel,
    editorRoute,
    pipMode,
    pipLabel,
    isMediaPlayerCompatible,
    isSubtitleOrLyric,
    categoryActions,
  };
}

function buildSynthesizedFallbackText(asset: MediaAsset, fmt: FileFormatDefinition): string {
  const edited = (asset.metadata as Record<string, unknown> | undefined)?.editedContent;
  if (typeof edited === 'string' && edited.length > 0) {
    return edited;
  }

  if (fmt.viewer === 'spreadsheet-grid') {
    return [
      'row,filename,category,format,viewer,status',
      `1,${asset.name},${asset.category},${fmt.extension},${fmt.viewer},Cataloged`,
      `2,${asset.path || '/workspace'},${fmt.family},${fmt.mimeTypes[0] || 'text/csv'},${fmt.editor},Non-Destructive`,
    ].join('\n');
  }

  if (fmt.viewer === 'json-tree-viewer') {
    return JSON.stringify(
      {
        name: asset.name,
        extension: fmt.extension,
        family: fmt.family,
        category: asset.category,
        mimeType: asset.mimeType || fmt.mimeTypes[0],
        path: asset.path,
        sizeBytes: asset.sizeBytes,
        preservationGrade: fmt.preservationGrade,
        viewer: fmt.viewer,
        editor: fmt.editor,
      },
      null,
      2
    );
  }

  if (fmt.family === 'color_lut_sidecar') {
    return [
      `TITLE "${asset.name.replace(/\.[^/.]+$/, '')}"`,
      'LUT_3D_SIZE 17',
      'DOMAIN_MIN 0.0 0.0 0.0',
      'DOMAIN_MAX 1.0 1.0 1.0',
      '0.0000 0.0000 0.0000',
      '0.2500 0.2300 0.2100',
      '0.5200 0.5000 0.4800',
      '0.8100 0.7800 0.7500',
      '1.0000 0.9900 0.9700',
    ].join('\n');
  }

  if (fmt.viewer === '3d-preview') {
    return [
      `# ${asset.name} (${fmt.name})`,
      'v -1.0 -1.0 1.0',
      'v 1.0 -1.0 1.0',
      'v 1.0 1.0 1.0',
      'v -1.0 1.0 1.0',
      'v -1.0 -1.0 -1.0',
      'v 1.0 -1.0 -1.0',
      'v 1.0 1.0 -1.0',
      'v -1.0 1.0 -1.0',
      'f 1 2 3 4',
      'f 5 6 7 8',
      'f 1 2 6 5',
      'f 2 3 7 6',
      'f 3 4 8 7',
      'f 4 1 5 8',
    ].join('\n');
  }

  if (fmt.family === 'subtitle_lyric') {
    return [
      '1',
      '00:00:00,500 --> 00:00:04,000',
      `[${asset.name}] Synced subtitle & lyric stream ready`,
      '',
      '2',
      '00:00:04,500 --> 00:00:09,000',
      'Double-click or edit inline to adjust cues non-destructively.',
    ].join('\n');
  }

  if (fmt.viewer === 'markdown-viewer') {
    return [
      `# ${asset.name}`,
      '',
      `- **Format**: ${fmt.name} (\`.${fmt.extension}\`)`,
      `- **Family**: \`${fmt.family}\``,
      `- **Source Path**: \`${asset.path}\``,
      `- **Preservation Grade**: ${fmt.preservationGrade}`,
      '',
      '> Edit this document in-place; changes persist non-destructively in IndexedDB or export via **Save Copy**.',
    ].join('\n');
  }

  return [
    `// File: ${asset.name}`,
    `// Format: ${fmt.name} (.${fmt.extension}) [${fmt.family}]`,
    `// Source: ${asset.path}`,
    `// MIME: ${asset.mimeType || fmt.mimeTypes[0]}`,
    `export const assetDescriptor = {`,
    `  id: "${asset.id}",`,
    `  category: "${asset.category}",`,
    `  viewer: "${fmt.viewer}",`,
    `  editor: "${fmt.editor}"`,
    `};`,
  ].join('\n');
}

/**
 * Load real text/binary header slice for an asset when backed by a local or Drive stream,
 * falling back to non-destructive edited state or structured sample synthesis if offline.
 */
export async function loadAssetContentSample(
  asset: MediaAsset,
  maxBytes = 131072
): Promise<LoadedAssetSample> {
  const fmt = lookupFileFormat(asset.name, asset.mimeType);
  const edited = (asset.metadata as Record<string, unknown> | undefined)?.editedContent;
  if (typeof edited === 'string') {
    const encoded = new TextEncoder().encode(edited);
    return { text: edited, bytes: encoded, isSynthesizedFallback: false };
  }

  const streamUrl = resolveViewableAssetStreamUrl(asset);
  const canFetchStream =
    streamUrl &&
    (streamUrl.startsWith('/api/fs/stream') ||
      streamUrl.startsWith('/api/drive/stream') ||
      streamUrl.startsWith('blob:') ||
      streamUrl.startsWith('data:'));

  if (canFetchStream && typeof fetch === 'function') {
    try {
      const headers: Record<string, string> = {};
      if (streamUrl.startsWith('/api/')) {
        headers.Range = `bytes=0-${Math.max(1023, maxBytes - 1)}`;
      }
      const res = await fetch(streamUrl, { headers });
      if (res.ok || res.status === 206) {
        const buffer = await res.arrayBuffer();
        const raw = new Uint8Array(buffer);
        const sliced = raw.length > maxBytes ? raw.subarray(0, maxBytes) : raw;
        let decodedText = '';
        try {
          decodedText = new TextDecoder('utf-8', { fatal: false }).decode(sliced);
        } catch {
          decodedText = '';
        }
        return {
          text: decodedText,
          bytes: sliced,
          isSynthesizedFallback: false,
        };
      }
    } catch {
      // Fall through cleanly to offline synthesis
    }
  }

  const fallbackText = buildSynthesizedFallbackText(asset, fmt);
  return {
    text: fallbackText,
    bytes: new TextEncoder().encode(fallbackText),
    isSynthesizedFallback: true,
  };
}

/**
 * Parse RFC 4180 CSV or TSV text into headers and cell rows.
 */
export function parseCsvToGrid(text: string, preferredDelimiter?: string): ParsedCsvGrid {
  const nonEmptyLines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (nonEmptyLines.length === 0) {
    return { headers: ['Column 1'], rows: [['']], delimiter: preferredDelimiter || ',' };
  }

  const sampleLine = nonEmptyLines[0];
  const delimiter =
    preferredDelimiter ||
    (sampleLine.includes('\t') && !sampleLine.includes(',') ? '\t' : ',');

  const splitCsvLine = (line: string): string[] => {
    if (delimiter === '\t') {
      return line.split('\t');
    }
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells;
  };

  const parsedLines = nonEmptyLines.map(splitCsvLine);
  const headers = parsedLines[0];
  const rows = parsedLines.slice(1).map((row) => {
    const normalized = [...row];
    while (normalized.length < headers.length) normalized.push('');
    return normalized.slice(0, Math.max(headers.length, normalized.length));
  });

  return { headers, rows, delimiter };
}

/**
 * Serialize edited CSV/TSV grid back into valid escaped text.
 */
export function serializeGridToCsv(
  headers: string[],
  rows: string[][],
  delimiter = ','
): string {
  const escapeCell = (val: string): string => {
    if (delimiter === '\t') {
      return val.replace(/[\r\n\t]+/g, ' ');
    }
    if (val.includes(delimiter) || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = [
    headers.map(escapeCell).join(delimiter),
    ...rows.map((r) => r.map(escapeCell).join(delimiter)),
  ];
  return lines.join('\n');
}

/**
 * Parse ZIP Local File Headers (PK\x03\x04) or Central Directory (PK\x01\x02) from raw bytes.
 */
export function parseZipDirectoryEntries(bytes: Uint8Array): ZipDirectoryEntry[] {
  const entries: ZipDirectoryEntry[] = [];
  if (!bytes || bytes.length < 30) return entries;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const seen = new Set<string>();

  // Scan Local File Headers (0x04034b50 little-endian -> PK\x03\x04)
  for (let i = 0; i + 30 <= bytes.length; i++) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x03 &&
      bytes[i + 3] === 0x04
    ) {
      const compressedBytes = view.getUint32(i + 18, true);
      const uncompressedBytes = view.getUint32(i + 22, true);
      const nameLen = view.getUint16(i + 26, true);
      const extraLen = view.getUint16(i + 28, true);
      if (nameLen > 0 && i + 30 + nameLen <= bytes.length) {
        const name = decoder.decode(bytes.subarray(i + 30, i + 30 + nameLen));
        if (name && !seen.has(name)) {
          seen.add(name);
          entries.push({
            name,
            compressedBytes,
            uncompressedBytes,
            isDirectory: name.endsWith('/'),
          });
        }
        i += 29 + nameLen + extraLen;
      }
    } else if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x01 &&
      bytes[i + 3] === 0x02 &&
      i + 46 <= bytes.length
    ) {
      const compressedBytes = view.getUint32(i + 20, true);
      const uncompressedBytes = view.getUint32(i + 24, true);
      const nameLen = view.getUint16(i + 28, true);
      const extraLen = view.getUint16(i + 30, true);
      const commentLen = view.getUint16(i + 32, true);
      if (nameLen > 0 && i + 46 + nameLen <= bytes.length) {
        const name = decoder.decode(bytes.subarray(i + 46, i + 46 + nameLen));
        if (name && !seen.has(name)) {
          seen.add(name);
          entries.push({
            name,
            compressedBytes,
            uncompressedBytes,
            isDirectory: name.endsWith('/'),
          });
        }
        i += 45 + nameLen + extraLen + commentLen;
      }
    }
  }

  return entries;
}

/**
 * Parse Wavefront .OBJ or ASCII .STL geometry into normalized vertices & wireframe edges.
 */
export function parse3dWavefrontObjSummary(text: string): Wavefront3dSummary {
  const rawVertices: Array<[number, number, number]> = [];
  const edges: Array<[number, number]> = [];
  const edgeSet = new Set<string>();
  let normalCount = 0;
  let faceCount = 0;

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts[0] === 'v' && parts.length >= 4) {
      const x = Number.parseFloat(parts[1]);
      const y = Number.parseFloat(parts[2]);
      const z = Number.parseFloat(parts[3]);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        rawVertices.push([x, y, z]);
      }
    } else if (parts[0] === 'vn') {
      normalCount += 1;
    } else if (parts[0] === 'f' && parts.length >= 4) {
      faceCount += 1;
      const idxList = parts
        .slice(1)
        .map((tok) => Number.parseInt(tok.split('/')[0], 10))
        .map((n) => (n < 0 ? rawVertices.length + n : n - 1))
        .filter((idx) => idx >= 0 && idx < rawVertices.length);

      for (let i = 0; i < idxList.length; i++) {
        const a = idxList[i];
        const b = idxList[(i + 1) % idxList.length];
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push([a, b]);
        }
      }
    } else if (parts[0] === 'vertex' && parts.length >= 4) {
      // ASCII STL triangle vertex fallback
      const x = Number.parseFloat(parts[1]);
      const y = Number.parseFloat(parts[2]);
      const z = Number.parseFloat(parts[3]);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        const idx = rawVertices.length;
        rawVertices.push([x, y, z]);
        if (idx % 3 === 2) {
          faceCount += 1;
          edges.push([idx - 2, idx - 1], [idx - 1, idx], [idx, idx - 2]);
        }
      }
    }
  }

  // Normalize vertex coordinates to [-1, 1] around centroid
  if (rawVertices.length === 0) {
    return {
      vertexCount: 0,
      normalCount,
      faceCount,
      vertices: [],
      edges: [],
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, y, z] of rawVertices) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const span = Math.max(0.0001, maxX - minX, maxY - minY, maxZ - minZ);
  const scale = 2 / span;

  const vertices: Array<[number, number, number]> = rawVertices
    .slice(0, 1200)
    .map(([x, y, z]) => [(x - cx) * scale, (y - cy) * scale, (z - cz) * scale]);

  return {
    vertexCount: rawVertices.length,
    normalCount,
    faceCount,
    vertices,
    edges: edges.filter(([a, b]) => a < vertices.length && b < vertices.length).slice(0, 2400),
  };
}

/**
 * Parse .CUBE / .3DL color grading LUT metadata & RGB triplets.
 */
export function parseCubeLutData(text: string): CubeLutData {
  let title = 'Untitled 3D LUT';
  let size3d = 17;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const sampleTriplets: Array<[number, number, number]> = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.toUpperCase().startsWith('TITLE')) {
      const m = line.match(/TITLE\s+"?([^"]+)"?/i);
      if (m) title = m[1].trim();
    } else if (line.toUpperCase().startsWith('LUT_3D_SIZE')) {
      const m = line.match(/LUT_3D_SIZE\s+(\d+)/i);
      if (m) size3d = Number.parseInt(m[1], 10);
    } else if (line.toUpperCase().startsWith('DOMAIN_MIN')) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
        domainMin = [parts[0], parts[1], parts[2]];
      }
    } else if (line.toUpperCase().startsWith('DOMAIN_MAX')) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
        domainMax = [parts[0], parts[1], parts[2]];
      }
    } else {
      const parts = line.split(/\s+/).map(Number);
      if (parts.length === 3 && parts.every(Number.isFinite)) {
        if (sampleTriplets.length < 32) {
          sampleTriplets.push([parts[0], parts[1], parts[2]]);
        }
      }
    }
  }

  return { title, size3d, domainMin, domainMax, sampleTriplets };
}

/**
 * Classify header bytes + text sample directly into full technical metadata for Lightbox display.
 */
export function classifyLoadedAsset(
  asset: MediaAsset,
  bytes?: Uint8Array,
  textSample?: string
) {
  return classifyFile({
    filename: asset.name,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    modifiedTime: asset.modifiedTime,
    headerBytes: bytes,
    textSample,
  });
}
