/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MediaSource = 'cloud' | 'photos' | 'local';

export type MediaCategory =
  | 'image'
  | 'raw'
  | 'video'
  | 'audio'
  | 'archive'
  | 'document'
  | 'data';

export type CullingStatus = 'unrated' | 'picked' | 'rejected' | 'none';

export type ColorLabel = 'none' | 'red' | 'yellow' | 'green' | 'blue' | 'purple';

export interface HistogramData {
  r: number[];
  g: number[];
  b: number[];
  l: number[];
}

export interface FilterRecipe {
  id: string;
  name: string;
  brightness: number; // 0-200
  contrast: number;   // 0-200
  saturation: number; // 0-200
  warmth: number;     // -100 to 100
  rotation: number;   // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
  horizonLevel: number; // -45 to 45
}

export interface FaceDetection {
  id?: string;
  label: string;
  count?: number;
  box?: {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
  };
}

export interface QualityAssessment {
  sharpness: number; // 0-100
  exposure?: number;  // 0-100
  overall?: number;   // 0-100
  isBlurry: boolean;
  noise?: number;
  compression?: number;
  reason?: string;
}

export interface ExifMetadata {
  camera?: string;
  lens?: string;
  focalLength?: string;
  aperture?: string;
  fNumber?: number;
  exposureTime?: string | number;
  iso?: number;
  shutterSpeed?: string;
  dimensions?: string;
  dateTaken?: string;
  colorSpace?: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  source: MediaSource;
  ownerEmail?: string;
  category: MediaCategory;
  mimeType: string;
  extension: string;
  path: string;
  parentId?: string;
  sizeBytes: number;
  size?: number;
  duration?: number;
  mediaCategory?: string;
  aiDescription?: string;
  localPath?: string;
  previewUrl?: string;
  cameraModel?: string;
  dateTaken?: string;
  timestamp?: number;
  modifiedTime: string;
  cloudUrl?: string;
  thumbnailUrl: string;
  isCached: boolean;
  cullingStatus: CullingStatus;
  isPicked?: boolean;
  isRejected?: boolean;
  isFlagged?: boolean;
  rating: number; // 0 to 5
  tags: string[];
  faces: FaceDetection[];
  quality: QualityAssessment;
  palette: string[]; // 5 dominant hex colors
  exif: ExifMetadata;
  metadata?: any;
  burstGroup?: string;
  isBurstHero?: boolean;
  colorLabel?: ColorLabel;
  pHash?: string;
  histogram?: HistogramData;
  clipping?: { highlightPct: number; shadowPct: number };
  vectorEmbedding?: number[];
  presetRecipe?: FilterRecipe;
}

export interface FolderNode {
  id: string;
  name: string;
  source: MediaSource;
  path: string;
  parentId?: string;
  itemCount: number;
}

export interface StorageQuota {
  usedBytes: number;
  totalBytes: number;
  percentage: number;
}

export type ViewMode =
  | 'files'
  | 'drive-browser'
  | 'google-photos'
  | 'local-files'
  | 'culling'
  | 'vision'
  | 'editor'
  | 'portfolio'
  | 'slideshow'
  | 'providers'
  | 'map'
  | 'takeout'
  | 'cloud-sync'
  | 'external-clouds';

export interface DriveBrowserFolder {
  id: string;
  name: string;
  parentId?: string;
  modifiedTime?: string;
  path: string;
  shared?: boolean;
  starred?: boolean;
}

export interface DriveBreadcrumb {
  id: string;
  name: string;
  path: string;
}

export interface OsFileEntry {
  name: string;
  path: string;
  size: number;
  modifiedTime: string;
  extension: string;
  mimeType: string;
  category: MediaCategory | 'other';
  isMedia: boolean;
  streamUrl: string;
  formatName?: string;
  family?: string;
  viewer?: string;
  editor?: string;
}

export interface OsFolderEntry {
  name: string;
  path: string;
  modifiedTime?: string;
}

export interface OsBreadcrumb {
  name: string;
  path: string;
}

export interface OsQuickAccessLocation {
  id: string;
  name: string;
  path: string;
  icon: string;
}

export type ProviderKind = 'vision' | 'chat' | 'image-gen' | 'image-edit';

export interface ProviderConfig {
  id: string;
  name: string;
  kinds: ProviderKind[];
  baseUrl: string;
  defaultModel: string;
  apiKey: string;
  enabled: boolean;
  priority: number;
  dailyRequests: number;
  rateLimitRemaining?: number;
  cooldownUntil?: number;
  lastPingMs?: number;
  status: 'idle' | 'active' | 'cooling' | 'error';
  lastError?: string;
}

export interface PortfolioProject {
  id: string;
  title: string;
  clientName: string;
  description: string;
  layout: 'masonry' | 'editorial' | 'filmstrip' | 'minimal';
  accentColor: string;
  watermarkText: string;
  showWatermark: boolean;
  selectedAssetIds: string[];
  createdAt: string;
}

export interface SlideshowSettings {
  intervalSeconds: number;
  transition: 'fade' | 'slide' | 'zoom' | 'crossfade';
  kenBurns: boolean;
  showCaptions: boolean;
  showExif: boolean;
  autoPlay: boolean;
}

export interface BatchTask {
  id: string;
  name: string;
  type: 'upload' | 'download' | 'ai_analyze' | 'mount';
  progress: number; // 0-100
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

export interface CatalogBackup {
  version: string;
  exportedAt: string;
  assets: MediaAsset[];
  folders: FolderNode[];
  portfolios: PortfolioProject[];
  providerConfigs?: ProviderConfig[];
}

export interface OAuthTokenRecord {
  accessToken: string;
  acquiredAt?: number;        // Epoch ms
  expiresAt: number;         // Epoch ms (acquiredAt + expiresIn * 1000)
  expiresIn?: number;         // Seconds (e.g. 3600)
  scopes?: string[];          // ['https://www.googleapis.com/auth/drive.readonly', ...]
  tokenType?: 'Bearer' | string;
  provider?: 'firebase' | 'direct' | 'server';
  userEmail?: string;
  refreshToken?: string;
}

export interface OAuthScopeInspection {
  isValid: boolean;
  issuedTo?: string;
  audience?: string;
  userEmail?: string;
  scopeString: string;
  scopes: string[];
  expiresInSeconds: number;
  hasDriveReadonly: boolean;
  hasDriveFile: boolean;
  hasDriveFull: boolean;
  error?: string;
}
