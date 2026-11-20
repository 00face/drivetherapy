/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-052] Adaptive HTTP Live Streaming (HLS) Engine
 * Generates FFmpeg HLS transcode arguments and coordinates server-side .m3u8 / .ts
 * segmentation for smooth 4K/60fps seeking without mutating original source videos.
 */

export interface HlsTranscodeOptions {
  inputSource: string;
  outputDir: string;
  segmentDurationSec?: number;
  maxHeight?: 720 | 1080 | 2160;
  videoBitrateKbps?: number;
}

export interface HlsJobStatus {
  jobId: string;
  status: 'starting' | 'ready' | 'complete' | 'error';
  playlistUrl: string;
  segmentsCount: number;
  error?: string;
}

/**
 * Pure FFmpeg CLI argument builder for adaptive HLS (.m3u8 + seg_XXXX.ts).
 */
export function buildFfmpegHlsArgs(options: HlsTranscodeOptions): string[] {
  const segSec = Math.max(2, Math.min(10, options.segmentDurationSec || 4));
  const maxHeight = options.maxHeight || 1080;
  const bitrate = options.videoBitrateKbps || (maxHeight >= 2160 ? 12000 : maxHeight >= 1080 ? 4500 : 2500);

  return [
    '-y',
    '-i',
    options.inputSource,
    '-vf',
    `scale=-2:'min(${maxHeight},ih)'`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-b:v',
    `${bitrate}k`,
    '-maxrate',
    `${Math.round(bitrate * 1.2)}k`,
    '-bufsize',
    `${bitrate * 2}k`,
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-hls_time',
    String(segSec),
    '-hls_list_size',
    '0',
    '-hls_playlist_type',
    'event',
    '-hls_segment_filename',
    `${options.outputDir}/seg_%04d.ts`,
    `${options.outputDir}/index.m3u8`,
  ];
}

export function getHlsPlaylistUrl(jobId: string): string {
  return `/api/media/hls/${encodeURIComponent(jobId)}/index.m3u8`;
}

export async function startHlsTranscode(payload: {
  localPath?: string;
  driveFileId?: string;
  accessToken?: string;
  maxHeight?: 720 | 1080 | 2160;
}): Promise<HlsJobStatus> {
  const res = await fetch('/api/media/hls/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(payload.accessToken ? { Authorization: `Bearer ${payload.accessToken}` } : {}),
    },
    body: JSON.stringify({
      localPath: payload.localPath,
      driveFileId: payload.driveFileId,
      maxHeight: payload.maxHeight || 1080,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HLS transcode failed (${res.status})`);
  }
  return data as HlsJobStatus;
}

export async function pollHlsStatus(jobId: string): Promise<HlsJobStatus> {
  const res = await fetch(`/api/media/hls/${encodeURIComponent(jobId)}/status`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HLS status error (${res.status})`);
  }
  return data as HlsJobStatus;
}
