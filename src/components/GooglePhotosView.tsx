/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Photos Storage View (GooglePhotosView.tsx)
 * Chronological timeline, Google Photos Picker integration, Google Takeout JSON sidecar importer,
 * All/Photos/Videos/GIFs/Favorites filters, and Studio handoffs (GIF Studio, Video Editor, Pixel Studio).
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Video,
  Sparkles,
  Star,
  Upload,
  RefreshCw,
  Scissors,
  Film,
  Compass,
  CheckCircle2,
  ExternalLink,
  SlidersHorizontal,
  FolderOpen,
  Plus,
} from 'lucide-react';
import { MediaAsset } from '../types';
import { useTranslation } from '../i18n';
import {
  createGooglePhotosPickerSession,
  pollGooglePhotosPickerSession,
  autoLoadGooglePhotosLibrary,
  fetchGooglePhotosAlbumItems,
  createGooglePhotosAlbum,
  GooglePhotosAlbum,
  groupPhotosByDate,
  mergeTakeoutSidecar,
  saveGooglePhotosAssets,
  TakeoutJsonSidecar,
} from '../services/googlePhotos';
import { dedupePhotoAssets, matchTakeoutSidecar } from '../services/takeoutAndCastorEngine';
import { MediaHoverScrubber } from './MediaHoverScrubber';

interface GooglePhotosViewProps {
  photosAssets: MediaAsset[];
  initialAlbums?: GooglePhotosAlbum[];
  onUpdateAlbums?: (albums: GooglePhotosAlbum[]) => void;
  cloudConnected: boolean;
  onConnectGoogle: () => void;
  onAddPhotosAssets: (items: MediaAsset[]) => void;
  onOpenLightbox: (asset: MediaAsset, contextList: MediaAsset[]) => void;
  onOpenGifStudio?: (asset: MediaAsset) => void;
  onOpenVideoEditor?: (asset: MediaAsset) => void;
  onToggleFavorite?: (assetId: string) => void;
  onOpenMap?: () => void;
}

type PhotosFilterTab = 'all' | 'photos' | 'videos' | 'gifs' | 'favorites' | 'albums';

export const GooglePhotosView: React.FC<GooglePhotosViewProps> = ({
  photosAssets,
  initialAlbums = [],
  onUpdateAlbums,
  cloudConnected,
  onConnectGoogle,
  onAddPhotosAssets,
  onOpenLightbox,
  onOpenGifStudio,
  onOpenVideoEditor,
  onToggleFavorite,
  onOpenMap,
}) => {
  const { t } = useTranslation();
  const [filterTab, setFilterTab] = useState<PhotosFilterTab>('all');
  const [albums, setAlbums] = useState<GooglePhotosAlbum[]>(initialAlbums);
  const [activeAlbumTitle, setActiveAlbumTitle] = useState<string | null>(null);
  const [pickerStatus, setPickerStatus] = useState<'idle' | 'picking' | 'error'>('idle');
  const [pickerMessage, setPickerMessage] = useState<string>('');
  const [activePickerUri, setActivePickerUri] = useState<string | null>(null);
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchNumber, setBatchNumber] = useState(0);
  const [batchTotals, setBatchTotals] = useState<{ imported: number; skippedDuplicates: number }>({
    imported: 0,
    skippedDuplicates: 0,
  });
  const autoLoadedRef = useRef(false);
  const takeoutInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialAlbums.length > 0 && albums.length === 0) {
      setAlbums(initialAlbums);
    }
  }, [initialAlbums, albums.length]);

  const runGooglePhotosSync = async () => {
    setIsAutoLoading(true);
    try {
      const res = await autoLoadGooglePhotosLibrary();
      if (res.albums.length > 0) {
        setAlbums(res.albums);
        onUpdateAlbums?.(res.albums);
      }
      if (res.items.length > 0) {
        onAddPhotosAssets(res.items);
        saveGooglePhotosAssets(res.items);
        setPickerMessage(
          `Loaded ${res.items.length} media items and ${res.albums.length} album(s) from Google Photos.`
        );
      } else if (res.albums.length > 0) {
        setPickerMessage(`Loaded ${res.albums.length} Google Photos album(s). Select an album or use Pick from Google Photos.`);
      } else if (res.policyRestricted) {
        setPickerMessage(
          `Google Photos Library API requires Picker selection or reconnect (${res.errorDetail || '403'}) — click Pick from Google Photos, Sign Out & Reconnect, or Import Takeout Folder.`
        );
      }
    } finally {
      setIsAutoLoading(false);
    }
  };

  useEffect(() => {
    if (!cloudConnected || autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    void runGooglePhotosSync();
  }, [cloudConnected]);

  const filteredAssets = useMemo(() => {
    return photosAssets.filter((a) => {
      const isGif = a.extension?.toUpperCase() === 'GIF' || a.mimeType === 'image/gif';
      if (filterTab === 'photos') return a.category === 'image' && !isGif;
      if (filterTab === 'videos') return a.category === 'video';
      if (filterTab === 'gifs') return isGif;
      if (filterTab === 'favorites') return a.rating > 0 || a.cullingStatus === 'picked';
      return true;
    });
  }, [photosAssets, filterTab]);

  const timelineGroups = useMemo(() => groupPhotosByDate(filteredAssets), [filteredAssets]);

  const handleLaunchPicker = async (batchModeOverride?: boolean) => {
    if (!cloudConnected) {
      onConnectGoogle();
      return;
    }
    const useBatch = typeof batchModeOverride === 'boolean' ? batchModeOverride : isBatchMode;
    const nextBatchNum = useBatch ? batchNumber + 1 : 0;
    if (useBatch) {
      setIsBatchMode(true);
      setBatchNumber(nextBatchNum);
    }
    // Open popup synchronously inside click gesture to satisfy Firefox/Safari popup blockers
    const pickerWin = window.open('about:blank', 'google_photos_picker', 'width=980,height=720');
    setPickerStatus('picking');
    setActivePickerUri(null);
    setPickerMessage(
      useBatch
        ? `Opening Google Photos Picker Batch #${nextBatchNum} (up to 2,000 items)...`
        : 'Opening Google Photos Picker session...'
    );
    try {
      const session = await createGooglePhotosPickerSession();
      setActivePickerUri(session.pickerUri);
      if (pickerWin && !pickerWin.closed) {
        pickerWin.location.href = session.pickerUri;
      }
      setPickerMessage(
        useBatch
          ? `Batch #${nextBatchNum}: Select up to 2,000 items or an album in Google Photos Picker and click Done...`
          : 'Select an entire album or up to 2,000 photos/videos in the Google Photos Picker window (click Select All / Done)...'
      );

      let attempts = 0;
      const poll = async () => {
        attempts++;
        const result = await pollGooglePhotosPickerSession(session.id);
        if (result.mediaItemsSet) {
          const { unique, skippedDuplicates } = dedupePhotoAssets(photosAssets, result.items);
          if (unique.length > 0) {
            onAddPhotosAssets(unique);
            saveGooglePhotosAssets([...unique, ...photosAssets]);
          }
          setPickerStatus('idle');
          setActivePickerUri(null);
          if (useBatch) {
            setBatchTotals((prev) => ({
              imported: prev.imported + unique.length,
              skippedDuplicates: prev.skippedDuplicates + skippedDuplicates,
            }));
            setPickerMessage(
              `Batch #${nextBatchNum} complete: +${unique.length} new item(s) imported (${skippedDuplicates} duplicate(s) skipped). Click Continue Batch #${nextBatchNum + 1} for more!`
            );
          } else {
            setPickerMessage(
              `Imported ${unique.length} new item(s) from Google Photos${skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicates skipped)` : ''}.`
            );
          }
          return;
        }
        if (attempts < 45) {
          setTimeout(() => void poll(), 2000);
        } else {
          setPickerStatus('idle');
          setPickerMessage('Picker session timed out. Click Pick from Google Photos to retry.');
        }
      };
      setTimeout(() => void poll(), 2500);
    } catch (err: any) {
      if (pickerWin && !pickerWin.closed) {
        pickerWin.close();
      }
      setPickerStatus('error');
      setPickerMessage(err?.message || 'Unable to start Google Photos Picker session.');
    }
  };

  const handleTakeoutFolderImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const sidecars = new Map<string, TakeoutJsonSidecar>();
    const mediaFiles: File[] = [];

    for (const f of files) {
      if (f.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(await f.text()) as TakeoutJsonSidecar;
          sidecars.set(f.name.replace(/\.json$/i, '').toLowerCase(), parsed);
        } catch {}
      } else if (f.type.startsWith('image/') || f.type.startsWith('video/')) {
        mediaFiles.push(f);
      }
    }

    const imported: MediaAsset[] = mediaFiles.map((f, idx) => {
      const isVideo = f.type.startsWith('video/');
      const extMatch = f.name.match(/\.([^.]+)$/);
      const ext = extMatch ? extMatch[1].toUpperCase() : isVideo ? 'MP4' : 'JPG';
      const objectUrl = URL.createObjectURL(f);
      const baseAsset: MediaAsset = {
        id: `gphotos_takeout_${Date.now()}_${idx}`,
        name: f.name,
        source: 'photos',
        category: isVideo ? 'video' : 'image',
        mimeType: f.type,
        extension: ext,
        path: (f as any).webkitRelativePath || `Google Photos/${f.name}`,
        sizeBytes: f.size,
        modifiedTime: new Date(f.lastModified).toISOString(),
        cloudUrl: objectUrl,
        thumbnailUrl: isVideo ? '' : objectUrl,
        isCached: true,
        cullingStatus: 'unrated',
        rating: 0,
        tags: ['Google Photos', 'Takeout'],
        faces: [],
        quality: { sharpness: 90, exposure: 90, overall: 90, isBlurry: false },
        palette: [],
        exif: {},
      };
      const matchedSidecar = matchTakeoutSidecar(f.name, sidecars);
      return matchedSidecar ? mergeTakeoutSidecar(baseAsset, matchedSidecar) : baseAsset;
    });

    const { unique, skippedDuplicates } = dedupePhotoAssets(photosAssets, imported);
    if (unique.length > 0) {
      onAddPhotosAssets(unique);
      saveGooglePhotosAssets([...unique, ...photosAssets]);
      setPickerMessage(
        `Imported ${unique.length} Takeout media items with EXIF/JSON metadata${skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicates skipped)` : ''}.`
      );
    } else if (imported.length > 0) {
      setPickerMessage(`All ${imported.length} Takeout item(s) were already in your library.`);
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div
        className="p-5 rounded-2xl border flex flex-wrap items-center justify-between gap-4 shadow-xs"
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#A61B7A] via-[#1074B1] to-[#52B197] text-white flex items-center justify-center shadow-md">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold tracking-tight">{t('photos.title')}</h2>
            <p className="text-xs opacity-70">
              Chronological Timeline · Google Photos Picker · Takeout Sidecar Merger · GIF & Video Tools
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void handleLaunchPicker(false)}
            disabled={pickerStatus === 'picking'}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#A61B7A] to-[#1074B1] text-white text-xs font-bold shadow-sm hover:opacity-95 flex items-center gap-2"
          >
            {pickerStatus === 'picking' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            <span>{cloudConnected ? 'Pick from Google Photos' : 'Connect Google Photos'}</span>
          </button>

          {cloudConnected && (
            <button
              onClick={() => void handleLaunchPicker(true)}
              disabled={pickerStatus === 'picking'}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#A61B7A]/40 bg-[#A61B7A]/10 text-[#A61B7A] dark:text-pink-300 text-xs font-bold hover:bg-[#A61B7A]/20 flex items-center gap-2 transition-colors"
              title="Chain 2,000-item Picker sessions with automatic deduplication"
            >
              <Plus className="w-4 h-4" />
              <span>
                {isBatchMode && batchNumber > 0
                  ? `Continue Batch #${batchNumber + 1} (${batchTotals.imported} added)`
                  : 'Batch Import (2,000/batch)'}
              </span>
            </button>
          )}

          {isBatchMode && batchNumber > 0 && pickerStatus !== 'picking' && (
            <button
              onClick={() => {
                setIsBatchMode(false);
                setBatchNumber(0);
                setBatchTotals({ imported: 0, skippedDuplicates: 0 });
                setPickerMessage('Batch Picker session finished.');
              }}
              className="min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold hover:border-[#1074B1]"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              Finish Batch
            </button>
          )}

          <button
            onClick={() => takeoutInputRef.current?.click()}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-bold hover:border-[#1074B1] flex items-center gap-2 transition-colors"
            style={{ borderColor: 'var(--theme-border)' }}
            title="Import a Google Takeout folder with .json photoTakenTime & geoData sidecars"
          >
            <Upload className="w-4 h-4 text-[#52B197]" />
            <span>Import Takeout Folder</span>
          </button>
          <input
            ref={takeoutInputRef}
            type="file"
            multiple
            // @ts-expect-error webkitdirectory supported by Chromium/Firefox
            webkitdirectory=""
            className="hidden"
            onChange={handleTakeoutFolderImport}
          />

          {onOpenMap && (
            <button
              onClick={onOpenMap}
              className="min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold hover:border-[#1074B1] flex items-center gap-1.5"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <Compass className="w-4 h-4 text-[#1074B1]" />
              <span>Photo Map</span>
            </button>
          )}
        </div>
      </div>

      {isAutoLoading && (
        <div className="px-4 py-2.5 rounded-xl border border-[#A61B7A]/30 bg-[#A61B7A]/10 text-[#A61B7A] text-xs font-semibold flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
          <span>Automatically loading your cloud photos &amp; videos...</span>
        </div>
      )}

      {pickerMessage && (
        <div
          className={`px-4 py-2.5 rounded-xl border text-xs font-medium flex flex-wrap items-center justify-between gap-2 ${
            pickerStatus === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
              : 'bg-[#1074B1]/10 border-[#1074B1]/30 text-[#1074B1]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="break-words">{pickerMessage}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activePickerUri && (
              <a
                href={activePickerUri}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-[#A61B7A] text-white font-bold flex items-center gap-1.5 hover:opacity-95"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Google Photos Picker</span>
              </a>
            )}
            {(() => {
              const match = pickerMessage.match(/https:\/\/console\.developers\.google\.com\/apis\/api\/[^\s)]+/);
              if (!match) return null;
              return (
                <a
                  href={match[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#1074B1] text-white font-bold flex items-center gap-1.5 hover:opacity-95"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Enable API in Cloud Console</span>
                </a>
              );
            })()}
          </div>
        </div>
      )}

      {/* Filter Pills & Album Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'all', label: 'All Moments', icon: <Sparkles className="w-3.5 h-3.5" /> },
              { id: 'albums', label: `Albums (${albums.length})`, icon: <FolderOpen className="w-3.5 h-3.5" /> },
              { id: 'photos', label: 'Photos', icon: <ImageIcon className="w-3.5 h-3.5" /> },
              { id: 'videos', label: 'Videos', icon: <Video className="w-3.5 h-3.5" /> },
              { id: 'gifs', label: 'GIFs', icon: <Film className="w-3.5 h-3.5" /> },
              { id: 'favorites', label: 'Favorites', icon: <Star className="w-3.5 h-3.5" /> },
            ] as Array<{ id: PhotosFilterTab; label: string; icon: React.ReactNode }>
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setFilterTab(tab.id);
                if (tab.id !== 'albums') setActiveAlbumTitle(null);
              }}
              className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors ${
                filterTab === tab.id
                  ? 'bg-[#A61B7A] text-white border-[#A61B7A] shadow-xs'
                  : 'hover:border-[#A61B7A]/50'
              }`}
              style={filterTab === tab.id ? undefined : { borderColor: 'var(--theme-border)' }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void runGooglePhotosSync()}
            disabled={!cloudConnected || isAutoLoading}
            className="min-h-[44px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 hover:border-[#A61B7A]/50 disabled:opacity-50"
            style={{ borderColor: 'var(--theme-border)' }}
            title="Incrementally refresh Google Photos albums & items"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAutoLoading ? 'animate-spin' : ''}`} />
            <span>Sync Delta</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              const title = window.prompt('New Google Photos Album title:');
              if (!title?.trim()) return;
              try {
                const created = await createGooglePhotosAlbum(title.trim());
                setAlbums((prev) => [created, ...prev]);
                setFilterTab('albums');
                setPickerMessage(`Created Google Photos album "${created.title}".`);
              } catch (err: any) {
                setPickerStatus('error');
                setPickerMessage(err?.message || 'Could not create Google Photos album.');
              }
            }}
            disabled={!cloudConnected}
            className="min-h-[44px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 hover:border-[#A61B7A]/50 disabled:opacity-50"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <Plus className="w-3.5 h-3.5 text-[#A61B7A]" />
            <span>New Album</span>
          </button>
        </div>
      </div>

      {activeAlbumTitle && (
        <div className="text-xs font-bold opacity-80 px-1">
          Viewing Album: <span className="text-[#A61B7A]">{activeAlbumTitle}</span>
        </div>
      )}

      {/* Albums Grid */}
      {filterTab === 'albums' ? (
        albums.length === 0 ? (
          <div
            className="p-10 rounded-3xl border border-dashed text-center space-y-2.5"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <FolderOpen className="w-9 h-9 mx-auto opacity-45 text-[#A61B7A]" />
            <h3 className="text-sm font-bold">No Google Photos Albums Loaded Yet</h3>
            <p className="text-xs opacity-70 max-w-md mx-auto">
              Create a new app-managed album with <strong>New Album</strong> or import moments with{' '}
              <strong>Pick from Google Photos</strong>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {albums.map((album) => (
              <button
                key={album.id}
                type="button"
                onClick={async () => {
                  setIsAutoLoading(true);
                  try {
                    const items = await fetchGooglePhotosAlbumItems(album.id);
                    onAddPhotosAssets(items);
                    setActiveAlbumTitle(album.title);
                    setFilterTab('all');
                    setPickerMessage(`Loaded ${items.length} item(s) from "${album.title}".`);
                  } catch (err: any) {
                    setPickerStatus('error');
                    setPickerMessage(err?.message || 'Could not load album items.');
                  } finally {
                    setIsAutoLoading(false);
                  }
                }}
                className="text-left rounded-2xl border overflow-hidden hover:border-[#A61B7A] transition-colors shadow-xs flex flex-col"
                style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
              >
                <div className="aspect-video w-full bg-slate-900/15 overflow-hidden relative">
                  {album.coverThumbnailUrl ? (
                    <img src={album.coverThumbnailUrl} alt={album.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-40">
                      <FolderOpen className="w-8 h-8" />
                    </div>
                  )}
                  {album.isShared && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold">
                      Shared
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-xs font-bold truncate">{album.title}</div>
                  <div className="text-[11px] opacity-65">{album.mediaItemsCount || '0'} items</div>
                </div>
              </button>
            ))}
          </div>
        )
      ) : timelineGroups.length === 0 ? (
        <div
          className="p-12 rounded-3xl border border-dashed text-center space-y-3"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <Camera className="w-10 h-10 mx-auto opacity-45 text-[#A61B7A]" />
          <h3 className="text-sm font-bold">Your Google Photos Timeline is Ready</h3>
          <p className="text-xs opacity-70 max-w-md mx-auto">
            Click <strong>Pick from Google Photos</strong> to import albums/moments via Google Photos Picker API,
            or load a <strong>Google Takeout</strong> folder to preserve original capture dates, GPS pins, and people tags.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {timelineGroups.map((group) => (
            <section key={group.dateKey} className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-extrabold uppercase tracking-wider opacity-75">{group.label}</h3>
                <span className="text-[11px] font-mono opacity-55">{group.items.length} items</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {group.items.map((asset) => {
                  const isGif = asset.extension?.toUpperCase() === 'GIF' || asset.mimeType === 'image/gif';
                  const isVideo = asset.category === 'video';
                  return (
                    <div
                      key={asset.id}
                      className="group rounded-2xl border overflow-hidden flex flex-col shadow-xs hover:shadow-md transition-all"
                      style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
                    >
                      <div
                        className="relative aspect-square bg-slate-900/10 cursor-pointer overflow-hidden"
                        onClick={() => onOpenLightbox(asset, filteredAssets)}
                      >
                        {isVideo ? (
                          <MediaHoverScrubber asset={asset} className="w-full h-full" />
                        ) : (
                          <img
                            src={asset.thumbnailUrl || asset.cloudUrl}
                            alt={asset.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )}

                        {isGif && (
                          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-extrabold">
                            GIF
                          </span>
                        )}

                        {onToggleFavorite && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(asset.id);
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/55 text-white hover:bg-black/80"
                            title="Favorite"
                          >
                            <Star className={`w-3.5 h-3.5 ${asset.rating > 0 ? 'fill-amber-400 text-amber-400' : ''}`} />
                          </button>
                        )}
                      </div>

                      <div className="p-2 flex items-center justify-between gap-1 text-[11px]">
                        <span className="truncate font-semibold flex-1" title={asset.name}>
                          {asset.name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {(isGif || isVideo) && onOpenGifStudio && (
                            <button
                              onClick={() => onOpenGifStudio(asset)}
                              className="p-1 rounded-lg hover:bg-[#A61B7A]/15 text-[#A61B7A]"
                              title="Open in GIF Studio"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isVideo && onOpenVideoEditor && (
                            <button
                              onClick={() => onOpenVideoEditor(asset)}
                              className="p-1 rounded-lg hover:bg-[#1074B1]/15 text-[#1074B1]"
                              title="Open in Video Editor"
                            >
                              <Scissors className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
