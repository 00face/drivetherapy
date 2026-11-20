/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-102] Additional Cloud Storage & Cloud-to-Cloud Syncing Hub
 * First-class MiniDock studio combining:
 *  - Multi-provider Cloud Gallery (Google Drive, Google Photos, GCS, Local OS + Dropbox, OneDrive, SharePoint, iCloud, Wasabi/S3, WebDAV/SFTP)
 *  - Dual-Pane Cloud-to-Cloud Transfer Pipeline with Dry-Run & Non-Destructive Copy
 *  - Direct Server-to-Server Google Photos -> Google Drive launcher
 */

import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  CloudCog,
  FolderSync,
  HardDrive,
  Layers,
  Play,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { MediaAsset } from '../types';
import {
  MULTICLOUD_CONNECTORS,
  type MulticloudConnectorDef,
} from '../services/multicloudSyncEngine';
import {
  loadExternalCloudConnections,
  type ExternalCloudProviderId,
} from '../services/externalCloudAuth';
import { ExternalCloudOAuthWizardModal } from './ExternalCloudOAuthWizardModal';
import { CloudPowerSuitePanel } from './CloudPowerSuitePanel';

interface CloudSyncHubViewProps {
  isGoogleConnected: boolean;
  userEmail?: string | null;
  allAssets?: MediaAsset[];
  onOpenDirectTransferModal: () => void;
  onOpenTakeout?: () => void;
  onOpenExternalClouds?: () => void;
}

interface QueuedSyncJob {
  id: string;
  source: string;
  destination: string;
  mode: 'one-way-copy' | 'dedupe-sync' | 'dry-run';
  status: 'queued' | 'simulated' | 'ready';
  createdAt: string;
}

export const CloudSyncHubView: React.FC<CloudSyncHubViewProps> = ({
  isGoogleConnected,
  userEmail,
  allAssets = [],
  onOpenDirectTransferModal,
  onOpenTakeout,
  onOpenExternalClouds,
}) => {
  const [sourceProvider, setSourceProvider] = useState<string>('google-photos');
  const [destProvider, setDestProvider] = useState<string>('google-drive');
  const [syncMode, setSyncMode] = useState<'one-way-copy' | 'dedupe-sync' | 'dry-run'>('dedupe-sync');
  const [jobs, setJobs] = useState<QueuedSyncJob[]>([]);
  const [externalConnections, setExternalConnections] = useState(() => loadExternalCloudConnections());
  const [wizardProvider, setWizardProvider] = useState<ExternalCloudProviderId | null>(null);

  const mapConnectorToExternalId = (id: string): ExternalCloudProviderId | null => {
    const aliasMap: Record<string, ExternalCloudProviderId> = {
      dropbox: 'dropbox',
      onedrive: 'onedrive',
      sharepoint: 'sharepoint',
      wasabi: 'wasabi',
      'wasabi-s3': 'wasabi',
      icloud: 'icloud-drive',
      'icloud-drive': 'icloud-drive',
      flickr: 'flickr',
      'webdav-sftp': 'webdav-sftp',
    };
    return aliasMap[id] ?? null;
  };

  const tier1Providers: MulticloudConnectorDef[] = MULTICLOUD_CONNECTORS.filter((p) => p.status === 'active');
  const tier2Providers: MulticloudConnectorDef[] = MULTICLOUD_CONNECTORS.filter((p) => p.status !== 'active');

  const handleCreatePipelineJob = async () => {
    if (
      (sourceProvider === 'google-photos' && destProvider === 'google-drive') ||
      (sourceProvider === 'google-drive' && destProvider === 'google-drive')
    ) {
      onOpenDirectTransferModal();
      return;
    }
    try {
      const res = await fetch('/api/clouds/transfer', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceProvider,
          destProvider,
          mode: syncMode,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { job?: { id: string; status: string } };
        const nextJob: QueuedSyncJob = {
          id: data.job?.id || `sync_${Date.now()}`,
          source: sourceProvider,
          destination: destProvider,
          mode: syncMode,
          status: data.job?.status === 'completed' ? 'ready' : 'queued',
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setJobs((prev) => [nextJob, ...prev]);
        return;
      }
    } catch {}
    const nextJob: QueuedSyncJob = {
      id: `sync_${Date.now()}`,
      source: sourceProvider,
      destination: destProvider,
      mode: syncMode,
      status: syncMode === 'dry-run' ? 'simulated' : 'queued',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setJobs((prev) => [nextJob, ...prev]);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5 dt-motion-fade">
      {/* Studio Header */}
      <div
        className="rounded-3xl border p-5 flex flex-wrap items-center justify-between gap-4 theme-card"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1557B0] to-[#52B197] text-white flex items-center justify-center shadow-sm shrink-0">
            <FolderSync className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-extrabold tracking-tight">Cloud-to-Cloud Sync Hub</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                Zero-Download Server Relay
              </span>
            </div>
            <p className="text-xs opacity-75">
              Transfer Google Photos to Google Drive directly server-to-server, and stage cross-cloud connectors (Dropbox, OneDrive, iCloud, Wasabi/S3, WebDAV).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenDirectTransferModal}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1557B0] hover:bg-[#10468f] text-white text-xs font-bold flex items-center gap-2 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>Launch Direct Google Photos → Drive Transfer</span>
          </button>
          {onOpenTakeout && (
            <button
              type="button"
              onClick={onOpenTakeout}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-bold hover:bg-black/5 dark:hover:bg-white/10"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              Open Takeout Studio
            </button>
          )}
        </div>
      </div>

      {/* Dual-Pane Cloud-to-Cloud Pipeline Builder */}
      <div
        className="rounded-3xl border p-5 space-y-4 theme-card"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-extrabold flex items-center gap-2">
            <CloudCog className="w-4 h-4 text-[#1557B0] dark:text-sky-400" />
            <span>Dual-Pane Cloud-to-Cloud Pipeline</span>
          </h2>
          <span className="text-[11px] opacity-70 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Non-destructive copy · Original cloud items never deleted</span>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-11 gap-3 items-center">
          {/* Source Cloud */}
          <div className="lg:col-span-4 p-4 rounded-2xl border space-y-2" style={{ borderColor: 'var(--theme-border)' }}>
            <label className="text-[11px] font-bold uppercase tracking-wider opacity-70 block">
              Source Cloud
            </label>
            <select
              value={sourceProvider}
              onChange={(e) => setSourceProvider(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl border text-xs font-semibold bg-transparent"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              {MULTICLOUD_CONNECTORS.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                  {p.name} {p.status === 'active' ? '• Live' : '• Connector Ready'}
                </option>
              ))}
            </select>
          </div>

          {/* Center Transfer Controls */}
          <div className="lg:col-span-3 flex flex-col items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl border w-full justify-center" style={{ borderColor: 'var(--theme-border)' }}>
              {(
                [
                  { id: 'dedupe-sync', label: 'Dedupe' },
                  { id: 'one-way-copy', label: 'Copy' },
                  { id: 'dry-run', label: 'Dry Run' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSyncMode(m.id)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold flex-1 transition-colors ${
                    syncMode === m.id ? 'bg-[#1557B0] text-white' : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleCreatePipelineJob}
              className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run Transfer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Destination Cloud */}
          <div className="lg:col-span-4 p-4 rounded-2xl border space-y-2" style={{ borderColor: 'var(--theme-border)' }}>
            <label className="text-[11px] font-bold uppercase tracking-wider opacity-70 block">
              Destination Cloud
            </label>
            <select
              value={destProvider}
              onChange={(e) => setDestProvider(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl border text-xs font-semibold bg-transparent"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              {MULTICLOUD_CONNECTORS.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                  {p.name} {p.status === 'active' ? '• Live' : '• Connector Ready'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {jobs.length > 0 && (
          <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--theme-border)' }}>
            <div className="text-[11px] font-bold opacity-75">Recent Pipeline Runs</div>
            {jobs.map((job) => (
              <div
                key={job.id}
                className="px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <span className="font-semibold">
                  {job.source} → {job.destination} ({job.mode})
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  {job.status} · {job.createdAt}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connected Google Workspace & Additional Cloud Storage Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className="rounded-3xl border p-5 space-y-3 theme-card"
          style={{
            backgroundColor: 'var(--theme-surface)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text)',
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold flex items-center gap-2">
              <Cloud className="w-4 h-4 text-[#1557B0] dark:text-sky-400" />
              <span>Active Google Workspace Clouds</span>
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              {isGoogleConnected ? userEmail || 'OAuth Active' : 'Sign in to Sync'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {tier1Providers.map((provider) => (
              <div
                key={provider.id}
                className="p-3 rounded-2xl border flex items-start gap-2.5 text-xs"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-bold truncate">{provider.name}</div>
                  <div className="text-[11px] opacity-70 line-clamp-2">{provider.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-3xl border p-5 space-y-3 theme-card"
          style={{
            backgroundColor: 'var(--theme-surface)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text)',
          }}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-extrabold flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-500" />
              <span>Additional External Cloud Connectors</span>
            </h3>
            <div className="flex items-center gap-1.5">
              {onOpenExternalClouds && (
                <button
                  type="button"
                  onClick={onOpenExternalClouds}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#1557B0] text-white hover:bg-[#10468f]"
                >
                  Open Multi-Cloud Explorer →
                </button>
              )}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300">
                OAuth / S3 / WebDAV
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {tier2Providers.map((provider) => {
              const extId = mapConnectorToExternalId(provider.id);
              const conn = extId ? externalConnections[extId] : undefined;
              const isConnected = Boolean(conn?.connected);
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => {
                    if (extId) setWizardProvider(extId);
                  }}
                  className="p-3 rounded-2xl border flex items-start gap-2.5 text-xs text-left transition-colors hover:border-[#1557B0] hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ borderColor: isConnected ? 'rgba(16, 185, 129, 0.5)' : 'var(--theme-border)' }}
                >
                  {isConnected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <HardDrive className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-bold truncate">{provider.name}</span>
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ${
                          isConnected
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
                        }`}
                      >
                        {isConnected ? 'Connected' : 'Configure →'}
                      </span>
                    </div>
                    <div className="text-[11px] opacity-70 line-clamp-2 mt-0.5">
                      {isConnected && conn?.accountLabel ? conn.accountLabel : provider.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* [WO-115] Cloud Power Suite (Schedules, Virtual Mount, E2EE Vault, Treemap, Dedupe, Rules, Audit, Proofing & Mobile) */}
      <CloudPowerSuitePanel allAssets={allAssets} />

      {wizardProvider && (
        <ExternalCloudOAuthWizardModal
          providerId={wizardProvider}
          isOpen={true}
          existingConnection={externalConnections[wizardProvider]}
          onClose={() => setWizardProvider(null)}
          onUpdated={(next) => setExternalConnections(next)}
        />
      )}
    </div>
  );
};
