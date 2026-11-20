/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Workspace Multi-Channel Messenger Modal
 * Dispatches client messages powered by Drive Therapy via:
 * - 💬 Google Chat (Cards V2 with preview, Webhook POST, Space launcher)
 * - 📞 Google Voice (Client SMS with live 160-char segment counter & template switcher)
 * - 📧 Gmail (Web composer & mailto launcher)
 * - 👥 Contact Directory (Client address book & quick dispatch)
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  MessageSquare,
  PhoneCall,
  Mail,
  Users,
  Send,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Camera,
  Layers,
  Share2,
  Trash2,
  Plus,
  Settings,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { MediaAsset } from '../types';
import {
  loadChatDecorationPrefs,
  saveChatDecorationPrefs,
  resolveChatDecorationStyles,
  type ChatDecorationPrefs,
} from '../services/chatDecorationEngine';
import { ChatThemeCustomizerPopover } from './ChatThemeCustomizerPopover';
import {
  googleWorkspaceMessenger,
  MessagePayload,
  ClientContact,
} from '../services/googleWorkspaceMessenger';
import { notificationEngine } from '../services/notificationEngine';
import { useTranslation } from '../i18n';

export type MessengerChannel = 'chat' | 'voice' | 'gmail' | 'contact';

interface GoogleWorkspaceMessengerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialChannel?: MessengerChannel;
  asset?: MediaAsset | null;
  projectName?: string;
  heroCount?: number;
  totalAssetsCount?: number;
  driveUrl?: string;
}

export const GoogleWorkspaceMessengerModal: React.FC<GoogleWorkspaceMessengerModalProps> = ({
  isOpen,
  onClose,
  initialChannel = 'chat',
  asset,
  projectName = 'Studio Production',
  heroCount = 0,
  totalAssetsCount = 0,
  driveUrl = 'https://drive.google.com',
}) => {
  const { t } = useTranslation();

  const [activeChannel, setActiveChannel] = useState<MessengerChannel>(initialChannel);
  const [clientName, setClientName] = useState('Valued Client');
  const [targetPhone, setTargetPhone] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [webhookUrl, setWebhookUrl] = useState(() => googleWorkspaceMessenger.getSavedWebhookUrl());
  const [smsTemplateType, setSmsTemplateType] = useState<'gallery_ready' | 'culling_deadline' | 'invoice_brief' | 'custom'>('gallery_ready');
  const [smsText, setSmsText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ClientContact[]>(() => googleWorkspaceMessenger.getSavedContacts());
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChatThemeOpen, setIsChatThemeOpen] = useState(false);
  const [chatDecorationPrefs, setChatDecorationPrefs] = useState<ChatDecorationPrefs>(() =>
    loadChatDecorationPrefs()
  );
  const resolvedChatTheme = resolveChatDecorationStyles(chatDecorationPrefs);
  const handleUpdateChatDecoration = (next: ChatDecorationPrefs) => {
    setChatDecorationPrefs(next);
    saveChatDecorationPrefs(next);
  };

  useEffect(() => {
    if (isOpen) {
      setActiveChannel(initialChannel);
      setContacts(googleWorkspaceMessenger.getSavedContacts());
      setWebhookUrl(googleWorkspaceMessenger.getSavedWebhookUrl());
    }
  }, [isOpen, initialChannel]);

  // Sync SMS text with template & client inputs
  useEffect(() => {
    const text = googleWorkspaceMessenger.formatGoogleVoiceSms(smsTemplateType, {
      projectName,
      clientName,
      heroCount,
      driveUrl: asset ? (asset.cloudUrl || driveUrl) : driveUrl,
      customNotes,
    });
    setSmsText(text);
  }, [smsTemplateType, projectName, clientName, heroCount, driveUrl, asset, customNotes]);

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

  const currentPayload: MessagePayload = {
    projectName,
    clientName,
    heroCount,
    totalAssetsCount,
    driveUrl: asset ? (asset.cloudUrl || driveUrl) : driveUrl,
    thumbnailUrl: asset?.thumbnailUrl,
    assetName: asset?.name,
    customNotes,
    targetPhone,
    targetEmail,
  };

  const smsMetrics = googleWorkspaceMessenger.calculateSmsSegments(smsText);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyChatCard = () => {
    const text = googleWorkspaceMessenger.formatGoogleChatMarkdown(currentPayload);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Google Chat message copied! Opening chat.google.com...');
    setTimeout(() => {
      window.open('https://chat.google.com/', '_blank');
    }, 700);
  };

  const handleSendChatWebhook = async () => {
    if (!webhookUrl.trim()) {
      showToast('Please enter a Google Chat Space Webhook URL.');
      return;
    }

    setIsSending(true);
    try {
      googleWorkspaceMessenger.saveWebhookUrl(webhookUrl);
      const card = googleWorkspaceMessenger.buildGoogleChatCard(currentPayload);
      await googleWorkspaceMessenger.sendGoogleChatWebhook(webhookUrl, card);

      notificationEngine.add({
        title: 'Google Chat Card Dispatched',
        description: `Delivered gallery review card for ${projectName} to Space`,
        flag: 'complete',
        category: 'sync',
      });

      showToast('Successfully posted to Google Chat Space!');
    } catch (err: any) {
      notificationEngine.add({
        title: 'Google Chat Dispatch Failed',
        description: err.message || 'Failed to post card to Google Chat',
        flag: 'failure',
        category: 'sync',
      });
      showToast(`Error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendGoogleVoice = () => {
    if (!targetPhone.trim()) {
      showToast('Please enter a valid recipient phone number.');
      return;
    }

    const voiceUrl = googleWorkspaceMessenger.buildGoogleVoiceWebUrl(targetPhone, smsText);
    navigator.clipboard.writeText(smsText);
    window.open(voiceUrl, '_blank');

    notificationEngine.add({
      title: 'Google Voice SMS Prepared',
      description: `Opened Google Voice for ${targetPhone} (${smsMetrics.segments} segment SMS)`,
      flag: 'complete',
      category: 'sync',
    });

    showToast('Opening Google Voice with pre-filled message...');
  };

  const handleOpenSmsNative = () => {
    if (!targetPhone.trim()) {
      showToast('Please enter a valid recipient phone number.');
      return;
    }
    const uri = googleWorkspaceMessenger.buildSmsUri(targetPhone, smsText);
    window.location.href = uri;
  };

  const handleOpenGmail = () => {
    const subject = `Drive Therapy Gallery Delivery — ${projectName}`;
    const body = `Hi ${clientName},\n\nYour deliverables for ${projectName} are ready for review.\n\nApproved Hero Selections: ${heroCount}\nGoogle Drive Gallery Link: ${currentPayload.driveUrl}\n\n${customNotes ? `Notes: ${customNotes}\n\n` : ''}Best regards,\nDrive Therapy Studio`;

    const gmailUrl = googleWorkspaceMessenger.buildGmailComposeUrl({
      to: targetEmail,
      subject,
      body,
    });
    window.open(gmailUrl, '_blank');

    notificationEngine.add({
      title: 'Gmail Draft Created',
      description: `Opened Gmail compose window for ${targetEmail || 'Client'}`,
      flag: 'complete',
      category: 'sync',
    });
  };

  const handleSaveNewContact = () => {
    if (!newContactName.trim()) return;
    const created = googleWorkspaceMessenger.saveContact({
      name: newContactName,
      phone: newContactPhone,
      email: newContactEmail,
      lastShootProject: projectName,
    });
    setContacts(googleWorkspaceMessenger.getSavedContacts());
    setNewContactName('');
    setNewContactPhone('');
    setNewContactEmail('');
    showToast(`Saved ${created.name} to Contact Directory`);
  };

  const handleSelectContact = (c: ClientContact) => {
    setClientName(c.name);
    if (c.phone) setTargetPhone(c.phone);
    if (c.email) setTargetEmail(c.email);
    showToast(`Selected contact: ${c.name}`);
  };

  const handleDeleteContact = (id: string) => {
    googleWorkspaceMessenger.deleteContact(id);
    setContacts(googleWorkspaceMessenger.getSavedContacts());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Google Workspace Messenger"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
    >
      <div
        className={
          isFullscreen
            ? 'relative w-screen h-screen rounded-none border-0 shadow-2xl overflow-hidden flex flex-col animate-in fade-in duration-150'
            : 'relative w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150'
        }
        style={{
          backgroundColor: resolvedChatTheme.shellBg,
          borderColor: resolvedChatTheme.shellBorder,
          color: resolvedChatTheme.shellText,
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: resolvedChatTheme.shellBorder }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#1074B1] to-[#52B197] text-white flex items-center justify-center shadow-xs">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Google Workspace Messenger</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#1074B1]/10 text-[#1074B1] border border-[#1074B1]/20">
                  Powered by Drive Therapy
                </span>
              </div>
              <p className="text-xs opacity-70">
                Dispatch client deliverables via Google Chat, Google Voice SMS, and Gmail
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsChatThemeOpen((v) => !v)}
              className={`p-1.5 rounded-xl border transition-colors ${
                isChatThemeOpen
                  ? 'bg-[#1557B0] text-white border-[#1557B0]'
                  : 'border-transparent hover:bg-black/5 dark:hover:bg-white/10 opacity-80 hover:opacity-100'
              }`}
              title="Chat Settings: Decoration Themes, 14 Swatches & Density"
              aria-label="Open Chat Decoration Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen((v) => !v)}
              className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 opacity-80 hover:opacity-100 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
              aria-label="Close Messenger"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <ChatThemeCustomizerPopover
          isOpen={isChatThemeOpen}
          prefs={chatDecorationPrefs}
          onChange={handleUpdateChatDecoration}
          onClose={() => setIsChatThemeOpen(false)}
        />

        {/* Channel Navigation Tabs */}
        <div
          className="px-5 pt-2 flex items-center gap-1 border-b overflow-x-auto scrollbar-none shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <button
            onClick={() => setActiveChannel('chat')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeChannel === 'chat'
                ? 'border-[#1074B1] text-[#1074B1] bg-[#1074B1]/5'
                : 'border-transparent opacity-70 hover:opacity-100'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-sky-500" />
            <span>Google Chat</span>
          </button>

          <button
            onClick={() => setActiveChannel('voice')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeChannel === 'voice'
                ? 'border-[#52B197] text-[#52B197] bg-[#52B197]/5'
                : 'border-transparent opacity-70 hover:opacity-100'
            }`}
          >
            <PhoneCall className="w-4 h-4 text-emerald-500" />
            <span>Google Voice (SMS)</span>
          </button>

          <button
            onClick={() => setActiveChannel('gmail')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeChannel === 'gmail'
                ? 'border-red-500 text-red-500 bg-red-500/5'
                : 'border-transparent opacity-70 hover:opacity-100'
            }`}
          >
            <Mail className="w-4 h-4 text-red-500" />
            <span>Gmail</span>
          </button>

          <button
            onClick={() => setActiveChannel('contact')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeChannel === 'contact'
                ? 'border-purple-500 text-purple-500 bg-purple-500/5'
                : 'border-transparent opacity-70 hover:opacity-100'
            }`}
          >
            <Users className="w-4 h-4 text-purple-500" />
            <span>Contacts ({contacts.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TAB 1: GOOGLE CHAT */}
          {activeChannel === 'chat' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Client / Recipient Name</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border focus:border-[#1074B1] focus:outline-none transition-all"
                    style={{
                      backgroundColor: 'var(--theme-surface)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Google Chat Webhook URL (Optional)</label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://chat.googleapis.com/v1/spaces/..."
                    className="w-full px-3 py-2 text-xs rounded-xl border focus:border-[#1074B1] focus:outline-none transition-all"
                    style={{
                      backgroundColor: 'var(--theme-surface)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text)',
                    }}
                  />
                </div>
              </div>

              {/* Live Google Chat Card V2 Visual Preview */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider opacity-70 mb-2">
                  Live Google Chat Card V2 Preview
                </label>
                <div className="p-4 rounded-2xl border bg-white dark:bg-slate-900 shadow-md text-slate-800 dark:text-slate-100 space-y-3">
                  <div className="flex items-center gap-3 border-b pb-3 border-slate-100 dark:border-slate-800">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1074B1] to-[#52B197] flex items-center justify-center text-white shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold truncate">Drive Therapy — {projectName}</h4>
                      <p className="text-[10px] opacity-70">Digital Asset Delivery & Client Review</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="opacity-70">Client:</span>
                      <span className="font-bold">{clientName}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="opacity-70">Curated Milestones:</span>
                      <span className="font-bold text-[#1074B1]">{heroCount} Approved Heroes</span>
                    </div>
                    {asset && (
                      <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                        <span className="opacity-70">Featured File:</span>
                        <span className="font-mono text-[11px] truncate max-w-[200px]">{asset.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <div className="w-full py-2 px-3 rounded-xl bg-[#1074B1]/10 text-[#1074B1] font-bold text-xs text-center border border-[#1074B1]/20">
                      Open Google Drive Gallery
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Director Message / Notes</label>
                <textarea
                  rows={2}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="e.g. Please approve the first 10 hero picks before 5 PM today."
                  className="w-full px-3 py-2 text-xs rounded-xl border focus:border-[#1074B1] focus:outline-none transition-all resize-none"
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 2: GOOGLE VOICE (SMS) */}
          {activeChannel === 'voice' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Recipient Phone Number</label>
                  <input
                    type="tel"
                    value={targetPhone}
                    onChange={(e) => setTargetPhone(e.target.value)}
                    placeholder="(555) 123-4567 or +15551234567"
                    className="w-full px-3 py-2 text-xs rounded-xl border focus:border-[#52B197] focus:outline-none transition-all font-mono"
                    style={{
                      backgroundColor: 'var(--theme-surface)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Client Name</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border focus:border-[#52B197] focus:outline-none transition-all"
                    style={{
                      backgroundColor: 'var(--theme-surface)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text)',
                    }}
                  />
                </div>
              </div>

              {/* Template Pill Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider opacity-70 mb-2">
                  Select SMS Template
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'gallery_ready', label: 'Gallery Delivery' },
                    { id: 'culling_deadline', label: 'Culling Deadline' },
                    { id: 'invoice_brief', label: 'Invoice & Brief' },
                    { id: 'custom', label: 'Custom' },
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => setSmsTemplateType(tpl.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        smsTemplateType === tpl.id
                          ? 'bg-[#52B197] text-white border-[#52B197] shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-black/5 dark:hover:bg-white/10'
                      }`}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editable SMS Body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold">SMS Message Body</label>
                  <span
                    className={`text-[11px] font-mono font-bold ${
                      smsMetrics.segments > 1 ? 'text-amber-500' : 'opacity-70'
                    }`}
                  >
                    {smsMetrics.chars} / 160 chars · {smsMetrics.segments} SMS segment
                    {smsMetrics.segments > 1 ? 's' : ''}
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={smsText}
                  onChange={(e) => {
                    setSmsText(e.target.value);
                    setSmsTemplateType('custom');
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border focus:border-[#52B197] focus:outline-none transition-all resize-none font-mono"
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 3: GMAIL */}
          {activeChannel === 'gmail' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Client Email Address</label>
                  <input
                    type="email"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    placeholder="client@brandstudio.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border focus:border-red-500 focus:outline-none transition-all"
                    style={{
                      backgroundColor: 'var(--theme-surface)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Client Name</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border focus:border-red-500 focus:outline-none transition-all"
                    style={{
                      backgroundColor: 'var(--theme-surface)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text)',
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Email Subject</label>
                <input
                  type="text"
                  readOnly
                  value={`Drive Therapy Gallery Delivery — ${projectName}`}
                  className="w-full px-3 py-2 text-xs rounded-xl border opacity-80"
                  style={{
                    backgroundColor: 'var(--theme-surface-sunken, rgba(0,0,0,0.03))',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Additional Project Notes (Optional)</label>
                <textarea
                  rows={3}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Include any specific feedback or instructions for the client..."
                  className="w-full px-3 py-2 text-xs rounded-xl border focus:border-red-500 focus:outline-none transition-all resize-none"
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 4: CONTACTS DIRECTORY */}
          {activeChannel === 'contact' && (
            <div className="space-y-4">
              {/* Add New Contact Row */}
              <div
                className="p-3 rounded-2xl border space-y-2.5"
                style={{
                  backgroundColor: 'var(--theme-surface-sunken, rgba(0,0,0,0.02))',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <div className="text-xs font-bold">Add New Client to Address Book</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none"
                    style={{
                      backgroundColor: 'var(--theme-surface)',
                      borderColor: 'var(--theme-border)',
                    }}
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none"
                    style={{
                      backgroundColor: 'var(--theme-surface)',
                      borderColor: 'var(--theme-border)',
                    }}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none"
                    style={{
                      backgroundColor: 'var(--theme-surface)',
                      borderColor: 'var(--theme-border)',
                    }}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveNewContact}
                    disabled={!newContactName.trim()}
                    className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save Contact</span>
                  </button>
                </div>
              </div>

              {/* Saved Contacts List */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider opacity-70">
                  Saved Client Contacts ({contacts.length})
                </label>

                {contacts.length === 0 ? (
                  <p className="text-xs opacity-60 text-center py-6">No saved client contacts yet.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-1.5">
                    {contacts.map((c) => (
                      <div
                        key={c.id}
                        className="p-2.5 rounded-xl border flex items-center justify-between gap-3 hover:border-purple-400 transition-colors"
                        style={{ borderColor: 'var(--theme-border)' }}
                      >
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold truncate">{c.name}</h5>
                          <p className="text-[10px] opacity-70 truncate">
                            {c.phone && `📞 ${c.phone}`} {c.email && `• ✉️ ${c.email}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleSelectContact(c)}
                            className="px-2.5 py-1 rounded-lg bg-purple-600/10 text-purple-600 hover:bg-purple-600/20 text-xs font-bold transition-colors"
                          >
                            Select
                          </button>
                          <button
                            onClick={() => handleDeleteContact(c.id)}
                            className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                            title="Delete Contact"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div
          className="px-5 py-3 border-t flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-2">
            {toastMessage && (
              <span className="text-xs text-[#1074B1] font-semibold flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>{toastMessage}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>

            {activeChannel === 'chat' && (
              <>
                <button
                  onClick={handleCopyChatCard}
                  className="px-4 py-2 rounded-xl border text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy & Open Chat</span>
                </button>
                {webhookUrl && (
                  <button
                    onClick={handleSendChatWebhook}
                    disabled={isSending}
                    className="px-5 py-2 rounded-xl bg-[#1074B1] hover:bg-[#1074B1]/90 disabled:opacity-40 text-white text-xs font-bold shadow-xs transition-transform active:scale-95 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send to Space</span>
                  </button>
                )}
              </>
            )}

            {activeChannel === 'voice' && (
              <>
                <button
                  onClick={handleOpenSmsNative}
                  className="px-4 py-2 rounded-xl border text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Native SMS</span>
                </button>
                <button
                  onClick={handleSendGoogleVoice}
                  className="px-5 py-2 rounded-xl bg-[#52B197] hover:bg-[#52B197]/90 text-white text-xs font-bold shadow-xs transition-transform active:scale-95 flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Send via Google Voice</span>
                </button>
              </>
            )}

            {activeChannel === 'gmail' && (
              <button
                onClick={handleOpenGmail}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-transform active:scale-95 flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Compose in Gmail</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
