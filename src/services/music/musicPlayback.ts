/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Music Playback Controller
 * Owns ONE shared media element (video element plays audio too) that is the single source of
 * truth for playback clock, seeking and PiP. Resolves real playable URLs for cloud (Drive
 * stream proxy) and local (blob / OS file stream) tracks.
 */

import type { MusicTrack } from '../googleMusicEngine';
import { loadOAuthToken } from '../oauthStorage';
import { blobRegistry } from '../localFileSystem';
import { universalMediaPlayer } from '../universalMediaPlayerEngine';
import { refreshDriveToken } from '../googleDrive';

export interface PlaybackHandlers {
  onTime: (currentTime: number, duration: number) => void;
  onEnded: () => void;
  onError: (message: string) => void;
  onPlayState: (playing: boolean) => void;
}

/** Resolve a real, browser-playable URL for a track, or null when none exists (demo/synth). */
export function resolveTrackUrl(track: MusicTrack | undefined): string | null {
  if (!track) return null;

  if (track.source === 'local' || track.id.startsWith('local_')) {
    const blobUrl = blobRegistry.get(track.id);
    if (blobUrl) return blobUrl;
    if (track.localPath && track.localPath.startsWith('/')) {
      return `/api/fs/stream?path=${encodeURIComponent(track.localPath)}`;
    }
    return null;
  }

  const fileId = track.driveFileId || (track.id.startsWith('drive_') ? track.id.replace(/^drive_/, '') : '');
  if (fileId) {
    const token = loadOAuthToken()?.accessToken;
    if (!token) return null;
    return `/api/drive/stream/${encodeURIComponent(fileId)}?access_token=${encodeURIComponent(token)}`;
  }

  // Direct http(s) media URL on the track (user-provided), never a hidden fallback
  if (track.videoUrl && /^https?:\/\//.test(track.videoUrl)) return track.videoUrl;
  return null;
}

/** Resolve a real playable URL for any catalog MediaAsset (used by the floating PiP player). */
export function resolveAssetUrl(asset: {
  id: string;
  source?: string;
  path?: string;
  cloudUrl?: string;
}): string | null {
  if (!asset) return null;
  if (asset.source === 'local' || asset.id.startsWith('local_')) {
    const blobUrl = blobRegistry.get(asset.id);
    if (blobUrl) return blobUrl;
    if (asset.path && asset.path.startsWith('/')) return `/api/fs/stream?path=${encodeURIComponent(asset.path)}`;
    return null;
  }
  const fileId = asset.id.replace(/^drive_/, '');
  const token = loadOAuthToken()?.accessToken;
  if (fileId && token && (asset.id.startsWith('drive_') || asset.source === 'cloud')) {
    return `/api/drive/stream/${encodeURIComponent(fileId)}?access_token=${encodeURIComponent(token)}`;
  }
  const direct = asset.cloudUrl || asset.path;
  return direct && /^https?:\/\//.test(direct) ? direct : null;
}

export class MusicPlaybackController {
  private el: HTMLVideoElement | null = null;
  private preloadEl: HTMLAudioElement | null = null;
  private preloadedTrackId: string | null = null;
  private retriedTrackId: string | null = null;
  private currentTrack: MusicTrack | null = null;
  private viaDsp = false;

  constructor(private handlers: PlaybackHandlers) {}

  /** Preload the next upcoming track for gapless album and queue transitions. */
  public preloadNextTrack(nextTrack: MusicTrack | undefined): void {
    if (!nextTrack || typeof document === 'undefined') return;
    if (this.preloadedTrackId === nextTrack.id) return;
    const url = resolveTrackUrl(nextTrack);
    if (!url) return;

    if (!this.preloadEl) {
      this.preloadEl = document.createElement('audio');
      this.preloadEl.preload = 'auto';
    }
    this.preloadedTrackId = nextTrack.id;
    this.preloadEl.src = url;
    this.preloadEl.load();
  }

  /** Lazily create the shared element (browser only). */
  public getElement(): HTMLVideoElement | null {
    if (typeof document === 'undefined') return null;
    if (this.el) return this.el;

    const el = document.createElement('video');
    el.playsInline = true;
    el.preload = 'auto';
    el.className = 'w-full h-full object-contain bg-black';
    el.addEventListener('timeupdate', () => this.handlers.onTime(el.currentTime, el.duration || 0));
    el.addEventListener('loadedmetadata', () => this.handlers.onTime(el.currentTime, el.duration || 0));
    el.addEventListener('ended', () => this.handlers.onEnded());
    el.addEventListener('play', () => this.handlers.onPlayState(true));
    el.addEventListener('pause', () => this.handlers.onPlayState(false));
    el.addEventListener('error', () => void this.handleError());
    this.el = el;
    return el;
  }

  /** Mount or park the shared playback element cleanly. */
  public attachToStage(host: HTMLElement | null): void {
    const el = this.getElement();
    if (!el || typeof document === 'undefined') return;
    if (host) {
      el.style.cssText = '';
      host.appendChild(el);
    } else {
      el.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none';
      document.body.appendChild(el);
    }
  }

  public hasSource(): boolean {
    return Boolean(this.el && this.el.getAttribute('src'));
  }

  /** Load the track and optionally start playback. Returns false if the track has no playable URL. */
  public async load(track: MusicTrack, autoplay: boolean, volume: number): Promise<boolean> {
    const el = this.getElement();
    const url = resolveTrackUrl(track);
    if (!el || !url) return false;

    this.currentTrack = track;
    if (this.retriedTrackId !== track.id) this.retriedTrackId = null;

    // Same-origin proxy/blob URLs are DSP-safe; cross-origin media needs CORS or the graph would mute it
    if (/^https?:\/\//.test(url)) el.crossOrigin = 'anonymous';
    else el.removeAttribute('crossorigin');
    this.viaDsp = this.viaDsp || universalMediaPlayer.attachMediaElement(el);
    el.volume = this.viaDsp ? 1 : Math.max(0, Math.min(1, volume));
    if (this.viaDsp) universalMediaPlayer.setVolume(volume);
    el.src = url;
    if (track.albumArtUrl) el.poster = track.albumArtUrl;
    el.load();

    if (autoplay) {
      try {
        await el.play();
      } catch (err: any) {
        // Autoplay policies / aborted loads are not fatal; real failures arrive via 'error'
        if (err?.name !== 'AbortError' && err?.name !== 'NotAllowedError') {
          this.handlers.onError(err?.message || 'Playback failed');
        }
      }
    }
    return true;
  }

  public async play(): Promise<void> {
    try {
      await this.el?.play();
    } catch {
      /* surfaced through error event */
    }
  }

  public pause(): void {
    this.el?.pause();
  }

  public seek(seconds: number): void {
    if (this.el && Number.isFinite(seconds)) this.el.currentTime = seconds;
  }

  public setVolume(vol: number): void {
    // When routed through the DSP chain the gain node owns loudness (supports boost up to 150%)
    if (this.el) this.el.volume = this.viaDsp ? 1 : Math.max(0, Math.min(1, vol));
  }

  public stop(): void {
    if (!this.el) return;
    this.el.pause();
    this.el.removeAttribute('src');
    this.el.load();
  }

  /** On a media error, refresh the Drive token once and retry before surfacing a message. */
  private async handleError(): Promise<void> {
    const track = this.currentTrack;
    if (!track || !this.el) return;

    const isDrive = Boolean(track.driveFileId) || track.id.startsWith('drive_');
    if (isDrive && this.retriedTrackId !== track.id) {
      this.retriedTrackId = track.id;
      try {
        const rec = await refreshDriveToken();
        if (rec) {
          const t = this.el.currentTime;
          const ok = await this.load(track, true, this.el.volume);
          if (ok) {
            if (t > 0) this.el.currentTime = t;
            return;
          }
        }
      } catch {
        /* fall through to message */
      }
    }

    const code = this.el.error?.code;
    const reason =
      code === 4
        ? 'This file format or source is not playable in the browser.'
        : code === 3
          ? 'The media could not be decoded.'
          : 'The media could not be loaded. Check your Google Drive session and connection.';
    this.handlers.onError(reason);
  }
}
