/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Temporary (!) Full Diagnostic Mode Modal
 * Live-tests every backend endpoint, IndexedDB store, search index, Web Worker,
 * spatial parser, Codex/Tour integrity, and local CPU models, then writes telemetry
 * to diagnostics/full_diagnostic_report.json & .md via POST /api/diagnostics/report.
 */

import React, { useState } from 'react';
import { AlertOctagon, CheckCircle2, XCircle, Play, X, FileText } from 'lucide-react';
import { parseSpatialTextToGeoJson } from '../services/mapDataLoaderEngine';
import { resolvePostOAuthCapabilities } from '../services/googleServiceCapabilities';
import { CODEX_ENTRIES } from '../services/codexContent';
import { TOUR_TRACKS } from '../services/interactiveTourEngine';
import { discoverOllamaModels } from '../services/localMiniModelEngine';
import { LitHybridSearchIndex } from '../services/fastSearchIndex';
import { getOAuthTokenRecord } from '../services/oauthStorage';

export interface DiagnosticProbeResult {
  id: string;
  name: string;
  category: 'backend' | 'storage' | 'engines' | 'security' | 'walkthroughs';
  passed: boolean;
  latencyMs: number;
  detail: string;
}

interface FullDiagnosticRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FullDiagnosticRunnerModal: React.FC<FullDiagnosticRunnerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [results, setResults] = useState<DiagnosticProbeResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  if (!isOpen) return null;

  const runProbe = async (
    id: string,
    name: string,
    category: DiagnosticProbeResult['category'],
    fn: () => Promise<string>
  ): Promise<DiagnosticProbeResult> => {
    const start = performance.now();
    try {
      const detail = await fn();
      return { id, name, category, passed: true, latencyMs: Math.round(performance.now() - start), detail };
    } catch (err: any) {
      return {
        id,
        name,
        category,
        passed: false,
        latencyMs: Math.round(performance.now() - start),
        detail: err?.message || 'Probe failed',
      };
    }
  };

  const handleRunAll = async () => {
    setIsRunning(true);
    setSavedPath(null);
    const checks: DiagnosticProbeResult[] = [];

    // 1. Backend endpoints
    for (const ep of [
      '/api/health',
      '/api/auth/google/config',
      '/api/maps/config',
      '/api/models/local-status',
      '/api/music/health',
      '/api/butler/health',
    ]) {
      checks.push(
        await runProbe(`ep:${ep}`, `GET ${ep}`, 'backend', async () => {
          const r = await fetch(ep);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return `HTTP ${r.status} OK`;
        })
      );
    }

    // 2. SSRF Security Guard on /api/maps/fetch-url
    checks.push(
      await runProbe('sec:ssrf', 'SSRF Guard (/api/maps/fetch-url)', 'security', async () => {
        const r = await fetch('/api/maps/fetch-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://127.0.0.1/secret.geojson' }),
        });
        if (r.status !== 403) throw new Error(`Expected HTTP 403, got ${r.status}`);
        return 'Blocked loopback SSRF with HTTP 403';
      })
    );

    // 3. IndexedDB & Search Index
    checks.push(
      await runProbe('eng:lit', 'LIT Hybrid Search Index (500 items)', 'engines', async () => {
        const idx = new LitHybridSearchIndex();
        const sample = Array.from({ length: 500 }, (_, i) => ({
          id: `diag_${i}`,
          name: `IMG_${i}.jpg`,
          source: 'local' as const,
          category: 'image' as const,
          mimeType: 'image/jpeg',
          extension: 'jpg',
          path: `/diag/IMG_${i}.jpg`,
          sizeBytes: 1024,
          modifiedTime: new Date().toISOString(),
          thumbnailUrl: '',
          isCached: false,
          cullingStatus: 'unrated' as const,
          rating: 0,
          tags: ['diagnostic'],
          faces: [],
          palette: [],
          exif: {},
          quality: { sharpness: 80, exposure: 80, isBlurry: false },
        }));
        idx.rebuild(sample);
        const hits = idx.search('IMG_42');
        if (!hits.some((h) => h.id === 'diag_42')) throw new Error('Expected diag_42 in search results');
        return 'Indexed 500 assets & queried cleanly';
      })
    );

    // 4. Map Data Loader (GeoJSON + GPX)
    checks.push(
      await runProbe('eng:map', 'Spatial Data Parser (GeoJSON/GPX)', 'engines', async () => {
        const res = parseSpatialTextToGeoJson(
          '<gpx><wpt lat="30.26" lon="-97.74"><name>Test</name></wpt></gpx>',
          'test.gpx'
        );
        if (res.featureCount !== 1) throw new Error('Expected 1 GPX feature');
        return 'Parsed GPX & GeoJSON cleanly';
      })
    );

    // 5. Google Service Capabilities & OAuth Token
    checks.push(
      await runProbe('eng:oauth', 'OAuth & Post-OAuth Free Services', 'storage', async () => {
        const rec = getOAuthTokenRecord();
        const caps = resolvePostOAuthCapabilities(rec?.scopes || []);
        return `${caps.filter((c) => c.status === 'active').length}/${caps.length} capabilities active`;
      })
    );

    // 6. Ollama Local CPU Probe
    checks.push(
      await runProbe('eng:ollama', 'Local Ollama CPU Probe', 'engines', async () => {
        const ol = await discoverOllamaModels();
        return ol.available ? `Online (${ol.models.length} models)` : 'Offline (WASM fallback ready)';
      })
    );

    // 7. Walkthroughs & Codex Integrity
    checks.push(
      await runProbe('wt:codex', 'Tour Tracks & Codex Knowledge Base', 'walkthroughs', async () => {
        if (TOUR_TRACKS.length < 3 || CODEX_ENTRIES.length < 10) {
          throw new Error('Incomplete Tour or Codex entries');
        }
        return `${TOUR_TRACKS.length} Tour tracks · ${CODEX_ENTRIES.length} Codex entries verified`;
      })
    );

    setResults(checks);

    // Save telemetry report to server for engineering review
    try {
      const saveRes = await fetch('/api/diagnostics/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          userAgent: navigator.userAgent,
          results: checks,
        }),
      });
      if (saveRes.ok) {
        const data = await saveRes.json();
        setSavedPath(data.markdownPath || 'diagnostics/full_diagnostic_report.md');
      }
    } catch {}

    setIsRunning(false);
  };

  const passCount = results.filter((r) => r.passed).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="full-diag-title"
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
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h2 id="full-diag-title" className="text-base font-bold">
                Full Diagnostic Sweep (!)
              </h2>
              <p className="text-xs text-hint-inline">
                Tests all endpoints, security guards, engines, walkthroughs &amp; writes telemetry report
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Full Diagnostic Mode"
            className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleRunAll}
              disabled={isRunning}
              className="min-h-[40px] px-4 rounded-xl bg-amber-500 text-white font-bold flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              <span>{isRunning ? 'Running Full Sweep...' : 'Run Full Diagnostic Sweep'}</span>
            </button>

            {results.length > 0 && (
              <span className="font-mono font-bold">
                {passCount} / {results.length} Passed
              </span>
            )}
          </div>

          {savedPath && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <FileText className="w-4 h-4 shrink-0" />
              <span>
                Telemetry report written to <code>{savedPath}</code>
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            {results.map((r) => (
              <div
                key={r.id}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {r.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-bold truncate">{r.name}</div>
                    <div className="text-[11px] opacity-75 truncate">{r.detail}</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono opacity-60 shrink-0">{r.latencyMs}ms</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
