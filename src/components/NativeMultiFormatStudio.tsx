/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Native Multi-Format Viewer & Non-Destructive Editor Studio
 * Self-contained native studio covering all non-3D/CAD families:
 *  - Vector (.SVG): Artboard bg toggle, extracted color swatches, live color replacement, PNG rasterize export
 *  - Audio & Subtitles (.SRT/.VTT/.LRC): Waveform EQ & Trim + Cue table, +/- ms offset shift, SRT<->VTT<->LRC conversion
 *  - Documents (.MD/.TXT/.RTF/.DOCX/.ODT/.EPUB/.CODE/.CUBE): Formatting bar, TOC outline, Find/Replace, HTML export
 *  - Spreadsheets & Data (.CSV/.TSV/.JSON): Column stats (SUM/AVG/MIN/MAX), sort, add row/col, JSON<->CSV conversion
 *  - Databases (.SQLITE/.DB): Binary header specs + extracted sqlite_schema DDL CREATE TABLE explorer
 *  - GIS Vector Maps (.GEOJSON/.GPX/.KML): Canvas track/polygon/waypoint plotter + elevation telemetry
 *  - Archives (.ZIP/.TAR) & Fonts (.TTF/.OTF/.WOFF2) & Hex/XMP Metadata Sidecar Editor
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Save,
  HardDrive,
  Download,
  Copy,
  Check,
  Search,
  Plus,
  Trash2,
  Database,
  Play,
  Pause,
  Sliders,
  MapPin,
  Archive,
  Type,
  Palette,
  FileCode2,
  Subtitles,
  ArrowUpDown,
  FileText,
  Sparkles,
  Tv,
} from 'lucide-react';
import type { MediaAsset } from '../types';
import { lookupFileFormat } from '../services/fileFormatEngine';
import { universalMediaPlayer } from '../services/universalMediaPlayerEngine';
import { generateXmpXml } from '../services/xmpExporter';
import {
  classifyLoadedAsset,
  loadAssetContentSample,
  parseCsvToGrid,
  parseCubeLutData,
  parseZipDirectoryEntries,
  resolveViewableAssetStreamUrl,
  serializeGridToCsv,
} from '../services/universalFileViewerEngine';
import {
  computeSpreadsheetColumnStats,
  extractDocxOrOdtTextFromBytes,
  extractSvgPaletteAndElements,
  extractTextFromRtf,
  parseGisFeatures,
  parseSqliteSchemaTables,
  parseSubtitleCues,
  parseTarDirectoryEntries,
  replaceSvgColor,
  serializeSubtitleCues,
  type SubtitleCue,
} from '../services/nativeFormatParsers';

export interface NativeMultiFormatStudioProps {
  asset: MediaAsset;
  onSaveEditedAsset: (asset: MediaAsset, updatedText: string, saveToDisk?: boolean) => Promise<void> | void;
  onOpenPip?: (asset: MediaAsset) => void;
  onOpenMusicPlayer?: (asset: MediaAsset) => void;
  onOpenFormatDb?: (query: string) => void;
  onDownload?: (asset: MediaAsset) => void;
  onOpenVideoTrimmer?: (asset: MediaAsset) => void;
}

function formatHumanBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const NativeMultiFormatStudio: React.FC<NativeMultiFormatStudioProps> = ({
  asset,
  onSaveEditedAsset,
  onOpenPip,
  onOpenMusicPlayer,
  onOpenFormatDb,
  onDownload,
  onOpenVideoTrimmer,
}) => {
  const fmt = useMemo(() => lookupFileFormat(asset.name, asset.mimeType), [asset.name, asset.mimeType]);
  const ext = (asset.extension || fmt.extension || '').toUpperCase();
  const streamUrl = useMemo(() => resolveViewableAssetStreamUrl(asset), [asset]);

  const [isLoading, setIsLoading] = useState(true);
  const [rawBytes, setRawBytes] = useState<Uint8Array>(new Uint8Array());
  const [textContent, setTextContent] = useState('');
  const [draftText, setDraftText] = useState('');
  const [isSynthesized, setIsSynthesized] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // SVG Studio state
  const [svgBg, setSvgBg] = useState<'checker' | 'light' | 'dark'>('checker');
  const [svgReplaceFrom, setSvgReplaceFrom] = useState('');
  const [svgReplaceTo, setSvgReplaceTo] = useState('#1074B1');

  // Document Find & Replace state
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showFindReplace, setShowFindReplace] = useState(false);

  // Spreadsheet state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvDelimiter, setCsvDelimiter] = useState(',');
  const [sortCol, setSortCol] = useState<{ idx: number; asc: boolean } | null>(null);

  // Subtitle / Lyrics cue state
  const [subCues, setSubCues] = useState<SubtitleCue[]>([]);
  const [subOffsetMs, setSubOffsetMs] = useState(0);

  // Audio DSP studio state
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [bassDb, setBassDb] = useState(0);
  const [midDb, setMidDb] = useState(0);
  const [trebleDb, setTrebleDb] = useState(0);
  const [lutIntensity, setLutIntensity] = useState(85);

  // Font glyph map state
  const [fontSizePx, setFontSizePx] = useState(28);
  const [fontSample, setFontSample] = useState('Studio Typography — 0123456789 & RAW Pixels');

  // Metadata XMP tags
  const [xmpTags, setXmpTags] = useState((asset.tags || []).join(', '));
  const [xmpCaption, setXmpCaption] = useState(asset.aiDescription || '');

  const audioCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gisCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const studioMode = useMemo(() => {
    if (ext === 'SVG' || fmt.family === 'vector_graphic') return 'vector';
    if (fmt.family === 'subtitle_lyric') return 'subtitle';
    if (fmt.viewer === 'audio-player' || asset.category === 'audio') return 'audio';
    if (fmt.viewer === 'video-player' || asset.category === 'video') return 'video';
    if (fmt.viewer === 'spreadsheet-grid') return 'spreadsheet';
    if (fmt.family === 'gis_mapping' || ext === 'GEOJSON' || ext === 'GPX' || ext === 'KML') return 'gis';
    if (fmt.viewer === 'sqlite-inspector' || fmt.family === 'database') return 'database';
    if (fmt.viewer === 'archive-inspector' || fmt.family === 'archive_compressed') return 'archive';
    if (fmt.viewer === 'font-specimen' || fmt.family === 'font') return 'font';
    if (fmt.viewer === 'pdf-viewer') return 'pdf';
    if (fmt.family === 'color_lut_sidecar' || fmt.viewer === 'code-viewer' || fmt.viewer === 'json-tree-viewer' || fmt.viewer === 'markdown-viewer' || fmt.viewer === 'document-reader') {
      return 'document';
    }
    return 'hex';
  }, [ext, fmt, asset.category]);

  useEffect(() => {
    setStatusMessage(null);
    setXmpTags((asset.tags || []).join(', '));
    setXmpCaption(asset.aiDescription || '');

    if (studioMode === 'audio') {
      if (streamUrl) universalMediaPlayer.loadMedia(streamUrl, asset.name);
      const unsub = universalMediaPlayer.subscribe((s) => setAudioPlaying(s.isPlaying));
      setIsLoading(false);
      return () => unsub();
    }

    if (studioMode === 'video' || studioMode === 'pdf' || studioMode === 'font') {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    loadAssetContentSample(asset, 262144)
      .then((sample) => {
        if (cancelled) return;
        setRawBytes(sample.bytes);
        let initialText = sample.text;
        if (ext === 'RTF') {
          initialText = extractTextFromRtf(sample.text);
        } else if (['DOCX', 'ODT', 'EPUB'].includes(ext)) {
          const doc = extractDocxOrOdtTextFromBytes(sample.bytes, sample.text);
          initialText = doc.paragraphs.join('\n\n');
        }
        setTextContent(initialText);
        setDraftText(initialText);
        setIsSynthesized(sample.isSynthesizedFallback);

        if (studioMode === 'spreadsheet') {
          const g = parseCsvToGrid(initialText);
          setCsvHeaders(g.headers);
          setCsvRows(g.rows);
          setCsvDelimiter(g.delimiter);
        }
        if (studioMode === 'subtitle') {
          setSubCues(parseSubtitleCues(initialText));
          setSubOffsetMs(0);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [asset.id, studioMode, ext, streamUrl]);

  // SVG derived analytics
  const svgSummary = useMemo(
    () => (studioMode === 'vector' ? extractSvgPaletteAndElements(draftText) : null),
    [studioMode, draftText]
  );

  // Audio waveform animation
  useEffect(() => {
    if (studioMode !== 'audio' || !audioCanvasRef.current) return;
    const canvas = audioCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    let phase = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const wave = universalMediaPlayer.getWaveformData();
      ctx.strokeStyle = '#52B197';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < canvas.width; i += 3) {
        const val = wave[Math.floor((i / canvas.width) * wave.length)] || 128;
        const amp = audioPlaying ? ((val - 128) / 128) * 44 : Math.sin(phase + i * 0.06) * 5;
        const y = canvas.height / 2 + amp;
        if (i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
      }
      ctx.stroke();
      phase += 0.06;
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [studioMode, audioPlaying]);

  // GIS parsed & canvas plot
  const gisData = useMemo(
    () => (studioMode === 'gis' ? parseGisFeatures(draftText, ext) : null),
    [studioMode, draftText, ext]
  );

  useEffect(() => {
    if (!gisData || !gisCanvasRef.current) return;
    const canvas = gisCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#091526';
    ctx.fillRect(0, 0, w, h);

    // Latitude / longitude bounds
    const allCoords: Array<[number, number]> = [
      ...gisData.points.map((p): [number, number] => [p.lon, p.lat]),
      ...gisData.paths.flat(),
    ];
    if (allCoords.length === 0) return;

    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const [lon, lat] of allCoords) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    const span = Math.max(0.0005, maxLon - minLon, maxLat - minLat);
    const scale = (Math.min(w, h) * 0.78) / span;
    const cLon = (minLon + maxLon) / 2;
    const cLat = (minLat + maxLat) / 2;
    const project = (lon: number, lat: number): [number, number] => [
      w / 2 + (lon - cLon) * scale,
      h / 2 - (lat - cLat) * scale,
    ];

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.2;
    for (const pathCoords of gisData.paths) {
      ctx.beginPath();
      pathCoords.forEach(([lon, lat], idx) => {
        const [px, py] = project(lon, lat);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    ctx.fillStyle = '#52B197';
    for (const pt of gisData.points) {
      const [px, py] = project(pt.lon, pt.lat);
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [gisData]);

  // Dynamic @font-face registration
  const fontFamilyName = useMemo(
    () => `dtNativeStudioFont_${asset.id.replace(/[^a-zA-Z0-9]/g, '')}`,
    [asset.id]
  );
  useEffect(() => {
    if (studioMode !== 'font' || !streamUrl) return;
    const id = `style-${fontFamilyName}`;
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = `@font-face { font-family: '${fontFamilyName}'; src: url('${streamUrl}'); font-display: swap; }`;
    return () => {
      el?.remove();
    };
  }, [studioMode, streamUrl, fontFamilyName]);

  const sqliteClassification = useMemo(
    () => (studioMode === 'database' ? classifyLoadedAsset(asset, rawBytes) : null),
    [studioMode, asset, rawBytes]
  );
  const sqliteTables = useMemo(
    () => (studioMode === 'database' ? parseSqliteSchemaTables(rawBytes, textContent) : []),
    [studioMode, rawBytes, textContent]
  );
  const archiveEntries = useMemo(() => {
    if (studioMode !== 'archive') return [];
    const zip = parseZipDirectoryEntries(rawBytes);
    if (zip.length > 0) {
      return zip.map((z) => ({
        name: z.name,
        size: z.uncompressedBytes,
        extra: `${formatHumanBytes(z.compressedBytes)} compressed`,
      }));
    }
    return parseTarDirectoryEntries(rawBytes).map((t) => ({
      name: t.name,
      size: t.sizeBytes,
      extra: t.mode ? `mode ${t.mode}` : 'tar',
    }));
  }, [studioMode, rawBytes]);

  const colStats = useMemo(
    () => (studioMode === 'spreadsheet' ? computeSpreadsheetColumnStats(csvHeaders, csvRows) : []),
    [studioMode, csvHeaders, csvRows]
  );
  const lutData = useMemo(
    () => (fmt.family === 'color_lut_sidecar' ? parseCubeLutData(draftText) : null),
    [fmt.family, draftText]
  );

  const headingsOutline = useMemo(() => {
    if (studioMode !== 'document') return [];
    return draftText
      .split(/\r?\n/)
      .map((line, lineNo) => ({ line: line.trim(), lineNo: lineNo + 1 }))
      .filter((item) => /^#{1,3}\s+/.test(item.line));
  }, [studioMode, draftText]);

  const activeSaveText =
    studioMode === 'spreadsheet'
      ? serializeGridToCsv(csvHeaders, csvRows, csvDelimiter)
      : studioMode === 'subtitle'
      ? serializeSubtitleCues(subCues, ext === 'LRC' ? 'lrc' : ext === 'VTT' ? 'vtt' : 'srt', subOffsetMs)
      : draftText;

  const triggerCopy = (val: string, label = 'Copied!') => {
    navigator.clipboard.writeText(val);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  const triggerDownloadText = (content: string, filename: string, mime = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const saveStudioChanges = async (toDisk: boolean) => {
    try {
      await onSaveEditedAsset(asset, activeSaveText, toDisk);
      setStatusMessage(
        toDisk
          ? 'Saved non-destructive copy on disk & updated catalog.'
          : 'Saved non-destructive changes to IndexedDB catalog.'
      );
    } catch (err: any) {
      setStatusMessage(err?.message || 'Unable to save edits');
    }
  };

  return (
    <section
      className="w-full h-full flex flex-col rounded-2xl border overflow-hidden shadow-sm theme-card"
      style={{
        backgroundColor: 'var(--theme-surface)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text-auto, var(--theme-text))',
      }}
      aria-label={`Native Studio for ${asset.name}`}
    >
      {/* Top Studio Header Bar */}
      <header
        className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 shrink-0"
        style={{ borderColor: 'var(--theme-border)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#1074B1]/15 text-[#1074B1] dark:text-[#67b7e6] flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold truncate">{asset.name}</h2>
            <p className="text-[11px] font-mono opacity-75 truncate tabular-nums">
              .{ext} • {fmt.name} • {fmt.family} • {formatHumanBytes(asset.sizeBytes)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenPip && (
            <button
              type="button"
              onClick={() => onOpenPip(asset)}
              className="min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-black/5 dark:hover:bg-white/10 text-xs font-bold flex items-center gap-1.5"
            >
              <Tv className="w-3.5 h-3.5 text-teal-500" />
              <span>Toggle PiP</span>
            </button>
          )}
          {onOpenFormatDb && (
            <button
              type="button"
              onClick={() => onOpenFormatDb(fmt.extension)}
              className="min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-black/5 dark:hover:bg-white/10 text-xs font-bold flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5 text-[#1074B1]" />
              <span>.{fmt.extension} Spec</span>
            </button>
          )}
          {['vector', 'subtitle', 'spreadsheet', 'document', 'gis'].includes(studioMode) && (
            <>
              <button
                type="button"
                onClick={() => void saveStudioChanges(false)}
                className="min-h-[40px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Catalog</span>
              </button>
              <button
                type="button"
                onClick={() => void saveStudioChanges(true)}
                className="min-h-[40px] px-3 rounded-xl bg-[#1074B1] hover:bg-[#0e6499] text-white text-xs font-bold flex items-center gap-1.5"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Save Disk Copy</span>
              </button>
            </>
          )}
        </div>
      </header>

      {statusMessage && (
        <div className="px-4 py-2 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
          {statusMessage}
        </div>
      )}

      {/* Main Studio Body */}
      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
        {isLoading ? (
          <div className="p-12 text-center text-xs opacity-70">Loading native parser &amp; studio canvas...</div>
        ) : studioMode === 'vector' && svgSummary ? (
          /* 1. NATIVE VECTOR SVG STUDIO */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1">
                  {(['checker', 'light', 'dark'] as const).map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => setSvgBg(bg)}
                      className={`min-h-[36px] px-3 rounded-xl border font-bold capitalize ${
                        svgBg === bg ? 'bg-[#1074B1] text-white border-[#1074B1]' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {bg}
                    </button>
                  ))}
                </div>
                <div className="font-mono text-[11px] opacity-75">
                  viewBox: {svgSummary.viewBox} • {svgSummary.pathCount} paths • {svgSummary.shapeCount} shapes
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const img = new Image();
                    const blob = new Blob([draftText], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    img.onload = () => {
                      const c = document.createElement('canvas');
                      c.width = img.width || 1024;
                      c.height = img.height || 1024;
                      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
                      c.toBlob((png) => {
                        if (!png) return;
                        const pngUrl = URL.createObjectURL(png);
                        const a = document.createElement('a');
                        a.href = pngUrl;
                        a.download = `${asset.name.replace(/\.svg$/i, '')}.png`;
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(pngUrl), 20000);
                      }, 'image/png');
                      URL.revokeObjectURL(url);
                    };
                    img.src = url;
                  }}
                  className="min-h-[36px] px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Rasterize PNG</span>
                </button>
              </div>

              <div
                className={`flex-1 min-h-[280px] rounded-2xl border p-6 flex items-center justify-center overflow-auto ${
                  svgBg === 'dark'
                    ? 'bg-slate-950 border-slate-800'
                    : svgBg === 'light'
                    ? 'bg-white border-slate-300'
                    : 'bg-slate-200 dark:bg-slate-900 border-slate-300 dark:border-slate-800'
                }`}
              >
                <img
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(draftText)}`}
                  alt={asset.name}
                  className="max-w-full max-h-[360px] object-contain"
                />
              </div>

              {/* Extracted Color Palette Replacer */}
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-[#1074B1]" />
                    <span>Detected Vector Palette ({svgSummary.colors.length})</span>
                  </span>
                  {svgReplaceFrom && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px]">{svgReplaceFrom} -&gt;</span>
                      <input
                        type="color"
                        value={svgReplaceTo}
                        onChange={(e) => setSvgReplaceTo(e.target.value)}
                        aria-label="Replacement swatch color"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setDraftText((prev) => replaceSvgColor(prev, svgReplaceFrom, svgReplaceTo));
                          setSvgReplaceFrom(svgReplaceTo.toUpperCase());
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#1074B1] text-white font-bold text-[11px]"
                      >
                        Apply Recolor
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {svgSummary.colors.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setSvgReplaceFrom(hex)}
                      className={`px-2 py-1 rounded-lg border text-[10px] font-mono flex items-center gap-1.5 ${
                        svgReplaceFrom === hex ? 'border-[#1074B1] ring-2 ring-[#1074B1]/40' : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-xs border border-black/20" style={{ backgroundColor: hex }} />
                      <span>{hex}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>Live SVG XML Source</span>
                <button
                  type="button"
                  onClick={() => triggerCopy(draftText, 'SVG copied!')}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center gap-1 text-[11px]"
                >
                  {copiedKey === 'SVG copied!' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>Copy XML</span>
                </button>
              </div>
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                className="flex-1 min-h-[340px] p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-950 text-emerald-300 font-mono text-xs resize-none"
              />
            </div>
          </div>
        ) : studioMode === 'subtitle' ? (
          /* 2. NATIVE SUBTITLE & LYRIC SYNC EDITOR */
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex items-center gap-2 font-mono">
                <Subtitles className="w-4 h-4 text-emerald-500" />
                <span className="font-bold">{subCues.length} Cues</span>
                <span className="opacity-75">Offset: {subOffsetMs >= 0 ? `+${subOffsetMs}` : subOffsetMs} ms</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[-500, -100, 100, 500].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => setSubOffsetMs((o) => o + delta)}
                    className="min-h-[34px] px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-bold hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {delta > 0 ? `+${delta}ms` : `${delta}ms`}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setSubCues((prev) => {
                      const lastEnd = prev[prev.length - 1]?.endMs || 0;
                      return [
                        ...prev,
                        { index: prev.length + 1, startMs: lastEnd + 200, endMs: lastEnd + 3200, text: 'New cue line' },
                      ];
                    })
                  }
                  className="min-h-[34px] px-3 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Cue
                </button>
                {(['srt', 'vtt', 'lrc'] as const).map((targetFmt) => (
                  <button
                    key={targetFmt}
                    type="button"
                    onClick={() =>
                      triggerDownloadText(
                        serializeSubtitleCues(subCues, targetFmt, subOffsetMs),
                        `${asset.name.replace(/\.[^/.]+$/, '')}.${targetFmt}`
                      )
                    }
                    className="min-h-[34px] px-2.5 rounded-xl bg-[#1074B1]/15 text-[#1074B1] dark:text-[#67b7e6] font-bold uppercase"
                  >
                    Export .{targetFmt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {subCues.map((cue, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs"
                >
                  <span className="font-mono font-bold opacity-60 w-8 tabular-nums">#{idx + 1}</span>
                  <span className="font-mono text-[11px] px-2 py-1 rounded bg-black/5 dark:bg-white/5 tabular-nums shrink-0">
                    {cue.startMs + subOffsetMs}ms → {cue.endMs + subOffsetMs}ms
                  </span>
                  <input
                    type="text"
                    value={cue.text}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSubCues((prev) => prev.map((c, cIdx) => (cIdx === idx ? { ...c, text: val } : c)));
                    }}
                    className="flex-1 min-h-[36px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setSubCues((prev) => prev.filter((_, cIdx) => cIdx !== idx))}
                    className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10"
                    aria-label="Remove cue"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : studioMode === 'audio' ? (
          /* 3. NATIVE AUDIO DSP & EQ STUDIO */
          <div className="max-w-3xl mx-auto p-6 rounded-3xl bg-slate-900 border border-slate-700 text-white space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold">{asset.name}</h3>
                <p className="text-xs text-slate-400 font-mono">Web Audio Native 3-Band EQ &amp; Lossless Waveform</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => universalMediaPlayer.togglePlay()}
                  className="min-h-[42px] px-4 rounded-xl bg-gradient-to-r from-[#1074B1] to-[#52B197] font-bold text-xs flex items-center gap-1.5"
                >
                  {audioPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{audioPlaying ? 'Pause' : 'Play Stream'}</span>
                </button>
                {onOpenMusicPlayer && (
                  <button
                    type="button"
                    onClick={() => onOpenMusicPlayer(asset)}
                    className="min-h-[42px] px-3 rounded-xl border border-slate-600 hover:bg-white/10 text-xs font-bold"
                  >
                    Open Queue Studio
                  </button>
                )}
              </div>
            </div>

            <div className="h-24 rounded-2xl bg-black/50 border border-slate-800 p-2">
              <canvas ref={audioCanvasRef} width={640} height={80} className="w-full h-full" />
            </div>

            <div className="grid grid-cols-3 gap-4 text-center text-xs">
              {(
                [
                  { label: 'Bass (100Hz)', val: bassDb, key: 'bass' as const },
                  { label: 'Mid (1kHz)', val: midDb, key: 'mid' as const },
                  { label: 'Treble (4kHz)', val: trebleDb, key: 'treble' as const },
                ] as const
              ).map((band) => (
                <div key={band.key} className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="font-bold opacity-80 mb-1">{band.label}</div>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    value={band.val}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      if (band.key === 'bass') setBassDb(next);
                      if (band.key === 'mid') setMidDb(next);
                      if (band.key === 'treble') setTrebleDb(next);
                      universalMediaPlayer.setEqualizer(
                        band.key === 'bass' ? next : bassDb,
                        band.key === 'mid' ? next : midDb,
                        band.key === 'treble' ? next : trebleDb
                      );
                    }}
                    className="w-full accent-sky-500"
                  />
                  <div className="font-mono text-sky-300 mt-1">{band.val > 0 ? `+${band.val}` : band.val} dB</div>
                </div>
              ))}
            </div>
          </div>
        ) : studioMode === 'video' ? (
          /* 4. NATIVE VIDEO STUDIO */
          <div className="flex flex-col items-center gap-4">
            <video
              src={streamUrl || asset.thumbnailUrl}
              poster={asset.thumbnailUrl}
              controls
              className="w-full max-w-4xl max-h-[55vh] rounded-2xl bg-black border border-slate-800"
            />
            <div className="flex flex-wrap items-center gap-2">
              {onOpenVideoTrimmer && (
                <button
                  type="button"
                  onClick={() => onOpenVideoTrimmer(asset)}
                  className="min-h-[42px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                >
                  Open Lossless Stream-Copy Video Trimmer
                </button>
              )}
              {onOpenMusicPlayer && (
                <button
                  type="button"
                  onClick={() => onOpenMusicPlayer(asset)}
                  className="min-h-[42px] px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
                >
                  Open in Media Theatre Queue
                </button>
              )}
            </div>
          </div>
        ) : studioMode === 'spreadsheet' ? (
          /* 5. NATIVE SPREADSHEET STUDIO (Stats + Sort + Add Col/Row + JSON Export) */
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCsvRows((p) => [...p, csvHeaders.map(() => '')])}
                  className="min-h-[36px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Row
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCsvHeaders((h) => [...h, `Column ${h.length + 1}`]);
                    setCsvRows((rows) => rows.map((r) => [...r, '']));
                  }}
                  className="min-h-[36px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Column
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    triggerDownloadText(
                      JSON.stringify(
                        csvRows.map((row) =>
                          Object.fromEntries(csvHeaders.map((h, i) => [h || `col_${i + 1}`, row[i] ?? '']))
                        ),
                        null,
                        2
                      ),
                      `${asset.name.replace(/\.[^/.]+$/, '')}.json`,
                      'application/json'
                    )
                  }
                  className="min-h-[36px] px-3 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold"
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={() =>
                    triggerDownloadText(serializeGridToCsv(csvHeaders, csvRows, '\t'), `${asset.name.replace(/\.[^/.]+$/, '')}.tsv`)
                  }
                  className="min-h-[36px] px-3 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold"
                >
                  Export TSV
                </button>
              </div>
            </div>

            {/* Live Numeric Column Aggregate Stats Strip */}
            <div className="flex flex-wrap gap-2 text-[11px] font-mono tabular-nums">
              {colStats
                .filter((c) => c.numericCount > 0)
                .map((c) => (
                  <div key={c.header} className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <strong>{c.header}:</strong> count={c.numericCount} sum={c.sum} avg={c.avg} min={c.min} max={c.max}
                  </div>
                ))}
            </div>

            <div className="overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700 max-h-[54vh]">
              <table className="w-full text-left text-xs border-collapse tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-black/5 dark:bg-white/5">
                    <th className="p-2 w-10">#</th>
                    {csvHeaders.map((h, ci) => (
                      <th key={ci} className="p-2">
                        <button
                          type="button"
                          onClick={() => {
                            const nextAsc = sortCol?.idx === ci ? !sortCol.asc : true;
                            setSortCol({ idx: ci, asc: nextAsc });
                            setCsvRows((prev) =>
                              [...prev].sort((a, b) =>
                                nextAsc
                                  ? (a[ci] || '').localeCompare(b[ci] || '', undefined, { numeric: true })
                                  : (b[ci] || '').localeCompare(a[ci] || '', undefined, { numeric: true })
                              )
                            );
                          }}
                          className="font-bold flex items-center gap-1 hover:text-[#1074B1]"
                        >
                          <span>{h}</span>
                          <ArrowUpDown className="w-3 h-3 opacity-60" />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 font-mono text-[11px]">
                  {csvRows.map((row, ri) => (
                    <tr key={ri}>
                      <td className="p-2 opacity-60">{ri + 1}</td>
                      {csvHeaders.map((_, ci) => (
                        <td key={ci} className="p-1">
                          <input
                            type="text"
                            value={row[ci] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCsvRows((prev) =>
                                prev.map((r, rIdx) => (rIdx === ri ? r.map((c, cIdx) => (cIdx === ci ? val : c)) : r))
                              );
                            }}
                            className="w-full px-2 py-1 rounded border border-slate-300/60 dark:border-slate-700 bg-transparent"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : studioMode === 'gis' && gisData ? (
          /* 6. NATIVE GIS MAP VIEWER & FEATURE EDITOR */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1.5 font-bold">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  <span>{gisData.format.toUpperCase()} Vector Plot ({gisData.paths.length} tracks • {gisData.points.length} pts)</span>
                </span>
              </div>
              <canvas
                ref={gisCanvasRef}
                width={640}
                height={380}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950"
              />
            </div>
            <div className="lg:col-span-5 flex flex-col gap-2">
              <span className="text-xs font-bold">Raw GIS Source ({ext})</span>
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                className="flex-1 min-h-[320px] p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-950 text-sky-300 font-mono text-xs resize-none"
              />
            </div>
          </div>
        ) : studioMode === 'database' ? (
          /* 7. NATIVE SQLITE & DATABASE SCHEMA STUDIO */
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs tabular-nums">
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] opacity-65 block">PAGE SIZE</span>
                <span className="font-bold">{sqliteClassification?.metadata.sqlitePageSize ?? 'N/A'} B</span>
              </div>
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] opacity-65 block">PAGE COUNT</span>
                <span className="font-bold">{sqliteClassification?.metadata.sqlitePageCount ?? 'N/A'}</span>
              </div>
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] opacity-65 block">ENCODING</span>
                <span className="font-bold text-emerald-500">{sqliteClassification?.metadata.sqliteEncoding || 'UTF-8'}</span>
              </div>
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] opacity-65 block">EXTRACTED OBJECTS</span>
                <span className="font-bold text-sky-500">{sqliteTables.length} DDL</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider opacity-75">
                sqlite_schema Tables, Indexes &amp; Views
              </h3>
              {sqliteTables.length === 0 ? (
                <p className="text-xs opacity-70">No readable DDL statements found in the leading bytes of this file.</p>
              ) : (
                sqliteTables.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold font-mono text-[#1074B1] dark:text-[#67b7e6]">
                        [{item.type.toUpperCase()}] {item.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => triggerCopy(item.sql, `SQL_${idx}`)}
                        className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-semibold"
                      >
                        {copiedKey === `SQL_${idx}` ? 'Copied!' : 'Copy DDL'}
                      </button>
                    </div>
                    <pre className="p-2.5 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                      {item.sql}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : studioMode === 'archive' ? (
          /* 8. NATIVE ARCHIVE (ZIP / TAR) EXPLORER */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <Archive className="w-4 h-4 text-purple-500" />
                <span>Parsed Archive Contents ({archiveEntries.length} entries)</span>
              </span>
              {onDownload && (
                <button
                  type="button"
                  onClick={() => onDownload(asset)}
                  className="min-h-[36px] px-3 rounded-xl bg-[#1074B1] text-white font-bold"
                >
                  Download Full Archive
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              {archiveEntries.length === 0 ? (
                <div className="p-4 text-xs opacity-70">
                  Container metadata inspected ({fmt.description}). Compressed streams can be extracted via Download.
                </div>
              ) : (
                archiveEntries.map((e, i) => (
                  <div key={i} className="p-3 flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold truncate">{e.name}</span>
                    <span className="font-mono opacity-75 shrink-0 tabular-nums">
                      {formatHumanBytes(e.size)} ({e.extra})
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : studioMode === 'font' ? (
          /* 9. NATIVE FONT SPECIMEN & UNICODE GLYPH MAP */
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={fontSample}
                onChange={(e) => setFontSample(e.target.value)}
                className="flex-1 min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
              />
              <label className="flex items-center gap-2 text-xs font-mono">
                <span>{fontSizePx}px</span>
                <input
                  type="range"
                  min="14"
                  max="64"
                  value={fontSizePx}
                  onChange={(e) => setFontSizePx(Number(e.target.value))}
                  className="w-28 accent-[#1074B1]"
                />
              </label>
            </div>
            <div
              className="p-6 rounded-2xl border border-slate-200 dark:border-slate-700 break-words"
              style={{ fontFamily: `'${fontFamilyName}', sans-serif`, fontSize: `${fontSizePx}px` }}
            >
              {fontSample}
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase opacity-75 mb-2 flex items-center gap-1.5">
                <Type className="w-4 h-4 text-[#1074B1]" />
                <span>Interactive Glyph Map (Click any character to copy)</span>
              </h3>
              <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5">
                {Array.from({ length: 94 }, (_, idx) => {
                  const cp = 33 + idx;
                  const ch = String.fromCharCode(cp);
                  return (
                    <button
                      key={cp}
                      type="button"
                      onClick={() => triggerCopy(ch, `glyph_${cp}`)}
                      className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#1074B1] flex flex-col items-center justify-center"
                      title={`U+${cp.toString(16).toUpperCase().padStart(4, '0')}`}
                    >
                      <span className="text-base" style={{ fontFamily: `'${fontFamilyName}', sans-serif` }}>{ch}</span>
                      <span className="text-[8px] opacity-55 font-mono">
                        {copiedKey === `glyph_${cp}` ? '✓' : cp.toString(16).toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : studioMode === 'pdf' ? (
          /* 10. NATIVE PDF READER */
          <div className="h-[68vh] rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {streamUrl ? (
              <iframe src={streamUrl} title={asset.name} className="w-full h-full bg-white" />
            ) : (
              <div className="p-12 text-center text-xs opacity-70">Connect Drive or select a local PDF to render inline.</div>
            )}
          </div>
        ) : studioMode === 'document' ? (
          /* 11. NATIVE DOCUMENT, MARKDOWN, CODE & LUT STUDIO */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
            <div className="lg:col-span-9 flex flex-col gap-2.5">
              {/* Formatting + Find/Replace Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    { label: 'H1', insert: '\n# Heading\n' },
                    { label: 'H2', insert: '\n## Section\n' },
                    { label: 'Bold', insert: '**bold**' },
                    { label: 'List', insert: '\n- item\n' },
                    { label: 'Code', insert: '\n```\ncode\n```\n' },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => setDraftText((t) => `${t}${btn.insert}`)}
                      className="min-h-[34px] px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      {btn.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowFindReplace((f) => !f)}
                    className={`min-h-[34px] px-2.5 rounded-xl border font-bold flex items-center gap-1 ${
                      showFindReplace ? 'bg-[#1074B1] text-white border-[#1074B1]' : 'border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Find/Replace</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px] opacity-75 tabular-nums">
                  <span>{draftText.split(/\r?\n/).length} lines</span>
                  <span>•</span>
                  <span>{draftText.trim().split(/\s+/).filter(Boolean).length} words</span>
                  {isSynthesized && <span>• Sample Synthesis</span>}
                  <button
                    type="button"
                    onClick={() =>
                      triggerDownloadText(
                        `<!doctype html><html><body><pre>${draftText.replace(/</g, '&lt;')}</pre></body></html>`,
                        `${asset.name.replace(/\.[^/.]+$/, '')}.html`,
                        'text/html'
                      )
                    }
                    className="px-2 py-1 rounded-lg bg-[#1074B1]/15 text-[#1074B1] dark:text-[#67b7e6] font-bold"
                  >
                    Export HTML
                  </button>
                </div>
              </div>

              {showFindReplace && (
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={findQuery}
                    onChange={(e) => setFindQuery(e.target.value)}
                    placeholder="Find..."
                    className="min-h-[34px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                  />
                  <input
                    type="text"
                    value={replaceQuery}
                    onChange={(e) => setReplaceQuery(e.target.value)}
                    placeholder="Replace with..."
                    className="min-h-[34px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!findQuery) return;
                      setDraftText((t) => t.split(findQuery).join(replaceQuery));
                    }}
                    className="min-h-[34px] px-3 rounded-lg bg-[#1074B1] text-white font-bold"
                  >
                    Replace All
                  </button>
                </div>
              )}

              {lutData && (
                <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span>
                      LUT: <strong>{lutData.title}</strong> ({lutData.size3d}³ cube)
                    </span>
                    <label className="flex items-center gap-2">
                      <span>Intensity {lutIntensity}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={lutIntensity}
                        onChange={(e) => setLutIntensity(Number(e.target.value))}
                        className="w-24 accent-amber-500"
                      />
                    </label>
                  </div>
                  <div
                    className="h-8 rounded-xl border border-slate-500/30"
                    style={{
                      background:
                        'linear-gradient(90deg, #000000 0%, #1074B1 25%, #52B197 50%, #BEBF61 75%, #ffffff 100%)',
                      filter: `contrast(${100 + Math.round(lutIntensity * 0.25)}%) saturate(${85 + Math.round(lutIntensity * 0.45)}%)`,
                    }}
                  />
                </div>
              )}

              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                aria-label="Document or code editor"
                className="flex-1 min-h-[360px] p-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed resize-none"
              />
            </div>

            {/* Outline & Non-Destructive XMP Panel */}
            <aside className="lg:col-span-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
              <div className="font-bold uppercase text-[10px] tracking-wider opacity-70 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#1074B1]" />
                <span>Document Outline ({headingsOutline.length})</span>
              </div>
              {headingsOutline.length === 0 ? (
                <p className="text-[11px] opacity-65">No Markdown headings detected in document.</p>
              ) : (
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {headingsOutline.map((h, i) => (
                    <li key={i} className="truncate font-mono text-[11px]">
                      L{h.lineNo}: {h.line}
                    </li>
                  ))}
                </ul>
              )}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-[11px] flex items-center gap-1">
                  <FileCode2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Adobe XMP Sidecar</span>
                </div>
                <input
                  type="text"
                  value={xmpTags}
                  onChange={(e) => setXmpTags(e.target.value)}
                  placeholder="Tags comma-separated"
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-[11px]"
                />
                <button
                  type="button"
                  onClick={() =>
                    triggerDownloadText(
                      generateXmpXml({
                        ...asset,
                        tags: xmpTags.split(',').map((s) => s.trim()).filter(Boolean),
                        aiDescription: xmpCaption,
                      }),
                      `${asset.name.replace(/\.[^/.]+$/, '')}.xmp`,
                      'application/rdf+xml'
                    )
                  }
                  className="w-full min-h-[34px] rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-[11px]"
                >
                  Export .XMP Sidecar
                </button>
              </div>
            </aside>
          </div>
        ) : (
          /* 12. HEX & METADATA XMP SIDECAR STUDIO */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 p-4 rounded-2xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-auto max-h-[58vh] space-y-1">
              <div className="text-[10px] uppercase text-slate-400 mb-2">Binary Hex &amp; Magic Inspection</div>
              {draftText && (
                <pre className="whitespace-pre-wrap break-all text-emerald-300">{draftText.slice(0, 2048)}</pre>
              )}
            </div>
            <div className="lg:col-span-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
              <h3 className="font-bold flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-[#1074B1]" />
                <span>XMP Sidecar Metadata Editor</span>
              </h3>
              <label className="space-y-1 block font-semibold">
                <span>Catalog Tags</span>
                <input
                  type="text"
                  value={xmpTags}
                  onChange={(e) => setXmpTags(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1 block font-semibold">
                <span>Description / Notes</span>
                <textarea
                  rows={4}
                  value={xmpCaption}
                  onChange={(e) => setXmpCaption(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  triggerDownloadText(
                    generateXmpXml({
                      ...asset,
                      tags: xmpTags.split(',').map((s) => s.trim()).filter(Boolean),
                      aiDescription: xmpCaption,
                    }),
                    `${asset.name.replace(/\.[^/.]+$/, '')}.xmp`,
                    'application/rdf+xml'
                  )
                }
                className="w-full min-h-[40px] rounded-xl bg-[#1074B1] text-white font-bold"
              >
                Export Non-Destructive .XMP Sidecar
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
