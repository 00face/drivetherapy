/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Storage Donut Metric Cards (Attachment 1 Architecture)
 */

import React from 'react';
import { Cloud, HardDrive, CheckCircle, Sparkles } from 'lucide-react';
import { useTranslation } from '../i18n';

interface StorageMetricCardsProps {
  totalAssetsCount: number;
  pickedCount: number;
  rejectedCount: number;
  cloudConnected: boolean;
  driveQuota?: { limit: number; usage: number; percentage: number };
  onOpenDeclutter: () => void;
  activeStorage?: 'cloud' | 'local';
  onOpenCloudStorage?: () => void;
  onOpenLocalStorage?: () => void;
}

export const StorageMetricCards: React.FC<StorageMetricCardsProps> = ({
  totalAssetsCount,
  pickedCount,
  rejectedCount,
  cloudConnected,
  driveQuota,
  onOpenDeclutter,
  activeStorage,
  onOpenCloudStorage,
  onOpenLocalStorage,
}) => {
  const { t } = useTranslation();
  const formatGB = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(1);
  const quotaPercent = driveQuota ? driveQuota.percentage : cloudConnected ? 15 : 0;
  const quotaText = driveQuota && driveQuota.limit > 0
    ? `${formatGB(driveQuota.usage)} GB / ${formatGB(driveQuota.limit)} GB`
    : cloudConnected
    ? t('dashboard.checkingDrive')
    : t('dashboard.notConnected');

  // SVG Donut calculation helper (Compact 38px diameter)
  const renderDonut = (percent: number, strokeColor: string, size = 38) => {
    const strokeWidth = 3.5;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;

    return (
      <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-100 dark:text-slate-800 opacity-40"
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <span className="absolute text-[10px] font-bold font-mono text-slate-800 dark:text-slate-100">
          {percent}%
        </span>
      </div>
    );
  };

  const keeperRate = totalAssetsCount > 0 ? Math.round((pickedCount / totalAssetsCount) * 100) : 0;

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3 mb-3.5" aria-label="Storage Statistics">
      {/* Card 1: Google Drive */}
      <div
        role={onOpenCloudStorage ? 'button' : undefined}
        tabIndex={onOpenCloudStorage ? 0 : undefined}
        onClick={onOpenCloudStorage}
        onKeyDown={(e) => {
          if (onOpenCloudStorage && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onOpenCloudStorage();
          }
        }}
        className={`py-2.5 px-3 rounded-xl bg-gradient-to-br from-[#1074B1] to-[#403993] text-white shadow-xs relative overflow-hidden flex items-center justify-between min-h-[76px] transition-all cursor-pointer ${
          activeStorage === 'cloud'
            ? 'ring-2 ring-white/90 shadow-md scale-[1.01]'
            : 'hover:opacity-95 hover:scale-[1.005]'
        }`}
        data-active={activeStorage === 'cloud'}
        title="Switch to Google Drive Media View"
      >
        <div className="space-y-0.5 z-10 min-w-0 pr-2">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
              <Cloud className="w-3 h-3 text-white" />
            </div>
            <h3 className="font-semibold text-xs whitespace-nowrap truncate">{t('storage.googleDrive')}</h3>
          </div>
          <p className="text-[11px] text-white/90 font-mono truncate">{quotaText}</p>
          <div className="text-[9px] text-emerald-300 font-medium">
            {cloudConnected ? t('dashboard.cloudConnected') : t('dashboard.cloudDisconnected')}
          </div>
        </div>

        {/* Donut Dial in Cyan */}
        <div className="relative z-10 shrink-0">
          {renderDonut(quotaPercent, '#52B197', 38)}
        </div>

        {/* Decorative backdrop glow */}
        <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-white/10 blur-lg pointer-events-none" />
      </div>

      {/* Card 2: Local OS Workspace */}
      <div
        role={onOpenLocalStorage ? 'button' : undefined}
        tabIndex={onOpenLocalStorage ? 0 : undefined}
        onClick={onOpenLocalStorage}
        onKeyDown={(e) => {
          if (onOpenLocalStorage && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onOpenLocalStorage();
          }
        }}
        className={`py-2.5 px-3 rounded-xl border shadow-xs flex items-center justify-between min-h-[76px] transition-all cursor-pointer metric-card ${
          activeStorage === 'local'
            ? 'border-[#52B197] ring-2 ring-[#52B197]/50 shadow-md scale-[1.01]'
            : 'border-slate-200/80 dark:border-slate-800/80 hover:border-[#52B197] hover:scale-[1.005]'
        }`}
        data-active={activeStorage === 'local'}
        title="Switch to Local Computer Storage & Files"
      >
        <div className="space-y-0.5 min-w-0 pr-2">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md bg-[#52B197]/15 flex items-center justify-center shrink-0">
              <HardDrive className="w-3 h-3 text-[#52B197]" />
            </div>
            <h3 className="font-bold text-xs ui-card-title leading-tight">
              {t('storage.localDrive')}
            </h3>
          </div>
          <p className="text-[11px] ui-card-meta font-mono truncate">
            {t('dashboard.directOsAccess')}
          </p>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            {t('dashboard.localStorageReady')}
          </div>
        </div>

        {/* Donut Dial */}
        <div className="shrink-0">
          {renderDonut(100, '#52B197', 38)}
        </div>
      </div>

      {/* Card 3: Photo Review & Cleanup Health */}
      <div className="py-2.5 px-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex items-center justify-between min-h-[76px] metric-card">
        <div className="space-y-0.5 min-w-0 pr-2">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md bg-[#A61B7A]/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-3 h-3 text-[#A61B7A]" />
            </div>
            <h3 className="font-bold text-xs ui-card-title leading-tight">
              {t('dashboard.photoReview')}
            </h3>
          </div>
          <p className="text-[11px] ui-card-meta font-mono truncate tabular-nums">
            {t('dashboard.reviewProgress', { picked: pickedCount, dismissed: rejectedCount })}
          </p>
          <button
            onClick={onOpenDeclutter}
            className="text-[11px] font-bold text-[#A61B7A] dark:text-[#f485d1] hover:underline flex items-center gap-1 py-1 min-h-[28px]"
          >
            {t('dashboard.reviewAndClean')}
          </button>
        </div>

        {/* Donut Dial */}
        <div className="shrink-0">
          {renderDonut(keeperRate, '#A61B7A', 38)}
        </div>
      </div>
    </section>
  );
};
