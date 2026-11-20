/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unified Comprehensive Context Menu for Google Drive Cloud & Host Local Files
 * Supports right-click and Three-Dots trigger, viewport edge clamping, keyboard accessibility,
 * cloud-native Drive operations, host filesystem operations, and Drive Therapy AI studio superpowers.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  Eye,
  Star,
  Copy,
  FolderInput,
  Download,
  Trash2,
  Share2,
  Sparkles,
  Zap,
  Sliders,
  Play,
  Info,
  CheckCircle2,
  Palette,
  Cloud,
  HardDrive,
  FileText,
  ChevronRight,
  Edit2,
  UploadCloud,
  FileCheck,
  Scissors,
  DownloadCloud,
  BookOpen,
  Headphones,
  FileSpreadsheet,
  Globe,
  Layers as LayersIcon,
  MessageSquare,
  PhoneCall,
  Mail,
  Users,
  Calendar,
  Tv,
  Camera,
  ListMusic,
  Database,
  Edit3,
  Pin,
  Subtitles,
} from 'lucide-react';
import { MediaAsset } from '../types';
import { useTranslation } from '../i18n';
import { getContextMenuSpecForAsset } from '../services/universalFileViewerEngine';

export interface UnifiedContextMenuProps {
  asset: MediaAsset | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onPreview?: (asset: MediaAsset) => void;
  onOpenPip?: (asset: MediaAsset) => void;
  isPipActive?: boolean;
  onOpenEditor?: (asset: MediaAsset) => void;
  onOpenInLightboxEditor?: (asset: MediaAsset) => void;
  onInspectFormatDb?: (asset: MediaAsset) => void;
  onOpenReview?: (asset: MediaAsset) => void;
  onStarToggle?: (asset: MediaAsset) => void;
  onSetRating?: (asset: MediaAsset, rating: number) => void;
  onSetColorLabel?: (asset: MediaAsset, color: string | null) => void;
  onSetBurstHero?: (asset: MediaAsset) => void;
  onAnalyzeAI?: (asset: MediaAsset) => void;
  onOpenAiInspector?: (asset: MediaAsset, action?: string) => void;
  onOpenNotebookLm?: (asset: MediaAsset) => void;
  onCheckSharpness?: (asset: MediaAsset) => void;
  onDownload?: (asset: MediaAsset) => void;
  onDuplicate?: (asset: MediaAsset) => void;
  onRename?: (asset: MediaAsset) => void;
  onBatchRename?: (asset: MediaAsset) => void;
  onBatchExport?: (asset: MediaAsset) => void;
  onTrimVideo?: (asset: MediaAsset) => void;
  onMove?: (asset: MediaAsset) => void;
  onDelete?: (asset: MediaAsset) => void;
  onCopyLink?: (asset: MediaAsset) => void;
  onCopyPath?: (asset: MediaAsset) => void;
  onOpenInDrive?: (asset: MediaAsset) => void;
  onUploadToDrive?: (asset: MediaAsset) => void;
  onStartSlideshow?: (asset: MediaAsset) => void;
  onOpenInfoDrawer?: (asset: MediaAsset) => void;
  onShareGmail?: (asset: MediaAsset) => void;
  onShareChat?: (asset: MediaAsset) => void;
  onShareVoice?: (asset: MediaAsset) => void;
  onShareContact?: (asset: MediaAsset) => void;
  onShareCalendar?: (asset: MediaAsset) => void;
  onShareOtherApps?: (asset: MediaAsset) => void;
  onPlayInMusicPlayer?: (asset: MediaAsset) => void;
  onAddToMusicQueue?: (asset: MediaAsset) => void;
}

export const UnifiedContextMenu: React.FC<UnifiedContextMenuProps> = ({
  asset,
  position,
  onClose,
  onPreview,
  onOpenPip,
  isPipActive = false,
  onOpenEditor,
  onOpenInLightboxEditor,
  onInspectFormatDb,
  onOpenReview,
  onStarToggle,
  onSetRating,
  onSetColorLabel,
  onSetBurstHero,
  onAnalyzeAI,
  onOpenAiInspector,
  onOpenNotebookLm,
  onCheckSharpness,
  onDownload,
  onDuplicate,
  onRename,
  onBatchRename,
  onBatchExport,
  onTrimVideo,
  onMove,
  onDelete,
  onCopyLink,
  onCopyPath,
  onOpenInDrive,
  onUploadToDrive,
  onStartSlideshow,
  onOpenInfoDrawer,
  onShareGmail,
  onShareChat,
  onShareVoice,
  onShareContact,
  onShareCalendar,
  onShareOtherApps,
  onPlayInMusicPlayer,
  onAddToMusicQueue,
}) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [activeSubmenu, setActiveSubmenu] = useState<'rating' | 'color' | 'share' | null>(null);

  // Smart Viewport Edge Clamping (recalculated on open, asset switch, or submenu expansion)
  useEffect(() => {
    if (!position || !menuRef.current) return;

    const menuEl = menuRef.current;
    const { offsetWidth, offsetHeight } = menuEl;
    const padding = 12;

    let left = position.x;
    let top = position.y;

    // Flip or clamp horizontal
    if (left + offsetWidth > window.innerWidth - padding) {
      left = Math.max(padding, window.innerWidth - offsetWidth - padding);
    }
    left = Math.max(padding, left);

    // Flip or clamp vertical: ensure bottom of menu never overflows viewport
    if (top + offsetHeight > window.innerHeight - padding) {
      top = Math.max(padding, window.innerHeight - offsetHeight - padding);
    }
    top = Math.max(padding, top);

    setCoords({ top, left });
  }, [position, asset, activeSubmenu]);

  // Global listeners: Dismiss on outside click, window scroll, or Escape key
  useEffect(() => {
    if (!position) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleScroll = (e: Event) => {
      // Exemption: Scrolling INSIDE the context menu must NOT dismiss it!
      if (menuRef.current && (menuRef.current === e.target || menuRef.current.contains(e.target as Node))) {
        return;
      }
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [position, onClose]);

  if (!position || !asset) return null;

  const contextSpec = getContextMenuSpecForAsset(asset);
  const fmt = contextSpec.format;
  const isCloud = asset.source === 'cloud';
  const isImageOrRaw = asset.category === 'image' || asset.category === 'raw';
  const isVideo = asset.category === 'video' || fmt.viewer === 'video-player';
  const isAudio = asset.category === 'audio' || fmt.viewer === 'audio-player';
  const isStarred = Boolean(asset.cullingStatus === 'picked' || asset.rating > 0);

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <>
      {/* Invisible High-Z Backdrop to Guarantee Dismissal on Outside Clicks */}
      <div
        className="fixed inset-0 z-[9998] bg-transparent"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />

      <div
        ref={menuRef}
        style={{
          top: coords.top,
          left: coords.left,
          maxHeight: 'calc(100vh - 24px)',
        }}
        className="fixed z-[9999] w-72 overflow-y-auto rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl border border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs py-1.5 animate-in fade-in zoom-in-95 duration-100 select-none custom-scrollbar"
        role="menu"
        aria-label={`Context options for ${asset.name}`}
        onClick={(e) => e.stopPropagation()}
      >
      {/* 1. Header: Asset Thumbnail, Name & Source/Format Badge */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 mb-1 flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex-shrink-0 overflow-hidden flex items-center justify-center border border-slate-200/60 dark:border-slate-700">
          {asset.thumbnailUrl ? (
            <img
              src={asset.thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
              loading="lazy"
            />
          ) : (
            <FileText className="w-5 h-5 text-slate-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate text-[11px]" title={asset.name}>
            {asset.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1 font-medium">
              {isCloud ? (
                <>
                  <Cloud className="w-3 h-3 text-[#1074B1]" />
                  <span>Drive</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-3 h-3 text-[#52B197]" />
                  <span>Local</span>
                </>
              )}
            </span>
            <span>•</span>
            <span className="font-mono font-bold text-[#1074B1] dark:text-[#67b7e6]">.{fmt.extension}</span>
            <span>•</span>
            <span>{formatFileSize(asset.sizeBytes)}</span>
          </div>
          <p className="text-[9px] font-mono text-slate-400 truncate mt-0.5">
            {fmt.name} ({fmt.family})
          </p>
        </div>
      </div>

      {/* 2. Format-Routed Viewing, Editing, PiP & Studio Workstations */}
      <div className="px-1 py-0.5 space-y-0.5">
        {onPreview && (
          <button
            onClick={() => { onPreview(asset); onClose(); }}
            className="w-full min-h-[34px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors"
            role="menuitem"
          >
            <Eye className="w-3.5 h-3.5 text-[#1074B1]" />
            <span>{contextSpec.viewerLabel}</span>
          </button>
        )}

        {/* Format-Specific Primary Editor Route */}
        {contextSpec.editorLabel && (
          <button
            onClick={() => {
              if (
                (contextSpec.editorRoute === 'pixel-studio' ||
                  contextSpec.editorRoute === 'cad-3d-studio' ||
                  contextSpec.editorRoute === 'shader-studio' ||
                  contextSpec.editorRoute === 'heightmap-studio') &&
                onOpenEditor
              ) {
                onOpenEditor(asset);
              } else if (contextSpec.editorRoute === 'video-trimmer' && onTrimVideo) {
                onTrimVideo(asset);
              } else if (contextSpec.editorRoute === 'music-eq-studio' && onPlayInMusicPlayer) {
                onPlayInMusicPlayer(asset);
              } else if (onOpenInLightboxEditor) {
                onOpenInLightboxEditor(asset);
              } else {
                onPreview?.(asset);
              }
              onClose();
            }}
            className="w-full min-h-[34px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-semibold transition-colors text-amber-600 dark:text-amber-400"
            role="menuitem"
          >
            <Edit3 className="w-3.5 h-3.5 shrink-0" />
            <span>{contextSpec.editorLabel}</span>
          </button>
        )}

        {onOpenEditor && (
          <button
            onClick={() => { onOpenEditor(asset); onClose(); }}
            className="w-full min-h-[34px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors text-[#1074B1] dark:text-[#67b7e6]"
            role="menuitem"
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span>
              {fmt.family === 'cad_3d' || fmt.viewer === '3d-preview'
                ? 'Open in 3D Editor & CAD Studio'
                : fmt.viewer === 'shader-viewer'
                ? 'Open in Live Shader Studio'
                : fmt.viewer === 'heightmap-viewer'
                ? 'Open in Heightmap & Map Studio'
                : 'Open in Native Studio Workspace'}
            </span>
          </button>
        )}

        {/* Interactive Context-Aware Picture-in-Picture Toggle */}
        {contextSpec.pipLabel && onOpenPip && (
          <button
            onClick={() => { onOpenPip(asset); onClose(); }}
            className={`w-full min-h-[34px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2 text-left font-medium transition-colors ${
              isPipActive ? 'bg-teal-500/10 text-teal-600 dark:text-teal-300 font-bold' : ''
            }`}
            role="menuitem"
          >
            <span className="flex items-center gap-2.5">
              {contextSpec.pipMode === 'media' ? (
                <Tv className="w-3.5 h-3.5 text-teal-500" />
              ) : (
                <Pin className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>{contextSpec.pipLabel}</span>
            </span>
            {isPipActive && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/20 font-mono">ON</span>
            )}
          </button>
        )}

        {isImageOrRaw && onOpenReview && (
          <button
            onClick={() => { onOpenReview(asset); onClose(); }}
            className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors"
            role="menuitem"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t('context.openReview')}</span>
          </button>
        )}

        {isImageOrRaw && onStartSlideshow && (
          <button
            onClick={() => { onStartSlideshow(asset); onClose(); }}
            className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors"
            role="menuitem"
          >
            <Play className="w-3.5 h-3.5 text-purple-500" />
            <span>{t('context.startSlideshow')}</span>
          </button>
        )}

        {isImageOrRaw && onBatchExport && (
          <button
            onClick={() => { onBatchExport(asset); onClose(); }}
            className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors text-[#1074B1]"
            role="menuitem"
          >
            <DownloadCloud className="w-3.5 h-3.5 text-[#1074B1]" />
            <span>Batch Watermark &amp; Export</span>
          </button>
        )}

        {isVideo && contextSpec.editorRoute !== 'video-trimmer' && onTrimVideo && (
          <button
            onClick={() => { onTrimVideo(asset); onClose(); }}
            className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors text-amber-500"
            role="menuitem"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-500" />
            <span>Lossless Video Trimmer</span>
          </button>
        )}

        {onInspectFormatDb && (
          <button
            onClick={() => { onInspectFormatDb(asset); onClose(); }}
            className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors text-slate-600 dark:text-slate-300"
            role="menuitem"
          >
            <Database className="w-3.5 h-3.5 text-[#1074B1]" />
            <span>Inspect Format Spec (.{fmt.extension})</span>
          </button>
        )}
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

      {/* 3. Cloud-Native Google Drive Spectrum OR Host OS Operations */}
      <div className="px-1 py-0.5 space-y-0.5">
        {isCloud ? (
          <>
            {onOpenInDrive && (
              <button
                onClick={() => { onOpenInDrive(asset); onClose(); }}
                className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors"
                role="menuitem"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#1074B1]" />
                <span>{t('context.openInDrive')}</span>
              </button>
            )}

            {onCopyLink && (
              <button
                onClick={() => { onCopyLink(asset); onClose(); }}
                className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors"
                role="menuitem"
              >
                <Share2 className="w-3.5 h-3.5 text-[#1074B1]" />
                <span>{t('context.copyLink')}</span>
              </button>
            )}

            {/* Comprehensive "Share to..." Submenu */}
            <div className="relative">
              <button
                onClick={() => setActiveSubmenu(activeSubmenu === 'share' ? null : 'share')}
                className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-left font-medium transition-colors text-[#1074B1] dark:text-[#52B197]"
                role="menuitem"
                aria-haspopup="true"
                aria-expanded={activeSubmenu === 'share'}
              >
                <span className="flex items-center gap-2.5">
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="font-semibold">Share to...</span>
                </span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
              </button>

              {activeSubmenu === 'share' && (
                <div className="mx-2 my-1 p-1 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 shadow-lg space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                  {onShareGmail && (
                    <button
                      onClick={() => { onShareGmail(asset); onClose(); }}
                      className="w-full min-h-[28px] px-2 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-700/80 flex items-center gap-2 text-left text-xs transition-colors"
                      role="menuitem"
                    >
                      <Mail className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span>Gmail</span>
                    </button>
                  )}

                  {onShareChat && (
                    <button
                      onClick={() => { onShareChat(asset); onClose(); }}
                      className="w-full min-h-[28px] px-2 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-700/80 flex items-center gap-2 text-left text-xs transition-colors"
                      role="menuitem"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span>Google Chat</span>
                    </button>
                  )}

                  {onShareVoice && (
                    <button
                      onClick={() => { onShareVoice(asset); onClose(); }}
                      className="w-full min-h-[28px] px-2 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-700/80 flex items-center gap-2 text-left text-xs transition-colors"
                      role="menuitem"
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Google Voice (SMS)</span>
                    </button>
                  )}

                  {onShareContact && (
                    <button
                      onClick={() => { onShareContact(asset); onClose(); }}
                      className="w-full min-h-[28px] px-2 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-700/80 flex items-center gap-2 text-left text-xs transition-colors"
                      role="menuitem"
                    >
                      <Users className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      <span>Share to Contact...</span>
                    </button>
                  )}

                  {onShareCalendar && (
                    <button
                      onClick={() => { onShareCalendar(asset); onClose(); }}
                      className="w-full min-h-[28px] px-2 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-700/80 flex items-center gap-2 text-left text-xs transition-colors"
                      role="menuitem"
                    >
                      <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>Google Calendar (Schedule Review)</span>
                    </button>
                  )}

                  {onOpenNotebookLm && (
                    <button
                      onClick={() => { onOpenNotebookLm(asset); onClose(); }}
                      className="w-full min-h-[28px] px-2 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-700/80 flex items-center gap-2 text-left text-xs transition-colors"
                      role="menuitem"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-[#52B197] shrink-0" />
                      <span>Google NotebookLM Dossier</span>
                    </button>
                  )}

                  {onShareOtherApps && (
                    <button
                      onClick={() => { onShareOtherApps(asset); onClose(); }}
                      className="w-full min-h-[28px] px-2 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-700/80 flex items-center gap-2 text-left text-xs transition-colors text-slate-600 dark:text-slate-300 border-t border-slate-200/60 dark:border-slate-700 pt-1 mt-0.5"
                      role="menuitem"
                    >
                      <ExternalLink className="w-3.5 h-3.5 opacity-70 shrink-0" />
                      <span>Other Apps (System Share Sheet)</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {onStarToggle && (
              <button
                onClick={() => { onStarToggle(asset); onClose(); }}
                className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors"
                role="menuitem"
              >
                <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                <span>{isStarred ? t('context.unstar') : t('context.star')}</span>
              </button>
            )}

            {onRename && (
              <button
                onClick={() => { onRename(asset); onClose(); }}
                className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors"
                role="menuitem"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('context.renameDrive')}</span>
              </button>
            )}

            {onDuplicate && (
              <button
                onClick={() => { onDuplicate(asset); onClose(); }}
                className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors"
                role="menuitem"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('context.duplicate')}</span>
              </button>
            )}

            {onMove && (
              <button
                onClick={() => { onMove(asset); onClose(); }}
                className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors"
                role="menuitem"
              >
                <FolderInput className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('context.move')}</span>
              </button>
            )}

            {onDownload && (
              <button
                onClick={() => { onDownload(asset); onClose(); }}
                className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors"
                role="menuitem"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('context.download')}</span>
              </button>
            )}
          </>
        ) : (
          <>
            {/* Host Local Filesystem Operations */}
            {onCopyPath && (
              <button
                onClick={() => { onCopyPath(asset); onClose(); }}
                className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors"
                role="menuitem"
              >
                <Copy className="w-3.5 h-3.5 text-[#52B197]" />
                <span>{t('context.copyPath')}</span>
              </button>
            )}

            {onRename && (
              <button
                onClick={() => { onRename(asset); onClose(); }}
                className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors"
                role="menuitem"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('context.rename')}</span>
              </button>
            )}

            {onBatchRename && (
              <button
                onClick={() => { onBatchRename(asset); onClose(); }}
                className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors"
                role="menuitem"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#1074B1]" />
                <span>Tokenized Batch Rename (500+)</span>
              </button>
            )}

            {onDuplicate && (
              <button
                onClick={() => { onDuplicate(asset); onClose(); }}
                className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors"
                role="menuitem"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('context.duplicate')}</span>
              </button>
            )}

            {onUploadToDrive && (
              <button
                onClick={() => { onUploadToDrive(asset); onClose(); }}
                className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors text-[#1074B1]"
                role="menuitem"
              >
                <UploadCloud className="w-3.5 h-3.5 text-[#1074B1]" />
                <span>{t('context.uploadToDrive')}</span>
              </button>
            )}
          </>
        )}
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

      {/* 4. Drive Therapy Multi-Format Gemini AI Superpowers */}
      <div className="px-1 py-0.5 space-y-0.5">
        {/* Universal Gemini File Inspector */}
        {onOpenAiInspector ? (
          <button
            onClick={() => { onOpenAiInspector(asset); onClose(); }}
            className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors text-purple-600 dark:text-purple-400"
            role="menuitem"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>Ask Gemini About This File...</span>
          </button>
        ) : isImageOrRaw && onAnalyzeAI ? (
          <button
            onClick={() => { onAnalyzeAI(asset); onClose(); }}
            className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors text-purple-600 dark:text-purple-400"
            role="menuitem"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>{t('context.askAi')}</span>
          </button>
        ) : null}

        {/* Photo & RAW Specialized Actions */}
        {isImageOrRaw && onOpenAiInspector && (
          <>
            <button
              onClick={() => { onOpenAiInspector(asset, 'critique'); onClose(); }}
              className="w-full min-h-[30px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left text-xs transition-colors"
              role="menuitem"
            >
              <Camera className="w-3.5 h-3.5 text-[#1074B1]" />
              <span>Visual Quality &amp; Critique</span>
            </button>
            <button
              onClick={() => { onOpenAiInspector(asset, 'captions'); onClose(); }}
              className="w-full min-h-[30px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left text-xs transition-colors"
              role="menuitem"
            >
              <FileText className="w-3.5 h-3.5 text-[#BEBF61]" />
              <span>Social Captions &amp; Tags</span>
            </button>
          </>
        )}

        {/* Document & Structured Data Actions */}
        {(asset.category === 'document' || asset.category === 'data') && onOpenAiInspector && (
          <>
            <button
              onClick={() => { onOpenAiInspector(asset, 'doc_summary'); onClose(); }}
              className="w-full min-h-[30px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left text-xs transition-colors text-[#1074B1]"
              role="menuitem"
            >
              <FileText className="w-3.5 h-3.5 text-[#1074B1]" />
              <span>
                {asset.category === 'data' ? 'Summarize Structure & Schema' : 'Executive Document Summary'}
              </span>
            </button>
            <button
              onClick={() => { onOpenAiInspector(asset, 'action_items'); onClose(); }}
              className="w-full min-h-[30px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left text-xs transition-colors text-[#52B197]"
              role="menuitem"
            >
              <FileCheck className="w-3.5 h-3.5 text-[#52B197]" />
              <span>Extract Action Items &amp; Keys</span>
            </button>
          </>
        )}

        {/* Audio / Video / Subtitle Media Studio Player Actions */}
        {contextSpec.isMediaPlayerCompatible && onPlayInMusicPlayer && (
          <>
            <button
              onClick={() => { onPlayInMusicPlayer(asset); onClose(); }}
              className="w-full min-h-[30px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left text-xs transition-colors text-sky-500 font-semibold"
              role="menuitem"
            >
              <Play className="w-3.5 h-3.5 text-sky-500 fill-sky-500" />
              <span>Play in Media Studio Player</span>
            </button>
            {onAddToMusicQueue && (
              <button
                onClick={() => { onAddToMusicQueue(asset); onClose(); }}
                className="w-full min-h-[30px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left text-xs transition-colors"
                role="menuitem"
              >
                <ListMusic className="w-3.5 h-3.5 opacity-70" />
                <span>Add to Up Next Queue</span>
              </button>
            )}
          </>
        )}

        {contextSpec.isSubtitleOrLyric && onPlayInMusicPlayer && (
          <button
            onClick={() => { onPlayInMusicPlayer(asset); onClose(); }}
            className="w-full min-h-[30px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left text-xs transition-colors text-emerald-500 font-semibold"
            role="menuitem"
          >
            <Subtitles className="w-3.5 h-3.5 text-emerald-500" />
            <span>Load Synced Lyrics / Subtitles in Studio</span>
          </button>
        )}

        {/* Audio Actions */}
        {isAudio && onOpenAiInspector && (
          <>
            <button
              onClick={() => { onOpenAiInspector(asset, 'transcribe'); onClose(); }}
              className="w-full min-h-[30px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left text-xs transition-colors text-[#52B197]"
              role="menuitem"
            >
              <Headphones className="w-3.5 h-3.5 text-[#52B197]" />
              <span>Speech-to-Text Transcription</span>
            </button>
            <button
              onClick={() => { onOpenAiInspector(asset, 'voice_memo_summary'); onClose(); }}
              className="w-full min-h-[30px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left text-xs transition-colors text-[#BEBF61]"
              role="menuitem"
            >
              <FileText className="w-3.5 h-3.5 text-[#BEBF61]" />
              <span>Voice Memo Shoot Summary</span>
            </button>
          </>
        )}

        {/* Video Actions */}
        {isVideo && onOpenAiInspector && (
          <>
            <button
              onClick={() => { onOpenAiInspector(asset, 'video_chapters'); onClose(); }}
              className="w-full min-h-[30px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left text-xs transition-colors text-[#A61B7A]"
              role="menuitem"
            >
              <Play className="w-3.5 h-3.5 text-[#A61B7A]" />
              <span>Generate Video Chapters</span>
            </button>
            <button
              onClick={() => { onOpenAiInspector(asset, 'scene_log'); onClose(); }}
              className="w-full min-h-[30px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left text-xs transition-colors text-amber-500"
              role="menuitem"
            >
              <Scissors className="w-3.5 h-3.5 text-amber-500" />
              <span>Suggest Highlight Trims</span>
            </button>
          </>
        )}

        {/* Google NotebookLM Dossier Export */}
        {onOpenNotebookLm && (
          <button
            onClick={() => { onOpenNotebookLm(asset); onClose(); }}
            className="w-full min-h-[30px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left text-xs transition-colors text-[#298d75] dark:text-[#52B197]"
            role="menuitem"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#52B197]" />
            <span>Export to NotebookLM Dossier...</span>
          </button>
        )}

        {isImageOrRaw && onCheckSharpness && (
          <button
            onClick={() => { onCheckSharpness(asset); onClose(); }}
            className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors"
            role="menuitem"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>{t('context.checkSharpness')}</span>
          </button>
        )}

        {isImageOrRaw && onSetBurstHero && (
          <button
            onClick={() => { onSetBurstHero(asset); onClose(); }}
            className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors"
            role="menuitem"
          >
            <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t('context.setBurstHero')}</span>
          </button>
        )}

        {/* Rating Submenu Selector */}
        {onSetRating && (
          <div className="relative">
            <button
              onClick={() => setActiveSubmenu(activeSubmenu === 'rating' ? null : 'rating')}
              className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-left font-medium transition-colors"
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={activeSubmenu === 'rating'}
            >
              <span className="flex items-center gap-2.5">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>{t('context.starRating')} {asset.rating > 0 ? `(${asset.rating}★)` : ''}</span>
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
            </button>
            {activeSubmenu === 'rating' && (
              <div className="mx-2 my-1 p-1 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700 flex items-center justify-around gap-1">
                {[1, 2, 3, 4, 5].map((starVal) => (
                  <button
                    key={starVal}
                    onClick={() => { onSetRating(asset, starVal); onClose(); }}
                    className={`p-1.5 rounded-lg text-xs font-bold transition-transform hover:scale-110 ${
                      asset.rating === starVal
                        ? 'bg-amber-400 text-slate-900 shadow-sm'
                        : 'hover:bg-amber-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                    title={`Rate ${starVal} Star`}
                  >
                    {starVal}★
                  </button>
                ))}
                <button
                  onClick={() => { onSetRating(asset, 0); onClose(); }}
                  className="px-2 py-1 text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  title="Clear rating"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}

        {/* Color Label Submenu Selector */}
        {onSetColorLabel && (
          <div className="relative">
            <button
              onClick={() => setActiveSubmenu(activeSubmenu === 'color' ? null : 'color')}
              className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-left font-medium transition-colors"
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={activeSubmenu === 'color'}
            >
              <span className="flex items-center gap-2.5">
                <Palette className="w-3.5 h-3.5 text-rose-500" />
                <span>{t('context.colorLabel')}</span>
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
            </button>
            {activeSubmenu === 'color' && (
              <div className="mx-2 my-1 p-1 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700 flex items-center justify-around gap-1">
                {[
                  { name: 'Red', hex: '#EF4444' },
                  { name: 'Yellow', hex: '#F59E0B' },
                  { name: 'Green', hex: '#10B981' },
                  { name: 'Blue', hex: '#3B82F6' },
                  { name: 'Purple', hex: '#8B5CF6' },
                ].map((col) => (
                  <button
                    key={col.name}
                    onClick={() => { onSetColorLabel(asset, col.hex); onClose(); }}
                    className="w-5 h-5 rounded-full border border-black/10 transition-transform hover:scale-125"
                    style={{ backgroundColor: col.hex }}
                    title={`Label ${col.name}`}
                  />
                ))}
                <button
                  onClick={() => { onSetColorLabel(asset, null); onClose(); }}
                  className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  title="Remove color label"
                >
                  None
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

      {/* 5. Details & Deletion */}
      <div className="px-1 py-0.5 space-y-0.5">
        {onOpenInfoDrawer && (
          <button
            onClick={() => { onOpenInfoDrawer(asset); onClose(); }}
            className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-medium transition-colors"
            role="menuitem"
          >
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span>{t('context.details')}</span>
          </button>
        )}

        {onDelete && (
          <button
            onClick={() => { onDelete(asset); onClose(); }}
            className="w-full min-h-[32px] px-2.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2.5 text-left font-medium transition-colors"
            role="menuitem"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>{isCloud ? 'Move to Trash' : 'Delete File'}</span>
          </button>
        )}
      </div>
    </div>
    </>
  );
};
