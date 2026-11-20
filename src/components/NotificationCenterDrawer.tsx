/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Notification Center Drawer & Activity Timeline
 * Implements the 4-status Flag Notification System:
 * - 🟣 Task Needs Attention (Purple)
 * - 🟢 Task Complete (Green)
 * - 🟡 Busy (Yellow)
 * - 🔴 Task Failure (Red)
 * Harmonized with vertical timeline spine, timestamp badges, and theme tokens.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCheck,
  Trash2,
  Filter,
  Sparkles,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  FlagNotification,
  FlagType,
  useNotificationEngine,
} from '../services/notificationEngine';
import { useTranslation } from '../i18n';

interface NotificationCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onActionClick?: (actionId?: string) => void;
}

/**
 * Flag Icon with computer badge matching reference image specifications
 */
export const FlagBadge: React.FC<{ flag: FlagType; size?: 'sm' | 'md' | 'lg' }> = ({
  flag,
  size = 'md',
}) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const flagColors: Record<FlagType, { flagFill: string; label: string; ringColor: string }> = {
    attention: {
      flagFill: '#A855F7', // Vivid Purple
      label: 'Task Needs Attention',
      ringColor: 'ring-purple-400/40',
    },
    complete: {
      flagFill: '#22C55E', // Vivid Green
      label: 'Task Complete',
      ringColor: 'ring-emerald-400/40',
    },
    busy: {
      flagFill: '#EAB308', // Vivid Yellow
      label: 'Busy',
      ringColor: 'ring-amber-400/40',
    },
    failure: {
      flagFill: '#EF4444', // Vivid Red
      label: 'Task Failure',
      ringColor: 'ring-red-400/40',
    },
    error: {
      flagFill: '#EF4444',
      label: 'Error',
      ringColor: 'ring-red-400/40',
    },
    info: {
      flagFill: '#38BDF8',
      label: 'Information',
      ringColor: 'ring-sky-400/40',
    },
    success: {
      flagFill: '#22C55E',
      label: 'Success',
      ringColor: 'ring-emerald-400/40',
    },
    warning: {
      flagFill: '#F59E0B',
      label: 'Warning',
      ringColor: 'ring-amber-400/40',
    },
  };

  const meta = flagColors[flag] || flagColors.complete;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${sizeMap[size]}`}
      title={meta.label}
      aria-label={meta.label}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xs"
      >
        {/* Computer Screen Base Silhouette */}
        <path
          d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H15L16 23H17C17.5523 23 18 23.4477 18 24C18 24.5523 17.5523 25 17 25H9C8.44772 25 8 24.5523 8 24C8 23.4477 8.44772 23 9 23H10L11 20H6C4.89543 20 4 19.1046 4 18V6Z"
          fill="currentColor"
          className="text-slate-900 dark:text-slate-100"
        />
        {/* Screen Bezel Cutout */}
        <rect x="7" y="7" width="10" height="9" rx="1" fill="white" className="dark:fill-slate-900" />
        {/* Inner Monitor Content line */}
        <line x1="9" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-slate-900 dark:text-slate-100" />

        {/* Flag Pole */}
        <path
          d="M19 19L27 6"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="text-slate-900 dark:text-slate-100"
        />
        {/* Colored Flag Banner */}
        <path
          d="M23 7L30 11L25 15L23 7Z"
          fill={meta.flagFill}
          stroke={meta.flagFill}
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      {flag === 'busy' && (
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
      )}
    </div>
  );
};

export const NotificationCenterDrawer: React.FC<NotificationCenterDrawerProps> = ({
  isOpen,
  onClose,
  onActionClick,
}) => {
  const { t } = useTranslation();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    clearCompleted,
    deleteNotification,
    addNotification,
  } = useNotificationEngine();

  const [filter, setFilter] = useState<'all' | FlagType>('all');

  // Handle escape key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'all') return true;
    return item.flag === filter;
  });

  const getTimelineDotColor = (flag: FlagType) => {
    switch (flag) {
      case 'attention':
        return 'bg-purple-500 ring-4 ring-purple-100 dark:ring-purple-900/40 text-purple-600';
      case 'complete':
        return 'bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-900/40 text-emerald-600';
      case 'busy':
        return 'bg-amber-400 ring-4 ring-amber-100 dark:ring-amber-900/40 text-amber-500';
      case 'failure':
        return 'bg-red-500 ring-4 ring-red-100 dark:ring-red-900/40 text-red-600';
      default:
        return 'bg-slate-400 ring-4 ring-slate-100 dark:ring-slate-800 text-slate-500';
    }
  };

  const handleSimulateTestEvents = () => {
    const states: { title: string; desc: string; flag: FlagType }[] = [
      {
        title: 'Batch RAW Export',
        desc: '12 Sony ARW files exported to 2048px sRGB',
        flag: 'complete',
      },
      {
        title: 'Background Facial Cluster',
        desc: 'Detecting faces across 42 images...',
        flag: 'busy',
      },
      {
        title: 'OAuth Refresh Required',
        desc: 'Google Drive token expiring in 5 minutes',
        flag: 'attention',
      },
      {
        title: 'Cloudflare R2 Sync Error',
        desc: 'Connection timed out on bucket asset upload',
        flag: 'failure',
      },
    ];
    states.forEach((s, idx) => {
      setTimeout(() => {
        addNotification({
          title: s.title,
          description: s.desc,
          flag: s.flag,
        });
      }, idx * 120);
    });
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex justify-end bg-black/40 backdrop-blur-xs transition-opacity duration-200"
      aria-modal="true"
      role="dialog"
      aria-label="Notification Center"
      onClick={onClose}
    >
      <div
        className="w-full sm:w-[440px] md:w-[480px] h-full flex flex-col shadow-2xl border-l theme-card animate-in slide-in-from-right duration-200"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#1074B1]/10 text-[#1074B1] flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight">Notification Center</h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1074B1] text-white">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-xs opacity-60">System audit, sync milestones &amp; task flags</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleSimulateTestEvents}
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Add sample flag notifications"
            >
              <Sparkles className="w-4 h-4 text-[#BEBF61]" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Close Notification Center (Esc)"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Flag Legend / Filter Chips */}
        <div className="px-4 py-2.5 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 text-xs" style={{ borderColor: 'var(--theme-border)' }}>
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-xl font-semibold transition-all shrink-0 ${
              filter === 'all'
                ? 'bg-[#1074B1] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('attention')}
            className={`px-2 py-1 rounded-xl font-medium transition-all flex items-center gap-1.5 shrink-0 ${
              filter === 'attention'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Attention</span>
          </button>
          <button
            onClick={() => setFilter('busy')}
            className={`px-2 py-1 rounded-xl font-medium transition-all flex items-center gap-1.5 shrink-0 ${
              filter === 'busy'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Busy</span>
          </button>
          <button
            onClick={() => setFilter('complete')}
            className={`px-2 py-1 rounded-xl font-medium transition-all flex items-center gap-1.5 shrink-0 ${
              filter === 'complete'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Complete</span>
          </button>
          <button
            onClick={() => setFilter('failure')}
            className={`px-2 py-1 rounded-xl font-medium transition-all flex items-center gap-1.5 shrink-0 ${
              filter === 'failure'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Failure</span>
          </button>
        </div>

        {/* Timeline Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {filteredNotifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <CheckCircle2 className="w-12 h-12 mb-3 stroke-[1.5] text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-sm">No notifications found</p>
              <p className="text-xs opacity-70 mt-1 max-w-xs">
                Active operations, background culling tasks, and status flags will display in this timeline.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-7">
              {/* Continuous Vertical Timeline Line Spine */}
              <div
                className="absolute left-2.5 sm:left-3 top-2 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800 pointer-events-none"
              />

              <div className="space-y-6">
                {filteredNotifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => markAsRead(item.id)}
                    className={`relative group cursor-pointer transition-all ${
                      item.read ? 'opacity-85' : 'opacity-100'
                    }`}
                  >
                    {/* Timeline Node Dot / Flag Circle */}
                    <div
                      className={`absolute -left-6 sm:-left-7 top-1.5 w-4 h-4 rounded-full flex items-center justify-center transition-transform group-hover:scale-125 z-10 ${getTimelineDotColor(
                        item.flag
                      )}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900" />
                    </div>

                    {/* Timestamp Badge (Matching User Reference Image) */}
                    <div className="inline-block mb-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-2xs">
                        {item.timeString}
                      </span>
                    </div>

                    {/* Notification Card Pill */}
                    <div
                      className={`p-3.5 rounded-2xl border transition-all shadow-xs ${
                        item.read
                          ? 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800'
                          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 ring-1 ring-[#1074B1]/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          {/* Flag Icon Badge */}
                          <div className="mt-0.5">
                            <FlagBadge flag={item.flag} size="md" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                                {item.title}
                              </h4>
                              {!item.read && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#1074B1] shrink-0" />
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed break-words">
                                {item.description}
                              </p>
                            )}

                            {/* Optional Action Button */}
                            {item.actionLabel && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onActionClick?.(item.actionId);
                                }}
                                className="mt-2 px-2.5 py-1 rounded-lg bg-[#1074B1]/10 hover:bg-[#1074B1]/20 text-[#1074B1] dark:text-[#67b7e6] text-xs font-semibold flex items-center gap-1 transition-colors"
                              >
                                <span>{item.actionLabel}</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Delete Button on Hover */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(item.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all shrink-0"
                          title="Delete notification"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t flex items-center justify-between gap-2 shrink-0 bg-slate-50/50 dark:bg-slate-900/50 text-xs" style={{ borderColor: 'var(--theme-border)' }}>
          <button
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="px-2.5 py-1.5 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1.5"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark All Read</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={clearCompleted}
              className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Remove finished completed events"
            >
              Clear Done
            </button>
            <button
              onClick={clearAll}
              disabled={notifications.length === 0}
              className="px-2.5 py-1.5 rounded-xl font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
