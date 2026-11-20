/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Standalone Auth Window Runner
 * Runs in detached top-level window (opened with noopener,noreferrer)
 * Authenticates with Google Drive and broadcasts credentials back via BroadcastChannel & LocalStorage & postMessage
 */

import React, { useState, useEffect, useRef } from 'react';
import { googleDriveSignIn } from '../services/googleDrive';
import { Sparkles, CheckCircle2, AlertTriangle, Copy, Check, ArrowRight, RefreshCw } from 'lucide-react';

export const StandaloneAuthWindow: React.FC = () => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [acquiredToken, setAcquiredToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<number>(4);
  const autoTriggeredRef = useRef(false);

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const res = await googleDriveSignIn();
      if (res?.accessToken) {
        setAcquiredToken(res.accessToken);
        setAuthSuccess(true);

        const syncPayload = {
          type: 'DRIVE_AUTH_SUCCESS',
          token: res.accessToken,
          userEmail: res.user.email,
          displayName: res.user.displayName,
          photoURL: res.user.photoURL,
          timestamp: Date.now(),
        };

        // 1. Broadcast via BroadcastChannel (works smoothly across tabs/windows on same origin)
        try {
          if ('BroadcastChannel' in window) {
            const bc = new BroadcastChannel('drive_therapy_auth');
            bc.postMessage(syncPayload);
            bc.close();
          }
        } catch (bcErr) {
          console.warn('BroadcastChannel sync warning:', bcErr);
        }

        // 2. Broadcast via LocalStorage event
        try {
          localStorage.setItem('drive_auth_sync', JSON.stringify(syncPayload));
        } catch (lsErr) {
          console.warn('LocalStorage sync warning:', lsErr);
        }

        // 3. PostMessage to opener frame
        try {
          if (window.opener && !window.opener.closed) {
            try {
              window.opener.postMessage(syncPayload, window.location.origin);
            } catch {
              // ignore
            }
            try {
              window.opener.postMessage(syncPayload, '*');
            } catch {
              // ignore
            }
          }
        } catch (opErr) {
          console.warn('Opener postMessage warning:', opErr);
        }
      } else {
        throw new Error('No access token received from Google credential.');
      }
    } catch (err: any) {
      console.error('Standalone sign-in error:', err);
      setAuthError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };


  // Countdown and auto-close timer upon successful authentication
  useEffect(() => {
    if (!authSuccess) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          try {
            window.close();
          } catch {
            // Some browsers require explicit user gesture to close
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [authSuccess]);

  const handleCopyToken = () => {
    if (acquiredToken) {
      navigator.clipboard.writeText(acquiredToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] dark:bg-[#0D111D] text-slate-800 dark:text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md p-8 rounded-3xl bg-white dark:bg-[#131B2C] border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 text-center">
        {/* Brand Icon */}
        <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-[#403993] to-[#1074B1] flex items-center justify-center text-white shadow-lg shadow-[#1074B1]/20">
          <Sparkles className="w-8 h-8 text-[#BEBF61]" />
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Drive Therapy Authorization
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Top-level window bypassing browser iframe restrictions
          </p>
        </div>

        {authSuccess ? (
          <div className="space-y-4 py-2 animate-in fade-in duration-300">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex flex-col items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
              <span className="text-sm font-bold">Drive Connected Successfully!</span>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Credentials have been synchronized with your Drive Therapy studio tab.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
              <span>Auto-closing window in:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{countdown}s</span>
            </div>

            {acquiredToken && (
              <div className="space-y-2 pt-2 text-left">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                  OAuth Token (Stored In-Memory):
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    readOnly
                    value={acquiredToken}
                    className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 select-all"
                  />
                  <button
                    onClick={handleCopyToken}
                    className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1]"
                    title="Copy token to clipboard"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => window.close()}
              className="w-full min-h-[44px] py-3 rounded-2xl bg-[#1074B1] hover:bg-[#0d6194] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1]"
            >
              <span>Return to Studio (Close Window)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed text-left">
              Because this window runs outside the iframe sandbox, Google account authorization and OAuth popups execute freely without browser interference.
            </p>

            {authError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 text-left">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <button
              onClick={handleSignIn}
              disabled={isAuthenticating}
              className="w-full min-h-[44px] py-3.5 px-6 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-sm font-semibold shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1074B1]"
            >
              {isAuthenticating ? (
                <RefreshCw className="w-5 h-5 text-[#1074B1] animate-spin" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
              )}
              <span>{isAuthenticating ? 'Connecting to Google...' : 'Sign in with Google'}</span>
            </button>
          </div>
        )}

        <p className="text-[11px] text-slate-400">
          Drive Therapy only requests access with user consent to index metadata and stream previews.
        </p>
      </div>
    </div>
  );
};
