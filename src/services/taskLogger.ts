/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drive Therapy Verbose Task & Error Logging Subsystem (Attachment 1 Architecture - A+ Tier)
 * Captures granular runtime audit trails across Google Drive scanning, OAuth lifecycle,
 * IndexedDB operations, and system events. Provides in-memory ring buffer, persistent fallback,
 * real-time subscription, and copyable diagnostic summaries for QA and review.
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'TASK' | 'SUCCESS' | 'DEBUG';
export type LogCategory = 'indexer' | 'auth' | 'storage' | 'network' | 'system' | 'culling';

export interface DiagnosticLogEntry {
  id: string;
  timestamp: number;
  isoTime: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: Record<string, any>;
  taskId?: string;
  errorStack?: string;
}

const MAX_MEMORY_LOGS = 2000;
const MAX_PERSISTENT_LOGS = 500;
const STORAGE_KEY = 'dt_audit_logs_v1';

export class TaskLoggerService {
  private logs: DiagnosticLogEntry[] = [];
  private listeners: Set<(entry: DiagnosticLogEntry) => void> = new Set();
  private isPersisting = false;

  constructor() {
    this.rehydrateFromStorage();
    this.info('system', 'Diagnostic TaskLogger initialized', {
      maxCapacity: MAX_MEMORY_LOGS,
      persistedLimit: MAX_PERSISTENT_LOGS,
    });
  }

  // Load existing logs from localStorage if available
  private rehydrateFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.logs = parsed.slice(-MAX_MEMORY_LOGS);
        }
      }
    } catch (e) {
      console.warn('Failed to rehydrate audit logs from storage:', e);
    }
  }

  // Persist latest slice to storage (debounced)
  private persistToStorage(): void {
    if (typeof window === 'undefined' || this.isPersisting) return;
    this.isPersisting = true;
    setTimeout(() => {
      try {
        const slice = this.logs.slice(-MAX_PERSISTENT_LOGS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(slice));
      } catch (e) {
        console.warn('Failed to save audit logs to storage:', e);
      } finally {
        this.isPersisting = false;
      }
    }, 500);
  }

  private append(
    level: LogLevel,
    category: LogCategory,
    message: string,
    details?: Record<string, any>,
    taskId?: string,
    error?: any
  ): DiagnosticLogEntry {
    const now = Date.now();
    const entry: DiagnosticLogEntry = {
      id: `log_${now}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now,
      isoTime: new Date(now).toISOString(),
      level,
      category,
      message,
      details,
      taskId,
      errorStack: error instanceof Error ? error.stack : typeof error === 'string' ? error : undefined,
    };

    this.logs.push(entry);
    if (this.logs.length > MAX_MEMORY_LOGS) {
      this.logs = this.logs.slice(-MAX_MEMORY_LOGS);
    }

    // Mirror to browser console for developer inspection
    const prefix = `[DriveTherapy:${category.toUpperCase()}]`;
    if (level === 'ERROR') {
      console.error(prefix, message, details || '', error || '');
    } else if (level === 'WARN') {
      console.warn(prefix, message, details || '');
    } else if (level === 'TASK' || level === 'SUCCESS') {
      console.info(`%c${prefix} ${message}`, 'color: #1074B1; font-weight: bold;', details || '');
    }

    // Notify live subscribers
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch (e) {
        console.warn('TaskLogger subscriber error:', e);
      }
    }

    this.persistToStorage();
    return entry;
  }

  public info(category: LogCategory, message: string, details?: Record<string, any>, taskId?: string): DiagnosticLogEntry {
    return this.append('INFO', category, message, details, taskId);
  }

  public warn(category: LogCategory, message: string, details?: Record<string, any>, taskId?: string): DiagnosticLogEntry {
    return this.append('WARN', category, message, details, taskId);
  }

  public error(
    category: LogCategory,
    message: string,
    details?: Record<string, any>,
    error?: any,
    taskId?: string
  ): DiagnosticLogEntry {
    return this.append('ERROR', category, message, details, taskId, error);
  }

  public task(
    taskId: string,
    message: string,
    details?: Record<string, any>,
    category: LogCategory = 'indexer'
  ): DiagnosticLogEntry {
    return this.append('TASK', category, message, details, taskId);
  }

  public success(
    category: LogCategory,
    message: string,
    details?: Record<string, any>,
    taskId?: string
  ): DiagnosticLogEntry {
    return this.append('SUCCESS', category, message, details, taskId);
  }

  public debug(category: LogCategory, message: string, details?: Record<string, any>, taskId?: string): DiagnosticLogEntry {
    return this.append('DEBUG', category, message, details, taskId);
  }

  // Retrieve current logs snapshot with optional filtering
  public getLogs(filter?: {
    level?: LogLevel;
    category?: LogCategory;
    taskId?: string;
    search?: string;
  }): DiagnosticLogEntry[] {
    let result = this.logs;
    if (!filter) return [...result];

    if (filter.level) {
      result = result.filter((l) => l.level === filter.level);
    }
    if (filter.category) {
      result = result.filter((l) => l.category === filter.category);
    }
    if (filter.taskId) {
      result = result.filter((l) => l.taskId === filter.taskId);
    }
    if (filter.search && filter.search.trim()) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (l) =>
          l.message.toLowerCase().includes(q) ||
          l.category.toLowerCase().includes(q) ||
          (l.details && JSON.stringify(l.details).toLowerCase().includes(q))
      );
    }

    return [...result];
  }

  // Subscribe to real-time incoming log events
  public subscribe(listener: (entry: DiagnosticLogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Clear in-memory and persistent logs
  public clear(silent = false): void {
    this.logs = [];
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    if (!silent) {
      this.info('system', 'Audit logs cleared by user');
    }
  }

  // Export full log array as JSON string
  public exportJson(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        systemSummary: this.getSystemSummary(),
        totalEntries: this.logs.length,
        logs: this.logs,
      },
      null,
      2
    );
  }

  // Export full log as human-readable Markdown / Text
  public exportText(): string {
    const header = [
      `# Drive Therapy Diagnostic Log Report`,
      `Generated At: ${new Date().toISOString()}`,
      `Total Log Entries: ${this.logs.length}`,
      `--------------------------------------------------------------------------------`,
      ``,
    ].join('\n');

    const lines = this.logs.map((l) => {
      const detailsStr = l.details ? ` | ${JSON.stringify(l.details)}` : '';
      const stackStr = l.errorStack ? `\n  Stack: ${l.errorStack}` : '';
      return `[${l.isoTime}] [${l.level.padEnd(7)}] [${l.category.padEnd(8)}] ${l.message}${detailsStr}${stackStr}`;
    });

    return header + lines.join('\n');
  }

  // Build comprehensive system environment diagnostic summary
  public getSystemSummary(): Record<string, any> {
    if (typeof window === 'undefined') {
      return {
        environment: 'node',
        nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
        timestamp: new Date().toISOString(),
        logsCount: this.logs.length,
        errorsCount: this.logs.filter((l) => l.level === 'ERROR').length,
        warningsCount: this.logs.filter((l) => l.level === 'WARN').length,
      };
    }

    const perf: any = (window as any).performance || {};
    const memory = perf.memory
      ? {
          jsHeapSizeLimit: Math.round(perf.memory.jsHeapSizeLimit / (1024 * 1024)) + ' MB',
          totalJSHeapSize: Math.round(perf.memory.totalJSHeapSize / (1024 * 1024)) + ' MB',
          usedJSHeapSize: Math.round(perf.memory.usedJSHeapSize / (1024 * 1024)) + ' MB',
        }
      : undefined;

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      onLine: navigator.onLine,
      origin: window.location.origin,
      pathname: window.location.pathname,
      screenResolution: `${window.screen?.width}x${window.screen?.height}`,
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio,
      memory,
      indexedDBAvailable: Boolean(window.indexedDB),
      serviceWorkerActive: Boolean(navigator.serviceWorker?.controller),
      logsCount: this.logs.length,
      errorsCount: this.logs.filter((l) => l.level === 'ERROR').length,
      warningsCount: this.logs.filter((l) => l.level === 'WARN').length,
    };
  }
}

// Singleton TaskLogger export
export const taskLogger = new TaskLoggerService();
