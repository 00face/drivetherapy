/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drive Therapy Codex Modal
 * Searchable in-app reference for Feature Walkthroughs, FAQ, Glossary & Use Cases.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search, X, Sparkles, HelpCircle, BookMarked, Briefcase } from 'lucide-react';
import {
  CodexCategory,
  CodexTopicId,
  searchCodexEntries,
} from '../services/codexContent';
import { getPolluxPortraitUrl } from '../services/polluxTourAgent';

interface CodexModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopicId?: CodexTopicId | null;
}

const TABS: Array<{ id: CodexCategory | 'all'; label: string; icon: React.ReactNode }> = [
  { id: 'all', label: 'All Topics', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: 'walkthroughs', label: 'Walkthroughs', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'faq', label: 'FAQ', icon: <HelpCircle className="w-3.5 h-3.5" /> },
  { id: 'glossary', label: 'Glossary', icon: <BookMarked className="w-3.5 h-3.5" /> },
  { id: 'use-cases', label: 'Use Cases', icon: <Briefcase className="w-3.5 h-3.5" /> },
];

export const CodexModal: React.FC<CodexModalProps> = ({ isOpen, onClose, initialTopicId }) => {
  const [activeTab, setActiveTab] = useState<CodexCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen && initialTopicId) {
      setActiveTab('all');
      setQuery('');
    }
  }, [isOpen, initialTopicId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const entries = useMemo(() => searchCodexEntries(query, activeTab), [query, activeTab]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="codex-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[88vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden dt-drawer-enter theme-card"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-3">
            <img
              src={getPolluxPortraitUrl()}
              alt="Pollux — Codex & Walkthrough Guide"
              className="w-14 h-14 object-contain overflow-visible shrink-0 drop-shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 id="codex-modal-title" className="text-base font-bold">
                  Drive Therapy Codex · Pollux Walkthroughs
                </h2>
              </div>
              <p className="text-xs text-hint-inline">
                Feature Walkthroughs, FAQ, Glossary &amp; Real-World Use Cases curated with Pollux
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Codex"
            className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search + Category Tabs */}
        <div className="px-6 pt-4 pb-3 border-b space-y-3" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search walkthroughs, FAQ, glossary terms, or shortcuts..."
              className="w-full min-h-[40px] pl-9 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[36px] px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#1074B1] text-white'
                    : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Entries List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-xs text-hint-inline">
              No Codex entries matched &quot;{query}&quot;.
            </div>
          ) : (
            entries.map((entry) => {
              const isHighlighted = initialTopicId && entry.topicId === initialTopicId;
              return (
                <article
                  key={entry.id}
                  className={`p-4 rounded-2xl border transition-colors ${
                    isHighlighted
                      ? 'border-[#52B197] bg-[#52B197]/10 ring-2 ring-[#52B197]/30'
                      : 'border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold">{entry.title}</h3>
                    <div className="flex items-center gap-1.5">
                      {entry.shortcut && (
                        <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-mono text-[10px] font-bold">
                          {entry.shortcut}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#1074B1]/10 text-[#1074B1]">
                        {entry.category}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs mt-1.5 opacity-90 leading-relaxed">{entry.summary}</p>
                  {entry.bullets.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs opacity-80 list-disc pl-5">
                      {entry.bullets.map((b, idx) => (
                        <li key={idx}>{b}</li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
