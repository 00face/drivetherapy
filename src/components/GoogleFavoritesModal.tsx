/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Favorites App Launcher Modal
 * Customizable 3-column grid launching Drive Therapy studios or external Google apps.
 */

import React, { useState } from 'react';
import {
  X,
  Pencil,
  Check,
  HardDrive,
  Camera,
  Mail,
  Youtube,
  Calendar,
  MapPin,
  Sparkles,
  MessageSquare,
  CheckSquare,
  Cloud,
  User,
  Search,
} from 'lucide-react';
import { ViewMode } from '../types';

export interface FavoriteAppItem {
  id: string;
  label: string;
  color: string;
  internalMode?: ViewMode;
  internalModal?: 'music' | 'workspace' | 'studio' | 'gcomms' | 'diagnostics';
  externalUrl?: string;
}

const DEFAULT_FAVORITES: FavoriteAppItem[] = [
  { id: 'account', label: 'Account', color: '#1074B1', internalModal: 'diagnostics' },
  { id: 'drive', label: 'Drive', color: '#34A853', internalMode: 'drive-browser' },
  { id: 'photos', label: 'Photos', color: '#EA4335', internalMode: 'google-photos' },
  { id: 'gmail', label: 'Gmail', color: '#EA4335', internalModal: 'workspace' },
  { id: 'youtube', label: 'YouTube', color: '#FF0000', internalModal: 'music' },
  { id: 'gemini', label: 'Gemini', color: '#4285F4', internalModal: 'gcomms' },
  { id: 'maps', label: 'Maps', color: '#34A853', internalMode: 'map' },
  { id: 'search', label: 'Search', color: '#4285F4', externalUrl: 'https://www.google.com' },
  { id: 'calendar', label: 'Calendar', color: '#4285F4', internalModal: 'workspace' },
  { id: 'tasks', label: 'Tasks', color: '#1074B1', internalModal: 'workspace' },
  { id: 'chat', label: 'Chat', color: '#00AC47', internalModal: 'gcomms' },
  { id: 'studio', label: 'AI Studio', color: '#8B5CF6', internalModal: 'studio' },
];

const FAVORITES_KEY = 'dt_google_favorites_v1';

function renderFavIcon(id: string, color: string) {
  const cls = 'w-6 h-6';
  switch (id) {
    case 'account':
      return <User className={cls} style={{ color }} />;
    case 'drive':
      return <HardDrive className={cls} style={{ color }} />;
    case 'photos':
      return <Camera className={cls} style={{ color }} />;
    case 'gmail':
      return <Mail className={cls} style={{ color }} />;
    case 'youtube':
      return <Youtube className={cls} style={{ color }} />;
    case 'gemini':
      return <Sparkles className={cls} style={{ color }} />;
    case 'maps':
      return <MapPin className={cls} style={{ color }} />;
    case 'search':
      return <Search className={cls} style={{ color }} />;
    case 'calendar':
      return <Calendar className={cls} style={{ color }} />;
    case 'tasks':
      return <CheckSquare className={cls} style={{ color }} />;
    case 'chat':
      return <MessageSquare className={cls} style={{ color }} />;
    default:
      return <Cloud className={cls} style={{ color }} />;
  }
}

interface GoogleFavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  userPhotoUrl?: string | null;
  onSelectMode: (mode: ViewMode) => void;
  onOpenModal: (modal: 'music' | 'workspace' | 'studio' | 'gcomms' | 'diagnostics') => void;
}

export const GoogleFavoritesModal: React.FC<GoogleFavoritesModalProps> = ({
  isOpen,
  onClose,
  userPhotoUrl,
  onSelectMode,
  onOpenModal,
}) => {
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_FAVORITES.map((f) => f.id);
  });
  const [isEditing, setIsEditing] = useState(false);

  if (!isOpen) return null;

  const togglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const visibleItems = isEditing
    ? DEFAULT_FAVORITES
    : DEFAULT_FAVORITES.filter((f) => pinnedIds.includes(f.id));

  const handleLaunch = (item: FavoriteAppItem) => {
    if (isEditing) {
      togglePin(item.id);
      return;
    }
    onClose();
    if (item.internalMode) onSelectMode(item.internalMode);
    else if (item.internalModal) onOpenModal(item.internalModal);
    else if (item.externalUrl) window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-16 bg-black/25 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Your Google Favorites"
      onClick={onClose}
    >
      <div
        className="w-80 rounded-3xl border shadow-2xl p-4 space-y-3 dt-drawer-enter theme-card"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Your favorites</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsEditing((v) => !v)}
              className={`min-h-[34px] min-w-[34px] rounded-xl flex items-center justify-center transition-colors ${
                isEditing ? 'bg-[#1074B1] text-white' : 'hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title={isEditing ? 'Done editing favorites' : 'Customize favorites'}
              aria-label="Customize favorites"
            >
              {isEditing ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[34px] min-w-[34px] rounded-xl hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center"
              aria-label="Close favorites"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {visibleItems.map((item) => {
            const isPinned = pinnedIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleLaunch(item)}
                className={`p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all text-center relative ${
                  isEditing && !isPinned ? 'opacity-40' : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center overflow-hidden">
                  {item.id === 'account' && userPhotoUrl ? (
                    <img src={userPhotoUrl} alt="Account" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    renderFavIcon(item.id, item.color)
                  )}
                </div>
                <span className="text-[11px] font-medium truncate w-full">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
