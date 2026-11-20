/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-103] External Cloud Connectors OAuth 2.0 PKCE & Credential Wizard Modal
 * Guided 3-step onboarding for Dropbox, OneDrive, SharePoint, Wasabi/S3, iCloud, Flickr & WebDAV.
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  Copy,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  type ExternalCloudConnection,
  type ExternalCloudProviderId,
  buildExternalOAuthUrl,
  disconnectExternalCloud,
  getExternalCloudSpec,
  saveExternalCloudConnection,
  validateExternalCloudConfig,
} from '../services/externalCloudAuth';

interface ExternalCloudOAuthWizardModalProps {
  isOpen: boolean;
  providerId: ExternalCloudProviderId | null;
  existingConnection?: ExternalCloudConnection;
  onClose: () => void;
  onUpdated: (connections: Record<string, ExternalCloudConnection>) => void;
}

export const ExternalCloudOAuthWizardModal: React.FC<ExternalCloudOAuthWizardModalProps> = ({
  isOpen,
  providerId,
  existingConnection,
  onClose,
  onUpdated,
}) => {
  const spec = providerId ? getExternalCloudSpec(providerId) : null;
  const [accountLabel, setAccountLabel] = useState(existingConnection?.accountLabel || '');
  const [clientId, setClientId] = useState(existingConnection?.clientId || '');
  const [tenantId, setTenantId] = useState(existingConnection?.tenantId || 'common');
  const [accessToken, setAccessToken] = useState(existingConnection?.accessToken || '');
  const [endpointUrl, setEndpointUrl] = useState(
    existingConnection?.endpointUrl || spec?.defaultEndpoint || ''
  );
  const [region, setRegion] = useState(existingConnection?.region || 'us-east-1');
  const [bucket, setBucket] = useState(existingConnection?.bucket || '');
  const [username, setUsername] = useState(existingConnection?.username || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  if (!isOpen || !providerId || !spec) return null;

  const redirectUri =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/auth/${providerId}/callback`
      : `http://localhost:3010/api/auth/${providerId}/callback`;

  const handleCopyRedirect = () => {
    void navigator.clipboard?.writeText(redirectUri);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 1800);
  };

  const handleLaunchOAuth = () => {
    if (!clientId.trim()) {
      setErrorMsg(`Enter your ${spec.name} Client ID / App Key first to launch OAuth 2.0.`);
      return;
    }
    setErrorMsg(null);
    const state = `dt_${providerId}_${Date.now()}`;
    const url = buildExternalOAuthUrl({
      providerId,
      clientId,
      redirectUri,
      state,
      tenantId: tenantId || 'common',
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateExternalCloudConfig(providerId, {
      clientId,
      accessToken,
      endpointUrl,
      bucket,
      username,
    });
    if (!check.valid) {
      setErrorMsg(check.error || 'Please complete the required fields.');
      return;
    }
    setErrorMsg(null);
    const next = saveExternalCloudConnection({
      providerId,
      connected: true,
      accountLabel: accountLabel.trim() || `${spec.name} Account`,
      clientId: clientId.trim() || undefined,
      tenantId: tenantId.trim() || undefined,
      accessToken: accessToken.trim() || undefined,
      endpointUrl: endpointUrl.trim() || undefined,
      region: region.trim() || undefined,
      bucket: bucket.trim() || undefined,
      username: username.trim() || undefined,
      connectedAt: new Date().toISOString(),
    });
    onUpdated(next);
    onClose();
  };

  const handleDisconnect = () => {
    const next = disconnectExternalCloud(providerId);
    onUpdated(next);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${spec.name} OAuth & Connection Wizard`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm dt-motion-fade"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] dt-motion-modal"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 py-4 border-b flex items-center justify-between gap-3"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#1557B0]/15 text-[#1557B0] dark:text-sky-300 flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold truncate">{spec.name} Setup Wizard</h2>
              <p className="text-[11px] opacity-70 truncate">{spec.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10"
            aria-label="Close Wizard"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 text-xs">
          <div className="p-3 rounded-2xl border bg-emerald-500/5 border-emerald-500/25 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">Zero-Hardcoding Local Credential Storage</div>
              <p className="opacity-75 leading-relaxed">
                Credentials stay strictly on your device and are proxied only to verified {spec.name} endpoints.
              </p>
            </div>
          </div>

          <label className="block space-y-1">
            <span className="font-bold">Account Label</span>
            <input
              type="text"
              value={accountLabel}
              onChange={(e) => setAccountLabel(e.target.value)}
              placeholder={`My ${spec.name} Studio`}
              className="w-full min-h-[42px] px-3 rounded-xl border bg-transparent"
              style={{ borderColor: 'var(--theme-border)' }}
            />
          </label>

          {spec.authKind === 'oauth2-pkce' && (
            <>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Authorized Redirect URI</span>
                  <a
                    href={spec.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#1557B0] dark:text-sky-300 font-bold inline-flex items-center gap-1 hover:underline"
                  >
                    <span>Developer Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={redirectUri}
                    className="flex-1 min-h-[38px] px-3 rounded-xl border font-mono text-[11px] bg-black/5 dark:bg-white/5"
                    style={{ borderColor: 'var(--theme-border)' }}
                  />
                  <button
                    type="button"
                    onClick={handleCopyRedirect}
                    className="min-h-[38px] px-3 rounded-xl border font-bold flex items-center gap-1 hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    {copiedRedirect ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRedirect ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <label className="block space-y-1">
                <span className="font-bold">Client ID / App Key</span>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder={`Paste your ${spec.name} Client ID`}
                  className="w-full min-h-[42px] px-3 rounded-xl border font-mono text-[11px] bg-transparent"
                  style={{ borderColor: 'var(--theme-border)' }}
                />
              </label>

              {(providerId === 'onedrive' || providerId === 'sharepoint') && (
                <label className="block space-y-1">
                  <span className="font-bold">Tenant ID (optional, default: common)</span>
                  <input
                    type="text"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    placeholder="common"
                    className="w-full min-h-[42px] px-3 rounded-xl border font-mono text-[11px] bg-transparent"
                    style={{ borderColor: 'var(--theme-border)' }}
                  />
                </label>
              )}

              <label className="block space-y-1">
                <span className="font-bold">OAuth Access Token (for immediate live API browsing)</span>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Optional bearer token from OAuth flow"
                  className="w-full min-h-[42px] px-3 rounded-xl border font-mono text-[11px] bg-transparent"
                  style={{ borderColor: 'var(--theme-border)' }}
                />
              </label>

              <button
                type="button"
                onClick={handleLaunchOAuth}
                className="w-full min-h-[42px] px-4 rounded-xl border border-[#1557B0]/40 bg-[#1557B0]/10 text-[#1557B0] dark:text-sky-300 font-bold flex items-center justify-center gap-2 hover:bg-[#1557B0]/20"
              >
                <KeyRound className="w-4 h-4" />
                <span>Launch {spec.name} OAuth 2.0 Consent</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {spec.authKind === 's3-sigv4' && (
            <>
              <label className="block space-y-1">
                <span className="font-bold">S3 Endpoint URL (https://)</span>
                <input
                  type="url"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  placeholder="https://s3.us-east-1.wasabisys.com"
                  className="w-full min-h-[42px] px-3 rounded-xl border font-mono text-[11px] bg-transparent"
                  style={{ borderColor: 'var(--theme-border)' }}
                />
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block space-y-1">
                  <span className="font-bold">Bucket Name</span>
                  <input
                    type="text"
                    value={bucket}
                    onChange={(e) => setBucket(e.target.value)}
                    placeholder="studio-archive"
                    className="w-full min-h-[42px] px-3 rounded-xl border font-mono text-[11px] bg-transparent"
                    style={{ borderColor: 'var(--theme-border)' }}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-bold">Region</span>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="us-east-1"
                    className="w-full min-h-[42px] px-3 rounded-xl border font-mono text-[11px] bg-transparent"
                    style={{ borderColor: 'var(--theme-border)' }}
                  />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="font-bold">Access Key ID</span>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="AKIA..."
                  className="w-full min-h-[42px] px-3 rounded-xl border font-mono text-[11px] bg-transparent"
                  style={{ borderColor: 'var(--theme-border)' }}
                />
              </label>
            </>
          )}

          {spec.authKind === 'webdav-basic' && (
            <>
              <label className="block space-y-1">
                <span className="font-bold">WebDAV / Bridge Endpoint URL</span>
                <input
                  type="url"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  placeholder={spec.defaultEndpoint}
                  className="w-full min-h-[42px] px-3 rounded-xl border font-mono text-[11px] bg-transparent"
                  style={{ borderColor: 'var(--theme-border)' }}
                />
              </label>
              <label className="block space-y-1">
                <span className="font-bold">Username / Apple ID</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="user@domain.com"
                  className="w-full min-h-[42px] px-3 rounded-xl border bg-transparent"
                  style={{ borderColor: 'var(--theme-border)' }}
                />
              </label>
            </>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 font-semibold">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: 'var(--theme-border)' }}>
            {existingConnection?.connected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="min-h-[42px] px-3.5 rounded-xl border border-rose-500/40 text-rose-600 dark:text-rose-300 font-bold flex items-center gap-1.5 hover:bg-rose-500/10"
              >
                <Trash2 className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-4 rounded-xl border font-bold hover:bg-black/5 dark:hover:bg-white/10"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-5 rounded-xl bg-[#1557B0] hover:bg-[#10468f] text-white font-bold shadow-xs"
              >
                Save &amp; Connect
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
