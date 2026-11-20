/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Right Sidebar: Activity Timeline & Media Inspector (Attachment 1 Architecture)
 */

import React, { useState } from 'react';
import { useTranslation } from '../i18n';
import {
  Clock,
  Info,
  Camera,
  Layers,
  Sparkles,
  Cloud,
  HardDrive,
  CheckCircle2,
  XCircle,
  Copy,
  ChevronRight,
  Maximize2,
  Database,
} from 'lucide-react';
import { MediaAsset } from '../types';
import { lookupFileFormat } from '../services/fileFormatEngine';

interface ActivityTimelineDrawerProps {
  selectedAsset: MediaAsset | null;
  recentAssets: MediaAsset[];
  onSelectAsset: (asset: MediaAsset) => void;
  isOpen: boolean;
  onToggle: () => void;
  onOpenFormatDb?: (query?: string) => void;
}

export const ActivityTimelineDrawer: React.FC<ActivityTimelineDrawerProps> = ({
  selectedAsset,
  recentAssets,
  onSelectAsset,
  isOpen,
  onToggle,
  onOpenFormatDb,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'recent' | 'inspector'>('recent');

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-20 wcag-touch-target theme-card border-l border-y p-2.5 rounded-l-xl shadow-md hover:text-[#1074B1] z-10 flex items-center justify-center"
        title="Open Activity & Inspector"
        aria-label="Open Activity and Inspector Drawer"
      >
        <Info className="w-4 h-4 text-[#1074B1]" />
      </button>
    );
  }

  return (
    <aside
      className="w-80 shrink-0 border-l flex flex-col p-4 justify-between overflow-y-auto sidebar-container drawer-container"
      style={{
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text)',
      }}
      aria-label="Activity & Inspector Drawer"
    >
      <div className="space-y-4">
        {/* Top Header & Tab Switcher (Recent vs Inspector) */}
        <div
          className="flex items-center justify-between gap-2 pb-2 sidebar-opaque-card p-2 rounded-2xl border"
          style={{
            backgroundColor: 'var(--theme-surface)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5 text-xs flex-1">
            <button
              onClick={() => setActiveTab('recent')}
              className={`flex-1 min-h-[38px] px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'recent'
                  ? 'bg-[#1074B1] text-white font-bold shadow-xs'
                  : 'ui-card-meta hover:text-[#1074B1]'
              }`}
            >
              {t('timeline.recentFeed')}
            </button>
            <button
              onClick={() => setActiveTab('inspector')}
              className={`flex-1 min-h-[38px] px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'inspector'
                  ? 'bg-[#1074B1] text-white font-bold shadow-xs'
                  : 'ui-card-meta hover:text-[#1074B1]'
              }`}
            >
              {t('timeline.exifDetails')}
            </button>
          </div>

          <button
            onClick={onToggle}
            className="min-h-[40px] min-w-[40px] p-2 rounded-xl ui-card-meta hover:text-[#1074B1] hover:bg-black/5 dark:hover:bg-white/10 text-xs flex items-center justify-center"
            title="Collapse Sidebar"
            aria-label="Collapse Activity Drawer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Tab 1: Recent Activity Timeline (Attachment 1 exact timeline styling) */}
        {activeTab === 'recent' && (
          <div className="space-y-4">
            <div
              className="px-3 py-1.5 rounded-xl border inline-block sidebar-opaque-card"
              style={{
                backgroundColor: 'var(--theme-surface)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--theme-text)' }}>
                {t('timeline.title')}
              </h3>
            </div>

            {/* Timeline Stream */}
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
              {/* Event 1 */}
              <div className="relative">
                <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#1074B1] ring-4 ring-white dark:ring-[#131B2C]" />
                <span
                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md inline-block mb-1.5 sidebar-opaque-card border"
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                >
                  {t('timeline.minuteAgo')}
                </span>

                {/* 3-thumbnail cluster */}
                <div
                  className="p-2.5 rounded-2xl border space-y-2 sidebar-opaque-card theme-card"
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                >
                  <div className="grid grid-cols-3 gap-1.5">
                    {recentAssets.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        onClick={() => onSelectAsset(item)}
                        className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--theme-text)' }}>
                    {t('timeline.editorialBursts', { count: 3 })}
                  </p>
                </div>
              </div>

              {/* Event 2 */}
              <div className="relative">
                <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#52B197] ring-4 ring-white dark:ring-[#131B2C]" />
                <span
                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md inline-block mb-1.5 sidebar-opaque-card border"
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                >
                  13:34
                </span>

                <div
                  className="p-2.5 rounded-2xl border space-y-2 sidebar-opaque-card theme-card"
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                >
                  <div className="grid grid-cols-3 gap-1.5">
                    {recentAssets.slice(3, 6).map((item) => (
                      <div
                        key={item.id}
                        onClick={() => onSelectAsset(item)}
                        className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--theme-text)' }}>
                    {t('timeline.modelSequence', { count: 3 })}
                  </p>
                </div>
              </div>

              {/* Event 3 */}
              <div className="relative">
                <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#BEBF61] ring-4 ring-white dark:ring-[#131B2C]" />
                <span
                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md inline-block mb-1.5 sidebar-opaque-card border"
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                >
                  11:03
                </span>

                <div
                  className="p-2.5 rounded-xl border text-[11px] sidebar-opaque-card theme-card"
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                >
                  <span className="font-semibold block" style={{ color: 'var(--theme-text)' }}>
                    {t('timeline.driveSync')}
                  </span>
                  <span className="opacity-85">{t('timeline.driveSyncDesc')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: EXIF & Asset Inspector */}
        {activeTab === 'inspector' && selectedAsset && (
          <div className="space-y-4">
            {/* Asset Preview Thumbnail */}
            <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-black shadow-xs relative">
              <img
                src={selectedAsset.thumbnailUrl}
                alt={selectedAsset.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-md text-[10px] font-bold">
                {selectedAsset.source === 'cloud' ? (
                  <Cloud className="w-3 h-3 text-[#1074B1]" />
                ) : (
                  <HardDrive className="w-3 h-3 text-[#52B197]" />
                )}
                <span>{selectedAsset.source === 'cloud' ? t('storage.googleDrive') : t('storage.localDrive')}</span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                {selectedAsset.name}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                {selectedAsset.path}
              </p>
            </div>

            {/* Universal File Format Classification & Viewer/Editor Routing Card */}
            {(() => {
              const fmt = lookupFileFormat(selectedAsset.name, selectedAsset.mimeType);
              const meta = (selectedAsset.metadata || {}) as Record<string, string | undefined>;
              return (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                      <Database className="w-3.5 h-3.5 text-[#1074B1]" />
                      <span>Format Registry</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-[#1074B1]/15 text-[#1074B1] dark:text-[#67b7e6] font-mono text-[10px] font-bold">
                      .{selectedAsset.extension || fmt.extension}
                    </span>
                  </div>

                  <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {meta.formatName || fmt.name}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Family</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold truncate block">
                        {meta.family || fmt.family}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Preservation</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold truncate block">
                        {meta.preservationGrade || fmt.preservationGrade}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Viewer</span>
                      <span className="text-emerald-700 dark:text-emerald-300 font-semibold truncate block">
                        {meta.viewer || fmt.viewer}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Editor</span>
                      <span className="text-amber-700 dark:text-amber-300 font-semibold truncate block">
                        {meta.editor || fmt.editor}
                      </span>
                    </div>
                  </div>

                  {onOpenFormatDb && (
                    <button
                      type="button"
                      onClick={() => onOpenFormatDb(selectedAsset.extension || fmt.extension)}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                    >
                      <Database className="w-3.5 h-3.5 text-[#1074B1]" />
                      <span>Browse Format DB</span>
                    </button>
                  )}
                </div>
              );
            })()}

            {/* EXIF Data Strip */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                <Camera className="w-3.5 h-3.5 text-[#1074B1]" />
                <span>{t('inspector.cameraExif')}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">{t('inspector.camera')}</span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold truncate block">
                    {selectedAsset.exif.camera || 'Standard'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{t('inspector.lens')}</span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold truncate block">
                    {selectedAsset.exif.lens || 'Prime'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{t('inspector.aperture')}</span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold">
                    {selectedAsset.exif.aperture || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{t('inspector.shutter')}</span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold">
                    {selectedAsset.exif.shutterSpeed || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{t('inspector.iso')}</span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold">
                    {selectedAsset.exif.iso || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{t('inspector.resolution')}</span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold">
                    {selectedAsset.exif.dimensions || 'Image'}
                  </span>
                </div>
              </div>
            </div>

            {/* Color Thief 5-Swatch Palette */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
              <span className="text-[11px] uppercase font-bold text-slate-500 block">
                {t('inspector.harmonicPalette')}
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {selectedAsset.palette.map((hex, i) => (
                  <div
                    key={i}
                    className="h-6 rounded-md border border-black/10"
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                ))}
              </div>
            </div>

            {/* AI Vision Tags */}
            <div className="space-y-1.5">
              <span className="text-[11px] uppercase font-bold text-slate-500 block">
                {t('inspector.visionTags')}
              </span>
              <div className="flex flex-wrap gap-1">
                {selectedAsset.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inspector' && !selectedAsset && (
          <div className="p-8 text-center text-slate-400 text-xs">
            <Info className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>{t('inspector.noAssetSelected')}</p>
          </div>
        )}
      </div>
    </aside>
  );
};
