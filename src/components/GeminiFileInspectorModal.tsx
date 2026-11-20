/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gemini Multi-Format File Inspector & AI Copilot Modal
 * Provides interactive, format-aware AI reasoning on demand across:
 * Photos, RAWs, Videos, Audios, Documents, Spreadsheets, and Archives.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Copy,
  Check,
  Send,
  Download,
  Key,
  ExternalLink,
  BookOpen,
  RefreshCw,
  FileText,
  Camera,
  Scissors,
  Volume2,
  FileSpreadsheet,
  Archive,
  HelpCircle,
} from 'lucide-react';
import { MediaAsset } from '../types';
import {
  geminiUniversalEngine,
  AiActionType,
  AiTaskResponse,
} from '../services/geminiUniversalEngine';
import { useTranslation } from '../i18n';

interface GeminiFileInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: MediaAsset | null;
  initialAction?: AiActionType;
  onOpenNotebookLmExport?: () => void;
}

export const GeminiFileInspectorModal: React.FC<GeminiFileInspectorModalProps> = ({
  isOpen,
  onClose,
  asset,
  initialAction = 'critique',
  onOpenNotebookLmExport,
}) => {
  const { t } = useTranslation();

  const [activeAction, setActiveAction] = useState<AiActionType>(initialAction);
  const [customPrompt, setCustomPrompt] = useState('');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AiTaskResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => geminiUniversalEngine.getApiKey());

  // Sync action when initialAction changes
  useEffect(() => {
    if (initialAction) {
      setActiveAction(initialAction);
    }
  }, [initialAction]);

  // Execute initial action when opened
  useEffect(() => {
    if (isOpen && asset) {
      handleRunAction(activeAction);
    }
  }, [isOpen, asset?.id, activeAction]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !asset) return null;

  const handleRunAction = async (actionToRun: AiActionType, promptOverride?: string) => {
    setIsLoading(true);
    setResponse(null);
    try {
      const res = await geminiUniversalEngine.executeTask({
        asset,
        action: actionToRun,
        customPrompt: promptOverride || customPrompt,
        targetLanguage: targetLang,
        payloadText: asset.aiDescription,
      });
      setResponse(res);
    } catch (err: any) {
      setResponse({
        success: false,
        action: actionToRun,
        title: 'Analysis Error',
        resultText: `Failed to complete AI task: ${err.message || 'Unknown error'}. You can configure your own Google Gemini API key via the key icon above.`,
        modelUsed: 'Error',
        latencyMs: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!response?.resultText) return;
    navigator.clipboard.writeText(response.resultText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveApiKey = () => {
    geminiUniversalEngine.setApiKey(apiKeyInput);
    setShowApiKeyInput(false);
    handleRunAction(activeAction);
  };

  const getActionListForCategory = (cat: string): { action: AiActionType; label: string }[] => {
    switch (cat) {
      case 'document':
        return [
          { action: 'doc_summary', label: 'Executive Summary' },
          { action: 'action_items', label: 'Action Items & Deadlines' },
          { action: 'translate', label: 'Translate Document' },
          { action: 'ocr', label: 'Extract Optical Text' },
          { action: 'custom_query', label: 'Custom Prompt' },
        ];
      case 'audio':
        return [
          { action: 'transcribe', label: 'Speech-to-Text Transcription' },
          { action: 'voice_memo_summary', label: 'Voice Memo Summary' },
          { action: 'extract_quotes', label: 'Extract Key Quotes' },
          { action: 'custom_query', label: 'Custom Prompt' },
        ];
      case 'video':
        return [
          { action: 'video_chapters', label: 'Generate Video Chapters' },
          { action: 'scene_log', label: 'Cinematic Scene Log' },
          { action: 'suggest_trims', label: 'Recommend In/Out Trims' },
          { action: 'custom_query', label: 'Custom Prompt' },
        ];
      case 'archive':
        return [
          { action: 'archive_summary', label: 'Archive Package Inventory' },
          { action: 'custom_query', label: 'Custom Prompt' },
        ];
      case 'image':
      case 'raw':
      default:
        return [
          { action: 'critique', label: 'Visual Critique & Composition' },
          { action: 'captions', label: 'Social Captions & Tags' },
          { action: 'alt_text', label: 'WCAG Accessible Alt-Text' },
          { action: 'color_advice', label: 'Color Grading & 3D LUT Advice' },
          { action: 'custom_query', label: 'Custom Prompt' },
        ];
    }
  };

  const availableActions = getActionListForCategory(asset.category);

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      aria-modal="true"
      role="dialog"
      aria-label="Gemini Multi-Format File Inspector"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl theme-card overflow-hidden animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-4 sm:p-5 border-b flex items-center justify-between gap-3 shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#1074B1]/10 text-[#1074B1] flex items-center justify-center font-bold shrink-0">
              <Sparkles className="w-5 h-5 text-[#BEBF61]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight truncate">
                  Gemini File Inspector
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#1074B1]/15 text-[#1074B1] dark:text-[#67b7e6]">
                  {asset.category}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                {asset.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              className={`p-2 rounded-xl transition-colors ${
                geminiUniversalEngine.hasApiKey()
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Configure Google Gemini API Key"
              aria-label="Gemini API Key"
            >
              <Key className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Close (Esc)"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* API Key Drawer (if expanded) */}
        {showApiKeyInput && (
          <div className="p-3 bg-slate-100/90 dark:bg-slate-800/90 border-b flex flex-wrap items-center justify-between gap-2 text-xs" style={{ borderColor: 'var(--theme-border)' }}>
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Key className="w-4 h-4 text-[#1074B1] shrink-0" />
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Paste Google Gemini API Key (AI Studio)..."
                className="w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveApiKey}
                className="px-3 py-1.5 rounded-lg bg-[#1074B1] text-white font-bold hover:bg-[#0e6397] transition-colors"
              >
                Save Key
              </button>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:underline flex items-center gap-1 text-[11px]"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Action Tabs Bar */}
        <div
          className="px-4 py-2 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 text-xs"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          {availableActions.map((act) => {
            const isSelected = activeAction === act.action;
            return (
              <button
                key={act.action}
                onClick={() => {
                  setActiveAction(act.action);
                  handleRunAction(act.action);
                }}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 ${
                  isSelected
                    ? 'bg-[#1074B1] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {act.label}
              </button>
            );
          })}
        </div>

        {/* Body & Result Display */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar space-y-4 text-xs">
          {/* Custom Query Input (when active) */}
          {activeAction === 'custom_query' && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRunAction('custom_query', customPrompt)}
                placeholder="Ask Gemini anything about this file (e.g. 'What is the key takeaway in section 2?')..."
                className="flex-1 px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-xs focus:outline-none focus:border-[#1074B1]"
              />
              <button
                onClick={() => handleRunAction('custom_query', customPrompt)}
                disabled={!customPrompt.trim() || isLoading}
                className="px-3.5 py-2 rounded-xl bg-[#1074B1] text-white font-bold disabled:opacity-40 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ask</span>
              </button>
            </div>
          )}

          {/* Translation Language Selector (when active) */}
          {activeAction === 'translate' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Translate to:</span>
              <select
                value={targetLang}
                onChange={(e) => {
                  setTargetLang(e.target.value);
                  handleRunAction('translate');
                }}
                className="px-2.5 py-1.5 rounded-xl border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                <option value="Spanish">Spanish (Español)</option>
                <option value="French">French (Français)</option>
                <option value="German">German (Deutsch)</option>
                <option value="Japanese">Japanese (日本語)</option>
                <option value="Chinese">Chinese (中文)</option>
                <option value="Arabic">Arabic (العربية)</option>
                <option value="Portuguese">Portuguese (Português)</option>
                <option value="Italian">Italian (Italiano)</option>
              </select>
            </div>
          )}

          {/* Result Output Card */}
          <div
            className="p-4 rounded-2xl border min-h-[220px] relative transition-all"
            style={{
              backgroundColor: 'var(--theme-surface)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text)',
            }}
          >
            {isLoading ? (
              <div className="h-44 flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-[#1074B1]" />
                <span className="text-xs font-semibold">Gemini reasoning in progress...</span>
              </div>
            ) : response ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                    {response.title}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                    <span>{response.modelUsed}</span>
                    {response.latencyMs > 0 && <span>· {response.latencyMs}ms</span>}
                  </div>
                </div>

                <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-200">
                  {response.resultText}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className="p-3.5 border-t flex flex-wrap items-center justify-between gap-2.5 shrink-0 bg-slate-50/70 dark:bg-slate-900/70 text-xs"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!response?.resultText}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Result'}</span>
            </button>

            {onOpenNotebookLmExport && (
              <button
                onClick={() => {
                  onClose();
                  onOpenNotebookLmExport();
                }}
                className="px-3 py-1.5 rounded-xl bg-[#52B197]/15 hover:bg-[#52B197]/25 text-[#298d75] dark:text-[#52B197] font-semibold flex items-center gap-1.5 transition-colors"
                title="Compile project dossier for Google NotebookLM podcast generation"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Export to NotebookLM</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-bold hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
