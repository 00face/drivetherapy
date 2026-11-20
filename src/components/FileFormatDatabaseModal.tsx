/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Universal File Format Flat-File Database & Magic-Byte Sniffer Modal
 * Provides:
 *  1. Format Encyclopedia (O(1) searchable registry of 308+ formats / 706+ extensions & aliases)
 *  2. Live 4KB File Sniffer & Header Hex/ASCII Inspector (browser File slice + loopback OS path inspect)
 *  3. Add / Update Format Registry (persisted atomically to flat-file JSON via /api/formats/upsert)
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Database,
  Search,
  FileCode2,
  Upload,
  PlusCircle,
  Eye,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Sparkles,
} from 'lucide-react';
import {
  classifyFile,
  getFormatDatabaseStats,
  searchFormatDatabase,
  upsertFormatDefinition,
} from '../services/fileFormatEngine';
import type {
  FileClassificationResult,
  FileFormatDefinition,
  FormatEditorKind,
  FormatFamily,
  FormatViewerKind,
  PreservationGrade,
} from '../types/fileFormats';
import type { MediaCategory } from '../types';

interface FileFormatDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

const ALL_FAMILIES: FormatFamily[] = [
  'raster_image',
  'camera_raw',
  'vector_graphic',
  'design_layout',
  'cad_3d',
  'video',
  'audio',
  'document',
  'ebook',
  'spreadsheet',
  'presentation',
  'subtitle_lyric',
  'database',
  'structured_data',
  'gis_mapping',
  'source_code',
  'archive_compressed',
  'disk_image',
  'executable_package',
  'font',
  'color_lut_sidecar',
  'system_other',
];

const ALL_CATEGORIES: MediaCategory[] = [
  'image',
  'raw',
  'video',
  'audio',
  'document',
  'archive',
  'data',
];

const ALL_VIEWERS: FormatViewerKind[] = [
  'image-lightbox',
  'raw-demosaic-viewer',
  'video-player',
  'audio-player',
  'pdf-viewer',
  'document-reader',
  'markdown-viewer',
  'spreadsheet-grid',
  'code-viewer',
  'json-tree-viewer',
  'archive-inspector',
  'sqlite-inspector',
  '3d-preview',
  'font-specimen',
  'hex-inspector',
  'download-only',
];

const ALL_EDITORS: FormatEditorKind[] = [
  'pixel-editor',
  'raw-developer',
  'video-trimmer',
  'audio-dsp-tagger',
  'text-code-editor',
  'csv-table-editor',
  'metadata-xmp-editor',
  'lut-adjuster',
  'none',
];

const ALL_PRESERVATION_GRADES: PreservationGrade[] = [
  'LOC-Full',
  'LOC-Acceptable',
  'Proprietary',
  'Legacy',
];

function formatHumanBytes(bytes?: number): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const FileFormatDatabaseModal: React.FC<FileFormatDatabaseModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
}) => {
  const [activeTab, setActiveTab] = useState<'encyclopedia' | 'sniffer' | 'upsert'>('encyclopedia');
  const [query, setQuery] = useState(initialQuery);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [familyFilter, setFamilyFilter] = useState<string>('all');
  const [viewerFilter, setViewerFilter] = useState<string>('all');
  const [dbRevision, setDbRevision] = useState(0);

  // Sniffer state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sniffResult, setSniffResult] = useState<FileClassificationResult | null>(null);
  const [sniffSourceLabel, setSniffSourceLabel] = useState<string>('');
  const [osPathInput, setOsPathInput] = useState<string>('');
  const [sniffError, setSniffError] = useState<string | null>(null);
  const [isSniffingPath, setIsSniffingPath] = useState(false);

  // Add / Update form state
  const [formExt, setFormExt] = useState('');
  const [formAliases, setFormAliases] = useState('');
  const [formName, setFormName] = useState('');
  const [formFamily, setFormFamily] = useState<FormatFamily>('structured_data');
  const [formCategory, setFormCategory] = useState<MediaCategory>('data');
  const [formMimeTypes, setFormMimeTypes] = useState('');
  const [formViewer, setFormViewer] = useState<FormatViewerKind>('code-viewer');
  const [formEditor, setFormEditor] = useState<FormatEditorKind>('text-code-editor');
  const [formGrade, setFormGrade] = useState<PreservationGrade>('LOC-Acceptable');
  const [formIsLossless, setFormIsLossless] = useState(true);
  const [formIsStreamable, setFormIsStreamable] = useState(true);
  const [formDescription, setFormDescription] = useState('');
  const [upsertStatus, setUpsertStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [isSavingFormat, setIsSavingFormat] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      if (initialQuery) {
        setActiveTab('encyclopedia');
        setCategoryFilter('all');
        setFamilyFilter('all');
        setViewerFilter('all');
      }
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const stats = useMemo(() => {
    void dbRevision;
    return getFormatDatabaseStats();
  }, [dbRevision]);

  const filteredFormats = useMemo(() => {
    void dbRevision;
    return searchFormatDatabase(query, {
      category: categoryFilter,
      family: familyFilter,
      viewer: viewerFilter,
    });
  }, [query, categoryFilter, familyFilter, viewerFilter, dbRevision]);

  if (!isOpen) return null;

  const inspectBrowserFile = async (file: File) => {
    setSniffError(null);
    try {
      const slice = file.slice(0, 4096);
      const buf = await slice.arrayBuffer();
      const headerBytes = new Uint8Array(buf);
      const textSample = new TextDecoder('utf-8', { fatal: false }).decode(headerBytes);
      const result = classifyFile({
        filename: file.name,
        mimeType: file.type || '',
        sizeBytes: file.size,
        modifiedTime: new Date(file.lastModified).toISOString(),
        headerBytes,
        textSample,
      });
      setSniffResult(result);
      setSniffSourceLabel(`Browser File (${file.name})`);
    } catch (err: any) {
      setSniffError(err?.message || 'Unable to inspect file bytes');
    }
  };

  const inspectLocalOsPath = async () => {
    const trimmed = osPathInput.trim();
    if (!trimmed) return;
    setSniffError(null);
    setIsSniffingPath(true);
    try {
      const res = await fetch(`/api/fs/inspect-meta?path=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok || !data.classification) {
        setSniffError(data.error || `Inspection failed (HTTP ${res.status})`);
        return;
      }
      setSniffResult(data.classification as FileClassificationResult);
      setSniffSourceLabel(`Local OS (${data.path})`);
    } catch (err: any) {
      setSniffError(err?.message || 'Failed to reach /api/fs/inspect-meta');
    } finally {
      setIsSniffingPath(false);
    }
  };

  const loadIntoUpsertForm = (fmt: FileFormatDefinition) => {
    setFormExt(fmt.extension);
    setFormAliases(fmt.aliases.join(', '));
    setFormName(fmt.name);
    setFormFamily(fmt.family);
    setFormCategory(fmt.category);
    setFormMimeTypes(fmt.mimeTypes.join(', '));
    setFormViewer(fmt.viewer);
    setFormEditor(fmt.editor);
    setFormGrade(fmt.preservationGrade);
    setFormIsLossless(Boolean(fmt.isLossless));
    setFormIsStreamable(Boolean(fmt.isStreamable));
    setFormDescription(fmt.description);
    setUpsertStatus(null);
    setActiveTab('upsert');
  };

  const handleSaveFormat = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpsertStatus(null);
    const cleanExt = formExt.replace(/^\./, '').trim().toUpperCase();
    const cleanName = formName.trim();
    if (!cleanExt || !cleanName) {
      setUpsertStatus({ ok: false, message: 'Extension and Format Name are required.' });
      return;
    }

    const payload: FileFormatDefinition = {
      extension: cleanExt,
      aliases: formAliases
        .split(',')
        .map((a) => a.replace(/^\./, '').trim().toUpperCase())
        .filter((a) => a && a !== cleanExt),
      name: cleanName,
      family: formFamily,
      category: formCategory,
      mimeTypes: formMimeTypes
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
      magicSignatures: [],
      metadataParsers: [],
      viewer: formViewer,
      editor: formEditor,
      isLossless: formIsLossless,
      isStreamable: formIsStreamable,
      preservationGrade: formGrade,
      description: formDescription.trim() || `${cleanName} (.${cleanExt.toLowerCase()})`,
    };
    if (payload.mimeTypes.length === 0) {
      payload.mimeTypes = [`application/x-${cleanExt.toLowerCase()}`];
    }

    setIsSavingFormat(true);
    try {
      const res = await fetch('/api/formats/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setUpsertStatus({ ok: false, message: data.error || `Server error (${res.status})` });
        return;
      }
      const saved = upsertFormatDefinition(data.format || payload);
      setDbRevision((r) => r + 1);
      setUpsertStatus({
        ok: true,
        message: `Saved .${saved.extension} (${saved.name}) to flat-file JSON DB & live O(1) index.`,
      });
    } catch {
      // Fallback: still apply to runtime in-memory index so offline sessions remain usable
      const saved = upsertFormatDefinition(payload);
      setDbRevision((r) => r + 1);
      setUpsertStatus({
        ok: true,
        message: `Updated .${saved.extension} in live runtime index (server disk write unavailable).`,
      });
    } finally {
      setIsSavingFormat(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="format-db-modal-title"
    >
      <div
        className="w-full max-w-6xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--theme-surface, #ffffff)',
          borderColor: 'var(--theme-border, #e2e8f0)',
          color: 'var(--theme-text-auto, #0f172a)',
        }}
      >
        {/* Modal Header */}
        <div
          className="px-5 py-4 border-b flex items-center justify-between gap-4 shrink-0"
          style={{ borderColor: 'var(--theme-border, #e2e8f0)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#1074B1]/15 text-[#1074B1] dark:text-[#67b7e6] flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="format-db-modal-title" className="text-base font-bold truncate">
                Universal File Format Registry &amp; Magic-Byte Sniffer
              </h2>
              <p className="text-xs opacity-75 tabular-nums truncate">
                {stats.totalFormats} canonical formats • {stats.totalExtensionsAndAliases} extensions &amp; aliases • 22 families • O(1) lookup
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-[#1074B1] shrink-0"
            aria-label="Close Format Registry Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          className="px-5 py-2.5 border-b flex flex-wrap items-center gap-2 shrink-0"
          style={{ borderColor: 'var(--theme-border, #e2e8f0)' }}
          role="tablist"
          aria-label="Format Database Views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'encyclopedia'}
            onClick={() => setActiveTab('encyclopedia')}
            className={`min-h-[44px] px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all focus-visible:outline-2 focus-visible:outline-[#1074B1] ${
              activeTab === 'encyclopedia'
                ? 'bg-[#1074B1] text-white shadow-xs'
                : 'border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Format Encyclopedia ({filteredFormats.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sniffer'}
            onClick={() => setActiveTab('sniffer')}
            className={`min-h-[44px] px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all focus-visible:outline-2 focus-visible:outline-[#1074B1] ${
              activeTab === 'sniffer'
                ? 'bg-[#1074B1] text-white shadow-xs'
                : 'border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            <span>Live 4KB Sniffer &amp; Header Inspector</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'upsert'}
            onClick={() => setActiveTab('upsert')}
            className={`min-h-[44px] px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all focus-visible:outline-2 focus-visible:outline-[#1074B1] ${
              activeTab === 'upsert'
                ? 'bg-[#1074B1] text-white shadow-xs'
                : 'border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add / Update Format</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'encyclopedia' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                <div className="md:col-span-5 relative">
                  <Search className="w-4 h-4 opacity-60 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search extension, alias, MIME, container (e.g. sqlite, cr3, lut, parquet)..."
                    aria-label="Search format registry"
                    className="w-full min-h-[44px] pl-10 pr-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  />
                </div>

                <div className="md:col-span-2">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    aria-label="Filter by Drive Therapy category"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  >
                    <option value="all">All Categories</option>
                    {ALL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.toUpperCase()} ({stats.byCategory[c] || 0})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <select
                    value={familyFilter}
                    onChange={(e) => setFamilyFilter(e.target.value)}
                    aria-label="Filter by format family"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  >
                    <option value="all">All 22 Families</option>
                    {ALL_FAMILIES.map((f) => (
                      <option key={f} value={f}>
                        {f} ({stats.byFamily[f] || 0})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <select
                    value={viewerFilter}
                    onChange={(e) => setViewerFilter(e.target.value)}
                    aria-label="Filter by assigned viewer"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  >
                    <option value="all">All Viewers</option>
                    {ALL_VIEWERS.map((v) => (
                      <option key={v} value={v}>
                        {v} ({stats.byViewer[v] || 0})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Format Cards Grid */}
              {filteredFormats.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                  <p className="text-sm font-semibold">No formats matched &ldquo;{query}&rdquo;</p>
                  <button
                    type="button"
                    onClick={() => {
                      const clean = query.replace(/^\./, '').trim().toUpperCase();
                      setFormExt(clean);
                      setFormName(clean ? `${clean} Format` : '');
                      setActiveTab('upsert');
                    }}
                    className="min-h-[44px] px-4 rounded-xl bg-[#1074B1] text-white text-xs font-bold inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Register New Format Definition</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredFormats.slice(0, 120).map((fmt) => (
                    <div
                      key={fmt.extension}
                      className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2.5 flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-1 rounded-lg bg-[#1074B1]/15 text-[#1074B1] dark:text-[#67b7e6] font-mono font-bold text-xs tabular-nums">
                              .{fmt.extension}
                            </span>
                            <span className="text-xs font-bold">{fmt.name}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-700 text-[10px] font-bold uppercase shrink-0">
                            {fmt.category}
                          </span>
                        </div>

                        <p className="text-xs opacity-80 leading-relaxed">{fmt.description}</p>

                        <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                          <span className="px-2 py-0.5 rounded-md bg-slate-500/10">
                            family: {fmt.family}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1">
                            <Eye className="w-3 h-3" /> {fmt.viewer}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 inline-flex items-center gap-1">
                            <Wrench className="w-3 h-3" /> {fmt.editor}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-500/10 inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> {fmt.preservationGrade}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between gap-2 text-[11px]">
                        <div className="min-w-0 truncate opacity-75 font-mono">
                          {fmt.aliases.length > 0 && <span>Aliases: {fmt.aliases.join(', ')} • </span>}
                          <span>MIME: {fmt.mimeTypes[0]}</span>
                          {fmt.magicSignatures[0] && (
                            <span> • Magic @{fmt.magicSignatures[0].offset}: {fmt.magicSignatures[0].hex}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => loadIntoUpsertForm(fmt)}
                          className="min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold shrink-0 focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filteredFormats.length > 120 && (
                <p className="text-xs opacity-70 text-center tabular-nums">
                  Showing first 120 of {filteredFormats.length} matching formats — refine search or filter to narrow results.
                </p>
              )}
            </div>
          )}

          {activeTab === 'sniffer' && (
            <div className="space-y-4">
              {/* Local Browser Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) {
                    void inspectBrowserFile(dropped);
                  }
                }}
                className={`p-6 rounded-2xl border-2 border-dashed transition-colors flex flex-col sm:flex-row items-center justify-between gap-4 ${
                  isDragOver
                    ? 'border-[#1074B1] bg-[#1074B1]/10'
                    : 'border-slate-300 dark:border-slate-700'
                }`}
              >
                <div className="space-y-1 text-center sm:text-left">
                  <p className="text-sm font-bold flex items-center justify-center sm:justify-start gap-2">
                    <Sparkles className="w-4 h-4 text-[#1074B1]" />
                    <span>Drop any file here to sniff its first 4,096 bytes</span>
                  </p>
                  <p className="text-xs opacity-75">
                    Identifies magic signatures (ISO-BMFF, RIFF, PNG, FLAC, SQLite, Parquet, PDF, ELF, MPEG-TS) even if renamed or missing an extension.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  onChange={(e) => {
                    const picked = e.target.files?.[0];
                    if (picked) {
                      void inspectBrowserFile(picked);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[44px] px-4 rounded-xl bg-[#1074B1] hover:bg-[#0e6499] text-white text-xs font-bold inline-flex items-center gap-2 shrink-0 focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose Local File</span>
                </button>
              </div>

              {/* Loopback Local OS Path Sniffer */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <HardDrive className="w-4 h-4 opacity-60 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={osPathInput}
                    onChange={(e) => setOsPathInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void inspectLocalOsPath();
                      }
                    }}
                    placeholder="Or enter a host OS file path to probe via /api/fs/inspect-meta (e.g. /home/user/audio.flac)"
                    aria-label="Host OS file path for header inspection"
                    className="w-full min-h-[44px] pl-10 pr-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs font-mono focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  />
                </div>
                <button
                  type="button"
                  disabled={isSniffingPath || !osPathInput.trim()}
                  onClick={() => void inspectLocalOsPath()}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-xs font-bold shrink-0 focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                >
                  {isSniffingPath ? 'Sniffing...' : 'Inspect Host Path'}
                </button>
              </div>

              {sniffError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{sniffError}</span>
                </div>
              )}

              {sniffResult && (
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] uppercase font-bold opacity-70 block">
                        {sniffSourceLabel}
                      </span>
                      <h3 className="text-base font-bold">
                        .{sniffResult.format.extension} — {sniffResult.format.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-lg bg-[#1074B1]/15 text-[#1074B1] dark:text-[#67b7e6] text-xs font-bold">
                        Matched: {sniffResult.matchedBy} ({sniffResult.matchedToken})
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                        Viewer: {sniffResult.viewer}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-bold">
                        Editor: {sniffResult.editor}
                      </span>
                    </div>
                  </div>

                  {/* Extracted Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
                    <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                      <span className="text-[10px] opacity-65 block">CATEGORY / FAMILY</span>
                      <span className="font-bold">
                        {sniffResult.category} / {sniffResult.format.family}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                      <span className="text-[10px] opacity-65 block">MIME TYPE</span>
                      <span className="font-bold break-all">{sniffResult.mimeType}</span>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                      <span className="text-[10px] opacity-65 block">SIZE</span>
                      <span className="font-bold">{formatHumanBytes(sniffResult.metadata.sizeBytes)}</span>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                      <span className="text-[10px] opacity-65 block">PRESERVATION</span>
                      <span className="font-bold">{sniffResult.format.preservationGrade}</span>
                    </div>

                    {sniffResult.metadata.dimensions && (
                      <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <span className="text-[10px] opacity-65 block">DIMENSIONS</span>
                        <span className="font-bold">{sniffResult.metadata.dimensions}</span>
                      </div>
                    )}
                    {sniffResult.metadata.sampleRateHz && (
                      <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <span className="text-[10px] opacity-65 block">AUDIO PCM / STREAM</span>
                        <span className="font-bold">
                          {sniffResult.metadata.sampleRateHz} Hz • {sniffResult.metadata.channels || '?'}ch
                          {sniffResult.metadata.durationSeconds !== undefined
                            ? ` • ${sniffResult.metadata.durationSeconds.toFixed(1)}s`
                            : ''}
                        </span>
                      </div>
                    )}
                    {sniffResult.metadata.pdfVersion && (
                      <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <span className="text-[10px] opacity-65 block">PDF VERSION</span>
                        <span className="font-bold">{sniffResult.metadata.pdfVersion}</span>
                      </div>
                    )}
                    {sniffResult.metadata.sqlitePageSize && (
                      <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <span className="text-[10px] opacity-65 block">SQLITE3 HEADER</span>
                        <span className="font-bold">
                          {sniffResult.metadata.sqlitePageSize}B pages × {sniffResult.metadata.sqlitePageCount ?? '?'} ({sniffResult.metadata.sqliteEncoding || 'UTF-8'})
                        </span>
                      </div>
                    )}
                    {sniffResult.metadata.lut3dSize && (
                      <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <span className="text-[10px] opacity-65 block">3D LUT GRID</span>
                        <span className="font-bold">{sniffResult.metadata.lut3dSize}³ points</span>
                      </div>
                    )}
                    {sniffResult.metadata.csvColumns && (
                      <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <span className="text-[10px] opacity-65 block">DELIMITED TABLE</span>
                        <span className="font-bold">
                          {sniffResult.metadata.csvColumns} cols ({sniffResult.metadata.csvDelimiter})
                        </span>
                      </div>
                    )}
                    {sniffResult.metadata.jsonRootType && (
                      <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <span className="text-[10px] opacity-65 block">JSON ROOT</span>
                        <span className="font-bold">
                          {sniffResult.metadata.jsonRootType} ({sniffResult.metadata.jsonKeyCount ?? 0} keys)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 64-byte Hex & ASCII Preview */}
                  {sniffResult.metadata.headerHexPreview && (
                    <div className="p-3 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] space-y-1.5 overflow-x-auto">
                      <div>
                        <span className="text-slate-400 select-none block text-[10px]">
                          FIRST 64 BYTES (HEX)
                        </span>
                        <span className="break-all">{sniffResult.metadata.headerHexPreview}</span>
                      </div>
                      {sniffResult.metadata.headerAsciiPreview && (
                        <div>
                          <span className="text-slate-400 select-none block text-[10px]">
                            ASCII PROJECTION
                          </span>
                          <span className="break-all text-emerald-300">
                            {sniffResult.metadata.headerAsciiPreview}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'upsert' && (
            <form onSubmit={(e) => void handleSaveFormat(e)} className="space-y-4">
              {upsertStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    upsertStatus.ok
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300'
                  }`}
                >
                  {upsertStatus.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{upsertStatus.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="space-y-1 text-xs font-semibold block">
                  <span>Canonical Extension *</span>
                  <input
                    type="text"
                    required
                    value={formExt}
                    onChange={(e) => setFormExt(e.target.value)}
                    placeholder="e.g. QOI"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent font-mono focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  />
                </label>

                <label className="space-y-1 text-xs font-semibold block">
                  <span>Aliases (comma-separated)</span>
                  <input
                    type="text"
                    value={formAliases}
                    onChange={(e) => setFormAliases(e.target.value)}
                    placeholder="e.g. QOI2, QIMG"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent font-mono focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  />
                </label>

                <label className="space-y-1 text-xs font-semibold block">
                  <span>Format Name *</span>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Quite OK Image"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  />
                </label>

                <label className="space-y-1 text-xs font-semibold block">
                  <span>Format Family *</span>
                  <select
                    value={formFamily}
                    onChange={(e) => setFormFamily(e.target.value as FormatFamily)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  >
                    {ALL_FAMILIES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs font-semibold block">
                  <span>Drive Therapy Category *</span>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as MediaCategory)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  >
                    {ALL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs font-semibold block">
                  <span>MIME Types (comma-separated)</span>
                  <input
                    type="text"
                    value={formMimeTypes}
                    onChange={(e) => setFormMimeTypes(e.target.value)}
                    placeholder="image/qoi"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent font-mono focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  />
                </label>

                <label className="space-y-1 text-xs font-semibold block">
                  <span>Assigned Viewer</span>
                  <select
                    value={formViewer}
                    onChange={(e) => setFormViewer(e.target.value as FormatViewerKind)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  >
                    {ALL_VIEWERS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs font-semibold block">
                  <span>Assigned Editor</span>
                  <select
                    value={formEditor}
                    onChange={(e) => setFormEditor(e.target.value as FormatEditorKind)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  >
                    {ALL_EDITORS.map((ed) => (
                      <option key={ed} value={ed}>
                        {ed}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs font-semibold block">
                  <span>Preservation Grade</span>
                  <select
                    value={formGrade}
                    onChange={(e) => setFormGrade(e.target.value as PreservationGrade)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  >
                    {ALL_PRESERVATION_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1 text-xs font-semibold block">
                <span>Technical Description</span>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe container semantics, metadata headers, or preservation guidance..."
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                  <label className="min-h-[44px] inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsLossless}
                      onChange={(e) => setFormIsLossless(e.target.checked)}
                      className="w-4 h-4 accent-[#1074B1]"
                    />
                    <span>Lossless Representation</span>
                  </label>
                  <label className="min-h-[44px] inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsStreamable}
                      onChange={(e) => setFormIsStreamable(e.target.checked)}
                      className="w-4 h-4 accent-[#1074B1]"
                    />
                    <span>Byte-Range Streamable</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSavingFormat}
                  className="min-h-[44px] px-5 rounded-xl bg-[#1074B1] hover:bg-[#0e6499] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{isSavingFormat ? 'Persisting...' : 'Save to Flat-File Database'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
