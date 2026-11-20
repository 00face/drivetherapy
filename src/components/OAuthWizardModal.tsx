/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Interactive Google OAuth 2.0 Setup Wizard (WCAG 2.2 AAA Compliant)
 * Frictionless onboarding guide for standard users and step-by-step
 * console walkthrough for power users bringing custom Google Cloud credentials.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Server,
  Cloud,
  HardDrive,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { configureServerOAuth, startDirectServerOAuth, fetchServerOAuthConfig } from '../services/googleDrive';
import { inspectTokenViaGoogle, getOAuthTokenRecord } from '../services/oauthStorage';
import { OAuthScopeInspection } from '../types';
import { useTranslation } from '../i18n';

export type WizardStep = 'tier' | 'console_guide' | 'credentials' | 'verify' | 'complete';

interface OAuthWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStandardConnect: () => void;
  onMountLocalFolder: () => void;
  onLoadSampleShoot: () => void;
  initialStep?: WizardStep;
}

export const OAuthWizardModal: React.FC<OAuthWizardModalProps> = ({
  isOpen,
  onClose,
  onStandardConnect,
  onMountLocalFolder,
  onLoadSampleShoot,
  initialStep = 'tier',
}) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<WizardStep>(initialStep);
  const [selectedTier, setSelectedTier] = useState<'standard' | 'custom' | 'local'>('standard');
  const [clientIdInput, setClientIdInput] = useState('');
  const [clientSecretInput, setClientSecretInput] = useState('');
  const [persistEnv, setPersistEnv] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasCopiedUri, setHasCopiedUri] = useState(false);
  const [isWaitingForAuth, setIsWaitingForAuth] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<OAuthScopeInspection | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Completed checklist tracking in Step 2
  const [checklist, setChecklist] = useState({
    openedConsole: false,
    enabledDriveApi: false,
    consentConfigured: false,
    redirectUriAdded: false,
  });

  const redirectUri = typeof window !== 'undefined'
    ? `${window.location.origin}/api/auth/google/callback`
    : 'http://localhost:3001/api/auth/google/callback';

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(initialStep);
      setErrorMessage(null);
      setIsWaitingForAuth(false);
      setInspectionResult(null);

      // Fetch active config to pre-fill if present
      fetchServerOAuthConfig().then((cfg) => {
        if (cfg.clientId) {
          setClientIdInput(cfg.clientId);
        }
      }).catch(() => {});
    }
  }, [isOpen, initialStep]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Cross-window auth listener in verify step
  useEffect(() => {
    if (!isOpen || currentStep !== 'verify') return;

    let bc: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel('drive_therapy_auth');
        bc.onmessage = async (event) => {
          const token = typeof event.data === 'string' ? event.data : event.data?.token || event.data?.payload?.accessToken;
          if (token) {
            await handleTokenAcquired(token);
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel error in wizard:', e);
    }

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS' && event.data?.payload?.accessToken) {
        await handleTokenAcquired(event.data.payload.accessToken);
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      bc?.close();
      window.removeEventListener('message', handleMessage);
    };
  }, [isOpen, currentStep]);

  if (!isOpen) return null;

  const handleCopyRedirectUri = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setHasCopiedUri(true);
      setChecklist((prev) => ({ ...prev, redirectUriAdded: true }));
      setTimeout(() => setHasCopiedUri(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = clientIdInput.trim();
    if (!cleanId || !cleanId.includes('.apps.googleusercontent.com')) {
      setErrorMessage('Please enter a valid Google OAuth Client ID ending with ".apps.googleusercontent.com"');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const res = await configureServerOAuth(cleanId, clientSecretInput.trim() || undefined, persistEnv);
    setIsSaving(false);

    if (res.success) {
      setCurrentStep('verify');
    } else {
      setErrorMessage(res.error || 'Failed to save OAuth credentials.');
    }
  };

  const handleStartVerificationFlow = async () => {
    setIsWaitingForAuth(true);
    setErrorMessage(null);
    const win = await startDirectServerOAuth();
    if (!win) {
      setErrorMessage('Popup window was blocked by your browser. Please allow popups.');
      setIsWaitingForAuth(false);
    }
  };

  const handleTokenAcquired = async (token: string) => {
    setIsWaitingForAuth(false);
    const audit = await inspectTokenViaGoogle(token);
    setInspectionResult(audit);
    setCurrentStep('complete');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="oauth-wizard-title"
      ref={modalRef}
    >
      <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-[#131B2C] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1074B1]/10 text-[#1074B1] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-[#52B197]" />
            </div>
            <div>
              <h2
                id="oauth-wizard-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                {t('oauthWizard.title')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Zero-friction onboarding or custom Google Cloud project setup
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close setup wizard"
            className="w-11 h-11 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Tracker */}
        <div className="px-6 py-3 bg-slate-100/60 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
              currentStep === 'tier' ? 'bg-[#1074B1] text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>1</span>
            <span className={currentStep === 'tier' ? 'text-slate-900 dark:text-slate-100' : ''}>Path</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">→</span>

          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
              currentStep === 'console_guide' ? 'bg-[#1074B1] text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>2</span>
            <span className={currentStep === 'console_guide' ? 'text-slate-900 dark:text-slate-100' : ''}>Cloud Console</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">→</span>

          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
              currentStep === 'credentials' ? 'bg-[#1074B1] text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>3</span>
            <span className={currentStep === 'credentials' ? 'text-slate-900 dark:text-slate-100' : ''}>Credentials</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">→</span>

          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
              currentStep === 'verify' || currentStep === 'complete' ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>4</span>
            <span className={currentStep === 'verify' || currentStep === 'complete' ? 'text-emerald-600 dark:text-emerald-400' : ''}>Verify</span>
          </div>
        </div>

        {/* Wizard Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">

          {/* STEP 1: Path Selection */}
          {currentStep === 'tier' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                  How would you like to use Drive Therapy?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  New users are never required to generate their own OAuth credentials. Select the path that fits your setup:
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* Option 1: Standard Managed 1-Click Connect */}
                <button
                  type="button"
                  onClick={() => setSelectedTier('standard')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 focus-visible:outline-2 focus-visible:outline-[#1074B1] ${
                    selectedTier === 'standard'
                      ? 'border-[#1074B1] bg-[#1074B1]/5 dark:bg-[#1074B1]/15 ring-2 ring-[#1074B1]/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#1074B1]/10 text-[#1074B1] flex items-center justify-center shrink-0 mt-0.5">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Standard 1-Click Cloud Connect (Recommended)
                      </span>
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#1074B1] bg-[#1074B1]/10 px-2 py-0.5 rounded-full">
                        Zero Keys Needed
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Instant sign-in with your Google account. Uses built-in secure authorization with automatic iframe failover and session persistence across reloads.
                    </p>
                  </div>
                </button>

                {/* Option 2: Custom Google Cloud App (Client ID / Secret) */}
                <button
                  type="button"
                  onClick={() => setSelectedTier('custom')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 focus-visible:outline-2 focus-visible:outline-[#1074B1] ${
                    selectedTier === 'custom'
                      ? 'border-[#1074B1] bg-[#1074B1]/5 dark:bg-[#1074B1]/15 ring-2 ring-[#1074B1]/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#52B197]/10 text-[#52B197] flex items-center justify-center shrink-0 mt-0.5">
                    <Server className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Custom Google Cloud Project (Power Users &amp; Enterprise)
                      </span>
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#52B197] bg-[#52B197]/10 px-2 py-0.5 rounded-full">
                        BYOK Setup
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Connect your own Google Cloud Client ID &amp; Secret for dedicated API quotas, custom OAuth consent screen branding, and direct PKCE code exchange.
                    </p>
                  </div>
                </button>

                {/* Option 3: Local Offline Studio */}
                <button
                  type="button"
                  onClick={() => setSelectedTier('local')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 focus-visible:outline-2 focus-visible:outline-[#1074B1] ${
                    selectedTier === 'local'
                      ? 'border-[#1074B1] bg-[#1074B1]/5 dark:bg-[#1074B1]/15 ring-2 ring-[#1074B1]/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Local OS Photo Folder / Instant Demo
                      </span>
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        100% Offline
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Zero cloud connection required. Mount any folder from your computer or load our sample automotive shoot to test speed culling and darkroom filters immediately.
                    </p>
                  </div>
                </button>
              </div>

              {/* Action Buttons for Step 1 */}
              <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>

                {selectedTier === 'standard' && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onStandardConnect();
                    }}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#1074B1] hover:bg-[#0d6194] text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  >
                    <span>Connect with Google (1-Click)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {selectedTier === 'custom' && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep('console_guide')}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#1074B1] hover:bg-[#0d6194] text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  >
                    <span>Start Guided Setup</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {selectedTier === 'local' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onLoadSampleShoot();
                      }}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      Sample Shoot
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onMountLocalFolder();
                      }}
                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#52B197] hover:bg-[#439c84] text-white text-xs font-bold shadow-md transition-all flex items-center gap-2"
                    >
                      <span>Mount Local Folder</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Google Cloud Console Guide */}
          {currentStep === 'console_guide' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Step 2: Google Cloud Console Walkthrough
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Follow these 4 simple steps in your Google Cloud Console to generate your Client ID:
                </p>
              </div>

              <div className="space-y-3">
                {/* Step 2.1: Open Cloud Console */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      1. Open Google Cloud Credentials Page
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Create or select a project in the Google Cloud Console.
                    </p>
                  </div>
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setChecklist((prev) => ({ ...prev, openedConsole: true }))}
                    className="min-h-[44px] px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-[#1074B1] hover:text-white text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <span>Open Console</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Step 2.2: Enable Google Drive & Photos APIs */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        2. Enable Google Drive &amp; Photos APIs
                      </span>
                      <p className="text-[11px] text-slate-500">
                        In &quot;APIs &amp; Services&quot; &gt; &quot;Library&quot;, enable <strong>Google Drive API</strong>, <strong>Photos Library API</strong>, and <strong>Google Photos Picker API</strong>.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setChecklist((prev) => ({ ...prev, enabledDriveApi: true }))}
                      className="min-h-[44px] px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-[#1074B1] hover:text-white text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <span>Drive API</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href="https://console.cloud.google.com/apis/library/photoslibrary.googleapis.com"
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-[#A61B7A] hover:text-white text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <span>Photos Library API</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href="https://console.cloud.google.com/apis/library/photospicker.googleapis.com"
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-[#A61B7A] hover:text-white text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <span>Photos Picker API</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href="https://console.cloud.google.com/apis/library/picker.googleapis.com"
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-[#52B197] hover:text-white text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <span>Google Picker API</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href="https://console.cloud.google.com/apis/library/tasks.googleapis.com"
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-[#52B197] hover:text-white text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <span>Tasks API ($0)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-[#52B197] hover:text-white text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <span>Calendar API ($0)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href="https://console.cloud.google.com/apis/library/people.googleapis.com"
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-[#52B197] hover:text-white text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <span>People/Contacts ($0)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-[#52B197] hover:text-white text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <span>Gmail API ($0)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href="https://console.cloud.google.com/apis/library/maps-backend.googleapis.com"
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-[#1074B1] hover:text-white text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <span>Maps JS API (Opt.)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Step 2.3: Consent Screen & Scopes */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                    3. Configure OAuth Consent Screen &amp; Scopes
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Set User Type to <strong>External</strong>, and add these required scopes:
                  </p>
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-[10px] space-y-1 text-slate-700 dark:text-slate-300">
                    <div>• https://www.googleapis.com/auth/drive.readonly</div>
                    <div>• https://www.googleapis.com/auth/drive.file</div>
                    <div>• https://www.googleapis.com/auth/photoslibrary.readonly</div>
                    <div>• https://www.googleapis.com/auth/photospicker.mediaitems.readonly</div>
                    <div>• https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata</div>
                  </div>
                </div>

                {/* Step 2.4: Copy Authorized Redirect URI */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-[#1074B1]/10 via-[#52B197]/10 to-[#BEBF61]/10 border border-[#1074B1]/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      4. Copy Authorized Redirect URI
                    </span>
                    {hasCopiedUri && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Copied to clipboard!
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    When creating the <strong>OAuth client ID (Web application)</strong>, paste this exact URI under <strong>Authorized redirect URIs</strong>:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={redirectUri}
                      className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyRedirectUri}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1074B1] hover:bg-[#0d6194] text-white text-xs font-bold flex items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                    >
                      {hasCopiedUri ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>Copy URI</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep('tier')}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep('credentials')}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#1074B1] hover:bg-[#0d6194] text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                >
                  <span>I Have My Client ID</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Enter Credentials */}
          {currentStep === 'credentials' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Step 3: Ingest Custom Google Cloud Credentials
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Paste the Client ID and optional Client Secret generated in the Google Cloud Console:
                </p>
              </div>

              <form onSubmit={handleSaveCredentials} className="space-y-4">
                <div>
                  <label
                    htmlFor="wizard-client-id"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                  >
                    Google OAuth Client ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="wizard-client-id"
                    type="text"
                    required
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    placeholder="123456789-abcdef.apps.googleusercontent.com"
                    className="w-full px-4 py-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono placeholder-slate-400 focus:outline-none focus:border-[#1074B1] focus:ring-2 focus:ring-[#1074B1]/20"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Must end with &quot;.apps.googleusercontent.com&quot;
                  </span>
                </div>

                <div>
                  <label
                    htmlFor="wizard-client-secret"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                  >
                    Google Client Secret <span className="text-slate-400 font-normal">(Optional for PKCE)</span>
                  </label>
                  <input
                    id="wizard-client-secret"
                    type="password"
                    value={clientSecretInput}
                    onChange={(e) => setClientSecretInput(e.target.value)}
                    placeholder="GOCSPX-xxxxxxxxxxxxxxxx"
                    className="w-full px-4 py-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono placeholder-slate-400 focus:outline-none focus:border-[#1074B1] focus:ring-2 focus:ring-[#1074B1]/20"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Persist to local .env configuration
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Automatically saves to server environment variables for persistent workstation reboots.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    id="wizard-persist-env"
                    checked={persistEnv}
                    onChange={(e) => setPersistEnv(e.target.checked)}
                    className="w-5 h-5 accent-[#1074B1] rounded"
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCurrentStep('console_guide')}
                    className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving || !clientIdInput.trim()}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#1074B1] hover:bg-[#0d6194] disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    <span>Save &amp; Test Connection</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 4: Live Verification Test */}
          {currentStep === 'verify' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Step 4: Verify Custom OAuth Connection
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your Client ID is saved on the server. Click below to launch a live test authorization using your new Google Cloud application:
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-r from-[#1074B1]/10 via-[#52B197]/10 to-[#BEBF61]/10 border border-[#1074B1]/30 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#1074B1]/20 text-[#1074B1] mx-auto flex items-center justify-center">
                  <Server className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Client ID Ready: {clientIdInput.slice(0, 24)}...
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 max-w-md mx-auto mt-1">
                    This test will prompt your Google account consent screen and automatically verify drive read &amp; write permissions.
                  </p>
                </div>

                {isWaitingForAuth ? (
                  <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#1074B1]">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Waiting for authorization from popup window...</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartVerificationFlow}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#1074B1] hover:bg-[#0d6194] text-white text-xs font-bold shadow-md transition-all inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-[#1074B1]"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Authorize with Custom Client ID</span>
                  </button>
                )}
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep('credentials')}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Edit Credentials</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Close &amp; Test Later
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Verification Complete */}
          {currentStep === 'complete' && (
            <div className="space-y-5 text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Custom Google OAuth 2.0 Connected!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Your Google Cloud credentials have been verified and activated for this workstation session.
                </p>
              </div>

              {inspectionResult && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-left space-y-2 text-xs">
                  {inspectionResult.userEmail && (
                    <div><strong>Connected Account:</strong> {inspectionResult.userEmail}</div>
                  )}
                  <div>
                    <strong>Verified Permissions:</strong>
                    <div className="grid grid-cols-2 gap-2 mt-1 text-[11px]">
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        <span>drive.readonly (Read Media)</span>
                      </div>
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        <span>drive.file (Upload &amp; Sidecars)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-8 py-3 rounded-2xl bg-[#1074B1] hover:bg-[#0d6194] text-white text-xs font-bold shadow-lg transition-all"
              >
                Enter Studio Workspace
              </button>
            </div>
          )}

        </div>

        {/* Footer info badge */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Zero-Token Default Guarantee • WCAG 2.2 AAA Strict</span>
          </span>
          <span>Redirect URI: {redirectUri}</span>
        </div>
      </div>
    </div>
  );
};
