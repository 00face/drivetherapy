/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Floating Upload & AI Sync Progress Drawer (Attachment 1 Architecture)
 */

import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  CloudUpload,
  HardDrive,
  Terminal,
} from 'lucide-react';
import { BatchTask } from '../types';

interface FloatingSyncDrawerProps {
  tasks: BatchTask[];
  onRetryTask: (taskId: string) => void;
  onDismissTask: (taskId: string) => void;
  onClearCompleted: () => void;
  onCancelTask?: (taskId: string) => void;
  onOpenLogs?: () => void;
}

export const FloatingSyncDrawer: React.FC<FloatingSyncDrawerProps> = ({
  tasks,
  onRetryTask,
  onDismissTask,
  onClearCompleted,
  onCancelTask,
  onOpenLogs,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isVisible, setIsVisible] = useState(true);

  // Automatically surface the drawer whenever an active task is running
  useEffect(() => {
    if (tasks.some((t) => t.status === 'running')) {
      setIsVisible(true);
    }
  }, [tasks]);

  if (!isVisible || tasks.length === 0) return null;

  const totalProgress = Math.round(
    tasks.reduce((acc, t) => acc + t.progress, 0) / tasks.length
  );
  const hasMountTasks = tasks.some((t) => t.type === 'mount');

  return (
    <div
      className="fixed bottom-4 right-4 w-80 md:w-96 rounded-2xl border shadow-xl z-50 overflow-hidden text-xs transition-all duration-300 drawer-card theme-card"
      style={{
        backgroundColor: 'var(--theme-surface)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text)',
      }}
      role="region"
      aria-label="Storage Stream & Processing Status"
    >
      {/* Header with Progress Bar */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasMountTasks ? (
            <HardDrive className="w-4 h-4 text-[#52B197]" />
          ) : (
            <CloudUpload className="w-4 h-4 text-[#1074B1]" />
          )}
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-100 block">
              {tasks.length === 1 && hasMountTasks
                ? 'Live In-Place Disk Mount (0MB Upload)'
                : `Processing ${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} (${totalProgress}%)`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onOpenLogs && (
            <button
              onClick={onOpenLogs}
              className="px-2 py-0.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[10px] font-semibold flex items-center gap-1 transition-colors"
              title="View diagnostic QA task logs"
            >
              <Terminal className="w-3 h-3" />
              <span>Logs</span>
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            title="Dismiss drawer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Line */}
      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1">
        <div
          className="bg-gradient-to-r from-[#1074B1] to-[#52B197] h-full transition-all duration-300"
          style={{ width: `${totalProgress}%` }}
        />
      </div>

      {/* Expandable Task List */}
      {isExpanded && (
        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-1">
          {tasks.map((task) => (
            <div key={task.id} className="p-2 flex items-center justify-between gap-2">
              <div className="truncate max-w-[280px]">
                <span className="font-medium text-slate-800 dark:text-slate-200 block truncate">
                  {task.name}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {task.status === 'completed'
                      ? '100% · Complete'
                      : task.status === 'failed'
                      ? 'Failed'
                      : `${task.progress}% · In progress`}
                  </span>
                  {task.type === 'mount' && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-[#52B197] bg-[#52B197]/10 px-1 py-0.2 rounded">
                      <span>0MB Upload · In-Place</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {task.status === 'completed' && (
                  <CheckCircle2 className="w-4 h-4 text-[#52B197]" />
                )}
                {task.status === 'failed' && (
                  <>
                    <span className="text-[10px] font-bold text-rose-500">Failed</span>
                    <button
                      onClick={() => onRetryTask(task.id)}
                      className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[10px] font-bold hover:underline flex items-center gap-0.5"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Retry</span>
                    </button>
                  </>
                )}
                {task.status === 'running' && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-14 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#1074B1] h-full rounded-full transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    {onCancelTask && (
                      <button
                        onClick={() => onCancelTask(task.id)}
                        className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 text-[9px] font-semibold text-slate-500 transition-colors"
                        title="Cancel task"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={() => onDismissTask(task.id)}
                  className="p-1 text-slate-300 hover:text-slate-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
