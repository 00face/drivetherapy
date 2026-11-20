/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Ecosystem Hub Modal
 * Unified studio for Keep-Style Notes & Checklists (Drive-synced),
 * Gmail Attachment Harvester & Direct Send, Google Tasks Sync, and Google Contacts.
 */

import React, { useEffect, useState } from 'react';
import {
  X,
  StickyNote,
  Mail,
  CheckSquare,
  Users,
  Plus,
  Trash2,
  CloudUpload,
  Send,
  RefreshCw,
  Check,
  Download,
  GraduationCap,
  Database,
  KeyRound,
  Sparkles,
  Archive,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from '../i18n';
import { MediaAsset } from '../types';
import {
  KeepNote,
  KeepNoteColor,
  loadKeepNotes,
  saveKeepNotes,
  syncKeepNotesToDrive,
  parseKeepTakeoutNote,
} from '../services/keepNotesEngine';
import {
  GmailAttachmentItem,
  fetchGmailAttachments,
  mapGmailAttachmentToAsset,
  sendGmailMessage,
} from '../services/gmailMediaHarvester';
import {
  GoogleTaskItem,
  loadCachedGoogleTasks,
  fetchGoogleTasks,
  createGoogleTask,
  toggleGoogleTaskStatus,
} from '../services/googleTasksEngine';
import {
  GoogleContactEntry,
  loadCachedGoogleContacts,
  fetchGoogleContacts,
} from '../services/googleContacts';
import { createGoogleWorkspaceFile } from '../services/googleDrive';
import {
  ClassroomCourse,
  fetchClassroomCourses,
  fetchClassroomCourseAssets,
} from '../services/googleClassroomEngine';
import {
  GcsBucket,
  fetchGcsBuckets,
  fetchGcsObjects,
} from '../services/gcsArchiveEngine';
import {
  CastorArchiveRecord,
  parseCastorOrTakeoutRecords,
  exportToPolluxJsonl,
  exportToPolluxHtml,
  loadCastorArchives,
  saveCastorArchives,
} from '../services/takeoutAndCastorEngine';

interface GoogleEcosystemHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  cloudConnected: boolean;
  onImportAssetsToCatalog: (assets: MediaAsset[]) => void;
  onOpenLightbox?: (asset: MediaAsset) => void;
}

type EcosystemTab = 'keep' | 'gmail' | 'tasks' | 'contacts' | 'classroom' | 'gcs' | 'takeout';

const COLOR_STYLES: Record<KeepNoteColor, string> = {
  default: 'border-slate-300 dark:border-slate-700',
  citron: 'border-amber-400/60 bg-amber-500/10',
  teal: 'border-teal-400/60 bg-teal-500/10',
  sky: 'border-sky-400/60 bg-sky-500/10',
  magenta: 'border-pink-400/60 bg-pink-500/10',
  indigo: 'border-indigo-400/60 bg-indigo-500/10',
};

export const GoogleEcosystemHubModal: React.FC<GoogleEcosystemHubModalProps> = ({
  isOpen,
  onClose,
  cloudConnected,
  onImportAssetsToCatalog,
  onOpenLightbox,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<EcosystemTab>('keep');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [classroomBrief, setClassroomBrief] = useState<string | null>(null);

  // Keep Notes State
  const [notes, setNotes] = useState<KeepNote[]>(() => loadKeepNotes());
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteColor, setNoteColor] = useState<KeepNoteColor>('citron');

  // Gmail State
  const [gmailAttachments, setGmailAttachments] = useState<GmailAttachmentItem[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [sendTo, setSendTo] = useState('');
  const [sendSubject, setSendSubject] = useState('');
  const [sendBody, setSendBody] = useState('');

  // Tasks State
  const [tasks, setTasks] = useState<GoogleTaskItem[]>(() => loadCachedGoogleTasks());
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [tasksLoading, setTasksLoading] = useState(false);

  // Contacts State
  const [contacts, setContacts] = useState<GoogleContactEntry[]>(() => loadCachedGoogleContacts());
  const [contactsLoading, setContactsLoading] = useState(false);

  // Classroom State
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [classroomAssets, setClassroomAssets] = useState<MediaAsset[]>([]);
  const [classroomLoading, setClassroomLoading] = useState(false);

  // Cloud Storage (GCS) State
  const [gcsBuckets, setGcsBuckets] = useState<GcsBucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState('');
  const [gcsAssets, setGcsAssets] = useState<MediaAsset[]>([]);
  const [gcsLoading, setGcsLoading] = useState(false);

  // Takeout & Castor/Pollux State
  const [castorRecords, setCastorRecords] = useState<CastorArchiveRecord[]>(() => loadCastorArchives());
  const [takeoutFolderPath, setTakeoutFolderPath] = useState('');
  const [takeoutLoading, setTakeoutLoading] = useState(false);

  useEffect(() => {
    saveKeepNotes(notes);
  }, [notes]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    let bc: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel('drive_therapy_auth');
        bc.onmessage = (evt) => {
          if (evt?.data?.type === 'oauth_complete') {
            setStatusMsg('Google OAuth scopes updated — ready to sync Workspace data.');
          }
        };
      }
    } catch {}
    return () => {
      window.removeEventListener('keydown', onKey);
      bc?.close();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const openExtraScopesPopup = () => {
    window.open(
      '/api/auth/google/login?extra_scopes=gmail,tasks,contacts,classroom',
      'dt_extra_scopes',
      'width=540,height=680'
    );
    setStatusMsg('Opened Google OAuth popup to grant optional Gmail, Tasks, Contacts & Classroom scopes.');
  };

  const runWorkspaceAiAssist = async (payload: {
    action: 'note_to_tasks' | 'draft_gmail' | 'classroom_brief';
    text: string;
    subject?: string;
    courseName?: string;
  }) => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/gemini/workspace-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Workspace AI error (${res.status})`);
      }
      return await res.json();
    } catch (err: any) {
      setStatusMsg(err?.message || 'Workspace AI assist failed.');
      return null;
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() && !noteBody.trim()) return;
    const created: KeepNote = {
      id: `keep_${Date.now()}`,
      title: noteTitle.trim() || 'Quick Shoot Note',
      body: noteBody.trim(),
      color: noteColor,
      pinned: false,
      checklist: [],
      updatedAt: new Date().toISOString(),
      source: 'local',
    };
    setNotes((prev) => [created, ...prev]);
    setNoteTitle('');
    setNoteBody('');
  };

  const handleLoadGmail = async () => {
    setGmailLoading(true);
    setStatusMsg(null);
    try {
      const items = await fetchGmailAttachments();
      setGmailAttachments(items);
      setStatusMsg(`Found ${items.length} Gmail attachment(s).`);
    } catch (err: any) {
      setStatusMsg(err?.message || 'Gmail load failed.');
    } finally {
      setGmailLoading(false);
    }
  };

  const handleLoadTasks = async () => {
    setTasksLoading(true);
    setStatusMsg(null);
    try {
      const items = await fetchGoogleTasks();
      setTasks(items);
      setStatusMsg(`Synced ${items.length} Google Task(s).`);
    } catch (err: any) {
      setStatusMsg(err?.message || 'Google Tasks sync failed.');
    } finally {
      setTasksLoading(false);
    }
  };

  const handleLoadContacts = async () => {
    setContactsLoading(true);
    setStatusMsg(null);
    try {
      const items = await fetchGoogleContacts();
      setContacts(items);
      setStatusMsg(`Loaded ${items.length} Google Contact(s).`);
    } catch (err: any) {
      setStatusMsg(err?.message || 'Contacts load failed.');
    } finally {
      setContactsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Google Workspace Ecosystem Hub"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--theme-border)' }}>
          <div>
            <h2 className="text-base font-extrabold">{t('workspaceHub.title')}</h2>
            <p className="text-xs opacity-65">
              {t('workspaceHub.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openExtraScopesPopup}
              className="min-h-[44px] px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 hover:border-[var(--theme-accent,#1074B1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent,#1074B1)]"
              style={{ borderColor: 'var(--theme-border)' }}
              title="Grant optional Gmail, Tasks, Contacts & Classroom OAuth scopes"
            >
              <KeyRound className="w-4 h-4 text-[var(--theme-accent,#1074B1)]" />
              <span>{t('workspaceHub.grantScopes')}</span>
            </button>
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent,#1074B1)]"
              aria-label="Close Google Workspace Hub"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 flex flex-wrap gap-2 border-b pb-3" style={{ borderColor: 'var(--theme-border)' }}>
          {(
            [
              { id: 'keep', label: `${t('workspaceHub.tabKeep')} (${notes.length})`, icon: <StickyNote className="w-4 h-4" /> },
              { id: 'gmail', label: t('workspaceHub.tabGmail'), icon: <Mail className="w-4 h-4" /> },
              { id: 'tasks', label: `${t('workspaceHub.tabTasks')} (${tasks.length})`, icon: <CheckSquare className="w-4 h-4" /> },
              { id: 'contacts', label: `${t('workspaceHub.tabContacts')} (${contacts.length})`, icon: <Users className="w-4 h-4" /> },
              { id: 'classroom', label: `${t('workspaceHub.tabClassroom')} (${courses.length})`, icon: <GraduationCap className="w-4 h-4" /> },
              { id: 'gcs', label: `${t('workspaceHub.tabGcs')} (${gcsBuckets.length})`, icon: <Database className="w-4 h-4" /> },
              { id: 'takeout', label: `Takeout & Castor (${castorRecords.length})`, icon: <Archive className="w-4 h-4" /> },
            ] as Array<{ id: EcosystemTab; label: string; icon: React.ReactNode }>
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent,#1074B1)] ${
                activeTab === tab.id
                  ? 'bg-[#1074B1] text-white border-[#1074B1]'
                  : 'hover:border-[#1074B1]/60'
              }`}
              style={activeTab === tab.id ? undefined : { borderColor: 'var(--theme-border)' }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {statusMsg && (
          <div className="mx-6 mt-3 px-3.5 py-2 rounded-xl bg-[#1074B1]/10 border border-[#1074B1]/30 text-[#1074B1] text-xs font-semibold flex flex-wrap items-center justify-between gap-2">
            <span>{statusMsg}</span>
            {/(401|403|scope|permission|insufficient)/i.test(statusMsg) && (
              <button
                type="button"
                onClick={openExtraScopesPopup}
                className="min-h-[44px] px-3 rounded-lg bg-[#1074B1] text-white text-xs font-bold flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Grant Missing Scope</span>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {activeTab === 'keep' && (
            <div className="space-y-4">
              <form onSubmit={handleAddNote} className="p-4 rounded-2xl border space-y-2.5" style={{ borderColor: 'var(--theme-border)' }}>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Note title (e.g. Shoot 04 Color Notes)..."
                    className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border bg-transparent font-bold"
                    style={{ borderColor: 'var(--theme-border)' }}
                  />
                  <select
                    value={noteColor}
                    onChange={(e) => setNoteColor(e.target.value as KeepNoteColor)}
                    className="px-3 py-2 rounded-xl border bg-transparent font-semibold"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <option value="citron">Yellow</option>
                    <option value="teal">Teal</option>
                    <option value="sky">Blue</option>
                    <option value="magenta">Pink</option>
                    <option value="indigo">Purple</option>
                  </select>
                </div>
                <textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Write shoot notes, LUT formulas, or client feedback..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  style={{ borderColor: 'var(--theme-border)' }}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className="min-h-[44px] px-3 py-1.5 rounded-xl border cursor-pointer font-semibold hover:border-[#1074B1] flex items-center" style={{ borderColor: 'var(--theme-border)' }}>
                      <span>Import Keep Takeout JSON</span>
                      <input
                        type="file"
                        accept=".json"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const list = Array.from(e.target.files || []);
                          const parsed: KeepNote[] = [];
                          for (const f of list) {
                            try {
                              parsed.push(parseKeepTakeoutNote(JSON.parse(await f.text()), f.name));
                            } catch {}
                          }
                          if (parsed.length > 0) {
                            setNotes((prev) => [...parsed, ...prev]);
                            setStatusMsg(`Imported ${parsed.length} Keep Takeout note(s).`);
                          }
                        }}
                      />
                    </label>
                    {cloudConnected && (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await syncKeepNotesToDrive(notes);
                              setStatusMsg('Synced Keep notes to DriveTherapy_KeepNotes.json in Google Drive.');
                            } catch (err: any) {
                              setStatusMsg(err?.message || 'Drive sync failed.');
                            }
                          }}
                          className="min-h-[44px] px-3 py-1.5 rounded-xl border font-semibold flex items-center gap-1.5 hover:border-[#52B197]"
                          style={{ borderColor: 'var(--theme-border)' }}
                        >
                          <CloudUpload className="w-3.5 h-3.5 text-[#52B197]" />
                          <span>Sync to Drive</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const md = notes.map((n) => `# ${n.title}\n${n.body}\n`).join('\n---\n');
                              const doc = await createGoogleWorkspaceFile({
                                title: `Drive Therapy Notes (${new Date().toLocaleDateString()})`,
                                content: md || 'Empty notes export',
                                kind: 'doc',
                              });
                              setStatusMsg(`Exported notes to Google Doc: ${doc.name}`);
                            } catch (err: any) {
                              setStatusMsg(err?.message || 'Google Doc export failed.');
                            }
                          }}
                          className="min-h-[44px] px-3 py-1.5 rounded-xl border font-semibold hover:border-[#1074B1]"
                          style={{ borderColor: 'var(--theme-border)' }}
                        >
                          Export as Google Doc
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1074B1] text-white font-bold flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Note</span>
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {notes.map((n) => (
                  <div key={n.id} className={`p-3.5 rounded-2xl border space-y-2 ${COLOR_STYLES[n.color]}`}>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-xs">{n.title}</h4>
                      <button
                        onClick={() => setNotes((prev) => prev.filter((item) => item.id !== n.id))}
                        className="min-h-[44px] min-w-[44px] rounded-lg hover:bg-rose-500/15 text-rose-500 flex items-center justify-center"
                        title="Delete note"
                        aria-label="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {n.body && <p className="text-[11px] opacity-85 whitespace-pre-wrap">{n.body}</p>}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[10px] opacity-55">{new Date(n.updatedAt).toLocaleString()}</span>
                      <button
                        type="button"
                        disabled={aiLoading}
                        onClick={async () => {
                          const data = await runWorkspaceAiAssist({
                            action: 'note_to_tasks',
                            text: `${n.title}\n${n.body}`,
                          });
                          const extracted: string[] = Array.isArray(data?.tasks) ? data.tasks : [];
                          if (extracted.length > 0) {
                            const createdCloud: GoogleTaskItem[] = [];
                            if (cloudConnected) {
                              for (const title of extracted) {
                                try {
                                  createdCloud.push(await createGoogleTask(title));
                                } catch {
                                  createdCloud.push({
                                    id: `ai_task_${Date.now()}_${createdCloud.length}`,
                                    title,
                                    status: 'needsAction',
                                    updated: new Date().toISOString(),
                                  });
                                }
                              }
                            } else {
                              extracted.forEach((title, idx) =>
                                createdCloud.push({
                                  id: `ai_task_${Date.now()}_${idx}`,
                                  title,
                                  status: 'needsAction',
                                  updated: new Date().toISOString(),
                                })
                              );
                            }
                            setTasks((prev) => [...createdCloud, ...prev]);
                            setStatusMsg(`AI extracted ${extracted.length} task(s) from "${n.title}" (${data?.mode || 'offline'}).`);
                          }
                        }}
                        className="min-h-[44px] px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 hover:border-[#1074B1]"
                        style={{ borderColor: 'var(--theme-border)' }}
                      >
                        <Sparkles className="w-3 h-3 text-[#1074B1]" />
                        <span>AI Tasks</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'gmail' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold">Harvest Media &amp; Document Attachments from Gmail</span>
                <button
                  onClick={handleLoadGmail}
                  disabled={!cloudConnected || gmailLoading}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1074B1] text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${gmailLoading ? 'animate-spin' : ''}`} />
                  <span>Fetch Gmail Attachments</span>
                </button>
              </div>

              {gmailAttachments.length === 0 && !gmailLoading && (
                <div className="p-4 rounded-xl border border-dashed text-xs opacity-75" style={{ borderColor: 'var(--theme-border)' }}>
                  Click <strong>Fetch Gmail Attachments</strong> to harvest photos, videos, PDFs, and documents from your mailbox into Drive Therapy.
                </div>
              )}

              {gmailAttachments.length > 0 && (
                <div className="space-y-2">
                  {gmailAttachments.map((att) => (
                    <div
                      key={`${att.messageId}_${att.attachmentId}`}
                      className="p-3 rounded-xl border flex items-center justify-between gap-3"
                      style={{ borderColor: 'var(--theme-border)' }}
                    >
                      <div className="min-w-0">
                        <div className="font-bold truncate">{att.filename}</div>
                        <div className="text-[11px] opacity-65 truncate">
                          {att.subject} • {att.from}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {onOpenLightbox && (
                          <button
                            onClick={() => onOpenLightbox(mapGmailAttachmentToAsset(att))}
                            className="min-h-[44px] px-3 py-1.5 rounded-lg border font-semibold hover:border-[#1074B1]"
                            style={{ borderColor: 'var(--theme-border)' }}
                          >
                            Preview
                          </button>
                        )}
                        <button
                          onClick={() => {
                            onImportAssetsToCatalog([mapGmailAttachmentToAsset(att)]);
                            setStatusMsg(`Imported "${att.filename}" into Drive Therapy catalog.`);
                          }}
                          className="min-h-[44px] px-3 py-1.5 rounded-lg bg-[#52B197] text-white font-bold flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Import</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await sendGmailMessage(sendTo, sendSubject, sendBody);
                    setStatusMsg(`Sent email to ${sendTo}.`);
                    setSendTo('');
                    setSendSubject('');
                    setSendBody('');
                  } catch (err: any) {
                    setStatusMsg(err?.message || 'Send failed.');
                  }
                }}
                className="p-4 rounded-2xl border space-y-2.5"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <div className="font-bold">Send Quick Email via Gmail</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="email"
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                    placeholder="Recipient email..."
                    className="px-3 py-2 rounded-xl border bg-transparent"
                    style={{ borderColor: 'var(--theme-border)' }}
                  />
                  <input
                    value={sendSubject}
                    onChange={(e) => setSendSubject(e.target.value)}
                    placeholder="Subject..."
                    className="px-3 py-2 rounded-xl border bg-transparent"
                    style={{ borderColor: 'var(--theme-border)' }}
                  />
                </div>
                <textarea
                  value={sendBody}
                  onChange={(e) => setSendBody(e.target.value)}
                  placeholder="Message or Drive share links..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border bg-transparent"
                  style={{ borderColor: 'var(--theme-border)' }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={async () => {
                      const data = await runWorkspaceAiAssist({
                        action: 'draft_gmail',
                        subject: sendSubject,
                        text: sendBody,
                      });
                      if (data?.draft) {
                        setSendBody(data.draft);
                        setStatusMsg(`AI drafted email body (${data?.mode || 'offline'}).`);
                      }
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl border font-bold flex items-center gap-1.5 hover:border-[#1074B1]"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#1074B1]" />
                    <span>AI Draft</span>
                  </button>
                  <button
                    type="submit"
                    disabled={!cloudConnected || !sendTo || !sendSubject}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1074B1] text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send via Gmail</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold">Google Tasks (Synced with Calendar &amp; Mobile)</span>
                <button
                  onClick={handleLoadTasks}
                  disabled={!cloudConnected || tasksLoading}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1074B1] text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${tasksLoading ? 'animate-spin' : ''}`} />
                  <span>Sync Tasks</span>
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newTaskTitle.trim()) return;
                  try {
                    const created = await createGoogleTask(newTaskTitle.trim());
                    setTasks((prev) => [created, ...prev]);
                    setNewTaskTitle('');
                  } catch (err: any) {
                    setStatusMsg(err?.message || 'Create task failed.');
                  }
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="New editing or delivery task..."
                  className="flex-1 px-3 py-2 rounded-xl border bg-transparent"
                  style={{ borderColor: 'var(--theme-border)' }}
                />
                <button
                  type="submit"
                  disabled={!cloudConnected || !newTaskTitle.trim()}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#52B197] text-white font-bold disabled:opacity-50"
                >
                  Add Task
                </button>
              </form>

              <div className="space-y-2">
                {tasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={async () => {
                      const next = t.status === 'completed' ? 'needsAction' : 'completed';
                      try {
                        const updated = await toggleGoogleTaskStatus(t.id, next);
                        setTasks((prev) => prev.map((item) => (item.id === t.id ? updated : item)));
                      } catch {}
                    }}
                    className="min-h-[44px] w-full p-3 rounded-xl border flex items-center gap-3 text-left hover:border-[#1074B1]"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <span
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                        t.status === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white' : ''
                      }`}
                    >
                      {t.status === 'completed' && <Check className="w-3.5 h-3.5" />}
                    </span>
                    <span className={`font-semibold ${t.status === 'completed' ? 'line-through opacity-55' : ''}`}>
                      {t.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold">Google Contacts (People API)</span>
                <button
                  onClick={handleLoadContacts}
                  disabled={!cloudConnected || contactsLoading}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1074B1] text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${contactsLoading ? 'animate-spin' : ''}`} />
                  <span>Sync Contacts</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {contacts.map((c) => (
                  <div
                    key={c.resourceName}
                    className="p-3 rounded-xl border flex items-center gap-3"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt={c.name} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#1074B1]/15 text-[#1074B1] font-bold flex items-center justify-center">
                        {c.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold truncate">{c.name}</div>
                      <div className="text-[11px] opacity-65 truncate">{c.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'classroom' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">Google Classroom Course Materials</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      setClassroomLoading(true);
                      try {
                        const list = await fetchClassroomCourses();
                        setCourses(list);
                        setStatusMsg(`Loaded ${list.length} Google Classroom course(s).`);
                      } catch (err: any) {
                        setStatusMsg(err?.message || 'Classroom API requires granting extra Classroom scopes.');
                      } finally {
                        setClassroomLoading(false);
                      }
                    }}
                    disabled={!cloudConnected || classroomLoading}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1074B1] text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${classroomLoading ? 'animate-spin' : ''}`} />
                    <span>Load Courses</span>
                  </button>
                  {classroomAssets.length > 0 && (
                    <>
                      <button
                        type="button"
                        disabled={aiLoading}
                        onClick={async () => {
                          const courseTitle = courses.find((c) => c.id === selectedCourseId)?.name || 'Classroom Course';
                          const data = await runWorkspaceAiAssist({
                            action: 'classroom_brief',
                            courseName: courseTitle,
                            text: classroomAssets.map((a) => a.name).join(', '),
                          });
                          if (data?.brief) setClassroomBrief(data.brief);
                        }}
                        className="min-h-[44px] px-4 py-2 rounded-xl border font-bold flex items-center gap-1.5 hover:border-[#1074B1]"
                        style={{ borderColor: 'var(--theme-border)' }}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#1074B1]" />
                        <span>AI Course Brief</span>
                      </button>
                      <button
                        onClick={() => {
                          onImportAssetsToCatalog(classroomAssets);
                          setStatusMsg(`Imported ${classroomAssets.length} Classroom item(s) to catalog.`);
                        }}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Import All ({classroomAssets.length})</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
              {classroomBrief && (
                <pre className="p-3 rounded-xl border text-[11px] whitespace-pre-wrap bg-black/5 dark:bg-white/5" style={{ borderColor: 'var(--theme-border)' }}>
                  {classroomBrief}
                </pre>
              )}
              {courses.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {courses.map((course) => (
                    <button
                      key={course.id}
                      onClick={async () => {
                        setSelectedCourseId(course.id);
                        setClassroomLoading(true);
                        try {
                          const assets = await fetchClassroomCourseAssets(course);
                          setClassroomAssets(assets);
                          setStatusMsg(`Loaded ${assets.length} material(s) from ${course.name}.`);
                        } catch (err: any) {
                          setStatusMsg(err?.message || 'Failed to load course materials.');
                        } finally {
                          setClassroomLoading(false);
                        }
                      }}
                      className={`min-h-[44px] px-3 py-1.5 rounded-xl border text-xs font-bold ${
                        selectedCourseId === course.id ? 'bg-[#1074B1] text-white border-[#1074B1]' : 'hover:border-[#1074B1]'
                      }`}
                      style={selectedCourseId === course.id ? undefined : { borderColor: 'var(--theme-border)' }}
                    >
                      {course.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {classroomAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-3 rounded-xl border flex items-center justify-between gap-2"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <div className="min-w-0">
                      <div className="font-bold truncate">{asset.name}</div>
                      <div className="text-[11px] opacity-65 truncate">{asset.path}</div>
                    </div>
                    {onOpenLightbox && (
                      <button
                        onClick={() => onOpenLightbox(asset)}
                        className="min-h-[44px] px-3 py-1.5 rounded-lg bg-[#1074B1]/15 text-[#1074B1] text-xs font-bold shrink-0"
                      >
                        Open
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'gcs' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">Google Cloud Storage (GCS Buckets)</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      setGcsLoading(true);
                      try {
                        const list = await fetchGcsBuckets();
                        setGcsBuckets(list);
                        setStatusMsg(`Loaded ${list.length} GCS bucket(s).`);
                      } catch (err: any) {
                        setStatusMsg(err?.message || 'Unable to list GCS buckets.');
                      } finally {
                        setGcsLoading(false);
                      }
                    }}
                    disabled={!cloudConnected || gcsLoading}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1074B1] text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${gcsLoading ? 'animate-spin' : ''}`} />
                    <span>Load Buckets</span>
                  </button>
                  {gcsAssets.length > 0 && (
                    <button
                      onClick={() => {
                        onImportAssetsToCatalog(gcsAssets);
                        setStatusMsg(`Imported ${gcsAssets.length} GCS object(s) to catalog.`);
                      }}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Import All ({gcsAssets.length})</span>
                    </button>
                  )}
                </div>
              </div>
              {gcsBuckets.length === 0 && !gcsLoading && (
                <div className="p-4 rounded-xl border border-dashed text-xs opacity-75" style={{ borderColor: 'var(--theme-border)' }}>
                  Click <strong>Load Buckets</strong> to browse your Google Cloud Storage buckets and stream objects via the authenticated proxy.
                </div>
              )}
              {gcsBuckets.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {gcsBuckets.map((bucket) => (
                    <button
                      key={bucket.name}
                      onClick={async () => {
                        setSelectedBucket(bucket.name);
                        setGcsLoading(true);
                        try {
                          const assets = await fetchGcsObjects(bucket.name);
                          setGcsAssets(assets);
                          setStatusMsg(`Loaded ${assets.length} object(s) from gs://${bucket.name}.`);
                        } catch (err: any) {
                          setStatusMsg(err?.message || 'Failed to list GCS objects.');
                        } finally {
                          setGcsLoading(false);
                        }
                      }}
                      className={`min-h-[44px] px-3 py-1.5 rounded-xl border text-xs font-bold ${
                        selectedBucket === bucket.name ? 'bg-[#1074B1] text-white border-[#1074B1]' : 'hover:border-[#1074B1]'
                      }`}
                      style={selectedBucket === bucket.name ? undefined : { borderColor: 'var(--theme-border)' }}
                    >
                      gs://{bucket.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {gcsAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-3 rounded-xl border flex items-center justify-between gap-2"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <div className="min-w-0">
                      <div className="font-bold truncate">{asset.name}</div>
                      <div className="text-[11px] opacity-65 truncate">{asset.path}</div>
                    </div>
                    {onOpenLightbox && (
                      <button
                        onClick={() => onOpenLightbox(asset)}
                        className="min-h-[44px] px-3 py-1.5 rounded-lg bg-[#1074B1]/15 text-[#1074B1] text-xs font-bold shrink-0"
                      >
                        Open
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'takeout' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold">Google Takeout &amp; Castor/Pollux Archive Engine</span>
                  <p className="text-[11px] opacity-65">
                    Ingest Gemini Takeout, AI Studio, Antigravity transcript.jsonl, &amp; Castor JSONL with Aegis secret redaction.
                  </p>
                </div>
                <a
                  href="https://takeout.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 hover:border-[#1074B1]"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#1074B1]" />
                  <span>Open takeout.google.com</span>
                </a>
              </div>

              {/* Action Bar: File Import + Pollux Exports */}
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1074B1] text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Archive className="w-4 h-4" />
                  <span>Import Gemini / AI Studio / Antigravity / Castor</span>
                  <input
                    type="file"
                    accept=".json,.jsonl"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const list = Array.from(e.target.files || []);
                      let added: CastorArchiveRecord[] = [];
                      for (const f of list) {
                        const text = await f.text();
                        added = [...added, ...parseCastorOrTakeoutRecords(text, f.name)];
                      }
                      if (added.length > 0) {
                        const next = [...added, ...castorRecords];
                        setCastorRecords(next);
                        saveCastorArchives(next);
                        setStatusMsg(`Ingested ${added.length} archive record(s) with Aegis secret redaction.`);
                      } else {
                        setStatusMsg('No matching Castor/Takeout/AI Studio/Antigravity records found.');
                      }
                      e.target.value = '';
                    }}
                  />
                </label>

                {castorRecords.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const jsonl = exportToPolluxJsonl(castorRecords);
                        const blob = new Blob([jsonl], { type: 'application/x-ndjson' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `pollux_archive_${Date.now()}.jsonl`;
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 30000);
                      }}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl border font-bold flex items-center gap-1.5 hover:border-[#52B197]"
                      style={{ borderColor: 'var(--theme-border)' }}
                    >
                      <Download className="w-3.5 h-3.5 text-[#52B197]" />
                      <span>Download Pollux JSONL</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const html = exportToPolluxHtml(castorRecords, 'Drive Therapy × Pollux Offline Archive');
                          const res = await fetch('/api/takeout/save-archive', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              filename: `pollux_archive_${Date.now()}.html`,
                              content: html,
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || 'Save failed');
                          setStatusMsg(`Saved Pollux HTML archive to localhost: ${data.path}`);
                        } catch (err: any) {
                          setStatusMsg(err?.message || 'Failed to save Pollux archive to localhost.');
                        }
                      }}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1.5"
                    >
                      <CloudUpload className="w-3.5 h-3.5" />
                      <span>Save Pollux HTML to Localhost</span>
                    </button>
                  </>
                )}
              </div>

              {/* Host Disk Takeout Folder Scanner */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!takeoutFolderPath.trim()) return;
                  setTakeoutLoading(true);
                  try {
                    const res = await fetch('/api/takeout/scan-folder', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ folderPath: takeoutFolderPath.trim() }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Takeout disk scan failed');
                    if (Array.isArray(data.items) && data.items.length > 0) {
                      onImportAssetsToCatalog(data.items);
                    }
                    setStatusMsg(`Scanned ${data.totalScanned || 0} Takeout disk file(s) (${data.sidecarsMatched || 0} JSON sidecars matched).`);
                  } catch (err: any) {
                    setStatusMsg(err?.message || 'Takeout disk scan failed.');
                  } finally {
                    setTakeoutLoading(false);
                  }
                }}
                className="p-3.5 rounded-2xl border flex flex-wrap items-center gap-2"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <input
                  value={takeoutFolderPath}
                  onChange={(e) => setTakeoutFolderPath(e.target.value)}
                  placeholder="/home/face/Downloads/Takeout/Google Photos"
                  className="flex-1 min-w-[220px] min-h-[44px] px-3 py-2 rounded-xl border bg-transparent"
                  style={{ borderColor: 'var(--theme-border)' }}
                />
                <button
                  type="submit"
                  disabled={takeoutLoading || !takeoutFolderPath.trim()}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#52B197] text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${takeoutLoading ? 'animate-spin' : ''}`} />
                  <span>Scan Local Takeout Folder</span>
                </button>
              </form>

              {/* Archive Records List */}
              <div className="space-y-2">
                {castorRecords.slice(0, 25).map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 rounded-xl border space-y-1.5"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold truncate">{rec.title}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {rec.redactedCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 text-[10px] font-bold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Aegis: {rec.redactedCount} redacted</span>
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-[#1074B1]/15 text-[#1074B1] text-[10px] font-bold">
                          {rec.source}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] opacity-75 line-clamp-2">{rec.response || rec.prompt}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
