/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drive Therapy Flag Notification Engine
 * Implements the 4 core flag notification statuses:
 * - 🟣 Attention (Purple Flag): Task needs user review or input
 * - 🟢 Complete (Green Flag): Task successfully completed
 * - 🟡 Busy (Yellow Flag): Task actively processing / background work
 * - 🔴 Failure (Red Flag): Task encountered an error or blocked state
 */

import { useState, useEffect } from 'react';

export type FlagType = 'attention' | 'complete' | 'busy' | 'failure' | 'info' | 'success' | 'warning' | 'error';
export type NotificationCategory = 'sync' | 'export' | 'cull' | 'trim' | 'ai' | 'auth' | 'storage' | 'system';

export interface FlagNotification {
  id: string;
  title: string;
  description?: string;
  timestamp: number;
  timeString: string; // e.g., "13:34", "11:03"
  flag: FlagType;
  category: NotificationCategory;
  read: boolean;
  actionLabel?: string;
  actionId?: string;
  details?: Record<string, any>;
}

const STORAGE_KEY = 'dt_flag_notifications_v1';
const MAX_NOTIFICATIONS = 150;

class NotificationEngine {
  private notifications: FlagNotification[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.rehydrate();
    // Seed initial demo notifications if empty to guide first-time users
    if (this.notifications.length === 0) {
      this.seedDefaultTimeline();
    }
  }

  private rehydrate(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.notifications = parsed.slice(0, MAX_NOTIFICATIONS);
        }
      }
    } catch (e) {
      console.warn('Failed to rehydrate notifications:', e);
    }
  }

  private persist(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notifications.slice(0, MAX_NOTIFICATIONS)));
      } catch (e) {
        console.warn('Failed to persist notifications:', e);
      }
    }
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getAll(): FlagNotification[] {
    return [...this.notifications];
  }

  public getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  public getActiveBusyCount(): number {
    return this.notifications.filter((n) => n.flag === 'busy').length;
  }

  public getHighestPriorityFlag(): FlagType | null {
    if (this.notifications.some((n) => n.flag === 'failure' && !n.read)) return 'failure';
    if (this.notifications.some((n) => n.flag === 'attention' && !n.read)) return 'attention';
    if (this.notifications.some((n) => n.flag === 'busy')) return 'busy';
    if (this.notifications.some((n) => n.flag === 'complete' && !n.read)) return 'complete';
    return null;
  }

  private formatTimeString(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  public notify(params: {
    title: string;
    description?: string;
    flag: FlagType;
    category?: NotificationCategory;
    actionLabel?: string;
    actionId?: string;
    details?: Record<string, any>;
  }): FlagNotification {
    return this.add(params);
  }

  public add(params: {
    title: string;
    description?: string;
    flag: FlagType;
    category?: NotificationCategory;
    actionLabel?: string;
    actionId?: string;
    details?: Record<string, any>;
  }): FlagNotification {
    const now = new Date();
    const item: FlagNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: params.title,
      description: params.description,
      timestamp: now.getTime(),
      timeString: this.formatTimeString(now),
      flag: params.flag,
      category: params.category || 'system',
      read: false,
      actionLabel: params.actionLabel,
      actionId: params.actionId,
      details: params.details,
    };

    // Prepend to top of timeline
    this.notifications = [item, ...this.notifications].slice(0, MAX_NOTIFICATIONS);
    this.persist();
    return item;
  }

  public markAsRead(id: string): void {
    this.notifications = this.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    this.persist();
  }

  public markAllAsRead(): void {
    this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
    this.persist();
  }

  public clearAll(): void {
    this.notifications = [];
    this.persist();
  }

  public clearCompleted(): void {
    this.notifications = this.notifications.filter((n) => n.flag !== 'complete');
    this.persist();
  }

  public delete(id: string): void {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.persist();
  }

  public updateFlag(id: string, flag: FlagType, title?: string, description?: string): void {
    this.notifications = this.notifications.map((n) =>
      n.id === id
        ? {
            ...n,
            flag,
            title: title || n.title,
            description: description !== undefined ? description : n.description,
            timeString: this.formatTimeString(new Date()),
          }
        : n
    );
    this.persist();
  }

  private seedDefaultTimeline(): void {
    const now = Date.now();
    this.notifications = [
      {
        id: 'seed_1',
        title: 'Studio Model Sequence',
        description: '3 items culled',
        timestamp: now - 15 * 60 * 1000,
        timeString: '13:34',
        flag: 'complete',
        category: 'cull',
        read: false,
      },
      {
        id: 'seed_2',
        title: 'Drive Sync',
        description: 'Drive Sync Desc',
        timestamp: now - 165 * 60 * 1000,
        timeString: '11:03',
        flag: 'busy',
        category: 'sync',
        read: false,
      },
      {
        id: 'seed_3',
        title: 'Editorial Bursts',
        description: '3 items scanned',
        timestamp: now - 240 * 60 * 1000,
        timeString: '09:45',
        flag: 'attention',
        category: 'ai',
        read: true,
      },
    ];
    this.persist();
  }
}

export const notificationEngine = new NotificationEngine();

/**
 * React Hook to access notification engine state reactively
 */
export function useNotificationEngine() {
  const [notifications, setNotifications] = useState<FlagNotification[]>(() =>
    notificationEngine.getAll()
  );
  const [unreadCount, setUnreadCount] = useState<number>(() =>
    notificationEngine.getUnreadCount()
  );
  const [priorityFlag, setPriorityFlag] = useState<FlagType | null>(() =>
    notificationEngine.getHighestPriorityFlag()
  );
  const [busyCount, setBusyCount] = useState<number>(() =>
    notificationEngine.getActiveBusyCount()
  );

  useEffect(() => {
    const unsubscribe = notificationEngine.subscribe(() => {
      setNotifications(notificationEngine.getAll());
      setUnreadCount(notificationEngine.getUnreadCount());
      setPriorityFlag(notificationEngine.getHighestPriorityFlag());
      setBusyCount(notificationEngine.getActiveBusyCount());
    });
    return unsubscribe;
  }, []);

  return {
    notifications,
    unreadCount,
    priorityFlag,
    busyCount,
    addNotification: notificationEngine.add.bind(notificationEngine),
    markAsRead: notificationEngine.markAsRead.bind(notificationEngine),
    markAllAsRead: notificationEngine.markAllAsRead.bind(notificationEngine),
    clearAll: notificationEngine.clearAll.bind(notificationEngine),
    clearCompleted: notificationEngine.clearCompleted.bind(notificationEngine),
    deleteNotification: notificationEngine.delete.bind(notificationEngine),
    updateFlag: notificationEngine.updateFlag.bind(notificationEngine),
  };
}
