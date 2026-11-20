/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Contextual (?) Semantic Help Badge
 * - Hover: Shows quick tooltip explaining the semantic area
 * - Click: Opens focused info modal for that area with a direct "Open in Codex" button
 */

import React, { useState } from 'react';
import { HelpCircle, BookOpen, X } from 'lucide-react';
import { StudioTooltip } from './StudioTooltip';
import { CodexTopicId, getCodexTopicById } from '../services/codexContent';

interface CodexHelpBadgeProps {
  topicId: CodexTopicId;
  onOpenCodex?: (topicId: CodexTopicId) => void;
  size?: 'sm' | 'md';
}

export const CodexHelpBadge: React.FC<CodexHelpBadgeProps> = ({
  topicId,
  onOpenCodex,
  size = 'sm',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const topic = getCodexTopicById(topicId);

  const handleOpenFullCodex = () => {
    setIsOpen(false);
    if (onOpenCodex) {
      onOpenCodex(topicId);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dt-open-codex', { detail: { topicId } }));
    }
  };

  return (
    <>
      <StudioTooltip label={topic.shortTooltip} placement="top">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          aria-label={`Help: ${topic.title}`}
          className={`inline-flex items-center justify-center rounded-full border border-slate-300/80 dark:border-slate-700 text-slate-500 hover:text-[#1074B1] hover:border-[#1074B1] transition-colors shrink-0 ${
            size === 'sm' ? 'w-5 h-5' : 'w-6 h-6'
          }`}
        >
          <HelpCircle className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        </button>
      </StudioTooltip>

      {isOpen && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border p-5 shadow-2xl space-y-3 dt-drawer-enter theme-card"
            style={{
              backgroundColor: 'var(--theme-surface)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#1074B1] shrink-0" />
                <h3 className="text-sm font-bold">{topic.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close help"
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs opacity-90 leading-relaxed">{topic.summary}</p>

            {topic.bullets.length > 0 && (
              <ul className="text-xs opacity-80 list-disc pl-5 space-y-1">
                {topic.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--theme-border)' }}>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                Close
              </button>
              {topic.hasMoreInCodex !== false && (
                <button
                  type="button"
                  onClick={handleOpenFullCodex}
                  className="min-h-[36px] px-3.5 rounded-xl bg-[#1074B1] text-white text-xs font-bold flex items-center gap-1.5 hover:opacity-90"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Open in Codex →</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
