/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Destructive Action Safety Shield Modal (Anxiety-Relief Guarantee)
 * Explicit 2-step confirmation with 30-day trash retention reassurance
 * and zero-data-loss guarantee for users with anxiety or accidental triggers.
 */

import React from 'react';
import { Trash2, ShieldCheck, AlertCircle, X, RotateCcw } from 'lucide-react';
import { useTranslation } from '../i18n';

interface DestructiveActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemCount: number;
}

export const DestructiveActionDialog: React.FC<DestructiveActionDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemCount,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="safety-dialog-title"
      aria-describedby="safety-dialog-desc"
    >
      <div
        className="w-full max-w-md border rounded-3xl shadow-2xl overflow-hidden flex flex-col modal-card theme-card"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
      >
        {/* Warning & Reassurance Header */}
        <div className="p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <Trash2 className="w-6 h-6" />
          </div>

          <h2 id="safety-dialog-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
            {t('safety.confirmTitle')}
          </h2>

          <p id="safety-dialog-desc" className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('safety.confirmDesc', { count: itemCount })}
          </p>

          {/* Reassurance Callout */}
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5 text-left text-xs text-emerald-800 dark:text-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong>Zero Data Loss:</strong> Nothing is permanently deleted today. You can recover these items from Trash at any time.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
          >
            {t('safety.cancelBtn')}
          </button>

          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('safety.confirmBtn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
