/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Multicloud Direct Cloud-to-Cloud Sync Workbench
 * Phase 1 (Active): Direct Server-Side Google Photos → Google Drive streaming transfer
 * (zero client download/upload) & Native Google Drive cloud-side copy.
 * Phase 2 (Ready Connectors): OneDrive, SharePoint, Dropbox, Wasabi, S3/R2/B2, Flickr, iCloud, WebDAV, FTP.
 */

import React, { useState } from 'react';
import {
  X,
  ArrowRightLeft,
  Cloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  FolderOpen,
  ShieldCheck,
} from 'lucide-react';
import type { FolderNode, MediaAsset } from '../types';
import {
  MULTICLOUD_CONNECTORS,
  copyDriveFilesCloudSide,
  loadMulticloudJobs,
  transferPhotosToDriveDirect,
  type MulticloudJobRecord,
} from '../services/multicloudSyncEngine';
import { createGooglePhotosPickerSession, pollGooglePhotosPickerSession } from '../services/googlePhotos';

interface MulticloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  allAssets: MediaAsset[];
  folders: FolderNode[];
  onSyncAssetsToCatalog?: (assets: MediaAsset[]) => void;
}

export const MulticloudSyncModal: React.FC<MulticloudSyncModalProps> = ({
  isOpen,
  onClose,
  allAssets,
  folders,
  onSyncAssetsToCatalog,
}) => {
  const [sourceMode, setSourceMode] = useState<'google-photos' | 'google-drive'>('google-photos');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [pickedPhotos, setPickedPhotos] = useState<MediaAsset[]>(() =>
    allAssets.filter((a) => a.source === 'photos').slice(0, 50)
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPicking, setIsPicking] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [jobs, setJobs] = useState<MulticloudJobRecord[]>(() => loadMulticloudJobs());

  if (!isOpen) return null;

  const driveFolders = folders.filter((f) => f.source === 'cloud' && f.id !== 'root');
  const candidateAssets =
    sourceMode === 'google-photos'
      ? pickedPhotos
      : allAssets.filter((a) => a.source === 'cloud').slice(0, 50);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLaunchPickerForTransfer = async () => {
    setIsPicking(true);
    setStatusMessage('Opening Google Photos Picker (up to 2,000 items)...');
    try {
      const session = await createGooglePhotosPickerSession(2000);
      window.open(session.pickerUri, 'DriveTherapyPhotosPicker', 'width=960,height=720,resizable=yes');
      setStatusMessage('Select photos in Google Photos and click Done — polling automatically...');

      for (let attempt = 0; attempt < 90; attempt++) {
        await new Promise((r) => setTimeout(r, 2500));
        const polled = await pollGooglePhotosPickerSession(session.id);
        if (polled.mediaItemsSet) {
          setPickedPhotos(polled.items);
          setSelectedIds(new Set(polled.items.slice(0, 50).map((i) => i.id)));
          if (onSyncAssetsToCatalog && polled.items.length > 0) {
            onSyncAssetsToCatalog(polled.items);
          }
          setStatusMessage(`Picked ${polled.items.length} Google Photos ready for direct transfer to Google Drive.`);
          break;
        }
      }
    } catch (err: any) {
      setStatusMessage(`Picker error: ${err?.message || 'Unable to start Google Photos Picker.'}`);
    } finally {
      setIsPicking(false);
    }
  };

  const handleRunTransfer = async () => {
    const targets = candidateAssets.filter((a) => selectedIds.has(a.id));
    if (targets.length === 0) {
      setStatusMessage('Select at least one file to transfer.');
      return;
    }

    setIsTransferring(true);
    setStatusMessage(`Streaming ${targets.length} file(s) directly cloud-to-cloud (no local download)...`);
    const destFolder = driveFolders.find((f) => f.id === selectedFolderId);

    try {
      let job: MulticloudJobRecord;
      if (sourceMode === 'google-photos') {
        const items = targets.map((a) => ({
          id: a.id,
          name: a.name,
          baseUrl: a.cloudUrl || a.previewUrl || a.thumbnailUrl,
          mimeType: a.mimeType || 'image/jpeg',
        }));
        job = await transferPhotosToDriveDirect(
          items,
          selectedFolderId || undefined,
          destFolder?.name || 'My Drive'
        );
      } else {
        const items = targets.map((a) => ({
          id: a.id,
          driveFileId: a.id.replace(/^drive_/, ''),
          name: a.name,
        }));
        job = await copyDriveFilesCloudSide(
          items,
          selectedFolderId || undefined,
          destFolder?.name || 'My Drive'
        );
      }

      setJobs((prev) => [job, ...prev].slice(0, 20));
      setStatusMessage(
        `Transfer complete: ${job.transferredCount}/${job.totalItems} copied directly to ${job.destinationFolderName}.`
      );
    } catch (err: any) {
      setStatusMessage(`Transfer error: ${err?.message || 'Transfer failed'}`);
    } finally {
      setIsTransferring(false);
    }
  };

  const activeConnectors = MULTICLOUD_CONNECTORS.filter((c) => c.status === 'active');
  const phase2Connectors = MULTICLOUD_CONNECTORS.filter((c) => c.status === 'phase2-ready');

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="multicloud-sync-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[88vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between gap-3 shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#1074B1] to-[#52B197] flex items-center justify-center text-white shadow-sm">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="multicloud-sync-title" className="text-sm font-extrabold">
                  Multicloud Direct Cloud-to-Cloud Sync
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  Google Workspace Core Active
                </span>
              </div>
              <p className="text-xs opacity-70">
                Stream Google Photos → Google Drive or copy Drive → Drive directly without local downloads (Non-Destructive)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10"
            aria-label="Close Multicloud Sync"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 2-Pane Source -> Destination Workbench */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Source Pane */}
            <div className="p-4 rounded-2xl border space-y-3" style={{ borderColor: 'var(--theme-border)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider opacity-75">
                  1. Source Cloud
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setSourceMode('google-photos')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                      sourceMode === 'google-photos'
                        ? 'bg-[#1074B1] text-white border-[#1074B1]'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={sourceMode !== 'google-photos' ? { borderColor: 'var(--theme-border)' } : undefined}
                  >
                    Google Photos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceMode('google-drive')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                      sourceMode === 'google-drive'
                        ? 'bg-[#1074B1] text-white border-[#1074B1]'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={sourceMode !== 'google-drive' ? { borderColor: 'var(--theme-border)' } : undefined}
                  >
                    Google Drive
                  </button>
                </div>
              </div>

              {sourceMode === 'google-photos' && (
                <button
                  type="button"
                  onClick={handleLaunchPickerForTransfer}
                  disabled={isPicking}
                  className="w-full py-2 px-3 rounded-xl bg-[#1074B1]/12 border border-[#1074B1]/30 text-[#1074B1] dark:text-sky-300 text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#1074B1]/20 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPicking ? 'animate-spin' : ''}`} />
                  <span>{isPicking ? 'Waiting for Google Photos Picker...' : 'Pick Google Photos (up to 2,000)'}</span>
                </button>
              )}

              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {candidateAssets.length === 0 ? (
                  <p className="text-xs opacity-65 py-4 text-center">
                    {sourceMode === 'google-photos'
                      ? 'No Google Photos picked yet. Click "Pick Google Photos" above.'
                      : 'No Google Drive files in catalog yet. Run a scan or search Drive in Castor Chat.'}
                  </p>
                ) : (
                  candidateAssets.map((asset) => {
                    const checked = selectedIds.has(asset.id);
                    return (
                      <label
                        key={asset.id}
                        className="flex items-center gap-2 p-1.5 rounded-lg border text-xs cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                        style={{ borderColor: 'var(--theme-border)' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(asset.id)}
                          className="accent-[#1074B1]"
                        />
                        <span className="truncate flex-1 font-medium">{asset.name}</span>
                        <span className="text-[10px] opacity-60 uppercase">{asset.category}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Destination Pane */}
            <div className="p-4 rounded-2xl border space-y-3 flex flex-col justify-between" style={{ borderColor: 'var(--theme-border)' }}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider opacity-75">
                    2. Destination Cloud (Google Drive)
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Non-Destructive Copy
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold opacity-75 block mb-1">
                    Target Google Drive Folder
                  </label>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-[#1074B1] shrink-0" />
                    <select
                      value={selectedFolderId}
                      onChange={(e) => setSelectedFolderId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border text-xs"
                      style={{
                        backgroundColor: 'var(--theme-surface)',
                        borderColor: 'var(--theme-border)',
                        color: 'var(--theme-text)',
                      }}
                    >
                      <option value="">My Drive (Root)</option>
                      {driveFolders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {statusMessage && (
                  <div
                    className="p-2.5 rounded-xl border text-xs flex items-start gap-2"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <Cloud className="w-4 h-4 text-[#1074B1] shrink-0 mt-0.5" />
                    <span>{statusMessage}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleRunTransfer}
                disabled={isTransferring || selectedIds.size === 0}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#1074B1] to-[#52B197] text-white text-xs font-bold shadow-sm hover:opacity-95 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <ArrowRightLeft className={`w-4 h-4 ${isTransferring ? 'animate-spin' : ''}`} />
                <span>
                  {isTransferring
                    ? 'Streaming Cloud-to-Cloud...'
                    : `Transfer ${selectedIds.size} Selected to Google Drive`}
                </span>
              </button>
            </div>
          </div>

          {/* Recent Transfer History */}
          {jobs.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider opacity-75">
                Recent Cloud-to-Cloud Transfers
              </h3>
              <div className="space-y-1.5">
                {jobs.slice(0, 4).map((job) => (
                  <div
                    key={job.id}
                    className="p-2.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <div className="flex items-center gap-2">
                      {job.failedCount === 0 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <span className="font-bold">
                        {job.sourceConnector} → {job.destinationConnector} ({job.destinationFolderName})
                      </span>
                      <span className="opacity-70">
                        {job.transferredCount}/{job.totalItems} transferred
                      </span>
                    </div>
                    {job.results.find((r) => r.webViewLink)?.webViewLink && (
                      <a
                        href={job.results.find((r) => r.webViewLink)!.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-[#1074B1] dark:text-sky-300 flex items-center gap-1 hover:underline"
                      >
                        <span>Open in Drive</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multicloud Connector Matrix (Google Workspace Active + Phase 2 External Clouds) */}
          <div className="pt-3 border-t space-y-2.5" style={{ borderColor: 'var(--theme-border)' }}>
            <h3 className="text-xs font-extrabold uppercase tracking-wider opacity-75">
              Multicloud Connector Registry ({activeConnectors.length} Google Workspace Active · {phase2Connectors.length} External Clouds Queued for Phase 2)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {MULTICLOUD_CONNECTORS.map((conn) => (
                <div
                  key={conn.id}
                  className="p-2.5 rounded-xl border text-xs space-y-1"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold truncate">{conn.name}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                        conn.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-500/15 opacity-75'
                      }`}
                    >
                      {conn.status === 'active' ? 'Active' : 'Phase 2'}
                    </span>
                  </div>
                  <p className="text-[10px] opacity-65 line-clamp-2">{conn.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
