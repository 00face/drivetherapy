/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Storage Settings & Granular Flush Modal
 * Provides real-time storage diagnostics, itemized record counts,
 * selective purge controls, and 1-click atomic factory reset.
 */

import React, { useState, useEffect } from 'react';
import {
  Database,
  Trash2,
  HardDrive,
  Cloud,
  Layers,
  KeyRound,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  X,
  Zap,
  RefreshCw,
  Info,
  UserCheck,
  Users,
  PlusCircle,
  Server,
} from 'lucide-react';
import { getStorageStats, CleanupReport } from '../services/storageJanitor';
import { blobRegistry } from '../services/localFileSystem';
import { getOAuthTokenRecord, getTokenRemainingSeconds, isTokenExpired } from '../services/oauthStorage';
import {
  loadAccountProfiles,
  switchActiveAccount,
  removeAccountProfile,
  GoogleAccountProfile,
} from '../services/multiAccountAuth';
import {
  loadStorageBackends,
  persistStorageBackends,
  StorageBackendConfig,
} from '../services/storageProviderRegistry';
import {
  CPU_MINI_MODEL_CATALOG,
  setBrowserMiniModelsEnabled,
} from '../services/localMiniModelEngine';
import { CodexHelpBadge } from './CodexHelpBadge';

interface StorageSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurgeCloud: () => Promise<void>;
  onDismountAllLocal: () => Promise<void>;
  onClearAuth: () => void;
  onCleanOldSessions?: () => void;
  onFlushAll: () => Promise<void>;
  onSmartClean: () => Promise<CleanupReport>;
}

export const StorageSettingsModal: React.FC<StorageSettingsModalProps> = ({
  isOpen,
  onClose,
  onPurgeCloud,
  onDismountAllLocal,
  onClearAuth,
  onCleanOldSessions,
  onFlushAll,
  onSmartClean,
}) => {
  const [stats, setStats] = useState<any>(null);
  const [blobCount, setBlobCount] = useState<number>(0);
  const [tokenRecord, setTokenRecord] = useState<any>(null);
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);
  const [accountProfiles, setAccountProfiles] = useState<GoogleAccountProfile[]>([]);
  const [storageBackends, setStorageBackends] = useState<StorageBackendConfig[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // 2-Click Local CPU Mini-Models Setup State
  const [modelsDir, setModelsDir] = useState<string>(() => {
    try {
      return localStorage.getItem('dt_local_models_dir_v1') || '~/.drivetherapy/models';
    } catch {
      return '~/.drivetherapy/models';
    }
  });
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(() =>
    CPU_MINI_MODEL_CATALOG.filter((m) => m.defaultIncluded).map((m) => m.id)
  );
  const [installedModels, setInstalledModels] = useState<Array<{ id: string; sizeMb: number; status: string }>>([]);
  const [installedTotalMb, setInstalledTotalMb] = useState<number>(0);
  const [isModelsBusy, setIsModelsBusy] = useState<boolean>(false);

  const refreshLocalModelsStatus = async (dirOverride?: string) => {
    const dir = dirOverride ?? modelsDir;
    try {
      const res = await fetch(`/api/models/local-status?dir=${encodeURIComponent(dir)}`);
      if (!res.ok) return;
      const data = await res.json();
      setInstalledModels(Array.isArray(data.installedModels) ? data.installedModels : []);
      setInstalledTotalMb(Number(data.totalSizeMb) || 0);
      if (data.configuredDir) setModelsDir(data.configuredDir);
    } catch {}
  };

  const refreshTelemetry = async () => {
    try {
      const data = await getStorageStats();
      setStats(data);
      setBlobCount(blobRegistry.size());
      const rec = getOAuthTokenRecord();
      const isValid = rec && !isTokenExpired(rec, 0);
      setTokenRecord(isValid ? rec : null);
      if (isValid && rec) {
        setRemainingMinutes(Math.max(0, Math.floor(getTokenRemainingSeconds(rec) / 60)));
      } else {
        setRemainingMinutes(null);
      }
      setAccountProfiles(loadAccountProfiles());
      setStorageBackends(loadStorageBackends());
    } catch (e) {
      console.warn('Telemetry load error:', e);
    }
  };

  const handleSwitchProfile = (profileId: string) => {
    const switched = switchActiveAccount(profileId);
    if (switched) {
      setAccountProfiles(loadAccountProfiles());
      refreshTelemetry();
      setActionNotice({
        message: `Switched active account to ${switched.email}. Re-indexing with active credentials.`,
        type: 'success',
      });
    }
  };

  const handleRemoveProfile = (profileId: string) => {
    const updated = removeAccountProfile(profileId);
    setAccountProfiles(updated);
    refreshTelemetry();
    setActionNotice({
      message: 'Account profile removed from fast switcher.',
      type: 'info',
    });
  };

  const handleToggleBackend = (backendId: string) => {
    const updated = storageBackends.map((b) =>
      b.id === backendId ? { ...b, enabled: !b.enabled } : b
    );
    persistStorageBackends(updated);
    setStorageBackends(updated);
    setActionNotice({
      message: 'Storage backend configuration updated.',
      type: 'success',
    });
  };

  useEffect(() => {
    if (isOpen) {
      refreshTelemetry();
      setActionNotice(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAction = async (action: () => Promise<void> | void, confirmMsg: string, successMsg: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setIsLoading(true);
    setActionNotice(null);
    try {
      await action();
      await refreshTelemetry();
      setActionNotice({ message: successMsg, type: 'success' });
    } catch (err: any) {
      setActionNotice({ message: err.message || 'Operation failed', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunSmartClean = async () => {
    setIsLoading(true);
    setActionNotice(null);
    try {
      const report = await onSmartClean();
      await refreshTelemetry();
      setActionNotice({
        message: `Cleanup finished: Cleaned ${report.prunedAssets} unlinked files, ${report.prunedHandles} stale handles, and ${report.cachesPurged} caches.`,
        type: 'success',
      });
    } catch (err: any) {
      setActionNotice({ message: err.message || 'Smart cleanup failed', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="storage-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="border rounded-2xl lg:rounded-3xl w-full lg:w-[calc(100vw-2rem)] xl:w-[calc(100vw-3rem)] max-w-none h-[92vh] max-h-none flex flex-col shadow-2xl overflow-hidden modal-card theme-card"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-[#1074B1] border border-blue-200 dark:border-blue-900">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 id="storage-settings-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Storage &amp; Cache Cleanup
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inspect local storage, clean temporary files, and manage active sessions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close storage settings"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#1074B1]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* Action Notice */}
          {actionNotice && (
            <div
              role="status"
              className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-3 ${
                actionNotice.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200'
              }`}
            >
              {actionNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              )}
              <span>{actionNotice.message}</span>
            </div>
          )}

          {/* 1. Storage Quota & Footprint Telemetry */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Browser Storage Quota & Usage
              </span>
              <button
                onClick={refreshTelemetry}
                disabled={isLoading}
                className="text-xs text-[#1074B1] hover:underline flex items-center gap-1 font-semibold"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {stats?.storageEstimate ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                  <span>Used: {formatBytes(stats.storageEstimate.usage)}</span>
                  <span>Available Quota: {formatBytes(stats.storageEstimate.quota)}</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#1074B1] to-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(2, stats.storageEstimate.percentage)}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                Storage estimate API unavailable in this browser environment.
              </div>
            )}

            {/* Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <Cloud className="w-3.5 h-3.5 text-[#1074B1]" />
                  <span>Cloud Files</span>
                </div>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">
                  {stats?.cloudAssets ?? 0}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Local Files</span>
                </div>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">
                  {stats?.localAssets ?? 0}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <Layers className="w-3.5 h-3.5 text-purple-500" />
                  <span>Directories</span>
                </div>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">
                  {stats?.folders ?? 0}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>In-Memory Blobs</span>
                </div>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">
                  {blobCount}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Session Control & Telemetry */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Session Control &amp; Authentication State
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  tokenRecord
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {tokenRecord ? 'Live Session Active' : 'Offline / Signed Out'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-[#1074B1] shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {tokenRecord ? tokenRecord.userEmail || 'Google Drive Connected' : 'No Active Session'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {tokenRecord
                      ? remainingMinutes !== null
                        ? `OAuth token expires in ~${remainingMinutes} minutes`
                        : 'Token alive'
                      : 'No live OAuth token in storage'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() =>
                    handleAction(
                      onCleanOldSessions || onClearAuth,
                      '',
                      'Old sessions, expired tokens, and stale sync keys successfully cleaned.'
                    )
                  }
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 min-h-[36px] flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-[#1074B1]"
                  title="Purge expired tokens, old sync flags, and stale session keys"
                >
                  <Trash2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Clean Old Sessions</span>
                </button>

                {tokenRecord && (
                  <button
                    onClick={() =>
                      handleAction(
                        onClearAuth,
                        'Are you sure you want to disconnect and clear your current authentication session?',
                        'Authentication session disconnected.'
                      )
                    }
                    disabled={isLoading}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 min-h-[36px] transition-colors focus-visible:ring-2 focus-visible:ring-rose-500"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>

            {/* Multi-Account Profiles Switcher Deck */}
            {accountProfiles.length > 0 && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#1074B1]" />
                    <span>Registered Google Accounts ({accountProfiles.length})</span>
                  </span>
                  <span className="text-[10px] text-slate-400">1-Click Fast Switch</span>
                </div>
                <div className="space-y-1.5">
                  {accountProfiles.map((acc) => (
                    <div
                      key={acc.id}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs border transition-all ${
                        acc.isActive
                          ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/80'
                          : 'bg-white dark:bg-slate-800/60 border-slate-200/50 dark:border-slate-700/50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                            acc.isActive ? 'bg-[#1074B1] text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {acc.name ? acc.name[0].toUpperCase() : 'G'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate text-[11px]">
                            {acc.email}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{acc.name || 'Workspace Account'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {acc.isActive ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSwitchProfile(acc.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-[#1074B1] hover:text-white text-[10px] font-semibold transition-colors"
                          >
                            Switch
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveProfile(acc.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="Remove profile"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pluggable Cloud & Multi-Storage Provider Expansion */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-purple-500" />
                <span>Multi-Storage Providers &amp; S3 / WebDAV Endpoints</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                Pluggable Registry
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {storageBackends.map((backend) => (
                <div
                  key={backend.id}
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                    backend.enabled
                      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs'
                      : 'bg-slate-100/50 dark:bg-slate-800/30 border-slate-200/40 dark:border-slate-800 text-slate-400 opacity-75'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate text-[11px]">
                      {backend.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {backend.endpoint || (backend.type === 'google-drive' ? 'api.google.com' : 'Direct Host I/O')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleBackend(backend.id)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                      backend.enabled
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {backend.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Smart Maintenance Sweep */}
          <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Smart Cache &amp; Unlinked File Cleanup
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Detects unlinked cached files, releases unused memory, and clears old temporary data
                </p>
              </div>
            </div>
            <button
              onClick={handleRunSmartClean}
              disabled={isLoading}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all min-h-[38px] flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Run Cleanup
            </button>
          </div>

          {/* 4. Granular Purge Actions */}
          <div className="space-y-2">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Granular Purge Options
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() =>
                  handleAction(
                    onPurgeCloud,
                    'Are you sure you want to purge all synced Google Drive metadata? Files on Google Drive remain untouched.',
                    'Synced Google Drive files purged from local database.'
                  )
                }
                disabled={isLoading}
                className="p-3 text-left rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-start gap-2.5 transition-colors min-h-[44px]"
              >
                <Cloud className="w-4 h-4 text-[#1074B1] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white">
                    Purge Synced Cloud Files
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Clears cloud catalog entries without dismounting local folders
                  </div>
                </div>
              </button>

              <button
                onClick={() =>
                  handleAction(
                    onDismountAllLocal,
                    'Are you sure you want to dismount all local OS folders? Original files on your disk remain completely untouched.',
                    'All local folders dismounted and memory blobs released.'
                  )
                }
                disabled={isLoading}
                className="p-3 text-left rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-start gap-2.5 transition-colors min-h-[44px]"
              >
                <HardDrive className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white">
                    Dismount All Local Folders
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Revokes all in-memory Blob URLs and releases disk handles
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* 4b. 2-Click Local CPU Mini-Models Setup & Uninstall */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#52B197]" />
                  <span>Local CPU Mini-Models (Zero-Cost · 2-Click Setup)</span>
                  <CodexHelpBadge topicId="local-models" />
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Optionally include offline CPU models (WASM &amp; Ollama). Clear sizes and trade-offs shown below.
                </p>
              </div>
              <button
                type="button"
                onClick={() => refreshLocalModelsStatus()}
                className="text-[11px] font-semibold text-[#1074B1] hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Check Status</span>
              </button>
            </div>

            {/* Click 1: Set Models Folder */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                1. Models Folder
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={modelsDir}
                  onChange={(e) => {
                    setModelsDir(e.target.value);
                    try {
                      localStorage.setItem('dt_local_models_dir_v1', e.target.value);
                    } catch {}
                  }}
                  placeholder="~/.drivetherapy/models"
                  className="flex-1 min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    const def = '~/.drivetherapy/models';
                    setModelsDir(def);
                    try {
                      localStorage.setItem('dt_local_models_dir_v1', def);
                    } catch {}
                    refreshLocalModelsStatus(def);
                  }}
                  className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Use Default
                </button>
              </div>
            </div>

            {/* Optional Model Checklist with Sizes + With/Without Capability Matrix */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {CPU_MINI_MODEL_CATALOG.map((m) => {
                const checked = selectedModelIds.includes(m.id);
                const isInstalled = installedModels.some((im) => im.id === m.id);
                return (
                  <label
                    key={m.id}
                    className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                      checked
                        ? 'border-[#52B197]/60 bg-[#52B197]/5'
                        : 'border-slate-200 dark:border-slate-800 opacity-80'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedModelIds((prev) =>
                          prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]
                        )
                      }
                      className="mt-0.5 rounded"
                    />
                    <div className="flex-1 min-w-0 text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white truncate">{m.label}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isInstalled && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                              Installed
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 font-mono font-bold text-[10px]">
                            {m.approxSizeMb} MB
                          </span>
                        </div>
                      </div>
                      <div className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                        <strong>With model:</strong> {m.withModelBenefit}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        <strong>Without model:</strong> {m.withoutModelFallback}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Click 2: Setup Button + Uninstall Button */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                Selected: <strong>{selectedModelIds.length}</strong> model(s) ·{' '}
                <strong>
                  {CPU_MINI_MODEL_CATALOG.filter((m) => selectedModelIds.includes(m.id)).reduce(
                    (sum, m) => sum + m.approxSizeMb,
                    0
                  )}{' '}
                  MB
                </strong>
                {installedModels.length > 0 && ` · Installed: ${installedTotalMb} MB`}
              </div>
              <div className="flex items-center gap-2">
                {installedModels.length > 0 && (
                  <button
                    type="button"
                    disabled={isModelsBusy}
                    onClick={async () => {
                      setIsModelsBusy(true);
                      try {
                        const res = await fetch('/api/models/local-uninstall', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ targetDir: modelsDir }),
                        });
                        const data = await res.json();
                        setBrowserMiniModelsEnabled(false);
                        await refreshLocalModelsStatus();
                        setActionNotice({
                          message: `Uninstalled ${data.removedCount || 0} local model(s) cleanly.`,
                          type: 'info',
                        });
                      } catch (err: any) {
                        setActionNotice({ message: err?.message || 'Uninstall failed', type: 'error' });
                      } finally {
                        setIsModelsBusy(false);
                      }
                    }}
                    className="min-h-[38px] px-3 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Uninstall Models</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={isModelsBusy || selectedModelIds.length === 0}
                  onClick={async () => {
                    setIsModelsBusy(true);
                    try {
                      const models = CPU_MINI_MODEL_CATALOG.filter((m) =>
                        selectedModelIds.includes(m.id)
                      ).map((m) => ({
                        id: m.id,
                        runtime: m.runtime,
                        approxSizeMb: m.approxSizeMb,
                      }));
                      const res = await fetch('/api/models/local-setup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ targetDir: modelsDir, models }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Setup failed');
                      setBrowserMiniModelsEnabled(true);
                      await refreshLocalModelsStatus();
                      const warnMsg =
                        Array.isArray(data.warnings) && data.warnings.length > 0
                          ? ` (${data.warnings[0]})`
                          : '';
                      setActionNotice({
                        message: `Setup complete: ${data.installedModels?.length || 0} model(s) configured in ${data.configuredDir}${warnMsg}`,
                        type: 'success',
                      });
                    } catch (err: any) {
                      setActionNotice({ message: err?.message || 'Setup failed', type: 'error' });
                    } finally {
                      setIsModelsBusy(false);
                    }
                  }}
                  className="min-h-[38px] px-4 rounded-xl bg-[#52B197] text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{isModelsBusy ? 'Setting Up...' : '2. Download & Setup Models'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 5. 1-Click Atomic Flush All (Factory Reset) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="p-4 rounded-2xl bg-red-50/50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-xs text-red-900 dark:text-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Flush All Storage & Reset (Factory Fresh)</span>
                </div>
                <div className="text-xs text-red-700/80 dark:text-red-300/80 mt-0.5">
                  Atomically wipes IndexedDB, revokes memory blobs, clears tokens, and flushes caches.
                </div>
              </div>
              <button
                onClick={() =>
                  handleAction(
                    onFlushAll,
                    'WARNING: This will completely wipe all local catalog indexes, dismount all folders, clear authentication sessions, and reset all caches. Original files on Google Drive and your OS disk are 100% untouched. Proceed?',
                    'Factory reset complete. Storage is 100% clean.'
                  )
                }
                disabled={isLoading}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 shadow-sm transition-all min-h-[40px] flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-red-500 shrink-0"
              >
                <Zap className="w-3.5 h-3.5" />
                Flush Everything
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            <span>Drive Therapy is 100% non-destructive. Cloud & OS disks are never modified.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 min-h-[36px]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
