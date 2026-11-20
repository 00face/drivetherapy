/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Castor Wardrobe Picker Modal (24 Outfits × 16 Expressions)
 * Renders Castor's transparent RGBA chibi sprites completely uncropped (object-contain, zero circular clipping).
 */

import React from 'react';
import { X, Sparkles } from 'lucide-react';
import {
  CASTOR_EXPRESSIONS,
  CASTOR_OUTFITS,
  getCastorOutfitById,
  getCastorSpriteUrl,
  type CastorAgentConfig,
  type CastorExpressionId,
} from '../services/castorAgent';

interface CastorWardrobeModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CastorAgentConfig;
  activeExpression: CastorExpressionId;
  onUpdateConfig: (next: CastorAgentConfig) => void;
  onPreviewExpression: (exprId: CastorExpressionId) => void;
}

export const CastorWardrobeModal: React.FC<CastorWardrobeModalProps> = ({
  isOpen,
  onClose,
  config,
  activeExpression,
  onUpdateConfig,
  onPreviewExpression,
}) => {
  if (!isOpen) return null;

  const currentOutfit = getCastorOutfitById(config.outfitId);
  const previewExpr: CastorExpressionId = config.pinnedExpression || activeExpression;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="castor-wardrobe-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[88vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Uncropped Live Preview */}
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between gap-4 shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={getCastorSpriteUrl(currentOutfit.id, previewExpr)}
              alt={`Castor — ${currentOutfit.name}`}
              className="w-16 h-16 object-contain overflow-visible p-0.5 shrink-0 drop-shadow-md"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="castor-wardrobe-title" className="text-sm font-extrabold truncate">
                  Castor Wardrobe — 24 Outfits × 16 Expressions
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#1074B1]/15 text-[#1074B1] dark:text-sky-300 border border-[#1074B1]/30">
                  {currentOutfit.id}
                </span>
              </div>
              <p className="text-xs opacity-70 truncate">
                {currentOutfit.name} · Expression: {previewExpr.slice(3)} · Full Uncropped RGBA Sprites
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config.autoExpression}
                onChange={(e) =>
                  onUpdateConfig({
                    ...config,
                    autoExpression: e.target.checked,
                    pinnedExpression: e.target.checked ? null : activeExpression,
                  })
                }
                className="accent-[#1074B1] w-4 h-4 rounded"
              />
              <span>Auto-React</span>
            </label>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              aria-label="Close Castor Wardrobe"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 24 Outfits Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
            {CASTOR_OUTFITS.map((outfit) => {
              const isSelected = outfit.id === config.outfitId;
              return (
                <button
                  key={outfit.id}
                  type="button"
                  onClick={() =>
                    onUpdateConfig({
                      ...config,
                      outfitId: outfit.id,
                    })
                  }
                  className={`p-2 rounded-2xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                    isSelected
                      ? 'border-[#1074B1] bg-[#1074B1]/12 shadow-sm ring-1 ring-[#1074B1]/40'
                      : 'hover:border-[#1074B1]/60 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  style={!isSelected ? { borderColor: 'var(--theme-border)' } : undefined}
                  title={`${outfit.id}: ${outfit.name}`}
                >
                  <img
                    src={getCastorSpriteUrl(outfit.id, '02_Happy')}
                    alt={`${outfit.id} ${outfit.name}`}
                    loading="lazy"
                    className="w-24 h-24 object-contain overflow-visible p-0.5 drop-shadow-sm"
                  />
                  <div className="leading-tight">
                    <div className="text-[10px] font-extrabold text-[#1074B1] dark:text-sky-300">{outfit.id}</div>
                    <div className="text-[10px] font-medium opacity-80 line-clamp-2">{outfit.name}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 16 Expressions Strip */}
          <div className="pt-3 border-t space-y-2" style={{ borderColor: 'var(--theme-border)' }}>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#1074B1]" />
                <span>Expressions (01–16) — Click to preview or pin</span>
              </span>
              {config.pinnedExpression && (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateConfig({
                      ...config,
                      autoExpression: true,
                      pinnedExpression: null,
                    })
                  }
                  className="text-[11px] text-[#1074B1] dark:text-sky-300 hover:underline"
                >
                  Reset to Auto-React
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CASTOR_EXPRESSIONS.map((expr) => {
                const isActive = previewExpr === expr.id;
                return (
                  <button
                    key={expr.id}
                    type="button"
                    onClick={() => {
                      onPreviewExpression(expr.id);
                      if (!config.autoExpression) {
                        onUpdateConfig({ ...config, pinnedExpression: expr.id });
                      }
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                      isActive
                        ? 'bg-[#1074B1] text-white border-[#1074B1]'
                        : 'hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                    style={!isActive ? { borderColor: 'var(--theme-border)' } : undefined}
                  >
                    {String(expr.num).padStart(2, '0')} {expr.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
