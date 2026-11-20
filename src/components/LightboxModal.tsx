/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Universal Multi-Format Lightbox Viewer & Non-Destructive In-Place Editor
 * Dynamically renders all 16 FormatViewerKind views and supports all 9 FormatEditorKind
 * workflows (in-place code/markdown/JSON/CSV/LUT/XMP editors + studio handoffs + PiP toggle).
 */

import React, { useEffect, useMemo, useRef, useState, Suspense, lazy } from 'react';
import {
  X,
  Download,
  Sliders,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Cloud,
  HardDrive,
  Star,
  FileText,
  Volume2,
  Play,
  Pause,
  Repeat,
  Tv,
  Table,
  Code,
  Archive,
  BookOpen,
  Copy,
  Check,
  Search,
  Database,
  Box,
  Type,
  Edit3,
  Eye,
  Save,
  Plus,
  Trash2,
  Sparkles,
  FileCode2,
  Scissors,
  Music,
  Pin,
} from 'lucide-react';
import type { MediaAsset } from '../types';
import { universalMediaPlayer } from '../services/universalMediaPlayerEngine';
import { generateXmpXml } from '../services/xmpExporter';
import {
  classifyLoadedAsset,
  getContextMenuSpecForAsset,
  loadAssetContentSample,
  parseCsvToGrid,
  parseCubeLutData,
  resolveViewableAssetStreamUrl,
  serializeGridToCsv,
  parseZipDirectoryEntries,
} from '../services/universalFileViewerEngine';
import { Native3dCadViewer } from './Native3dCadViewer';
const NativeShaderStudio = lazy(() => import('./NativeShaderStudio').then((m) => ({ default: m.NativeShaderStudio })));
const NativeHeightmapMapViewer = lazy(() => import('./NativeHeightmapMapViewer').then((m) => ({ default: m.NativeHeightmapMapViewer })));

export interface LightboxModalProps {
  asset: MediaAsset | null;
  onClose: () => void;
  onDownload?: (asset: MediaAsset) => void;
  onOpenEditor?: (asset: MediaAsset) => void;
  onOpenDedicatedStudio?: (asset: MediaAsset) => void;
  onOpenReview?: (asset: MediaAsset) => void;
  onStarToggle?: (asset: MediaAsset) => void;
  onOpenPip?: (asset: MediaAsset) => void;
  onNext?: () => void;
  onPrev?: () => void;
  canNext?: boolean;
  canPrev?: boolean;
  positionLabel?: string;
  initialEditMode?: boolean;
  isPipActive?: boolean;
  onSaveEditedAsset?: (asset: MediaAsset, updatedText: string, saveToDisk?: boolean) => Promise<void> | void;
  onOpenVideoTrimmer?: (asset: MediaAsset) => void;
  onOpenMusicPlayer?: (asset: MediaAsset) => void;
  onOpenFormatDb?: (query: string) => void;
}

function formatBytesHuman(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatSecondsHuman(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatHexRows(bytes: Uint8Array, limit = 512): Array<{ offset: string; hex: string; ascii: string }> {
  const rows: Array<{ offset: string; hex: string; ascii: string }> = [];
  const cap = Math.min(bytes.length, limit);
  for (let i = 0; i < cap; i += 16) {
    const slice = bytes.subarray(i, Math.min(i + 16, cap));
    const hexParts: string[] = [];
    let ascii = '';
    for (let j = 0; j < 16; j++) {
      if (j < slice.length) {
        hexParts.push(slice[j].toString(16).toUpperCase().padStart(2, '0'));
        const ch = slice[j];
        ascii += ch >= 32 && ch <= 126 ? String.fromCharCode(ch) : '.';
      } else {
        hexParts.push('  ');
        ascii += ' ';
      }
    }
    rows.push({
      offset: i.toString(16).toUpperCase().padStart(6, '0'),
      hex: hexParts.join(' '),
      ascii,
    });
  }
  return rows;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  asset,
  onClose,
  onDownload,
  onOpenEditor,
  onOpenDedicatedStudio,
  onOpenReview,
  onStarToggle,
  onOpenPip,
  onNext,
  onPrev,
  canNext = true,
  canPrev = true,
  positionLabel,
  initialEditMode = false,
  isPipActive = false,
  onSaveEditedAsset,
  onOpenVideoTrimmer,
  onOpenMusicPlayer,
  onOpenFormatDb,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(180);
  const [audioVolume, setAudioVolume] = useState(1.0);
  const [videoSpeed, setVideoSpeed] = useState(1.0);
  const [isVideoLooping, setIsVideoLooping] = useState(false);

  // Content loading & editing states
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [draftText, setDraftText] = useState('');
  const [rawBytes, setRawBytes] = useState<Uint8Array>(new Uint8Array());
  const [isSynthesized, setIsSynthesized] = useState(false);
  const [isEditMode, setIsEditMode] = useState(initialEditMode);
  const [markdownSplitView, setMarkdownSplitView] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Spreadsheet search & grid state
  const [csvFilter, setCsvFilter] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvDelimiter, setCsvDelimiter] = useState(',');

  // LUT adjuster state
  const [lutIntensity, setLutIntensity] = useState(85);
  const [showXmpPanel, setShowXmpPanel] = useState(false);
  const [xmpTagsInput, setXmpTagsInput] = useState('');
  const [xmpDescriptionInput, setXmpDescriptionInput] = useState('');

  // Font specimen custom sample text
  const [fontSampleText, setFontSampleText] = useState(
    'The quick brown fox jumps over 1234567890 Studio Pixels & RAW Frames!'
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  const contextSpec = useMemo(() => (asset ? getContextMenuSpecForAsset(asset) : null), [asset]);
  const streamUrl = useMemo(() => (asset ? resolveViewableAssetStreamUrl(asset) : ''), [asset]);

  const classification = useMemo(() => {
    if (!asset) return null;
    return classifyLoadedAsset(
      asset,
      rawBytes.length > 0 ? rawBytes : undefined,
      textContent || undefined
    );
  }, [asset, rawBytes, textContent]);

  // Synchronize asset load & sample inspection when asset changes
  useEffect(() => {
    setZoomLevel(1);
    setIsPlayingAudio(false);
    setAudioProgress(0);
    setSaveFeedback(null);
    setShowXmpPanel(false);
    setCsvFilter('');
    setIsEditMode(initialEditMode);

    if (!asset) return;

    setXmpTagsInput((asset.tags || []).join(', '));
    setXmpDescriptionInput(
      ((asset.metadata as Record<string, unknown> | undefined)?.description as string) ||
        asset.aiDescription ||
        ''
    );

    const spec = getContextMenuSpecForAsset(asset);
    const v = spec.format.viewer;
    setShowXmpPanel(Boolean(initialEditMode && spec.format.editor === 'metadata-xmp-editor'));

    if (v === 'audio-player') {
      const audioSrc = resolveViewableAssetStreamUrl(asset);
      universalMediaPlayer.loadMedia(audioSrc || '', asset.name);
      const unsub = universalMediaPlayer.subscribe((state) => {
        setIsPlayingAudio(state.isPlaying);
        setAudioProgress(state.currentTime);
        if (state.duration) setAudioDuration(state.duration);
        setAudioVolume(state.volume);
      });
      return () => unsub();
    }

    const needsByteOrTextSample =
      v !== 'video-player' &&
      v !== 'image-lightbox' &&
      v !== 'raw-demosaic-viewer' &&
      v !== 'pdf-viewer';

    if (!needsByteOrTextSample) {
      setRawBytes(new Uint8Array());
      setTextContent('');
      setDraftText('');
      return;
    }

    let cancelled = false;
    setIsLoadingContent(true);
    loadAssetContentSample(asset, 131072)
      .then((sample) => {
        if (cancelled) return;
        setRawBytes(sample.bytes);
        setTextContent(sample.text);
        setDraftText(sample.text);
        setIsSynthesized(sample.isSynthesizedFallback);
        if (v === 'spreadsheet-grid') {
          const grid = parseCsvToGrid(sample.text);
          setCsvHeaders(grid.headers);
          setCsvRows(grid.rows);
          setCsvDelimiter(grid.delimiter);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingContent(false);
      });

    return () => {
      cancelled = true;
    };
  }, [asset?.id, initialEditMode]);

  // Audio waveform animation loop
  useEffect(() => {
    if (!asset || !contextSpec || contextSpec.format.viewer !== 'audio-player') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const waveform = universalMediaPlayer.getWaveformData();

      ctx.beginPath();
      ctx.strokeStyle = '#52B197';
      ctx.lineWidth = 2.5;

      for (let i = 0; i < canvas.width; i += 3) {
        const idx = Math.floor((i / canvas.width) * waveform.length);
        const val = waveform[idx] || 128;
        const normalized = (val - 128) / 128;
        const y =
          canvas.height / 2 +
          (isPlayingAudio ? normalized * 38 : Math.sin(phase + i * 0.08) * 4);
        if (i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
      }

      ctx.stroke();
      phase += 0.06;
      animRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [asset, contextSpec, isPlayingAudio]);

  // Dynamic @font-face registration for font-specimen viewer
  const specimenFontFamily = useMemo(() => {
    if (!asset) return 'sans-serif';
    return `dtSpecimen_${asset.id.replace(/[^a-zA-Z0-9]/g, '')}`;
  }, [asset]);

  useEffect(() => {
    if (!asset || !contextSpec || contextSpec.format.viewer !== 'font-specimen' || !streamUrl) return;
    const styleId = `style-${specimenFontFamily}`;
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `@font-face { font-family: '${specimenFontFamily}'; src: url('${streamUrl}'); font-display: swap; }`;
    return () => {
      styleEl?.remove();
    };
  }, [asset, contextSpec, streamUrl, specimenFontFamily]);

  // Keyboard navigation: pause arrow stepping when editing inside an input or textarea
  useEffect(() => {
    if (!asset) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName || '';
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (isTyping) return;
      if (e.key === 'ArrowRight' && onNext) onNext();
      else if (e.key === 'ArrowLeft' && onPrev) onPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [asset, onClose, onNext, onPrev]);

  const zipEntries = useMemo(() => {
    if (!contextSpec || contextSpec.format.viewer !== 'archive-inspector') return [];
    return parseZipDirectoryEntries(rawBytes);
  }, [contextSpec, rawBytes]);

  const lutData = useMemo(() => {
    if (!contextSpec || contextSpec.format.family !== 'color_lut_sidecar') return null;
    return parseCubeLutData(draftText || textContent);
  }, [contextSpec, draftText, textContent]);

  const hexRows = useMemo(() => {
    if (rawBytes.length === 0) return [];
    return formatHexRows(rawBytes, 512);
  }, [rawBytes]);

  if (!asset || !contextSpec) return null;

  const fmt = contextSpec.format;
  const viewerKind = fmt.viewer;
  const isLutSidecar = fmt.family === 'color_lut_sidecar';
  const ext = (asset.extension || fmt.extension || '').toLowerCase();
  const isCloud = asset.source === 'cloud';
  const isStarred = Boolean(asset.cullingStatus === 'picked' || asset.rating > 0);
  const inlineEditable =
    contextSpec.editorRoute === 'lightbox-inline-editor' && fmt.editor !== 'metadata-xmp-editor';

  const effectiveSaveContent =
    viewerKind === 'spreadsheet-grid'
      ? serializeGridToCsv(csvHeaders, csvRows, csvDelimiter)
      : draftText;

  const jsonValidation = (() => {
    if (viewerKind !== 'json-tree-viewer') return null;
    try {
      const parsed = JSON.parse(draftText || '{}');
      return { valid: true as const, parsed };
    } catch (err: any) {
      return { valid: false as const, error: err?.message || 'Invalid JSON syntax' };
    }
  })();

  const handleCopyText = (val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 1800);
  };

  const handleTriggerSave = async (saveToDisk: boolean) => {
    if (!onSaveEditedAsset) {
      handleDownloadEditedCopy(effectiveSaveContent, asset.name);
      setSaveFeedback('Downloaded edited copy to your computer.');
      return;
    }
    setIsSaving(true);
    setSaveFeedback(null);
    try {
      await onSaveEditedAsset(asset, effectiveSaveContent, saveToDisk);
      setTextContent(effectiveSaveContent);
      setSaveFeedback(
        saveToDisk
          ? 'Saved non-destructive copy on disk & updated catalog.'
          : 'Saved changes non-destructively to IndexedDB catalog.'
      );
    } catch (err: any) {
      setSaveFeedback(err?.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadEditedCopy = (content: string, originalName: string) => {
    const dotIdx = originalName.lastIndexOf('.');
    const downloadName =
      dotIdx > 0
        ? `${originalName.slice(0, dotIdx)} (edited)${originalName.slice(dotIdx)}`
        : `${originalName}-edited.txt`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const handleExportXmpSidecar = () => {
    const tags = xmpTagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const updatedAsset: MediaAsset = {
      ...asset,
      tags,
      aiDescription: xmpDescriptionInput,
    };
    const xml = generateXmpXml(updatedAsset);
    const xmpName = `${asset.name.replace(/\.[^/.]+$/, '')}.xmp`;
    const blob = new Blob([xml], { type: 'application/rdf+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = xmpName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    setSaveFeedback(`Exported Adobe XMP sidecar (${xmpName}).`);
  };

  const handleNativeVideoPip = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          return;
        } else {
          await videoRef.current.requestPictureInPicture();
          return;
        }
      } catch {
        // Fallback to floating in-app PiP window
      }
    }
    onOpenPip?.(asset);
  };

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/92 backdrop-blur-md flex flex-col justify-between animate-in fade-in duration-150 select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Viewer for ${asset.name}`}
    >
      {/* Top Header Bar */}
      <div
        className="w-full min-h-[56px] px-4 py-2 bg-gradient-to-b from-black/85 to-transparent flex flex-wrap items-center justify-between gap-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-white shrink-0 ${
              isCloud ? 'bg-[#1074B1]/85' : 'bg-[#52B197]/85'
            }`}
          >
            {isCloud ? <Cloud className="w-3.5 h-3.5" /> : <HardDrive className="w-3.5 h-3.5" />}
            <span>{isCloud ? 'Google Drive' : 'Computer'}</span>
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate max-w-[240px] sm:max-w-md" title={asset.name}>
              {asset.name}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-300 font-mono tabular-nums flex-wrap">
              <span>{formatBytesHuman(asset.sizeBytes)}</span>
              <span>•</span>
              <span className="uppercase font-bold text-sky-300">{fmt.extension}</span>
              <span className="hidden md:inline opacity-75">• {fmt.name}</span>
              <span className="hidden lg:inline px-1.5 py-0.2 rounded bg-white/10 text-[10px]">
                {viewerKind}
              </span>
            </div>
          </div>
        </div>

        {/* Contextual Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {(viewerKind === 'image-lightbox' || viewerKind === 'raw-demosaic-viewer') && (
            <div className="hidden sm:flex items-center gap-1 bg-white/10 backdrop-blur-xs rounded-xl p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.max(0.5, prev - 0.25))}
                className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg text-white/85 hover:text-white hover:bg-white/10 flex items-center justify-center"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-white/95 font-mono px-1.5 tabular-nums">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.min(4, prev + 0.25))}
                className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg text-white/85 hover:text-white hover:bg-white/10 flex items-center justify-center"
                title="Zoom In"
                aria-label="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Interactive PiP Toggle / Pin Reference */}
          {onOpenPip && contextSpec.pipMode && (
            <button
              type="button"
              onClick={() => onOpenPip(asset)}
              className={`min-h-[40px] px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors ${
                isPipActive
                  ? 'bg-teal-500 text-white border-teal-400 shadow-xs'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
              }`}
              title={contextSpec.pipLabel || 'Toggle PiP'}
            >
              {contextSpec.pipMode === 'media' ? (
                <Tv className="w-3.5 h-3.5" />
              ) : (
                <Pin className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {isPipActive
                  ? 'PiP Active'
                  : contextSpec.pipMode === 'media'
                  ? 'Toggle PiP'
                  : 'Pin to PiP'}
              </span>
            </button>
          )}

          {/* Format-Specific Primary Editor Trigger */}
          {inlineEditable && (
            <button
              type="button"
              onClick={() => setIsEditMode((prev) => !prev)}
              className={`min-h-[40px] px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                isEditMode
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
              title={isEditMode ? 'Switch to Read-Only Viewer' : 'Edit Non-Destructively In-Place'}
            >
              {isEditMode ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
              <span>{isEditMode ? 'Preview' : 'Edit File'}</span>
            </button>
          )}

          {contextSpec.editorRoute === 'pixel-studio' && onOpenEditor && (
            <button
              type="button"
              onClick={() => {
                onOpenEditor(asset);
                onClose();
              }}
              className="min-h-[40px] px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              title={contextSpec.editorLabel || 'Open Studio Editor'}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {fmt.editor === 'raw-developer' ? 'Develop RAW' : 'Pixel Studio'}
              </span>
            </button>
          )}

          {contextSpec.editorRoute === 'video-trimmer' && onOpenVideoTrimmer && (
            <button
              type="button"
              onClick={() => {
                onOpenVideoTrimmer(asset);
                onClose();
              }}
              className="min-h-[40px] px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Open Lossless Video Trimmer"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Trim Video</span>
            </button>
          )}

          {contextSpec.isMediaPlayerCompatible && onOpenMusicPlayer && (
            <button
              type="button"
              onClick={() => {
                onOpenMusicPlayer(asset);
                onClose();
              }}
              className="min-h-[40px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Open in Media Studio Player (3-Band EQ & Queue)"
            >
              <Music className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Media Studio</span>
            </button>
          )}

          {/* Non-Destructive XMP Metadata Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowXmpPanel((prev) => !prev)}
            className={`min-h-[40px] px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
              showXmpPanel
                ? 'bg-[#1074B1] text-white border-[#1074B1]'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
            }`}
            title="Edit Non-Destructive XMP Sidecar & Tags"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">XMP Meta</span>
          </button>

          {onOpenDedicatedStudio && (
            <button
              type="button"
              onClick={() => {
                onOpenDedicatedStudio(asset);
                onClose();
              }}
              className="min-h-[40px] px-3 rounded-xl bg-gradient-to-r from-[#1074B1] to-[#52B197] hover:opacity-95 text-white text-xs font-bold flex items-center gap-1.5 transition-opacity"
              title={
                fmt.family === 'cad_3d'
                  ? 'Open in Fullscreen 3D/CAD Viewer Workspace'
                  : 'Open in Full Native Multi-Format Studio Workspace'
              }
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {fmt.family === 'cad_3d' ? '3D/CAD Viewport' : 'Native Studio'}
              </span>
            </button>
          )}

          {onOpenFormatDb && (
            <button
              type="button"
              onClick={() => onOpenFormatDb(fmt.extension)}
              className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-white/10 hover:bg-white/20 text-sky-300 transition-colors flex items-center justify-center"
              title={`Inspect .${fmt.extension} in Format Registry`}
              aria-label="Inspect format specification"
            >
              <Database className="w-4 h-4" />
            </button>
          )}

          {onStarToggle && (
            <button
              type="button"
              onClick={() => onStarToggle(asset)}
              className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center"
              title={isStarred ? 'Unstar' : 'Star'}
              aria-label={isStarred ? 'Unstar file' : 'Star file'}
            >
              <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>
          )}

          {onDownload && (
            <button
              type="button"
              onClick={() => onDownload(asset)}
              className="min-h-[40px] px-3 rounded-xl bg-[#1074B1] hover:bg-[#0e6499] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Download Original File"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center"
            title="Close (Esc)"
            aria-label="Close Viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Stage */}
      <div
        className="flex-1 flex items-center justify-center p-4 relative overflow-hidden"
        onClick={onClose}
      >
        {onPrev && (
          <button
            type="button"
            disabled={!canPrev}
            onClick={(e) => {
              e.stopPropagation();
              if (canPrev) onPrev();
            }}
            className={`min-h-[44px] min-w-[44px] absolute left-4 p-3 rounded-full bg-black/55 text-white border border-white/15 backdrop-blur-xs transition-colors z-10 flex items-center justify-center ${
              canPrev ? 'hover:bg-black/85 cursor-pointer' : 'opacity-30 cursor-not-allowed'
            }`}
            title={positionLabel ? `Previous (${positionLabel})` : 'Previous (Arrow Left)'}
            aria-label="Previous file"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {onNext && (
          <button
            type="button"
            disabled={!canNext}
            onClick={(e) => {
              e.stopPropagation();
              if (canNext) onNext();
            }}
            className={`min-h-[44px] min-w-[44px] absolute right-4 p-3 rounded-full bg-black/55 text-white border border-white/15 backdrop-blur-xs transition-colors z-10 flex items-center justify-center ${
              canNext ? 'hover:bg-black/85 cursor-pointer' : 'opacity-30 cursor-not-allowed'
            }`}
            title={positionLabel ? `Next (${positionLabel})` : 'Next (Arrow Right)'}
            aria-label="Next file"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        <div
          className="max-w-full max-h-full flex items-center justify-center gap-4 transition-transform duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* VIEWER 1 & 2: Image & Camera RAW Demosaic Viewer */}
          {(viewerKind === 'image-lightbox' || viewerKind === 'raw-demosaic-viewer') && (
            <div style={{ transform: `scale(${zoomLevel})` }} className="transition-transform duration-150">
              <img
                src={streamUrl || asset.thumbnailUrl}
                alt={asset.name}
                className="max-w-[90vw] max-h-[76vh] object-contain rounded-xl shadow-2xl"
                crossOrigin="anonymous"
              />
            </div>
          )}

          {/* VIEWER 3: Video Theatre Player */}
          {viewerKind === 'video-player' && (
            <div className="flex flex-col items-center gap-3">
              <video
                ref={videoRef}
                src={streamUrl || asset.thumbnailUrl}
                poster={
                  asset.thumbnailUrl &&
                  !asset.thumbnailUrl.includes('/api/fs/stream') &&
                  !/\.(mp4|mov|mkv|webm|avi|m4v)(\?|$)/i.test(asset.thumbnailUrl)
                    ? asset.thumbnailUrl
                    : undefined
                }
                controls
                autoPlay
                playsInline
                loop={isVideoLooping}
                className="max-w-[90vw] max-h-[68vh] rounded-2xl shadow-2xl bg-black"
              />
              <div className="px-4 py-2 rounded-2xl bg-black/70 border border-white/15 backdrop-blur-md flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-white">
                <button
                  type="button"
                  onClick={handleNativeVideoPip}
                  className="min-h-[36px] flex items-center gap-1.5 px-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 font-semibold"
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>Browser / Floating PiP</span>
                </button>

                <div className="flex items-center gap-1 border-l border-white/15 pl-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 1 / 30);
                    }}
                    className="min-h-[32px] px-2 rounded-lg bg-white/10 hover:bg-white/20 font-mono text-[11px]"
                    title="Step Back 1 Frame"
                  >
                    -1f
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (videoRef.current) videoRef.current.currentTime += 1 / 30;
                    }}
                    className="min-h-[32px] px-2 rounded-lg bg-white/10 hover:bg-white/20 font-mono text-[11px]"
                    title="Step Forward 1 Frame"
                  >
                    +1f
                  </button>
                </div>

                <div className="flex items-center gap-1 border-l border-white/15 pl-2">
                  {[0.5, 1.0, 1.5, 2.0].map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => {
                        setVideoSpeed(s);
                        if (videoRef.current) videoRef.current.playbackRate = s;
                      }}
                      className={`min-h-[32px] px-2 rounded-lg text-[11px] font-bold ${
                        videoSpeed === s ? 'bg-white text-black' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setIsVideoLooping(!isVideoLooping)}
                  className={`min-h-[36px] p-2 rounded-lg border transition-colors ${
                    isVideoLooping ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 font-bold' : 'border-white/15 opacity-70 hover:opacity-100'
                  }`}
                  title="Toggle Loop"
                  aria-label="Toggle Loop"
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* VIEWER 4: Audio Waveform & DSP Viewer */}
          {viewerKind === 'audio-player' && (
            <div className="p-7 sm:p-9 rounded-3xl bg-slate-900/95 border border-slate-700/80 text-white flex flex-col items-center gap-5 shadow-2xl max-w-lg w-full">
              <div className="flex items-center gap-4 w-full">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#1074B1] to-[#52B197] flex items-center justify-center shadow-lg relative shrink-0">
                  <Volume2 className="w-9 h-9 text-white" />
                  {isPlayingAudio && <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase tracking-wider">
                      {ext.toUpperCase()} Audio Studio
                    </span>
                    {onOpenPip && (
                      <button
                        type="button"
                        onClick={() => onOpenPip(asset)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 inline-flex items-center gap-1 hover:bg-teal-500/30"
                      >
                        <Tv className="w-3 h-3" />
                        <span>{isPipActive ? 'Close PiP' : 'PiP'}</span>
                      </button>
                    )}
                  </div>
                  <h3 className="font-bold text-base truncate mt-1">{asset.name}</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5 tabular-nums">
                    {formatBytesHuman(asset.sizeBytes)} • Web Audio DSP
                  </p>
                </div>
              </div>

              <div className="w-full h-16 rounded-2xl border border-slate-700/60 bg-black/40 p-2 flex items-center justify-center">
                <canvas ref={canvasRef} width={420} height={48} className="w-full h-full rounded-lg" />
              </div>

              <div className="w-full space-y-1">
                <input
                  type="range"
                  min="0"
                  max={audioDuration || 180}
                  value={audioProgress}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setAudioProgress(val);
                    universalMediaPlayer.seek(val);
                  }}
                  aria-label="Audio playback progress"
                  className="w-full h-1.5 accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] font-mono text-slate-400 tabular-nums">
                  <span>{formatSecondsHuman(audioProgress)}</span>
                  <span>{formatSecondsHuman(audioDuration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between w-full pt-1 gap-3">
                <button
                  type="button"
                  onClick={() => universalMediaPlayer.togglePlay()}
                  className="min-h-[44px] px-5 rounded-xl bg-gradient-to-r from-[#1074B1] to-[#52B197] hover:opacity-95 text-white font-bold text-xs flex items-center gap-2 shadow-md"
                >
                  {isPlayingAudio ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                  <span>{isPlayingAudio ? 'Pause' : 'Play'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-bold">Vol</span>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={audioVolume}
                    onChange={(e) => universalMediaPlayer.setVolume(parseFloat(e.target.value))}
                    aria-label="Audio volume"
                    className="w-24 h-1.5 accent-sky-500 cursor-pointer"
                  />
                  <span className="text-[11px] font-mono text-slate-300 tabular-nums w-10 text-right">
                    {Math.round(audioVolume * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* VIEWER 5: Interactive PDF Reader */}
          {viewerKind === 'pdf-viewer' && (
            <div className="w-[88vw] max-w-5xl h-[76vh] rounded-3xl bg-slate-900 border border-slate-700 text-white flex flex-col overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-bold truncate">{asset.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold">
                    PDF Document
                  </span>
                </div>
                {onDownload && (
                  <button
                    type="button"
                    onClick={() => onDownload(asset)}
                    className="min-h-[36px] px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                )}
              </div>
              <div className="flex-1 bg-slate-950 p-3 flex items-center justify-center">
                {streamUrl ? (
                  <iframe src={streamUrl} title={asset.name} className="w-full h-full rounded-xl border border-slate-800 bg-white" />
                ) : (
                  <div className="text-center space-y-2 text-slate-400 p-8">
                    <FileText className="w-12 h-12 mx-auto text-rose-400" />
                    <p className="font-semibold text-white">{asset.name}</p>
                    <p className="text-xs">Connect Google Drive or open a local OS PDF file to stream document pages inline.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEWER 6 & 7: Markdown & Document Reader + In-Place Text Editor */}
          {(viewerKind === 'markdown-viewer' || viewerKind === 'document-reader') && (
            <div className="w-[88vw] max-w-4xl h-[76vh] rounded-3xl bg-slate-900 border border-slate-700 text-white flex flex-col overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="font-bold truncate">{asset.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold uppercase">
                    {fmt.extension}
                  </span>
                  {isSynthesized && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                      Sample Synthesis
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {viewerKind === 'markdown-viewer' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditMode(true);
                        setMarkdownSplitView((v) => !v);
                      }}
                      className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold ${
                        markdownSplitView ? 'bg-sky-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                    >
                      {markdownSplitView ? 'Split Active' : 'Split Edit'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopyText(draftText)}
                    className="min-h-[36px] px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText ? 'Copied' : 'Copy'}</span>
                  </button>
                  {isEditMode && (
                    <>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void handleTriggerSave(false)}
                        className="min-h-[36px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Catalog</span>
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void handleTriggerSave(true)}
                        className="min-h-[36px] px-3 rounded-xl bg-[#1074B1] hover:bg-[#0e6499] text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>Save Copy</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {saveFeedback && (
                <div className="px-4 py-2 bg-emerald-950/60 border-b border-emerald-700/50 text-emerald-300 text-xs font-semibold">
                  {saveFeedback}
                </div>
              )}

              <div className={`flex-1 min-h-0 ${markdownSplitView ? 'grid grid-cols-1 md:grid-cols-2 divide-x divide-slate-800' : 'flex flex-col'}`}>
                {isEditMode && (
                  <textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    aria-label="Edit document text"
                    className="w-full h-full flex-1 p-5 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed resize-none focus:outline-none"
                  />
                )}
                {(!isEditMode || markdownSplitView) && (
                  <div className="flex-1 overflow-y-auto p-6 space-y-2 text-sm leading-relaxed text-slate-200 select-text">
                    {isLoadingContent ? (
                      <p className="text-slate-400 text-xs">Loading document stream...</p>
                    ) : (
                      (draftText || textContent).split(/\r?\n/).map((line, i) => {
                        if (line.startsWith('# ')) {
                          return <h1 key={i} className="text-xl font-bold text-white border-b border-slate-800 pb-2">{line.slice(2)}</h1>;
                        }
                        if (line.startsWith('## ')) {
                          return <h2 key={i} className="text-base font-bold text-sky-300 pt-2">{line.slice(3)}</h2>;
                        }
                        if (line.startsWith('- ') || line.startsWith('* ')) {
                          return <li key={i} className="ml-5 list-disc text-xs text-slate-200">{line.slice(2)}</li>;
                        }
                        if (line.startsWith('> ')) {
                          return <blockquote key={i} className="pl-3 border-l-2 border-sky-500 text-slate-300 italic text-xs">{line.slice(2)}</blockquote>;
                        }
                        return <p key={i} className="text-xs whitespace-pre-wrap">{line || '\u00A0'}</p>;
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEWER 8: Interactive Spreadsheet Grid + Editable Cells */}
          {viewerKind === 'spreadsheet-grid' && (
            <div className="w-[90vw] max-w-5xl h-[76vh] rounded-3xl bg-slate-900 border border-slate-700 text-white flex flex-col overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Table className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold truncate">{asset.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold tabular-nums">
                    {csvHeaders.length} cols × {csvRows.length} rows
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative w-44">
                    <Search className="w-3 h-3 absolute left-2.5 top-3 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={csvFilter}
                      onChange={(e) => setCsvFilter(e.target.value)}
                      placeholder="Filter rows..."
                      aria-label="Filter spreadsheet rows"
                      className="w-full min-h-[36px] pl-7 pr-2 text-xs rounded-xl bg-black/50 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  {isEditMode && (
                    <>
                      <button
                        type="button"
                        onClick={() => setCsvRows((prev) => [...prev, csvHeaders.map(() => '')])}
                        className="min-h-[36px] px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Row</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleTriggerSave(false)}
                        className="min-h-[36px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold flex items-center gap-1"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Catalog</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleTriggerSave(true)}
                        className="min-h-[36px] px-3 rounded-xl bg-[#1074B1] hover:bg-[#0e6499] text-xs font-bold flex items-center gap-1"
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>Save CSV Copy</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {saveFeedback && (
                <div className="px-4 py-2 bg-emerald-950/60 border-b border-emerald-700/50 text-emerald-300 text-xs font-semibold">
                  {saveFeedback}
                </div>
              )}

              <div className="flex-1 overflow-auto p-4">
                <table className="w-full text-left text-xs border-collapse tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-700 text-[11px] font-bold text-slate-300 uppercase bg-slate-950/60">
                      <th className="p-2 w-10">#</th>
                      {csvHeaders.map((h, ci) => (
                        <th key={ci} className="p-2">{h || `Col ${ci + 1}`}</th>
                      ))}
                      {isEditMode && <th className="p-2 w-12">Del</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                    {csvRows.map((row, ri) => {
                      const matches =
                        !csvFilter ||
                        row.some((c) => c.toLowerCase().includes(csvFilter.toLowerCase()));
                      if (!matches) return null;
                      return (
                        <tr key={ri} className="hover:bg-white/5 transition-colors">
                          <td className="p-2 text-slate-500">{ri + 1}</td>
                          {csvHeaders.map((_, ci) => (
                            <td key={ci} className="p-1.5">
                              {isEditMode ? (
                                <input
                                  type="text"
                                  value={row[ci] ?? ''}
                                  onChange={(e) => {
                                    const nextVal = e.target.value;
                                    setCsvRows((prev) =>
                                      prev.map((r, rIdx) =>
                                        rIdx === ri
                                          ? r.map((cell, cIdx) => (cIdx === ci ? nextVal : cell))
                                          : r
                                      )
                                    );
                                  }}
                                  aria-label={`Row ${ri + 1} Column ${ci + 1}`}
                                  className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white focus:border-emerald-400 focus:outline-none"
                                />
                              ) : (
                                <span className="px-1 select-text">{row[ci] ?? ''}</span>
                              )}
                            </td>
                          ))}
                          {isEditMode && (
                            <td className="p-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setCsvRows((prev) => prev.filter((_, rIdx) => rIdx !== ri))
                                }
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20"
                                title="Delete row"
                                aria-label="Delete row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEWER 9 & 10: Code Viewer & JSON Tree Viewer + Live Editor + LUT Strip */}
          {((viewerKind === 'code-viewer' && (fmt.family !== 'cad_3d' || isEditMode)) ||
            viewerKind === 'json-tree-viewer') && (
            <div className="w-[88vw] max-w-4xl h-[76vh] rounded-3xl bg-slate-900 border border-slate-700 text-white flex flex-col overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Code className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-bold truncate">{asset.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold font-mono uppercase">
                    {fmt.extension}
                  </span>
                  {jsonValidation && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        jsonValidation.valid
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {jsonValidation.valid ? 'Valid JSON' : 'JSON Syntax Error'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {viewerKind === 'json-tree-viewer' && jsonValidation?.valid && (
                    <button
                      type="button"
                      onClick={() => setDraftText(JSON.stringify(jsonValidation.parsed, null, 2))}
                      className="min-h-[36px] px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold"
                    >
                      Prettify JSON
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopyText(draftText)}
                    className="min-h-[36px] px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText ? 'Copied' : 'Copy'}</span>
                  </button>
                  {isEditMode && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleTriggerSave(false)}
                        className="min-h-[36px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Catalog</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleTriggerSave(true)}
                        className="min-h-[36px] px-3 rounded-xl bg-[#1074B1] hover:bg-[#0e6499] text-xs font-bold flex items-center gap-1.5"
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>Save Copy</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {saveFeedback && (
                <div className="px-4 py-2 bg-emerald-950/60 border-b border-emerald-700/50 text-emerald-300 text-xs font-semibold">
                  {saveFeedback}
                </div>
              )}

              {isLutSidecar && lutData && (
                <div className="p-4 border-b border-slate-800 bg-slate-900/90 space-y-3 shrink-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs tabular-nums">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">LUT TITLE</span>
                      <span className="font-bold text-white truncate block">{lutData.title}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">3D CUBE GRID</span>
                      <span className="font-bold text-amber-300">{lutData.size3d}³ points</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">INTENSITY PREVIEW</span>
                      <span className="font-bold text-emerald-300">{lutIntensity}%</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={lutIntensity}
                        onChange={(e) => setLutIntensity(Number(e.target.value))}
                        aria-label="LUT Preview Intensity"
                        className="w-full accent-amber-400"
                      />
                    </div>
                  </div>
                  <div
                    className="h-10 rounded-xl border border-slate-700"
                    style={{
                      background:
                        'linear-gradient(90deg, #000000 0%, #1074B1 25%, #52B197 50%, #BEBF61 75%, #ffffff 100%)',
                      filter: `contrast(${100 + Math.round(lutIntensity * 0.25)}%) saturate(${85 + Math.round(lutIntensity * 0.45)}%)`,
                    }}
                  />
                </div>
              )}

              {isEditMode ? (
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  aria-label="Edit source code"
                  className="flex-1 w-full p-4 bg-slate-950 font-mono text-xs text-emerald-300 leading-relaxed resize-none focus:outline-none"
                />
              ) : viewerKind === 'json-tree-viewer' && jsonValidation?.valid && typeof jsonValidation.parsed === 'object' && jsonValidation.parsed !== null ? (
                <div className="flex-1 overflow-auto p-5 bg-slate-950 font-mono text-xs space-y-2 select-text">
                  {Object.entries(jsonValidation.parsed as Record<string, unknown>).map(([k, v]) => (
                    <div key={k} className="p-2.5 rounded-xl border border-slate-800 bg-white/[0.03] flex flex-col sm:flex-row sm:items-start gap-2">
                      <span className="text-sky-300 font-bold shrink-0 sm:w-44 break-all">&quot;{k}&quot;:</span>
                      <span className="text-emerald-300 break-all whitespace-pre-wrap">
                        {typeof v === 'object' ? JSON.stringify(v, null, 2) : JSON.stringify(v)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs leading-relaxed select-text">
                  {(draftText || textContent).split(/\r?\n/).map((line, i) => (
                    <div key={i} className="flex gap-4 hover:bg-white/[0.03]">
                      <span className="w-10 text-right text-slate-600 select-none shrink-0 tabular-nums">
                        {i + 1}
                      </span>
                      <span className="text-slate-200 whitespace-pre">{line || ' '}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEWER 11: Real Archive Package Inspector */}
          {viewerKind === 'archive-inspector' && (
            <div className="w-[86vw] max-w-3xl max-h-[76vh] rounded-3xl bg-slate-900 border border-slate-700 text-white flex flex-col overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Archive className="w-4 h-4 text-purple-400" />
                  <span className="font-bold truncate">{asset.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold uppercase">
                    {fmt.containerFormat || fmt.extension} Archive
                  </span>
                </div>
                {onDownload && (
                  <button
                    type="button"
                    onClick={() => onDownload(asset)}
                    className="min-h-[36px] px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Archive</span>
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 text-xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 tabular-nums">
                  {zipEntries.length > 0
                    ? `Parsed Container Entries (${zipEntries.length})`
                    : `Binary Archive Telemetry (${fmt.preservationGrade})`}
                </div>
                {zipEntries.length > 0 ? (
                  zipEntries.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl border border-slate-800 bg-white/5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                        <span className="font-semibold text-white truncate">{item.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-300 tabular-nums shrink-0">
                        {formatBytesHuman(item.uncompressedBytes)} ({formatBytesHuman(item.compressedBytes)} packed)
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950 font-mono text-[11px] space-y-2">
                    <p className="text-slate-300">{fmt.description}</p>
                    {hexRows.slice(0, 6).map((row) => (
                      <div key={row.offset} className="flex gap-3 text-slate-400">
                        <span className="text-sky-400">{row.offset}</span>
                        <span>{row.hex}</span>
                        <span className="text-emerald-300">{row.ascii}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEWER 12: Database Header & Schema Inspector */}
          {viewerKind === 'sqlite-inspector' && (
            <div className="w-[86vw] max-w-3xl max-h-[76vh] rounded-3xl bg-slate-900 border border-slate-700 text-white flex flex-col overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold truncate">{asset.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                    {fmt.name}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-950">
                    <span className="text-[10px] text-slate-400 block">PAGE SIZE</span>
                    <span className="font-bold text-white">
                      {classification?.metadata.sqlitePageSize ?? 'N/A'} B
                    </span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-950">
                    <span className="text-[10px] text-slate-400 block">PAGE COUNT</span>
                    <span className="font-bold text-white">
                      {classification?.metadata.sqlitePageCount ?? 'N/A'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-950">
                    <span className="text-[10px] text-slate-400 block">ENCODING</span>
                    <span className="font-bold text-emerald-300">
                      {classification?.metadata.sqliteEncoding || 'UTF-8'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-950">
                    <span className="text-[10px] text-slate-400 block">SQLITE VER</span>
                    <span className="font-bold text-sky-300">
                      {classification?.metadata.sqliteWriteVersion ?? 'Standard'}
                    </span>
                  </div>
                </div>

                {hexRows.length > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1 overflow-x-auto">
                    <div className="text-[10px] uppercase text-slate-400 mb-2">
                      Binary Page Header Hex Dump
                    </div>
                    {hexRows.slice(0, 8).map((row) => (
                      <div key={row.offset} className="flex gap-3">
                        <span className="text-sky-400">{row.offset}</span>
                        <span className="text-slate-300">{row.hex}</span>
                        <span className="text-emerald-300">{row.ascii}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEWER 13: Full Native 3D & CAD Studio */}
          {(viewerKind === '3d-preview' || (fmt.family === 'cad_3d' && !isEditMode)) && (
            <Native3dCadViewer
              asset={asset}
              compact
              onDownload={onDownload}
              onOpenFormatDb={onOpenFormatDb}
              onOpenPip={onOpenPip}
              isPipActive={isPipActive}
              onSaveEditedAsset={onSaveEditedAsset}
            />
          )}

          {/* VIEWER 17: Live GPU Shader Viewer & Editor Studio */}
          {viewerKind === 'shader-viewer' && (
            <Suspense fallback={<div className="p-8 text-xs text-white/75">Loading Shader Studio…</div>}>
              <NativeShaderStudio
                asset={asset}
                compact
                onSaveEditedAsset={onSaveEditedAsset}
                onOpenFormatDb={onOpenFormatDb}
                onOpenPip={onOpenPip}
                isPipActive={isPipActive}
              />
            </Suspense>
          )}

          {/* VIEWER 18: Heightmap, DEM & Cartographic Terrain Map Viewer */}
          {viewerKind === 'heightmap-viewer' && (
            <Suspense fallback={<div className="p-8 text-xs text-white/75">Loading Terrain Viewer…</div>}>
              <NativeHeightmapMapViewer
                asset={asset}
                compact
                onDownload={onDownload}
                onOpenFormatDb={onOpenFormatDb}
                onOpenPip={onOpenPip}
                isPipActive={isPipActive}
              />
            </Suspense>
          )}

          {/* VIEWER 14: Live Font Specimen Preview */}
          {viewerKind === 'font-specimen' && (
            <div className="w-[86vw] max-w-3xl max-h-[76vh] rounded-3xl bg-slate-900 border border-slate-700 text-white flex flex-col overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-sky-400" />
                  <span className="font-bold truncate">{asset.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold uppercase">
                    {fmt.extension} Specimen
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <input
                  type="text"
                  value={fontSampleText}
                  onChange={(e) => setFontSampleText(e.target.value)}
                  aria-label="Custom font specimen text"
                  className="w-full min-h-[42px] px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:border-sky-400 focus:outline-none"
                />
                <div className="space-y-4" style={{ fontFamily: `'${specimenFontFamily}', sans-serif` }}>
                  {[14, 20, 28, 38].map((px) => (
                    <div key={px} className="border-b border-slate-800 pb-3">
                      <span className="text-[10px] font-mono text-slate-400 block mb-1">{px}px</span>
                      <p style={{ fontSize: `${px}px` }} className="leading-snug text-white break-words">
                        {fontSampleText}
                      </p>
                    </div>
                  ))}
                  <p className="text-base text-slate-300 tracking-wide pt-1">
                    ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 !@#$%^&amp;*()
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* VIEWER 15 & 16 + LUT Adjuster & Binary Hex Inspector */}
          {(viewerKind === 'hex-inspector' || viewerKind === 'download-only') &&
            (fmt.family !== 'cad_3d' || isEditMode) && (
            <div className="w-[88vw] max-w-4xl max-h-[76vh] rounded-3xl bg-slate-900 border border-slate-700 text-white flex flex-col overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {isLutSidecar ? (
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <FileCode2 className="w-4 h-4 text-sky-400 shrink-0" />
                  )}
                  <span className="font-bold truncate">{asset.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold uppercase">
                    {fmt.extension} • {fmt.family}
                  </span>
                </div>
                {onDownload && (
                  <button
                    type="button"
                    onClick={() => onDownload(asset)}
                    className="min-h-[36px] px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {isLutSidecar && lutData ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs tabular-nums">
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">LUT TITLE</span>
                        <span className="font-bold text-white truncate block">{lutData.title}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">3D CUBE GRID</span>
                        <span className="font-bold text-amber-300">{lutData.size3d}³ points</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">INTENSITY PREVIEW</span>
                        <span className="font-bold text-emerald-300">{lutIntensity}%</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={lutIntensity}
                          onChange={(e) => setLutIntensity(Number(e.target.value))}
                          aria-label="LUT Preview Intensity"
                          className="w-full accent-amber-400"
                        />
                      </div>
                    </div>

                    <div
                      className="h-14 rounded-2xl border border-slate-700"
                      style={{
                        background:
                          'linear-gradient(90deg, #000000 0%, #1074B1 25%, #52B197 50%, #BEBF61 75%, #ffffff 100%)',
                        filter: `contrast(${100 + Math.round(lutIntensity * 0.25)}%) saturate(${85 + Math.round(lutIntensity * 0.45)}%)`,
                      }}
                    />

                    {isEditMode && (
                      <div className="space-y-2">
                        <textarea
                          rows={8}
                          value={draftText}
                          onChange={(e) => setDraftText(e.target.value)}
                          className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-emerald-300"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void handleTriggerSave(false)}
                            className="min-h-[36px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold"
                          >
                            Save LUT to Catalog
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleTriggerSave(true)}
                            className="min-h-[36px] px-3 rounded-xl bg-[#1074B1] hover:bg-[#0e6499] text-xs font-bold"
                          >
                            Save LUT Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1.5 overflow-x-auto">
                  <div className="text-[10px] uppercase text-slate-400 mb-2">
                    4KB Binary Signature &amp; Hex Inspector ({classification?.matchedBy || 'extension'}: {classification?.matchedToken || fmt.extension})
                  </div>
                  {hexRows.length > 0 ? (
                    hexRows.map((row) => (
                      <div key={row.offset} className="flex gap-4 whitespace-pre">
                        <span className="text-sky-400">{row.offset}</span>
                        <span className="text-slate-300">{row.hex}</span>
                        <span className="text-emerald-300">{row.ascii}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400">{fmt.description}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Slide-Over Non-Destructive XMP Sidecar & Catalog Metadata Editor */}
          {showXmpPanel && (
            <aside
              className="w-80 max-h-[76vh] rounded-3xl bg-slate-900 border border-slate-700 p-4 text-white flex flex-col gap-3 shadow-2xl overflow-y-auto"
              aria-label="Non-destructive XMP metadata editor"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-300">
                  XMP &amp; Catalog Metadata
                </span>
                <button
                  type="button"
                  onClick={() => setShowXmpPanel(false)}
                  className="p-1 rounded-lg hover:bg-white/10"
                  aria-label="Close XMP Panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <label className="space-y-1 text-xs font-semibold block">
                <span className="text-slate-300">Tags (comma-separated)</span>
                <input
                  type="text"
                  value={xmpTagsInput}
                  onChange={(e) => setXmpTagsInput(e.target.value)}
                  className="w-full min-h-[38px] px-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                />
              </label>
              <label className="space-y-1 text-xs font-semibold block">
                <span className="text-slate-300">Description / Caption</span>
                <textarea
                  rows={4}
                  value={xmpDescriptionInput}
                  onChange={(e) => setXmpDescriptionInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                />
              </label>
              <button
                type="button"
                onClick={handleExportXmpSidecar}
                className="min-h-[40px] px-3 rounded-xl bg-[#1074B1] hover:bg-[#0e6499] text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export .XMP Sidecar</span>
              </button>
            </aside>
          )}
        </div>
      </div>

      {/* Bottom Footer Info Strip */}
      <div
        className="w-full px-4 py-3 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-between text-xs text-slate-300 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 font-mono text-[11px] truncate tabular-nums">
          {asset.exif?.camera && <span>Camera: {asset.exif.camera}</span>}
          {asset.exif?.lens && <span>Lens: {asset.exif.lens}</span>}
          {asset.exif?.dimensions && <span>Res: {asset.exif.dimensions}</span>}
          <span>Preservation: {fmt.preservationGrade}</span>
        </div>

        <div className="flex items-center gap-2">
          {onOpenReview && (viewerKind === 'image-lightbox' || viewerKind === 'raw-demosaic-viewer') && (
            <button
              type="button"
              onClick={() => {
                onOpenReview(asset);
                onClose();
              }}
              className="min-h-[38px] px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Review in Culling</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
