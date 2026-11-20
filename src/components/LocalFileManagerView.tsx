/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Native OS Local File Manager View
 * Direct host filesystem explorer with live media streaming, breadcrumbs,
 * quick access shortcuts, and 1-click photo review / editor / library import.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '../i18n';
import {
  Folder,
  File,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Archive,
  ArrowLeft,
  ArrowUp,
  Home,
  RefreshCw,
  Search,
  LayoutGrid,
  List as ListIcon,
  ChevronRight,
  HardDrive,
  Download,
  SlidersHorizontal,
  Crop,
  Sparkles,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Camera,
  FolderOpen,
  MoreVertical,
} from 'lucide-react';
import { MediaHoverScrubber } from './MediaHoverScrubber';
import {
  MediaAsset,
  MediaCategory,
  OsFileEntry,
  OsFolderEntry,
  OsBreadcrumb,
  OsQuickAccessLocation,
} from '../types';
import { downloadLocalFileViaServer } from '../services/localFileSystem';

interface LocalFileManagerViewProps {
  onOpenInReview?: (assets: MediaAsset[]) => void;
  onOpenInEditor?: (asset: MediaAsset) => void;
  onPreviewAsset?: (asset: MediaAsset, list?: MediaAsset[]) => void;
  onImportFolderToCatalog?: (folderPath: string) => Promise<number>;
  onImportAssetsToCatalog?: (assets: MediaAsset[]) => void;
  onContextMenu?: (asset: MediaAsset, e: React.MouseEvent) => void;
  externalSearchQuery?: string;
  onExternalSearchChange?: (q: string) => void;
  externalCategory?: string;
  onExternalCategoryChange?: (c: MediaCategory | 'all' | string) => void;
  targetPath?: string;
}

export const LocalFileManagerView: React.FC<LocalFileManagerViewProps> = ({
  onOpenInReview,
  onOpenInEditor,
  onPreviewAsset,
  onImportFolderToCatalog,
  onImportAssetsToCatalog,
  onContextMenu,
  externalSearchQuery,
  onExternalSearchChange,
  externalCategory,
  onExternalCategoryChange,
  targetPath,
}) => {
  const { t } = useTranslation();
  const mapOsFileToAsset = (file: OsFileEntry): MediaAsset => ({
    id: `local_os_${file.path}`,
    name: file.name,
    source: 'local',
    category: (['image', 'raw', 'video', 'audio', 'document', 'archive', 'data'].includes(file.category) ? file.category : 'data') as MediaCategory,
    mimeType: file.mimeType,
    extension: file.extension.toUpperCase(),
    path: file.path,
    localPath: file.path,
    sizeBytes: file.size,
    modifiedTime: file.modifiedTime,
    thumbnailUrl: file.category === 'image' || file.category === 'raw' ? file.streamUrl : '',
    cloudUrl: undefined,
    isCached: true,
    cullingStatus: 'unrated',
    rating: 0,
    tags: ['Computer', file.category.toUpperCase()],
    faces: [],
    metadata: {
      formatName: file.formatName,
      family: file.family,
      viewer: file.viewer,
      editor: file.editor,
    },
    quality: { sharpness: 90, exposure: 88, overall: 89, isBlurry: false, reason: 'Local file' },
    palette: ['#52B197', '#1074B1', '#403993'],
    exif: { dimensions: 'Original File', dateTaken: new Date(file.modifiedTime).toLocaleDateString() },
  });
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<OsBreadcrumb[]>([]);
  const [folders, setFolders] = useState<OsFolderEntry[]>([]);
  const [files, setFiles] = useState<OsFileEntry[]>([]);
  const [quickAccess, setQuickAccess] = useState<OsQuickAccessLocation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Path input editing mode
  const [isEditingPath, setIsEditingPath] = useState<boolean>(false);
  const [pathInput, setPathInput] = useState<string>('');

  // History stack for back button
  const [history, setHistory] = useState<string[]>([]);

  // Filtering & layout state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Selected file for preview / actions
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<OsFileEntry | null>(null);
  const [importingNotice, setImportingNotice] = useState<string | null>(null);

  // Load quick access roots on mount
  useEffect(() => {
    fetch('/api/fs/quick-access')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.locations) {
          setQuickAccess(data.locations);
          if (!currentPath) {
            // Default to Pictures if present, else Home
            const pic = data.locations.find((l: OsQuickAccessLocation) => l.id === 'pictures');
            browseDirectory(pic ? pic.path : data.homePath);
          }
        }
      })
      .catch((err) => {
        console.warn('Quick access load error:', err);
        browseDirectory('');
      });
  }, []);

  // Synchronize target path changes from parent/common folders
  useEffect(() => {
    if (targetPath && targetPath !== currentPath) {
      browseDirectory(targetPath);
    }
  }, [targetPath]);

  // Fetch directory listing
  const browseDirectory = useCallback(
    async (targetDir: string, pushHistory = true) => {
      setIsLoading(true);
      setError(null);
      try {
        const query = targetDir ? `?path=${encodeURIComponent(targetDir)}` : '';
        const res = await fetch(`/api/fs/browse${query}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to open directory');
        }

        if (pushHistory && currentPath && currentPath !== data.currentPath) {
          setHistory((prev) => [...prev, currentPath]);
        }

        setCurrentPath(data.currentPath);
        setPathInput(data.currentPath);
        setParentPath(data.parentPath);
        setBreadcrumbs(data.breadcrumbs || []);
        setFolders(data.folders || []);
        setFiles(data.files || []);
        setSelectedFilePath(null);
      } catch (err: any) {
        setError(err.message || 'Could not load directory');
      } finally {
        setIsLoading(false);
        setIsEditingPath(false);
      }
    },
    [currentPath]
  );

  // Navigate back
  const handleBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      browseDirectory(prev, false);
    }
  };

  // Navigate up
  const handleUp = () => {
    if (parentPath) {
      browseDirectory(parentPath);
    }
  };

  // Submit manual path input
  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pathInput.trim()) {
      browseDirectory(pathInput.trim());
    }
  };

  // Active category and search query synchronization
  const effectiveCategory = externalCategory !== undefined ? externalCategory : selectedCategory;
  const effectiveQuery = externalSearchQuery !== undefined ? externalSearchQuery : searchQuery;

  // Filtered files computation
  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      if (effectiveCategory !== 'all') {
        if ((effectiveCategory === 'photos' || effectiveCategory === 'image') && f.category !== 'image' && f.category !== 'raw') return false;
        if (effectiveCategory === 'raw' && f.category !== 'raw') return false;
        if ((effectiveCategory === 'videos' || effectiveCategory === 'video') && f.category !== 'video') return false;
        if (effectiveCategory === 'audio' && f.category !== 'audio') return false;
        if ((effectiveCategory === 'documents' || effectiveCategory === 'document') && f.category !== 'document') return false;
        if ((effectiveCategory === 'archive' || effectiveCategory === 'archives') && f.category !== 'archive') return false;
      }
      if (effectiveQuery.trim()) {
        const q = effectiveQuery.toLowerCase();
        if (!f.name.toLowerCase().includes(q) && !f.extension.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [files, effectiveCategory, effectiveQuery]);

  const filteredFolders = useMemo(() => {
    if (!effectiveQuery.trim()) return folders;
    const q = effectiveQuery.toLowerCase();
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, effectiveQuery]);

  // Convert an OsFileEntry to a MediaAsset for studio tools
  const convertToFileAsset = (f: OsFileEntry): MediaAsset => {
    const normalizedCat: MediaCategory = (
      ['image', 'raw', 'video', 'audio', 'document', 'archive', 'data'].includes(f.category)
        ? f.category
        : 'data'
    ) as MediaCategory;
    return {
      id: `local_os_${Math.random().toString(36).slice(2, 10)}`,
      name: f.name,
      source: 'local',
      category: normalizedCat,
      mimeType: f.mimeType,
      extension: f.extension,
      path: f.path,
      sizeBytes: f.size,
      modifiedTime: f.modifiedTime,
      thumbnailUrl: f.streamUrl,
      cloudUrl: undefined,
      isCached: true,
      cullingStatus: 'unrated',
      rating: 0,
      tags: ['My Computer', f.extension],
      faces: [],
      metadata: {
        formatName: f.formatName,
        family: f.family,
        viewer: f.viewer,
        editor: f.editor,
      },
      quality: {
        sharpness: 90,
        exposure: 88,
        overall: 89,
        isBlurry: false,
        reason: 'Local file preview',
      },
      palette: ['#52B197', '#1074B1', '#403993', '#BEBF61', '#A61B7A'],
      exif: {
        dimensions: 'Native Resolution',
        dateTaken: new Date(f.modifiedTime).toLocaleDateString(),
      },
    };
  };

  // Launch photo review on all photos in this folder
  const handleReviewAllPhotos = () => {
    const photoFiles = files.filter((f) => ['image', 'raw'].includes(f.category));
    if (photoFiles.length === 0) {
      alert('No photos found in this folder to review.');
      return;
    }
    const assets = photoFiles.map(convertToFileAsset);
    if (onImportAssetsToCatalog) {
      onImportAssetsToCatalog(assets);
    }
    if (onOpenInReview) {
      onOpenInReview(assets);
    }
  };

  // Launch photo editor on selected file
  const handleEditSelected = () => {
    const file = files.find((f) => f.path === selectedFilePath);
    if (!file) return;
    if (!['image', 'raw'].includes(file.category)) {
      alert('Selected file is not an editable image.');
      return;
    }
    const asset = convertToFileAsset(file);
    if (onOpenInEditor) {
      onOpenInEditor(asset);
    }
  };

  // Import folder to studio catalog
  const handleImportCurrentFolder = async () => {
    if (!currentPath) return;
    setIsLoading(true);
    setImportingNotice(`Scanning & importing "${currentPath}"...`);
    try {
      if (onImportFolderToCatalog) {
        const count = await onImportFolderToCatalog(currentPath);
        setImportingNotice(`Successfully imported ${count} media files into your library!`);
      } else {
        const res = await fetch('/api/fs/import-to-catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: currentPath, recursive: false }),
        });
        const data = await res.json();
        if (data.success && onImportAssetsToCatalog) {
          onImportAssetsToCatalog(data.assets);
          setImportingNotice(`Successfully imported ${data.count} media files into your library!`);
        }
      }
      setTimeout(() => setImportingNotice(null), 4000);
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  const getQuickIcon = (iconName: string) => {
    switch (iconName) {
      case 'Image':
        return <ImageIcon className="w-4 h-4 text-[#52B197]" />;
      case 'Download':
        return <Download className="w-4 h-4 text-[#1074B1]" />;
      case 'FileText':
        return <FileText className="w-4 h-4 text-slate-500" />;
      case 'Monitor':
        return <HardDrive className="w-4 h-4 text-[#403993]" />;
      case 'Video':
        return <Video className="w-4 h-4 text-[#A61B7A]" />;
      case 'Music':
        return <Music className="w-4 h-4 text-[#BEBF61]" />;
      default:
        return <Home className="w-4 h-4 text-slate-600" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'image':
        return <ImageIcon className="w-4 h-4 text-[#52B197]" />;
      case 'raw':
        return <Camera className="w-4 h-4 text-[#1074B1]" />;
      case 'video':
        return <Video className="w-4 h-4 text-[#A61B7A]" />;
      case 'audio':
        return <Music className="w-4 h-4 text-[#BEBF61]" />;
      case 'document':
        return <FileText className="w-4 h-4 text-slate-500" />;
      case 'archive':
        return <Archive className="w-4 h-4 text-amber-500" />;
      default:
        return <File className="w-4 h-4 text-slate-400" />;
    }
  };

  const selectedFile = files.find((f) => f.path === selectedFilePath);
  const photoCount = files.filter((f) => ['image', 'raw'].includes(f.category)).length;

  return (
    <div className="space-y-4">
      {/* 1. Top Navigation & Location Bar */}
      <div className="p-3.5 rounded-2xl border shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 theme-card">
        {/* Navigation Controls & Breadcrumbs */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <button
            onClick={handleBack}
            disabled={history.length === 0}
            className="wcag-touch-target p-2 rounded-xl ui-card-title hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center justify-center"
            title={t('localManager.back')}
            aria-label={t('localManager.back')}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <button
            onClick={handleUp}
            disabled={!parentPath}
            className="wcag-touch-target p-2 rounded-xl ui-card-title hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center justify-center"
            title={t('localManager.up')}
            aria-label={t('localManager.up')}
          >
            <ArrowUp className="w-4 h-4" />
          </button>

          <button
            onClick={() => browseDirectory('')}
            className="wcag-touch-target p-2 rounded-xl ui-card-title hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center"
            title={t('localManager.home')}
            aria-label={t('localManager.home')}
          >
            <Home className="w-4 h-4" />
          </button>

          <button
            onClick={() => browseDirectory(currentPath, false)}
            className="wcag-touch-target p-2 rounded-xl ui-card-title hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center"
            title={t('localManager.refresh')}
            aria-label={t('localManager.refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#1074B1]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={async () => {
              try {
                const manifest: Record<string, { mtimeMs: number; size: number }> = {};
                for (const f of files) {
                  manifest[f.path] = {
                    mtimeMs: new Date(f.modifiedTime || 0).getTime(),
                    size: f.size || 0,
                  };
                }
                const res = await fetch('/api/fs/delta-scan', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ rootPaths: [currentPath], manifest }),
                });
                if (res.ok) {
                  const data = await res.json();
                  if ((data.addedOrModified?.length || 0) > 0 || (data.removedPaths?.length || 0) > 0) {
                    await browseDirectory(currentPath, false);
                  }
                }
              } catch {}
            }}
            className="px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-[#52B197] text-[11px] font-bold ui-card-title shrink-0"
            title="Check local directory for modified/added/deleted files via O(delta) stat diff"
          >
            Sync Delta
          </button>

          {/* Interactive Breadcrumb Trail or Editable Path Bar */}
          <div className="flex-1 min-w-0 ml-1">
            {isEditingPath ? (
              <form onSubmit={handlePathSubmit} className="w-full">
                <input
                  type="text"
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  onBlur={() => setIsEditingPath(false)}
                  autoFocus
                  placeholder="Type an absolute path, e.g. /home/user/Pictures or C:\Users\..."
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-[#1074B1] text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </form>
            ) : (
              <div
                onClick={() => setIsEditingPath(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 cursor-pointer overflow-x-auto no-scrollbar text-xs transition-colors"
                title={t('localManager.editPath')}
              >
                <HardDrive className="w-3.5 h-3.5 text-[#1074B1] shrink-0 mr-1" />
                {breadcrumbs.map((b, idx) => (
                  <React.Fragment key={b.path}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        browseDirectory(b.path);
                      }}
                      className="font-medium text-slate-700 dark:text-slate-200 hover:text-[#1074B1] dark:hover:text-[#52B197] hover:underline whitespace-nowrap"
                    >
                      {b.name}
                    </button>
                    {idx < breadcrumbs.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search, Filter & View Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Search in Folder */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('localManager.searchPlaceholder')}
              className="w-32 sm:w-44 pl-8 pr-2 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-transparent focus:border-[#1074B1] text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>

          {/* Grid / List Mode */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-[#1074B1] shadow-xs'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-[#1074B1] shadow-xs'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title="List View"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Quick Access Location Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
          {t('ribbon.title')}:
        </span>
        {quickAccess.map((loc) => {
          const isActive = currentPath === loc.path;
          return (
            <button
              key={loc.id}
              onClick={() => browseDirectory(loc.path)}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 shrink-0 transition-all active:scale-[0.98] ${
                isActive
                  ? 'bg-[#1074B1] text-white border-[#1074B1] shadow-xs'
                  : 'bg-white dark:bg-[#151C2C] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {getQuickIcon(loc.icon)}
              <span className="font-semibold">{loc.name}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Category Filter Chips & Studio Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs theme-card">
        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'all', label: `${t('filter.all')} (${files.length})` },
            { id: 'photos', label: `${t('filter.image')} (${photoCount})` },
            { id: 'videos', label: `${t('filter.video')} (${files.filter((f) => f.category === 'video').length})` },
            { id: 'audio', label: `${t('filter.audio')} (${files.filter((f) => f.category === 'audio').length})` },
            { id: 'documents', label: `${t('filter.document')} (${files.filter((f) => f.category === 'document').length})` },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === cat.id
                  ? 'bg-[#1074B1] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Primary Actions for This Folder */}
        <div className="flex items-center gap-2 flex-wrap">
          {photoCount > 0 && (
            <button
              onClick={handleReviewAllPhotos}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#52B197] to-[#1074B1] text-white text-xs font-bold shadow-xs hover:opacity-95 flex items-center gap-1.5 transition-all active:scale-[0.98]"
              title="Open all photos in this folder in Photo Review to quickly keep best shots and dismiss rejects"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{t('localManager.reviewFolder')}</span>
            </button>
          )}

          {selectedFile && ['image', 'raw'].includes(selectedFile.category) && (
            <button
              onClick={handleEditSelected}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all active:scale-[0.98]"
              title="Open selected photo in Photo Editor"
            >
              <Crop className="w-3.5 h-3.5" />
              <span>{t('editor.title')}</span>
            </button>
          )}

          <button
            onClick={handleImportCurrentFolder}
            className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-[#1074B1] text-slate-700 dark:text-slate-200 hover:text-[#1074B1] text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98]"
            title="Import all media in this directory into Drive Therapy's persistent studio library"
          >
            <PlusCircle className="w-3.5 h-3.5 text-[#1074B1]" />
            <span>{t('localManager.importFolder')}</span>
          </button>
        </div>
      </div>

      {/* Import Notice Banner */}
      {importingNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{importingNotice}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => browseDirectory('')}
            className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold hover:bg-rose-500/30 transition-colors"
          >
            Go to Home
          </button>
        </div>
      )}

      {/* 4. Main Explorer Canvas: Folders & Files */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#1074B1]" />
          <span>Loading directory files from your computer...</span>
        </div>
      ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
        <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#151C2C] rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
          <FolderOpen className="w-10 h-10 text-slate-300 dark:text-slate-600" />
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            This folder is empty or has no matching files.
          </span>
          {parentPath && (
            <button
              onClick={handleUp}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold"
            >
              Go Up One Folder
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Subfolders Section */}
          {filteredFolders.length > 0 && (
            <div>
              <h3 className="text-xs font-bold ui-card-meta uppercase tracking-wider mb-2.5 tabular-nums">
                {t('localManager.foldersHeader')} ({filteredFolders.length})
              </h3>
              <div className="drive-folders-grid">
                {filteredFolders.map((f) => (
                  <button
                    key={f.path}
                    onClick={() => browseDirectory(f.path)}
                    className="p-3.5 rounded-2xl border theme-card hover:border-[#1074B1] dark:hover:border-[#52B197] hover:shadow-sm text-left flex items-center gap-3 transition-all group active:scale-[0.98] folder-card min-h-[60px]"
                  >
                    <Folder className="w-5 h-5 text-[#1074B1] group-hover:text-[#52B197] shrink-0 transition-colors" />
                    <span className="font-bold text-xs sm:text-sm ui-card-title line-clamp-2 group-hover:text-[#1074B1]">
                      {f.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Files Section: Grid Mode */}
          {viewMode === 'grid' && filteredFiles.length > 0 && (
            <div>
              <h3 className="text-xs font-bold ui-card-meta uppercase tracking-wider mb-2.5 tabular-nums">
                {t('localManager.filesHeader')} ({filteredFiles.length})
              </h3>
              <div className="drive-files-grid">
                {filteredFiles.map((file) => {
                  const isSelected = selectedFilePath === file.path;
                  const isImage = file.category === 'image';
                  const isRaw = file.category === 'raw';

                  const isVideoOrAudio = file.category === 'video' || file.category === 'audio';
                  const mappedAsset = mapOsFileToAsset(file);
                  const visibleAssetList = filteredFiles.map(mapOsFileToAsset);

                  return (
                    <article
                      key={file.path}
                      onClick={() => setSelectedFilePath(file.path)}
                      onDoubleClick={() => {
                        if (onPreviewAsset) onPreviewAsset(mappedAsset, visibleAssetList);
                        else setPreviewFile(file);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onContextMenu?.(mappedAsset, e);
                      }}
                      className={`group relative rounded-2xl overflow-hidden border transition-all cursor-pointer theme-card file-card flex flex-col ${
                        isSelected
                          ? 'border-[#1074B1] ring-2 ring-[#1074B1]/30 shadow-md'
                          : 'hover:border-[#1074B1]/70'
                      }`}
                    >
                      {/* Media Thumbnail, Live Video/Audio Hover Scrubber, or Generic Icon */}
                      {isVideoOrAudio ? (
                        <div className="relative">
                          <MediaHoverScrubber asset={mappedAsset} />
                        </div>
                      ) : (
                      <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-900 flex items-center justify-center relative overflow-hidden">
                        {isImage || isRaw ? (
                          <img
                            src={file.streamUrl}
                            alt={file.name}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              // Fallback on preview error
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="p-4 flex flex-col items-center gap-1.5 ui-card-meta">
                            {getCategoryIcon(file.category)}
                            <span className="text-[11px] font-mono font-bold uppercase">
                              {file.extension}
                            </span>
                          </div>
                        )}
                      </div>
                      )}

                      {/* Hover Quick Preview & Download Action */}
                      <div className="relative">
                        <div className="absolute bottom-2 right-2 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1.5 z-20">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onPreviewAsset) onPreviewAsset(mappedAsset, visibleAssetList);
                              else setPreviewFile(file);
                            }}
                            className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-black/70 hover:bg-black/90 text-white shadow-xs flex items-center justify-center"
                            title="Preview Full Size"
                            aria-label="Preview Full Size"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadLocalFileViaServer(file.path, file.name);
                            }}
                            className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-black/70 hover:bg-black/90 text-white hover:text-[#52B197] shadow-xs flex items-center justify-center"
                            title="Download to Computer"
                            aria-label="Download to Computer"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* File Details Footer (Cleanly displays name, extension badge, size, and date) */}
                      <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                        <span className="font-bold text-xs sm:text-sm ui-card-title line-clamp-2 min-h-[2.4rem]" title={file.name}>
                          {file.name}
                        </span>
                        <div className="flex items-center justify-between text-[11px] ui-card-meta tabular-nums">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[10px] font-bold ui-card-title">
                              {file.extension}
                            </span>
                            <span>{formatBytes(file.size)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>{new Date(file.modifiedTime).toLocaleDateString()}</span>
                            {onContextMenu && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onContextMenu(mapOsFileToAsset(file), e);
                                }}
                                className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 ui-card-meta hover:text-[#1074B1] transition-colors flex items-center justify-center"
                                title="More options"
                                aria-label="More options"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* Files Section: List Mode */}
          {viewMode === 'list' && filteredFiles.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                Files ({filteredFiles.length})
              </h3>
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs theme-card">
                {filteredFiles.map((file) => {
                  const isSelected = selectedFilePath === file.path;
                  return (
                    <div
                      key={file.path}
                      onClick={() => setSelectedFilePath(file.path)}
                      onDoubleClick={() => {
                        if (onPreviewAsset) onPreviewAsset(mapOsFileToAsset(file));
                        else setPreviewFile(file);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onContextMenu?.(mapOsFileToAsset(file), e);
                      }}
                      className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#1074B1]/10 text-[#1074B1]'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {getCategoryIcon(file.category)}
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {file.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px] shrink-0">
                        <span className="w-16 text-right">{formatBytes(file.size)}</span>
                        <span className="w-16 text-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 uppercase font-bold text-[9px]">
                          {file.extension}
                        </span>
                        <span className="hidden sm:inline w-24 text-right">
                          {new Date(file.modifiedTime).toLocaleDateString()}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onPreviewAsset) onPreviewAsset(mapOsFileToAsset(file));
                            else setPreviewFile(file);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-[#1074B1]"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadLocalFileViaServer(file.path, file.name);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-[#52B197]"
                          title="Download"
                          aria-label="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {onContextMenu && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onContextMenu(mapOsFileToAsset(file), e);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-[#1074B1]"
                            title="More options"
                            aria-label="More options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Fullscreen Lightbox Modal for File Preview */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-white">
              <span className="font-bold truncate max-w-md">{previewFile.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-mono">{formatBytes(previewFile.size)}</span>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Media Canvas */}
            <div className="p-2 flex items-center justify-center overflow-auto max-h-[75vh]">
              {previewFile.category === 'image' || previewFile.category === 'raw' ? (
                <img
                  src={previewFile.streamUrl}
                  alt={previewFile.name}
                  className="max-h-[70vh] object-contain rounded-lg"
                />
              ) : previewFile.category === 'video' ? (
                <video
                  src={previewFile.streamUrl}
                  controls
                  autoPlay
                  className="max-h-[70vh] rounded-lg"
                />
              ) : previewFile.category === 'audio' ? (
                <div className="p-8 text-center space-y-4">
                  <Music className="w-12 h-12 text-[#BEBF61] mx-auto" />
                  <audio src={previewFile.streamUrl} controls className="w-72" />
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <FileText className="w-12 h-12 text-slate-500 mx-auto" />
                  <p className="font-semibold">{previewFile.name}</p>
                  <p className="text-xs">No media preview available for this file type.</p>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono truncate max-w-sm">
                {previewFile.path}
              </span>
              <div className="flex items-center gap-2">
                {['image', 'raw'].includes(previewFile.category) && onOpenInEditor && (
                  <button
                    onClick={() => {
                      const asset = convertToFileAsset(previewFile);
                      setPreviewFile(null);
                      onOpenInEditor(asset);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Crop className="w-3.5 h-3.5" />
                    <span>Open in Editor</span>
                  </button>
                )}
                <button
                  onClick={() => setPreviewFile(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
