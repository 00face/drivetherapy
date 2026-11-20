/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * G. Comms — Google Communications Hub Flyout
 * Harmonized multi-channel Google Workspace communications drawer:
 * - 🤖 Tab 1: Gemini Copilot (Multimodal AI, Photo Critique, NotebookLM Dossiers)
 * - 💬 Tab 2: Google Chat (REST API v1 chat.googleapis.com, threads, unread toggle, Image 3 parity)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  Send,
  Paperclip,
  Video,
  MessageSquare,
  BookOpen,
  Copy,
  Check,
  RotateCcw,
  Bot,
  User as UserIcon,
  FileText,
  Camera,
  Film,
  Headphones,
  FileSpreadsheet,
  Archive,
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
  Search,
  RefreshCw,
  Plus,
  Circle,
  Hash,
  Filter,
  Clock,
  Smile,
  Quote,
  Languages,
  Share2,
  Download,
  Mail,
  Forward,
  MoreHorizontal,
  FileUp,
  Play,
  Trash2,
  HardDrive,
  Youtube,
  Database,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Wand2,
  FolderPlus,
  Maximize2,
  Minimize2,
  Palette,
  Settings,
} from 'lucide-react';
import { FolderNode, MediaAsset, ViewMode } from '../types';
import {
  loadChatDecorationPrefs,
  saveChatDecorationPrefs,
  resolveChatDecorationStyles,
  type ChatDecorationPrefs,
} from '../services/chatDecorationEngine';
import { ChatThemeCustomizerPopover } from './ChatThemeCustomizerPopover';
import { ChatBubbleOrnaments } from './ChatBubbleOrnaments';
import { geminiUniversalEngine } from '../services/geminiUniversalEngine';
import {
  buildGeminiWorkspaceSnapshot,
  retrieveIndexedMatchesForPrompt,
  formatBytesCompact,
  type DriveQuotaSnapshot,
  type WorkspaceActionRequest,
  type WorkspaceSuggestedAction,
  type WorkspaceUserIdentity,
} from '../services/geminiWorkspaceContext';
import { detectGeminiChatIntent } from '../services/geminiIntentRouter';
import { searchDriveFilesLive } from '../services/googleDrive';
import {
  createGooglePhotosPickerSession,
  pollGooglePhotosPickerSession,
} from '../services/googlePhotos';
import {
  formatCastorCommandsHelp,
  getCommandSuggestions,
  loadCastorLocalPermission,
  parseCastorCommand,
  saveCastorLocalPermission,
  searchLocalDriveLive,
  searchWorkspaceCalendarLive,
  searchWorkspaceContactsLive,
  searchWorkspaceGmailLive,
} from '../services/castorCommandParser';
import { butlerEngine } from '../services/butler/butlerEngine';
import type { ButlerState } from '../services/butler/types';
import {
  detectCastorOutfitCommand,
  extractCastorMoodTag,
  getCastorOutfitById,
  getCastorSpriteUrl,
  loadCastorConfig,
  resolveCastorExpression,
  saveCastorConfig,
  type CastorAgentConfig,
  type CastorExpressionId,
  type CastorReactionEvent,
} from '../services/castorAgent';
import { CastorWardrobeModal } from './CastorWardrobeModal';
import {
  googleChatApi,
  ChatSpace,
  ChatMessage as GChatMessage,
  ChatAttachment,
  ChatReaction,
  ChatUser,
} from '../services/googleChatApi';
import {
  GoogleChatMessageContextMenu,
  GoogleChatMessageDetailsModal,
  GoogleChatForwardModal,
} from './GoogleChatMessageContextMenu';
import { GoogleChatContactModal } from './GoogleChatContactModal';
import { GoogleChatGifPickerModal } from './GoogleChatGifPickerModal';
import { GoogleChatWorkspaceAttachModal, ChatAttachmentItem } from './GoogleChatWorkspaceAttachModal';
import { GifResult } from '../services/gifService';
import { googleWorkspaceMessenger } from '../services/googleWorkspaceMessenger';
import { notificationEngine } from '../services/notificationEngine';
import { useTranslation } from '../i18n';

export type GCommsTab = 'gemini' | 'chat';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  attachedAsset?: MediaAsset;
  matchedAssets?: MediaAsset[];
  stylizedPreview?: {
    dataUrl: string;
    style: string;
    sourceName: string;
  };
  requestedActions?: WorkspaceActionRequest[];
  castorOutfitId?: string;
  castorExpression?: CastorExpressionId;
  modelUsed?: string;
  timestamp: number;
  tokensUsed?: number;
  suggestedAction?: WorkspaceSuggestedAction;
}

interface GeminiCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: GCommsTab;
  initialChatAsset?: MediaAsset | null;
  activeAsset: MediaAsset | null;
  allAssets: MediaAsset[];
  folders?: FolderNode[];
  driveQuota?: DriveQuotaSnapshot | null;
  user?: WorkspaceUserIdentity | null;
  currentFolderName?: string;
  scanPhase?: string;
  onOpenNotebookLm: (asset?: MediaAsset) => void;
  onOpenCulling?: () => void;
  onOpenEditor?: (asset: MediaAsset) => void;
  onFilterCatalog?: (query: string) => void;
  onOpenMessenger?: (channel?: 'chat' | 'voice' | 'gmail') => void;
  onOpenOAuthWizard?: () => void;
  onOpenStorageSettings?: () => void;
  onStartQuickScan?: () => void;
  onStartDeepScan?: () => void;
  onImportLocalFolder?: () => void;
  onSyncChanges?: () => void;
  onSwitchViewMode?: (mode: ViewMode) => void;
  onSyncAssetsToCatalog?: (assets: MediaAsset[]) => void;
  onOpenMulticloudSync?: () => void;
  onActiveTabChange?: (tab: GCommsTab) => void;
  onGeminiBusyChange?: (busy: boolean) => void;
}

function renderInlineFormattedText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={idx} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function renderCastorMarkdown(rawText: string): React.ReactNode {
  const lines = String(rawText || '').split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;
        if (trimmed.startsWith('### ')) {
          return (
            <div key={i} className="font-extrabold text-[13px] tracking-tight pt-0.5">
              {renderInlineFormattedText(trimmed.slice(4))}
            </div>
          );
        }
        if (trimmed.startsWith('- ')) {
          return (
            <div key={i} className="flex items-start gap-1.5 pl-1">
              <span className="opacity-60 select-none">•</span>
              <span className="min-w-0 flex-1">{renderInlineFormattedText(trimmed.slice(2))}</span>
            </div>
          );
        }
        return <div key={i}>{renderInlineFormattedText(line)}</div>;
      })}
    </div>
  );
}

export const GeminiCopilotDrawer: React.FC<GeminiCopilotDrawerProps> = ({
  isOpen,
  onClose,
  initialTab = 'gemini',
  initialChatAsset,
  activeAsset,
  allAssets,
  folders = [],
  driveQuota = null,
  user = null,
  currentFolderName = 'All Media',
  scanPhase = 'idle',
  onOpenNotebookLm,
  onOpenCulling,
  onOpenEditor,
  onFilterCatalog,
  onOpenMessenger,
  onOpenOAuthWizard,
  onOpenStorageSettings,
  onStartQuickScan,
  onStartDeepScan,
  onImportLocalFolder,
  onSyncChanges,
  onSwitchViewMode,
  onSyncAssetsToCatalog,
  onOpenMulticloudSync,
  onActiveTabChange,
  onGeminiBusyChange,
}) => {
  const { t, currentLanguage } = useTranslation();

  const [activeTab, setActiveTab] = useState<GCommsTab>(initialTab);
  const [butlerState, setButlerState] = useState<ButlerState>(() => butlerEngine.getState());

  useEffect(() => {
    onActiveTabChange?.(activeTab);
  }, [activeTab, onActiveTabChange]);
  const [mountedOsLocations, setMountedOsLocations] = useState<Array<{ id: string; name: string; path: string }>>([]);
  const [castorConfig, setCastorConfig] = useState<CastorAgentConfig>(() => loadCastorConfig());
  const [castorExpression, setCastorExpression] = useState<CastorExpressionId>(() => {
    const cfg = loadCastorConfig();
    return cfg.pinnedExpression || '02_Happy';
  });
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [castorSpriteFailed, setCastorSpriteFailed] = useState(false);
  const [localSearchPermitted, setLocalSearchPermitted] = useState<boolean>(() => loadCastorLocalPermission());
  const [isPickerPolling, setIsPickerPolling] = useState(false);
  const [syncedSessionIds, setSyncedSessionIds] = useState<Set<string>>(() => new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChatThemeOpen, setIsChatThemeOpen] = useState(false);
  const [chatDecorationPrefs, setChatDecorationPrefs] = useState<ChatDecorationPrefs>(() =>
    loadChatDecorationPrefs()
  );

  const resolvedChatTheme = React.useMemo(
    () => resolveChatDecorationStyles(chatDecorationPrefs),
    [chatDecorationPrefs]
  );

  const handleUpdateChatDecoration = (next: ChatDecorationPrefs) => {
    setChatDecorationPrefs(next);
    saveChatDecorationPrefs(next);
  };

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  const existingCatalogIds = React.useMemo(() => new Set(allAssets.map((a) => a.id)), [allAssets]);

  const handleSyncAssets = (items: MediaAsset[]) => {
    if (!items.length) return;
    if (onSyncAssetsToCatalog) {
      onSyncAssetsToCatalog(items);
    }
    setSyncedSessionIds((prev) => {
      const next = new Set(prev);
      for (const it of items) next.add(it.id);
      return next;
    });
  };

  const launchInChatPhotosPicker = async () => {
    if (isPickerPolling) return;
    setIsPickerPolling(true);
    const activeOutfitId = castorConfig.outfitId;
    applyCastorReaction('thinking', 'open google photos picker');

    try {
      const session = await createGooglePhotosPickerSession(2000);
      window.open(session.pickerUri, 'DriveTherapyPhotosPicker', 'width=960,height=720,resizable=yes');
      setGeminiMessages((prev) => [
        ...prev,
        {
          id: `asst_${Date.now()}`,
          sender: 'assistant',
          text: `### Google Photos Picker Session Active\nI opened Google Photos Picker in a new window (up to **2,000 items** per batch). Search for your photos directly in Google Photos, select the ones you want, and click **Done** — I'll index them automatically the moment you finish!`,
          castorOutfitId: activeOutfitId,
          castorExpression: '15_Curious',
          modelUsed: 'Google Photos Picker API',
          timestamp: Date.now(),
        },
      ]);

      for (let attempt = 0; attempt < 90; attempt++) {
        await new Promise((r) => setTimeout(r, 2500));
        const polled = await pollGooglePhotosPickerSession(session.id);
        if (polled.mediaItemsSet) {
          if (polled.items.length > 0) {
            handleSyncAssets(polled.items);
          }
          const expr = applyCastorReaction(polled.items.length > 0 ? 'style_success' : 'empty_result', 'picker complete');
          setGeminiMessages((prev) => [
            ...prev,
            {
              id: `asst_${Date.now()}`,
              sender: 'assistant',
              text:
                polled.items.length > 0
                  ? `### Indexed ${polled.items.length} Google Photos from Picker!\nAll **${polled.items.length}** selected photos are now synced into your local catalog and searchable offline. Want to transfer them directly to Google Drive without downloading?`
                  : `The Google Photos Picker session closed with 0 selected photos. Run \`!picker\` anytime to pick another batch.`,
              matchedAssets: polled.items.slice(0, 6),
              requestedActions:
                polled.items.length > 0
                  ? [
                      {
                        id: 'act_mc_transfer',
                        kind: 'user_action',
                        type: 'open_multicloud_sync',
                        label: 'Transfer Picked Photos → Google Drive (Multicloud Sync)',
                        description: 'Direct cloud-to-cloud streaming with zero local download',
                      },
                      {
                        id: 'act_next_picker',
                        kind: 'user_action',
                        type: 'open_photos_picker',
                        label: 'Pick Next Batch (up to 2,000 more Photos)',
                      },
                    ]
                  : undefined,
              castorOutfitId: activeOutfitId,
              castorExpression: expr,
              modelUsed: 'Google Photos Picker API',
              timestamp: Date.now(),
            },
          ]);
          break;
        }
      }
    } catch (err: any) {
      const expr = applyCastorReaction('error', 'picker error');
      setGeminiMessages((prev) => [
        ...prev,
        {
          id: `asst_${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ **Google Photos Picker Notice**: ${err?.message || 'Unable to start Picker session.'}`,
          requestedActions: [
            {
              id: 'act_oauth_retry',
              kind: 'access_request',
              type: 'open_oauth',
              label: 'Check Google OAuth Connection',
            },
          ],
          castorOutfitId: activeOutfitId,
          castorExpression: expr,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsPickerPolling(false);
    }
  };

  const handleUpdateCastorConfig = (next: CastorAgentConfig) => {
    setCastorConfig(next);
    saveCastorConfig(next);
    if (!next.autoExpression && next.pinnedExpression) {
      setCastorExpression(next.pinnedExpression);
    }
  };

  const applyCastorReaction = (
    event: CastorReactionEvent,
    promptText = '',
    overrideExpr?: CastorExpressionId | null
  ): CastorExpressionId => {
    if (!castorConfig.autoExpression && castorConfig.pinnedExpression) {
      return castorConfig.pinnedExpression;
    }
    const nextExpr = overrideExpr || resolveCastorExpression(event, promptText);
    setCastorExpression(nextExpr);
    return nextExpr;
  };

  useEffect(() => {
    return butlerEngine.subscribe((next) => setButlerState(next));
  }, []);

  // Poll live loopback host OS quick-access / mounted folders when drawer opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/fs/quick-access')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const list = Array.isArray(data.locations) ? data.locations : Array.isArray(data) ? data : [];
        setMountedOsLocations(
          list
            .filter((x: any) => x && typeof x.path === 'string')
            .map((x: any) => ({ id: String(x.id || x.name || x.path), name: String(x.name || x.path), path: String(x.path) }))
        );
      })
      .catch(() => {
        // Silently ignore if running without local OS loopback backend
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, folders.length]);

  const workspaceSnapshot = React.useMemo(
    () =>
      buildGeminiWorkspaceSnapshot({
        allAssets,
        folders,
        activeAsset,
        driveQuota,
        user,
        currentFolderName,
        scanPhase,
        butlerState,
        mountedOsLocations,
      }),
    [allAssets, folders, activeAsset, driveQuota, user, currentFolderName, scanPhase, butlerState, mountedOsLocations]
  );

  // --- GEMINI COPILOT STATE ---
  const [geminiMessages, setGeminiMessages] = useState<ChatMessage[]>(() => {
    const initialCfg = loadCastorConfig();
    return [
      {
        id: 'welcome',
        sender: 'assistant',
        text: '👋 **Hi! I\'m Castor, your Drive Therapy Gemini Copilot.**\n\nI\'m synced with your **hybrid search index**, **mounted & cloud storage**, and **Google Workspace OAuth**. Ask me to search Drive for files, find photos in Google Photos, stylize a selected photo (e.g., *anime style*), audit storage, or switch my wardrobe (`C-01`–`C-24`)!',
        castorOutfitId: initialCfg.outfitId,
        castorExpression: initialCfg.pinnedExpression || '02_Happy',
        timestamp: Date.now(),
      },
    ];
  });
  const [geminiInput, setGeminiInput] = useState('');
  const commandSuggestions = React.useMemo(() => getCommandSuggestions(geminiInput), [geminiInput]);
  const [selectedAttachment, setSelectedAttachment] = useState<MediaAsset | null>(activeAsset);
  const [isGeminiProcessing, setIsGeminiProcessing] = useState(false);

  useEffect(() => {
    onGeminiBusyChange?.(isGeminiProcessing);
  }, [isGeminiProcessing, onGeminiBusyChange]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --- GOOGLE CHAT STATE (Image 3 Parity & Rich Extensions) ---
  const [chatSpaces, setChatSpaces] = useState<ChatSpace[]>(() => googleChatApi.getCachedSpaces());
  const [selectedSpace, setSelectedSpace] = useState<ChatSpace | null>(() => {
    const list = googleChatApi.getCachedSpaces();
    return list[0] || null;
  });
  const [chatMessages, setChatMessages] = useState<GChatMessage[]>([]);
  const [chatInputText, setChatInputText] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isChatUnreadOnly, setIsChatUnreadOnly] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Modals & Context Menus
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contextMenuState, setContextMenuState] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    message: GChatMessage | null;
  }>({ isOpen: false, position: { x: 0, y: 0 }, message: null });
  const [detailsModalMessage, setDetailsModalMessage] = useState<GChatMessage | null>(null);
  const [forwardModalMessage, setForwardModalMessage] = useState<GChatMessage | null>(null);

  // Rich Attachments & Composer State
  const [stagedAttachment, setStagedAttachment] = useState<ChatAttachment | null>(null);
  const [stagedQuote, setStagedQuote] = useState<{ sender: string; text: string } | null>(null);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isVideoMenuOpen, setIsVideoMenuOpen] = useState(false);
  const [isEmojiMenuOpen, setIsEmojiMenuOpen] = useState(false);
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [isWorkspaceAttachOpen, setIsWorkspaceAttachOpen] = useState(false);
  const [isYoutubeModalOpen, setIsYoutubeModalOpen] = useState(false);
  const [youtubeQuery, setYoutubeQuery] = useState('');
  const [hoveredMessageName, setHoveredMessageName] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const localFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadChatSpaces();
      if (initialChatAsset) {
        setStagedAttachment({
          name: initialChatAsset.name,
          type: initialChatAsset.mediaCategory === 'video' ? 'video' : 'image',
          url: initialChatAsset.cloudUrl,
          sizeBytes: initialChatAsset.sizeBytes,
        });
      }
    }
  }, [isOpen, initialTab, initialChatAsset]);

  useEffect(() => {
    if (activeAsset && !selectedAttachment) {
      setSelectedAttachment(activeAsset);
    }
  }, [activeAsset]);

  useEffect(() => {
    if (isOpen && activeTab === 'gemini') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, activeTab, geminiMessages]);

  useEffect(() => {
    if (selectedSpace) {
      loadMessagesForSpace(selectedSpace.name);
    }
  }, [selectedSpace]);

  const loadChatSpaces = async () => {
    setIsChatLoading(true);
    try {
      const spaces = await googleChatApi.listSpaces();
      setChatSpaces(spaces);
      if (!selectedSpace && spaces.length > 0) {
        setSelectedSpace(spaces[0]);
      }
    } finally {
      setIsChatLoading(false);
    }
  };

  const loadMessagesForSpace = async (spaceName: string) => {
    const msgs = await googleChatApi.listMessages(spaceName);
    setChatMessages(msgs);
    setTimeout(() => chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  if (!isOpen) return null;

  // --- GEMINI COPILOT HANDLERS ---
  const handleSendGemini = async (textToSend?: string) => {
    const prompt = (textToSend || geminiInput).trim();
    if (!prompt && !selectedAttachment) return;

    const effectivePrompt = prompt || `Analyze attached asset: ${selectedAttachment?.name || ''}`;
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: effectivePrompt,
      attachedAsset: selectedAttachment || undefined,
      timestamp: Date.now(),
    };

    const historyTurns = geminiMessages
      .filter((m) => m.id !== 'welcome' && (m.sender === 'user' || m.sender === 'assistant'))
      .slice(-8)
      .map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('model' as const),
        text: m.text,
      }));

    setGeminiMessages((prev) => [...prev, userMsg]);
    setGeminiInput('');
    setIsGeminiProcessing(true);

    const activeOutfitId = castorConfig.outfitId;
    const parsedCmd = parseCastorCommand(effectivePrompt);

    // 0. Direct @ / ! Command Handling
    if (parsedCmd.prefix === '!') {
      const bang = parsedCmd.command;
      if (bang === 'picker') {
        setIsGeminiProcessing(false);
        void launchInChatPhotosPicker();
        return;
      }
      if (bang === 'transfer' && onOpenMulticloudSync) {
        onOpenMulticloudSync();
        setIsGeminiProcessing(false);
        return;
      }
      if (bang === 'sync' && onSyncChanges) {
        onSyncChanges();
        setIsGeminiProcessing(false);
        return;
      }
      if (bang === 'mount' && onImportLocalFolder) {
        onImportLocalFolder();
        setIsGeminiProcessing(false);
        return;
      }
      if (bang === 'cull' && onOpenCulling) {
        onOpenCulling();
        setIsGeminiProcessing(false);
        return;
      }
      if (bang === 'editor' && onOpenEditor && (selectedAttachment || activeAsset)) {
        onOpenEditor((selectedAttachment || activeAsset)!);
        setIsGeminiProcessing(false);
        return;
      }
      if (bang === 'dossier') {
        onOpenNotebookLm(selectedAttachment || activeAsset || undefined);
        setIsGeminiProcessing(false);
        return;
      }
      if (bang === 'allow-local') {
        setLocalSearchPermitted(true);
        saveCastorLocalPermission(true);
        const expr = applyCastorReaction('outfit_changed', effectivePrompt);
        setGeminiMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: `✅ **Local Drive Search Permission Granted**\n\nI can now search your local OS folders (\`Pictures\`, \`Documents\`, \`Downloads\`, \`Desktop\`, \`Videos\`, \`Music\`) read-only via \`@local <query>\`. Revoke anytime with \`!revoke-local\`.`,
            castorOutfitId: activeOutfitId,
            castorExpression: expr,
            modelUsed: 'Castor Local Permission',
            timestamp: Date.now(),
          },
        ]);
        setIsGeminiProcessing(false);
        return;
      }
      if (bang === 'revoke-local') {
        setLocalSearchPermitted(false);
        saveCastorLocalPermission(false);
        const expr = applyCastorReaction('gratitude', effectivePrompt);
        setGeminiMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: `🔒 **Local Drive Search Permission Revoked**\n\nI will no longer query your local OS disk unless you re-enable permission via \`!allow-local\`.`,
            castorOutfitId: activeOutfitId,
            castorExpression: expr,
            modelUsed: 'Castor Local Permission',
            timestamp: Date.now(),
          },
        ]);
        setIsGeminiProcessing(false);
        return;
      }
    }

    if (parsedCmd.prefix === '/') {
      const slash = parsedCmd.command;
      if (slash === 'help') {
        const expr = applyCastorReaction('audit_confident', effectivePrompt);
        setGeminiMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: formatCastorCommandsHelp(),
            castorOutfitId: activeOutfitId,
            castorExpression: expr,
            modelUsed: 'Castor Command Reference',
            timestamp: Date.now(),
          },
        ]);
        setIsGeminiProcessing(false);
        return;
      }
      if (slash === 'clear') {
        setGeminiMessages([
          {
            id: 'welcome',
            sender: 'assistant',
            text: `👋 **Chat cleared!** Type \`/help\` to see all \`@\`, \`/\`, and \`!\` commands.`,
            castorOutfitId: activeOutfitId,
            castorExpression: '02_Happy',
            timestamp: Date.now(),
          },
        ]);
        setIsGeminiProcessing(false);
        return;
      }
      if (slash === 'wardrobe') {
        if (parsedCmd.args) {
          const sw = detectCastorOutfitCommand(`wear ${parsedCmd.args}`);
          if (sw) {
            handleUpdateCastorConfig({ ...castorConfig, outfitId: sw.id });
            const expr = applyCastorReaction('outfit_changed', effectivePrompt);
            setGeminiMessages((prev) => [
              ...prev,
              {
                id: `asst_${Date.now()}`,
                sender: 'assistant',
                text: `✨ Switched to **${sw.id} — ${sw.name}**!`,
                castorOutfitId: sw.id,
                castorExpression: expr,
                modelUsed: 'Castor Wardrobe Agent',
                timestamp: Date.now(),
              },
            ]);
            setIsGeminiProcessing(false);
            return;
          }
        }
        setIsWardrobeOpen(true);
        setIsGeminiProcessing(false);
        return;
      }
      if (slash === 'transfer' && onOpenMulticloudSync) {
        onOpenMulticloudSync();
        setIsGeminiProcessing(false);
        return;
      }
      if (slash === 'sync' && onSyncChanges) {
        onSyncChanges();
        setIsGeminiProcessing(false);
        return;
      }
      if (slash === 'scan' && onStartQuickScan) {
        onStartQuickScan();
        setIsGeminiProcessing(false);
        return;
      }
      if (slash === 'deep-scan' && onStartDeepScan) {
        onStartDeepScan();
        setIsGeminiProcessing(false);
        return;
      }
    }

    // Immediate outfit switch via natural language or @castor
    const outfitSwitch =
      parsedCmd.prefix === '@' && parsedCmd.command === 'castor'
        ? detectCastorOutfitCommand(`wear ${parsedCmd.args}`)
        : detectCastorOutfitCommand(effectivePrompt);
    if (outfitSwitch) {
      const nextCfg: CastorAgentConfig = { ...castorConfig, outfitId: outfitSwitch.id };
      handleUpdateCastorConfig(nextCfg);
      const expr = applyCastorReaction('outfit_changed', effectivePrompt);
      setGeminiMessages((prev) => [
        ...prev,
        {
          id: `asst_${Date.now()}`,
          sender: 'assistant',
          text: `✨ Switched to **${outfitSwitch.id} — ${outfitSwitch.name}**! Ready to assist with your Drive, Photos, and local storage.`,
          castorOutfitId: outfitSwitch.id,
          castorExpression: expr,
          modelUsed: 'Castor Wardrobe Agent',
          timestamp: Date.now(),
        },
      ]);
      setIsGeminiProcessing(false);
      return;
    }

    // Rewrite style slash commands (/anime, /watercolor, etc.) into style prompt
    const effectiveNormalizedPrompt =
      parsedCmd.prefix === '/' && ['anime', 'watercolor', 'cyberpunk', 'noir', 'sketch'].includes(parsedCmd.command)
        ? `Make the selected photo ${parsedCmd.command} style ${parsedCmd.args}`.trim()
        : parsedCmd.prefix === '/' && parsedCmd.command === 'storage'
          ? 'Audit my storage quota, enabled providers, and largest indexed files'
          : parsedCmd.prefix === '/' && parsedCmd.command === 'oauth'
            ? 'Check my Google Workspace OAuth status and granted scopes'
            : effectivePrompt;

    const intent = detectGeminiChatIntent(effectiveNormalizedPrompt, Boolean(selectedAttachment || activeAsset));
    applyCastorReaction(intent.type === 'destructive_guard' ? 'destructive_guard' : 'thinking', effectiveNormalizedPrompt);

    try {
      const freshSnapshot = buildGeminiWorkspaceSnapshot({
        allAssets,
        folders,
        activeAsset: selectedAttachment || activeAsset,
        driveQuota,
        user,
        currentFolderName,
        scanPhase,
        butlerState,
        mountedOsLocations,
      });

      // Live Workspace @gmail, @calendar, @contacts commands
      if (parsedCmd.prefix === '@' && parsedCmd.command === 'gmail') {
        const res = await searchWorkspaceGmailLive(parsedCmd.args || 'has:attachment');
        const expr = applyCastorReaction(res.needsScope || res.items.length === 0 ? 'access_request' : 'search_found', effectivePrompt);
        const listText =
          res.items.length > 0
            ? res.items.map((m) => `- **${m.subject}** — ${m.from} (${m.date.slice(0, 16)})\n  ${m.snippet.slice(0, 120)}`).join('\n')
            : res.needsScope
              ? 'Gmail read scope (`gmail.readonly`) is not granted yet.'
              : `No Gmail messages matched \`${parsedCmd.args}\`.`;
        setGeminiMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: `### Gmail Live Search: \`${parsedCmd.args || 'has:attachment'}\`\n${listText}`,
            requestedActions: res.needsScope
              ? [{ id: 'req_gmail', kind: 'access_request', type: 'request_incremental_scope', label: 'Grant Gmail Read Access (gmail.readonly)', payload: 'gmail' }]
              : undefined,
            castorOutfitId: activeOutfitId,
            castorExpression: expr,
            modelUsed: 'Gmail API v1 users.messages.list',
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      if (parsedCmd.prefix === '@' && parsedCmd.command === 'calendar') {
        const res = await searchWorkspaceCalendarLive(parsedCmd.args);
        const expr = applyCastorReaction(res.needsScope || res.items.length === 0 ? 'access_request' : 'search_found', effectivePrompt);
        const listText =
          res.items.length > 0
            ? res.items.map((ev) => `- **${ev.summary}** — ${ev.start}${ev.location ? ` (${ev.location})` : ''}`).join('\n')
            : res.needsScope
              ? 'Google Calendar read scope (`calendar.readonly`) is not granted yet.'
              : `No Calendar events matched \`${parsedCmd.args || 'upcoming'}\`.`;
        setGeminiMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: `### Google Calendar Live Search: \`${parsedCmd.args || 'upcoming'}\`\n${listText}`,
            requestedActions: res.needsScope
              ? [{ id: 'req_cal', kind: 'access_request', type: 'request_incremental_scope', label: 'Grant Google Calendar Access', payload: 'calendar' }]
              : undefined,
            castorOutfitId: activeOutfitId,
            castorExpression: expr,
            modelUsed: 'Google Calendar API v3 events.list',
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      if (parsedCmd.prefix === '@' && parsedCmd.command === 'contacts') {
        const res = await searchWorkspaceContactsLive(parsedCmd.args);
        const expr = applyCastorReaction(res.needsScope || res.items.length === 0 ? 'access_request' : 'search_found', effectivePrompt);
        const listText =
          res.items.length > 0
            ? res.items.map((c) => `- **${c.name}**${c.email ? ` — ${c.email}` : ''}${c.phone ? ` · ${c.phone}` : ''}`).join('\n')
            : res.needsScope
              ? 'Google Contacts read scope (`contacts.readonly`) is not granted yet.'
              : `No Contacts matched \`${parsedCmd.args}\`.`;
        setGeminiMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: `### Google Contacts Search: \`${parsedCmd.args}\`\n${listText}`,
            requestedActions: res.needsScope
              ? [{ id: 'req_contacts', kind: 'access_request', type: 'request_incremental_scope', label: 'Grant Google Contacts Access', payload: 'contacts' }]
              : undefined,
            castorOutfitId: activeOutfitId,
            castorExpression: expr,
            modelUsed: 'Google People API searchContacts',
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      // Permission-Gated Local OS Drive Search (@local <q> or natural "on my computer/local drive")
      const isLocalQuery =
        (parsedCmd.prefix === '@' && parsedCmd.command === 'local') ||
        (/\b(local drive|local disk|on my computer|my pc|hard drive)\b/i.test(effectiveNormalizedPrompt) &&
          /\b(find|search|locate|show)\b/i.test(effectiveNormalizedPrompt));
      if (isLocalQuery) {
        const localTerm = parsedCmd.prefix === '@' ? parsedCmd.args : intent.extractedQuery || effectiveNormalizedPrompt;
        if (!localSearchPermitted) {
          const expr = applyCastorReaction('access_request', effectiveNormalizedPrompt);
          setGeminiMessages((prev) => [
            ...prev,
            {
              id: `asst_${Date.now()}`,
              sender: 'assistant',
              text: `### Local Drive Search Permission Needed\nI don't have permission to search your local OS folders yet. Grant read-only Local Drive Search Permission below (or run \`!allow-local\`) and I'll search for **${localTerm || 'your files'}** right away!`,
              requestedActions: [
                {
                  id: 'req_local_perm',
                  kind: 'access_request',
                  type: 'grant_local_search',
                  label: 'Grant Local Drive Search Permission (Read-Only)',
                  description: 'Allows Castor to search Pictures, Documents, Downloads, Desktop, Videos & Music on loopback',
                  payload: localTerm,
                },
                {
                  id: 'act_mount_local',
                  kind: 'user_action',
                  type: 'mount_local_folder',
                  label: 'Or Pick a Specific Folder to Mount',
                },
              ],
              castorOutfitId: activeOutfitId,
              castorExpression: expr,
              modelUsed: 'Castor Local Permission Gate',
              timestamp: Date.now(),
            },
          ]);
          return;
        }

        const localRes = await searchLocalDriveLive(localTerm || '.');
        const expr = applyCastorReaction(localRes.items.length > 0 ? 'search_found' : 'empty_result', effectiveNormalizedPrompt);
        const listText =
          localRes.items.length > 0
            ? localRes.items
                .slice(0, 8)
                .map((a) => `- **${a.name}** (${a.category} · ${formatBytesCompact(a.sizeBytes || 0)}) — \`${a.path}\``)
                .join('\n')
            : `- No local files matched **${localTerm}** across ${localRes.scannedDirs} scanned OS folders.`;

        setGeminiMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: `### Local Drive Search: "${localTerm}"\nScanned **${localRes.scannedDirs}** local OS folders and found **${localRes.items.length}** file(s):\n\n${listText}`,
            matchedAssets: localRes.items.length > 0 ? localRes.items : undefined,
            requestedActions:
              localRes.items.length > 0
                ? [
                    {
                      id: 'sync_all_local',
                      kind: 'user_action',
                      type: 'sync_found_assets',
                      label: `Sync All ${localRes.items.length} Found Local Files into Catalog`,
                      payload: localRes.items,
                    },
                  ]
                : undefined,
            castorOutfitId: activeOutfitId,
            castorExpression: expr,
            modelUsed: 'Loopback Local OS Search (/api/fs/search)',
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      // 1. Sacred Non-Destructive Guardrail
      if (intent.type === 'destructive_guard') {
        const expr = applyCastorReaction('destructive_guard', effectivePrompt);
        setGeminiMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: `🛡️ **Sacred Non-Destructive Integrity**\n\nI cannot silently delete, overwrite, or move your cloud or local files. You can review and confirm file actions safely using the guided workspace tools below.`,
            castorOutfitId: activeOutfitId,
            castorExpression: expr,
            modelUsed: 'Castor Non-Destructive Guard',
            timestamp: Date.now(),
            requestedActions: [
              {
                id: 'act_cull',
                kind: 'user_action',
                type: 'open_culling',
                label: 'Open Culling Room (Review & Reject Safely)',
              },
              {
                id: 'act_local',
                kind: 'navigation',
                type: 'open_local_files',
                label: 'Open Local File Manager',
              },
            ],
          },
        ]);
        return;
      }

      // 2. Non-Destructive Photo Style Transfer (e.g. "make the selected photo anime style")
      if (intent.type === 'image_style_transfer') {
        const targetPhoto = selectedAttachment || activeAsset;
        if (!targetPhoto) {
          const expr = applyCastorReaction('empty_result', effectivePrompt);
          setGeminiMessages((prev) => [
            ...prev,
            {
              id: `asst_${Date.now()}`,
              sender: 'assistant',
              text: `🎨 **Select a Photo to Stylize**\n\nPlease click or attach any photo in your catalog first, then ask me again to render a non-destructive **${intent.artStyle || 'anime'}** style copy.`,
              castorOutfitId: activeOutfitId,
              castorExpression: expr,
              modelUsed: 'Castor Style Assistant',
              timestamp: Date.now(),
              requestedActions: [
                {
                  id: 'act_mount_photo',
                  kind: 'user_action',
                  type: 'mount_local_folder',
                  label: 'Mount Local Photo Folder',
                },
                {
                  id: 'act_photos_view',
                  kind: 'navigation',
                  type: 'open_google_photos',
                  label: 'Browse Google Photos',
                },
              ],
            },
          ]);
          return;
        }

        const styled = await geminiUniversalEngine.executeImageStyleEdit({
          asset: targetPhoto,
          prompt: effectivePrompt,
        });
        const expr = applyCastorReaction('style_success', effectivePrompt);

        setGeminiMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: styled.text,
            attachedAsset: targetPhoto,
            stylizedPreview: {
              dataUrl: styled.dataUrl,
              style: styled.style,
              sourceName: targetPhoto.name,
            },
            castorOutfitId: activeOutfitId,
            castorExpression: expr,
            modelUsed: styled.modelUsed,
            timestamp: Date.now(),
            suggestedAction: {
              type: 'open_editor',
              label: `Open Original (${targetPhoto.name}) in Pixel Editor`,
              payload: targetPhoto,
            },
          },
        ]);
        return;
      }

      // 3. Google Photos — In-Chat Picker API Integration (searches indexed Photos first, then offers Picker!)
      if (intent.type === 'google_photos_search' || (parsedCmd.prefix === '@' && parsedCmd.command === 'photos')) {
        const photoQuery = parsedCmd.prefix === '@' ? parsedCmd.args : intent.extractedQuery || effectiveNormalizedPrompt;
        const photosOnlyAssets = allAssets.filter((a) => a.source === 'photos');
        const localPhotoHits = retrieveIndexedMatchesForPrompt(photoQuery, photosOnlyAssets, 8);

        // Also check Google Drive headless images (`mimeType contains 'image/'`) when signed in!
        const driveImageHits =
          freshSnapshot.oauth.isSignedIn && photoQuery
            ? await searchDriveFilesLive({ fullText: photoQuery, mimePrefix: 'image/' }, 8)
            : [];

        const mergedMap = new Map<string, MediaAsset>();
        for (const item of [...localPhotoHits, ...driveImageHits]) {
          if (!mergedMap.has(item.id)) mergedMap.set(item.id, item);
        }
        const merged = Array.from(mergedMap.values()).slice(0, 8);

        const actions: WorkspaceActionRequest[] = [
          {
            id: 'act_open_picker',
            kind: 'user_action',
            type: 'open_photos_picker',
            label: 'Open Google Photos Picker (Search & Select up to 2,000 Photos)',
            description: 'Search inside Google Photos directly — Castor will auto-index everything you select',
          },
        ];

        if (merged.length > 0) {
          const unsynced = merged.filter((m) => !existingCatalogIds.has(m.id));
          if (unsynced.length > 0) {
            actions.unshift({
              id: 'sync_all_photos_drive',
              kind: 'user_action',
              type: 'sync_found_assets',
              label: `Sync All ${unsynced.length} Found Image(s) into Catalog`,
              payload: unsynced,
            });
          }
        }

        const expr = applyCastorReaction(merged.length > 0 ? 'search_found' : 'access_request', effectiveNormalizedPrompt);
        const bodyText =
          merged.length > 0
            ? `### Google Photos & Drive Image Matches: "${photoQuery}"\nFound **${merged.length}** image(s) (${localPhotoHits.length} in indexed Photos, ${driveImageHits.length} live in Google Drive):\n\n${merged
                .slice(0, 6)
                .map((a) => `- **${a.name}** (${a.source} · ${formatBytesCompact(a.sizeBytes || 0)})`)
                .join('\n')}\n\nWant to search more directly in Google Photos? Open the Picker below!`
            : `### Google Photos Search: "${photoQuery}"\nI don't have anything matching **${photoQuery}** in your currently indexed files. Would you like to open the **Google Photos Picker** so you can search Google Photos directly and let me index what you select?`;

        setGeminiMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: bodyText,
            matchedAssets: merged.length > 0 ? merged : undefined,
            requestedActions: actions,
            castorOutfitId: activeOutfitId,
            castorExpression: expr,
            modelUsed: 'Google Photos Picker + Drive v3 Image Search',
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      // 4. Google Drive Live Headless files.list (q) Search (@drive, /search, or natural Drive query)
      if (
        intent.type === 'google_drive_search' ||
        (parsedCmd.prefix === '@' && parsedCmd.command === 'drive') ||
        (parsedCmd.prefix === '/' && parsedCmd.command === 'search')
      ) {
        const searchTerm =
          parsedCmd.prefix === '@' || parsedCmd.prefix === '/'
            ? parsedCmd.args
            : intent.extractedQuery || effectiveNormalizedPrompt;
        const driveOnlyAssets = allAssets.filter((a) => a.source === 'cloud');
        const localDriveHits = retrieveIndexedMatchesForPrompt(searchTerm, driveOnlyAssets, 8);
        const liveDriveHits = freshSnapshot.oauth.isSignedIn ? await searchDriveFilesLive(searchTerm, 15) : [];

        // On /search, also include local OS hits if local permission is granted
        const localOsHits =
          parsedCmd.prefix === '/' && parsedCmd.command === 'search' && localSearchPermitted
            ? (await searchLocalDriveLive(searchTerm, undefined, 8)).items
            : [];

        const mergedMap = new Map<string, MediaAsset>();
        for (const item of [...liveDriveHits, ...localDriveHits, ...localOsHits]) {
          if (!mergedMap.has(item.id)) mergedMap.set(item.id, item);
        }
        const merged = Array.from(mergedMap.values()).slice(0, 12);
        const unsyncedHits = merged.filter((m) => !existingCatalogIds.has(m.id));

        const actions: WorkspaceActionRequest[] = [];
        if (!freshSnapshot.oauth.isSignedIn) {
          actions.push({
            id: 'req_drive_oauth',
            kind: 'access_request',
            type: 'open_oauth',
            label: 'Connect Google Drive OAuth',
            description: 'Required to run headless Drive v3 fullText search across all Docs, PDFs, and photos',
          });
        } else if (unsyncedHits.length > 0) {
          actions.push({
            id: 'sync_all_drive_found',
            kind: 'user_action',
            type: 'sync_found_assets',
            label: `Sync All ${unsyncedHits.length} Unsynced File(s) into Catalog`,
            description: 'Saves found Drive items directly into IndexedDB & LitHybridSearchIndex',
            payload: unsyncedHits,
          });
        }
        if (merged.length > 0 && searchTerm) {
          actions.push({
            id: 'act_filter_drive',
            kind: 'navigation',
            type: 'filter_catalog',
            label: `Filter Catalog for "${searchTerm}"`,
            payload: searchTerm,
          });
        }

        const listText =
          merged.length > 0
            ? merged
                .slice(0, 8)
                .map(
                  (a) =>
                    `- **${a.name}** (${a.category} · ${formatBytesCompact(a.sizeBytes || 0)}${a.exif?.camera ? ` · ${a.exif.camera}` : ''}${a.modifiedTime ? ` · ${a.modifiedTime.slice(0, 10)}` : ''})`
                )
                .join('\n')
            : `- No matching Drive files found for **${searchTerm}**.`;

        const expr = applyCastorReaction(
          !freshSnapshot.oauth.isSignedIn || merged.length === 0 ? 'access_request' : 'search_found',
          effectiveNormalizedPrompt
        );

        setGeminiMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: `### Google Drive Live Search: "${searchTerm}"\nFound **${merged.length}** matching ${merged.length === 1 ? 'file' : 'files / copies'} (${liveDriveHits.length} live Drive v3 hits, ${localDriveHits.length} indexed${localOsHits.length ? `, ${localOsHits.length} local OS` : ''}):\n\n${listText}`,
            matchedAssets: merged.length > 0 ? merged : undefined,
            requestedActions: actions,
            castorOutfitId: activeOutfitId,
            castorExpression: expr,
            modelUsed: freshSnapshot.oauth.isSignedIn ? 'Google Drive v3 files.list (q) + Hybrid Index' : 'Local Catalog Index',
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      // 5. General Harmonized Workspace Chat
      const matchedAssets = retrieveIndexedMatchesForPrompt(effectivePrompt, allAssets, 6);

      const response = await geminiUniversalEngine.executeWorkspaceChat({
        prompt: effectivePrompt,
        history: historyTurns,
        snapshot: freshSnapshot,
        matchedAssets,
        attachedAsset: selectedAttachment,
      });

      const { cleanText, expressionId: llmMood } = extractCastorMoodTag(response.text);
      const fallbackEvent: CastorReactionEvent =
        matchedAssets.length > 0
          ? 'search_found'
          : response.suggestedAction?.type === 'open_oauth'
            ? 'access_request'
            : 'audit_confident';
      const expr = applyCastorReaction(fallbackEvent, effectivePrompt, llmMood);

      const contextualRequests: WorkspaceActionRequest[] = [];
      if (/\b(local|disk|computer|folder|mount|documents|pictures|downloads)\b/i.test(effectivePrompt) && freshSnapshot.storage.localAssetCount === 0) {
        contextualRequests.push({
          id: 'req_mount_local',
          kind: 'user_action',
          type: 'mount_local_folder',
          label: 'Mount Local Folder into Index',
          description: `${freshSnapshot.storage.mountedOsLocations.length} OS directories detected on host`,
        });
      }

      const assistantMsg: ChatMessage = {
        id: `asst_${Date.now()}`,
        sender: 'assistant',
        text: cleanText,
        attachedAsset: selectedAttachment || undefined,
        matchedAssets: response.matchedAssets.length > 0 ? response.matchedAssets : undefined,
        requestedActions: contextualRequests.length > 0 ? contextualRequests : undefined,
        castorOutfitId: activeOutfitId,
        castorExpression: expr,
        modelUsed: response.modelUsed,
        timestamp: Date.now(),
        tokensUsed: response.tokensUsed,
        suggestedAction: response.suggestedAction,
      };
      setGeminiMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const expr = applyCastorReaction('error', effectivePrompt);
      setGeminiMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ **Analysis Notice**: ${err.message || 'Unable to connect to Gemini at this moment.'}`,
          castorOutfitId: activeOutfitId,
          castorExpression: expr,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsGeminiProcessing(false);
    }
  };

  const handleRunSuggestedAction = (action: WorkspaceSuggestedAction, fallbackAsset?: MediaAsset) => {
    if (action.type === 'open_notebooklm') {
      onOpenNotebookLm(fallbackAsset);
    } else if (action.type === 'open_culling' && onOpenCulling) {
      onOpenCulling();
    } else if (action.type === 'open_editor' && onOpenEditor) {
      const target = (action.payload && typeof action.payload === 'object' ? action.payload : fallbackAsset) as MediaAsset | undefined;
      if (target) onOpenEditor(target);
    } else if (action.type === 'filter_catalog' && onFilterCatalog && typeof action.payload === 'string') {
      onFilterCatalog(action.payload);
    } else if (action.type === 'open_oauth' && onOpenOAuthWizard) {
      onOpenOAuthWizard();
    } else if (action.type === 'open_storage' && onOpenStorageSettings) {
      onOpenStorageSettings();
    } else if (action.type === 'start_quick_scan' && onStartQuickScan) {
      onStartQuickScan();
    } else if (action.type === 'start_deep_scan' && onStartDeepScan) {
      onStartDeepScan();
    } else if (action.type === 'sync_drive_changes' && onSyncChanges) {
      onSyncChanges();
    } else if (action.type === 'mount_local_folder' && onImportLocalFolder) {
      onImportLocalFolder();
    } else if (action.type === 'open_google_photos' && onSwitchViewMode) {
      onSwitchViewMode('google-photos');
    } else if (action.type === 'open_local_files' && onSwitchViewMode) {
      onSwitchViewMode('local-files');
    } else if (action.type === 'open_drive_browser' && onSwitchViewMode) {
      onSwitchViewMode('drive-browser');
    } else if (action.type === 'open_photos_picker') {
      void launchInChatPhotosPicker();
    } else if (action.type === 'open_multicloud_sync' && onOpenMulticloudSync) {
      onOpenMulticloudSync();
    } else if (action.type === 'sync_found_assets' && Array.isArray(action.payload)) {
      handleSyncAssets(action.payload);
    } else if (action.type === 'grant_local_search') {
      setLocalSearchPermitted(true);
      saveCastorLocalPermission(true);
      const pendingQuery = typeof action.payload === 'string' && action.payload.trim() ? action.payload.trim() : '';
      if (pendingQuery) {
        void handleSendGemini(`@local ${pendingQuery}`);
      }
    } else if (action.type === 'request_incremental_scope') {
      const scopeKey = typeof action.payload === 'string' ? action.payload : '';
      if (scopeKey) {
        fetch(`/api/auth/google/url?extra_scopes=${encodeURIComponent(scopeKey)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.authUrl) {
              window.open(d.authUrl, 'DriveTherapyScopeConsent', 'width=540,height=720,resizable=yes');
            } else if (onOpenOAuthWizard) {
              onOpenOAuthWizard();
            }
          })
          .catch(() => {
            if (onOpenOAuthWizard) onOpenOAuthWizard();
          });
      } else if (onOpenOAuthWizard) {
        onOpenOAuthWizard();
      }
    }
  };

  // --- GOOGLE CHAT HANDLERS & RESPONSE ACTIONS ---
  const handleSendChatMessage = async () => {
    if (!selectedSpace) return;
    const text = chatInputText.trim();
    if (!text && !stagedAttachment) return;

    setChatInputText('');
    const attachmentToSend = stagedAttachment ? [stagedAttachment] : undefined;
    const quoteToSend = stagedQuote || undefined;
    setStagedAttachment(null);
    setStagedQuote(null);

    const newMsg = await googleChatApi.createMessage(
      selectedSpace.name,
      text || undefined,
      undefined,
      attachmentToSend,
      quoteToSend
    );

    setChatMessages((prev) => [...prev, newMsg]);
    setTimeout(() => chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    notificationEngine.add({
      title: 'Google Chat Message Sent',
      description: `Sent message to ${selectedSpace.displayName}`,
      flag: 'complete',
      category: 'sync',
    });
  };

  const handleSelectContactFromModal = async (contact: ChatUser) => {
    const space = await googleChatApi.createOrGetDirectMessageSpace(contact);
    await loadChatSpaces();
    setSelectedSpace(space);
    setTimeout(() => chatInputRef.current?.focus(), 150);
  };

  const handleToggleReaction = async (messageName: string, emoji: string) => {
    if (!selectedSpace) return;
    const updated = await googleChatApi.toggleReaction(selectedSpace.name, messageName, emoji);
    if (updated) {
      setChatMessages((prev) => prev.map((m) => (m.name === messageName ? updated : m)));
    }
  };

  const handleCopyMessageText = (msg: GChatMessage) => {
    if (msg.text) {
      navigator.clipboard.writeText(msg.text);
      notificationEngine.add({
        title: 'Copied to Clipboard',
        description: 'Google Chat message text copied',
        flag: 'complete',
        category: 'sync',
      });
    }
  };

  const handleQuoteReply = (msg: GChatMessage) => {
    setStagedQuote({
      sender: msg.sender?.displayName || 'Contact',
      text: msg.text || 'Card Attachment',
    });
    chatInputRef.current?.focus();
  };

  const handleEmailViaGmail = (msg: GChatMessage) => {
    const subject = `Google Chat Thread: ${selectedSpace?.displayName || 'Workspace Communication'}`;
    const body = `Sender: ${msg.sender?.displayName || 'User'}\nSent: ${msg.createTime}\n\nMessage:\n${msg.text || '[Deliverable Attachment]'}\n\n-- Sent via Drive Therapy G. Comms`;
    const url = googleWorkspaceMessenger.buildGmailComposeUrl({ subject, body });
    window.open(url, '_blank');
  };

  const handleTranslateMessage = async (msg: GChatMessage) => {
    const targetLang = typeof currentLanguage === 'string' ? currentLanguage : 'English';
    const translated = await googleChatApi.translateMessage(msg.text || '', targetLang);
    setChatMessages((prev) =>
      prev.map((m) =>
        m.name === msg.name
          ? {
              ...m,
              translation: {
                targetLang,
                translatedText: translated,
                isVisible: true,
              },
            }
          : m
      )
    );
  };

  const handleDownloadMessage = (msg: GChatMessage) => {
    const filename = `chat_message_${Date.now()}.txt`;
    const content = `Google Chat Message\nSpace: ${selectedSpace?.displayName}\nSender: ${msg.sender?.displayName}\nDate: ${msg.createTime}\n\n${msg.text || ''}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleShareMessage = async (msg: GChatMessage) => {
    const res = await googleWorkspaceMessenger.shareViaSystem({
      title: `Google Chat — ${selectedSpace?.displayName || 'Message'}`,
      text: msg.text || 'Deliverable from Google Chat',
      url: window.location.href,
    });
    notificationEngine.add({
      title: res === 'shared' ? 'Shared via System' : 'Link Copied',
      description: 'Google Chat message dispatched',
      flag: 'complete',
      category: 'sync',
    });
  };

  const handleConfirmForward = async (targetSpace: ChatSpace) => {
    if (!forwardModalMessage) return;
    await googleChatApi.forwardMessage(forwardModalMessage, targetSpace.name);
    notificationEngine.add({
      title: 'Message Forwarded',
      description: `Forwarded to ${targetSpace.displayName}`,
      flag: 'complete',
      category: 'sync',
    });
  };

  const handleInsertMeetVideoCall = async () => {
    if (!selectedSpace) return;
    setIsVideoMenuOpen(false);

    const meetUrl = 'https://meet.google.com/new';
    const cardPayload = [
      {
        card: {
          header: {
            title: 'Google Meet Video Review',
            subtitle: 'Instant Client Review Call • HD Video & Screen Sharing',
          },
        },
      },
    ];

    const newMsg = await googleChatApi.createMessage(
      selectedSpace.name,
      `📹 I started an instant Google Meet video call: ${meetUrl}`,
      cardPayload,
      [
        {
          name: 'Google Meet Video Session',
          type: 'meet',
          url: meetUrl,
        },
      ]
    );

    setChatMessages((prev) => [...prev, newMsg]);
    setTimeout(() => chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleAttachCatalogVideo = () => {
    setIsVideoMenuOpen(false);
    const videoAsset = allAssets.find((a) => a.mediaCategory === 'video') || activeAsset;
    setStagedAttachment({
      name: videoAsset?.name || 'Shoot_Highlight_Reel.mp4',
      type: 'video',
      url: videoAsset?.cloudUrl,
      duration: '03:15',
      sizeBytes: videoAsset?.sizeBytes || 64500000,
    });
    chatInputRef.current?.focus();
  };

  const handleAttachCatalogPhoto = () => {
    setIsAttachmentMenuOpen(false);
    const photo = activeAsset || allAssets[0];
    setStagedAttachment({
      name: photo?.name || 'Deliverable_Hero_Pick.jpg',
      type: 'image',
      url: photo?.cloudUrl,
      sizeBytes: photo?.sizeBytes || 12400000,
    });
    chatInputRef.current?.focus();
  };

  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setStagedAttachment({
        name: file.name,
        type: file.type.startsWith('video') ? 'video' : file.type.startsWith('image') ? 'image' : 'document',
        sizeBytes: file.size,
      });
      chatInputRef.current?.focus();
    }
    e.target.value = '';
  };

  const handleInsertEmoji = (emoji: string) => {
    setIsEmojiMenuOpen(false);
    setChatInputText((prev) => prev + emoji);
    chatInputRef.current?.focus();
  };

  const handleSelectGif = async (gif: GifResult) => {
    if (!selectedSpace) return;
    const attachment: ChatAttachment = {
      name: gif.title,
      type: 'gif',
      url: gif.url,
      thumbnailUrl: gif.previewUrl || gif.url
    };
    await googleChatApi.createMessage(
      selectedSpace.name,
      `[GIF: ${gif.title}]`,
      undefined,
      [attachment]
    );
    loadMessagesForSpace(selectedSpace.name);
    notificationEngine.notify({
      title: 'GIF Sent',
      description: `Sent GIF to ${selectedSpace.displayName}`,
      flag: 'info'
    });
  };

  const handleAttachWorkspaceFiles = async (items: ChatAttachmentItem[]) => {
    if (!selectedSpace || items.length === 0) return;
    for (const item of items) {
      let attachmentType: ChatAttachment['type'] = 'document';
      if (item.source === 'photos' || item.mimeType.startsWith('image/')) attachmentType = 'image';
      else if (item.mimeType.startsWith('video/')) attachmentType = 'video';
      else if (item.mimeType.startsWith('audio/')) attachmentType = 'audio';
      else if (item.source === 'notebooklm') attachmentType = 'notebooklm';

      const attachment: ChatAttachment = {
        name: item.name,
        type: attachmentType,
        url: item.url,
        thumbnailUrl: item.thumbnailUrl,
        sizeBytes: item.sizeBytes,
        mimeType: item.mimeType
      };

      await googleChatApi.createMessage(
        selectedSpace.name,
        `Attached deliverable: ${item.name}`,
        undefined,
        [attachment]
      );
    }
    loadMessagesForSpace(selectedSpace.name);
    notificationEngine.notify({
      title: 'Workspace Files Attached',
      description: `Shared ${items.length} item(s) to ${selectedSpace.displayName}`,
      flag: 'success'
    });
  };

  const handleSendYoutubeVideo = async (inputStr: string) => {
    if (!selectedSpace || !inputStr.trim()) return;
    let videoId = 'dQw4w9WgXcQ';
    const match = inputStr.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (match && match[1]) {
      videoId = match[1];
    }
    const title = inputStr.includes('http') ? 'YouTube Video Preview' : `YouTube: ${inputStr}`;
    const directUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const attachment: ChatAttachment = {
      name: title,
      type: 'youtube',
      url: directUrl,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    };

    await googleChatApi.createMessage(
      selectedSpace.name,
      `Shared YouTube Video: ${title}`,
      undefined,
      [attachment]
    );
    loadMessagesForSpace(selectedSpace.name);
    setIsYoutubeModalOpen(false);
    setYoutubeQuery('');
  };

  const handleAttachDriveCardToChat = async () => {
    if (!selectedSpace) return;
    const assetToAttach = activeAsset || allAssets[0];
    const cardTitle = assetToAttach ? `Drive Therapy — ${assetToAttach.name}` : 'Drive Therapy Shoot Delivery';

    const cardPayload = [
      {
        card: {
          header: {
            title: cardTitle,
            subtitle: `${allAssets.length} Master Captures • Cloud Synced`,
          },
        },
      },
    ];

    const newMsg = await googleChatApi.createMessage(
      selectedSpace.name,
      `Shared gallery assets from Drive Therapy: ${assetToAttach?.cloudUrl || 'https://drive.google.com'}`,
      cardPayload
    );
    setChatMessages((prev) => [...prev, newMsg]);
    setTimeout(() => chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const filteredChatSpaces = chatSpaces
    .filter((s) => (isChatUnreadOnly ? (s.unreadCount || 0) > 0 : true))
    .filter((s) => {
      if (!chatSearchQuery.trim()) return true;
      const q = chatSearchQuery.toLowerCase();
      return (
        s.displayName.toLowerCase().includes(q) ||
        s.lastMessageSnippet?.toLowerCase().includes(q) ||
        s.recipient?.email?.toLowerCase().includes(q)
      );
    });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="G. Comms Workspace Hub"
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen shadow-2xl flex flex-col animate-in fade-in duration-200 select-none'
          : 'fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] md:w-[540px] max-w-full shadow-2xl flex flex-col border-l animate-in slide-in-from-right duration-200 select-none'
      }
      style={{
        backgroundColor: resolvedChatTheme.shellBg,
        borderColor: resolvedChatTheme.shellBorder,
        color: resolvedChatTheme.shellText,
      }}
    >
      {/* Drawer Header */}
      <div
        className="px-4 py-2.5 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: resolvedChatTheme.shellBorder }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsWardrobeOpen(true)}
            className="shrink-0 focus:outline-none group"
            title={`Castor (${castorConfig.outfitId} — ${getCastorOutfitById(castorConfig.outfitId).name}) · Click to open Wardrobe`}
            aria-label="Open Castor 24-Outfit Wardrobe"
          >
            {!castorSpriteFailed ? (
              <img
                src={getCastorSpriteUrl(castorConfig.outfitId, castorExpression)}
                alt={`Castor (${castorConfig.outfitId} ${castorExpression.slice(3)})`}
                onError={() => setCastorSpriteFailed(true)}
                className="w-16 h-16 object-contain overflow-visible p-0.5 drop-shadow-md transition-transform group-hover:-translate-y-0.5 group-hover:scale-105"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1074B1] to-[#52B197] flex items-center justify-center text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
            )}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold leading-tight">Castor · G. Comms</h3>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${
                  workspaceSnapshot.oauth.isSignedIn
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25'
                }`}
              >
                {workspaceSnapshot.oauth.isSignedIn
                  ? workspaceSnapshot.oauth.userEmail || 'Workspace Connected'
                  : 'Local / Offline Mode'}
              </span>
            </div>
            <p className="text-[11px] opacity-65 leading-tight truncate">
              {castorConfig.outfitId} {getCastorOutfitById(castorConfig.outfitId).name} · {castorExpression.slice(3)} • Google Chat
            </p>
          </div>
        </div>

        {/* Wardrobe, Chat Theme Customizer, Fullscreen, Meet Review Call & Close Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsWardrobeOpen(true)}
            className="px-2 py-1 rounded-lg border text-[10px] font-bold text-[#1074B1] dark:text-sky-300 border-[#1074B1]/30 bg-[#1074B1]/10 hover:bg-[#1074B1]/20 transition-colors"
            title="Open Castor Wardrobe (24 Outfits × 16 Expressions)"
          >
            {castorConfig.outfitId}
          </button>
          <button
            type="button"
            onClick={() => setIsChatThemeOpen((v) => !v)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isChatThemeOpen
                ? 'bg-[#1557B0] text-white border-[#1557B0]'
                : 'border-transparent hover:bg-black/10 dark:hover:bg-white/10 opacity-85 hover:opacity-100'
            }`}
            title="Chat Settings: Decoration Themes, 14 Swatches & Density"
            aria-label="Open Chat Decoration Settings"
            aria-expanded={isChatThemeOpen}
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isFullscreen
                ? 'bg-[#1557B0]/15 text-[#1557B0] dark:text-sky-300 border-[#1557B0]/35'
                : 'border-transparent hover:bg-black/10 dark:hover:bg-white/10 opacity-80 hover:opacity-100'
            }`}
            title={isFullscreen ? 'Exit Fullscreen Mode (Esc)' : 'Expand to Fullscreen Workspace'}
            aria-label={isFullscreen ? 'Exit Fullscreen Mode' : 'Enter Fullscreen Mode'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => window.open('https://meet.google.com/new', '_blank')}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-emerald-600 dark:text-emerald-400"
            title="Start 1-Click Google Meet Client Review Session"
            aria-label="Start Google Meet"
          >
            <Video className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors opacity-70 hover:opacity-100"
            aria-label="Close G. Comms"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Harmonized Top Tabs Switcher */}
      <div
        className="px-3 pt-1.5 flex items-center justify-between border-b shrink-0"
        style={{ borderColor: resolvedChatTheme.shellBorder }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('gemini')}
            className={`px-3 py-1.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'gemini'
                ? 'border-[#1074B1] text-[#1074B1] bg-[#1074B1]/5'
                : 'border-transparent opacity-65 hover:opacity-100'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Castor (Gemini)</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 relative ${
              activeTab === 'chat'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-500/5'
                : 'border-transparent opacity-65 hover:opacity-100'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
            <span>Google Chat</span>
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
          </button>
        </div>

        {/* Quick Chat Themes Pill + Tab-specific external web shortcut */}
        <div className="flex items-center gap-1.5 pb-1">
          <button
            type="button"
            onClick={() => setIsChatThemeOpen((v) => !v)}
            className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors ${
              isChatThemeOpen
                ? 'bg-[#1557B0] text-white border-[#1557B0]'
                : 'border-slate-300/60 dark:border-slate-700/80 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
            title="Open Chat Decoration Themes, Swatches & Density"
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Themes</span>
          </button>
          {activeTab === 'chat' && (
            <button
              onClick={() => window.open('https://chat.google.com/', '_blank')}
              className="p-1 rounded-md opacity-60 hover:opacity-100"
              title="Open full Google Chat web app"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* [WO-099] Chat Theme, Swatches & Bubble Decorations Customizer (Shared by Castor & Google Chat) */}
      <ChatThemeCustomizerPopover
        isOpen={isChatThemeOpen}
        prefs={chatDecorationPrefs}
        onChange={handleUpdateChatDecoration}
        onClose={() => setIsChatThemeOpen(false)}
      />

      {/* ======================================================== */}
      {/* TAB 1: GEMINI COPILOT (Multi-Format AI Assistant)        */}
      {/* ======================================================== */}
      {activeTab === 'gemini' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Live Harmonized Context Strip: Indexes • Storage • Workspace OAuth */}
          <div
            className="px-3 py-2 border-b flex flex-wrap items-center gap-1.5 shrink-0 text-[10px]"
            style={{
              backgroundColor: 'var(--theme-surface-sunken, rgba(0,0,0,0.02))',
              borderColor: 'var(--theme-border)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (workspaceSnapshot.index.totalAssets === 0 && onStartQuickScan) {
                  onStartQuickScan();
                } else {
                  handleSendGemini('Give me a summary of my search index and top folders');
                }
              }}
              className="px-2 py-1 rounded-lg border font-semibold flex items-center gap-1 hover:bg-black/5 dark:hover:bg-white/10 transition-colors tabular-nums"
              style={{ borderColor: 'var(--theme-border)' }}
              title="Live Hybrid Search Index status"
            >
              <Database className="w-3 h-3 text-[#1074B1]" />
              <span>
                {workspaceSnapshot.index.totalAssets > 0
                  ? `Index: ${workspaceSnapshot.index.totalAssets.toLocaleString()} (${workspaceSnapshot.index.uniqueTokens.toLocaleString()} tok)`
                  : 'Index: Empty (Quick Scan)'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => (onOpenStorageSettings ? onOpenStorageSettings() : handleSendGemini('Audit my storage and Drive quota'))}
              className="px-2 py-1 rounded-lg border font-semibold flex items-center gap-1 hover:bg-black/5 dark:hover:bg-white/10 transition-colors tabular-nums"
              style={{ borderColor: 'var(--theme-border)' }}
              title="Storage providers & Google Drive quota"
            >
              <HardDrive className="w-3 h-3 text-sky-500" />
              <span>
                {workspaceSnapshot.storage.driveQuota
                  ? `Drive ${workspaceSnapshot.storage.driveQuota.percentage}% (${formatBytesCompact(workspaceSnapshot.storage.driveQuota.usage)})`
                  : `${workspaceSnapshot.storage.enabledBackends.length} Storage Backends`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => (onOpenOAuthWizard ? onOpenOAuthWizard() : handleSendGemini('Check my Google Workspace OAuth status and scopes'))}
              className={`px-2 py-1 rounded-lg border font-semibold flex items-center gap-1 transition-colors ${
                workspaceSnapshot.oauth.isSignedIn
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15'
              }`}
              title="Google Workspace OAuth setup & granted capabilities"
            >
              {workspaceSnapshot.oauth.isSignedIn ? (
                <ShieldCheck className="w-3 h-3" />
              ) : (
                <ShieldAlert className="w-3 h-3" />
              )}
              <span>
                {workspaceSnapshot.oauth.isSignedIn
                  ? `OAuth: ${workspaceSnapshot.oauth.activeCapabilities.length} active`
                  : 'Connect Workspace'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !localSearchPermitted;
                setLocalSearchPermitted(next);
                saveCastorLocalPermission(next);
              }}
              className={`px-2 py-1 rounded-lg border font-semibold flex items-center gap-1 transition-colors ${
                localSearchPermitted
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'opacity-75 hover:opacity-100'
              }`}
              style={!localSearchPermitted ? { borderColor: 'var(--theme-border)' } : undefined}
              title="Toggle Castor read-only Local OS drive search permission (@local)"
            >
              <FolderPlus className="w-3 h-3" />
              <span>{localSearchPermitted ? 'Local: Live' : 'Local: Off'}</span>
            </button>

            {onOpenMulticloudSync && (
              <button
                type="button"
                onClick={onOpenMulticloudSync}
                className="px-2 py-1 rounded-lg border font-semibold flex items-center gap-1 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                style={{ borderColor: 'var(--theme-border)' }}
                title="Open Multicloud Direct Cloud-to-Cloud Sync (Photos → Drive)"
              >
                <RefreshCw className="w-3 h-3 text-[#1074B1]" />
                <span>Multicloud</span>
              </button>
            )}

            <span
              className="px-2 py-1 rounded-lg border font-semibold flex items-center gap-1 opacity-75 ml-auto"
              style={{ borderColor: 'var(--theme-border)' }}
              title="Active Gemini execution engine"
            >
              <Cpu className="w-3 h-3 text-violet-500" />
              <span>{geminiUniversalEngine.hasApiKey() ? 'BYOK Gemini' : 'Hybrid / Local'}</span>
            </span>
          </div>

          {/* Messages Scroll Stream (with unique readable Chat-adapted backdrop & fullscreen centering) */}
          <div
            className={`flex-1 overflow-y-auto p-4 ${resolvedChatTheme.messageGapClass}`}
            style={{
              backgroundColor: resolvedChatTheme.canvasBgColor,
              backgroundImage: resolvedChatTheme.canvasBgImage,
              backgroundSize: '100% 100%, 100% 100%, 22px 22px',
            }}
          >
            <div className={isFullscreen ? `max-w-4xl mx-auto w-full ${resolvedChatTheme.messageGapClass}` : resolvedChatTheme.messageGapClass}>
            {geminiMessages.map((msg) => {
              const msgOutfitId = msg.castorOutfitId || castorConfig.outfitId;
              const msgExprId = msg.castorExpression || '02_Happy';
              return (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender === 'user' ? 'justify-end' : 'items-end gap-2.5'
                } animate-in fade-in duration-150`}
              >
                {msg.sender !== 'user' && !castorSpriteFailed && (
                  <img
                    src={getCastorSpriteUrl(msgOutfitId, msgExprId)}
                    alt={`Castor (${msgOutfitId} ${msgExprId.slice(3)})`}
                    onError={() => setCastorSpriteFailed(true)}
                    className="w-20 h-20 object-contain overflow-visible p-0.5 shrink-0 drop-shadow-md self-end"
                    title={`Castor · ${msgOutfitId} · ${msgExprId.slice(3)}`}
                  />
                )}
                <div
                  className={`flex flex-col min-w-0 ${
                    msg.sender === 'user' ? 'items-end max-w-[90%]' : 'items-start flex-1'
                  }`}
                >
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] opacity-70">
                  {msg.sender === 'user' ? (
                    <>
                      <span>{workspaceSnapshot.oauth.userName || 'You'}</span>
                      <UserIcon className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      <span className="font-bold" style={{ color: resolvedChatTheme.accentColor }}>Castor</span>
                      <span>· {msgOutfitId} · {msgExprId.slice(3)}</span>
                      {msg.modelUsed && <span className="opacity-75 truncate max-w-[160px]">· {msg.modelUsed}</span>}
                    </>
                  )}
                </div>

                {msg.attachedAsset && (
                  <div
                    className="mb-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 border shadow-2xs max-w-xs truncate"
                    style={{
                      backgroundColor: 'var(--theme-surface-sunken, rgba(0,0,0,0.03))',
                      borderColor: resolvedChatTheme.shellBorder,
                    }}
                  >
                    <Camera className="w-3.5 h-3.5 text-sky-500" />
                    <span className="truncate">{msg.attachedAsset.name}</span>
                  </div>
                )}

                <div
                  className={`relative ${resolvedChatTheme.bubblePaddingClass} rounded-2xl text-xs max-w-full leading-relaxed whitespace-pre-wrap ${
                    msg.sender === 'user'
                      ? 'rounded-br-xs shadow-sm'
                      : 'border rounded-bl-xs'
                  }`}
                  style={
                    msg.sender === 'user'
                      ? {
                          background: resolvedChatTheme.userBubbleBg,
                          color: resolvedChatTheme.userBubbleText,
                        }
                      : {
                          backgroundColor: resolvedChatTheme.peerBubbleBg,
                          borderColor: resolvedChatTheme.peerBubbleBorder,
                          color: resolvedChatTheme.peerBubbleText,
                          boxShadow: resolvedChatTheme.peerBubbleShadow,
                        }
                  }
                >
                  {msg.sender !== 'user' && (
                    <ChatBubbleOrnaments
                      decorationId={chatDecorationPrefs.decorationId}
                      enabled={chatDecorationPrefs.showOrnaments}
                    />
                  )}
                  {msg.sender === 'assistant' ? renderCastorMarkdown(msg.text) : msg.text}

                  {msg.stylizedPreview && (
                    <div
                      className="mt-2.5 p-2 rounded-xl border space-y-2"
                      style={{
                        backgroundColor: 'var(--theme-surface-sunken, rgba(0,0,0,0.04))',
                        borderColor: 'var(--theme-border)',
                      }}
                    >
                      <img
                        src={msg.stylizedPreview.dataUrl}
                        alt={`${msg.stylizedPreview.style} stylized preview of ${msg.stylizedPreview.sourceName}`}
                        className="w-full max-h-60 object-contain rounded-lg border"
                        style={{ borderColor: 'var(--theme-border)' }}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                          Non-Destructive {msg.stylizedPreview.style} Copy
                        </span>
                        <a
                          href={msg.stylizedPreview.dataUrl}
                          download={`${msg.stylizedPreview.sourceName.replace(/\.[^/.]+$/, '')}_${msg.stylizedPreview.style}.png`}
                          className="px-2.5 py-1 rounded-lg bg-[#1074B1] text-white text-[11px] font-bold flex items-center gap-1 hover:opacity-95"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download Copy</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {msg.matchedAssets && msg.matchedAssets.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t flex flex-wrap gap-1.5" style={{ borderColor: 'var(--theme-border)' }}>
                      {msg.matchedAssets.slice(0, 6).map((hit) => {
                        const isAlreadySynced = existingCatalogIds.has(hit.id) || syncedSessionIds.has(hit.id);
                        return (
                          <div key={hit.id} className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAttachment(hit);
                                if (onOpenEditor) onOpenEditor(hit);
                              }}
                              className="px-2 py-1 rounded-lg border text-[10px] font-semibold flex items-center gap-1 hover:bg-black/5 dark:hover:bg-white/10 transition-colors max-w-[175px]"
                              style={{ borderColor: 'var(--theme-border)' }}
                              title={`Inspect & attach ${hit.name} (${hit.path || hit.source})`}
                            >
                              <Camera className="w-3 h-3 text-[#1074B1] shrink-0" />
                              <span className="truncate">{hit.name}</span>
                            </button>
                            {onSyncAssetsToCatalog && (
                              <button
                                type="button"
                                onClick={() => !isAlreadySynced && handleSyncAssets([hit])}
                                disabled={isAlreadySynced}
                                className={`px-1.5 py-1 rounded-lg border text-[10px] font-bold transition-colors ${
                                  isAlreadySynced
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'border-[#1074B1]/30 bg-[#1074B1]/10 text-[#1074B1] dark:text-sky-300 hover:bg-[#1074B1]/20'
                                }`}
                                title={isAlreadySynced ? 'Synced in local catalog' : `Sync ${hit.name} into local catalog`}
                              >
                                {isAlreadySynced ? '✓' : '+ Sync'}
                              </button>
                            )}
                            {hit.cloudUrl && (
                              <a
                                href={hit.cloudUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded-lg border hover:bg-black/5 dark:hover:bg-white/10"
                                style={{ borderColor: 'var(--theme-border)' }}
                                title={`Open ${hit.name} in Google Drive / Photos`}
                                aria-label={`Open ${hit.name} externally`}
                              >
                                <ExternalLink className="w-3 h-3 text-sky-500" />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {msg.requestedActions && msg.requestedActions.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t space-y-1.5" style={{ borderColor: 'var(--theme-border)' }}>
                      {msg.requestedActions.map((act) => (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => handleRunSuggestedAction(act, msg.attachedAsset)}
                          className={`w-full py-1.5 px-3 rounded-xl text-left text-xs font-bold flex items-center justify-between gap-2 border transition-colors ${
                            act.kind === 'access_request'
                              ? 'bg-amber-500/15 border-amber-500/35 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25'
                              : act.kind === 'user_action'
                                ? 'bg-[#1074B1]/12 border-[#1074B1]/30 text-[#1074B1] dark:text-sky-300 hover:bg-[#1074B1]/20'
                                : 'hover:bg-black/5 dark:hover:bg-white/10'
                          }`}
                          style={act.kind === 'navigation' ? { borderColor: 'var(--theme-border)' } : undefined}
                        >
                          <span className="flex flex-col min-w-0">
                            <span className="truncate">{act.label}</span>
                            {act.description && (
                              <span className="text-[10px] font-normal opacity-75 truncate">{act.description}</span>
                            )}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}

                  {msg.suggestedAction && (
                    <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => handleRunSuggestedAction(msg.suggestedAction!, msg.attachedAsset)}
                        className="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-[#1074B1] to-[#52B197] hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-transform active:scale-98"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{msg.suggestedAction.label}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                </div>
              </div>
              );
            })}

            {isGeminiProcessing && (
              <div className="flex items-end gap-2.5">
                {!castorSpriteFailed && (
                  <img
                    src={getCastorSpriteUrl(castorConfig.outfitId, '15_Curious')}
                    alt="Castor thinking"
                    className="w-16 h-16 object-contain overflow-visible p-0.5 shrink-0 drop-shadow-md animate-bounce"
                  />
                )}
                <div className="flex items-center gap-2 p-3 rounded-2xl theme-card border text-xs animate-pulse max-w-xs">
                  <Sparkles className="w-4 h-4 text-[#BEBF61] animate-spin shrink-0" />
                  <span>Castor is querying your index, storage &amp; Workspace context...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Quick Prompts Pills */}
          <div
            className="px-4 py-2 border-t overflow-x-auto flex items-center gap-1.5 shrink-0 scrollbar-none"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <button
              type="button"
              onClick={() => handleSendGemini('Make the selected photo anime style')}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <Wand2 className="w-3 h-3 text-violet-500" />
              <span>Anime Style</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendGemini('Please locate copies of my resume in Google Drive')}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <Search className="w-3 h-3 text-sky-500" />
              <span>Find in Drive</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendGemini('Find a picture of a cat in my Google Photos')}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <Camera className="w-3 h-3 text-amber-500" />
              <span>Search Photos</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendGemini('Audit my storage quota, enabled providers, and largest indexed files')}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <HardDrive className="w-3 h-3 text-sky-500" />
              <span>Storage Audit</span>
            </button>
            <button
              type="button"
              onClick={() => handleSendGemini('Check my Google Workspace OAuth status and granted scopes')}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span>Workspace OAuth</span>
            </button>
          </div>

          {/* Input Box with Live @ / ! Command Autocomplete Popover */}
          <div
            className="p-3 border-t shrink-0 flex flex-col gap-2 relative"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            {commandSuggestions.length > 0 && (
              <div
                className="absolute bottom-full left-3 right-3 mb-1.5 rounded-2xl border shadow-xl overflow-hidden z-20 max-h-56 overflow-y-auto"
                style={{
                  backgroundColor: 'var(--theme-surface)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider opacity-60 border-b" style={{ borderColor: 'var(--theme-border)' }}>
                  Castor Commands (`@` Sources · `/` Actions · `!` Instant)
                </div>
                {commandSuggestions.map((cmd) => (
                  <button
                    key={cmd.trigger}
                    type="button"
                    onClick={() => {
                      setGeminiInput(`${cmd.trigger} `);
                      inputRef.current?.focus();
                    }}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between gap-2 transition-colors"
                  >
                    <span className="font-mono font-bold text-[#1074B1] dark:text-sky-300 shrink-0">
                      {cmd.usage}
                    </span>
                    <span className="text-[11px] opacity-70 truncate">{cmd.description}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedAttachment && (
              <div
                className="px-2.5 py-1 rounded-lg border text-[11px] flex items-center justify-between gap-2"
                style={{
                  backgroundColor: 'var(--theme-surface-sunken, rgba(0,0,0,0.03))',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Paperclip className="w-3 h-3 text-[#1074B1] shrink-0" />
                  <span className="truncate font-medium">Attached: {selectedAttachment.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAttachment(null)}
                  className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
                  aria-label="Remove attached asset"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendGemini();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={geminiInput}
                onChange={(e) => setGeminiInput(e.target.value)}
                placeholder="Ask Castor or type @drive, @photos, @gmail, @local, /help, !picker..."
                className="w-full px-3 py-2 text-xs rounded-xl border focus:border-[#1074B1] focus:outline-none transition-all"
                style={{
                  backgroundColor: 'var(--theme-surface)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text)',
                }}
              />
              <button
                type="submit"
                disabled={isGeminiProcessing || (!geminiInput.trim() && !selectedAttachment)}
                className="p-2 rounded-xl bg-[#1074B1] hover:bg-[#1074B1]/90 disabled:opacity-40 text-white shadow-xs transition-transform active:scale-95 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: GOOGLE CHAT (Authentic Image Attachment 3 Parity)  */}
      {/* ======================================================== */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Subheader: Home • Unread Toggle • Thread Pill • New Chat '+' (Image 3) */}
          <div
            className="px-4 py-2 border-b flex items-center justify-between shrink-0 text-xs"
            style={{
              backgroundColor: 'var(--theme-surface-sunken, rgba(0,0,0,0.02))',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-sm">Home</span>
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[11px] opacity-70">Unread</span>
                <button
                  onClick={() => setIsChatUnreadOnly(!isChatUnreadOnly)}
                  className={`w-7 h-4 rounded-full transition-colors relative ${
                    isChatUnreadOnly ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  aria-label="Toggle Unread Messages"
                >
                  <span
                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                      isChatUnreadOnly ? 'left-3.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold opacity-75">
                <Clock className="w-3 h-3" />
                <span>Thread</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsContactModalOpen(true)}
                className="px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 text-[11px] font-bold flex items-center gap-1"
                title="Start a new chat or search contacts"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Chat</span>
              </button>

              <button
                onClick={loadChatSpaces}
                className="p-1 rounded-md opacity-60 hover:opacity-100"
                title="Refresh spaces from chat.googleapis.com"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChatLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => setIsChatThemeOpen((v) => !v)}
                className={`p-1 rounded-md transition-colors ${
                  isChatThemeOpen
                    ? 'bg-[#1557B0] text-white'
                    : 'opacity-75 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10'
                }`}
                title="Google Chat Appearance & Decoration Settings"
                aria-label="Google Chat Appearance Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Split / Stacked View: Spaces List & Active Conversation */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Conversation Spaces List (Left Column — expands nicely in Fullscreen Mode) */}
            <div
              className={`${
                isFullscreen ? 'w-64 md:w-80' : 'w-48 sm:w-56'
              } border-r flex flex-col min-h-0 select-none shrink-0 transition-all`}
              style={{
                borderColor: resolvedChatTheme.shellBorder,
                backgroundColor: resolvedChatTheme.shellBg,
              }}
            >
              {/* Space Search Filter Bar */}
              <div className="p-2 border-b" style={{ borderColor: 'var(--theme-border)' }}>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2 top-2 opacity-50" />
                  <input
                    type="text"
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    placeholder="Search spaces or contacts..."
                    className="w-full pl-7 pr-2 py-1 text-[11px] rounded-lg border focus:border-sky-500 focus:outline-none"
                    style={{
                      backgroundColor: 'var(--theme-surface)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text)',
                    }}
                  />
                </div>
              </div>

              {/* Spaces Scroll List */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {filteredChatSpaces.map((space) => {
                  const active = selectedSpace?.name === space.name;
                  return (
                    <button
                      key={space.name}
                      onClick={() => setSelectedSpace(space)}
                      className={`w-full p-2.5 border-b text-left transition-colors flex items-start gap-2.5 ${
                        active
                          ? 'bg-sky-500/10 dark:bg-sky-500/20'
                          : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                      style={{ borderColor: 'var(--theme-border)' }}
                    >
                      {/* Circle Avatar with Initial (Image 3) */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs relative"
                        style={{ backgroundColor: space.avatarColor || '#1074B1' }}
                      >
                        {space.avatarLetter || 'G'}
                        {space.recipient?.isOnline && (
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-xs truncate">{space.displayName}</span>
                          <span className="text-[10px] opacity-60 shrink-0">{space.lastMessageTime}</span>
                        </div>
                        <p className="text-[11px] opacity-65 truncate mt-0.5">{space.lastMessageSnippet}</p>
                      </div>
                    </button>
                  );
                })}

                {filteredChatSpaces.length === 0 && (
                  <div className="text-center py-8 opacity-60 text-xs px-2">
                    No conversations found. Click &quot;+ New Chat&quot; to message a contact.
                  </div>
                )}
              </div>
            </div>

            {/* Active Thread Message Stream (Right Column, Image 3) */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Space Header */}
              {selectedSpace && (
                <div
                  className="px-3 py-2 border-b flex items-center justify-between shrink-0"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-xs truncate">{selectedSpace.displayName}</span>
                    <span className="text-[10px] opacity-60">• Google Chat Space</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleInsertMeetVideoCall}
                      className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-bold flex items-center gap-1"
                      title="Start instant Google Meet video call"
                    >
                      <Video className="w-3 h-3" />
                      <span>Meet Call</span>
                    </button>
                    <button
                      onClick={handleAttachDriveCardToChat}
                      className="px-2 py-0.5 rounded-lg bg-[#1074B1]/10 text-[#1074B1] hover:bg-[#1074B1]/20 text-[10px] font-bold flex items-center gap-1"
                      title="Attach active Drive photo review card"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Attach Asset</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Messages list with unique readable Chat-adapted backdrop, Hover Actions & Context Menu */}
              <div
                className={`flex-1 overflow-y-auto p-3.5 text-xs ${resolvedChatTheme.messageGapClass}`}
                style={{
                  backgroundColor: resolvedChatTheme.canvasBgColor,
                  backgroundImage: resolvedChatTheme.canvasBgImage,
                  backgroundSize: '100% 100%, 100% 100%, 22px 22px',
                }}
              >
                <div className={isFullscreen ? `max-w-4xl mx-auto w-full ${resolvedChatTheme.messageGapClass}` : resolvedChatTheme.messageGapClass}>
                {chatMessages.map((msg, idx) => {
                  const isHovered = hoveredMessageName === msg.name;

                  return (
                    <div
                      key={msg.name || idx}
                      onMouseEnter={() => setHoveredMessageName(msg.name)}
                      onMouseLeave={() => setHoveredMessageName(null)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenuState({
                          isOpen: true,
                          position: { x: e.clientX, y: e.clientY },
                          message: msg,
                        });
                      }}
                      className={`flex flex-col relative group ${
                        msg.isOutgoing ? 'items-end' : 'items-start'
                      } animate-in fade-in duration-100`}
                    >
                      {/* Sender metadata & Time */}
                      <div className="flex items-center gap-1.5 mb-0.5 text-[10px] opacity-70 px-1">
                        <span className="font-semibold">{msg.sender?.displayName || 'Workspace Member'}</span>
                        <span>•</span>
                        <span>
                          {new Date(msg.createTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Hover Action Toolbar */}
                      {isHovered && (
                        <div
                          className={`absolute -top-7 z-20 flex items-center gap-0.5 p-1 rounded-xl shadow-lg border backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ${
                            msg.isOutgoing ? 'right-0' : 'left-0'
                          }`}
                          style={{
                            backgroundColor: 'var(--theme-surface)',
                            borderColor: 'var(--theme-border)',
                          }}
                        >
                          {/* Quick Emoji Reactions */}
                          {['👍', '❤️', '👏', '🎉', '🚀'].map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleToggleReaction(msg.name, emoji)}
                              className="px-1 py-0.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-xs transition-transform active:scale-125"
                              title={`React ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}

                          <div className="w-[1px] h-3 bg-slate-300 dark:bg-slate-700 mx-0.5" />

                          <button
                            onClick={() => handleQuoteReply(msg)}
                            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
                            title="Quote & Reply"
                          >
                            <Quote className="w-3 h-3 text-indigo-500" />
                          </button>

                          <button
                            onClick={() => handleCopyMessageText(msg)}
                            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
                            title="Copy Text"
                          >
                            <Copy className="w-3 h-3 text-sky-500" />
                          </button>

                          <button
                            onClick={() => handleTranslateMessage(msg)}
                            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
                            title="Translate Message"
                          >
                            <Languages className="w-3 h-3 text-teal-500" />
                          </button>

                          <button
                            onClick={() => handleEmailViaGmail(msg)}
                            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
                            title="Email via Gmail"
                          >
                            <Mail className="w-3 h-3 text-rose-500" />
                          </button>

                          <button
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setContextMenuState({
                                isOpen: true,
                                position: { x: rect.right, y: rect.bottom },
                                message: msg,
                              });
                            }}
                            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
                            title="More Options"
                          >
                            <MoreHorizontal className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Main Message Bubble */}
                      <div
                        className={`relative ${resolvedChatTheme.bubblePaddingClass} rounded-2xl max-w-[85%] leading-relaxed ${
                          msg.isOutgoing
                            ? 'rounded-br-xs shadow-sm'
                            : 'border rounded-bl-xs'
                        }`}
                        style={
                          msg.isOutgoing
                            ? {
                                background: resolvedChatTheme.userBubbleBg,
                                color: resolvedChatTheme.userBubbleText,
                              }
                            : {
                                backgroundColor: resolvedChatTheme.peerBubbleBg,
                                borderColor: resolvedChatTheme.peerBubbleBorder,
                                color: resolvedChatTheme.peerBubbleText,
                                boxShadow: resolvedChatTheme.peerBubbleShadow,
                              }
                        }
                      >
                        {!msg.isOutgoing && (
                          <ChatBubbleOrnaments
                            decorationId={chatDecorationPrefs.decorationId}
                            enabled={chatDecorationPrefs.showOrnaments}
                          />
                        )}
                        {/* Quoted Reply Banner */}
                        {msg.quotedMessage && (
                          <div className="mb-2 p-2 rounded-xl bg-black/10 dark:bg-white/10 border-l-2 border-sky-400 text-[11px] opacity-90 space-y-0.5">
                            <span className="font-bold opacity-75">{msg.quotedMessage.sender}</span>
                            <p className="truncate line-clamp-2 italic">{msg.quotedMessage.text}</p>
                          </div>
                        )}

                        {/* Text Content */}
                        {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

                        {/* Google Meet Video Meeting Card */}
                        {msg.attachments?.some((a) => a.type === 'meet') && (
                          <div className="mt-2.5 p-3 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-between gap-3 text-slate-800 dark:text-slate-100">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                                <Video className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-bold text-xs">Google Meet Video Meeting</div>
                                <div className="text-[10px] opacity-75">Instant review session ready</div>
                              </div>
                            </div>
                            <button
                              onClick={() => window.open(msg.attachments?.find((a) => a.type === 'meet')?.url || 'https://meet.google.com/new', '_blank')}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-transform active:scale-95 shrink-0"
                            >
                              <span>Join Call</span>
                            </button>
                          </div>
                        )}

                        {/* Video Asset Deliverable Card */}
                        {msg.attachments?.some((a) => a.type === 'video') && (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-white/10 dark:bg-black/20 border border-white/20 flex items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2 truncate">
                              <div className="w-7 h-7 rounded-lg bg-sky-500 text-white flex items-center justify-center shrink-0">
                                <Play className="w-3.5 h-3.5 fill-white" />
                              </div>
                              <div className="truncate">
                                <div className="font-bold text-xs truncate">
                                  {msg.attachments?.find((a) => a.type === 'video')?.name}
                                </div>
                                <div className="text-[10px] opacity-75">
                                  {msg.attachments?.find((a) => a.type === 'video')?.duration || '02:45'} • Video Proof
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDownloadMessage(msg)}
                              className="p-1 rounded-lg hover:bg-white/10 text-xs"
                              title="Download video deliverable"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Image / Document File Attachment */}
                        {msg.attachments?.some((a) => a.type === 'image' || a.type === 'document') && (
                          <div className="mt-2 p-2 rounded-xl bg-white/10 dark:bg-black/20 border border-white/20 flex items-center gap-2">
                            <Paperclip className="w-3.5 h-3.5 text-sky-400" />
                            <span className="text-[11px] font-medium truncate">
                              {msg.attachments?.find((a) => a.type === 'image' || a.type === 'document')?.name}
                            </span>
                          </div>
                        )}

                        {/* Animated GIF Attachment */}
                        {msg.attachments?.some((a) => a.type === 'gif') && (
                          <div className="mt-2 rounded-xl overflow-hidden border border-white/20 shadow-md">
                            <img
                              src={msg.attachments.find((a) => a.type === 'gif')?.url}
                              alt={msg.attachments.find((a) => a.type === 'gif')?.name || 'GIF'}
                              className="max-w-full max-h-56 rounded-lg object-cover w-full"
                              loading="lazy"
                            />
                          </div>
                        )}

                        {/* YouTube Video Player / Preview Card */}
                        {msg.attachments?.some((a) => a.type === 'youtube') && (
                          <div className="mt-2 rounded-xl overflow-hidden border border-red-500/30 bg-red-950/20 p-2 text-xs space-y-1.5">
                            <div className="relative aspect-video rounded-lg overflow-hidden bg-black flex items-center justify-center group">
                              <img
                                src={msg.attachments.find((a) => a.type === 'youtube')?.thumbnailUrl}
                                alt="YouTube Preview"
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                              />
                              <button
                                onClick={() => window.open(msg.attachments?.find((a) => a.type === 'youtube')?.url, '_blank')}
                                className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/20 transition-colors"
                              >
                                <div className="w-10 h-8 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg">
                                  <Play className="w-4 h-4 fill-white" />
                                </div>
                              </button>
                            </div>
                            <div className="flex items-center justify-between text-[11px] px-0.5">
                              <span className="font-semibold truncate text-red-300">
                                {msg.attachments.find((a) => a.type === 'youtube')?.name}
                              </span>
                              <button
                                onClick={() => window.open(msg.attachments?.find((a) => a.type === 'youtube')?.url, '_blank')}
                                className="text-red-400 hover:text-red-300 underline text-[10px]"
                              >
                                Watch
                              </button>
                            </div>
                          </div>
                        )}

                        {/* NotebookLM Dossier Attachment */}
                        {msg.attachments?.some((a) => a.type === 'notebooklm') && (
                          <div className="mt-2 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between gap-2 text-xs text-indigo-300">
                            <div className="flex items-center gap-2 truncate">
                              <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                              <span className="font-semibold truncate">{msg.attachments.find((a) => a.type === 'notebooklm')?.name}</span>
                            </div>
                            <button
                              onClick={() => {
                                const url = msg.attachments?.find((a) => a.type === 'notebooklm')?.url;
                                if (url) window.open(url, '_blank');
                              }}
                              className="px-2 py-0.5 text-[10px] rounded bg-indigo-600 text-white font-medium hover:bg-indigo-500"
                            >
                              View
                            </button>
                          </div>
                        )}

                        {/* Attached Cards V2 Representation */}
                        {msg.cardsV2 && msg.cardsV2.length > 0 && (
                          <div className="mt-2 p-2 rounded-xl bg-white/10 dark:bg-black/20 border border-white/20 text-[11px] space-y-1">
                            <p className="font-bold">{msg.cardsV2[0]?.card?.header?.title || 'Drive Therapy Card'}</p>
                            <p className="opacity-80 text-[10px]">
                              {msg.cardsV2[0]?.card?.header?.subtitle || 'Verified Gallery Deliverables'}
                            </p>
                          </div>
                        )}

                        {/* Inline Translation Card */}
                        {msg.translation?.isVisible && (
                          <div className="mt-2.5 p-2 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 border border-teal-500/30 text-teal-800 dark:text-teal-200 text-[11px] space-y-0.5">
                            <div className="flex items-center justify-between text-[10px] font-bold">
                              <span>🌐 Translated into {msg.translation.targetLang}</span>
                              <button
                                onClick={() =>
                                  setChatMessages((prev) =>
                                    prev.map((m) =>
                                      m.name === msg.name
                                        ? { ...m, translation: { ...m.translation!, isVisible: false } }
                                        : m
                                    )
                                  )
                                }
                                className="opacity-60 hover:opacity-100"
                              >
                                Hide
                              </button>
                            </div>
                            <p className="italic">{msg.translation.translatedText}</p>
                          </div>
                        )}
                      </div>

                      {/* Emoji Reactions Pills */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 px-1">
                          {msg.reactions.map((rx) => {
                            const hasReacted = rx.users.includes('You');
                            return (
                              <button
                                key={rx.emoji}
                                onClick={() => handleToggleReaction(msg.name, rx.emoji)}
                                className={`px-2 py-0.5 rounded-full text-[11px] border flex items-center gap-1 transition-all ${
                                  hasReacted
                                    ? 'bg-sky-500/15 border-sky-500 text-sky-600 dark:text-sky-400 font-bold'
                                    : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
                                }`}
                                style={{ borderColor: 'var(--theme-border)' }}
                              >
                                <span>{rx.emoji}</span>
                                <span>{rx.count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={chatMessagesEndRef} />
                </div>
              </div>

              {/* Rich Chat Composer Area */}
              <div
                className="p-2.5 border-t shrink-0 flex flex-col gap-1.5"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                {/* Active Quoted Reply Banner */}
                {stagedQuote && (
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <Quote className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span className="truncate">
                        Replying to <strong>{stagedQuote.sender}</strong>: &quot;{stagedQuote.text}&quot;
                      </span>
                    </div>
                    <button
                      onClick={() => setStagedQuote(null)}
                      className="p-0.5 rounded-md hover:bg-black/5 opacity-60 hover:opacity-100 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Active Attachment Chip */}
                {stagedAttachment && (
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300">
                    <div className="flex items-center gap-2 truncate">
                      {stagedAttachment.type === 'video' ? (
                        <Film className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <Paperclip className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      )}
                      <span className="truncate font-semibold">{stagedAttachment.name}</span>
                      {stagedAttachment.duration && (
                        <span className="text-[10px] opacity-75">({stagedAttachment.duration})</span>
                      )}
                    </div>
                    <button
                      onClick={() => setStagedAttachment(null)}
                      className="p-0.5 rounded-md hover:bg-black/5 opacity-60 hover:opacity-100 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Main Input Row with Toolbar Dropdowns */}
                <div className="flex items-center gap-1.5 relative">
                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={localFileInputRef}
                    onChange={handleLocalFileUpload}
                    className="hidden"
                  />

                  {/* 📎 Attachment Dropdown Button */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setIsAttachmentMenuOpen(!isAttachmentMenuOpen);
                        setIsVideoMenuOpen(false);
                        setIsEmojiMenuOpen(false);
                      }}
                      className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
                      title="Attach file, catalog asset, or shoot card"
                      aria-label="Attach File"
                    >
                      <Paperclip className="w-4 h-4 text-sky-500" />
                    </button>

                    {isAttachmentMenuOpen && (
                      <div
                        className="absolute bottom-11 left-0 z-30 w-52 py-1.5 rounded-2xl shadow-xl border backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 text-xs"
                        style={{
                          backgroundColor: 'var(--theme-surface)',
                          borderColor: 'var(--theme-border)',
                          color: 'var(--theme-text)',
                        }}
                      >
                        <button
                          onClick={() => {
                            setIsAttachmentMenuOpen(false);
                            setIsWorkspaceAttachOpen(true);
                          }}
                          className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left text-sky-500 font-semibold"
                        >
                          <HardDrive className="w-3.5 h-3.5" />
                          <span>Cross-Workspace Picker...</span>
                        </button>
                        <button
                          onClick={handleAttachCatalogPhoto}
                          className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left"
                        >
                          <Camera className="w-3.5 h-3.5 text-sky-500" />
                          <span>Attach Active Photo</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsAttachmentMenuOpen(false);
                            handleAttachDriveCardToChat();
                          }}
                          className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left"
                        >
                          <Plus className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Attach Deliverable Card</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsAttachmentMenuOpen(false);
                            localFileInputRef.current?.click();
                          }}
                          className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left border-t"
                          style={{ borderColor: 'var(--theme-border)' }}
                        >
                          <FileUp className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Upload Local File...</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 🎥 Video Dropdown Button */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setIsVideoMenuOpen(!isVideoMenuOpen);
                        setIsAttachmentMenuOpen(false);
                        setIsEmojiMenuOpen(false);
                      }}
                      className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors text-emerald-600 dark:text-emerald-400"
                      title="Google Meet call or video deliverables"
                      aria-label="Video Actions"
                    >
                      <Video className="w-4 h-4" />
                    </button>

                    {isVideoMenuOpen && (
                      <div
                        className="absolute bottom-11 left-0 z-30 w-56 py-1.5 rounded-2xl shadow-xl border backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 text-xs"
                        style={{
                          backgroundColor: 'var(--theme-surface)',
                          borderColor: 'var(--theme-border)',
                          color: 'var(--theme-text)',
                        }}
                      >
                        <button
                          onClick={handleInsertMeetVideoCall}
                          className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left text-emerald-600 dark:text-emerald-400 font-bold"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Start Google Meet Call</span>
                        </button>
                        <button
                          onClick={handleAttachCatalogVideo}
                          className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left border-t"
                          style={{ borderColor: 'var(--theme-border)' }}
                        >
                          <Film className="w-3.5 h-3.5 text-sky-500" />
                          <span>Attach Video from Catalog</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 😀 Emoji Dropdown Button */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setIsEmojiMenuOpen(!isEmojiMenuOpen);
                        setIsAttachmentMenuOpen(false);
                        setIsVideoMenuOpen(false);
                      }}
                      className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
                      title="Insert emoji"
                      aria-label="Insert Emoji"
                    >
                      <Smile className="w-4 h-4 text-amber-500" />
                    </button>

                    {isEmojiMenuOpen && (
                      <div
                        className="absolute bottom-11 left-0 z-30 p-2 rounded-2xl shadow-xl border backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 grid grid-cols-5 gap-1.5"
                        style={{
                          backgroundColor: 'var(--theme-surface)',
                          borderColor: 'var(--theme-border)',
                        }}
                      >
                        {['😀', '👍', '❤️', '🔥', '🎉', '🚀', '📸', '📁', '🎬', '👏'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleInsertEmoji(emoji)}
                            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-base transition-transform active:scale-125"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 🎞️ GIF Picker Button */}
                  <button
                    onClick={() => {
                      setIsGifPickerOpen(true);
                      setIsAttachmentMenuOpen(false);
                      setIsVideoMenuOpen(false);
                      setIsEmojiMenuOpen(false);
                    }}
                    className="px-2 py-1 rounded-xl hover:bg-sky-500/10 text-sky-500 border border-sky-500/30 text-[10px] font-black tracking-wider transition-colors"
                    title="Search and send GIFs (Tenor, GIPHY, KLIPY)"
                    aria-label="Send GIF"
                  >
                    GIF
                  </button>

                  {/* 📺 YouTube Video Share Button */}
                  <button
                    onClick={() => {
                      setIsYoutubeModalOpen(true);
                      setIsAttachmentMenuOpen(false);
                      setIsVideoMenuOpen(false);
                      setIsEmojiMenuOpen(false);
                    }}
                    className="p-2 rounded-xl hover:bg-red-500/10 text-red-500 opacity-80 hover:opacity-100 transition-colors"
                    title="Search & share YouTube video"
                    aria-label="Share YouTube Video"
                  >
                    <Youtube className="w-4 h-4" />
                  </button>

                  {/* Input Box */}
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={chatInputText}
                    onChange={(e) => setChatInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendChatMessage();
                    }}
                    placeholder={`Reply in ${selectedSpace?.displayName || 'Google Chat'}...`}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border focus:border-sky-500 focus:outline-none transition-all"
                    style={{
                      backgroundColor: 'var(--theme-surface)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text)',
                    }}
                  />

                  {/* Send Button */}
                  <button
                    onClick={handleSendChatMessage}
                    disabled={!chatInputText.trim() && !stagedAttachment}
                    className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white shadow-xs transition-transform active:scale-95 shrink-0"
                    title="Send message"
                    aria-label="Send message"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* GOOGLE CHAT MODALS & CONTEXT MENUS                       */}
      {/* ======================================================== */}
      <GoogleChatMessageContextMenu
        isOpen={contextMenuState.isOpen}
        position={contextMenuState.position}
        message={contextMenuState.message}
        onClose={() => setContextMenuState({ isOpen: false, position: { x: 0, y: 0 }, message: null })}
        onCopyText={handleCopyMessageText}
        onQuoteReply={handleQuoteReply}
        onShowDetails={(msg) => setDetailsModalMessage(msg)}
        onForward={(msg) => setForwardModalMessage(msg)}
        onEmailGmail={handleEmailViaGmail}
        onTranslate={handleTranslateMessage}
        onDownload={handleDownloadMessage}
        onShare={handleShareMessage}
      />

      <GoogleChatMessageDetailsModal
        isOpen={!!detailsModalMessage}
        message={detailsModalMessage}
        spaceName={selectedSpace?.displayName || 'Google Chat Space'}
        onClose={() => setDetailsModalMessage(null)}
      />

      <GoogleChatForwardModal
        isOpen={!!forwardModalMessage}
        message={forwardModalMessage}
        spaces={chatSpaces}
        onClose={() => setForwardModalMessage(null)}
        onConfirmForward={handleConfirmForward}
      />

      <GoogleChatContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        onSelectContact={handleSelectContactFromModal}
      />

      {/* GIF Picker Modal */}
      <GoogleChatGifPickerModal
        isOpen={isGifPickerOpen}
        onClose={() => setIsGifPickerOpen(false)}
        onSelectGif={handleSelectGif}
      />

      {/* Cross-Workspace Attachment Modal */}
      <GoogleChatWorkspaceAttachModal
        isOpen={isWorkspaceAttachOpen}
        onClose={() => setIsWorkspaceAttachOpen(false)}
        onAttach={handleAttachWorkspaceFiles}
      />

      {/* YouTube Video Search/Share Modal */}
      {isYoutubeModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsYoutubeModalOpen(false)}
        >
          <div 
            className="w-full max-w-md bg-[var(--theme-surface,#181b22)] border border-[var(--theme-border,#2e3440)] rounded-2xl shadow-2xl overflow-hidden p-5 text-[var(--theme-text,#eceff4)] space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-red-500/10 text-red-500">
                  <Youtube className="w-5 h-5" />
                </span>
                <span className="font-semibold text-sm">Share YouTube Video</span>
              </div>
              <button 
                onClick={() => setIsYoutubeModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--theme-border,#2e3440)] text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--theme-text-secondary,#94a3b8)]">
              Paste a YouTube URL or enter a title/topic to attach an interactive video player card to {selectedSpace?.displayName || 'Google Chat'}.
            </p>

            <div className="space-y-2">
              <input
                type="text"
                value={youtubeQuery}
                onChange={(e) => setYoutubeQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendYoutubeVideo(youtubeQuery);
                }}
                placeholder="https://youtube.com/watch?v=... or topic"
                className="w-full px-3 py-2 rounded-xl bg-[var(--theme-surface-deep,#0d1117)] border border-[var(--theme-border,#2e3440)] text-xs focus:outline-none focus:border-red-500"
                autoFocus
              />

              <div className="flex flex-wrap gap-1.5 pt-1">
                {['Color Grading Sony FX3', 'Drive Therapy Overview', 'Camera Rig Setup', 'Ambient Studio Music'].map(topic => (
                  <button
                    key={topic}
                    onClick={() => setYoutubeQuery(topic)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--theme-border,#2e3440)]/40 hover:bg-[var(--theme-border,#2e3440)] text-[var(--theme-text-secondary,#94a3b8)]"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--theme-border,#2e3440)]">
              <button
                onClick={() => setIsYoutubeModalOpen(false)}
                className="px-3 py-1.5 text-xs rounded-xl hover:bg-[var(--theme-border,#2e3440)] text-[var(--theme-text-secondary,#94a3b8)]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSendYoutubeVideo(youtubeQuery)}
                disabled={!youtubeQuery.trim()}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white shadow-sm transition-colors"
              >
                Share Video
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Castor 24-Outfit × 16-Expression Wardrobe Modal */}
      <CastorWardrobeModal
        isOpen={isWardrobeOpen}
        onClose={() => setIsWardrobeOpen(false)}
        config={castorConfig}
        activeExpression={castorExpression}
        onUpdateConfig={handleUpdateCastorConfig}
        onPreviewExpression={(exprId) => setCastorExpression(exprId)}
      />
    </div>
  );
};
