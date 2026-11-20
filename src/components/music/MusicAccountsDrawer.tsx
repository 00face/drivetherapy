/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Music Accounts Drawer: generic, data-driven account switcher (pinned header, scrollable list, pinned actions).
 */

import React, { useState } from 'react';
import { ArrowLeft, Check, UserPlus, LogOut, RefreshCw, Plus } from 'lucide-react';
import type { GoogleMusicSubAccount } from '../../services/googleMusicEngine';
import { groupSubAccountsByGoogleAccount, AccountGroup } from '../../services/music/musicAccounts';

interface MusicAccountsDrawerProps {
  subAccounts: GoogleMusicSubAccount[];
  activeAccountId: string;
  primaryUser: { name: string; email: string };
  onSwitch: (accountId: string) => void;
  onClose: () => void;
  onAddAccount?: () => void;
  onConnectOAuth?: () => void;
  onRefreshChannels?: () => Promise<unknown> | void;
  onSignOut: () => void;
}

export const MusicAccountsDrawer: React.FC<MusicAccountsDrawerProps> = ({
  subAccounts,
  activeAccountId,
  primaryUser,
  onSwitch,
  onClose,
  onAddAccount,
  onConnectOAuth,
  onRefreshChannels,
  onSignOut,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefreshChannels || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefreshChannels();
    } finally {
      setIsRefreshing(false);
    }
  };

  const accountGroups: AccountGroup[] = groupSubAccountsByGoogleAccount(subAccounts, primaryUser.email);
  const primaryGroup = accountGroups.find((g) => g.isPrimary) || accountGroups[0] || {
    email: primaryUser.email,
    name: primaryUser.name,
    isPrimary: true,
    channels: subAccounts,
  };
  const otherGroups = accountGroups.filter((g) => g !== primaryGroup);

  const renderChannelRow = (account: GoogleMusicSubAccount) => {
    if (!account || typeof account.id !== 'string') return null;
    const isActive = account.id === activeAccountId;

    return (
      <button
        key={account.id}
        onClick={() => onSwitch(account.id)}
        className={`w-full p-2.5 rounded-2xl flex items-center justify-between text-left transition-all ${
          isActive
            ? 'bg-sky-500/15 border border-sky-500/40 font-bold'
            : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-85 hover:opacity-100 border border-transparent'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar (Image 1 Parity) */}
          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-slate-700 flex items-center justify-center text-white text-sm font-bold shadow-xs">
            {account.avatarUrl ? (
              <img
                src={account.avatarUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{account.name.charAt(0)}</span>
            )}
          </div>

          {/* Name, Handle & Role */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold truncate leading-tight">
                {account.name}
              </span>
              {account.accountType === 'local' && (
                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                  Local
                </span>
              )}
              {account.accountType === 'workspace_sub' && (
                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-purple-500/15 text-purple-500 border border-purple-500/30">
                  Google Drive
                </span>
              )}
            </div>
            <div className="text-[11px] opacity-60 truncate font-mono">
              {account.email}
            </div>
            <div className="text-[10px] opacity-50 truncate mt-0.5">
              {account.roleLabel || 'Google Drive Account'}
            </div>
          </div>
        </div>

        {/* Checkmark on Active Channel (Image 1 Parity) */}
        {isActive && (
          <Check className="w-5 h-5 text-sky-500 dark:text-sky-400 shrink-0 ml-2" />
        )}
      </button>
    );
  };

  return (
    <div
      className="absolute inset-0 z-50 bg-black/25 backdrop-blur-[2px] flex justify-end animate-in fade-in"
      onClick={() => onClose()}
    >
      <div
        className="w-full max-w-sm h-full border-l p-5 shadow-2xl flex flex-col max-h-full overflow-hidden animate-in slide-in-from-right duration-200"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header (Pinned Top - Image 1 Parity) */}
        <div className="shrink-0 space-y-3 pb-3 border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onClose()}
                className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
                title="Back to Player"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-base">Accounts</h3>
            </div>
            {onRefreshChannels && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 opacity-75 hover:opacity-100 transition-colors flex items-center gap-1 text-[11px] font-semibold"
                title="Sync Google Drive Account Metadata"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-sky-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sync</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Scrollable Accounts List Grouped by Google Email */}
        <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-3 pr-1">
          {/* Primary Account Group */}
          <div>
            <div className="px-1 mb-2">
              <h4 className="font-bold text-sm leading-tight">{primaryGroup.name}</h4>
              <p className="text-xs opacity-65 leading-tight mt-0.5 font-mono">{primaryGroup.email}</p>
            </div>
            <div className="space-y-1">
              {primaryGroup.channels.map(renderChannelRow)}
            </div>
          </div>

          {/* Other Google Accounts */}
          {otherGroups.length > 0 && (
            <div className="border-t pt-3 space-y-3" style={{ borderColor: 'var(--theme-border)' }}>
              <div className="px-1 text-[11px] font-bold opacity-60 uppercase tracking-wider">
                Other accounts
              </div>
              {otherGroups.map((group) => (
                <div key={group.email} className="space-y-1">
                  <div className="px-1 mb-1">
                    <p className="text-xs font-mono font-semibold opacity-75">{group.email}</p>
                  </div>
                  {group.channels.map(renderChannelRow)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Actions: Add Account & Sign Out */}
        <div className="shrink-0 border-t pt-2 space-y-1" style={{ borderColor: 'var(--theme-border)' }}>
          {onConnectOAuth && (
            <button
              onClick={onConnectOAuth}
              className="w-full p-2.5 rounded-xl hover:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center gap-3 text-xs font-bold transition-colors text-left"
              title="Sign in with another Google account"
            >
              <Plus className="w-4 h-4 text-sky-500" />
              <span>Add Google account</span>
            </button>
          )}
          {onAddAccount && (
            <button
              onClick={() => onAddAccount()}
              className="w-full p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 text-xs font-bold transition-colors opacity-85 hover:opacity-100 text-left"
            >
              <UserPlus className="w-4 h-4 text-sky-500" />
              <span>Add local profile</span>
            </button>
          )}
          <button
            onClick={onSignOut}
            className="w-full p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 text-xs font-bold transition-colors opacity-85 hover:opacity-100 text-left"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
