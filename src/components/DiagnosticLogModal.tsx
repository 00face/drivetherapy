/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * System Diagnostics & QA Task Log Console Modal (Attachment 1 Architecture - A+ Tier)
 * Real-time event streaming, level & category filtering, expandable details,
 * 1-click Markdown QA report generator, and JSON export.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Copy,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Terminal,
  Search,
  RefreshCw,
  Layers,
  Cpu,
  Database,
  Wifi,
} from 'lucide-react';
import { taskLogger, DiagnosticLogEntry, LogLevel, LogCategory } from '../services/taskLogger';

interface DiagnosticLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTaskId?: string;
}

export const DiagnosticLogModal: React.FC<DiagnosticLogModalProps> = ({
  isOpen,
  onClose,
  activeTaskId,
}) => {
  const [logs, setLogs] = useState<DiagnosticLogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<LogCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Sync logs and subscribe to live events
  useEffect(() => {
    if (!isOpen) return;

    setLogs(taskLogger.getLogs());

    const unsubscribe = taskLogger.subscribe((entry) => {
      setLogs((prev) => [...prev.slice(-1999), entry]);
    });

    return () => unsubscribe();
  }, [isOpen]);

  // Auto-scroll to bottom on new incoming logs if enabled
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filtered logs computation
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (levelFilter !== 'ALL' && l.level !== levelFilter) return false;
      if (categoryFilter !== 'ALL' && l.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inMsg = l.message.toLowerCase().includes(q);
        const inCat = l.category.toLowerCase().includes(q);
        const inDetails = l.details && JSON.stringify(l.details).toLowerCase().includes(q);
        const inTask = l.taskId && l.taskId.toLowerCase().includes(q);
        if (!inMsg && !inCat && !inDetails && !inTask) return false;
      }
      return true;
    });
  }, [logs, levelFilter, categoryFilter, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    let tasks = 0;
    let network = 0;

    for (let i = 0; i < logs.length; i++) {
      const l = logs[i];
      if (l.level === 'ERROR') errors++;
      else if (l.level === 'WARN') warnings++;
      else if (l.level === 'TASK' || l.level === 'SUCCESS') tasks++;
      if (l.category === 'network') network++;
    }

    return { total: logs.length, errors, warnings, tasks, network };
  }, [logs]);

  // Copy full QA report to clipboard
  const handleCopyReport = async () => {
    const textReport = taskLogger.exportText();
    const systemSummary = JSON.stringify(taskLogger.getSystemSummary(), null, 2);
    const fullReport = `${textReport}\n\n# System Environment Snapshot\n\`\`\`json\n${systemSummary}\n\`\`\`\n`;

    try {
      await navigator.clipboard.writeText(fullReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      alert('Could not copy report to clipboard. You can download the JSON log file.');
    }
  };

  // Export full JSON log file
  const handleExportJson = () => {
    const jsonStr = taskLogger.exportJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drive-therapy-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Clear all logs
  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the diagnostic log buffer?')) {
      taskLogger.clear();
      setLogs(taskLogger.getLogs());
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qa-log-modal-title"
    >
      <div className="w-full max-w-5xl h-[88vh] max-h-[850px] bg-slate-950 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden text-xs font-sans">
        {/* Header Bar */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#1074B1]/20 border border-[#1074B1]/40 text-[#1074B1]">
              <Terminal className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 id="qa-log-modal-title" className="text-sm font-bold text-white flex items-center gap-2">
                <span>QA Diagnostics &amp; Indexing Task Logs</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px]">
                  Live Stream
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Inspect Google Drive batch queries, folder discovery, memory pressure, and network retries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReport}
              className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98] ${
                copied
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-slate-200'
              }`}
              title="Copy formatted diagnostic log & system snapshot to clipboard"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Full Report' : 'Copy QA Report'}</span>
            </button>

            <button
              onClick={handleExportJson}
              className="min-h-[36px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98]"
              title="Export complete logs as JSON file"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Export JSON</span>
            </button>

            <button
              onClick={handleClear}
              className="min-h-[36px] p-2 rounded-xl hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
              title="Clear log buffer"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="min-h-[36px] min-w-[36px] p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center justify-center ml-1"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Toolbar */}
        <div className="px-4 py-2.5 bg-slate-900/50 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Level Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <button
              onClick={() => setLevelFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                levelFilter === 'ALL'
                  ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setLevelFilter('ERROR')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                levelFilter === 'ERROR'
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
              }`}
            >
              <AlertCircle className="w-3 h-3 text-rose-400" />
              <span>Errors ({stats.errors})</span>
            </button>
            <button
              onClick={() => setLevelFilter('WARN')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                levelFilter === 'WARN'
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>Warnings ({stats.warnings})</span>
            </button>
            <button
              onClick={() => setLevelFilter('TASK')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                levelFilter === 'TASK'
                  ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
              }`}
            >
              <RefreshCw className="w-3 h-3 text-blue-400" />
              <span>Tasks ({stats.tasks})</span>
            </button>
          </div>

          {/* Search & Category Filter */}
          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="ALL">All Categories</option>
              <option value="indexer">Indexer</option>
              <option value="network">Network</option>
              <option value="auth">Auth</option>
              <option value="storage">Storage</option>
              <option value="system">System</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter logs by keyword..."
                className="pl-8 pr-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-[11px] text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-400 w-44 sm:w-56"
              />
            </div>

            <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>Auto-scroll</span>
            </label>
          </div>
        </div>

        {/* Monospaced Log Stream Terminal */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[11px] bg-slate-950 select-text"
        >
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 font-sans space-y-2">
              <Terminal className="w-8 h-8 opacity-40 text-cyan-500" />
              <p className="text-xs">No log entries matching the selected criteria.</p>
            </div>
          ) : (
            filteredLogs.map((entry) => {
              const isExpanded = expandedLogId === entry.id;
              const isError = entry.level === 'ERROR';
              const isWarn = entry.level === 'WARN';
              const isTask = entry.level === 'TASK';
              const isSuccess = entry.level === 'SUCCESS';

              return (
                <div
                  key={entry.id}
                  className={`group rounded-lg p-1.5 border transition-colors ${
                    isError
                      ? 'bg-rose-950/20 border-rose-900/40 hover:bg-rose-950/30'
                      : isWarn
                      ? 'bg-amber-950/20 border-amber-900/40 hover:bg-amber-950/30'
                      : isSuccess
                      ? 'bg-emerald-950/20 border-emerald-900/40 hover:bg-emerald-950/30'
                      : isTask
                      ? 'bg-blue-950/20 border-blue-900/40 hover:bg-blue-950/30'
                      : 'border-transparent hover:bg-slate-900/50'
                  }`}
                >
                  <div
                    onClick={() => (entry.details || entry.errorStack ? setExpandedLogId(isExpanded ? null : entry.id) : null)}
                    className="flex items-start gap-2 cursor-pointer"
                  >
                    {/* Timestamp */}
                    <span className="text-slate-500 shrink-0 select-none">
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>

                    {/* Level Badge */}
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                        isError
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : isWarn
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : isSuccess
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : isTask
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {entry.level}
                    </span>

                    {/* Category Pill */}
                    <span className="text-cyan-400/80 font-bold shrink-0">
                      [{entry.category}]
                    </span>

                    {/* Message Body */}
                    <span
                      className={`flex-1 break-all ${
                        isError
                          ? 'text-rose-200 font-semibold'
                          : isWarn
                          ? 'text-amber-200'
                          : isSuccess
                          ? 'text-emerald-200 font-semibold'
                          : isTask
                          ? 'text-blue-200 font-medium'
                          : 'text-slate-300'
                      }`}
                    >
                      {entry.message}
                    </span>

                    {/* Details Toggle Indicator */}
                    {(entry.details || entry.errorStack) && (
                      <span className="text-[10px] text-slate-500 group-hover:text-cyan-400 shrink-0">
                        {isExpanded ? '[-] less' : '[+] details'}
                      </span>
                    )}
                  </div>

                  {/* Expandable JSON Details & Error Stack */}
                  {isExpanded && (entry.details || entry.errorStack) && (
                    <div className="mt-2 pl-6 pr-2 py-2 bg-slate-900/90 rounded border border-slate-800 space-y-1.5 animate-in fade-in duration-150">
                      {entry.details && (
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5">Payload Details:</span>
                          <pre className="text-[10px] text-cyan-300 whitespace-pre-wrap break-all overflow-x-auto">
                            {JSON.stringify(entry.details, null, 2)}
                          </pre>
                        </div>
                      )}
                      {entry.errorStack && (
                        <div>
                          <span className="text-[10px] text-rose-400 block mb-0.5 font-bold">Stack Trace:</span>
                          <pre className="text-[10px] text-rose-300 whitespace-pre-wrap break-all overflow-x-auto">
                            {entry.errorStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Summary Bar */}
        <div className="p-3 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-sans shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Active Logging Engine</span>
            </span>
            <span>Buffered: {logs.length.toLocaleString()} entries</span>
            {activeTaskId && <span className="font-mono text-cyan-400">Task: {activeTaskId}</span>}
          </div>
          <span>Tip: Click &quot;Copy QA Report&quot; to export complete diagnosis</span>
        </div>
      </div>
    </div>
  );
};
