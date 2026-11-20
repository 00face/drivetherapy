/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Canonical Type Definitions for Drive Therapy Universal File Format Flat-File Database
 * & Magic-Byte Classification Engine.
 */

import type { MediaCategory } from './index';

export type FormatFamily =
  | 'raster_image'
  | 'camera_raw'
  | 'vector_graphic'
  | 'design_layout'
  | 'cad_3d'
  | 'video'
  | 'audio'
  | 'document'
  | 'ebook'
  | 'spreadsheet'
  | 'presentation'
  | 'subtitle_lyric'
  | 'database'
  | 'structured_data'
  | 'gis_mapping'
  | 'source_code'
  | 'archive_compressed'
  | 'disk_image'
  | 'executable_package'
  | 'font'
  | 'color_lut_sidecar'
  | 'system_other';

export type FormatViewerKind =
  | 'image-lightbox'
  | 'raw-demosaic-viewer'
  | 'video-player'
  | 'audio-player'
  | 'pdf-viewer'
  | 'document-reader'
  | 'markdown-viewer'
  | 'spreadsheet-grid'
  | 'code-viewer'
  | 'json-tree-viewer'
  | 'archive-inspector'
  | 'sqlite-inspector'
  | '3d-preview'
  | 'shader-viewer'
  | 'heightmap-viewer'
  | 'font-specimen'
  | 'hex-inspector'
  | 'download-only';

export type FormatEditorKind =
  | 'pixel-editor'
  | 'raw-developer'
  | 'video-trimmer'
  | 'audio-dsp-tagger'
  | 'text-code-editor'
  | 'csv-table-editor'
  | 'metadata-xmp-editor'
  | 'lut-adjuster'
  | 'cad-3d-editor'
  | 'shader-editor'
  | 'heightmap-terrain-editor'
  | 'none';

export type PreservationGrade =
  | 'LOC-Full'
  | 'LOC-Acceptable'
  | 'Proprietary'
  | 'Legacy';

export interface MagicSignatureSpec {
  offset: number;
  hex: string;
  ascii?: string;
  brand?: string;
}

export interface FileFormatDefinition {
  extension: string;
  aliases: string[];
  name: string;
  family: FormatFamily;
  category: MediaCategory;
  mimeTypes: string[];
  magicSignatures: MagicSignatureSpec[];
  containerFormat?: string;
  metadataParsers: string[];
  viewer: FormatViewerKind;
  editor: FormatEditorKind;
  isLossless?: boolean;
  isStreamable: boolean;
  preservationGrade: PreservationGrade;
  description: string;
}

export interface FileFormatDatabaseDocument {
  schemaVersion: string;
  generatedAt: string;
  sourceStandards: string[];
  totalFormats: number;
  totalExtensionsAndAliases: number;
  formats: FileFormatDefinition[];
}

export interface UniversalFileMetadata {
  extension: string;
  mimeType: string;
  sizeBytes?: number;
  modifiedTime?: string;
  width?: number;
  height?: number;
  dimensions?: string;
  bitDepth?: number;
  colorType?: string;
  sampleRateHz?: number;
  channels?: number;
  durationSeconds?: number;
  pdfVersion?: string;
  sqlitePageSize?: number;
  sqlitePageCount?: number;
  sqliteEncoding?: string;
  sqliteWriteVersion?: number;
  lineCount?: number;
  encoding?: string;
  jsonRootType?: string;
  jsonKeyCount?: number;
  csvColumns?: number;
  csvDelimiter?: string;
  lut3dSize?: number;
  subtitleCueCount?: number;
  headerHexPreview?: string;
  headerAsciiPreview?: string;
  detectedBy: 'magic-bytes' | 'compound-extension' | 'extension' | 'mime-type' | 'fallback';
  rawDetails?: Record<string, string | number | boolean>;
}

export interface FileClassificationResult {
  format: FileFormatDefinition;
  matchedBy: 'magic-bytes' | 'compound-extension' | 'extension' | 'mime-type' | 'fallback';
  matchedToken: string;
  mimeType: string;
  category: MediaCategory;
  viewer: FormatViewerKind;
  editor: FormatEditorKind;
  metadata: UniversalFileMetadata;
}

export interface FormatDatabaseStats {
  totalFormats: number;
  totalExtensionsAndAliases: number;
  byCategory: Record<string, number>;
  byFamily: Record<string, number>;
  byViewer: Record<string, number>;
  byEditor: Record<string, number>;
}
