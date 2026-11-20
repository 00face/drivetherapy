/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Storage & Directory Tree Sidebar (Attachment 1 Architecture - A+ Tier)
 * Real-time storage telemetry, session restore badge, catalog reset,
 * prominent top action controls, deep scan launcher, and independent folder scroll.
 */

import React, { useState, useEffect } from 'react';
import {
  Cloud,
  HardDrive,
  Folder,
  Share2,
  Clock,
  Star,
  Trash2,
  Plus,
  ChevronRight,
  FolderPlus,
  RefreshCw,
  Sparkles,
  Database,
  CheckCircle2,
  FileText,
  Info,
  Zap,
  Monitor,
  FolderOpen,
  Image as ImageIcon,
  Download,
  Video,
  Music,
  AlertTriangle,
  Camera,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { FolderNode, MediaSource } from '../types';
import { useTranslation } from '../i18n';
import { loadSmartCollections, SmartCollection } from '../services/smartCollections';

interface StorageSidebarProps {
  folders: FolderNode[];
  selectedFolderId: string;
  onSelectFolder: (folderId: string) => void;
  onImportLocalFolder: () => void;
  onImportFiles?: () => void;
  onOpenLocalFileManager?: () => void;
  onScanDrive: () => void;
  onDeepScan?: () => void;
  onSelectSmartCollection?: (query: string) => void;
  activeSmartQuery?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onSyncChanges?: () => void;
  hasChangesSnapshot?: boolean;
  isScanning: boolean;
  scanType?: 'quick' | 'deep' | 'folder' | null;
  cloudConnected: boolean;
  driveQuota?: { limit: number; usage: number; percentage: number };
  totalAssetsCount: number;
  blurryCount: number;
  pickedCount?: number;
  rejectedCount?: number;
  ratedCount?: number;
  isRestoredSession?: boolean;
  onClearCatalog?: () => void;
  onOpenShortcuts?: () => void;
  onExportBackup?: () => void;
  onImportBackup?: () => void;
  onCreateFolder?: () => void;
  onDismountFolder?: (folderId: string) => void;
  activeCommonFolder?: string | null;
  onSelectCommonFolder?: (folder: string, folderPath?: string) => void;
  storageTab?: 'cloud' | 'photos' | 'local';
  onSelectStorageTab?: (tab: 'cloud' | 'photos' | 'local') => void;
  onOpenCloudFileManager?: () => void;
  onOpenDriveBrowser?: () => void;
  onOpenGooglePhotos?: () => void;
  photosCount?: number;
  onOpenStorageSettings?: () => void;
  onOpenLogs?: () => void;
  onOpenEcosystemHub?: () => void;
  scanStatus?: {
    phase: string;
    progress: number;
    count: number;
    rate: number;
    message: string;
  };
  onCancelScan?: () => void;
}

export const StorageSidebar: React.FC<StorageSidebarProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onImportLocalFolder,
  onImportFiles,
  onOpenLocalFileManager,
  storageTab: controlledStorageTab,
  onSelectStorageTab,
  onOpenCloudFileManager,
  onOpenDriveBrowser,
  onOpenGooglePhotos,
  photosCount = 0,
  onScanDrive,
  onDeepScan,
  isCollapsed = false,
  onToggleCollapse,
  onSyncChanges,
  hasChangesSnapshot,
  isScanning,
  scanType,
  cloudConnected,
  driveQuota,
  totalAssetsCount,
  blurryCount,
  pickedCount = 0,
  rejectedCount = 0,
  ratedCount = 0,
  isRestoredSession = false,
  onClearCatalog,
  onOpenShortcuts,
  onExportBackup,
  onImportBackup,
  onCreateFolder,
  onDismountFolder,
  activeCommonFolder,
  onSelectCommonFolder,
  onOpenStorageSettings,
  onOpenLogs,
  onOpenEcosystemHub,
  scanStatus,
  onCancelScan,
  onSelectSmartCollection,
  activeSmartQuery,
}) => {
  const { t } = useTranslation();
  const [internalStorageTab, setInternalStorageTab] = useState<'cloud' | 'photos' | 'local'>('cloud');
  const [smartCollections] = useState<SmartCollection[]>(() => loadSmartCollections());
  const activeTab = controlledStorageTab ?? internalStorageTab;

  const handleSwitchTab = (tab: 'cloud' | 'photos' | 'local') => {
    setInternalStorageTab(tab);
    if (onSelectStorageTab) onSelectStorageTab(tab);
    if (tab === 'cloud' && onOpenCloudFileManager) {
      onOpenCloudFileManager();
    } else if (tab === 'photos' && onOpenGooglePhotos) {
      onOpenGooglePhotos();
    } else if (tab === 'local' && onOpenLocalFileManager) {
      onOpenLocalFileManager();
    }
  };

  const [osCommonLocations, setOsCommonLocations] = useState<Array<{ id: string; name: string; path: string; icon: string }>>([]);

  useEffect(() => {
    fetch('/api/fs/quick-access')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.locations)) {
          const userFolders = data.locations.filter((l: any) => l.id !== 'root' && l.id !== 'home');
          setOsCommonLocations(userFolders.slice(0, 6));
        }
      })
      .catch(() => {});
  }, []);

  const formatGB = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(1);
  const quotaPercent = driveQuota ? driveQuota.percentage : cloudConnected ? 15 : 0;
  const quotaText = driveQuota && driveQuota.limit > 0
    ? `${formatGB(driveQuota.usage)} GB / ${formatGB(driveQuota.limit)} GB`
    : cloudConnected
    ? t('dashboard.checkingDrive')
    : t('dashboard.notConnected');

  if (isCollapsed) {
    return null;
  }

  return (
    <nav
      className="w-72 shrink-0 bg-transparent border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col h-full min-h-0 overflow-hidden p-4 sidebar-container transition-[width,padding] duration-300 ease-out"
      aria-label="Storage Navigation"
    >
      {/* 1. COMPACT STICKY TOP BAR (Storage Header + Cloud/Local Switcher only) */}
      <div className="shrink-0 space-y-2.5 pb-3 border-b border-slate-200/60 dark:border-slate-800/80">
        {/* Storage Section Header & Mode Switcher */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 rounded-xl sidebar-opaque-card border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <h2 className="text-[11px] font-bold tracking-wider uppercase text-hint-inline" style={{ color: 'var(--theme-text)' }}>
              {t('dashboard.storage')}
            </h2>
            <div className="flex items-center gap-1.5">
              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-500"
                  title="Collapse Sidebar (B)"
                  aria-label="Collapse Sidebar"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Cloud / Photos / Local 3-Tab Segmented Switcher */}
          <div className="grid grid-cols-3 gap-0.5 p-1 rounded-xl segmented-switcher-container sidebar-opaque-card border border-slate-200/80 dark:border-slate-800 text-xs font-semibold shadow-xs">
            <button
              onClick={() => handleSwitchTab('cloud')}
              data-active={activeTab === 'cloud'}
              className={`segmented-tab-btn min-h-[40px] py-1.5 px-1.5 rounded-lg flex items-center justify-center gap-1 min-w-0 transition-colors ${
                activeTab === 'cloud'
                  ? 'bg-[#1074B1] text-white shadow-xs font-bold'
                  : 'ui-card-meta hover:text-[#1074B1]'
              }`}
              aria-pressed={activeTab === 'cloud'}
              title="Switch to Google Drive Storage"
            >
              <Cloud className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate text-[11px]">Drive</span>
            </button>
            <button
              onClick={() => handleSwitchTab('photos')}
              data-active={activeTab === 'photos'}
              className={`segmented-tab-btn min-h-[40px] py-1.5 px-1.5 rounded-lg flex items-center justify-center gap-1 min-w-0 transition-colors ${
                activeTab === 'photos'
                  ? 'bg-[#A61B7A] text-white shadow-xs font-bold'
                  : 'ui-card-meta hover:text-[#A61B7A]'
              }`}
              aria-pressed={activeTab === 'photos'}
              title="Switch to Google Photos Storage"
            >
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate text-[11px]">Photos</span>
            </button>
            <button
              onClick={() => handleSwitchTab('local')}
              data-active={activeTab === 'local'}
              className={`segmented-tab-btn min-h-[40px] py-1.5 px-1.5 rounded-lg flex items-center justify-center gap-1 min-w-0 transition-colors ${
                activeTab === 'local'
                  ? 'bg-[#52B197] text-white shadow-xs font-bold'
                  : 'ui-card-meta hover:text-[#52B197]'
              }`}
              aria-pressed={activeTab === 'local'}
              title="Switch to Local OS Storage"
            >
              <Monitor className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate text-[11px]">Local</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. UNIFIED SCROLLABLE SIDEBAR BODY (Controls + 200+ Folders + Smart Collections) */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar sidebar-scroll-area pr-1 pt-3 space-y-3">
        {/* Session Restore Banner */}
        {isRestoredSession && totalAssetsCount > 0 && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-1.5 truncate">
              <Database className="w-3.5 h-3.5 text-[#52B197] shrink-0" />
              <span className="truncate font-medium text-[11px] text-hint-inline">
                Restored {totalAssetsCount} items
              </span>
            </div>
            {onClearCatalog && (
              <button
                onClick={onClearCatalog}
                className="text-[10px] text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 font-bold ml-1 shrink-0"
                title="Start fresh and clear cached session"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Dynamic Storage View Content */}
        {activeTab === 'cloud' ? (
          <div className="space-y-2">
            {/* Google Drive Quota */}
            <div className="p-2.5 rounded-xl sidebar-opaque-card border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-1.5 font-medium">
                  <Cloud className="w-3.5 h-3.5 text-[#1074B1]" />
                  <span className="text-[11px] font-semibold">{t('storage.googleDrive')}</span>
                </div>
                <span className="font-mono text-[10px] opacity-75 tabular-nums">{quotaPercent}%</span>
              </div>
              <div className="w-full bg-slate-200/60 dark:bg-slate-700/60 h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#1074B1] h-full rounded-full transition-all" style={{ width: `${quotaPercent}%` }} />
              </div>
              <div className="flex justify-between items-center mt-1 text-[10px] opacity-80 tabular-nums">
                <span>{quotaText}</span>
                <span className={cloudConnected ? 'text-emerald-500 font-semibold' : ''}>
                  {cloudConnected ? t('dashboard.active') : t('dashboard.offline')}
                </span>
              </div>
            </div>

            {/* Live Drive Browser Launcher (Browse without full sync) */}
            {onOpenDriveBrowser && (
              <button
                onClick={onOpenDriveBrowser}
                className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-gradient-to-r from-[#1074B1] to-[#403993] text-white text-xs font-bold shadow-sm hover:opacity-95 active:scale-[0.99] flex items-center justify-center gap-2 transition-all focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                title="Browse Google Drive folders and files live without syncing, and cherry-pick items to sync"
              >
                <FolderOpen className="w-4 h-4 shrink-0" />
                <span className="truncate">Browse Drive (No Sync)</span>
              </button>
            )}

            {/* Cloud Scan Actions */}
            {cloudConnected ? (
              <div className="space-y-1.5">
                {isScanning ? (
                  <div className="w-full min-h-[36px] py-1.5 px-3 rounded-xl bg-[#1074B1]/10 text-[#1074B1] text-xs font-semibold flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('dashboard.catalogingActive')}</span>
                  </div>
                ) : null}
                {hasChangesSnapshot && onSyncChanges ? (
                  <button
                    onClick={onSyncChanges}
                    className="w-full min-h-[40px] py-1.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{t('dashboard.syncFast')}</span>
                  </button>
                ) : null}

                <button
                  onClick={onDeepScan || onScanDrive}
                  disabled={isScanning}
                  className="w-full min-h-[40px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border shadow-sm bg-gradient-to-r from-[#1074B1]/10 via-[#403993]/10 to-[#52B197]/15 hover:from-[#1074B1]/20 hover:to-[#52B197]/25 text-[#1074B1] dark:text-[#67b7e6] border-[#1074B1]/30 active:scale-[0.99]"
                  title="Scan entire Google Drive recursively without item limits"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t('dashboard.deepScanDrive')}</span>
                </button>

                <button
                  onClick={onScanDrive}
                  disabled={isScanning}
                  className="w-full min-h-[38px] py-1.5 px-2.5 rounded-lg sidebar-opaque-card border border-slate-200/80 dark:border-slate-800 text-xs font-semibold ui-card-title flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>{t('dashboard.quickScan')}</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : activeTab === 'photos' ? (
          /* Google Photos Tab Content */
          <div className="space-y-2">
            <div className="p-2.5 rounded-xl sidebar-opaque-card border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-medium">
                  <Camera className="w-3.5 h-3.5 text-[#A61B7A]" />
                  <span className="text-[11px] font-semibold">Google Photos</span>
                </div>
                <span className="font-mono text-[10px] opacity-75 tabular-nums">{photosCount} items</span>
              </div>
              <div className="flex justify-between items-center text-[10px] opacity-80">
                <span>Picker API & Takeout</span>
                <span className={cloudConnected ? 'text-emerald-500 font-semibold' : ''}>
                  {cloudConnected ? t('dashboard.active') : 'Offline / Takeout'}
                </span>
              </div>
            </div>

            {onOpenGooglePhotos && (
              <button
                onClick={onOpenGooglePhotos}
                className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-gradient-to-r from-[#A61B7A] to-[#1074B1] text-white text-xs font-bold shadow-sm hover:opacity-95 active:scale-[0.99] flex items-center justify-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-[#A61B7A]"
                title="Open Google Photos Timeline, Picker & Takeout Studio"
              >
                <Camera className="w-4 h-4 shrink-0" />
                <span className="truncate">Open Photos Studio</span>
              </button>
            )}
          </div>
        ) : (
          /* Local Computer Tab Content */
          <div className="space-y-2">
            {/* Primary Action: Launch Native Local File Manager */}
            {onOpenLocalFileManager && (
              <button
                onClick={onOpenLocalFileManager}
                className="w-full min-h-[42px] py-2 px-3 rounded-xl bg-gradient-to-r from-[#52B197] to-[#1074B1] text-white text-xs font-bold shadow-sm hover:opacity-95 active:scale-[0.99] flex items-center justify-center gap-2 transition-all focus-visible:outline-2 focus-visible:outline-[#52B197]"
                title="Open native local file manager to browse your computer's folders"
              >
                <FolderOpen className="w-4 h-4" />
                <span>{t('dashboard.browseComputer')}</span>
              </button>
            )}

            {/* Quick Access Shortcuts (Real OS Locations) */}
            <div className="p-2.5 rounded-xl sidebar-opaque-card border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs shadow-xs">
              <span className="text-[10px] uppercase font-bold opacity-75 block tracking-wider">
                {t('dashboard.commonFolders')}
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                {osCommonLocations.length > 0 ? (
                  osCommonLocations.map((loc) => {
                    const isSelected = activeCommonFolder === loc.name || activeCommonFolder === loc.id;
                    const renderLocationIcon = () => {
                      switch (loc.icon) {
                        case 'Image': return <ImageIcon className="w-3.5 h-3.5 text-[#1074B1] shrink-0" />;
                        case 'Download': return <Download className="w-3.5 h-3.5 text-[#52B197] shrink-0" />;
                        case 'FileText': return <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
                        case 'Monitor': return <Monitor className="w-3.5 h-3.5 text-[#403993] shrink-0" />;
                        case 'Video': return <Video className="w-3.5 h-3.5 text-sky-500 shrink-0" />;
                        case 'Music': return <Music className="w-3.5 h-3.5 text-violet-500 shrink-0" />;
                        case 'Cloud': return <Cloud className="w-3.5 h-3.5 text-sky-500 shrink-0" />;
                        default: return <Folder className="w-3.5 h-3.5 text-[#1074B1] shrink-0" />;
                      }
                    };
                    return (
                      <button
                        key={loc.id}
                        onClick={() =>
                          onSelectCommonFolder
                            ? onSelectCommonFolder(loc.name, loc.path)
                            : onOpenLocalFileManager?.()
                        }
                        className={`min-h-[34px] p-1.5 rounded-lg text-left truncate flex items-center gap-1.5 border transition-colors sidebar-opaque-card ${
                          isSelected
                            ? 'ring-2 ring-[#1074B1] font-bold shadow-xs'
                            : 'border-slate-200/60 dark:border-slate-700/60 hover:border-[#1074B1]'
                        }`}
                        title={loc.path}
                      >
                        {renderLocationIcon()}
                        <span className="truncate">{loc.name}</span>
                      </button>
                    );
                  })
                ) : (
                  <>
                    <button
                      onClick={() => onSelectCommonFolder ? onSelectCommonFolder('Pictures') : onOpenLocalFileManager?.()}
                      className={`min-h-[34px] p-1.5 rounded-lg text-left truncate flex items-center gap-1.5 border transition-colors sidebar-opaque-card ${
                        activeCommonFolder === 'Pictures'
                          ? 'ring-2 ring-[#1074B1] font-bold shadow-xs'
                          : 'border-slate-200/60 dark:border-slate-700/60 hover:border-[#1074B1]'
                      }`}
                      title="Pictures folder"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-[#1074B1] shrink-0" />
                      <span className="truncate">{t('dashboard.folderPictures')}</span>
                    </button>
                    <button
                      onClick={() => onSelectCommonFolder ? onSelectCommonFolder('Downloads') : onOpenLocalFileManager?.()}
                      className={`min-h-[34px] p-1.5 rounded-lg text-left truncate flex items-center gap-1.5 border transition-colors sidebar-opaque-card ${
                        activeCommonFolder === 'Downloads'
                          ? 'ring-2 ring-[#1074B1] font-bold shadow-xs'
                          : 'border-slate-200/60 dark:border-slate-700/60 hover:border-[#1074B1]'
                      }`}
                      title="Downloads folder"
                    >
                      <Download className="w-3.5 h-3.5 text-[#52B197] shrink-0" />
                      <span className="truncate">{t('dashboard.folderDownloads')}</span>
                    </button>
                    <button
                      onClick={() => onSelectCommonFolder ? onSelectCommonFolder('Documents') : onOpenLocalFileManager?.()}
                      className={`min-h-[34px] p-1.5 rounded-lg text-left truncate flex items-center gap-1.5 border transition-colors sidebar-opaque-card ${
                        activeCommonFolder === 'Documents'
                          ? 'ring-2 ring-[#1074B1] font-bold shadow-xs'
                          : 'border-slate-200/60 dark:border-slate-700/60 hover:border-[#1074B1]'
                      }`}
                      title="Documents folder"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{t('dashboard.folderDocuments')}</span>
                    </button>
                    <button
                      onClick={() => onSelectCommonFolder ? onSelectCommonFolder('Desktop') : onOpenLocalFileManager?.()}
                      className={`min-h-[34px] p-1.5 rounded-lg text-left truncate flex items-center gap-1.5 border transition-colors sidebar-opaque-card ${
                        activeCommonFolder === 'Desktop'
                          ? 'ring-2 ring-[#1074B1] font-bold shadow-xs'
                          : 'border-slate-200/60 dark:border-slate-700/60 hover:border-[#1074B1]'
                      }`}
                      title="Desktop folder"
                    >
                      <Monitor className="w-3.5 h-3.5 text-[#403993] shrink-0" />
                      <span className="truncate">{t('dashboard.folderDesktop')}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Import Local Folder to Catalog */}
            <button
              onClick={onImportLocalFolder}
              className="w-full min-h-[34px] py-1.5 px-3 rounded-xl sidebar-opaque-card border border-slate-200/80 dark:border-slate-800 hover:border-[#1074B1] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              title="Import a local directory directly into the persistent catalog"
            >
              <FolderPlus className="w-3.5 h-3.5 text-[#52B197]" />
              <span>{t('dashboard.importFolder')}</span>
            </button>
          </div>
        )}

        {/* Google Workspace Ecosystem Hub Trigger */}
        {onOpenEcosystemHub && (
          <button
            onClick={onOpenEcosystemHub}
            className="w-full min-h-[38px] py-1.5 px-3 rounded-xl bg-gradient-to-r from-[#403993]/15 via-[#1074B1]/15 to-[#52B197]/15 border border-[#1074B1]/30 hover:border-[#1074B1] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ui-card-title"
            title="Open Google Workspace Hub (Keep Notes, Gmail Media Harvester, Tasks & Contacts)"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#1074B1]" />
            <span>Keep · Gmail · Tasks Hub</span>
          </button>
        )}

        {/* Utility Actions Row: Backup, Restore & Shortcuts */}
        <div className="flex items-center gap-1.5 pt-0.5">
          {onExportBackup && (
            <button
              onClick={onExportBackup}
              className="flex-1 min-h-[36px] py-1.5 px-2 rounded-lg sidebar-opaque-card border border-slate-200/80 dark:border-slate-800 hover:border-[var(--theme-accent,#1074B1)] hover:text-[var(--theme-accent,#1074B1)] text-[11px] font-semibold ui-card-title flex items-center justify-center gap-1 transition-all shadow-2xs hover:shadow-xs"
              title="Export complete catalog backup (.dtbackup JSON)"
            >
              <span>{t('dashboard.backup')}</span>
            </button>
          )}

          {onImportBackup && (
            <button
              onClick={onImportBackup}
              className="flex-1 min-h-[36px] py-1.5 px-2 rounded-lg sidebar-opaque-card border border-slate-200/80 dark:border-slate-800 hover:border-[var(--theme-accent,#1074B1)] hover:text-[var(--theme-accent,#1074B1)] text-[11px] font-semibold ui-card-title flex items-center justify-center gap-1 transition-all shadow-2xs hover:shadow-xs"
              title="Restore catalog from .dtbackup JSON"
            >
              <span>{t('dashboard.restore')}</span>
            </button>
          )}

          {onOpenShortcuts && (
            <button
              onClick={onOpenShortcuts}
              className="min-h-[36px] py-1.5 px-2 rounded-lg sidebar-opaque-card border border-slate-200/80 dark:border-slate-800 hover:border-[var(--theme-accent,#1074B1)] hover:text-[var(--theme-accent,#1074B1)] text-[11px] font-semibold ui-card-title flex items-center justify-center gap-1 transition-all shadow-2xs hover:shadow-xs"
              title="Keyboard Shortcuts (?)"
            >
              <span>{t('dashboard.keys')}</span>
              <kbd className="px-1 rounded bg-black/10 dark:bg-white/10 border border-current text-[9px] font-mono">?</kbd>
            </button>
          )}
        </div>

        {/* Compact Storage Overview & Photo Review Ledger */}
        {blurryCount > 0 && (
          <div className="p-2 rounded-xl sidebar-opaque-card border border-[#A61B7A]/40 flex items-center gap-1.5 text-[11px] shadow-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-[#A61B7A] dark:text-[#f485d1] shrink-0" />
            <span className="font-semibold text-[#A61B7A] dark:text-[#f485d1]">
              {t('dashboard.blurryFramesFound', { count: blurryCount })}
            </span>
          </div>
        )}

        {totalAssetsCount > 0 && (
          <div className="p-2 rounded-xl sidebar-opaque-card border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[10px] shadow-xs">
            <span className="text-[10px] uppercase font-bold ui-card-meta">
              {t('dashboard.cullingProgress')}:
            </span>
            <div className="flex items-center gap-2 font-mono font-bold tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400">✓ {pickedCount}</span>
              <span className="text-rose-600 dark:text-rose-400">✕ {rejectedCount}</span>
              <span className="text-[#8a8b29] dark:text-[#dcdd7a]">★ {ratedCount}</span>
            </div>
          </div>
        )}

        {/* FOLDER DIRECTORY TREE */}
        <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between sticky top-0 sidebar-opaque-card py-1.5 px-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 z-10 shadow-xs mb-1">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-hint-inline ui-card-title">
            {(() => {
              const res = t('dashboard.folders');
              return (!res || res === 'dashboard.folders') ? (t('localManager.foldersHeader') || 'Folders') : res;
            })()}
          </h3>
          <span className="text-[11px] text-[var(--theme-accent)] font-mono font-bold tabular-nums">{folders.length}</span>
        </div>

        <div className="space-y-1.5">
          {folders.map((folder) => {
            const isSelected = selectedFolderId === folder.id;
            const isLocalDismountable = folder.source === 'local' && folder.id !== 'folder_all' && folder.id !== 'recent';
            const folderDisplayName = folder.name === 'All Media'
              ? t('dashboard.allMedia')
              : folder.name === 'Recent' || folder.name === 'Recent Captures'
              ? t('dashboard.recentCaptures')
              : folder.name === 'Trash'
              ? t('dashboard.trash')
              : folder.name;

            return (
              <div
                key={folder.id}
                className={`group w-full rounded-xl text-xs flex items-center justify-between transition-all min-h-[42px] sidebar-opaque-card border ${
                  isSelected
                    ? 'border-[var(--theme-accent,#1074B1)] bg-[var(--theme-accent,#1074B1)]/15 font-bold shadow-xs ring-1 ring-[var(--theme-accent,#1074B1)]'
                    : 'border-slate-200/60 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <button
                  onClick={() => onSelectFolder(folder.id)}
                  className="flex-1 min-h-[40px] text-left px-2.5 py-1.5 flex items-center gap-2 min-w-0 focus-visible:ring-2 focus-visible:ring-[#1074B1] rounded-l-xl"
                  title={folder.path}
                >
                  {folder.source === 'cloud' ? (
                    <Cloud className="w-3.5 h-3.5 text-[#1074B1] shrink-0" />
                  ) : (
                    <HardDrive className="w-3.5 h-3.5 text-[#52B197] shrink-0" />
                  )}
                  <span className="truncate text-xs font-semibold ui-card-title">{folderDisplayName}</span>
                </button>
                <div className="flex items-center gap-1 pr-2.5 shrink-0">
                  <span className="font-mono text-[11px] ui-card-meta tabular-nums">
                    {folder.itemCount}
                  </span>
                  {isLocalDismountable && onDismountFolder && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Dismount local folder "${folder.name}" and release memory blobs?`)) {
                          onDismountFolder(folder.id);
                        }
                      }}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                      title={`Dismount ${folder.name} (releases local memory)`}
                      aria-label={`Dismount ${folder.name}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>

        {/* 3. SMART COLLECTIONS DYNAMIC ALBUMS */}
        <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between py-1 px-2.5 rounded-xl sidebar-opaque-card border border-slate-200/80 dark:border-slate-800 shadow-xs mb-1">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-hint-inline" style={{ color: 'var(--theme-text)' }}>
              {t('sidebar.smartCollections') || 'Smart Collections'}
            </h3>
            <span className="text-[10px] text-[#EAB308] font-mono font-bold">{smartCollections.length}</span>
          </div>

          <div className="space-y-1">
            {smartCollections.map((col) => {
              const isColActive = activeSmartQuery === col.query;
              const colTitle =
                col.id === 'sc_five_stars'
                  ? t('smartCollections.fiveStars') || col.name
                  : col.id === 'sc_raw_bursts'
                  ? t('smartCollections.rawBursts') || col.name
                  : col.id === 'sc_picked_heros'
                  ? t('smartCollections.pickedHeros') || col.name
                  : col.id === 'sc_large_files'
                  ? t('smartCollections.heavyFiles') || col.name
                  : col.name;

              return (
                <button
                  key={col.id}
                  onClick={() => onSelectSmartCollection?.(col.query)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-all sidebar-opaque-card border ${
                    isColActive
                      ? 'border-[#EAB308] bg-[#EAB308]/15 font-bold shadow-xs'
                      : 'border-slate-200/60 dark:border-slate-800/60 hover:border-[#EAB308]/50 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  title={`Smart Collection: ${colTitle} (${col.query})`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Star className="w-3.5 h-3.5 text-[#EAB308] shrink-0 fill-current" />
                    <span className="truncate">{colTitle}</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-50 shrink-0">{col.query}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};
