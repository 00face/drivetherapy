/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Drive Auth Diagnostic & Direct Token Connector Modal
 * WCAG 2.2 AAA Strict Compliant
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  AlertTriangle,
  KeyRound,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
  Info,
  Terminal,
  Search,
  Server,
  Lock,
} from 'lucide-react';
import { OAuthScopeInspection } from '../types';
import { inspectTokenViaGoogle, getOAuthTokenRecord, getTokenRemainingSeconds } from '../services/oauthStorage';
import { fetchServerOAuthConfig, startDirectServerOAuth } from '../services/googleDrive';
import {
  resolvePostOAuthCapabilities,
  classifyAccountPlanLabel,
  ResolvedCapability,
} from '../services/googleServiceCapabilities';
import { discoverOllamaModels } from '../services/localMiniModelEngine';
import { CodexHelpBadge } from './CodexHelpBadge';

interface AuthDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  authError: string | null;
  onRetrySignIn: () => Promise<void> | void;
  onConnectWithToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  onOpenOAuthWizard?: () => void;
  driveQuotaLimitBytes?: number;
}

export const AuthDiagnosticsModal: React.FC<AuthDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  authError,
  onRetrySignIn,
  onConnectWithToken,
  onOpenOAuthWizard,
  driveQuotaLimitBytes,
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'token' | 'directOAuth' | 'inspector' | 'diagnostics' | 'apiStatus'>('directOAuth');
  const [isRetrying, setIsRetrying] = useState(false);
  const [isWaitingForNewWindow, setIsWaitingForNewWindow] = useState(false);
  const [scopeInspection, setScopeInspection] = useState<OAuthScopeInspection | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [serverOAuthConfig, setServerOAuthConfig] = useState<{ hasDirectOAuth: boolean; clientId: string | null } | null>(null);
  const [apiHealth, setApiHealth] = useState<{ online: boolean; port?: number; hasGeminiKey?: boolean; hasGoogleMapsKey?: boolean } | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; models: Array<{ name: string; sizeMb: number }> }>({ available: false, models: [] });
  const [capabilities, setCapabilities] = useState<ResolvedCapability[]>(() => resolvePostOAuthCapabilities([]));
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValidationError(null);
      setValidationSuccess(null);
      setIsWaitingForNewWindow(false);

      // Check current token in storage
      const activeRecord = getOAuthTokenRecord();
      if (activeRecord && !tokenInput) {
        setTokenInput(activeRecord.accessToken);
      }

      // Check direct server OAuth configuration
      fetchServerOAuthConfig().then(setServerOAuthConfig).catch(() => {});

      // Probe backend health, Ollama local CPU models & resolve OAuth capabilities
      fetch('/api/health')
        .then((r) => (r.ok ? r.json() : null))
        .then((h) => setApiHealth(h ? { online: true, ...h } : { online: false }))
        .catch(() => setApiHealth({ online: false }));
      discoverOllamaModels().then(setOllamaStatus).catch(() => {});
      setCapabilities(resolvePostOAuthCapabilities(activeRecord?.scopes || []));

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleValidateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setValidationError('Please enter a valid Google OAuth Access Token.');
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    setValidationSuccess(null);

    try {
      const result = await onConnectWithToken(tokenInput.trim());
      if (result.success) {
        setValidationSuccess('Google Drive connected successfully! Initializing catalog stream...');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setValidationError(result.error || 'Failed to authenticate token with Google Drive API.');
      }
    } catch (err: any) {
      setValidationError(err.message || 'Unexpected error occurred while validating token.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleInspectToken = async () => {
    const target = tokenInput.trim();
    if (!target) {
      setValidationError('Please enter a token to inspect scopes.');
      return;
    }
    setIsInspecting(true);
    try {
      const inspection = await inspectTokenViaGoogle(target);
      setScopeInspection(inspection);
      if (!inspection.isValid) {
        setValidationError(inspection.error || 'Google token validation rejected token.');
      } else {
        setValidationError(null);
      }
    } finally {
      setIsInspecting(false);
    }
  };

  const handleLaunchDirectOAuth = async () => {
    setIsWaitingForNewWindow(true);
    const win = await startDirectServerOAuth();
    if (!win) {
      setValidationError('Direct OAuth popout was blocked by browser. Please allow popups.');
      setIsWaitingForNewWindow(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetrySignIn();
      onClose();
    } catch {
      // Error will be caught and reflected in authError
    } finally {
      setIsRetrying(false);
    }
  };

  const handleLaunchStandalone = () => {
    setIsWaitingForNewWindow(true);
    const authUrl = `${window.location.origin}${window.location.pathname}?auth_flow=standalone&auto=true`;
    window.open(authUrl, '_blank', 'noopener,noreferrer');
  };

  const isFramed = typeof window !== 'undefined' && window.self !== window.top;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-diagnostics-title"
      ref={modalRef}
    >
      <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-[#131B2C] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="auth-diagnostics-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                Google Drive OAuth Diagnostics & Readiness
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Token lifecycle, scope audit & zero-friction authentication
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-11 h-11 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diagnostic Alert Box */}
        {authError && (
          <div className="mx-6 mt-5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <span className="font-semibold block mb-0.5">Detected Restriction:</span>
              {authError}
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="px-6 pt-4 flex gap-1 border-b border-slate-100 dark:border-slate-800/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('directOAuth')}
            className={`min-h-[44px] px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1] ${
              activeTab === 'directOAuth'
                ? 'border-[#1074B1] text-[#1074B1] dark:text-[#67b7e6] bg-slate-50 dark:bg-slate-800/40'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>OAuth 2.0 PKCE</span>
          </button>
          <button
            onClick={() => setActiveTab('inspector')}
            className={`min-h-[44px] px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1] ${
              activeTab === 'inspector'
                ? 'border-[#1074B1] text-[#1074B1] dark:text-[#67b7e6] bg-slate-50 dark:bg-slate-800/40'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Scope Inspector</span>
          </button>
          <button
            onClick={() => setActiveTab('token')}
            className={`min-h-[44px] px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1] ${
              activeTab === 'token'
                ? 'border-[#1074B1] text-[#1074B1] dark:text-[#67b7e6] bg-slate-50 dark:bg-slate-800/40'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Direct Token</span>
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`min-h-[44px] px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1] ${
              activeTab === 'diagnostics'
                ? 'border-[#1074B1] text-[#1074B1] dark:text-[#67b7e6] bg-slate-50 dark:bg-slate-800/40'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>Boundary Audit</span>
          </button>
          <button
            onClick={() => setActiveTab('apiStatus')}
            className={`min-h-[44px] px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1] ${
              activeTab === 'apiStatus'
                ? 'border-[#52B197] text-[#52B197] bg-slate-50 dark:bg-slate-800/40'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>API Status &amp; Free Services</span>
          </button>
        </div>

        {/* Setup Wizard Quick Shortcut Banner */}
        {onOpenOAuthWizard && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-gradient-to-r from-[#1074B1]/10 via-[#52B197]/10 to-transparent border border-[#52B197]/30 flex items-center justify-between gap-3">
            <div className="text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">Need custom Google Cloud credentials?</span>
              <span className="text-slate-500 text-[11px]">Walk through the step-by-step interactive setup wizard</span>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenOAuthWizard();
              }}
              className="px-3 py-1.5 rounded-xl bg-[#52B197] hover:bg-[#439680] text-slate-950 font-bold text-xs transition-colors shrink-0"
            >
              Open Wizard
            </button>
          </div>
        )}

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* TAB 1: Direct Token */}
          {activeTab === 'token' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Provide a valid Google OAuth Access Token. The token is persisted into your secure session and survives browser reloads.
              </p>

              <form onSubmit={handleValidateToken} className="space-y-4">
                <div>
                  <label
                    htmlFor="google-access-token"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                  >
                    Google OAuth Access Token
                  </label>
                  <input
                    id="google-access-token"
                    ref={inputRef}
                    type="password"
                    autoComplete="off"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="ya29.a0AcM612..."
                    className="w-full px-4 py-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#1074B1] focus:ring-2 focus:ring-[#1074B1]/20 font-mono transition-all"
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] text-slate-400">
                      Starts with &quot;ya29.&quot; • Persisted across reloads • RFC 7009 revocable
                    </span>
                    {tokenInput.trim() && (
                      <button
                        type="button"
                        onClick={handleInspectToken}
                        className="text-[11px] text-[#1074B1] hover:underline font-semibold flex items-center gap-1"
                      >
                        <Search className="w-3 h-3" />
                        <span>Inspect Scopes</span>
                      </button>
                    )}
                  </div>
                </div>

                {validationError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}

                {validationSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{validationSuccess}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1]"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                    <span>Standard Popup</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isValidating || !tokenInput.trim()}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#1074B1] hover:bg-[#0d6194] disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1]"
                  >
                    {isValidating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Validating Token...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Connect Token</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Instructions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  1-Click Token Providers:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <a
                    href="https://developers.google.com/oauthplayground"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#1074B1] text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <span className="font-semibold block text-slate-900 dark:text-slate-100 group-hover:text-[#1074B1]">
                        OAuth 2.0 Playground
                      </span>
                      <span className="text-[10px] text-slate-500">Select Drive API v3</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#1074B1]" />
                  </a>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                    <span className="font-semibold block text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-[#52B197]" /> Via Google Cloud CLI
                    </span>
                    <code className="text-[10px] font-mono text-slate-500 block mt-1 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      gcloud auth print-access-token
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Direct Server-Assisted OAuth 2.0 (PKCE) */}
          {activeTab === 'directOAuth' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Direct Server-Assisted OAuth 2.0 bypasses Firebase and exchanges authorization codes with Google directly using Proof Key for Code Exchange (PKCE) and anti-CSRF state tokens.
              </p>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-[#1074B1]" /> Server Endpoint Status
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    serverOAuthConfig?.hasDirectOAuth
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  }`}>
                    {serverOAuthConfig?.hasDirectOAuth ? 'Client ID Configured' : 'No Client Secret in .env'}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                  <div><strong>Redirect URI:</strong> <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">{window.location.origin}/api/auth/google/callback</code></div>
                  <div><strong>Supported Grants:</strong> Authorization Code with PKCE (S256), Refresh Token</div>
                </div>

                <button
                  onClick={handleLaunchDirectOAuth}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1074B1] hover:bg-[#0d6194] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1]"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Launch Direct OAuth 2.0 (PKCE) Flow</span>
                </button>

                {onOpenOAuthWizard && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenOAuthWizard();
                    }}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#52B197] text-[#52B197] hover:bg-[#52B197]/10 text-xs font-bold transition-all flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52B197]"
                  >
                    <Server className="w-4 h-4 text-[#52B197]" />
                    <span>Launch Step-by-Step OAuth Setup Wizard</span>
                  </button>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5">
                <span className="font-semibold block text-slate-800 dark:text-slate-200">How to configure custom Google Client ID:</span>
                <p>Add the following variables to your <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">.env</code> file:</p>
                <pre className="p-2 rounded-lg bg-slate-900 text-slate-100 font-mono text-[10px] overflow-x-auto">
{`GOOGLE_CLIENT_ID="your_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your_client_secret"`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: Scope Inspector */}
          {activeTab === 'inspector' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Audit active token permissions against Google&apos;s live tokeninfo endpoint. Verifies read, write, and identity privileges.
              </p>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Paste access token to inspect..."
                  className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                />
                <button
                  type="button"
                  onClick={handleInspectToken}
                  disabled={isInspecting || !tokenInput.trim()}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1074B1] hover:bg-[#0d6194] disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                >
                  {isInspecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>Inspect</span>
                </button>
              </div>

              {scopeInspection && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Token Audit Result:
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      scopeInspection.isValid
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    }`}>
                      {scopeInspection.isValid ? 'Valid Active Token' : 'Rejected by Google'}
                    </span>
                  </div>

                  {scopeInspection.isValid && (
                    <div className="space-y-2.5 text-xs">
                      {scopeInspection.userEmail && (
                        <div><strong>Account:</strong> <span className="font-mono text-slate-600 dark:text-slate-300">{scopeInspection.userEmail}</span></div>
                      )}
                      <div>
                        <strong>Remaining Validity:</strong>{' '}
                        <span className="font-semibold text-[#1074B1]">{Math.floor(scopeInspection.expiresInSeconds / 60)}m {scopeInspection.expiresInSeconds % 60}s</span>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <strong>Permission Scopes:</strong>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          <div className={`p-2 rounded-lg border text-[11px] flex items-center gap-1.5 ${
                            scopeInspection.hasDriveReadonly || scopeInspection.hasDriveFull
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300'
                              : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300'
                          }`}>
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>drive.readonly (Read Media)</span>
                          </div>

                          <div className={`p-2 rounded-lg border text-[11px] flex items-center gap-1.5 ${
                            scopeInspection.hasDriveFile || scopeInspection.hasDriveFull
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300'
                          }`}>
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>drive.file (Upload & Organize)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Diagnostics & Boundary Audit */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <h3 className="font-bold text-slate-800 dark:text-slate-200">
                Browsing Context & Boundary Telemetry:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Nesting Context</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {isFramed ? 'Framed (Iframe Sandbox)' : 'Top-Level Window Context'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Persistence Status</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    Encrypted Session Storage Active
                  </span>
                </div>
              </div>

              <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-400 pt-1">
                <li>
                  <strong>Clickjacking Defense:</strong> Google OAuth blocks rendering inside iframes via <code className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">X-Frame-Options: DENY</code>. Drive Therapy dispatches popups in top-level browsing contexts to comply.
                </li>
                <li>
                  <strong>Partitioned Cookies (CHIPS):</strong> Modern browsers partition third-party cookies. Tokens passed via direct token entry or BroadcastChannel bypass cookie partitioning limitations entirely.
                </li>
                <li>
                  <strong>Universal 401 Interception:</strong> All Google Drive API calls are wrapped in an authenticated fetch pipeline that intercepts token expiry and triggers renewal automatically.
                </li>
              </ul>
            </div>
          )}

          {activeTab === 'apiStatus' && (
            <div className="space-y-4 text-xs dt-drawer-enter">
              {/* Live Service Health Probes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Backend Server</span>
                  <span className={`font-bold ${apiHealth?.online ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                    {apiHealth?.online ? `Online :${apiHealth.port}` : 'Probing...'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block">OAuth Token TTL</span>
                  <span className="font-bold font-mono">
                    {getTokenRemainingSeconds() > 0 ? `${Math.round(getTokenRemainingSeconds() / 60)}m left` : 'Signed Out'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Maps Engine</span>
                  <span className="font-bold text-[#1074B1]">
                    {apiHealth?.hasGoogleMapsKey ? 'Google Maps + OSM' : 'FOSS OSM (Zero-Key)'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Local Ollama CPU</span>
                  <span className={`font-bold ${ollamaStatus.available ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                    {ollamaStatus.available ? `${ollamaStatus.models.length} model(s)` : 'Offline (WASM Ready)'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#1074B1]/10 border border-[#1074B1]/25 flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Post-OAuth Free Services Matrix</span>
                    <CodexHelpBadge topicId="api-status" />
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Plan Classifier: {classifyAccountPlanLabel(driveQuotaLimitBytes)} · Zero-billing Workspace APIs activate automatically upon OAuth grant.
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {capabilities.map((cap) => (
                  <div
                    key={cap.id}
                    className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-white">{cap.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            cap.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : cap.status === 'ready-incremental'
                              ? 'bg-[#1074B1]/15 text-[#1074B1]'
                              : cap.status === 'billing-optional'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                          }`}
                        >
                          {cap.status === 'active'
                            ? 'Active'
                            : cap.status === 'ready-incremental'
                            ? 'Free · 1-Click Enable'
                            : cap.status === 'billing-optional'
                            ? 'Cloud Billing Free Tier'
                            : 'Workspace Paid'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {cap.freeAllowance} — {cap.driveTherapyBenefit}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {cap.consoleLibraryUrl && (
                        <a
                          href={cap.consoleLibraryUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-[36px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#1074B1] text-[11px] font-semibold flex items-center gap-1"
                          title="Open in Google Cloud Console API Library"
                        >
                          <span>API</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {cap.status === 'ready-incremental' && cap.incrementalScopeKey && (
                        <button
                          type="button"
                          onClick={() => startDirectServerOAuth({ service: 'workspace', prompt: 'consent' })}
                          className="min-h-[36px] px-3 rounded-xl bg-[#1074B1] text-white text-[11px] font-bold hover:opacity-90"
                        >
                          Enable
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span>RFC 7009 Revocation Enabled • No Plaintext Storage</span>
          </span>
          <button
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1]"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
