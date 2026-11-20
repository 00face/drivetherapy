/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Drive Share, Permissions, Revisions & Workspace Export Modal
 */

import React, { useEffect, useState } from 'react';
import {
  X,
  Share2,
  Globe,
  UserPlus,
  Trash2,
  Copy,
  Check,
  History,
  Download,
  Lock,
} from 'lucide-react';
import { MediaAsset } from '../types';
import { useTranslation } from '../i18n';
import {
  DrivePermission,
  DriveRevision,
  listDrivePermissions,
  shareDriveFile,
  removeDrivePermission,
  listDriveRevisions,
  getDriveShareLink,
  getWorkspaceExportOptions,
  exportGoogleWorkspaceDoc,
} from '../services/googleDrive';
import { loadCachedGoogleContacts, GoogleContactEntry } from '../services/googleContacts';

interface DriveShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: MediaAsset | null;
}

export const DriveShareModal: React.FC<DriveShareModalProps> = ({ isOpen, onClose, asset }) => {
  const { t } = useTranslation();
  const [permissions, setPermissions] = useState<DrivePermission[]>([]);
  const [revisions, setRevisions] = useState<DriveRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'reader' | 'commenter' | 'writer'>('reader');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'share' | 'revisions' | 'export'>('share');
  const [cachedContacts] = useState<GoogleContactEntry[]>(() => loadCachedGoogleContacts());

  const fileId = asset?.id.replace(/^drive_/, '') || '';
  const exportOptions = asset ? getWorkspaceExportOptions(asset.mimeType) : [];

  useEffect(() => {
    if (!isOpen || !fileId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      listDrivePermissions(fileId).catch(() => []),
      listDriveRevisions(fileId).catch(() => []),
    ])
      .then(([perms, revs]) => {
        if (cancelled) return;
        setPermissions(perms);
        setRevisions(revs);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, fileId]);

  if (!isOpen || !asset) return null;

  const shareUrl = getDriveShareLink(fileId);
  const anyonePerm = permissions.find((p) => p.type === 'anyone');

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setError(null);
    try {
      const created = await shareDriveFile(fileId, {
        type: 'user',
        role: inviteRole,
        emailAddress: inviteEmail.trim(),
      });
      setPermissions((prev) => [...prev, created]);
      setInviteEmail('');
    } catch (err: any) {
      setError(err?.message || 'Could not share file. Check Drive permissions.');
    }
  };

  const handleToggleAnyone = async (role: 'reader' | 'commenter' | 'writer' | 'restricted') => {
    setError(null);
    try {
      if (role === 'restricted') {
        if (anyonePerm) {
          await removeDrivePermission(fileId, anyonePerm.id);
          setPermissions((prev) => prev.filter((p) => p.id !== anyonePerm.id));
        }
      } else {
        if (anyonePerm) {
          await removeDrivePermission(fileId, anyonePerm.id);
        }
        const created = await shareDriveFile(fileId, { type: 'anyone', role });
        setPermissions((prev) => [...prev.filter((p) => p.type !== 'anyone'), created]);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not update link access.');
    }
  };

  const handleExport = async (mimeType: string, ext: string) => {
    setError(null);
    try {
      const blob = await exportGoogleWorkspaceDoc(fileId, mimeType);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${asset.name.replace(/\.[^.]+$/, '')}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (err: any) {
      setError(err?.message || 'Workspace export failed.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${asset.name}`}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-[#1074B1]/15 text-[#1074B1]">
              <Share2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">{t('driveShare.title')}: {asset.name}</h3>
              <p className="text-[11px] opacity-65">Google Drive Permissions, Versions & Export</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center"
            aria-label="Close share dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="px-5 pt-3 flex items-center gap-2 border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <button
            onClick={() => setActiveTab('share')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'share' ? 'border-[#1074B1] text-[#1074B1]' : 'border-transparent opacity-65 hover:opacity-100'
            }`}
          >
            Share & Access
          </button>
          <button
            onClick={() => setActiveTab('revisions')}
            className={`px-3 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'revisions' ? 'border-[#1074B1] text-[#1074B1]' : 'border-transparent opacity-65 hover:opacity-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Versions ({revisions.length})</span>
          </button>
          {exportOptions.length > 0 && (
            <button
              onClick={() => setActiveTab('export')}
              className={`px-3 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'export' ? 'border-[#1074B1] text-[#1074B1]' : 'border-transparent opacity-65 hover:opacity-100'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Doc</span>
            </button>
          )}
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 font-medium">
              {error}
            </div>
          )}

          {activeTab === 'share' && (
            <>
              <form onSubmit={handleInvite} className="flex items-center gap-2">
                <input
                  type="email"
                  list="dt-google-contacts-list"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Add people by email..."
                  className="flex-1 min-h-[44px] px-3 rounded-xl border bg-transparent text-xs"
                  style={{ borderColor: 'var(--theme-border)' }}
                />
                <datalist id="dt-google-contacts-list">
                  {cachedContacts.map((c) => (
                    <option key={c.resourceName} value={c.email}>
                      {c.name}
                    </option>
                  ))}
                </datalist>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'reader' | 'commenter' | 'writer')}
                  className="min-h-[44px] px-2.5 rounded-xl border bg-transparent text-xs font-semibold"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  <option value="reader">Viewer</option>
                  <option value="commenter">Commenter</option>
                  <option value="writer">Editor</option>
                </select>
                <button
                  type="submit"
                  className="min-h-[44px] px-3 rounded-xl bg-[#1074B1] text-white font-bold flex items-center gap-1.5 hover:opacity-95"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Invite</span>
                </button>
              </form>

              <div className="space-y-2">
                <div className="font-bold opacity-75 uppercase text-[10px] tracking-wider">People with access</div>
                {loading ? (
                  <div className="opacity-60 py-2">Loading permissions...</div>
                ) : permissions.length === 0 ? (
                  <div className="opacity-60 py-2">Only owner has access (or Drive read-only token).</div>
                ) : (
                  <div className="space-y-1.5">
                    {permissions.map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-xl border flex items-center justify-between gap-2"
                        style={{ borderColor: 'var(--theme-border)' }}
                      >
                        <div className="min-w-0">
                          <div className="font-bold truncate">
                            {p.type === 'anyone' ? 'Anyone with the link' : p.displayName || p.emailAddress || p.type}
                          </div>
                          {p.emailAddress && <div className="text-[11px] opacity-65 truncate">{p.emailAddress}</div>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-semibold capitalize">
                            {p.role}
                          </span>
                          {p.role !== 'owner' && (
                            <button
                              onClick={async () => {
                                await removeDrivePermission(fileId, p.id);
                                setPermissions((prev) => prev.filter((item) => item.id !== p.id));
                              }}
                              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500"
                              title="Remove access"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl border space-y-2.5" style={{ borderColor: 'var(--theme-border)' }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {anyonePerm ? <Globe className="w-4 h-4 text-[#52B197]" /> : <Lock className="w-4 h-4 opacity-70" />}
                    <span className="font-bold">General Link Access</span>
                  </div>
                  <select
                    value={anyonePerm ? anyonePerm.role : 'restricted'}
                    onChange={(e) => handleToggleAnyone(e.target.value as any)}
                    className="px-2.5 py-1.5 rounded-lg border bg-transparent text-xs font-semibold"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <option value="restricted">Restricted</option>
                    <option value="reader">Anyone: Viewer</option>
                    <option value="commenter">Anyone: Commenter</option>
                    <option value="writer">Anyone: Editor</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="truncate opacity-65 font-mono text-[11px]">{shareUrl}</span>
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 rounded-lg bg-[#1074B1]/15 text-[#1074B1] font-bold flex items-center gap-1.5 shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy link'}</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'revisions' && (
            <div className="space-y-2">
              {revisions.length === 0 ? (
                <div className="opacity-65 py-4 text-center">No revision history returned for this file.</div>
              ) : (
                revisions.map((rev, idx) => (
                  <div
                    key={rev.id}
                    className="p-3 rounded-xl border flex items-center justify-between"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <div>
                      <div className="font-bold">Version {revisions.length - idx}</div>
                      <div className="text-[11px] opacity-65">
                        {new Date(rev.modifiedTime).toLocaleString()}
                        {rev.lastModifyingUser?.displayName ? ` • ${rev.lastModifyingUser.displayName}` : ''}
                      </div>
                    </div>
                    {rev.size && <span className="font-mono text-[11px] opacity-75">{Math.round(Number(rev.size) / 1024)} KB</span>}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-2">
              <p className="opacity-75">Export Google Workspace document directly to a standard format:</p>
              {exportOptions.map((opt) => (
                <button
                  key={opt.mimeType}
                  onClick={() => handleExport(opt.mimeType, opt.ext)}
                  className="w-full p-3 rounded-xl border flex items-center justify-between hover:border-[#1074B1] transition-colors font-semibold"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  <span>{opt.label}</span>
                  <Download className="w-4 h-4 text-[#1074B1]" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
