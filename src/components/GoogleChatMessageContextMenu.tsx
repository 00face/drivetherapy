/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Chat Message Context Menu & Details Suite
 * Provides response options on right-click or '⋯' trigger:
 * - 📋 Copy text
 * - 💬 Quote / Reply in composer
 * - 🕒 Timestamp & Message Details
 * - 🔄 Forward to another Space / Contact
 * - ✉️ Email via Gmail composer
 * - 🌐 Translate message
 * - 💾 Download / Export text & deliverables
 * - 🔗 Share via Web Share API
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Copy,
  Quote,
  Clock,
  Forward,
  Mail,
  Languages,
  Download,
  Share2,
  X,
  Check,
  Info,
  ShieldCheck,
  Calendar,
  User as UserIcon,
} from 'lucide-react';
import { ChatMessage, ChatSpace } from '../services/googleChatApi';

interface GoogleChatMessageContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  message: ChatMessage | null;
  onClose: () => void;
  onCopyText: (msg: ChatMessage) => void;
  onQuoteReply: (msg: ChatMessage) => void;
  onShowDetails: (msg: ChatMessage) => void;
  onForward: (msg: ChatMessage) => void;
  onEmailGmail: (msg: ChatMessage) => void;
  onTranslate: (msg: ChatMessage) => void;
  onDownload: (msg: ChatMessage) => void;
  onShare: (msg: ChatMessage) => void;
}

export const GoogleChatMessageContextMenu: React.FC<GoogleChatMessageContextMenuProps> = ({
  isOpen,
  position,
  message,
  onClose,
  onCopyText,
  onQuoteReply,
  onShowDetails,
  onForward,
  onEmailGmail,
  onTranslate,
  onDownload,
  onShare,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [clampedPos, setClampedPos] = useState(position);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    // Viewport edge clamping
    const width = 220;
    const height = 320;
    const padding = 12;
    let x = position.x;
    let y = position.y;

    if (x + width > window.innerWidth - padding) {
      x = window.innerWidth - width - padding;
    }
    if (y + height > window.innerHeight - padding) {
      y = window.innerHeight - height - padding;
    }
    setClampedPos({ x: Math.max(padding, x), y: Math.max(padding, y) });

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, position, onClose]);

  if (!isOpen || !message) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-54 py-1.5 rounded-2xl shadow-2xl border backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 select-none text-xs"
      style={{
        left: clampedPos.x,
        top: clampedPos.y,
        backgroundColor: 'var(--theme-surface)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text)',
      }}
    >
      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider opacity-60 border-b mb-1" style={{ borderColor: 'var(--theme-border)' }}>
        Message Options
      </div>

      <button
        onClick={() => {
          onCopyText(message);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left"
      >
        <Copy className="w-3.5 h-3.5 text-sky-500" />
        <span>Copy Text</span>
      </button>

      <button
        onClick={() => {
          onQuoteReply(message);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left"
      >
        <Quote className="w-3.5 h-3.5 text-indigo-500" />
        <span>Quote & Reply</span>
      </button>

      <button
        onClick={() => {
          onTranslate(message);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left"
      >
        <Languages className="w-3.5 h-3.5 text-teal-500" />
        <span>Translate Message</span>
      </button>

      <button
        onClick={() => {
          onEmailGmail(message);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left"
      >
        <Mail className="w-3.5 h-3.5 text-rose-500" />
        <span>Email via Gmail</span>
      </button>

      <button
        onClick={() => {
          onForward(message);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left"
      >
        <Forward className="w-3.5 h-3.5 text-amber-500" />
        <span>Forward to Space...</span>
      </button>

      <div className="my-1 border-t" style={{ borderColor: 'var(--theme-border)' }} />

      <button
        onClick={() => {
          onDownload(message);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left"
      >
        <Download className="w-3.5 h-3.5 text-emerald-500" />
        <span>Download / Export</span>
      </button>

      <button
        onClick={() => {
          onShare(message);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left"
      >
        <Share2 className="w-3.5 h-3.5 text-blue-500" />
        <span>Share via...</span>
      </button>

      <button
        onClick={() => {
          onShowDetails(message);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left border-t mt-1"
        style={{ borderColor: 'var(--theme-border)' }}
      >
        <Clock className="w-3.5 h-3.5 opacity-60" />
        <span>Timestamp & Details</span>
      </button>
    </div>
  );
};

// --- TIMESTAMP & MESSAGE DETAILS MODAL ---
interface GoogleChatMessageDetailsModalProps {
  isOpen: boolean;
  message: ChatMessage | null;
  spaceName: string;
  onClose: () => void;
}

export const GoogleChatMessageDetailsModal: React.FC<GoogleChatMessageDetailsModalProps> = ({
  isOpen,
  message,
  spaceName,
  onClose,
}) => {
  if (!isOpen || !message) return null;

  const dateObj = new Date(message.createTime);
  const isValidDate = !isNaN(dateObj.getTime());
  const formattedFull = isValidDate
    ? dateObj.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      })
    : message.createTime;

  const isoTimestamp = isValidDate ? dateObj.toISOString() : message.createTime;

  return (
    <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-md rounded-3xl shadow-2xl border p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
      >
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Message Details & Timestamp</h3>
              <p className="text-[11px] opacity-65">Google Chat Audit & Delivery State</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-2xl border bg-black/5 dark:bg-white/5 space-y-1" style={{ borderColor: 'var(--theme-border)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Timestamp</span>
            <div className="font-semibold">{formattedFull}</div>
            <div className="font-mono text-[11px] opacity-70">{isoTimestamp}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-2xl border bg-black/5 dark:bg-white/5" style={{ borderColor: 'var(--theme-border)' }}>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Sender</span>
              <div className="font-semibold mt-0.5 truncate">{message.sender?.displayName || 'User'}</div>
              <div className="text-[10px] opacity-60 font-mono truncate">{message.sender?.name}</div>
            </div>

            <div className="p-2.5 rounded-2xl border bg-black/5 dark:bg-white/5" style={{ borderColor: 'var(--theme-border)' }}>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Status</span>
              <div className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Delivered & Synced</span>
              </div>
              <div className="text-[10px] opacity-60">chat.googleapis.com</div>
            </div>
          </div>

          <div className="p-2.5 rounded-2xl border bg-black/5 dark:bg-white/5 space-y-1" style={{ borderColor: 'var(--theme-border)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Message Resource Name</span>
            <div className="font-mono text-[11px] select-all break-all">{message.name}</div>
          </div>

          {message.text && (
            <div className="p-2.5 rounded-2xl border bg-black/5 dark:bg-white/5 space-y-1" style={{ borderColor: 'var(--theme-border)' }}>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider opacity-60">
                <span>Text Content</span>
                <span>{message.text.length} chars</span>
              </div>
              <p className="text-xs max-h-24 overflow-y-auto whitespace-pre-wrap">{message.text}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--theme-border)' }}>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// --- FORWARD MESSAGE MODAL ---
interface GoogleChatForwardModalProps {
  isOpen: boolean;
  message: ChatMessage | null;
  spaces: ChatSpace[];
  onClose: () => void;
  onConfirmForward: (targetSpace: ChatSpace) => void;
}

export const GoogleChatForwardModal: React.FC<GoogleChatForwardModalProps> = ({
  isOpen,
  message,
  spaces,
  onClose,
  onConfirmForward,
}) => {
  const [query, setQuery] = useState('');
  if (!isOpen || !message) return null;

  const filtered = spaces.filter((s) => s.displayName.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm rounded-3xl shadow-2xl border p-5 flex flex-col gap-3 animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
      >
        <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Forward className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Forward Message</h3>
              <p className="text-[11px] opacity-65">Choose a destination space or direct message</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search spaces..."
          className="w-full px-3 py-1.5 text-xs rounded-xl border focus:border-sky-500 focus:outline-none"
          style={{
            backgroundColor: 'var(--theme-surface)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text)',
          }}
        />

        <div className="max-h-60 overflow-y-auto space-y-1.5 my-1">
          {filtered.map((space) => (
            <div
              key={space.name}
              className="p-2 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between transition-colors"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <div className="flex items-center gap-2 truncate">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                  style={{ backgroundColor: space.avatarColor || '#1074B1' }}
                >
                  {space.avatarLetter || 'G'}
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold truncate">{space.displayName}</div>
                  <div className="text-[10px] opacity-60">{space.spaceType}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  onConfirmForward(space);
                  onClose();
                }}
                className="px-3 py-1 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold shadow-xs transition-transform active:scale-95 shrink-0"
              >
                Forward
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
