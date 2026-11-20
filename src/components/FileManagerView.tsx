/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * File Manager & Media Grid/List View (Attachment 1 Architecture)
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from '../i18n';
import {
  LayoutGrid,
  List,
  Cloud,
  HardDrive,
  Star,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  Sparkles,
  Camera,
  Play,
  Volume2,
  RefreshCw,
  Terminal,
  MoreVertical,
} from 'lucide-react';
import { MediaAsset, CullingStatus } from '../types';
import { MediaHoverScrubber } from './MediaHoverScrubber';

interface FileManagerViewProps {
  assets: MediaAsset[];
  selectedAssetId?: string;
  onSelectAsset: (asset: MediaAsset) => void;
  onDoubleClickAsset?: (asset: MediaAsset) => void;
  onContextMenu?: (asset: MediaAsset, e: React.MouseEvent) => void;
  onUpdateCulling: (id: string, status: CullingStatus) => void;
  onUpdateRating: (id: string, rating: number) => void;
  onDownloadAsset: (asset: MediaAsset) => void;
  onAnalyzeAsset: (asset: MediaAsset) => void;
  onScanDrive?: () => void;
  onIndexActiveFolder?: () => void;
  activeFolderName?: string;
  activeCategory?: string;
  activeQuery?: string;
  onClearFilter?: () => void;
  isScanning?: boolean;
  cloudConnected?: boolean;
  scanStatus?: {
    phase: string;
    progress: number;
    count: number;
    rate: number;
    message: string;
  };
  onCancelScan?: () => void;
  onOpenLogs?: () => void;
}

export const FileManagerView: React.FC<FileManagerViewProps> = ({
  assets,
  selectedAssetId,
  onSelectAsset,
  onDoubleClickAsset,
  onContextMenu,
  onUpdateCulling,
  onUpdateRating,
  onDownloadAsset,
  onAnalyzeAsset,
  onScanDrive,
  onIndexActiveFolder,
  activeFolderName,
  activeCategory,
  activeQuery,
  onClearFilter,
  isScanning = false,
  cloudConnected = false,
  scanStatus,
  onCancelScan,
  onOpenLogs,
}) => {
  const { t } = useTranslation();
  const [viewStyle, setViewStyle] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size' | 'sharpness'>('date');
  const [visibleCount, setVisibleCount] = useState(60);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [scrubbingAssetId, setScrubbingAssetId] = useState<string | null>(null);
  const [scrubPercent, setScrubPercent] = useState<number>(0);

  const handleDownload = async (asset: MediaAsset, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingId(asset.id);
    try {
      await onDownloadAsset(asset);
    } finally {
      setTimeout(() => setDownloadingId((prev) => (prev === asset.id ? null : prev)), 2000);
    }
  };

  const sortedAssets = useMemo(() => {
    return [...assets].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'size') return b.sizeBytes - a.sizeBytes;
      if (sortBy === 'sharpness') return (b.quality?.sharpness || 0) - (a.quality?.sharpness || 0);
      return new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime();
    });
  }, [assets, sortBy]);

  const displayedAssets = useMemo(() => {
    return sortedAssets.slice(0, visibleCount);
  }, [sortedAssets, visibleCount]);

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  return (
    <div className="space-y-4">
      {/* Stage Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {t('catalog.title')}
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {t('catalog.itemsCount', { count: assets.length })}
          </span>

          {/* Targeted Active Folder Index Action */}
          {activeFolderName && onIndexActiveFolder && cloudConnected && (
            <button
              onClick={onIndexActiveFolder}
              disabled={isScanning}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[#52B197] ${
                isScanning
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 animate-pulse'
                  : 'bg-[#52B197]/10 hover:bg-[#52B197]/20 border-[#52B197]/30 text-[#2b7762] dark:text-[#52B197] active:scale-[0.98]'
              }`}
              title={`Index only files inside folder "${activeFolderName}"`}
            >
              <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? t('catalog.scanning') : t('catalog.indexFolderOnly', { name: activeFolderName })}</span>
            </button>
          )}

          {/* Full Deep Scan Action */}
          {onScanDrive && cloudConnected && (
            <button
              onClick={onScanDrive}
              disabled={isScanning}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[#1074B1] ${
                isScanning
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 animate-pulse'
                  : 'bg-[#1074B1]/10 hover:bg-[#1074B1]/20 border-[#1074B1]/30 text-[#1074B1] dark:text-[#67b7e6] active:scale-[0.98]'
              }`}
              title="Deep scan Google Drive for all media streams without item limits"
            >
              <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? t('catalog.scanning') : t('catalog.deepScan')}</span>
            </button>
          )}
        </div>

        {/* View Controls & Sorters */}
        <div className="flex items-center gap-3">
          {/* Sorter */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#1074B1]"
          >
            <option value="date">{t('catalog.sortRecent')}</option>
            <option value="sharpness">{t('catalog.sortSharpest')}</option>
            <option value="name">{t('catalog.sortName')}</option>
            <option value="size">{t('catalog.sortSize')}</option>
          </select>

          {/* Grid vs List Toggle */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewStyle('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewStyle === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-[#1074B1] shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title={t('catalog.gridView')}
              aria-label={t('catalog.gridView')}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewStyle('list')}
              className={`p-1.5 rounded-md transition-colors ${
                viewStyle === 'list'
                  ? 'bg-white dark:bg-slate-700 text-[#1074B1] shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title={t('catalog.listView')}
              aria-label={t('catalog.listView')}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Active Filter Chips Bar */}
      {(Boolean(activeQuery) || (activeCategory && activeCategory !== 'all') || activeFolderName) && (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
          <span className="text-slate-400 font-medium text-[11px]">Active Filters:</span>
          {activeFolderName && (
            <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 text-[#1074B1] font-semibold text-[11px] border border-slate-200/80 dark:border-slate-600 flex items-center gap-1">
              📁 {activeFolderName}
            </span>
          )}
          {activeCategory && activeCategory !== 'all' && (
            <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 text-[#1074B1] font-semibold text-[11px] border border-slate-200/80 dark:border-slate-600 flex items-center gap-1 uppercase">
              🏷️ {activeCategory}
            </span>
          )}
          {activeQuery && (
            <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-[11px] border border-slate-200/80 dark:border-slate-600 flex items-center gap-1">
              🔍 "{activeQuery}"
            </span>
          )}
          {onClearFilter && (
            <button
              onClick={onClearFilter}
              className="ml-auto text-[11px] font-semibold text-[#1074B1] hover:underline"
            >
              Clear All
            </button>
          )}
        </div>
      )}

      {/* Empty State when no assets match filters */}
      {displayedAssets.length === 0 ? (
        <div className="py-12 px-4 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 theme-card">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">No media items found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            No items match the active category, folder, or search query filter. Try clearing filters or selecting another category.
          </p>
          {onClearFilter && (
            <button
              onClick={onClearFilter}
              className="mt-2 px-3 py-1.5 rounded-xl bg-[#1074B1] text-white text-xs font-semibold hover:opacity-95"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : viewStyle === 'grid' ? (
        <div className="drive-files-grid">
          {displayedAssets.map((asset) => {
            const isSelected = selectedAssetId === asset.id;
            return (
              <article
                key={asset.id}
                onClick={() => onSelectAsset(asset)}
                onDoubleClick={() => onDoubleClickAsset?.(asset)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onContextMenu?.(asset, e);
                }}
                className={`group relative rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer theme-card file-card flex flex-col ${
                  isSelected
                    ? 'border-[#1074B1] ring-2 ring-[#1074B1]/30 shadow-md'
                    : 'hover:border-[#1074B1]/70 hover:shadow-sm'
                }`}
              >
                {/* Media Image / Live Video & Audio Hover Scrubber */}
                <div className="relative">
                  <MediaHoverScrubber asset={asset} />

                  {/* Clean 2.5px Culling Accent Line at bottom edge */}
                  {asset.cullingStatus === 'picked' && (
                    <div className="absolute bottom-0 inset-x-0 h-[2.5px] bg-[#52B197] z-10" />
                  )}
                  {asset.cullingStatus === 'rejected' && (
                    <div className="absolute bottom-0 inset-x-0 h-[2.5px] bg-[#A61B7A] z-10" />
                  )}
                </div>

                {/* Card Details (All metadata & badges positioned cleanly below image) */}
                <div className="p-3.5 flex-1 flex flex-col justify-between gap-2">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold ui-card-title line-clamp-2 min-h-[2.4rem] mb-1.5" title={asset.name}>
                      {asset.name}
                    </h3>

                    {/* Clean Metadata Pill Strip */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono ui-card-meta">
                      <span
                        className={`px-1.5 py-0.5 rounded-md font-bold inline-flex items-center gap-1 shrink-0 ${
                          asset.source === 'cloud'
                            ? 'bg-[#1074B1]/15 text-[#1074B1] dark:text-[#67b7e6]'
                            : 'bg-[#52B197]/15 text-[#52B197] dark:text-[#8ee1cc]'
                        }`}
                        title={asset.source === 'cloud' ? 'Google Drive' : 'Local Computer'}
                      >
                        {asset.source === 'cloud' ? <Cloud className="w-3 h-3" /> : <HardDrive className="w-3 h-3" />}
                        <span>{asset.extension}</span>
                      </span>

                      <span>{formatSize(asset.sizeBytes)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{asset.exif.dimensions || 'Image'}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={asset.quality.isBlurry ? 'text-[#A61B7A] font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}
                        title={`Sharpness: ${asset.quality.sharpness}%`}
                      >
                        {asset.quality.sharpness}%
                      </span>

                      {asset.cullingStatus === 'picked' && (
                        <span className="px-1.5 py-0.5 rounded bg-[#52B197]/15 text-[#52B197] font-bold text-[10px] inline-flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Picked
                        </span>
                      )}
                      {asset.cullingStatus === 'rejected' && (
                        <span className="px-1.5 py-0.5 rounded bg-[#A61B7A]/15 text-[#A61B7A] font-bold text-[10px] inline-flex items-center gap-0.5">
                          <XCircle className="w-3 h-3" /> Rejected
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Star Rating & Card Actions Toolbar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-800/80 gap-1">
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateRating(asset.id, asset.rating === star ? 0 : star);
                          }}
                          className="min-h-[32px] min-w-[24px] flex items-center justify-center hover:scale-110 transition-transform"
                          title={`Rate ${star} stars`}
                          aria-label={`Rate ${star} stars`}
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              star <= asset.rating
                                ? 'text-[#BEBF61] fill-[#BEBF61]'
                                : 'opacity-45 ui-card-meta'
                            }`}
                          />
                        </button>
                      ))}
                    </div>

                    {/* Quick Action Toolbar */}
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAnalyzeAsset(asset);
                        }}
                        className="min-h-[34px] min-w-[34px] p-1.5 rounded-lg ui-card-meta hover:text-[#1074B1] hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center"
                        title="Run AI Vision & Face Detection"
                        aria-label="Run AI Vision & Face Detection"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => handleDownload(asset, e)}
                        className="min-h-[34px] min-w-[34px] p-1.5 rounded-lg ui-card-meta hover:text-[#52B197] hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center"
                        title="Download to Local Computer"
                        aria-label="Download to Local Computer"
                      >
                        {downloadingId === asset.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#52B197]" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateCulling(asset.id, asset.cullingStatus === 'picked' ? 'unrated' : 'picked');
                        }}
                        className={`min-h-[34px] min-w-[34px] p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center ${
                          asset.cullingStatus === 'picked' ? 'text-[#52B197]' : 'ui-card-meta'
                        }`}
                        title="Pick / Keep (Hotkey: P)"
                        aria-label="Pick / Keep"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateCulling(asset.id, asset.cullingStatus === 'rejected' ? 'unrated' : 'rejected');
                        }}
                        className={`min-h-[34px] min-w-[34px] p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center ${
                          asset.cullingStatus === 'rejected' ? 'text-[#A61B7A]' : 'ui-card-meta'
                        }`}
                        title="Reject / Dim (Hotkey: X)"
                        aria-label="Reject / Dim"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>

                      {onContextMenu && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onContextMenu(asset, e);
                          }}
                          className="min-h-[34px] min-w-[34px] p-1.5 ui-card-meta hover:text-[#1074B1] rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center"
                          title="More options (Right-click)"
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
      ) : (
        /* List Mode (Tabular High-Density) */
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xs theme-card">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px]">
                <th className="py-2.5 px-3">Item</th>
                <th className="py-2.5 px-3">Source</th>
                <th className="py-2.5 px-3">Resolution / EXIF</th>
                <th className="py-2.5 px-3">Size</th>
                <th className="py-2.5 px-3">Quality</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {displayedAssets.map((asset) => {
                const isSelected = selectedAssetId === asset.id;
                return (
                  <tr
                    key={asset.id}
                    onClick={() => onSelectAsset(asset)}
                    onDoubleClick={() => onDoubleClickAsset?.(asset)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onContextMenu?.(asset, e);
                    }}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#1074B1]/5 dark:bg-[#1074B1]/10' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 flex items-center gap-3">
                      <img
                        src={asset.thumbnailUrl}
                        alt=""
                        className="w-9 h-9 rounded-lg object-cover shrink-0"
                      />
                      <div className="truncate max-w-[200px]">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate">
                          {asset.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(asset.modifiedTime).toLocaleDateString()}
                        </span>
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          asset.source === 'cloud'
                            ? 'bg-[#1074B1]/10 text-[#1074B1]'
                            : 'bg-[#52B197]/10 text-[#52B197]'
                        }`}
                      >
                        {asset.source === 'cloud' ? (
                          <Cloud className="w-3 h-3" />
                        ) : (
                          <HardDrive className="w-3 h-3" />
                        )}
                        <span>{asset.source === 'cloud' ? 'Google Drive' : 'Local OS'}</span>
                      </span>
                    </td>

                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                      <div>{asset.exif.dimensions || 'Standard'}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                        {asset.exif.camera || asset.category.toUpperCase()}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 font-mono text-slate-500">
                      {formatSize(asset.sizeBytes)}
                    </td>

                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          asset.quality.isBlurry
                            ? 'bg-[#A61B7A]/15 text-[#A61B7A]'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {asset.quality.sharpness}% sharp
                      </span>
                    </td>

                    <td className="py-2.5 px-3">
                      {asset.cullingStatus === 'picked' ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3 h-3" /> Picked
                        </span>
                      ) : asset.cullingStatus === 'rejected' ? (
                        <span className="text-[#A61B7A] font-medium flex items-center gap-1 text-[11px]">
                          <XCircle className="w-3 h-3" /> Rejected
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Unrated</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => handleDownload(asset, e)}
                          className="p-1 text-slate-400 hover:text-[#52B197] rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Download"
                          aria-label="Download"
                        >
                          {downloadingId === asset.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-[#52B197]" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                        {onContextMenu && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onContextMenu(asset, e);
                            }}
                            className="p-1 text-slate-400 hover:text-[#1074B1] rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="More options (Right-click)"
                            aria-label="More options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Progressive Windowing / Display Limit Control */}
      {visibleCount < sortedAssets.length && (
        <div className="flex flex-col items-center justify-center gap-2 pt-4 pb-6">
          <button
            onClick={() => setVisibleCount((prev) => prev + 60)}
            className="px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-sm transition-all active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[#1074B1]"
          >
            Show More ({displayedAssets.length} of {sortedAssets.length.toLocaleString()} displayed)
          </button>
          <span className="text-[11px] text-slate-400">
            Progressive rendering keeps the app fast and responsive even with thousands of media items.
          </span>
        </div>
      )}
    </div>
  );
};
