/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AI Provider Hub & Multi-Gateway Settings (Low-Resource Spec)
 */

import React, { useState } from 'react';
import {
  Server,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Key,
  ShieldAlert,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { ProviderConfig } from '../types';
import { testProvider } from '../services/providerRegistry';

interface ProviderSettingsViewProps {
  providers: ProviderConfig[];
  onUpdateProviders: (providers: ProviderConfig[]) => void;
}

export const ProviderSettingsView: React.FC<ProviderSettingsViewProps> = ({
  providers,
  onUpdateProviders,
}) => {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; latencyMs: number; message: string }>>({});

  const handleToggle = (id: string) => {
    const next = providers.map((p) =>
      p.id === id ? { ...p, enabled: !p.enabled } : p
    );
    onUpdateProviders(next);
  };

  const handleKeyChange = (id: string, key: string) => {
    const next = providers.map((p) =>
      p.id === id ? { ...p, apiKey: key } : p
    );
    onUpdateProviders(next);
  };

  const handleMovePriority = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= providers.length) return;

    const copy = [...providers];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);

    // Re-assign priority indices
    const updated = copy.map((item, idx) => ({ ...item, priority: idx + 1 }));
    onUpdateProviders(updated);
  };

  const runTest = async (config: ProviderConfig) => {
    setTestingId(config.id);
    const res = await testProvider(config);
    setTestResults((prev) => ({ ...prev, [config.id]: res }));
    setTestingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1074B1]">
            <Server className="w-4 h-4" />
            <span>Multi-Provider Vision Gateway &amp; Router</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Intelligent Cascade &amp; Auto-Failover Hub
          </h2>
          <p className="text-xs text-slate-500 max-w-xl">
            Requests cascade from zero-cost in-browser models to keyless free cloud providers (Puter, Pollinations, Horde), then to your optional free-tier keys. If a provider hits rate limits (HTTP 429), it automatically cools down and fails over.
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-[#52B197]/10 dark:bg-[#52B197]/20 border border-[#52B197]/30 text-right shrink-0">
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#52B197] font-bold block">
            Offline Resilience
          </span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            100% Functional Without Keys
          </span>
        </div>
      </div>

      {/* Provider Registry Table */}
      <div className="bg-white dark:bg-[#151C2C] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold uppercase text-[10px]">
              <th className="py-3 px-3">Priority</th>
              <th className="py-3 px-3">Provider</th>
              <th className="py-3 px-3">Capabilities</th>
              <th className="py-3 px-3">API Key / Endpoint</th>
              <th className="py-3 px-3">Daily Count</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {providers.map((provider, idx) => {
              const test = testResults[provider.id];
              const isTesting = testingId === provider.id;

              return (
                <tr
                  key={provider.id}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                    !provider.enabled ? 'opacity-50' : ''
                  }`}
                >
                  {/* Priority Reordering */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 font-mono font-bold text-slate-400">
                      <span>#{idx + 1}</span>
                      <div className="flex flex-col">
                        <button
                          onClick={() => handleMovePriority(idx, 'up')}
                          disabled={idx === 0}
                          className="hover:text-slate-900 dark:hover:text-white disabled:opacity-20 p-0.5"
                          title="Move higher priority"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMovePriority(idx, 'down')}
                          disabled={idx === providers.length - 1}
                          className="hover:text-slate-900 dark:hover:text-white disabled:opacity-20 p-0.5"
                          title="Move lower priority"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Provider Name */}
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>{provider.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {provider.defaultModel}
                    </span>
                  </td>

                  {/* Capabilities Kinds */}
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1">
                      {provider.kinds.map((kind) => (
                        <span
                          key={kind}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        >
                          {kind}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Key / Config */}
                  <td className="py-3 px-3">
                    {provider.id === 'local_worker' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                        Zero-Key In-Browser Worker
                      </span>
                    ) : provider.id === 'gemini' ? (
                      <span className="text-[#1074B1] font-semibold text-[11px]">
                        Server-Side Secret Injected
                      </span>
                    ) : provider.id === 'puter' || provider.id === 'pollinations' ? (
                      <span className="text-slate-500 font-semibold text-[11px]">
                        Keyless / Popup Auth
                      </span>
                    ) : (
                      <input
                        type="password"
                        placeholder="Paste API key here (localStorage)..."
                        value={provider.apiKey}
                        onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 w-48 font-mono focus:outline-none focus:border-[#1074B1]"
                      />
                    )}
                  </td>

                  {/* Daily Request Counter */}
                  <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                    {provider.dailyRequests} reqs
                  </td>

                  {/* Status Indicator */}
                  <td className="py-3 px-3">
                    {test ? (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                          test.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                        }`}
                        title={test.message}
                      >
                        {test.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        <span>{test.latencyMs}ms</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Untested</span>
                    )}
                  </td>

                  {/* Actions: Enable Toggle & Ping */}
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => runTest(provider)}
                        disabled={isTesting}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-medium flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                        <span>Test</span>
                      </button>

                      <input
                        type="checkbox"
                        checked={provider.enabled}
                        onChange={() => handleToggle(provider.id)}
                        className="rounded text-[#1074B1] accent-[#1074B1] w-4 h-4 cursor-pointer"
                        title={provider.enabled ? 'Enabled' : 'Disabled'}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
