/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Butler Concierge Cockpit Modal
 * Dignified, unified command center for Google Workspace, Drive, and Music services.
 * Features:
 * - Live Google Service Status Matrix (Drive, Workspace, Music, Gemini)
 * - Proactive token health indicator with countdown & silent refresh
 * - Dynamic Multi-Account switcher with verified schema guarantee
 * - Quick action launchpads (Instant Google Meet, Google Chat, Drive Stream, Sync)
 */

import React, { useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  HardDrive,
  MessageSquare,
  Video,
  Music,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Check,
  Calendar,
  PhoneCall,
  UserCheck,
  LogOut,
  Zap,
} from 'lucide-react';
import { butlerEngine } from '../services/butler/butlerEngine';
import { flushAllStorage } from '../services/storageJanitor';
import { ButlerState, ButlerServiceId } from '../services/butler/types';

interface ButlerConciergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMusicPlayer?: () => void;
  onOpenCopilot?: () => void;
  onOpenStorageSettings?: () => void;
}

export const ButlerConciergeModal: React.FC<ButlerConciergeModalProps> = ({
  isOpen,
  onClose,
  onOpenMusicPlayer,
  onOpenCopilot,
  onOpenStorageSettings,
}) => {
  const [butlerState, setButlerState] = useState<ButlerState>(() => butlerEngine.getState());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [defaultScanMode, setDefaultScanMode] = useState<'quick' | 'deep'>(() => {
    try {
      return localStorage.getItem('dt_default_scan_mode_v1') === 'deep' ? 'deep' : 'quick';
    } catch {
      return 'quick';
    }
  });

  useEffect(() => {
    const unsub = butlerEngine.subscribe((s) => setButlerState(s));
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const { activeAccount, accounts, services, tokenTimeRemainingSeconds, isRefreshingToken } =
    butlerState;

  const handleSilentRefresh = async () => {
    setIsRefreshing(true);
    try {
      await butlerEngine.refreshActiveToken();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleServiceAuth = (serviceId: ButlerServiceId) => {
    butlerEngine.authenticateService(serviceId);
  };

  const formatRemainingTime = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return 'Expired';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-5 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-3">
            {activeAccount?.avatarUrl ? (
              <img
                src={activeAccount.avatarUrl}
                alt={activeAccount.name || 'User Avatar'}
                className="w-10 h-10 rounded-full border-2 border-[#1074B1] object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#1074B1]/15 border border-[#1074B1]/30 flex items-center justify-center text-[#1074B1] font-bold text-sm shrink-0">
                {(activeAccount?.name || activeAccount?.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="font-bold text-base leading-tight">Butler Concierge</h2>
              <p className="text-xs opacity-65 leading-tight mt-0.5 font-mono">
                Google Workspace &amp; User Options Orchestrator
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Active Google Account & Storage Quota Banner */}
          <div
            className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            style={{
              backgroundColor: 'var(--theme-surface-subtle)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-700 shrink-0 flex items-center justify-center font-bold text-white text-base">
                {activeAccount?.avatarUrl ? (
                  <img src={activeAccount.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{activeAccount?.name?.charAt(0) || 'G'}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm truncate">{activeAccount?.name || 'Google User'}</h3>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                    Active Profile
                  </span>
                </div>
                <p className="text-xs opacity-60 font-mono truncate">{activeAccount?.email}</p>
                {activeAccount?.quota && (
                  <p className="text-[11px] opacity-75 mt-0.5">
                    Storage: <b>{(activeAccount.quota.usage / (1024 * 1024 * 1024)).toFixed(2)} GB</b> of{' '}
                    {activeAccount.quota.limit > 0
                      ? `${(activeAccount.quota.limit / (1024 * 1024 * 1024)).toFixed(2)} GB`
                      : 'Unlimited'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleSilentRefresh}
                disabled={isRefreshing || isRefreshingToken}
                className="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors opacity-80 hover:opacity-100"
                style={{ borderColor: 'var(--theme-border)' }}
                title="Silent Token Refresh"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-sky-500 ${isRefreshing || isRefreshingToken ? 'animate-spin' : ''}`}
                />
                <span>Refresh</span>
              </button>
              <button
                onClick={() => handleServiceAuth('drive')}
                className="px-3 py-1.5 rounded-xl border text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                style={{ borderColor: 'var(--theme-border)' }}
                title="Sign in to an additional concurrent Google account"
              >
                + Add Account
              </button>
              {activeAccount && (
                <button
                  onClick={async () => {
                    await butlerEngine.signOutAccount(activeAccount.email);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-rose-500/40 text-rose-500 text-xs font-semibold hover:bg-rose-500/10 transition-colors"
                  title={`Sign out ${activeAccount.email}`}
                >
                  Sign Out
                </button>
              )}
            </div>
          </div>

          {/* [WO-113] Concurrent Multi-Account Switcher (Strict Per-Account Isolation) */}
          {butlerState.accounts.length > 0 && (
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                backgroundColor: 'var(--theme-surface-subtle)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">
                  Signed-In Accounts ({butlerState.accounts.length}) · Strict Isolation
                </span>
                {butlerState.accounts.length > 1 && (
                  <button
                    type="button"
                    onClick={async () => {
                      await butlerEngine.signOutAllAccounts();
                    }}
                    className="text-[11px] font-bold text-rose-500 hover:underline"
                  >
                    Sign Out All
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {butlerState.accounts.map((acc) => {
                  const isCurrent = activeAccount?.email === acc.email;
                  return (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs"
                      style={{
                        borderColor: isCurrent ? 'rgba(16, 185, 129, 0.45)' : 'var(--theme-border)',
                      }}
                    >
                      <div className="min-w-0">
                        <div className="font-bold truncate">{acc.name}</div>
                        <div className="text-[11px] opacity-70 truncate">{acc.email}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isCurrent ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                            Active
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              await butlerEngine.switchAccountByEmail(acc.email);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#1074B1] text-white text-[11px] font-bold hover:opacity-95"
                          >
                            Switch
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await butlerEngine.signOutAccount(acc.email);
                          }}
                          className="px-2 py-1 rounded-lg border border-rose-500/35 text-rose-500 text-[11px] font-semibold hover:bg-rose-500/10"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Connected Google Services Matrix */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2 px-1">
              Google Services Matrix
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. Google Drive */}
              <div
                className="p-3.5 rounded-2xl border flex flex-col justify-between"
                style={{
                  backgroundColor: 'var(--theme-surface-subtle)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-sky-500" />
                      <span className="font-bold text-xs">Google Drive</span>
                    </div>
                    {services.drive.status === 'connected' ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                        <ShieldCheck className="w-3.5 h-3.5" /> Ready
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
                        <ShieldAlert className="w-3.5 h-3.5" /> Disconnected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-70 line-clamp-2">{services.drive.description}</p>
                </div>
                <div className="mt-3 pt-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--theme-border)' }}>
                  <button
                    onClick={() => handleServiceAuth('drive')}
                    className="text-[11px] font-bold text-sky-500 hover:underline flex items-center gap-1"
                  >
                    <span>{services.drive.status === 'connected' ? 'Re-authorize' : 'Connect Drive'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 2. Google Workspace */}
              <div
                className="p-3.5 rounded-2xl border flex flex-col justify-between"
                style={{
                  backgroundColor: 'var(--theme-surface-subtle)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-500" />
                      <span className="font-bold text-xs">Google Workspace</span>
                    </div>
                    {services.workspace.status === 'connected' ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                        <ShieldCheck className="w-3.5 h-3.5" /> Ready
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
                        <ShieldAlert className="w-3.5 h-3.5" /> Offline
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-70 line-clamp-2">{services.workspace.description}</p>
                </div>
                <div className="mt-3 pt-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--theme-border)' }}>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => butlerEngine.workspace.openMeet()}
                      className="text-[11px] font-bold text-emerald-500 hover:underline flex items-center gap-1"
                    >
                      <Video className="w-3 h-3" /> Meet
                    </button>
                    <span className="opacity-30">•</span>
                    <button
                      onClick={() => butlerEngine.workspace.openChat()}
                      className="text-[11px] font-bold text-emerald-500 hover:underline flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" /> Chat
                    </button>
                  </div>
                  <button
                    onClick={() => handleServiceAuth('workspace')}
                    className="text-[11px] font-bold text-sky-500 hover:underline"
                  >
                    Authorize
                  </button>
                </div>
              </div>

              {/* 3. Google Music & Media */}
              <div
                className="p-3.5 rounded-2xl border flex flex-col justify-between"
                style={{
                  backgroundColor: 'var(--theme-surface-subtle)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-rose-500" />
                      <span className="font-bold text-xs">Google Music</span>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                      <ShieldCheck className="w-3.5 h-3.5" /> Active
                    </span>
                  </div>
                  <p className="text-[11px] opacity-70 line-clamp-2">{services.music.description}</p>
                </div>
                <div className="mt-3 pt-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--theme-border)' }}>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenMusicPlayer?.();
                    }}
                    className="text-[11px] font-bold text-rose-500 hover:underline flex items-center gap-1"
                  >
                    <span>Launch Player</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleServiceAuth('music')}
                    className="text-[11px] font-semibold opacity-75 hover:opacity-100 hover:underline"
                  >
                    Link YouTube
                  </button>
                </div>
              </div>

              {/* 4. Gemini AI Assistant */}
              <div
                className="p-3.5 rounded-2xl border flex flex-col justify-between"
                style={{
                  backgroundColor: 'var(--theme-surface-subtle)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-500" />
                      <span className="font-bold text-xs">Gemini 3.8 Studio</span>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                      <ShieldCheck className="w-3.5 h-3.5" /> Online
                    </span>
                  </div>
                  <p className="text-[11px] opacity-70 line-clamp-2">{services.gemini.description}</p>
                </div>
                <div className="mt-3 pt-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--theme-border)' }}>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenCopilot?.();
                    }}
                    className="text-[11px] font-bold text-violet-500 hover:underline flex items-center gap-1"
                  >
                    <span>Open Copilot</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Accounts Directory (Verified & Sanitized) */}
          {accounts.length > 1 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2 px-1">
                Verified Account Directory ({accounts.length})
              </h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {accounts.map((acc) => {
                  const isCurrent = acc.id === activeAccount?.id;
                  return (
                    <button
                      key={acc.id}
                      onClick={() => butlerEngine.switchAccount(acc.id)}
                      className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition-all ${
                        isCurrent
                          ? 'bg-sky-500/15 border-sky-500/40 font-bold'
                          : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-700 shrink-0 flex items-center justify-center text-xs font-bold text-white">
                          {acc.avatarUrl ? (
                            <img src={acc.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{acc.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate leading-tight">{acc.name}</p>
                          <p className="text-[11px] opacity-60 font-mono truncate">{acc.email}</p>
                        </div>
                      </div>
                      {isCurrent && <Check className="w-4 h-4 text-sky-500 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* User Options & Quick Preferences */}
          <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-60">
              User Options &amp; Workspace Preferences
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenStorageSettings?.();
                }}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#1074B1] text-left font-semibold transition-colors"
              >
                Storage, Sessions &amp; Local CPU Models →
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = defaultScanMode === 'deep' ? 'quick' : 'deep';
                  setDefaultScanMode(next);
                  try {
                    localStorage.setItem('dt_default_scan_mode_v1', next);
                  } catch {}
                  butlerEngine.hydrateFromStorage();
                }}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#52B197] text-left font-semibold transition-colors"
              >
                Default Scan Mode: <span className="text-[#1074B1] uppercase">{defaultScanMode === 'deep' ? 'Deep' : 'Quick 300'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Telemetry */}
        <div
          className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs opacity-75 shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-2 font-mono">
            <span>Token Validity:</span>
            <span className="font-bold tabular-nums text-sky-500">
              {formatRemainingTime(tokenTimeRemainingSeconds)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                await flushAllStorage();
                window.location.reload();
              }}
              className="text-[11px] font-semibold text-rose-500 hover:underline"
            >
              Flush Caches & Re-sync
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl font-bold bg-sky-600 hover:bg-sky-500 text-white transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
