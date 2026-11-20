/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Studio Integration & Prompt Workbench
 * - Runs live prompts against catalog assets via Gemini API (Google AI Studio) or Local CPU fallback.
 * - Provides 1-click top-level launchers for Google AI Studio, Apps Script, and Looker Studio.
 */

import React, { useState } from 'react';
import { Sparkles, X, ExternalLink, Play, Copy, Check } from 'lucide-react';
import { MediaAsset } from '../types';
import { geminiUniversalEngine } from '../services/geminiUniversalEngine';

interface GoogleStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAsset?: MediaAsset | null;
}

export const GoogleStudioModal: React.FC<GoogleStudioModalProps> = ({
  isOpen,
  onClose,
  selectedAsset,
}) => {
  const [prompt, setPrompt] = useState(
    'Summarize key metadata, visual quality, and recommended organization tags for this asset.'
  );
  const [output, setOutput] = useState('');
  const [modelUsed, setModelUsed] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleRunPrompt = async () => {
    setIsRunning(true);
    try {
      const targetAsset: MediaAsset = selectedAsset || {
        id: 'studio_workspace_context',
        name: 'Drive Therapy Workspace Session',
        source: 'local',
        category: 'document',
        mimeType: 'text/plain',
        extension: 'txt',
        path: '/studio/session.txt',
        sizeBytes: 0,
        modifiedTime: new Date().toISOString(),
        thumbnailUrl: '',
        isCached: false,
        cullingStatus: 'unrated',
        rating: 0,
        tags: [],
        faces: [],
        palette: [],
        exif: {},
        quality: { sharpness: 90, exposure: 85, isBlurry: false },
      };
      const res = await geminiUniversalEngine.executeTask({
        asset: targetAsset,
        action: 'custom_query',
        customPrompt: prompt,
      });
      setOutput(res.resultText || res.text || '');
      setModelUsed(res.modelUsed);
    } catch (err: any) {
      setOutput(`Studio Run Error: ${err?.message || 'Failed to run prompt'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard?.writeText(output).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-studio-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[88vh] dt-drawer-enter theme-card"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1074B1]/15 text-[#1074B1] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="google-studio-title" className="text-base font-bold">
                Google Studio Workbench
              </h2>
              <p className="text-xs text-hint-inline">
                AI Studio Gemini API + Local CPU Fallback &amp; External Studio Launchers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Google Studio"
            className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto text-xs">
          {/* Quick External Launchers (Top-level tabs bypass iframe blocks) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <a
              href="https://aistudio.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-[#1074B1] flex items-center justify-between font-bold"
            >
              <span>Google AI Studio</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#1074B1]" />
            </a>
            <a
              href="https://script.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-[#52B197] flex items-center justify-between font-bold"
            >
              <span>Workspace Apps Script</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#52B197]" />
            </a>
            <a
              href="https://lookerstudio.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-[#A61B7A] flex items-center justify-between font-bold"
            >
              <span>Looker Studio</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#A61B7A]" />
            </a>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold">
                Prompt Workbench {selectedAsset ? `· Target: ${selectedAsset.name}` : '· Workspace Context'}
              </label>
              {modelUsed && (
                <span className="px-2 py-0.5 rounded-full bg-[#52B197]/15 text-[#52B197] font-bold text-[10px]">
                  {modelUsed}
                </span>
              )}
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
              placeholder="Enter prompt to test with Gemini API or Local CPU Mini-Models..."
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRunPrompt}
                disabled={isRunning || !prompt.trim()}
                className="min-h-[38px] px-4 rounded-xl bg-[#1074B1] text-white font-bold flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isRunning ? 'Running...' : 'Run in Studio'}</span>
              </button>
            </div>
          </div>

          {output && (
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-black/5 dark:bg-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] uppercase tracking-wider opacity-70">Studio Output</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2 py-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-1 text-[11px] font-semibold"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">{output}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
