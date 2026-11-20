/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-103] Dedicated Multi-Cloud Explorer & File Manager Page
 * Switch seamlessly across external cloud services (Dropbox, OneDrive, SharePoint,
 * Wasabi/S3, iCloud Drive, Flickr, WebDAV/NAS), browse normalized CloudVfsItem folders,
 * and run right-click context actions (Import to Catalog, Transfer to Google Drive, Ask Castor).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Cloud,
  Copy,
  FileText,
  Folder,
  FolderSync,
  Grid,
  Image as ImageIcon,
  KeyRound,
  List,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Video,
} from 'lucide-react';
import type { MediaAsset } from '../types';
import {
  EXTERNAL_CLOUD_SPECS,
  type ExternalCloudConnection,
  type ExternalCloudProviderId,
  getExternalCloudSpec,
  loadExternalCloudConnections,
} from '../services/externalCloudAuth';
import {
  type CloudVfsItem,
  cloudVfsItemToMediaAsset,
  listExternalCloudFolder,
} from '../services/cloudVfsAdapter';
import { ExternalCloudOAuthWizardModal } from './ExternalCloudOAuthWizardModal';

interface ExternalCloudsBrowserViewProps {
  onImportAssetToCatalog?: (asset: MediaAsset) => void;
  onOpenCloudSyncHub?: () => void;
  onAskCastorAboutAsset?: (asset: MediaAsset) => void;
}

export const ExternalCloudsBrowserView: React.FC<ExternalCloudsBrowserViewProps> = ({
  onImportAssetToCatalog,
  onOpenCloudSyncHub,
  onAskCastorAboutAsset,
}) => {
  const [connections, setConnections] = useState<Record<string, ExternalCloudConnection>>(() =>
    loadExternalCloudConnections()
  );
  const [activeProvider, setActiveProvider] = useState<ExternalCloudProviderId>('dropbox');
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [items, setItems] = useState<CloudVfsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [wizardProvider, setWizardProvider] = useState<ExternalCloudProviderId | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: CloudVfsItem } | null>(null);

  const activeSpec = getExternalCloudSpec(activeProvider);
  const activeConnection = connections[activeProvider];

  const loadFolder = async (providerId: ExternalCloudProviderId, targetPath: string) => {
    setIsLoading(true);
    setStatusMessage(null);
    const result = await listExternalCloudFolder(connections[providerId], providerId, targetPath);
    setItems(result.items);
    setCurrentPath(result.currentPath);
    if (result.message) setStatusMessage(result.message);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadFolder(activeProvider, '/');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProvider, activeConnection?.connected, activeConnection?.connectedAt]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.name.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const breadcrumbs = useMemo(() => {
    const parts = currentPath.split('/').filter(Boolean);
    return ['/', ...parts];
  }, [currentPath]);

  const renderItemIcon = (item: CloudVfsItem) => {
    if (item.isFolder) return <Folder className="w-5 h-5 text-amber-500" />;
    if (item.mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-sky-500" />;
    if (item.mimeType.startsWith('video/')) return <Video className="w-5 h-5 text-rose-500" />;
    return <FileText className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 sm:p-6 space-y-4 dt-motion-fade">
      {/* Top Cloud Account Switcher Rail */}
      <div
        className="rounded-3xl border p-4 space-y-3 theme-card"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
              <Cloud className="w-5 h-5 text-[#1557B0] dark:text-sky-400" />
              <span>Multi-Cloud File Explorer</span>
            </h1>
            <p className="text-xs opacity-70">
              Switch between connected external clouds, browse folders via CloudVfsAdapter, and right-click files for non-destructive studio actions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWizardProvider(activeProvider)}
              className="min-h-[42px] px-4 rounded-xl bg-[#1557B0] hover:bg-[#10468f] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <KeyRound className="w-4 h-4" />
              <span>{activeConnection?.connected ? 'Configure OAuth' : `Connect ${activeSpec.name}`}</span>
            </button>
            {onOpenCloudSyncHub && (
              <button
                type="button"
                onClick={onOpenCloudSyncHub}
                className="min-h-[42px] px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/10"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <FolderSync className="w-4 h-4 text-emerald-500" />
                <span>Sync Hub</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {EXTERNAL_CLOUD_SPECS.map((spec) => {
            const conn = connections[spec.id];
            const active = activeProvider === spec.id;
            return (
              <button
                key={spec.id}
                type="button"
                onClick={() => setActiveProvider(spec.id)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                  active
                    ? 'bg-[#1557B0] text-white border-[#1557B0] shadow-xs'
                    : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                style={active ? undefined : { borderColor: 'var(--theme-border)' }}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    conn?.connected ? 'bg-emerald-400' : active ? 'bg-white/60' : 'bg-slate-400'
                  }`}
                />
                <span>{spec.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* File Manager Toolbar: Breadcrumbs + Search + Layout Toggle */}
      <div
        className="rounded-2xl border px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs theme-card"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
      >
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          {breadcrumbs.map((crumb, idx) => {
            const targetPath = idx === 0 ? '/' : '/' + breadcrumbs.slice(1, idx + 1).join('/');
            return (
              <React.Fragment key={targetPath}>
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                <button
                  type="button"
                  onClick={() => void loadFolder(activeProvider, targetPath)}
                  className="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 font-bold"
                >
                  {idx === 0 ? activeSpec.name : crumb}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 opacity-55" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter current folder..."
              className="min-h-[34px] pl-8 pr-3 rounded-xl border text-xs bg-transparent w-44 sm:w-56"
              style={{ borderColor: 'var(--theme-border)' }}
            />
          </div>
          <button
            type="button"
            onClick={() => void loadFolder(activeProvider, currentPath)}
            className="min-h-[34px] min-w-[34px] rounded-xl border flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
            style={{ borderColor: 'var(--theme-border)' }}
            title="Refresh folder"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex items-center border rounded-xl overflow-hidden" style={{ borderColor: 'var(--theme-border)' }}>
            <button
              type="button"
              onClick={() => setViewLayout('grid')}
              className={`p-2 ${viewLayout === 'grid' ? 'bg-[#1557B0] text-white' : 'opacity-70'}`}
              aria-label="Grid view"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewLayout('list')}
              className={`p-2 ${viewLayout === 'list' ? 'bg-[#1557B0] text-white' : 'opacity-70'}`}
              aria-label="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* File Browser Canvas */}
      <div
        className="flex-1 min-h-0 overflow-y-auto rounded-3xl border p-5 theme-card"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
      >
        {!activeConnection?.connected ? (
          <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center space-y-3 p-6">
            <div className="w-16 h-16 rounded-3xl bg-[#1557B0]/10 text-[#1557B0] dark:text-sky-300 flex items-center justify-center">
              <Cloud className="w-8 h-8" />
            </div>
            <h2 className="text-base font-extrabold">{activeSpec.name} Not Connected Yet</h2>
            <p className="text-xs opacity-75 max-w-md leading-relaxed">
              {activeSpec.subtitle}. Launch the OAuth / Credential Wizard to connect your account and browse live files through Drive Therapy’s normalized Cloud VFS.
            </p>
            <button
              type="button"
              onClick={() => setWizardProvider(activeProvider)}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1557B0] hover:bg-[#10468f] text-white text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Open {activeSpec.name} OAuth Wizard</span>
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center space-y-2 p-6 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <div className="font-extrabold text-sm">{activeConnection.accountLabel} Connected</div>
            <p className="opacity-75 max-w-md">
              {statusMessage || 'No files returned for this folder yet. Add an OAuth Access Token in the wizard to query live remote files via /api/clouds/' + activeProvider + '/list.'}
            </p>
          </div>
        ) : viewLayout === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onDoubleClick={() => item.isFolder && void loadFolder(activeProvider, item.path)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, item });
                }}
                className="p-3 rounded-2xl border hover:border-[#1557B0] transition-all cursor-pointer flex flex-col gap-2 text-xs"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <div className="h-24 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center overflow-hidden">
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    renderItemIcon(item)
                  )}
                </div>
                <div className="font-bold truncate">{item.name}</div>
                <div className="text-[10px] opacity-65 font-mono tabular-nums">
                  {item.isFolder ? 'Folder' : `${(item.sizeBytes / 1024).toFixed(1)} KB`}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--theme-border)' }}>
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onDoubleClick={() => item.isFolder && void loadFolder(activeProvider, item.path)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, item });
                }}
                className="py-2.5 px-3 flex items-center justify-between gap-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {renderItemIcon(item)}
                  <span className="font-semibold truncate">{item.name}</span>
                </div>
                <span className="text-[11px] opacity-65 font-mono tabular-nums shrink-0">
                  {item.isFolder ? 'Folder' : `${(item.sizeBytes / 1024).toFixed(1)} KB`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[70] w-56 rounded-2xl border shadow-2xl p-1.5 text-xs space-y-0.5 dt-motion-fade"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 235),
            top: Math.min(contextMenu.y, window.innerHeight - 210),
            backgroundColor: 'var(--theme-surface)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text)',
          }}
        >
          {!contextMenu.item.isFolder && onImportAssetToCatalog && (
            <button
              type="button"
              onClick={() => {
                onImportAssetToCatalog(cloudVfsItemToMediaAsset(contextMenu.item));
                setStatusMessage(`Imported "${contextMenu.item.name}" reference into Drive Therapy Catalog.`);
                setContextMenu(null);
              }}
              className="w-full min-h-[36px] px-3 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 font-semibold text-left"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-500" />
              <span>Add to Drive Therapy Catalog</span>
            </button>
          )}
          {!contextMenu.item.isFolder && onAskCastorAboutAsset && (
            <button
              type="button"
              onClick={() => {
                onAskCastorAboutAsset(cloudVfsItemToMediaAsset(contextMenu.item));
                setContextMenu(null);
              }}
              className="w-full min-h-[36px] px-3 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 font-semibold text-left"
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-500" />
              <span>Ask Castor About File</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(contextMenu.item.path);
              setStatusMessage(`Copied path: ${contextMenu.item.path}`);
              setContextMenu(null);
            }}
            className="w-full min-h-[36px] px-3 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 font-semibold text-left"
          >
            <Copy className="w-3.5 h-3.5 text-sky-500" />
            <span>Copy Cloud Path</span>
          </button>
        </div>
      )}

      <ExternalCloudOAuthWizardModal
        isOpen={Boolean(wizardProvider)}
        providerId={wizardProvider}
        existingConnection={wizardProvider ? connections[wizardProvider] : undefined}
        onClose={() => setWizardProvider(null)}
        onUpdated={(next) => setConnections(next)}
      />
    </div>
  );
};
