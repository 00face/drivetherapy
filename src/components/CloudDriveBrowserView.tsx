/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Live Google Drive Browser (No-Sync Explorer)
 * Browse Google Drive folders, Shared With Me, Starred, and Recent files live
 * via Google Drive API v3 without scanning or auto-syncing the whole drive,
 * with per-file and per-folder selective sync into the persistent catalog.
 *
 * Designed strictly under WCAG 2.2 AAA & Container-Responsive UI Doctrine:
 * - Auto-fill container grids keep folder cards >= 240px and file cards >= 215px
 *   even when left and right drawers are both open.
 * - Multi-line ui-card-title labels guarantee full folder and file visibility.
 * - High-contrast --theme-text-auto surface contrast across all 52 themes.
 * - >= 44px primary interactive hit targets & semantic landmarks.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Cloud,
  Folder,
  File,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Archive,
  Camera,
  ArrowLeft,
  ArrowUp,
  Home,
  RefreshCw,
  Search,
  LayoutGrid,
  List as ListIcon,
  ChevronRight,
  Download,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Eye,
  FolderSync,
  CheckSquare,
  Square,
  Star,
  Share2,
  Plus,
  MoreVertical,
  Trash2,
  FolderPlus,
  RotateCcw,
} from 'lucide-react';
import {
  DriveBreadcrumb,
  DriveBrowserFolder,
  MediaAsset,
} from '../types';
import {
  browseDriveDirectory,
  DriveBrowserSection,
  createDriveFolder,
  restoreDriveFile,
} from '../services/googleDrive';
import { DriveShareModal } from './DriveShareModal';
import { useTranslation } from '../i18n';

interface CloudDriveBrowserViewProps {
  cloudConnected: boolean;
  onConnectGoogleDrive: () => void;
  syncedAssetIds: Set<string>;
  syncedFolderIds: Set<string>;
  onSyncFiles: (assets: MediaAsset[], parentFolder?: DriveBrowserFolder) => Promise<void> | void;
  onSyncFolder: (
    folder: DriveBrowserFolder,
    recursive?: boolean,
    onProgress?: (progress: { filesCount: number; foldersCount: number; currentFolder: string }) => void
  ) => Promise<number | { filesCount: number; foldersCount: number }>;
  onPreviewAsset?: (asset: MediaAsset, list?: MediaAsset[]) => void;
  onPlayMedia?: (asset: MediaAsset, siblings: MediaAsset[]) => void;
  onDownloadAsset?: (asset: MediaAsset) => void;
  onOpenInReview?: (assets: MediaAsset[]) => void;
  onContextMenu?: (asset: MediaAsset, e: React.MouseEvent) => void;
  externalSearchQuery?: string;
  externalCategory?: string;
}

const SECTION_ROOT_LABELS: Record<DriveBrowserSection, string> = {
  'my-drive': 'My Drive',
  shared: 'Shared with me',
  starred: 'Starred',
  recent: 'Recent Files',
  trash: 'Trash',
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'image':
      return <ImageIcon className="w-5 h-5 text-[#52B197]" />;
    case 'raw':
      return <Camera className="w-5 h-5 text-[#1074B1]" />;
    case 'video':
      return <Video className="w-5 h-5 text-[#A61B7A]" />;
    case 'audio':
      return <Music className="w-5 h-5 text-[#BEBF61]" />;
    case 'document':
      return <FileText className="w-5 h-5 text-slate-500 dark:text-slate-300" />;
    case 'archive':
      return <Archive className="w-5 h-5 text-amber-500" />;
    default:
      return <File className="w-5 h-5 ui-card-meta" />;
  }
}

export const CloudDriveBrowserView: React.FC<CloudDriveBrowserViewProps> = ({
  cloudConnected,
  onConnectGoogleDrive,
  syncedAssetIds,
  syncedFolderIds,
  onSyncFiles,
  onSyncFolder,
  onPreviewAsset,
  onPlayMedia,
  onDownloadAsset,
  onOpenInReview,
  onContextMenu,
  externalSearchQuery,
  externalCategory,
}) => {
  const { t } = useTranslation();

  const [section, setSection] = useState<DriveBrowserSection>('my-drive');
  const [breadcrumbs, setBreadcrumbs] = useState<DriveBreadcrumb[]>([
    { id: 'root', name: 'My Drive', path: '/Google Drive' },
  ]);
  const [history, setHistory] = useState<DriveBreadcrumb[][]>([]);

  const [folders, setFolders] = useState<DriveBrowserFolder[]>([]);
  const [files, setFiles] = useState<MediaAsset[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState<string>('');
  const [shareModalAsset, setShareModalAsset] = useState<MediaAsset | null>(null);
  const [activeRemoteSearch, setActiveRemoteSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [syncingFolderIds, setSyncingFolderIds] = useState<Set<string>>(new Set());
  const [syncingFileIds, setSyncingFileIds] = useState<Set<string>>(new Set());
  const [isBulkSyncing, setIsBulkSyncing] = useState<boolean>(false);
  const [includeSubfolders, setIncludeSubfolders] = useState<boolean>(true);
  const [folderSyncProgress, setFolderSyncProgress] = useState<
    Record<string, { filesCount: number; foldersCount: number }>
  >({});
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const currentCrumb = breadcrumbs[breadcrumbs.length - 1] || {
    id: 'root',
    name: SECTION_ROOT_LABELS[section],
    path: '/Google Drive',
  };

  const loadDirectory = useCallback(
    async (opts: {
      folderId: string;
      folderPath: string;
      targetSection: DriveBrowserSection;
      search?: string;
      pageToken?: string;
      append?: boolean;
    }) => {
      if (!cloudConnected) {
        setFolders([]);
        setFiles([]);
        setNextPageToken(undefined);
        return;
      }

      if (opts.append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setSelectedFileIds(new Set());
        setSelectedFolderIds(new Set());
      }
      setError(null);

      try {
        const res = await browseDriveDirectory({
          folderId: opts.folderId,
          folderPath: opts.folderPath,
          section: opts.targetSection,
          searchQuery: opts.search,
          pageToken: opts.pageToken,
          pageSize: 60,
        });

        if (opts.append) {
          setFiles((prev) => {
            const seen = new Set(prev.map((a) => a.id));
            return [...prev, ...res.files.filter((f) => !seen.has(f.id))];
          });
        } else {
          setFolders(res.folders);
          setFiles(res.files);
        }
        setNextPageToken(res.nextPageToken);
      } catch (err: any) {
        setError(err?.message || 'Unable to browse Google Drive folder.');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [cloudConnected]
  );

  useEffect(() => {
    if (cloudConnected) {
      loadDirectory({
        folderId: currentCrumb.id,
        folderPath: currentCrumb.path,
        targetSection: section,
        search: activeRemoteSearch,
      });
    }
  }, [cloudConnected]);

  const navigateToBreadcrumb = (crumb: DriveBreadcrumb, nextSection = section) => {
    const existingIdx = breadcrumbs.findIndex((b) => b.id === crumb.id);
    setHistory((prev) => [...prev, breadcrumbs]);
    const nextTrail =
      existingIdx >= 0
        ? breadcrumbs.slice(0, existingIdx + 1)
        : [...breadcrumbs, crumb];
    setBreadcrumbs(nextTrail);
    setActiveRemoteSearch('');
    setSearchInput('');
    loadDirectory({
      folderId: crumb.id,
      folderPath: crumb.path,
      targetSection: nextSection,
      search: '',
    });
  };

  const handleOpenFolder = (folder: DriveBrowserFolder) => {
    navigateToBreadcrumb({
      id: folder.id,
      name: folder.name,
      path: folder.path,
    });
  };

  const handleSwitchSection = (nextSection: DriveBrowserSection) => {
    const rootCrumb: DriveBreadcrumb = {
      id: 'root',
      name: SECTION_ROOT_LABELS[nextSection],
      path: '/Google Drive',
    };
    setHistory((prev) => [...prev, breadcrumbs]);
    setSection(nextSection);
    setBreadcrumbs([rootCrumb]);
    setActiveRemoteSearch('');
    setSearchInput('');
    loadDirectory({
      folderId: 'root',
      folderPath: '/Google Drive',
      targetSection: nextSection,
      search: '',
    });
  };

  const handleBack = () => {
    if (history.length === 0) return;
    const prevTrail = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setBreadcrumbs(prevTrail);
    const tail = prevTrail[prevTrail.length - 1];
    loadDirectory({
      folderId: tail.id,
      folderPath: tail.path,
      targetSection: section,
      search: activeRemoteSearch,
    });
  };

  const handleUp = () => {
    if (breadcrumbs.length <= 1) return;
    navigateToBreadcrumb(breadcrumbs[breadcrumbs.length - 2]);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    setActiveRemoteSearch(trimmed);
    loadDirectory({
      folderId: currentCrumb.id,
      folderPath: currentCrumb.path,
      targetSection: section,
      search: trimmed,
    });
  };

  const showTempNotice = (msg: string) => {
    setSyncNotice(msg);
    setTimeout(() => setSyncNotice((cur) => (cur === msg ? null : cur)), 4500);
  };

  const handleSyncSingleFile = async (file: MediaAsset) => {
    setSyncingFileIds((prev) => new Set(prev).add(file.id));
    try {
      const parentInfo: DriveBrowserFolder | undefined =
        currentCrumb.id !== 'root'
          ? { id: currentCrumb.id, name: currentCrumb.name, path: currentCrumb.path }
          : undefined;
      await onSyncFiles([file], parentInfo);
      showTempNotice(`Synced file "${file.name}" into catalog.`);
    } finally {
      setSyncingFileIds((prev) => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
    }
  };

  const handleSyncSingleFolder = async (folder: DriveBrowserFolder, recursive = includeSubfolders) => {
    setSyncingFolderIds((prev) => new Set(prev).add(folder.id));
    setFolderSyncProgress((prev) => ({ ...prev, [folder.id]: { filesCount: 0, foldersCount: 1 } }));
    try {
      const result = await onSyncFolder(folder, recursive, (prog) => {
        setFolderSyncProgress((prev) => ({
          ...prev,
          [folder.id]: { filesCount: prog.filesCount, foldersCount: prog.foldersCount },
        }));
      });
      const filesCount = typeof result === 'number' ? result : result.filesCount;
      const foldersCount = typeof result === 'number' ? 1 : result.foldersCount;
      const subSummary = foldersCount > 1 ? ` + ${foldersCount - 1} subfolder${foldersCount - 1 === 1 ? '' : 's'}` : '';
      showTempNotice(`Synced folder "${folder.name}"${subSummary} (${filesCount} file${filesCount === 1 ? '' : 's'}).`);
    } catch (err: any) {
      setError(err?.message || `Failed to sync folder "${folder.name}"`);
    } finally {
      setSyncingFolderIds((prev) => {
        const next = new Set(prev);
        next.delete(folder.id);
        return next;
      });
      setFolderSyncProgress((prev) => {
        const next = { ...prev };
        delete next[folder.id];
        return next;
      });
    }
  };

  const handleSyncSelectedItems = async () => {
    const checkedFiles = files.filter((f) => selectedFileIds.has(f.id));
    const checkedFolders = folders.filter((f) => selectedFolderIds.has(f.id));
    if (checkedFiles.length === 0 && checkedFolders.length === 0) return;

    setIsBulkSyncing(true);
    try {
      let totalFilesSynced = 0;
      if (checkedFiles.length > 0) {
        const parentInfo: DriveBrowserFolder | undefined =
          currentCrumb.id !== 'root'
            ? { id: currentCrumb.id, name: currentCrumb.name, path: currentCrumb.path }
            : undefined;
        await onSyncFiles(checkedFiles, parentInfo);
        totalFilesSynced += checkedFiles.length;
      }

      for (const folder of checkedFolders) {
        const res = await onSyncFolder(folder, includeSubfolders);
        totalFilesSynced += typeof res === 'number' ? res : res.filesCount;
      }

      setSelectedFileIds(new Set());
      setSelectedFolderIds(new Set());
      showTempNotice(
        `Synced ${checkedFolders.length} folder(s) and ${checkedFiles.length} individual file(s) (${totalFilesSynced} total items).`
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to sync selected Drive items.');
    } finally {
      setIsBulkSyncing(false);
    }
  };

  const toggleFileSelect = (id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFolderSelect = (id: string) => {
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const effectiveCategory = externalCategory && externalCategory !== 'all' ? externalCategory : selectedCategory;
  const effectiveFilterQuery = (externalSearchQuery || searchInput).trim().toLowerCase();

  const filteredFolders = useMemo(() => {
    if (!effectiveFilterQuery || activeRemoteSearch) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(effectiveFilterQuery));
  }, [folders, effectiveFilterQuery, activeRemoteSearch]);

  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      if (effectiveCategory !== 'all') {
        if ((effectiveCategory === 'image' || effectiveCategory === 'photos') && f.category !== 'image' && f.category !== 'raw') {
          return false;
        }
        if (effectiveCategory === 'raw' && f.category !== 'raw') return false;
        if ((effectiveCategory === 'video' || effectiveCategory === 'videos') && f.category !== 'video') return false;
        if (effectiveCategory === 'audio' && f.category !== 'audio') return false;
        if ((effectiveCategory === 'document' || effectiveCategory === 'documents') && f.category !== 'document') return false;
        if ((effectiveCategory === 'archive' || effectiveCategory === 'archives') && f.category !== 'archive') return false;
      }
      if (effectiveFilterQuery && !activeRemoteSearch) {
        if (
          !f.name.toLowerCase().includes(effectiveFilterQuery) &&
          !f.extension.toLowerCase().includes(effectiveFilterQuery)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [files, effectiveCategory, effectiveFilterQuery, activeRemoteSearch]);

  const totalSelected = selectedFileIds.size + selectedFolderIds.size;
  const allVisibleSelected =
    filteredFolders.length + filteredFiles.length > 0 &&
    filteredFolders.every((f) => selectedFolderIds.has(f.id)) &&
    filteredFiles.every((f) => selectedFileIds.has(f.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedFolderIds(new Set());
      setSelectedFileIds(new Set());
    } else {
      setSelectedFolderIds(new Set(filteredFolders.map((f) => f.id)));
      setSelectedFileIds(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  const handleOpenOrPreview = (file: MediaAsset) => {
    if ((file.category === 'audio' || file.category === 'video') && onPlayMedia) {
      onPlayMedia(file, filteredFiles);
    } else if (onPreviewAsset) {
      onPreviewAsset(file, filteredFiles);
    }
  };

  const photoAssets = useMemo(
    () => filteredFiles.filter((f) => f.category === 'image' || f.category === 'raw'),
    [filteredFiles]
  );

  if (!cloudConnected) {
    return (
      <section aria-label="Live Google Drive Browser" className="p-10 rounded-2xl border theme-card text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#1074B1]/15 text-[#1074B1] flex items-center justify-center">
          <Cloud className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-extrabold tracking-tight ui-card-title">Live Google Drive Browser</h2>
        <p className="text-xs ui-card-meta max-w-md mx-auto leading-relaxed">
          Connect your Google Drive account to browse folders, Shared with me, Starred items, and Recent files live
          without running a full Drive sync. You can cherry-pick individual folders or files to sync on demand.
        </p>
        <button
          onClick={onConnectGoogleDrive}
          className="px-5 py-2.5 rounded-xl bg-[#1074B1] hover:bg-[#0d6296] text-white text-xs font-bold shadow-sm transition-all min-h-[44px]"
        >
          Connect Google Drive Account
        </button>
        </section>
    );
  }

  return (
    <section aria-label="Live Google Drive Browser" className="space-y-4">
      {/* 1. Top Navigation, Breadcrumbs & Remote Search Header */}
      <header className="p-3.5 rounded-2xl border shadow-xs flex flex-col gap-3 theme-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Directional Nav + Breadcrumbs */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[260px]">
            <button
              onClick={handleBack}
              disabled={history.length === 0}
              className="wcag-touch-target p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-35 disabled:pointer-events-none transition-colors flex items-center justify-center ui-card-title"
              title="Back"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleUp}
              disabled={breadcrumbs.length <= 1}
              className="wcag-touch-target p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-35 disabled:pointer-events-none transition-colors flex items-center justify-center ui-card-title"
              title="Up one folder"
              aria-label="Up one folder"
            >
              <ArrowUp className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleSwitchSection('my-drive')}
              className="wcag-touch-target p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center ui-card-title"
              title="My Drive Root"
              aria-label="My Drive Root"
            >
              <Home className="w-4 h-4" />
            </button>

            <button
              onClick={() =>
                loadDirectory({
                  folderId: currentCrumb.id,
                  folderPath: currentCrumb.path,
                  targetSection: section,
                  search: activeRemoteSearch,
                })
              }
              className="wcag-touch-target p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center ui-card-title"
              title="Refresh live Drive directory"
              aria-label="Refresh live Drive directory"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#1074B1]' : ''}`} />
            </button>

            {/* Breadcrumbs */}
            <nav
              aria-label="Google Drive Breadcrumbs"
              className="flex-1 min-w-0 ml-1 flex items-center gap-1 px-3 min-h-[44px] rounded-xl bg-black/5 dark:bg-white/5 border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto custom-scrollbar text-xs"
            >
              <Cloud className="w-4 h-4 text-[#1074B1] shrink-0 mr-1" />
              {breadcrumbs.map((b, idx) => (
                <React.Fragment key={`${b.id}_${idx}`}>
                  <button
                    type="button"
                    onClick={() => navigateToBreadcrumb(b)}
                    className="min-h-[36px] px-1.5 rounded-lg font-bold ui-card-title hover:text-[#1074B1] dark:hover:text-[#52B197] hover:underline whitespace-nowrap"
                  >
                    {b.name}
                  </button>
                  {idx < breadcrumbs.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 ui-card-meta shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </nav>
          </div>

          {/* Search & View Mode Switcher */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-1.5">
              <div className="relative">
                <Search className="w-4 h-4 ui-card-meta absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search Drive (Enter for remote)..."
                  aria-label="Search Google Drive folder or account"
                  className="w-48 sm:w-56 pl-9 pr-3 text-xs rounded-xl bg-black/5 dark:bg-white/10 border border-slate-300/60 dark:border-slate-700 focus:border-[#1074B1] ui-card-title placeholder:opacity-60 focus:outline-none min-h-[44px]"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 rounded-xl bg-[#1074B1]/15 hover:bg-[#1074B1]/25 text-[#1074B1] dark:text-[#67b7e6] text-xs font-bold min-h-[44px] transition-colors border border-[#1074B1]/30"
                title="Query Google Drive live"
              >
                Query
              </button>
            </form>

            <div className="flex items-center p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-slate-200/80 dark:border-slate-700">
              <button
                onClick={() => setViewMode('grid')}
                className={`min-h-[38px] min-w-[38px] p-2 rounded-lg text-xs transition-colors flex items-center justify-center ${
                  viewMode === 'grid'
                    ? 'bg-[#1074B1] text-white shadow-xs'
                    : 'ui-card-meta hover:text-[#1074B1]'
                }`}
                title="Grid View"
                aria-label="Grid View"
                aria-pressed={viewMode === 'grid'}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`min-h-[38px] min-w-[38px] p-2 rounded-lg text-xs transition-colors flex items-center justify-center ${
                  viewMode === 'list'
                    ? 'bg-[#1074B1] text-white shadow-xs'
                    : 'ui-card-meta hover:text-[#1074B1]'
                }`}
                title="List View"
                aria-label="List View"
                aria-pressed={viewMode === 'list'}
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 2. Drive Section Switcher & No-Sync Telemetry */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/70 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap" role="tablist" aria-label="Google Drive Sections">
            {(
              [
                { id: 'my-drive', label: 'My Drive', icon: <Cloud className="w-4 h-4 shrink-0" /> },
                { id: 'shared', label: 'Shared with me', icon: <Share2 className="w-4 h-4 shrink-0" /> },
                { id: 'starred', label: 'Starred', icon: <Star className="w-4 h-4 shrink-0" /> },
                { id: 'recent', label: 'Recent', icon: <RefreshCw className="w-4 h-4 shrink-0" /> },
                { id: 'trash', label: 'Trash', icon: <Trash2 className="w-4 h-4 shrink-0" /> },
              ] as const
            ).map((sec) => {
              const active = section === sec.id;
              return (
                <button
                  key={sec.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleSwitchSection(sec.id)}
                  className={`px-3.5 rounded-xl border flex items-center gap-2 font-bold transition-all min-h-[44px] ${
                    active
                      ? 'bg-[#1074B1] text-white border-[#1074B1] shadow-xs'
                      : 'theme-card border-slate-200/80 dark:border-slate-700/80 hover:border-[#1074B1] ui-card-title'
                  }`}
                >
                  {sec.icon}
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </div>

          <span className="px-3 py-1.5 rounded-full bg-sky-500/15 border border-sky-500/35 text-sky-700 dark:text-sky-300 text-xs font-bold">
            Live Browse · Zero Auto-Sync
          </span>
        </div>
      </header>

      {/* 3. Category Filter & Individual Folder / Multi-Select Sync Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-3.5 rounded-2xl border shadow-xs theme-card">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'all', label: `${t('filter.all') || 'All'} (${files.length})` },
            { id: 'photos', label: `${t('filter.image') || 'Photos'} (${photoAssets.length})` },
            { id: 'videos', label: `${t('filter.video') || 'Videos'} (${files.filter((f) => f.category === 'video').length})` },
            { id: 'audio', label: `${t('filter.audio') || 'Audio'} (${files.filter((f) => f.category === 'audio').length})` },
            { id: 'documents', label: `${t('filter.document') || 'Documents'} (${files.filter((f) => f.category === 'document').length})` },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 rounded-xl text-xs font-bold transition-all min-h-[44px] tabular-nums ${
                selectedCategory === cat.id
                  ? 'bg-[#1074B1] text-white shadow-xs'
                  : 'bg-black/5 dark:bg-white/5 ui-card-title hover:bg-black/10 dark:hover:bg-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {section === 'my-drive' && (
            <button
              type="button"
              onClick={async () => {
                const name = window.prompt('New Google Drive folder name:');
                if (!name?.trim()) return;
                try {
                  await createDriveFolder(name.trim(), currentCrumb.id);
                  void loadDirectory({
                    folderId: currentCrumb.id,
                    folderPath: currentCrumb.path,
                    targetSection: section,
                    search: activeRemoteSearch,
                  });
                } catch {}
              }}
              className="px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-[#1074B1] text-xs font-bold flex items-center gap-1.5 min-h-[44px] ui-card-title"
              title="Create a new folder in this Google Drive directory"
            >
              <FolderPlus className="w-4 h-4 text-[#1074B1]" />
              <span>New Folder</span>
            </button>
          )}

          <button
            onClick={toggleSelectAllVisible}
            disabled={filteredFolders.length + filteredFiles.length === 0}
            className="px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-[#1074B1] text-xs font-bold flex items-center gap-2 min-h-[44px] disabled:opacity-40 ui-card-title"
          >
            {allVisibleSelected ? (
              <CheckSquare className="w-4 h-4 text-[#1074B1]" />
            ) : (
              <Square className="w-4 h-4 opacity-70" />
            )}
            <span>{allVisibleSelected ? 'Clear Selection' : 'Select All'}</span>
          </button>

          {totalSelected > 0 && (
            <button
              onClick={handleSyncSelectedItems}
              disabled={isBulkSyncing}
              className="px-4 rounded-xl bg-gradient-to-r from-[#52B197] to-[#1074B1] text-white text-xs font-bold shadow-xs hover:opacity-95 flex items-center gap-2 min-h-[44px] disabled:opacity-60 tabular-nums"
            >
              {isBulkSyncing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FolderSync className="w-4 h-4" />
              )}
              <span>Sync Selected ({totalSelected})</span>
            </button>
          )}

          <label className="flex items-center gap-2 text-xs font-semibold px-3 rounded-xl bg-black/5 dark:bg-white/5 cursor-pointer select-none min-h-[44px] ui-card-title">
            <input
              type="checkbox"
              checked={includeSubfolders}
              onChange={(e) => setIncludeSubfolders(e.target.checked)}
              className="w-4 h-4 rounded accent-[#1074B1]"
            />
            <span>Include subfolders</span>
          </label>

          {currentCrumb.id !== 'root' && (
            <button
              onClick={() =>
                handleSyncSingleFolder(
                  {
                    id: currentCrumb.id,
                    name: currentCrumb.name,
                    path: currentCrumb.path,
                  },
                  includeSubfolders
                )
              }
              disabled={syncingFolderIds.has(currentCrumb.id)}
              className="px-3.5 rounded-xl bg-[#1074B1] hover:bg-[#0e6499] text-white text-xs font-bold flex items-center gap-2 min-h-[44px] shadow-xs disabled:opacity-60"
              title="Sync only this folder into your Drive Therapy catalog"
            >
              {syncingFolderIds.has(currentCrumb.id) ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FolderSync className="w-4 h-4" />
              )}
              <span>
                {syncedFolderIds.has(currentCrumb.id) ? 'Re-sync This Folder' : 'Sync This Folder'}
              </span>
            </button>
          )}

          {photoAssets.length > 0 && onOpenInReview && (
            <button
              onClick={() => onOpenInReview(photoAssets)}
              className="px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-[#52B197] text-xs font-bold flex items-center gap-2 min-h-[44px] ui-card-title"
              title="Review photos in this Drive folder"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#52B197]" />
              <span>Review Photos</span>
            </button>
          )}
        </div>
      </div>

      {/* Status & Error Banners */}
      {syncNotice && (
        <div role="status" className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{syncNotice}</span>
        </div>
      )}

      {error && (
        <div role="alert" className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            onClick={() =>
              loadDirectory({
                folderId: currentCrumb.id,
                folderPath: currentCrumb.path,
                targetSection: section,
                search: activeRemoteSearch,
              })
            }
            className="px-3.5 min-h-[40px] rounded-xl bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold hover:bg-rose-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4. Main Explorer Content */}
      {isLoading ? (
        <div className="p-16 text-center text-xs flex flex-col items-center justify-center gap-3 theme-card rounded-2xl border">
          <RefreshCw className="w-7 h-7 animate-spin text-[#1074B1]" />
          <span className="font-semibold ui-card-title">Browsing Google Drive live (no catalog sync)...</span>
        </div>
      ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
        <div className="p-16 text-center text-xs flex flex-col items-center justify-center gap-3 theme-card rounded-2xl border">
          <Folder className="w-10 h-10 opacity-50 ui-card-meta" />
          <span className="text-sm font-bold ui-card-title">This Drive view has no matching folders or files.</span>
          {breadcrumbs.length > 1 && (
            <button
              onClick={handleUp}
              className="px-4 min-h-[44px] rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/10 text-xs font-bold ui-card-title"
            >
              Go Up One Folder
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Subfolders Grid (.drive-folders-grid ensures >= 240px per card!) */}
          {filteredFolders.length > 0 && (
            <section aria-label="Google Drive Folders">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider ui-card-title tabular-nums">
                  Folders ({filteredFolders.length})
                </h3>
                <span className="text-[11px] ui-card-meta">Click a folder card to open live</span>
              </div>
              <div className="drive-folders-grid">
                {filteredFolders.map((folder) => {
                  const isFolderSynced = syncedFolderIds.has(folder.id);
                  const isFolderSyncing = syncingFolderIds.has(folder.id);
                  const isSelected = selectedFolderIds.has(folder.id);

                  return (
                    <article
                      key={folder.id}
                      onClick={() => handleOpenFolder(folder)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleOpenFolder(folder);
                        }
                      }}
                      tabIndex={0}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer group flex flex-col justify-between gap-2.5 min-h-[104px] theme-card folder-card ${
                        isSelected
                          ? 'border-[#1074B1] ring-2 ring-[#1074B1]/35 shadow-sm'
                          : 'hover:border-[#1074B1]'
                      }`}
                    >
                      {/* Top Row: WCAG 44px Checkbox + Folder Icon + Full Multi-Line Folder Name */}
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFolderSelect(folder.id);
                          }}
                          className="wcag-touch-target -ml-1.5 -mt-1.5 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 shrink-0 flex items-center justify-center"
                          aria-label={`Select folder ${folder.name}`}
                          aria-pressed={isSelected}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-[#1074B1]" />
                          ) : (
                            <Square className="w-5 h-5 opacity-60 group-hover:opacity-100 ui-card-title" />
                          )}
                        </button>

                        <div className="flex items-start gap-2 flex-1 min-w-0 pt-0.5">
                          <Folder className="w-5 h-5 text-[#1074B1] shrink-0 mt-0.5" />
                          <h4
                            className="ui-card-title text-sm font-bold line-clamp-2"
                            title={folder.name}
                          >
                            {folder.name}
                          </h4>
                        </div>
                      </div>

                      {/* Bottom Row: Folder Path + Sync Button */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                        <span className="text-[11px] font-mono ui-card-meta truncate" title={folder.path}>
                          {folder.path}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSyncSingleFolder(folder);
                          }}
                          disabled={isFolderSyncing}
                          className={`px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors min-h-[38px] ${
                            isFolderSynced
                              ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/25'
                              : 'bg-[#1074B1]/15 text-[#1074B1] dark:text-[#67b7e6] hover:bg-[#1074B1] hover:text-white border border-[#1074B1]/30'
                          }`}
                          title={isFolderSynced ? 'Folder synced (click to re-sync)' : 'Sync this individual folder'}
                        >
                          {isFolderSyncing ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : isFolderSynced ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isFolderSyncing && folderSyncProgress[folder.id]
                              ? `Syncing (${folderSyncProgress[folder.id].foldersCount}f, ${folderSyncProgress[folder.id].filesCount})`
                              : isFolderSynced
                              ? 'Synced'
                              : 'Sync Folder'}
                          </span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              </section>
          )}

          {/* Files Section: Grid Mode (.drive-files-grid ensures >= 215px per card!) */}
          {viewMode === 'grid' && filteredFiles.length > 0 && (
            <section aria-label="Google Drive Files Grid">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider ui-card-title tabular-nums">
                  Files ({filteredFiles.length})
                </h3>
                <span className="text-[11px] ui-card-meta">Double-click to preview · Click Sync File to catalog</span>
              </div>
              <div className="drive-files-grid">
                {filteredFiles.map((file) => {
                  const isSynced = syncedAssetIds.has(file.id);
                  const isSyncing = syncingFileIds.has(file.id);
                  const isSelected = selectedFileIds.has(file.id);
                  const isVisual = file.category === 'image' || file.category === 'raw';

                  return (
                    <article
                      key={file.id}
                      onDoubleClick={() => handleOpenOrPreview(file)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onContextMenu?.(file, e);
                      }}
                      className={`group relative rounded-2xl overflow-hidden border transition-all flex flex-col theme-card file-card ${
                        isSelected
                          ? 'border-[#1074B1] ring-2 ring-[#1074B1]/35 shadow-md'
                          : 'hover:border-[#1074B1]/80'
                      }`}
                    >
                      {/* Clean Thumbnail Preview Stage */}
                      <div
                        onClick={() => toggleFileSelect(file.id)}
                        className="aspect-[4/3] bg-slate-200/70 dark:bg-slate-900 flex items-center justify-center relative overflow-hidden cursor-pointer"
                      >
                        {isVisual && file.thumbnailUrl ? (
                          <img
                            src={file.thumbnailUrl}
                            alt={file.name}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="p-4 flex flex-col items-center gap-2 ui-card-meta">
                            {getCategoryIcon(file.category)}
                            <span className="text-[11px] font-mono font-bold uppercase">
                              {file.extension || 'FILE'}
                            </span>
                          </div>
                        )}

                        {/* WCAG 44px Selection Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFileSelect(file.id);
                          }}
                          className={`wcag-touch-target absolute top-1.5 left-1.5 p-2 rounded-xl backdrop-blur-sm transition-opacity z-20 flex items-center justify-center ${
                            isSelected
                              ? 'bg-[#1074B1] text-white opacity-100'
                              : 'bg-black/55 text-white opacity-85 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100'
                          }`}
                          aria-label={`Select file ${file.name}`}
                          aria-pressed={isSelected}
                        >
                          {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>

                        {/* Hover Preview & Download Actions (WCAG 40-44px targets) */}
                        <div className="absolute bottom-1.5 right-1.5 opacity-95 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1.5 z-20">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenOrPreview(file);
                            }}
                            className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-black/70 hover:bg-black/90 text-white flex items-center justify-center shadow-sm"
                            title="Preview / Play without syncing"
                            aria-label={`Preview ${file.name}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {onDownloadAsset && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDownloadAsset(file);
                              }}
                              className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-black/70 hover:bg-black/90 text-white hover:text-[#52B197] flex items-center justify-center shadow-sm"
                              title="Download file"
                              aria-label={`Download ${file.name}`}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* High-Contrast File Label & Dedicated Sync Bar */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
                        <div>
                          <h4
                            className="ui-card-title text-xs sm:text-sm font-bold line-clamp-2 min-h-[2.4rem]"
                            title={file.name}
                          >
                            {file.name}
                          </h4>
                          <div className="flex items-center justify-between gap-2 text-[11px] font-mono ui-card-meta mt-1.5">
                            <span className="px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10 font-bold uppercase ui-card-title text-[10px]">
                              {file.extension || 'FILE'}
                            </span>
                            <span>{formatBytes(file.sizeBytes)}</span>
                            <span className="truncate">
                              {new Date(file.modifiedTime).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                          {section === 'trash' ? (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const ok = await restoreDriveFile(file.id);
                                if (ok) setFiles((prev) => prev.filter((f) => f.id !== file.id));
                              }}
                              className="flex-1 min-h-[40px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                              title="Restore file from Google Drive Trash"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSyncSingleFile(file);
                              }}
                              disabled={isSyncing}
                              className={`flex-1 min-h-[40px] px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                isSynced
                                  ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/25'
                                  : 'bg-[#1074B1] hover:bg-[#0d6296] text-white shadow-xs'
                              }`}
                              title={isSynced ? 'Synced in catalog' : 'Sync this individual file to catalog'}
                            >
                              {isSyncing ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : isSynced ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <Plus className="w-3.5 h-3.5" />
                              )}
                              <span>{isSynced ? 'Synced in Catalog' : 'Sync File'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShareModalAsset(file);
                            }}
                            className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-300 dark:border-slate-700 hover:border-[#1074B1] flex items-center justify-center ui-card-title"
                            title="Share, Permissions, Version History & Export"
                            aria-label={`Share ${file.name}`}
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>

                          {onContextMenu && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onContextMenu(file, e);
                              }}
                              className="min-h-[40px] min-w-[40px] p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 ui-card-meta flex items-center justify-center"
                              title="More options"
                              aria-label={`More options for ${file.name}`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              </section>
          )}

          {/* Files Section: List Mode */}
          {viewMode === 'list' && filteredFiles.length > 0 && (
            <section aria-label="Google Drive Files List">
              <h3 className="text-xs font-bold uppercase tracking-wider ui-card-title mb-3 tabular-nums">
                Files ({filteredFiles.length})
              </h3>
              <div className="rounded-2xl border overflow-hidden divide-y divide-slate-200/60 dark:divide-slate-800/70 text-xs theme-card">
                {filteredFiles.map((file) => {
                  const isSynced = syncedAssetIds.has(file.id);
                  const isSyncing = syncingFileIds.has(file.id);
                  const isSelected = selectedFileIds.has(file.id);

                  return (
                    <div
                      key={file.id}
                      onDoubleClick={() => handleOpenOrPreview(file)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onContextMenu?.(file, e);
                      }}
                      className={`p-3 min-h-[60px] flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#1074B1]/15'
                          : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFileSelect(file.id);
                          }}
                          className="wcag-touch-target p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 shrink-0 flex items-center justify-center"
                          aria-label={`Select file ${file.name}`}
                          aria-pressed={isSelected}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#1074B1]" />
                          ) : (
                            <Square className="w-4 h-4 opacity-60" />
                          )}
                        </button>
                        {getCategoryIcon(file.category)}
                        <span className="ui-card-title text-xs sm:text-sm font-bold truncate" title={file.name}>
                          {file.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs shrink-0 tabular-nums">
                        <span className="ui-card-meta font-mono w-16 text-right">
                          {formatBytes(file.sizeBytes)}
                        </span>
                        <span className="hidden md:inline ui-card-title font-mono px-2 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-[10px] font-bold">
                          {file.extension || 'FILE'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSyncSingleFile(file);
                          }}
                          disabled={isSyncing}
                          className={`px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 min-h-[40px] transition-colors ${
                            isSynced
                              ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                              : 'bg-[#1074B1] hover:bg-[#0d6296] text-white'
                          }`}
                        >
                          {isSyncing ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : isSynced ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          <span>{isSynced ? 'Synced' : 'Sync File'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenOrPreview(file);
                          }}
                          className="min-h-[40px] min-w-[40px] p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 ui-card-meta hover:text-[#1074B1] flex items-center justify-center"
                          title="Preview / Play"
                          aria-label={`Preview ${file.name}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {onDownloadAsset && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadAsset(file);
                            }}
                            className="min-h-[40px] min-w-[40px] p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 ui-card-meta hover:text-[#52B197] flex items-center justify-center"
                            title="Download"
                            aria-label={`Download ${file.name}`}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              </section>
          )}

          {/* Pagination: Load More without syncing everything */}
          {nextPageToken && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() =>
                  loadDirectory({
                    folderId: currentCrumb.id,
                    folderPath: currentCrumb.path,
                    targetSection: section,
                    search: activeRemoteSearch,
                    pageToken: nextPageToken,
                    append: true,
                  })
                }
                disabled={isLoadingMore}
                className="px-6 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-[#1074B1] text-xs font-bold flex items-center gap-2 theme-card min-h-[44px] ui-card-title"
              >
                {isLoadingMore && <RefreshCw className="w-4 h-4 animate-spin text-[#1074B1]" />}
                <span>{isLoadingMore ? 'Loading more...' : 'Load More Items from Drive'}</span>
              </button>
            </div>
          )}
        </div>
      )}
      <DriveShareModal
        isOpen={Boolean(shareModalAsset)}
        onClose={() => setShareModalAsset(null)}
        asset={shareModalAsset}
      />
    </section>
  );
};
