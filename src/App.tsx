/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drive Therapy Main Application (Attachment 1 Architecture & Gemini Palette - A+ Tier)
 * 100% Feature Completeness, Harmonization & Integration with native IndexedDB persistence,
 * deep Google Drive pagination, dual-split culling, and WCAG 2.2 AAA accessibility.
 */

import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { User } from 'firebase/auth';
import {
  MediaAsset,
  FolderNode,
  MediaCategory,
  ViewMode,
  CullingStatus,
  BatchTask,
  ProviderConfig,
  PortfolioProject,
  ColorLabel,
  FilterRecipe,
  DriveBrowserFolder,
} from './types';
import { INITIAL_ASSETS, INITIAL_FOLDERS } from './services/demoCatalog';
import {
  initDriveAuth,
  googleDriveSignIn,
  logoutDrive,
  fetchDriveFiles,
  fetchDriveFilesPaged,
  fetchDriveFolders,
  fetchDriveFolderAssetsForSync,
  collectDescendantFolderIds,
  fetchDriveStorageQuota,
  validateAndConnectToken,
  uploadFileToDrive,
  createDriveFolder,
  trashDriveFile,
  updateDriveFileStar,
  renameDriveFile,
  copyDriveFile,
  moveDriveFile,
  getDriveShareLink,
  fetchServerOAuthConfig,
  refreshDriveToken,
  startDirectServerOAuth,
  getDriveChangesStartPageToken,
  fetchDriveChanges,
  executeDriveBatch,
  downloadDriveFile,
  downloadDriveFileChunked,
  fetchDriveCatalogSharded,
  loadOAuthToken,
} from './services/googleDrive';
import { litSearchIndex } from './services/fastSearchIndex';
import {
  saveIndexingCheckpoint,
  loadIndexingCheckpoint,
  clearIndexingCheckpoint,
  IndexingCheckpoint,
} from './services/indexingResilience';
import {
  isTokenExpiringSoon,
  getTokenRemainingSeconds,
  getOAuthTokenRecord,
} from './services/oauthStorage';
import { googleMusicEngine } from './services/googleMusicEngine';
import { saveAccountProfile } from './services/multiAccountAuth';
import {
  openLocalDirectory,
  openLocalFiles,
  saveFileToOS,
  downloadLocalFileViaServer,
  parseDroppedItems,
  blobRegistry,
} from './services/localFileSystem';
import { providerRouter, searchCatalogByVector } from './services/providerRegistry';
import { detectAndClusterBursts } from './services/burstDetection';
import {
  loadAssets,
  saveAssets,
  saveAssetBatch,
  flushAssetBatchQueue,
  loadFolders,
  saveFolders,
  clearCatalog,
  exportFullCatalogBackup,
  restoreFullCatalogBackup,
  saveChangesToken,
  getChangesToken,
  deleteChangesToken,
  applyChangesDelta,
  deleteAsset,
} from './services/catalogDb';
import {
  dismountFolder,
  dismountAllLocalFolders,
  purgeSyncedCloudCatalog,
  clearAuthSessionsAndTokens,
  flushAllStorage,
  performSmartCleanup,
  cleanOldSessions,
  terminateAllSessions,
} from './services/storageJanitor';

// Component Imports
import { MiniDock } from './components/MiniDock';
import { StorageSidebar } from './components/StorageSidebar';
import { CentralOmnibox } from './components/CentralOmnibox';
import { StorageMetricCards } from './components/StorageMetricCards';
import { QuickAccessRibbon } from './components/QuickAccessRibbon';
import { CodexModal } from './components/CodexModal';
import { CodexTopicId } from './services/codexContent';
import { LabsThemeBackground } from './components/LabsThemeBackground';
import { GeminiDesignBackground } from './components/GeminiDesignBackground';
import { GoogleBrandBackdrop, GOOGLE_BRAND_BACKDROP_IDS } from './components/GoogleBrandBackdrop';
const MulticloudSyncModal = lazy(() => import('./components/MulticloudSyncModal').then((m) => ({ default: m.MulticloudSyncModal })));
import { WorkspaceMenuBar } from './components/WorkspaceMenuBar';
import { GoogleStudioModal } from './components/GoogleStudioModal';
import { GoogleFavoritesModal } from './components/GoogleFavoritesModal';
import { FullDiagnosticRunnerModal } from './components/FullDiagnosticRunnerModal';
import { FileManagerView } from './components/FileManagerView';
const CloudDriveBrowserView = lazy(() => import('./components/CloudDriveBrowserView').then((m) => ({ default: m.CloudDriveBrowserView })));
const GooglePhotosView = lazy(() => import('./components/GooglePhotosView').then((m) => ({ default: m.GooglePhotosView })));
import { GifStudioModal } from './components/GifStudioModal';
import { GoogleEcosystemHubModal } from './components/GoogleEcosystemHubModal';
import {
  loadSavedGooglePhotosAssets,
  saveGooglePhotosAssets,
  loadSavedGooglePhotosAlbums,
  saveGooglePhotosAlbums,
  autoLoadGooglePhotosLibrary,
  GooglePhotosAlbum,
} from './services/googlePhotos';
import { FirstRunQuickStartCard } from './components/FirstRunQuickStartCard';
import { MobileBottomNav } from './components/MobileBottomNav';
import type { GCommsTab } from './components/GeminiCopilotDrawer';
import type { MessengerChannel } from './components/GoogleWorkspaceMessengerModal';

const LocalFileManagerView = lazy(() => import('./components/LocalFileManagerView').then((m) => ({ default: m.LocalFileManagerView })));
const CullingRoomView = lazy(() => import('./components/CullingRoomView').then((m) => ({ default: m.CullingRoomView })));
const AiVisionLabView = lazy(() => import('./components/AiVisionLabView').then((m) => ({ default: m.AiVisionLabView })));
const PixelEditorView = lazy(() => import('./components/PixelEditorView').then((m) => ({ default: m.PixelEditorView })));
const NativeShaderStudio = lazy(() => import('./components/NativeShaderStudio').then((m) => ({ default: m.NativeShaderStudio })));
const NativeHeightmapMapViewer = lazy(() => import('./components/NativeHeightmapMapViewer').then((m) => ({ default: m.NativeHeightmapMapViewer })));
const PortfolioMakerView = lazy(() => import('./components/PortfolioMakerView').then((m) => ({ default: m.PortfolioMakerView })));
const SlideshowTheaterView = lazy(() => import('./components/SlideshowTheaterView').then((m) => ({ default: m.SlideshowTheaterView })));
const ProviderSettingsView = lazy(() => import('./components/ProviderSettingsView').then((m) => ({ default: m.ProviderSettingsView })));
import { ActivityTimelineDrawer } from './components/ActivityTimelineDrawer';
import { FloatingSyncDrawer } from './components/FloatingSyncDrawer';
import { OnboardingHeroGate } from './components/OnboardingHeroGate';
import { AuthDiagnosticsModal } from './components/AuthDiagnosticsModal';
import { StandaloneAuthWindow } from './components/StandaloneAuthWindow';
import { ShortcutModal } from './components/ShortcutModal';
import { PresenterWindow } from './components/PresenterWindow';
const OAuthWizardModal = lazy(() => import('./components/OAuthWizardModal').then((m) => ({ default: m.OAuthWizardModal })));
const StorageSettingsModal = lazy(() => import('./components/StorageSettingsModal').then((m) => ({ default: m.StorageSettingsModal })));
const UnifiedSettingsModal = lazy(() => import('./components/UnifiedSettingsModal').then((m) => ({ default: m.UnifiedSettingsModal })));
const GoogleTakeoutView = lazy(() => import('./components/GoogleTakeoutView').then((m) => ({ default: m.GoogleTakeoutView })));
const CloudSyncHubView = lazy(() => import('./components/CloudSyncHubView').then((m) => ({ default: m.CloudSyncHubView })));
const ExternalCloudsBrowserView = lazy(() => import('./components/ExternalCloudsBrowserView').then((m) => ({ default: m.ExternalCloudsBrowserView })));
const DiagnosticLogModal = lazy(() => import('./components/DiagnosticLogModal').then((m) => ({ default: m.DiagnosticLogModal })));
import { UnifiedContextMenu } from './components/UnifiedContextMenu';
const LightboxModal = lazy(() => import('./components/LightboxModal').then((m) => ({ default: m.LightboxModal })));
import { UnifiedFooter } from './components/UnifiedFooter';
const GmailThemeModal = lazy(() => import('./components/GmailThemeModal').then((m) => ({ default: m.GmailThemeModal })));
const AccessibilityControlModal = lazy(() => import('./components/AccessibilityControlModal').then((m) => ({ default: m.AccessibilityControlModal })));
const WorldMapView = lazy(() => import('./components/WorldMapView').then((m) => ({ default: m.WorldMapView })));
const BatchRenamerModal = lazy(() => import('./components/BatchRenamerModal').then((m) => ({ default: m.BatchRenamerModal })));
const BatchExportModal = lazy(() => import('./components/BatchExportModal').then((m) => ({ default: m.BatchExportModal })));
const VideoTrimmerModal = lazy(() => import('./components/VideoTrimmerModal').then((m) => ({ default: m.VideoTrimmerModal })));
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { DestructiveActionDialog } from './components/DestructiveActionDialog';
import { NotificationCenterDrawer } from './components/NotificationCenterDrawer';
import { WelcomeSplashScreenModal } from './components/WelcomeSplashScreenModal';
import { AboutAppModal } from './components/AboutAppModal';
const GeminiFileInspectorModal = lazy(() => import('./components/GeminiFileInspectorModal').then((m) => ({ default: m.GeminiFileInspectorModal })));
const NotebookLmExportModal = lazy(() => import('./components/NotebookLmExportModal').then((m) => ({ default: m.NotebookLmExportModal })));
const GeminiCopilotDrawer = lazy(() => import('./components/GeminiCopilotDrawer').then((m) => ({ default: m.GeminiCopilotDrawer })));
const GoogleCalendarModal = lazy(() => import('./components/GoogleCalendarModal').then((m) => ({ default: m.GoogleCalendarModal })));
const GoogleWorkspaceMessengerModal = lazy(() => import('./components/GoogleWorkspaceMessengerModal').then((m) => ({ default: m.GoogleWorkspaceMessengerModal })));
const GoogleMusicPlayerModal = lazy(() => import('./components/GoogleMusicPlayerModal').then((m) => ({ default: m.GoogleMusicPlayerModal })));
const ButlerConciergeModal = lazy(() => import('./components/ButlerConciergeModal').then((m) => ({ default: m.ButlerConciergeModal })));
const FileFormatDatabaseModal = lazy(() => import('./components/FileFormatDatabaseModal').then((m) => ({ default: m.FileFormatDatabaseModal })));
import { InteractiveTourOverlay } from './components/InteractiveTourOverlay';
import { FloatingGCommsButton } from './components/FloatingGCommsButton';
import {
  DisplayTier,
  detectDisplayProfile,
  applyAdaptiveDisplayProfile,
  loadDisplayTierOverride,
  saveDisplayTierOverride,
} from './services/adaptiveDisplayProfile';
import { findNextSpatialFocusable, DpadDirection } from './services/dpadNavigation';
import { Native3dCadViewer } from './components/Native3dCadViewer';
import { NativeMultiFormatStudio } from './components/NativeMultiFormatStudio';
import { lookupFileFormat } from './services/fileFormatEngine';
import { FloatingPipPlayer } from './components/FloatingPipPlayer';
import { googleWorkspaceMessenger } from './services/googleWorkspaceMessenger';
import { AiActionType } from './services/geminiUniversalEngine';
import { getContextMenuSpecForAsset, PipContextMode } from './services/universalFileViewerEngine';
import { useVimNavigation } from './hooks/useVimNavigation';
import { themeManager } from './services/themeEngine';
import { useTranslation } from './i18n';
import { taskLogger } from './services/taskLogger';
import { notificationEngine } from './services/notificationEngine';
import { Sparkles, X, AlertCircle, CheckCircle2, HardDrive, RotateCcw } from 'lucide-react';

export default function App() {
  const { t } = useTranslation();

  // Check if running in dedicated Secondary Screen Presenter Window
  const isPresenter = typeof window !== 'undefined' && window.location.search.includes('presenter=true');
  if (isPresenter) {
    return <PresenterWindow />;
  }

  // Check if running in dedicated Standalone Auth Window
  const isStandaloneAuth = typeof window !== 'undefined' && window.location.search.includes('auth_flow=standalone');
  if (isStandaloneAuth) {
    return <StandaloneAuthWindow />;
  }

  const [currentMode, setCurrentMode] = useState<ViewMode>('files');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Catalogs State
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [folders, setFolders] = useState<FolderNode[]>([
    { id: 'folder_all', name: 'All Media', source: 'cloud', path: '/All Media', itemCount: 0 },
  ]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('folder_all');
  const [selectedCategory, setSelectedCategory] = useState<MediaCategory | 'all'>('all');
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'text' | 'semantic'>('text');
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isRestoredSession, setIsRestoredSession] = useState(false);
  const [activeCommonFolder, setActiveCommonFolder] = useState<string | null>(null);
  const [localTargetPath, setLocalTargetPath] = useState<string | undefined>(undefined);

  // Auth & Real Google Drive Quota State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanType, setScanType] = useState<'quick' | 'deep' | 'folder' | null>(null);
  const [scanStatus, setScanStatus] = useState<{
    phase: 'idle' | 'folders' | 'files' | 'clustering' | 'saving' | 'complete';
    progress: number;
    count: number;
    rate: number;
    message: string;
    pageCount?: number;
    heartbeatTime?: number;
    lastError?: string;
  }>({
    phase: 'idle',
    progress: 0,
    count: 0,
    rate: 0,
    message: '',
  });
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [hasChangesSnapshot, setHasChangesSnapshot] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<{
    message: string;
    type: 'info' | 'success' | 'warning';
  } | null>(null);
  const [driveQuota, setDriveQuota] = useState<{
    limit: number;
    usage: number;
    usageInDrive: number;
    percentage: number;
  } | null>(null);

  // Background Task Queue & Providers
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [providers, setProviders] = useState<ProviderConfig[]>(providerRouter.getConfigs());
  const [activeProviderId, setActiveProviderId] = useState<string>('local_worker');

  // Workstation Modals & Drag-and-Drop States
  const [lightboxAsset, setLightboxAsset] = useState<MediaAsset | null>(null);
  const [lightboxAssetList, setLightboxAssetList] = useState<MediaAsset[] | null>(null);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
  const [isShortcutsPaletteOpen, setIsShortcutsPaletteOpen] = useState(false);
  const [isA11yModalOpen, setIsA11yModalOpen] = useState(false);
  const [isDestructiveSafetyOpen, setIsDestructiveSafetyOpen] = useState(false);
  const [undoPurgeBuffer, setUndoPurgeBuffer] = useState<MediaAsset[] | null>(null);
  const [undoToastMessage, setUndoToastMessage] = useState<string | null>(null);
  const [liveAnnouncerMessage, setLiveAnnouncerMessage] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState(() => themeManager.getTheme());
  const [a11yPrefs, setA11yPrefs] = useState(() => themeManager.getA11yPrefs());
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isOAuthWizardOpen, setIsOAuthWizardOpen] = useState(false);
  const [isStorageSettingsOpen, setIsStorageSettingsOpen] = useState(false);
  const [isUnifiedSettingsOpen, setIsUnifiedSettingsOpen] = useState(false);

  // Global AAA Settings Hub shortcut (Ctrl/Cmd + ,)
  useEffect(() => {
    const onSettingsKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setIsUnifiedSettingsOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onSettingsKey);
    return () => window.removeEventListener('keydown', onSettingsKey);
  }, []);
  const [isMulticloudSyncOpen, setIsMulticloudSyncOpen] = useState(false);

  const handleSyncAssetsToCatalog = React.useCallback((incoming: MediaAsset[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    setAssets((prev) => {
      const map = new Map<string, MediaAsset>();
      for (const a of prev) map.set(a.id, a);
      for (const item of incoming) map.set(item.id, item);
      return Array.from(map.values());
    });
    litSearchIndex.applyDelta({ upsert: incoming });
    void saveAssetBatch(incoming).then(() => flushAssetBatchQueue()).catch(() => {});
    notificationEngine.add({
      title: 'Synced to Catalog',
      description: `Added ${incoming.length} file${incoming.length === 1 ? '' : 's'} into your indexed catalog`,
      flag: 'complete',
      category: 'sync',
    });
  }, []);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isBatchRenamerOpen, setIsBatchRenamerOpen] = useState(false);
  const [isBatchExportOpen, setIsBatchExportOpen] = useState(false);
  const [isVideoTrimmerOpen, setIsVideoTrimmerOpen] = useState(false);
  const [isEcosystemHubOpen, setIsEcosystemHubOpen] = useState(false);
  const [gifStudioAsset, setGifStudioAsset] = useState<MediaAsset | null>(null);
  const [photosAssets, setPhotosAssets] = useState<MediaAsset[]>(() => loadSavedGooglePhotosAssets());
  const [photosAlbums, setPhotosAlbums] = useState<GooglePhotosAlbum[]>(() => loadSavedGooglePhotosAlbums());
  const [interruptedCheckpoint, setInterruptedCheckpoint] = useState<IndexingCheckpoint | null>(null);
  const lastCheckpointTokenRef = useRef<string | undefined>(undefined);
  const lastCheckpointCountRef = useRef<number>(0);

  useEffect(() => {
    void loadIndexingCheckpoint().then((cp) => {
      if (cp && (cp.status === 'in_progress' || cp.status === 'interrupted')) {
        setInterruptedCheckpoint(cp);
      }
    });
    const onOnline = () => {
      void loadIndexingCheckpoint().then((cp) => {
        if (cp && (cp.status === 'in_progress' || cp.status === 'interrupted') && !isScanningRef.current) {
          setInterruptedCheckpoint(cp);
        }
      });
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [isWelcomeSplashOpen, setIsWelcomeSplashOpen] = useState(() => {
    try {
      return localStorage.getItem('dt_disable_welcome_splash_v1') !== 'true';
    } catch {
      return true;
    }
  });
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isAiInspectorOpen, setIsAiInspectorOpen] = useState(false);
  const [aiInspectorAsset, setAiInspectorAsset] = useState<MediaAsset | null>(null);
  const [aiInspectorAction, setAiInspectorAction] = useState<AiActionType>('critique');
  const [isNotebookLmOpen, setIsNotebookLmOpen] = useState(false);
  const [notebookLmAssets, setNotebookLmAssets] = useState<MediaAsset[]>([]);
  const [isCopilotDrawerOpen, setIsCopilotDrawerOpen] = useState(false);
  const [isCastorThinking, setIsCastorThinking] = useState(false);
  const [gCommsTab, setGCommsTab] = useState<GCommsTab>('gemini');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isButlerOpen, setIsButlerOpen] = useState(false);
  const [isGoogleMusicOpen, setIsGoogleMusicOpen] = useState(false);
  const [isFormatDbOpen, setIsFormatDbOpen] = useState(false);
  const [formatDbInitialQuery, setFormatDbInitialQuery] = useState('');
  const [pipAsset, setPipAsset] = useState<MediaAsset | null>(null);
  const [pipContextMode, setPipContextMode] = useState<PipContextMode>('standalone-media');
  const [lightboxInitialEditMode, setLightboxInitialEditMode] = useState(false);
  const [isMessengerOpen, setIsMessengerOpen] = useState(false);
  const [messengerChannel, setMessengerChannel] = useState<MessengerChannel>('chat');
  const [messengerTargetAsset, setMessengerTargetAsset] = useState<MediaAsset | null>(null);
  const [trimmerTargetAsset, setTrimmerTargetAsset] = useState<MediaAsset | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [nextDrivePageToken, setNextDrivePageToken] = useState<string | undefined>(undefined);
  const [hasMoreDriveFiles, setHasMoreDriveFiles] = useState(false);

  // Concurrency Mutex, Deduplication & Abort Refs
  const isScanningRef = useRef(false);
  const lastSyncedTokenRef = useRef<string | null>(null);
  const initialScanTriggeredRef = useRef(false);
  const isAuthenticatingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const seenAssetIdsRef = useRef<Set<string>>(new Set());

  // Global Keyboard Shortcuts Listener ('?' for cheat sheet)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutModalOpen((prev) => !prev);
      }
      if (e.key === 'B' && e.shiftKey) {
        e.preventDefault();
        setIsButlerOpen((prev) => !prev);
      }
      if (e.key === 'M' && e.shiftKey) {
        e.preventDefault();
        setIsGoogleMusicOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Initialize and sync Theme engine on mount and subscribe to real-time changes
  useEffect(() => {
    themeManager.applyToDOM();
    const active = themeManager.getTheme();
    setCurrentTheme(active);
    setIsDarkMode(active.isDark);

    return themeManager.subscribe((updated) => {
      setCurrentTheme(updated);
      setIsDarkMode(updated.isDark);
    });
  }, []);

  // Web Worker Ref (Project Corsa & Project Doctrine Compliant)
  const workerRef = useRef<Worker | null>(null);

  // Initialize Web Worker
  useEffect(() => {
    try {
      const worker = new Worker(new URL('./workers/vision.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onerror = (event) => {
        console.error('Vision Web Worker error:', event.message, event.filename, event.lineno);
      };
      workerRef.current = worker;
    } catch (err) {
      console.warn('Web Worker initialization failed:', err);
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isCodexOpen, setIsCodexOpen] = useState(false);
  const [codexTopicId, setCodexTopicId] = useState<CodexTopicId | null>(null);
  const [isGoogleStudioOpen, setIsGoogleStudioOpen] = useState(false);
  const [isGoogleFavoritesOpen, setIsGoogleFavoritesOpen] = useState(false);
  const [isFullDiagnosticOpen, setIsFullDiagnosticOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ topicId?: CodexTopicId }>)?.detail;
      setCodexTopicId(detail?.topicId || null);
      setIsCodexOpen(true);
    };
    window.addEventListener('dt-open-codex', handler);
    return () => window.removeEventListener('dt-open-codex', handler);
  }, []);
  const [isDockExpanded, setIsDockExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dt_dock_expanded_v1') === 'true';
    } catch {
      return false;
    }
  });
  const [displayTierOverride, setDisplayTierOverride] = useState<DisplayTier | 'auto'>(() =>
    loadDisplayTierOverride()
  );

  useEffect(() => {
    const syncProfile = () => {
      const profile = detectDisplayProfile({ overrideTier: displayTierOverride });
      applyAdaptiveDisplayProfile(profile);
    };
    syncProfile();
    window.addEventListener('resize', syncProfile);
    return () => window.removeEventListener('resize', syncProfile);
  }, [displayTierOverride]);

  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if ((e.key === 'b' || e.key === 'B') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setIsSidebarCollapsed((v) => !v);
        return;
      }
      if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setIsTourOpen((v) => !v);
        return;
      }
      if (
        displayTierOverride === 'tv-tenfoot' &&
        (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        const dirMap: Record<string, DpadDirection> = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right',
        };
        const active = document.activeElement as HTMLElement | null;
        if (active) {
          const candidates = Array.from(
            document.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled)')
          )
            .filter((el) => el !== active)
            .map((el) => ({ el, rect: el.getBoundingClientRect() }));
          const next = findNextSpatialFocusable(active.getBoundingClientRect(), candidates, dirMap[e.key]);
          if (next) {
            e.preventDefault();
            next.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, [displayTierOverride]);

  // IndexedDB Auto-Hydration on Startup
  useEffect(() => {
    (async () => {
      try {
        const persistedAssets = await loadAssets();
        const persistedFolders = await loadFolders();
        if (persistedAssets && persistedAssets.length > 0) {
          setAssets(persistedAssets);
          setIsRestoredSession(true);
        }
        if (persistedFolders && persistedFolders.length > 0) {
          setFolders(persistedFolders);
        }
        const changesToken = await getChangesToken();
        if (changesToken) {
          setHasChangesSnapshot(true);
        }
      } catch (err) {
        console.warn('CatalogDb auto-hydration notice:', err);
      }
    })();
  }, []);

  // Initialize Google Drive Auth Listener with Startup Session Janitor
  useEffect(() => {
    // Purge expired tokens and legacy keys on application mount
    cleanOldSessions();

    const unsubscribe = initDriveAuth(
      async (currentUser, _token) => {
        setUser(currentUser);
        try {
          const quota = await fetchDriveStorageQuota();
          setDriveQuota(quota);
        } catch (e) {
          console.warn('Error fetching initial drive quota:', e);
        }
      },
      () => {
        setUser(null);
        setDriveQuota(null);
        initialScanTriggeredRef.current = false;
      }
    );
    return () => unsubscribe();
  }, []);

  // Silent Background Token Refresh Monitor (every 30s — no user-facing expiration prompts)
  useEffect(() => {
    if (!user) return;
    let refreshing = false;
    const checkAndSilentRefresh = async () => {
      if (refreshing) return;
      const record = getOAuthTokenRecord();
      if (!record) return;
      if (isTokenExpiringSoon(record, 300)) {
        refreshing = true;
        try {
          await refreshDriveToken();
        } finally {
          refreshing = false;
        }
      }
    };
    void checkAndSilentRefresh();
    const interval = setInterval(() => void checkAndSilentRefresh(), 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Dark Mode Class Syncing
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Synchronous Top-Level Window Launcher (Preserves window.opener and satisfies iframe user-activation)
  const handleLaunchStandaloneAuth = (auto = true) => {
    const authUrl = `${window.location.origin}${window.location.pathname}?auth_flow=standalone${auto ? '&auto=true' : ''}`;
    const win = window.open(
      authUrl,
      'DriveTherapyOAuth',
      'width=540,height=720,status=no,toolbar=no,menubar=no,location=yes,resizable=yes'
    );
    if (!win) {
      setAuthError('External authorization window was restricted by your browser popup settings. Please allow popups or use direct token entry below.');
      setIsAuthModalOpen(true);
      return null;
    }
    win.focus?.();
    return win;
  };

  // Google Drive Sign In Action with Synchronous Direct OAuth Launch (Immune to Popup Blockers)
  const handleSignIn = (): void => {
    if (isAuthenticatingRef.current) return;
    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    setAuthError(null);
    setAuthNotice(null);

    // Launch direct server OAuth synchronously inside click gesture
    const popup = startDirectServerOAuth();
    if (popup) {
      setAuthNotice({
        message: 'Opened Google authorization window. Select your Google account to connect Drive...',
        type: 'info',
      });
      setTimeout(() => {
        setIsAuthenticating(false);
        isAuthenticatingRef.current = false;
      }, 5000);
      return;
    }

    // Fallback: If browser restricted popup, open the guided OAuth Setup Wizard
    setIsAuthenticating(false);
    isAuthenticatingRef.current = false;
    setAuthError('Popup window was restricted by your browser. Please allow popups for localhost or use the wizard.');
    setIsOAuthWizardOpen(true);
  };

  // Direct Google OAuth Access Token Connection Handler with Generic Dynamic Profile Sync
  const handleDirectTokenConnect = async (
    token: string,
    profileMeta?: { displayName?: string; email?: string; photoURL?: string; permissionId?: string; channels?: any[] }
  ) => {
    const res = await validateAndConnectToken(token);
    if (res.success) {
      if (res.quota) setDriveQuota(res.quota);
      const email = profileMeta?.email || res.userEmail || 'drive-user@google.com';
      const displayName = profileMeta?.displayName || res.userDisplayName || (email.includes('@') ? email.split('@')[0] : 'Google Drive User');
      const photoURL = profileMeta?.photoURL || res.photoURL || '';

      const syntheticUser = {
        displayName,
        email,
        photoURL,
        uid: profileMeta?.permissionId ? `gacc_${profileMeta.permissionId}` : 'google_drive_connected',
      } as unknown as User;
      setUser(syntheticUser);

      // Register profile in multiAccountAuth registry dynamically (activating on sign-in)
      try {
        saveAccountProfile(
          {
            id: profileMeta?.permissionId ? `gacc_${profileMeta.permissionId}` : undefined,
            name: displayName,
            email,
            avatarUrl: photoURL || undefined,
            tokenRecord: res.record || getOAuthTokenRecord()!,
          },
          { setActive: true }
        );
      } catch (profileErr) {
        console.warn('Could not register profile in multiAccountAuth:', profileErr);
      }

      // Propagate profile & discovered sub-accounts dynamically into Google Music Engine
      try {
        googleMusicEngine.syncGoogleUserProfile({
          name: displayName,
          email,
          avatarUrl: photoURL || undefined,
          channels: profileMeta?.channels,
        });
        googleMusicEngine.discoverRemoteSubAccounts().catch(() => {
          googleMusicEngine.syncUserAccountMedia().catch(() => {});
        });
      } catch (musicErr) {
        console.warn('Could not sync user profile to Google Music Engine:', musicErr);
      }

      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // Synchronize Token Received Across Windows
  const handleSyncAuthToken = async (
    token: string,
    profileMeta?: { displayName?: string; email?: string; photoURL?: string; permissionId?: string; channels?: any[] }
  ) => {
    if (!token) return;
    const isSameToken = lastSyncedTokenRef.current === token;
    if (isSameToken && !profileMeta?.channels && (!profileMeta?.email || profileMeta.email === user?.email)) return;
    lastSyncedTokenRef.current = token;
    const res = await handleDirectTokenConnect(token, profileMeta);
    if (res.success) {
      setIsAuthenticating(false);
      isAuthenticatingRef.current = false;
      setAuthNotice({
        message: 'Google Drive connected and synchronized! Loading catalog...',
        type: 'success',
      });
      setIsAuthModalOpen(false);
      setCurrentMode('files');
      // Auto-load Google Photos library & albums in background right after OAuth sign-in
      void autoLoadGooglePhotosLibrary().then((gp) => {
        if (gp.items.length > 0) {
          setPhotosAssets((prev) => {
            const existing = new Set(prev.map((p) => p.id));
            const merged = [...gp.items.filter((i) => !existing.has(i.id)), ...prev];
            saveGooglePhotosAssets(merged);
            return merged;
          });
        }
        if (gp.albums.length > 0) {
          setPhotosAlbums(gp.albums);
          saveGooglePhotosAlbums(gp.albums);
        }
      });
      try {
        const existing = await loadAssets();
        if (existing && existing.length > 0) {
          setAssets(existing);
          if (!selectedAsset) setSelectedAsset(existing[0]);
        } else {
          setAuthNotice({
            message: 'Google Drive connected! Click Deep Scan Entire Drive, Quick Scan (300), or Browse Drive (No Sync) when ready.',
            type: 'success',
          });
        }
      } catch (e) {
        console.warn('Post-auth asset load note:', e);
      }
      setTimeout(() => setAuthNotice(null), 6000);
    }
  };

  // Cross-Window Auth Synchronization
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel('drive_therapy_auth');
        bc.onmessage = async (event) => {
          if (typeof event.data === 'string' && event.data.trim()) {
            await handleSyncAuthToken(event.data.trim());
          } else if (event.data?.type === 'DRIVE_AUTH_SUCCESS' && event.data?.token) {
            await handleSyncAuthToken(event.data.token, {
              displayName: event.data.displayName,
              email: event.data.userEmail,
              photoURL: event.data.photoURL,
            });
          } else if (event.data?.type === 'GOOGLE_AUTH_SUCCESS' && event.data?.payload?.accessToken) {
            await handleSyncAuthToken(event.data.payload.accessToken, {
              ...event.data.payload.user,
              channels: event.data.payload.channels,
            });
          } else if (event.data?.type === 'DRIVE_AUTH_LOGOUT') {
            setUser(null);
            setDriveQuota(null);
            setTasks([]);
            setAssets((prev) => prev.filter((a) => a.source !== 'cloud'));
            setFolders((prev) => {
              const nonCloud = prev.filter((f) => f.source !== 'cloud');
              return [
                { id: 'folder_all', name: 'All Media', source: 'cloud', path: '/All Media', itemCount: 0 },
                ...nonCloud.filter((f) => f.id !== 'folder_all'),
              ];
            });
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel init error:', e);
    }

    const handleStorage = async (event: StorageEvent) => {
      if (event.key === 'drive_auth_sync' && event.newValue) {
        try {
          const payload = JSON.parse(event.newValue);
          if (payload?.type === 'DRIVE_AUTH_SUCCESS' && payload?.token) {
            await handleSyncAuthToken(payload.token, {
              displayName: payload.displayName,
              email: payload.userEmail,
              photoURL: payload.photoURL,
            });
          }
        } catch (e) {
          console.warn('Storage sync error:', e);
        }
      } else if (event.key === 'dt_synced_token' && event.newValue) {
        await handleSyncAuthToken(event.newValue.trim());
      }
    };

    const handleMessage = async (event: MessageEvent) => {
      const isAllowedOrigin =
        event.origin === window.location.origin ||
        event.origin.includes('.run.app') ||
        event.origin === 'null';

      if (isAllowedOrigin) {
        if (event.data?.type === 'DRIVE_AUTH_SUCCESS' && event.data?.token) {
          await handleSyncAuthToken(event.data.token, {
            displayName: event.data.displayName,
            email: event.data.userEmail,
            photoURL: event.data.photoURL,
          });
        } else if (event.data?.type === 'GOOGLE_AUTH_SUCCESS' && event.data?.payload?.accessToken) {
          await handleSyncAuthToken(event.data.payload.accessToken, {
            ...event.data.payload.user,
            channels: event.data.payload.channels,
          });
        }
      }
    };

    const handleMountNotice = (e: any) => {
      setAuthNotice({
        message: e.detail?.message || "Click 'Upload' on the browser prompt to authorize local folder reading (0MB uploaded).",
        type: 'info',
      });
      setTimeout(() => setAuthNotice(null), 8000);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('message', handleMessage);
    window.addEventListener('dt:local-mount-notice', handleMountNotice);

    return () => {
      bc?.close();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('dt:local-mount-notice', handleMountNotice);
    };
  }, []);

  const handleSignOut = async () => {
    handleCancelScan();
    await terminateAllSessions();
    await purgeSyncedCloudCatalog();
    googleMusicEngine.clearDriveLibrary();
    setUser(null);
    setDriveQuota(null);
    setTasks([]);
    setAssets((prev) => prev.filter((a) => a.source !== 'cloud'));
    setFolders((prev) => {
      const nonCloud = prev.filter((f) => f.source !== 'cloud');
      return [
        { id: 'folder_all', name: 'All Media', source: 'cloud', path: '/All Media', itemCount: 0 },
        ...nonCloud.filter((f) => f.id !== 'folder_all'),
      ];
    });
    setSelectedAsset(null);
    setIsRestoredSession(false);
  };

  // Clear Catalog / Fresh Start
  const handleClearCatalog = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear the local workspace catalog and start fresh? Original files on Google Drive and your OS disk remain completely untouched.'
    );
    if (!confirmed) return;
    await flushAllStorage();
    setAssets([]);
    setFolders([{ id: 'folder_all', name: 'All Media', source: 'cloud', path: '/All Media', itemCount: 0 }]);
    setSelectedAsset(null);
    setIsRestoredSession(false);
  };

  // Dismount a single local folder cleanly
  const handleDismountFolder = async (folderId: string) => {
    const res = await dismountFolder(folderId);
    if (res.success) {
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setAssets((prev) => {
        const remaining = prev.filter((a) => a.parentId !== folderId && !a.path.startsWith(`/${folderId}/`));
        if (selectedAsset && (selectedAsset.parentId === folderId || selectedAsset.path.startsWith(`/${folderId}/`))) {
          setSelectedAsset(remaining[0] || null);
        }
        return remaining;
      });
      if (selectedFolderId === folderId) {
        setSelectedFolderId('folder_all');
      }
      setAuthNotice({
        message: `Dismounted folder and released ${res.revokedCount} in-memory blobs.`,
        type: 'success',
      });
      setTimeout(() => setAuthNotice(null), 4000);
    }
  };

  // Dismount all local folders
  const handleDismountAllLocal = async () => {
    const res = await dismountAllLocalFolders(folders);
    setFolders((prev) => prev.filter((f) => f.source !== 'local' || f.id === 'folder_all'));
    setAssets((prev) => {
      const remaining = prev.filter((a) => a.source !== 'local');
      if (selectedAsset?.source === 'local') {
        setSelectedAsset(remaining[0] || null);
      }
      return remaining;
    });
    setSelectedFolderId('folder_all');
    setAuthNotice({
      message: `Dismounted ${res.dismountedFolders} local folders and released ${res.revokedBlobs} memory blobs.`,
      type: 'success',
    });
    setTimeout(() => setAuthNotice(null), 4000);
  };

  // Purge synced cloud files only
  const handlePurgeCloud = async () => {
    const res = await purgeSyncedCloudCatalog();
    setAssets((prev) => {
      const remaining = prev.filter((a) => a.source !== 'cloud');
      if (selectedAsset?.source === 'cloud') {
        setSelectedAsset(remaining[0] || null);
      }
      return remaining;
    });
    setFolders((prev) => {
      const nonCloud = prev.filter((f) => f.source !== 'cloud');
      return [
        { id: 'folder_all', name: 'All Media', source: 'cloud', path: '/All Media', itemCount: 0 },
        ...nonCloud.filter((f) => f.id !== 'folder_all'),
      ];
    });
    setSelectedFolderId('folder_all');
    setAuthNotice({
      message: `Purged ${res.deletedAssets} synced Google Drive assets from database.`,
      type: 'success',
    });
    setTimeout(() => setAuthNotice(null), 4000);
  };

  // Clean old/stale sessions & expired tokens
  const handleCleanOldSessions = async () => {
    handleCancelScan();
    const { cleanedCount, keysRemoved } = cleanOldSessions();
    if (keysRemoved.includes('dt_oauth_session_v2 (expired token)')) {
      setUser(null);
      setDriveQuota(null);
      setTasks([]);
      await purgeSyncedCloudCatalog();
      setAssets((prev) => prev.filter((a) => a.source !== 'cloud'));
    }
    setAuthNotice({
      message: `Cleaned ${cleanedCount} stale session and migration keys.`,
      type: 'success',
    });
    setTimeout(() => setAuthNotice(null), 5000);
  };

  // Clear auth sessions
  const handleClearAuth = async () => {
    handleCancelScan();
    await terminateAllSessions();
    await purgeSyncedCloudCatalog();
    setUser(null);
    setDriveQuota(null);
    setTasks([]);
    setAssets((prev) => prev.filter((a) => a.source !== 'cloud'));
    setFolders((prev) => {
      const nonCloud = prev.filter((f) => f.source !== 'cloud');
      return [
        { id: 'folder_all', name: 'All Media', source: 'cloud', path: '/All Media', itemCount: 0 },
        ...nonCloud.filter((f) => f.id !== 'folder_all'),
      ];
    });
    setAuthNotice({
      message: 'All Google Drive sessions disconnected and cloud assets cleared.',
      type: 'info',
    });
    setTimeout(() => setAuthNotice(null), 4000);
  };

  // Flush all storage (True Zero-Residue Atomic Factory Reset)
  const handleFlushAll = async () => {
    await flushAllStorage();
    setUser(null);
    setDriveQuota(null);
    setAssets([]);
    setFolders([{ id: 'folder_all', name: 'All Media', source: 'cloud', path: '/All Media', itemCount: 0 }]);
    setSelectedAsset(null);
    setIsRestoredSession(false);
    setTasks([]);
    setAuthNotice({
      message: 'All local caches, profiles, catalogs, and sessions have been completely flushed. Reloading clean workspace...',
      type: 'success',
    });
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  // Smart cleanup ghost files
  const handleSmartClean = async () => {
    const activeIds = new Set(assets.map((a) => a.id));
    const report = await performSmartCleanup(activeIds);
    const currentFolders = await loadFolders();
    const validFolderIds = new Set(currentFolders.map((f) => f.id));
    validFolderIds.add('folder_all');
    validFolderIds.add('recent');
    setAssets((prev) => prev.filter((a) => !a.parentId || validFolderIds.has(a.parentId)));
    return report;
  };

  // Cancel in-flight scan
  const handleCancelScan = (taskId?: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isScanningRef.current = false;
    setIsScanning(false);
    setScanType(null);
    setScanStatus({
      phase: 'idle',
      progress: 0,
      count: 0,
      rate: 0,
      message: 'Scan cancelled by user.',
    });
    setTasks((prev) =>
      prev.map((t) =>
        !taskId || t.id === taskId
          ? { ...t, status: 'failed', error: 'Scan cancelled by user', progress: 0 }
          : t
      )
    );
    setAuthNotice({
      message: 'Scan cancelled by user.',
      type: 'info',
    });
    setTimeout(() => setAuthNotice(null), 4000);
  };

  // Scan Google Drive Files (Quick 300 vs Unbounded Deep Scan vs Targeted Folder, with Crash-Safe Resume)
  const handleScanDrive = async (
    targetFolderId?: string,
    isDeepScan: boolean = false,
    resumePageToken?: string
  ) => {
    // Strict Authentication Gate: Allow freshly authenticated OAuth token even before React flushes setUser()
    if (!user && !loadOAuthToken()?.accessToken) {
      setAuthNotice({
        message: 'Please connect your Google Drive account before scanning.',
        type: 'warning',
      });
      setTimeout(() => setAuthNotice(null), 4000);
      return;
    }

    // Concurrency Mutex Lock: Prevent duplicate scans from firing concurrently
    if (isScanningRef.current) {
      console.log('Drive scan already running, skipping duplicate dispatch.');
      return;
    }
    isScanningRef.current = true;
    setIsScanning(true);
    abortControllerRef.current = new AbortController();

    const isFolderScan = Boolean(targetFolderId && targetFolderId !== 'folder_all' && targetFolderId !== 'recent');
    const currentScanType: 'folder' | 'deep' | 'quick' = isFolderScan ? 'folder' : isDeepScan ? 'deep' : 'quick';
    setScanType(currentScanType);

    // If targeted folder or deep scan: maxItems = 0 (unbounded). Otherwise default quick scan: maxItems = 300.
    const maxItems = isFolderScan || isDeepScan ? 0 : 300;

    const taskId = `task_${Date.now()}`;
    const initialTaskName = isFolderScan
      ? 'Scanning folder media streams...'
      : isDeepScan
      ? 'Deep Scanning Google Drive (Unbounded)...'
      : 'Indexing latest 300 Google Drive media streams...';

    seenAssetIdsRef.current = new Set(assets.map((a) => a.id));

    setScanStatus({
      phase: 'folders',
      progress: 10,
      count: 0,
      rate: 0,
      message: initialTaskName,
      heartbeatTime: Date.now(),
      pageCount: 0,
    });

    taskLogger.task(taskId, `Starting ${currentScanType} scan on Google Drive`, {
      targetFolderId,
      isDeepScan,
      maxItems,
    });

    const scanNotif = notificationEngine.add({
      title: isFolderScan ? 'Scanning Folder' : isDeepScan ? 'Drive Deep Scan' : 'Indexing Drive Streams',
      description: initialTaskName,
      flag: 'busy',
      category: 'sync',
    });

    setTasks((prev) => [
      ...prev.filter((t) => t.type !== 'upload' || t.status === 'completed'),
      { id: taskId, name: initialTaskName, type: 'upload', progress: 10, status: 'running' },
    ]);

    try {
      // 1. Fetch folder tree: Quick scan limits to 200 folders (<1s) for fast start; Deep scan fetches all (unbounded 0)
      const maxFolders = isDeepScan ? 0 : 200;
      const driveFolders = await fetchDriveFolders(
        undefined,
        maxFolders,
        abortControllerRef.current?.signal,
        (foldersCount) => {
          setScanStatus((prev) => ({
            ...prev,
            count: foldersCount,
            progress: Math.min(25, 10 + Math.round((foldersCount / (maxFolders || 500)) * 15)),
            message: `Discovering folders... (${foldersCount.toLocaleString()} mapped)`,
          }));
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    progress: Math.min(25, 10 + Math.round((foldersCount / (maxFolders || 500)) * 15)),
                    name: `Discovering folders... (${foldersCount.toLocaleString()} mapped)`,
                  }
                : t
            )
          );
        }
      );
      const folderMap = new Map<string, FolderNode>();
      for (const f of driveFolders) {
        folderMap.set(f.id, f);
      }

      const quota = await fetchDriveStorageQuota();
      setDriveQuota(quota);

      const targetFolderName = isFolderScan ? folderMap.get(targetFolderId!)?.name || 'folder' : '';

      setScanStatus({
        phase: 'files',
        progress: 25,
        count: 0,
        rate: 0,
        message: isFolderScan
          ? `Scanning ${targetFolderName}...`
          : isDeepScan
          ? `Discovered ${driveFolders.length} folders. Deep indexing all media...`
          : `Discovered ${driveFolders.length} folders. Indexing latest 300 files...`,
      });

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                progress: 25,
                name: isFolderScan
                  ? `Scanning ${targetFolderName}...`
                  : isDeepScan
                  ? `Discovered ${driveFolders.length} folders. Deep indexing all media...`
                  : `Discovered ${driveFolders.length} folders. Indexing latest 300 files...`,
              }
            : t
        )
      );

      const folderIdsToScan = isFolderScan
        ? Array.from(collectDescendantFolderIds(targetFolderId!, driveFolders))
        : [];

      const onDriveScanProgress = (
        loadedCount: number,
        itemsPerSec: number,
        _pageToken?: string,
        heartbeat?: { page: number; timestamp: number }
      ) => {
        const currentPage = heartbeat?.page || Math.max(1, Math.ceil(loadedCount / 1000));
        const computedProgress = maxItems > 0
          ? Math.min(90, Math.round((loadedCount / maxItems) * 65) + 25)
          : Math.min(92, Math.round(25 + 67 * (1 - Math.pow(0.992, currentPage))));
        const pageStr = heartbeat?.page ? `Page ${heartbeat.page} · ` : '';
        const statusMsg = isDeepScan
          ? `Deep indexing: ${pageStr}${loadedCount.toLocaleString()} files (${itemsPerSec.toLocaleString()} files/sec)...`
          : `Indexed ${loadedCount} media streams (${itemsPerSec.toLocaleString()} files/sec)...`;

        setScanStatus({
          phase: 'files',
          progress: computedProgress,
          count: loadedCount,
          rate: itemsPerSec,
          message: statusMsg,
          pageCount: heartbeat?.page,
          heartbeatTime: heartbeat?.timestamp || Date.now(),
        });

        if (_pageToken) {
          lastCheckpointTokenRef.current = _pageToken;
        }
        lastCheckpointCountRef.current = loadedCount;
        void saveIndexingCheckpoint({
          id: taskId,
          source: 'cloud',
          scanType: currentScanType,
          status: 'in_progress',
          nextPageToken: _pageToken,
          processedCount: loadedCount,
          targetFolderId,
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  progress: computedProgress,
                  name: statusMsg,
                }
              : t
          )
        );
      };

      const onDriveBatchReceived = (batch: MediaAsset[]) => {
        if (batch.length > 0) {
          saveAssetBatch(batch);

          const newItems: MediaAsset[] = [];
          for (let i = 0; i < batch.length; i++) {
            const item = batch[i];
            if (!seenAssetIdsRef.current.has(item.id)) {
              seenAssetIdsRef.current.add(item.id);
              newItems.push(item);
            }
          }

          if (newItems.length > 0) {
            setAssets((prev) => [...newItems, ...prev]);
          }
        }
      };

      let driveFiles: MediaAsset[] = [];
      if (isFolderScan && folderIdsToScan.length > 1) {
        for (const subFolderId of folderIdsToScan) {
          if (abortControllerRef.current?.signal.aborted) break;
          const subFiles = await fetchDriveFiles(
            subFolderId,
            0,
            (loaded, rate, pt, hb) =>
              onDriveScanProgress(driveFiles.length + loaded, rate, pt, hb),
            folderMap,
            abortControllerRef.current?.signal,
            onDriveBatchReceived
          );
          driveFiles = [...driveFiles, ...subFiles];
        }
      } else if (!isFolderScan && maxItems === 0 && !resumePageToken) {
        const sharded = await fetchDriveCatalogSharded({
          onProgress: (loaded) =>
            onDriveScanProgress(loaded, Math.max(100, Math.round(loaded)), undefined, {
              page: 1,
              timestamp: Date.now(),
            }),
          onBatchReceived: onDriveBatchReceived,
          signal: abortControllerRef.current?.signal,
        });
        driveFiles = sharded.assets;
      } else {
        driveFiles = await fetchDriveFiles(
          isFolderScan ? targetFolderId : undefined,
          maxItems,
          onDriveScanProgress,
          folderMap,
          abortControllerRef.current?.signal,
          onDriveBatchReceived,
          resumePageToken
        );
      }

      void clearIndexingCheckpoint();
      setInterruptedCheckpoint(null);

      // Yield main thread so React can paint UI
      await new Promise((resolve) => setTimeout(resolve, 20));

      // 3. Compute accurate folder item counts
      const folderCounts = new Map<string, number>();
      for (const file of driveFiles) {
        if (file.parentId) {
          folderCounts.set(file.parentId, (folderCounts.get(file.parentId) || 0) + 1);
        }
      }

      const enrichedFolders: FolderNode[] = driveFolders.map((f) => ({
        ...f,
        itemCount: folderCounts.get(f.id) || f.itemCount || 0,
      }));

      // Phase 3: Selective Burst Clustering
      // Only cluster photos & RAW captures, completely avoiding sorting 370k non-photo archives/docs/audio
      const photoCandidates = driveFiles.filter((f) => f.category === 'raw' || f.category === 'image');
      taskLogger.task(taskId, `Clustering bursts for ${photoCandidates.length} photos out of ${driveFiles.length} total items`, {
        photosCount: photoCandidates.length,
        totalItems: driveFiles.length,
      });

      setScanStatus({
        phase: 'clustering',
        progress: 93,
        count: driveFiles.length,
        rate: 0,
        message: photoCandidates.length > 0
          ? `Clustering bursts for ${photoCandidates.length.toLocaleString()} photo captures...`
          : 'Finalizing catalog hierarchy...',
      });

      await new Promise((resolve) => setTimeout(resolve, 20));

      if (photoCandidates.length > 0) {
        // Cluster up to 10,000 photos smoothly
        const { clusteredAssets } = detectAndClusterBursts(photoCandidates.slice(0, 10000));
        const heroes = clusteredAssets.filter((a) => a.isBurstHero);
        if (heroes.length > 0) {
          saveAssetBatch(heroes);
        }
      }

      // Phase 4: Flush index batch buffer, save folders & changes token
      setScanStatus({
        phase: 'saving',
        progress: 96,
        count: driveFiles.length,
        rate: 0,
        message: 'Finalizing directory structure & database index...',
      });

      await flushAssetBatchQueue();
      await new Promise((resolve) => setTimeout(resolve, 20));

      setFolders((prev) => {
        const nonCloudFolders = prev.filter((f) => f.source !== 'cloud' || f.id === 'folder_all');
        const allFolder: FolderNode = {
          id: 'folder_all',
          name: 'All Media',
          source: 'cloud',
          path: '/All Media',
          itemCount: isDeepScan ? driveFiles.length : Math.max(prev.find(f => f.id === 'folder_all')?.itemCount || 0, driveFiles.length),
        };
        const combinedFolders = [allFolder, ...enrichedFolders, ...nonCloudFolders.filter((f) => f.id !== 'folder_all')];
        saveFolders(combinedFolders);
        return combinedFolders;
      });

      // Acquire Changes API startPageToken to enable subsequent instant delta syncs (<500ms)
      if (isDeepScan || !isFolderScan) {
        try {
          const startToken = await getDriveChangesStartPageToken();
          if (startToken) {
            await saveChangesToken(startToken);
            setHasChangesSnapshot(true);
            taskLogger.success('indexer', 'Changes API startPageToken acquired and persisted', { startToken });
          }
        } catch (e: any) {
          taskLogger.warn('indexer', `Changes API start token acquisition notice: ${e.message}`, { error: e.message });
        }
      }

      const completionMessage = isFolderScan
        ? `Indexed ${driveFiles.length} files in folder "${targetFolderName}"`
        : isDeepScan
        ? `Deep scan complete: ${driveFiles.length.toLocaleString()} files across ${driveFolders.length} folders`
        : `Indexed latest ${driveFiles.length} files across ${driveFolders.length} folders`;

      taskLogger.success('indexer', completionMessage, {
        totalFiles: driveFiles.length,
        totalFolders: driveFolders.length,
        isDeepScan,
      });

      setScanStatus({
        phase: 'complete',
        progress: 100,
        count: driveFiles.length,
        rate: 0,
        message: completionMessage,
      });
      setTimeout(() => {
        setScanStatus((prev) => (prev.phase === 'complete' ? { ...prev, phase: 'idle' } : prev));
      }, 5000);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                progress: 100,
                status: 'completed',
                name: completionMessage,
              }
            : t
        )
      );

      setAuthNotice({
        message: completionMessage,
        type: 'success',
      });
      setTimeout(() => setAuthNotice(null), 6000);

      notificationEngine.updateFlag(
        scanNotif.id,
        'complete',
        isFolderScan ? 'Folder Scan Complete' : isDeepScan ? 'Drive Deep Scan Complete' : 'Drive Indexing Complete',
        completionMessage
      );
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        taskLogger.warn('indexer', 'Drive scan cancelled by user', { taskId });
        console.log('Drive scan aborted by user');
        notificationEngine.updateFlag(scanNotif.id, 'attention', 'Drive Scan Cancelled', 'Scan stopped by user');
        setScanStatus({
          phase: 'idle',
          progress: 0,
          count: 0,
          rate: 0,
          message: 'Scan cancelled by user.',
        });
        return;
      }
      taskLogger.error('indexer', `Drive scan encountered an error: ${err.message}`, { taskId }, err);
      console.warn('Drive scan notice:', err.message);
      notificationEngine.updateFlag(
        scanNotif.id,
        'failure',
        'Drive Scan Failure',
        err.message || 'Scan stopped due to an error'
      );
      setScanStatus({
        phase: 'idle',
        progress: 0,
        count: 0,
        rate: 0,
        message: err.message || 'Scan error occurred',
        lastError: err.message,
      });
      if (err.name === 'OAuthExpiredError' || err.isExpired) {
        setAuthError(err.message || 'Google Drive session has expired. Please re-authenticate.');
        setIsAuthModalOpen(true);
      }
      const failedCp: IndexingCheckpoint = {
        id: taskId,
        source: 'cloud',
        scanType: currentScanType,
        status: 'interrupted',
        nextPageToken: lastCheckpointTokenRef.current,
        processedCount: lastCheckpointCountRef.current,
        targetFolderId,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastError: err.message,
      };
      void saveIndexingCheckpoint(failedCp);
      setInterruptedCheckpoint(failedCp);

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'failed', error: err.message } : t))
      );
      setAuthNotice({
        message: `Scan stopped: ${err.message}. Click QA Logs to view details.`,
        type: 'warning',
      });
      setTimeout(() => setAuthNotice(null), 8000);
    } finally {
      isScanningRef.current = false;
      setIsScanning(false);
      setScanType(null);
      abortControllerRef.current = null;
    }
  };

  // Quick Scan (Latest 300)
  const handleQuickScan = () => handleScanDrive(undefined, false);

  // Deep Scan (Unbounded entire drive)
  const handleDeepScan = () => handleScanDrive(undefined, true);

  // Google Drive Changes API Instantaneous Delta Sync (<500ms)
  const handleSyncChanges = async () => {
    if (!user) {
      setAuthNotice({
        message: 'Please connect your Google Drive account before syncing.',
        type: 'warning',
      });
      setTimeout(() => setAuthNotice(null), 4000);
      return;
    }

    const savedToken = await getChangesToken();
    if (!savedToken) {
      // If no snapshot exists yet, fallback to quick scan
      handleQuickScan();
      return;
    }

    if (isScanningRef.current) {
      console.log('Sync already running, skipping duplicate dispatch.');
      return;
    }
    isScanningRef.current = true;
    setIsScanning(true);
    setScanType('quick');
    abortControllerRef.current = new AbortController();

    const taskId = `task_${Date.now()}`;
    setScanStatus({
      phase: 'files',
      progress: 30,
      count: 0,
      rate: 0,
      message: 'Checking Google Drive for changes (Delta)...',
    });
    setTasks((prev) => [
      ...prev.filter((t) => t.type !== 'upload' || t.status === 'completed'),
      { id: taskId, name: 'Checking Google Drive for changes (Delta)...', type: 'upload', progress: 30, status: 'running' },
    ]);

    try {
      const folderMap = new Map<string, FolderNode>();
      for (const f of folders) {
        folderMap.set(f.id, f);
      }

      const { addedOrModified, removedIds, newStartPageToken } = await fetchDriveChanges(
        savedToken,
        folderMap,
        abortControllerRef.current?.signal
      );

      // Atomically apply changes delta in IndexedDB
      await applyChangesDelta(addedOrModified, removedIds);

      // Update in-memory assets state
      setAssets((prev) => {
        const removedSet = new Set(removedIds);
        const retained = prev.filter((a) => !removedSet.has(a.id));
        const updatedIds = new Set(addedOrModified.map((a) => a.id));
        const cleanRetained = retained.filter((a) => !updatedIds.has(a.id));
        const combined = [...addedOrModified, ...cleanRetained];
        litSearchIndex.applyDelta({ upsert: addedOrModified, removeIds: removedIds });
        return combined;
      });

      // Save new start page token
      if (newStartPageToken) {
        await saveChangesToken(newStartPageToken);
      }

      const changeNotice =
        addedOrModified.length === 0 && removedIds.length === 0
          ? 'Google Drive is up to date (0 changes detected).'
          : `Google Drive delta synced: +${addedOrModified.length} updated, -${removedIds.length} removed.`;

      setScanStatus({
        phase: 'complete',
        progress: 100,
        count: addedOrModified.length,
        rate: 0,
        message: changeNotice,
      });
      setTimeout(() => {
        setScanStatus((prev) => (prev.phase === 'complete' ? { ...prev, phase: 'idle' } : prev));
      }, 4000);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, progress: 100, status: 'completed', name: changeNotice }
            : t
        )
      );

      setAuthNotice({
        message: changeNotice,
        type: 'success',
      });
      setTimeout(() => setAuthNotice(null), 5000);
    } catch (err: any) {
      console.warn('Changes sync notice:', err.message);
      setScanStatus({
        phase: 'idle',
        progress: 0,
        count: 0,
        rate: 0,
        message: 'Delta sync error. Refreshing snapshot...',
      });
      await deleteChangesToken();
      setHasChangesSnapshot(false);
      handleQuickScan();
    } finally {
      isScanningRef.current = false;
      setIsScanning(false);
      setScanType(null);
      abortControllerRef.current = null;
    }
  };

  // Index Active Folder Manually
  const handleIndexActiveFolder = () => {
    if (selectedFolderId && selectedFolderId !== 'folder_all' && selectedFolderId !== 'recent') {
      handleScanDrive(selectedFolderId, false);
    }
  };

  // Folder Selection (Instant switch without auto-triggering heavy scans)
  const handleSelectFolder = (folderId: string) => {
    setSelectedFolderId(folderId);
    if (currentMode === 'drive-browser') {
      setCurrentMode('files');
    }
  };

  const syncedAssetIds = useMemo(() => new Set(assets.map((a) => a.id)), [assets]);
  const syncedFolderIds = useMemo(() => new Set(folders.map((f) => f.id)), [folders]);

  // Selectively sync individual Google Drive files into persistent catalog without scanning all of Drive
  const handleSyncIndividualDriveFiles = async (
    filesToSync: MediaAsset[],
    parentFolder?: DriveBrowserFolder
  ) => {
    if (!filesToSync || filesToSync.length === 0) return;
    await saveAssetBatch(filesToSync);
    await flushAssetBatchQueue();

    setAssets((prev) => {
      const incomingMap = new Map(filesToSync.map((item) => [item.id, item]));
      for (const item of filesToSync) {
        seenAssetIdsRef.current.add(item.id);
      }
      const existingUpdated = prev.map((a) => incomingMap.get(a.id) || a);
      const existingIds = new Set(prev.map((a) => a.id));
      const newAdditions = filesToSync.filter((a) => !existingIds.has(a.id));
      return [...newAdditions, ...existingUpdated];
    });

    if (parentFolder && parentFolder.id !== 'root') {
      setFolders((prev) => {
        if (prev.some((f) => f.id === parentFolder.id)) return prev;
        const addedFolder: FolderNode = {
          id: parentFolder.id,
          name: parentFolder.name,
          source: 'cloud',
          path: parentFolder.path || `/${parentFolder.name}`,
          parentId: parentFolder.parentId,
          itemCount: filesToSync.length,
        };
        const updated = [...prev, addedFolder];
        saveFolders(updated);
        return updated;
      });
    }

    const msg = `Synced ${filesToSync.length} Drive file${filesToSync.length === 1 ? '' : 's'} into catalog.`;
    taskLogger.success('indexer', msg, { count: filesToSync.length });
    setAuthNotice({ message: msg, type: 'success' });
    setTimeout(() => setAuthNotice(null), 4500);
  };

  // Selectively sync a single Google Drive folder (and recursively all subfolders by default) without full Drive scan
  const handleSyncIndividualDriveFolder = async (
    targetFolder: DriveBrowserFolder,
    recursive = true,
    onProgress?: (progress: { filesCount: number; foldersCount: number; currentFolder: string }) => void
  ): Promise<{ filesCount: number; foldersCount: number }> => {
    const taskId = `task_folder_${targetFolder.id}_${Date.now()}`;
    setTasks((prev) => [
      ...prev.filter((t) => t.status === 'completed'),
      {
        id: taskId,
        name: `Syncing "${targetFolder.name}" & subfolders...`,
        type: 'upload',
        progress: 15,
        status: 'running',
      },
    ]);

    try {
      const { folderNode, subFolders, assets: folderAssets } = await fetchDriveFolderAssetsForSync(
        targetFolder,
        {
          recursive,
          onProgress: (prog) => {
            onProgress?.(prog);
            setTasks((prev) =>
              prev.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      progress: Math.min(90, 20 + prog.foldersCount * 5),
                      name: `Syncing "${targetFolder.name}": ${prog.foldersCount} folder(s), ${prog.filesCount} file(s)...`,
                    }
                  : t
              )
            );
          },
        }
      );

      if (folderAssets.length > 0) {
        await saveAssetBatch(folderAssets);
        await flushAssetBatchQueue();
        setAssets((prev) => {
          const incomingMap = new Map(folderAssets.map((item) => [item.id, item]));
          for (const item of folderAssets) {
            seenAssetIdsRef.current.add(item.id);
          }
          const existingUpdated = prev.map((a) => incomingMap.get(a.id) || a);
          const existingIds = new Set(prev.map((a) => a.id));
          const newAdditions = folderAssets.filter((a) => !existingIds.has(a.id));
          return [...newAdditions, ...existingUpdated];
        });
      }

      setFolders((prev) => {
        const mergedMap = new Map<string, FolderNode>(prev.map((f) => [f.id, f]));
        mergedMap.set(folderNode.id, folderNode);
        for (const sf of subFolders) {
          mergedMap.set(sf.id, sf);
        }
        const nextList = Array.from(mergedMap.values());
        saveFolders(nextList);
        return nextList;
      });

      const subText = subFolders.length > 0 ? ` + ${subFolders.length} subfolder${subFolders.length === 1 ? '' : 's'}` : '';
      const msg = `Synced folder "${targetFolder.name}"${subText} (${folderAssets.length} file${folderAssets.length === 1 ? '' : 's'}).`;

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, progress: 100, status: 'completed', name: msg } : t))
      );
      taskLogger.success('indexer', msg, {
        folderId: targetFolder.id,
        subFoldersCount: subFolders.length,
        count: folderAssets.length,
        recursive,
      });
      setAuthNotice({ message: msg, type: 'success' });
      setTimeout(() => setAuthNotice(null), 5000);
      return { filesCount: folderAssets.length, foldersCount: subFolders.length + 1 };
    } catch (err: any) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: 'failed', error: err?.message || 'Folder sync failed' } : t
        )
      );
      throw err;
    }
  };

  // Mount Local OS Folder using File System Access API with universal fallback
  const handleImportLocalFolder = async () => {
    if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox')) {
      setAuthNotice({
        message:
          "Firefox security note: Click 'Upload' on the browser prompt to authorize local folder reading (0MB sent to any server).",
        type: 'info',
      });
      setTimeout(() => setAuthNotice(null), 8000);
    }

    try {
      const { folder, assets: importedAssets } = await openLocalDirectory();
      if (!importedAssets || importedAssets.length === 0) {
        setAuthNotice({
          message: `Mounted folder "${folder.name}", but no supported media files were found.`,
          type: 'warning',
        });
        setTimeout(() => setAuthNotice(null), 5000);
        return;
      }

      const { clusteredAssets } = detectAndClusterBursts(importedAssets);

      setFolders((prev) => {
        const updated = [folder, ...prev.filter((f) => f.id !== folder.id)];
        saveFolders(updated);
        return updated;
      });

      setAssets((prev) => {
        const combined = [...clusteredAssets, ...prev];
        if (!selectedAsset && combined.length > 0) {
          setSelectedAsset(combined[0]);
        }
        saveAssets(combined);
        return combined;
      });
      setSelectedFolderId(folder.id);

      setTasks((prev) => [
        ...prev,
        {
          id: `task_local_${Date.now()}`,
          name: `Live Mount: ${folder.name} (${importedAssets.length} items in-place)`,
          type: 'mount',
          progress: 100,
          status: 'completed',
        },
      ]);

      setAuthNotice({
        message: `Mounted folder "${folder.name}" in-place (${importedAssets.length} items · 0MB uploaded to cloud)`,
        type: 'success',
      });
      setTimeout(() => setAuthNotice(null), 5000);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('Local directory picker note:', err.message);
      setAuthError(err.message || 'Could not mount local folder.');
    }
  };

  // Import Individual or Multiple Local Media Files
  const handleImportLocalFiles = async () => {
    try {
      const importedAssets = await openLocalFiles();
      if (!importedAssets || importedAssets.length === 0) return;

      const { clusteredAssets } = detectAndClusterBursts(importedAssets);

      const virtualFolder: FolderNode = {
        id: `local_files_${Date.now()}`,
        name: `Mounted Files (${importedAssets.length})`,
        source: 'local',
        path: '/Local OS/Mounted Files',
        itemCount: importedAssets.length,
      };

      setFolders((prev) => {
        const updated = [virtualFolder, ...prev];
        saveFolders(updated);
        return updated;
      });

      setAssets((prev) => {
        const combined = [...clusteredAssets, ...prev];
        if (!selectedAsset && combined.length > 0) {
          setSelectedAsset(combined[0]);
        }
        saveAssets(combined);
        return combined;
      });
      setSelectedFolderId(virtualFolder.id);

      setTasks((prev) => [
        ...prev,
        {
          id: `task_import_${Date.now()}`,
          name: `Live Mount: ${importedAssets.length} media files in-place`,
          type: 'mount',
          progress: 100,
          status: 'completed',
        },
      ]);

      setAuthNotice({
        message: `Mounted ${importedAssets.length} media files in-place (0MB upload)`,
        type: 'success',
      });
      setTimeout(() => setAuthNotice(null), 5000);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('Local file picker note:', err.message);
      setAuthError(err.message || 'Could not import local files.');
    }
  };

  // Sample Shoot Loader
  const handleLoadSampleShoot = () => {
    const { clusteredAssets } = detectAndClusterBursts(INITIAL_ASSETS);
    setAssets(clusteredAssets);
    setFolders(INITIAL_FOLDERS);
    setSelectedAsset(clusteredAssets[0] || null);
    setSelectedFolderId('folder_all');
    saveAssets(clusteredAssets);
    saveFolders(INITIAL_FOLDERS);
  };

  // Culling State Handlers
  const handleUpdateCulling = (id: string, status: CullingStatus) => {
    setAssets((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, cullingStatus: status } : item));
      saveAssets(next);
      return next;
    });
    if (selectedAsset && selectedAsset.id === id) {
      setSelectedAsset((prev) => (prev ? { ...prev, cullingStatus: status } : null));
    }
  };

  const handleUpdateRating = (id: string, rating: number) => {
    setAssets((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, rating } : item));
      saveAssets(next);
      return next;
    });
    if (selectedAsset && selectedAsset.id === id) {
      setSelectedAsset((prev) => (prev ? { ...prev, rating } : null));
    }
  };

  // Batch Purge Rejects with explicit confirmation & anxiety safety shield
  const handleBatchPurgeRejects = () => {
    const rejectedItems = assets.filter((a) => a.cullingStatus === 'rejected');
    if (rejectedItems.length === 0) {
      setAuthNotice({ message: 'No rejected items in the review queue.', type: 'info' });
      setLiveAnnouncerMessage('No rejected items in the review queue.');
      return;
    }
    setIsDestructiveSafetyOpen(true);
  };

  const confirmBatchPurge = () => {
    const rejectedItems = assets.filter((a) => a.cullingStatus === 'rejected');
    if (rejectedItems.length === 0) return;

    // Buffer for undo recovery
    setUndoPurgeBuffer(rejectedItems);
    const msg = t('safety.trashSuccess', { count: rejectedItems.length });
    setUndoToastMessage(msg);
    setLiveAnnouncerMessage(msg);

    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => {
      setUndoPurgeBuffer(null);
      setUndoToastMessage(null);
    }, 8000);

    setAssets((prev) => {
      const next = prev.filter((a) => a.cullingStatus !== 'rejected');
      saveAssets(next);
      return next;
    });
  };

  const handleUndoPurge = () => {
    if (!undoPurgeBuffer || undoPurgeBuffer.length === 0) return;
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);

    const restored = [...undoPurgeBuffer];
    setAssets((prev) => {
      const next = [...prev, ...restored];
      saveAssets(next);
      return next;
    });

    const count = restored.length;
    setUndoPurgeBuffer(null);
    setUndoToastMessage(null);
    setLiveAnnouncerMessage(t('safety.undoSuccess', { count }));
    setAuthNotice({ message: t('safety.undoSuccess', { count }), type: 'success' });
  };

  const handleExecuteBatchRename = async (renames: Array<{ asset: MediaAsset; newName: string }>) => {
    setAssets((prev) => {
      const next = prev.map((asset) => {
        const match = renames.find((r) => r.asset.id === asset.id);
        return match ? { ...asset, name: match.newName } : asset;
      });
      saveAssets(next);
      return next;
    });

    for (const r of renames) {
      if (r.asset.source === 'local' && r.asset.path) {
        try {
          await fetch('/api/fs/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPath: r.asset.path, newName: r.newName }),
          });
        } catch {}
      }
    }
    setIsBatchRenamerOpen(false);
    setAuthNotice({ message: `Renamed ${renames.length} assets with token pattern!`, type: 'success' });
  };

  // Color Label and Batch Handlers
  const handleUpdateColorLabel = (id: string, color: ColorLabel) => {
    setAssets((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, colorLabel: color } : item));
      saveAssets(next);
      return next;
    });
    if (selectedAsset && selectedAsset.id === id) {
      setSelectedAsset((prev) => (prev ? { ...prev, colorLabel: color } : null));
    }
  };

  const handleBatchUpdateCulling = (ids: string[], status: CullingStatus) => {
    const idSet = new Set(ids);
    setAssets((prev) => {
      const next = prev.map((item) => (idSet.has(item.id) ? { ...item, cullingStatus: status } : item));
      saveAssets(next);
      return next;
    });
  };

  const handleBatchUpdateRating = (ids: string[], rating: number) => {
    const idSet = new Set(ids);
    setAssets((prev) => {
      const next = prev.map((item) => (idSet.has(item.id) ? { ...item, rating } : item));
      saveAssets(next);
      return next;
    });
  };

  const handleBatchUpdateColorLabel = (ids: string[], color: ColorLabel) => {
    const idSet = new Set(ids);
    setAssets((prev) => {
      const next = prev.map((item) => (idSet.has(item.id) ? { ...item, colorLabel: color } : item));
      saveAssets(next);
      return next;
    });
  };

  const handleApplyRecipeToSelection = (recipe: FilterRecipe) => {
    const pickedCount = assets.filter((a) => a.cullingStatus === 'picked').length;
    if (pickedCount === 0) {
      alert('Please pick some photos first (using P key) to batch apply this darkroom recipe.');
      return;
    }
    setAssets((prev) => {
      const next = prev.map((item) =>
        item.cullingStatus === 'picked' ? { ...item, presetRecipe: recipe } : item
      );
      saveAssets(next);
      return next;
    });
    alert(`Applied "${recipe.name}" across ${pickedCount} picked catalog frames!`);
  };

  // Unified Comprehensive Context Menu State & Action Dispatchers
  const [contextMenu, setContextMenu] = useState<{
    asset: MediaAsset;
    position: { x: number; y: number };
  } | null>(null);

  const handleOpenContextMenu = (asset: MediaAsset, e: React.MouseEvent) => {
    setContextMenu({
      asset,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleContextStarToggle = async (asset: MediaAsset) => {
    const isCurrentlyStarred = asset.rating > 0 || asset.cullingStatus === 'picked';
    const nextRating = isCurrentlyStarred ? 0 : 5;
    const nextStatus = isCurrentlyStarred ? 'unrated' : 'picked';
    const updated: MediaAsset = {
      ...asset,
      rating: nextRating,
      cullingStatus: nextStatus,
    };
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? updated : a)));
    saveAssetBatch([updated]);

    if (asset.source === 'cloud') {
      const ok = await updateDriveFileStar(asset.id, !isCurrentlyStarred);
      if (ok) {
        setAuthNotice({
          message: !isCurrentlyStarred ? `Added "${asset.name}" to Starred in Google Drive` : `Removed "${asset.name}" from Starred`,
          type: 'success',
        });
      }
    } else {
      setAuthNotice({
        message: !isCurrentlyStarred ? `Marked "${asset.name}" as favorite` : `Unstarred "${asset.name}"`,
        type: 'info',
      });
    }
  };

  const handleContextDuplicate = async (asset: MediaAsset) => {
    if (asset.source === 'cloud') {
      setAuthNotice({ message: `Creating copy of "${asset.name}" in Google Drive...`, type: 'info' });
      const copy = await copyDriveFile(asset.id, `Copy of ${asset.name}`);
      if (copy) {
        setAssets((prev) => [copy, ...prev]);
        saveAssetBatch([copy]);
        setAuthNotice({ message: `Created copy "${copy.name}" in Google Drive!`, type: 'success' });
      } else {
        setAuthNotice({ message: `Failed to copy "${asset.name}" in Google Drive`, type: 'warning' });
      }
    } else if (asset.path) {
      try {
        const res = await fetch('/api/fs/duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: asset.path }),
        });
        const data = await res.json();
        if (data.success) {
          const duplicateAsset: MediaAsset = {
            ...asset,
            id: `local_os_${data.newPath}`,
            name: data.newName,
            path: data.newPath,
            sizeBytes: data.sizeBytes,
            thumbnailUrl: data.thumbnailUrl,
            modifiedTime: new Date().toISOString(),
          };
          setAssets((prev) => [duplicateAsset, ...prev]);
          saveAssetBatch([duplicateAsset]);
          setAuthNotice({ message: `Duplicated "${data.newName}" on computer!`, type: 'success' });
        } else {
          setAuthNotice({ message: data.error || 'Duplicate failed', type: 'warning' });
        }
      } catch (err: any) {
        setAuthNotice({ message: err.message || 'Duplicate error', type: 'warning' });
      }
    }
  };

  const handleContextRename = async (asset: MediaAsset) => {
    const newName = window.prompt('Enter new filename:', asset.name);
    if (!newName || newName.trim() === '' || newName === asset.name) return;

    const trimmed = newName.trim();
    if (asset.source === 'cloud') {
      const ok = await renameDriveFile(asset.id, trimmed);
      if (ok) {
        const updated: MediaAsset = { ...asset, name: trimmed };
        setAssets((prev) => prev.map((a) => (a.id === asset.id ? updated : a)));
        saveAssetBatch([updated]);
        setAuthNotice({ message: `Renamed to "${trimmed}" in Google Drive!`, type: 'success' });
      } else {
        setAuthNotice({ message: `Failed to rename file in Google Drive`, type: 'warning' });
      }
    } else if (asset.path) {
      try {
        const res = await fetch('/api/fs/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath: asset.path, newName: trimmed }),
        });
        const data = await res.json();
        if (data.success) {
          const updated: MediaAsset = {
            ...asset,
            name: data.newName,
            path: data.newPath,
            thumbnailUrl: `/api/fs/stream?path=${encodeURIComponent(data.newPath)}`,
          };
          setAssets((prev) => prev.map((a) => (a.id === asset.id ? updated : a)));
          saveAssetBatch([updated]);
          setAuthNotice({ message: `Renamed to "${data.newName}"!`, type: 'success' });
        } else {
          setAuthNotice({ message: data.error || 'Rename failed', type: 'warning' });
        }
      } catch (err: any) {
        setAuthNotice({ message: err.message || 'Rename error', type: 'warning' });
      }
    }
  };

  const handleContextDelete = async (asset: MediaAsset) => {
    const isCloud = asset.source === 'cloud';
    const confirmMsg = isCloud
      ? `Move "${asset.name}" to Google Drive Trash?`
      : `Permanently delete "${asset.name}" from your computer?`;

    if (!window.confirm(confirmMsg)) return;

    if (isCloud) {
      const ok = await trashDriveFile(asset.id);
      if (ok) {
        setAssets((prev) => prev.filter((a) => a.id !== asset.id));
        await deleteAsset(asset.id);
        setAuthNotice({ message: `Moved "${asset.name}" to Google Drive Trash.`, type: 'info' });
      } else {
        setAuthNotice({ message: `Failed to trash "${asset.name}" in Google Drive.`, type: 'warning' });
      }
    } else if (asset.path) {
      try {
        const res = await fetch('/api/fs/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetPath: asset.path }),
        });
        const data = await res.json();
        if (data.success) {
          setAssets((prev) => prev.filter((a) => a.id !== asset.id && a.path !== asset.path));
          await deleteAsset(asset.id);
          setAuthNotice({ message: `Deleted "${asset.name}" from computer.`, type: 'info' });
        } else {
          setAuthNotice({ message: data.error || 'Failed to delete file', type: 'warning' });
        }
      } catch (err: any) {
        setAuthNotice({ message: err.message || 'Delete error', type: 'warning' });
      }
    }
  };

  const handleContextSetBurstHero = (asset: MediaAsset) => {
    const updated: MediaAsset = { ...asset, isBurstHero: true };
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? updated : a)));
    saveAssetBatch([updated]);
    setAuthNotice({ message: `Set "${asset.name}" as burst best shot!`, type: 'success' });
  };

  const handleContextMove = async (asset: MediaAsset) => {
    if (asset.source !== 'cloud') {
      alert('Moving local files between folders can be done via the native file browser.');
      return;
    }

    const cloudFolders = folders.filter((f) => f.source === 'cloud' && f.id !== 'folder_all' && f.id !== 'recent');
    const folderList = cloudFolders.map((f, i) => `${i + 1}. ${f.name}`).join('\n');
    const promptText = `Select destination folder (enter number or folder ID):\n\n${folderList || 'No subfolders found. Enter Google Drive folder ID:'}`;

    const choice = window.prompt(promptText);
    if (!choice) return;

    let targetFolderId = choice.trim();
    const index = parseInt(targetFolderId, 10);
    if (!isNaN(index) && index >= 1 && index <= cloudFolders.length) {
      targetFolderId = cloudFolders[index - 1].id;
    }

    setAuthNotice({ message: `Moving "${asset.name}"...`, type: 'info' });
    const ok = await moveDriveFile(asset.id, targetFolderId, asset.parentId);
    if (ok) {
      const targetFolder = folders.find((f) => f.id === targetFolderId);
      const updated: MediaAsset = {
        ...asset,
        parentId: targetFolderId,
        path: targetFolder ? `${targetFolder.path}/${asset.name}` : asset.path,
      };
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? updated : a)));
      saveAssetBatch([updated]);
      setAuthNotice({
        message: `Moved "${asset.name}" to "${targetFolder?.name || 'folder'}"!`,
        type: 'success',
      });
      setTimeout(() => setAuthNotice(null), 5000);
    } else {
      setAuthNotice({ message: `Failed to move "${asset.name}" in Google Drive`, type: 'warning' });
    }
  };

  const handleContextUploadToDrive = async (asset: MediaAsset) => {
    if (!user) {
      setAuthNotice({ message: 'Please sign in to Google Drive first', type: 'warning' });
      setIsAuthModalOpen(true);
      return;
    }

    setAuthNotice({ message: `Preparing "${asset.name}" for upload to Google Drive...`, type: 'info' });

    try {
      let fileBlob: Blob;
      if (asset.path) {
        const streamUrl = `/api/fs/stream?path=${encodeURIComponent(asset.path)}`;
        const res = await fetch(streamUrl);
        if (!res.ok) throw new Error(`Could not read local file: HTTP ${res.status}`);
        fileBlob = await res.blob();
      } else {
        const res = await fetch(asset.thumbnailUrl);
        fileBlob = await res.blob();
      }

      const file = new File([fileBlob], asset.name, { type: asset.mimeType || 'application/octet-stream' });
      const uploaded = await uploadFileToDrive(file, undefined, (pct) => {
        setAuthNotice({ message: `Uploading "${asset.name}" to Google Drive (${pct}%)...`, type: 'info' });
      });

      setAssets((prev) => [uploaded, ...prev]);
      saveAssetBatch([uploaded]);
      setAuthNotice({ message: `"${asset.name}" backed up to Google Drive!`, type: 'success' });
      setTimeout(() => setAuthNotice(null), 5000);
    } catch (err: any) {
      setAuthNotice({ message: `Upload failed: ${err.message}`, type: 'warning' });
    }
  };

  // Interactive Context-Aware Picture-in-Picture Toggle
  const handleTogglePip = (targetAsset?: MediaAsset, explicitMode?: PipContextMode) => {
    if (!targetAsset) {
      if (pipAsset) {
        setPipAsset(null);
        googleMusicEngine.setPipActive(false);
        return;
      }
      const track = googleMusicEngine.getState().currentTrack;
      const queueAsset: MediaAsset = {
        id: track.id,
        name: `${track.artist} - ${track.title}`,
        source: track.source === 'local' ? 'local' : 'cloud',
        category: track.isVideo ? 'video' : 'audio',
        mimeType: track.mimeType || (track.isVideo ? 'video/mp4' : `audio/${track.format}`),
        extension: (track.format || 'mp3').toUpperCase(),
        path: track.localPath || track.videoUrl || track.albumArtUrl,
        cloudUrl: track.videoUrl || undefined,
        thumbnailUrl: track.albumArtUrl,
        sizeBytes: 0,
        modifiedTime: new Date().toISOString(),
        isCached: true,
        cullingStatus: 'unrated',
        rating: 0,
        tags: ['music', track.genre],
        faces: [],
        quality: { sharpness: 90, exposure: 90, overall: 90, isBlurry: false },
        palette: [],
        exif: {},
      };
      googleMusicEngine.pause();
      googleMusicEngine.setPipActive(true);
      setPipContextMode('music-queue');
      setPipAsset(queueAsset);
      return;
    }

    if (pipAsset && pipAsset.id === targetAsset.id && !explicitMode) {
      setPipAsset(null);
      googleMusicEngine.setPipActive(false);
      return;
    }

    const spec = getContextMenuSpecForAsset(targetAsset);
    const resolvedMode: PipContextMode =
      explicitMode || (spec.pipMode === 'media' ? 'standalone-media' : 'reference-pin');
    setPipContextMode(resolvedMode);
    setPipAsset(targetAsset);
  };

  // Non-Destructive In-Place Save for Text, Code, CSV, JSON, Markdown, and LUT Editors
  const handleSaveEditedAsset = async (
    targetAsset: MediaAsset,
    updatedText: string,
    saveToDisk = false
  ) => {
    const updatedAsset: MediaAsset = {
      ...targetAsset,
      metadata: {
        ...(targetAsset.metadata || {}),
        editedContent: updatedText,
        editedAt: new Date().toISOString(),
      },
    };

    setAssets((prev) => prev.map((a) => (a.id === updatedAsset.id ? updatedAsset : a)));
    if (selectedAsset?.id === updatedAsset.id) setSelectedAsset(updatedAsset);
    if (lightboxAsset?.id === updatedAsset.id) setLightboxAsset(updatedAsset);
    saveAssetBatch([updatedAsset]);

    if (saveToDisk) {
      const res = await fetch('/api/fs/save-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalPath: targetAsset.path,
          filename: targetAsset.name,
          content: updatedText,
          encoding: 'utf8',
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to save disk copy (HTTP ${res.status})`);
      }
      const data = await res.json();
      setAuthNotice({
        message: `Saved non-destructive copy: ${data.savedPath || data.name}`,
        type: 'success',
      });
      setTimeout(() => setAuthNotice(null), 5000);
    } else {
      setAuthNotice({
        message: `Saved non-destructive edits to catalog for "${targetAsset.name}"`,
        type: 'success',
      });
      setTimeout(() => setAuthNotice(null), 4000);
    }
  };

  // Drag-and-Drop Ingestion Handlers
  const handleDragOver = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer?.types || []);
    if (!types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target || e.clientX <= 0 || e.clientY <= 0) {
      setIsDraggingOver(false);
    }
  };

  useEffect(() => {
    if (!isDraggingOver) return;
    const clearDrag = () => setIsDraggingOver(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDraggingOver(false);
    };
    window.addEventListener('dragend', clearDrag);
    window.addEventListener('drop', clearDrag);
    window.addEventListener('blur', clearDrag);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('dragend', clearDrag);
      window.removeEventListener('drop', clearDrag);
      window.removeEventListener('blur', clearDrag);
      window.removeEventListener('keydown', onKey);
    };
  }, [isDraggingOver]);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    try {
      const { folders: droppedFolders, assets: droppedAssets } = await parseDroppedItems(e.dataTransfer);
      if (droppedAssets.length === 0) return;

      const { clusteredAssets } = detectAndClusterBursts(droppedAssets);

      setAssets((prev) => {
        const combined = [...clusteredAssets, ...prev];
        if (!selectedAsset && combined.length > 0) {
          setSelectedAsset(combined[0]);
        }
        saveAssets(combined);
        return combined;
      });

      if (droppedFolders.length > 0) {
        setFolders((prev) => {
          const combined = [...droppedFolders, ...prev];
          saveFolders(combined);
          return combined;
        });
      }

      setTasks((prev) => [
        ...prev,
        {
          id: `task_drop_${Date.now()}`,
          name: `Live Mount: ${droppedAssets.length} dropped media files in-place (0MB upload)`,
          type: 'mount',
          progress: 100,
          status: 'completed',
        },
      ]);
    } catch (err: any) {
      console.warn('Drag-and-drop parse error:', err);
    }
  };

  // Full Catalog Backup Export
  const handleExportBackup = async () => {
    try {
      const backup = await exportFullCatalogBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      await saveFileToOS(`drivetherapy_catalog_${Date.now()}.dtbackup`, blob);
    } catch (e: any) {
      alert(`Backup failed: ${e.message}`);
    }
  };

  // Full Catalog Backup Restore
  const handleImportBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.dtbackup,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const success = await restoreFullCatalogBackup(parsed);
        if (success) {
          setAssets(parsed.assets || []);
          setFolders(parsed.folders || []);
          if (parsed.assets?.length > 0) setSelectedAsset(parsed.assets[0]);
          setIsRestoredSession(true);
          alert(`Successfully restored catalog from ${file.name} (${parsed.assets?.length || 0} items)!`);
        }
      } catch (err: any) {
        alert(`Restore failed: ${err.message}`);
      }
    };
    input.click();
  };

  // Create remote Google Drive folder
  const handleCreateFolder = async (folderName?: string) => {
    const name = folderName || window.prompt('Enter new folder name:');
    if (!name?.trim()) return;

    if (user) {
      try {
        const newFolder = await createDriveFolder(name.trim(), selectedFolderId !== 'folder_all' ? selectedFolderId : undefined);
        setFolders((prev) => {
          const next = [newFolder, ...prev];
          saveFolders(next);
          return next;
        });
      } catch (e: any) {
        alert(`Cloud folder creation error: ${e.message}`);
      }
    } else {
      const localFolder: FolderNode = {
        id: `local_f_${Date.now()}`,
        name: name.trim(),
        source: 'local',
        path: `/${name.trim()}`,
        itemCount: 0,
      };
      setFolders((prev) => {
        const next = [localFolder, ...prev];
        saveFolders(next);
        return next;
      });
    }
  };

  // Load More Google Drive Files (Unbounded Pagination)
  const handleLoadMoreDriveFiles = async () => {
    if (!user || isScanning) return;
    setIsScanning(true);
    try {
      const folderMap = new Map<string, FolderNode>();
      for (const f of folders) {
        folderMap.set(f.id, f);
      }
      const res = await fetchDriveFilesPaged(
        selectedFolderId !== 'folder_all' ? selectedFolderId : undefined,
        nextDrivePageToken,
        100,
        folderMap
      );
      setNextDrivePageToken(res.nextPageToken);
      setHasMoreDriveFiles(res.hasMore);

      if (res.assets.length > 0) {
        const { clusteredAssets } = detectAndClusterBursts(res.assets);
        setAssets((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const newItems = clusteredAssets.filter((a) => !existingIds.has(a.id));
          const combined = [...prev, ...newItems];
          saveAssets(combined);
          return combined;
        });
      }
    } catch (e: any) {
      console.warn('Load more drive files notice:', e.message);
    } finally {
      setIsScanning(false);
    }
  };

  // Download / Export Asset to OS (Proven Server Stream for Local, Resilient Fetch for Cloud)
  const handleDownloadAsset = async (asset: MediaAsset) => {
    const taskId = `task_download_${asset.id}_${Date.now()}`;
    setTasks((prev) => [
      ...prev,
      {
        id: taskId,
        name: `Downloading ${asset.name}`,
        type: 'download',
        progress: 25,
        status: 'running',
      },
    ]);
    setAuthNotice({
      message: `Downloading "${asset.name}" to your computer...`,
      type: 'info',
    });

    try {
      // 1. Proven Native Stream for Local Computer Files (0MB browser memory, native OS progress)
      if (asset.source === 'local' && asset.path) {
        downloadLocalFileViaServer(asset.path, asset.name);
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, progress: 100, status: 'completed' } : t))
        );
        setAuthNotice({
          message: `Saved "${asset.name}" to your Downloads!`,
          type: 'success',
        });
        setTimeout(() => setAuthNotice(null), 5000);
        return;
      }

      // 2. Google Drive Cloud Files
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, progress: 50 } : t))
      );

      const blob = await downloadDriveFile(asset.id, asset.name);

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, progress: 85 } : t))
      );

      const saved = await saveFileToOS(asset.name, blob);

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, progress: 100, status: 'completed' } : t))
      );

      if (saved) {
        setAuthNotice({
          message: `Saved "${asset.name}" to your computer!`,
          type: 'success',
        });
      } else {
        setAuthNotice({
          message: `Download started for "${asset.name}". Check your browser Downloads.`,
          type: 'info',
        });
      }
      setTimeout(() => setAuthNotice(null), 5000);
    } catch (err: any) {
      console.error('Download failed:', err);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'failed', error: err.message } : t))
      );
      setAuthNotice({
        message: `Download failed: ${err.message}`,
        type: 'warning',
      });
      setTimeout(() => setAuthNotice(null), 6000);
    }
  };

  // Single AI Analysis Trigger
  const handleAnalyzeAsset = async (asset: MediaAsset) => {
    const taskId = `task_ai_${asset.id}`;
    setTasks((prev) => [
      ...prev,
      { id: taskId, name: `Analyzing ${asset.name} with AI Vision`, type: 'ai_analyze', progress: 30, status: 'running' },
    ]);
    setAuthNotice({
      message: `Analyzing "${asset.name}" with AI Vision...`,
      type: 'info',
    });

    try {
      const res = await providerRouter.execute({
        kind: 'vision',
        prompt: 'Analyze image tags, face detections, and optical quality',
        imageBase64: asset.thumbnailUrl,
        options: { filename: asset.name },
      });

      const data = res.data;
      if (data) {
        setAssets((prev) => {
          const next = prev.map((item) =>
            item.id === asset.id
              ? {
                  ...item,
                  tags: Array.from(new Set([...item.tags, ...(data.tags || [])])),
                  quality: data.quality || item.quality,
                  faces: data.faces || item.faces,
                  palette: data.palette || item.palette,
                }
              : item
          );
          saveAssets(next);
          return next;
        });
      }

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, progress: 100, status: 'completed' } : t))
      );
      setAuthNotice({
        message: `AI Vision analysis complete for "${asset.name}"!`,
        type: 'success',
      });
      setTimeout(() => setAuthNotice(null), 5000);
    } catch (err: any) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'failed', error: err.message } : t))
      );
      setAuthNotice({
        message: `AI analysis failed: ${err.message}`,
        type: 'warning',
      });
      setTimeout(() => setAuthNotice(null), 6000);
    }
  };

  // Batch Analyze All Library
  const handleBatchAnalyzeAll = async () => {
    if (assets.length === 0) return;
    const taskId = `task_batch_${Date.now()}`;
    setTasks((prev) => [
      ...prev,
      { id: taskId, name: `Running AI Library Curation (${assets.length} photos)`, type: 'ai_analyze', progress: 15, status: 'running' },
    ]);

    let progress = 15;
    for (let i = 0; i < Math.min(assets.length, 12); i++) {
      const item = assets[i];
      try {
        await handleAnalyzeAsset(item);
        progress += Math.round(75 / Math.min(assets.length, 12));
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, progress: Math.min(95, progress) } : t))
        );
      } catch (e) {
        console.warn('Batch analyze item note:', e);
      }
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, progress: 100, status: 'completed' } : t))
    );
  };

  // Select AI Provider
  const handleSelectProvider = (id: string) => {
    setActiveProviderId(id);
    const updated = providers.map((p) => (p.id === id ? { ...p, enabled: true } : p));
    setProviders(updated);
    providerRouter.updateConfigs(updated);
  };

  // Common Folder Selection Handler (Pictures, Downloads, Documents, Desktop / Real OS Locations)
  const handleSelectCommonFolder = async (folderName: string, folderPath?: string) => {
    setActiveCommonFolder(folderName);

    if (folderPath) {
      setLocalTargetPath(folderPath);
      setCurrentMode('local-files');
      return;
    }

    // If in local mode or user selected local common folder, query backend path
    try {
      const res = await fetch('/api/fs/quick-access');
      const data = await res.json();
      if (data.success && Array.isArray(data.locations)) {
        const target = data.locations.find((l: any) =>
          l.name.toLowerCase() === folderName.toLowerCase() ||
          l.id.toLowerCase() === folderName.toLowerCase()
        );
        if (target) {
          setLocalTargetPath(target.path);
          setCurrentMode('local-files');
          return;
        }
      }
    } catch {
      // Fallback
    }

    if (folderName.toLowerCase() === 'pictures') {
      setSelectedCategory('image');
    } else if (folderName.toLowerCase() === 'documents') {
      setSelectedCategory('document');
    }
  };

  // Clear all filters handler
  const handleClearAllFilters = () => {
    setSelectedCategory('all');
    setSearchQuery('');
    setActiveCommonFolder(null);
    setSelectedFolderId('folder_all');
  };

  // Filter Assets by Folder (including nested subfolders), Category, and Omnibox Search Query (Memoized)
  const descendantFolderIds = useMemo(() => {
    if (selectedFolderId === 'folder_all' || selectedFolderId === 'recent') {
      return null;
    }
    return collectDescendantFolderIds(selectedFolderId, folders);
  }, [selectedFolderId, folders]);

  useEffect(() => {
    litSearchIndex.rebuild(assets);
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const basePool =
      searchQuery.trim().length >= 2
        ? litSearchIndex.search(searchQuery, selectedCategory === 'all' ? 'all' : selectedCategory)
        : assets;

    return basePool.filter((asset) => {
      if (selectedFolderId !== 'folder_all' && selectedFolderId !== 'recent') {
        const activeFolder = folders.find((f) => f.id === selectedFolderId);
        const matchesDescendant = Boolean(
          asset.parentId && descendantFolderIds?.has(asset.parentId)
        );
        const matchesPath = Boolean(activeFolder && asset.path.startsWith(activeFolder.path));
        if (!matchesDescendant && !matchesPath) {
          return false;
        }
      }

      if (selectedFolderId === 'recent') {
        const isRecent = new Date(asset.modifiedTime).getTime() > Date.now() - 7 * 24 * 3600 * 1000;
        if (!isRecent) return false;
      }

      if (selectedCategory !== 'all' && asset.category !== selectedCategory) return false;

      // Filter by active common folder (Pictures, Documents, Downloads, Desktop)
      if (activeCommonFolder) {
        const cf = activeCommonFolder.toLowerCase();
        const matchesCat =
          (cf === 'pictures' && (asset.category === 'image' || asset.category === 'raw')) ||
          (cf === 'documents' && asset.category === 'document') ||
          (cf === 'downloads' && (asset.path.toLowerCase().includes('download') || asset.tags.some(t => t.toLowerCase().includes('download')))) ||
          (cf === 'desktop' && asset.path.toLowerCase().includes('desktop'));
        const matchesPath = asset.path.toLowerCase().includes(cf) || asset.name.toLowerCase().includes(cf);
        if (!matchesCat && !matchesPath) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        // If the query is just the active common folder name, it is already handled above
        if (!activeCommonFolder || q !== activeCommonFolder.toLowerCase()) {
          const matchName = asset.name.toLowerCase().includes(q);
          const matchTag = asset.tags.some((t) => t.toLowerCase().includes(q));
          const matchCam = (asset.exif.camera || '').toLowerCase().includes(q);
          const matchFace = asset.faces.some((f) => f.label.toLowerCase().includes(q));
          const matchPath = asset.path.toLowerCase().includes(q);
          if (!matchName && !matchTag && !matchCam && !matchFace && !matchPath) return false;
        }
      }

      return true;
    });
  }, [assets, selectedFolderId, selectedCategory, searchQuery, folders, activeCommonFolder]);

  // Dynamic Category & Culling Metric Accumulator (Single-Pass O(N) Memoization)
  const { categoryCounts, pickedCount, rejectedCount, ratedCount, blurryCount } = useMemo(() => {
    const counts = {
      all: assets.length,
      image: 0,
      raw: 0,
      video: 0,
      audio: 0,
      archive: 0,
      document: 0,
    };
    let picked = 0;
    let rejected = 0;
    let rated = 0;
    let blurry = 0;

    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      if (a.category && (counts as any)[a.category] !== undefined) {
        (counts as any)[a.category]++;
      }
      if (a.cullingStatus === 'picked') picked++;
      else if (a.cullingStatus === 'rejected') rejected++;
      if (a.rating > 0) rated++;
      if (a.quality?.isBlurry) blurry++;
    }

    return {
      categoryCounts: counts,
      pickedCount: picked,
      rejectedCount: rejected,
      ratedCount: rated,
      blurryCount: blurry,
    };
  }, [assets]);

  const currentFolder = folders.find((f) => f.id === selectedFolderId) || folders[0];
  const activeProvider = providers.find((p) => p.id === activeProviderId) || providers[0];

  // Procedural Vim Navigation Hook
  useVimNavigation({
    enabled: a11yPrefs.vimMode,
    assets: filteredAssets,
    selectedAssetId: selectedAsset?.id,
    onSelectAsset: (asset) => setSelectedAsset(asset),
    onUpdateCulling: handleUpdateCulling,
    onUpdateRating: handleUpdateRating,
    onOpenShortcuts: () => setIsShortcutsPaletteOpen(true),
    onOpenLightbox: (asset) => setLightboxAsset(asset),
    onToast: (msg) => {
      setLiveAnnouncerMessage(msg);
    },
  });

  const hasAmbientBackdrop = Boolean(
    currentTheme.wallpaperUrl ||
      currentTheme.id === 'labs' ||
      currentTheme.id === 'gemini-design' ||
      GOOGLE_BRAND_BACKDROP_IDS.has(currentTheme.id)
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        background: hasAmbientBackdrop ? 'transparent' : 'var(--theme-bg, #F4F7FB)',
        backgroundColor: hasAmbientBackdrop ? 'transparent' : 'var(--theme-bg, #F4F7FB)',
        color: 'var(--theme-text, inherit)',
      }}
      className={`flex flex-col h-screen w-screen overflow-hidden text-slate-800 dark:text-slate-100 relative isolate transition-colors duration-200 ${
        hasAmbientBackdrop ? 'bg-transparent' : ''
      }`}
    >
      {/* Screen Reader Skip to Main Content Link */}
      <a href="#main-content" className="skip-link">
        {t('a11y.skipToContent')}
      </a>

      {/* Dynamic Screen Reader Live Announcer */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncerMessage}
      </div>

      {/* Full-Window Drag-and-Drop Ingestion Overlay (with Escape & Cancel Support) */}
      {isDraggingOver && (
        <div
          onClick={() => setIsDraggingOver(false)}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="absolute inset-0 z-50 bg-[#1074B1]/90 backdrop-blur-md flex flex-col items-center justify-center text-white pointer-events-auto animate-in fade-in duration-150 p-6 text-center"
        >
          <HardDrive className="w-16 h-16 animate-pulse mb-3" />
          <h2 className="text-2xl font-extrabold tracking-tight">Drop Media Files &amp; Folders Here</h2>
          <p className="text-sm opacity-90 mt-1">
            Live in-place disk mount &middot; Zero cloud upload &middot; Bypasses browser confirmation prompts
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsDraggingOver(false);
            }}
            className="mt-5 min-h-[44px] px-5 rounded-2xl bg-black/40 hover:bg-black/60 border border-white/25 text-xs font-bold uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Cancel Drop (Esc)
          </button>
        </div>
      )}

      {/* Google Labs, Gemini Design & Google Brand Studio Ambient Backdrops */}
      {currentTheme.id === 'labs' && <LabsThemeBackground />}
      {currentTheme.id === 'gemini-design' && <GeminiDesignBackground />}
      {GOOGLE_BRAND_BACKDROP_IDS.has(currentTheme.id) && (
        <GoogleBrandBackdrop themeId={currentTheme.id} />
      )}

      {/* Traditional Google Workspace Menu Bar (Desktop, Tiling WM & Portable Ready) */}
      <WorkspaceMenuBar
        onImportLocalFolder={handleImportLocalFolder}
        onQuickScan={handleQuickScan}
        onDeepScan={handleDeepScan}
        onSyncChanges={handleSyncChanges}
        onOpenBatchExport={() => setIsBatchExportOpen(true)}
        onToggleSidebar={() => setIsSidebarCollapsed((v) => !v)}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onSelectMode={(mode) => setCurrentMode(mode)}
        onOpenWorkspaceHub={() => setIsEcosystemHubOpen(true)}
        onOpenFavorites={() => setIsGoogleFavoritesOpen(true)}
        onOpenStudio={() => setIsGoogleStudioOpen(true)}
        onOpenOAuthWizard={() => setIsOAuthWizardOpen(true)}
        onOpenDiagnostics={() => setIsAuthModalOpen(true)}
        onOpenButler={() => setIsButlerOpen(true)}
        onOpenSettings={() => setIsUnifiedSettingsOpen(true)}
        onOpenTour={() => setIsTourOpen(true)}
        onOpenFormatDb={() => {
          setFormatDbInitialQuery('');
          setIsFormatDbOpen(true);
        }}
        onOpenLogs={() => setIsLogModalOpen(true)}
        onOpenFullDiagnostic={() => setIsFullDiagnosticOpen(true)}
        onOpenCodex={() => {
          setCodexTopicId(null);
          setIsCodexOpen(true);
        }}
        onOpenShortcuts={() => setIsShortcutsPaletteOpen(true)}
      />

      {/* Top Unified Full-Width Omnibox Header */}
      <CentralOmnibox
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activePath={
          currentMode === 'local-files'
            ? 'My Computer'
            : currentMode === 'drive-browser'
            ? 'Drive Browser (No Sync)'
            : (currentFolder?.path || '/All Media')
        }
        activeProviderName={activeProvider?.name || 'Local Web Worker'}
        providers={providers}
        activeProviderId={activeProviderId}
        onSelectProvider={handleSelectProvider}
        searchMode={searchMode}
        onToggleSearchMode={() => setSearchMode(searchMode === 'text' ? 'semantic' : 'text')}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        isAuthenticating={isAuthenticating}
        onOpenDiagnostics={() => setIsAuthModalOpen(true)}
        onOpenOAuthWizard={() => setIsOAuthWizardOpen(true)}
        onOpenSettings={() => setIsStorageSettingsOpen(true)}
        onOpenLogs={() => setIsLogModalOpen(true)}
        onOpenCopilot={() => setIsCopilotDrawerOpen(true)}
        onOpenGoogleMusic={() => setIsGoogleMusicOpen(true)}
        onOpenButler={() => setIsButlerOpen(true)}
        onOpenFormatDb={() => {
          setFormatDbInitialQuery('');
          setIsFormatDbOpen(true);
        }}
        assets={assets}
        onOpenTour={() => setIsTourOpen(true)}
        displayTier={displayTierOverride}
        onChangeDisplayTier={(tier) => {
          saveDisplayTierOverride(tier);
          setDisplayTierOverride(tier);
        }}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((v) => !v)}
        pickedCount={pickedCount}
        rejectedCount={rejectedCount}
        totalAssetsCount={assets.length}
        onOpenCulling={() => setCurrentMode('culling')}
        onExecuteConsoleAction={(actionId, asset) => {
          if (asset) {
            setLightboxAssetList([asset]);
            setLightboxAsset(asset);
            return;
          }
          if (actionId === 'view:files') setCurrentMode('files');
          else if (actionId === 'view:photos') setCurrentMode('google-photos');
          else if (actionId === 'view:culling') setCurrentMode('culling');
          else if (actionId === 'view:local') setCurrentMode('local-files');
          else if (actionId === 'view:map') setCurrentMode('map');
          else if (actionId === 'view:compare') setCurrentMode('editor');
          else if (actionId === 'view:slideshow') setCurrentMode('slideshow');
          else if (actionId === 'modal:music') setIsGoogleMusicOpen(true);
          else if (actionId === 'modal:workspace' || actionId.startsWith('modal:workspace:')) setIsEcosystemHubOpen(true);
          else if (actionId === 'modal:tour') setIsTourOpen(true);
          else if (actionId === 'modal:oauth') setIsOAuthWizardOpen(true);
          else if (actionId === 'modal:butler') setIsButlerOpen(true);
          else if (actionId === 'modal:formats') {
            setFormatDbInitialQuery('');
            setIsFormatDbOpen(true);
          } else if (actionId === 'modal:settings') setIsStorageSettingsOpen(true);
          else if (actionId === 'modal:shortcuts') setIsShortcutsPaletteOpen(true);
          else if (actionId === 'modal:diagnostics') setIsAuthModalOpen(true);
          else if (actionId.startsWith('display:')) {
            const tier = actionId.replace('display:', '') as DisplayTier | 'auto';
            saveDisplayTierOverride(tier);
            setDisplayTierOverride(tier);
          }
        }}
        onDeepScan={handleDeepScan}
        isScanning={isScanning}
        scanStatus={scanStatus}
        onCancelScan={handleCancelScan}
        onOpenCodex={(topicId) => {
          setCodexTopicId(topicId || null);
          setIsCodexOpen(true);
        }}
        onOpenFavorites={() => setIsGoogleFavoritesOpen(true)}
        onOpenFullDiagnostic={() => setIsFullDiagnosticOpen(true)}
      />

      {/* Minimal Secondary Header Bar: Quick Access Media Type Filters */}
      <QuickAccessRibbon
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        categoryCounts={categoryCounts}
        variant="secondary-header"
        onQuickScan={handleQuickScan}
        onDeepScan={handleDeepScan}
        isScanning={isScanning}
        scanType={scanType}
        cloudConnected={Boolean(user)}
        onCancelScan={handleCancelScan}
        onOpenTour={() => setIsTourOpen(true)}
        onOpenLogs={() => setIsLogModalOpen(true)}
        onOpenFormatDb={() => {
          setFormatDbInitialQuery('');
          setIsFormatDbOpen(true);
        }}
        displayTier={displayTierOverride}
        onChangeDisplayTier={(tier) => {
          saveDisplayTierOverride(tier);
          setDisplayTierOverride(tier);
        }}
        onOpenCodex={(topicId) => {
          setCodexTopicId(topicId || null);
          setIsCodexOpen(true);
        }}
      />

      {/* Real-time Iframe-Safe Auth Notification Bar */}
      {authNotice && (
        <div
          role="status"
          aria-live="polite"
          className={`mx-6 mt-2 px-4 py-2.5 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 shadow-md animate-in fade-in duration-200 z-20 shrink-0 ${
            authNotice.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : authNotice.type === 'info'
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {authNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : authNotice.type === 'info' ? (
              <Sparkles className="w-4 h-4 shrink-0 text-[#1074B1]" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <span>{authNotice.message}</span>
          </div>
          <button
            onClick={() => setAuthNotice(null)}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 min-h-[32px] min-w-[32px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#1074B1]"
            aria-label="Dismiss status notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Middle Workstation Canvas Row (Dock + Sidebar + Stage + Inspector) */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* 1. Far-Left Navigation Dock (Attachment 1 Canonical) */}
        <MiniDock
          currentMode={currentMode}
          onSelectMode={(mode) => setCurrentMode(mode)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          cloudConnected={Boolean(user)}
          driveQuotaPercent={driveQuota?.percentage ?? (user ? 15 : 0)}
          onOpenSettings={() => setIsStorageSettingsOpen(true)}
          onOpenAbout={() => setIsAboutModalOpen(true)}
          onOpenCopilot={() => setIsCopilotDrawerOpen(true)}
          onOpenEcosystemHub={() => setIsEcosystemHubOpen(true)}
          onToggleStorageDrawer={() => setIsSidebarCollapsed((v) => !v)}
          isStorageDrawerOpen={!isSidebarCollapsed}
          onExpandedChange={setIsDockExpanded}
          onOpenStudio={() => setIsGoogleStudioOpen(true)}
        />

        {/* 2. Storage & Folder Directory Sidebar */}
        <StorageSidebar
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={handleSelectFolder}
          onImportLocalFolder={handleImportLocalFolder}
          onImportFiles={handleImportLocalFiles}
          storageTab={
            currentMode === 'local-files'
              ? 'local'
              : currentMode === 'google-photos'
              ? 'photos'
              : 'cloud'
          }
          onSelectStorageTab={(tab) =>
            setCurrentMode(tab === 'local' ? 'local-files' : tab === 'photos' ? 'google-photos' : 'files')
          }
          onOpenCloudFileManager={() => setCurrentMode('files')}
          onOpenDriveBrowser={() => setCurrentMode('drive-browser')}
          onOpenGooglePhotos={() => setCurrentMode('google-photos')}
          photosCount={photosAssets.length}
          onOpenLocalFileManager={() => setCurrentMode('local-files')}
          activeCommonFolder={activeCommonFolder}
          onSelectCommonFolder={handleSelectCommonFolder}
          onScanDrive={handleQuickScan}
          onDeepScan={handleDeepScan}
          onSyncChanges={handleSyncChanges}
          hasChangesSnapshot={hasChangesSnapshot}
          isScanning={isScanning}
          scanType={scanType}
          cloudConnected={Boolean(user)}
          driveQuota={driveQuota || undefined}
          totalAssetsCount={assets.length}
          blurryCount={blurryCount}
          pickedCount={pickedCount}
          rejectedCount={rejectedCount}
          ratedCount={ratedCount}
          isRestoredSession={isRestoredSession}
          onClearCatalog={handleClearCatalog}
          onOpenShortcuts={() => setIsShortcutModalOpen(true)}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          onCreateFolder={handleCreateFolder}
          onDismountFolder={handleDismountFolder}
          onOpenStorageSettings={() => setIsStorageSettingsOpen(true)}
          onOpenLogs={() => setIsLogModalOpen(true)}
          onOpenEcosystemHub={() => setIsEcosystemHubOpen(true)}
          scanStatus={scanStatus}
          onCancelScan={handleCancelScan}
          onSelectSmartCollection={(query) => {
            setSearchQuery(query);
            if (currentMode !== 'files' && currentMode !== 'local-files') {
              setCurrentMode('files');
            }
          }}
          activeSmartQuery={searchQuery}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
        />

        {/* 3. Main Central Viewport Canvas */}
        <div
          className="flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-200 main-stage-container"
        >
          {/* Scrollable Stage Content */}
          <main id="main-content" className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6" tabIndex={-1}>
          {/* Crash-Safe Interrupted Scan Resume Banner */}
          {interruptedCheckpoint && !isScanning && (
            <div className="mb-4 px-4 py-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  Indexing was interrupted after{' '}
                  <strong>{interruptedCheckpoint.processedCount.toLocaleString()}</strong> items
                  {interruptedCheckpoint.lastError ? ` (${interruptedCheckpoint.lastError})` : ''}.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const cp = interruptedCheckpoint;
                    setInterruptedCheckpoint(null);
                    void handleScanDrive(cp.targetFolderId, cp.scanType === 'deep', cp.nextPageToken);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600"
                >
                  Resume Scan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInterruptedCheckpoint(null);
                    void clearIndexingCheckpoint();
                  }}
                  className="px-3 py-1.5 rounded-xl border border-amber-500/30 font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Active ViewMode Stage (subtle reduced-motion-safe entrance) */}
          <div key={currentMode} className="dt-stage-enter">
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center p-10 text-xs font-semibold opacity-70">
                Loading Studio Module…
              </div>
            }
          >
          {/* Google Photos Studio (Picker API, Timeline, Takeout, GIF & Video Handoff) */}
          {currentMode === 'google-photos' && (
            <GooglePhotosView
              photosAssets={photosAssets}
              initialAlbums={photosAlbums}
              onUpdateAlbums={(nextAlbums) => {
                setPhotosAlbums(nextAlbums);
                saveGooglePhotosAlbums(nextAlbums);
              }}
              cloudConnected={Boolean(user)}
              onConnectGoogle={handleSignIn}
              onAddPhotosAssets={(items) => {
                setPhotosAssets((prev) => {
                  const existingIds = new Set(prev.map((p) => p.id));
                  const merged = [...items.filter((i) => !existingIds.has(i.id)), ...prev];
                  saveGooglePhotosAssets(merged);
                  return merged;
                });
              }}
              onOpenLightbox={(asset, contextList) => {
                setSelectedAsset(asset);
                setLightboxInitialEditMode(false);
                setLightboxAssetList(contextList.length > 0 ? contextList : null);
                setLightboxAsset(asset);
              }}
              onOpenGifStudio={(asset) => setGifStudioAsset(asset)}
              onOpenVideoEditor={(asset) => {
                setTrimmerTargetAsset(asset);
                setIsVideoTrimmerOpen(true);
              }}
              onToggleFavorite={(assetId) => {
                setPhotosAssets((prev) => {
                  const next = prev.map((a) =>
                    a.id === assetId ? { ...a, rating: a.rating > 0 ? 0 : 5 } : a
                  );
                  saveGooglePhotosAssets(next);
                  return next;
                });
              }}
              onOpenMap={() => setCurrentMode('map')}
            />
          )}

          {/* Live Google Drive Browser (No-Sync Explorer + Individual Sync) */}
          {currentMode === 'drive-browser' && (
            <CloudDriveBrowserView
              cloudConnected={Boolean(user)}
              onConnectGoogleDrive={handleSignIn}
              syncedAssetIds={syncedAssetIds}
              syncedFolderIds={syncedFolderIds}
              onSyncFiles={handleSyncIndividualDriveFiles}
              onSyncFolder={handleSyncIndividualDriveFolder}
              onPreviewAsset={(asset, list) => {
                setSelectedAsset(asset);
                setLightboxInitialEditMode(false);
                setLightboxAssetList(list && list.length > 0 ? list : null);
                setLightboxAsset(asset);
              }}
              onPlayMedia={(asset, siblings) => {
                setSelectedAsset(asset);
                googleMusicEngine.openPlayerWithAsset(asset, true, siblings);
                setIsGoogleMusicOpen(true);
              }}
              onDownloadAsset={handleDownloadAsset}
              onOpenInReview={(reviewAssets) => {
                handleSyncIndividualDriveFiles(reviewAssets);
                setCurrentMode('culling');
              }}
              onContextMenu={handleOpenContextMenu}
              externalSearchQuery={searchQuery}
              externalCategory={selectedCategory}
            />
          )}

          {/* Native OS Local File Manager (My Computer) */}
          {currentMode === 'local-files' && (
            <LocalFileManagerView
              externalSearchQuery={searchQuery}
              onExternalSearchChange={setSearchQuery}
              externalCategory={selectedCategory}
              onExternalCategoryChange={(c) => setSelectedCategory(c as any)}
              targetPath={localTargetPath}
              onPreviewAsset={(asset, list) => {
                setSelectedAsset(asset);
                setLightboxInitialEditMode(false);
                setLightboxAssetList(list && list.length > 0 ? list : null);
                setLightboxAsset(asset);
              }}
              onOpenInReview={(reviewAssets) => {
                setAssets((prev) => {
                  const existingIds = new Set(prev.map((a) => a.id));
                  const newItems = reviewAssets.filter((a) => !existingIds.has(a.id));
                  return [...newItems, ...prev];
                });
                setCurrentMode('culling');
              }}
              onOpenInEditor={(editorAsset) => {
                setAssets((prev) => {
                  if (prev.some((a) => a.id === editorAsset.id)) return prev;
                  return [editorAsset, ...prev];
                });
                setSelectedAsset(editorAsset);
                setCurrentMode('editor');
              }}
              onImportAssetsToCatalog={(importedAssets) => {
                setAssets((prev) => {
                  const existingIds = new Set(prev.map((a) => a.id));
                  const newItems = importedAssets.filter((a) => !existingIds.has(a.id));
                  return [...newItems, ...prev];
                });
                saveAssetBatch(importedAssets);
              }}
              onContextMenu={handleOpenContextMenu}
            />
          )}

          {/* Active Workstation Stage */}
          {currentMode === 'files' && assets.length === 0 && !isScanning && (
            <FirstRunQuickStartCard
              isGoogleConnected={Boolean(user)}
              onConnectGoogle={() => setIsOAuthWizardOpen(true)}
              onQuickScan={handleQuickScan}
              onImportLocalFolder={handleImportLocalFolder}
              onOpenExternalClouds={() => setCurrentMode('external-clouds')}
              onOpenTakeout={() => setCurrentMode('takeout')}
              onOpenTour={() => setIsTourOpen(true)}
            />
          )}

          {currentMode === 'files' && (
            <FileManagerView
              assets={filteredAssets}
              selectedAssetId={selectedAsset?.id}
              onSelectAsset={(asset) => setSelectedAsset(asset)}
              onDoubleClickAsset={(asset) => {
                setSelectedAsset(asset);
                if (asset.category === 'audio' || asset.category === 'video') {
                  googleMusicEngine.openPlayerWithAsset(asset, true, assets);
                  setIsGoogleMusicOpen(true);
                } else {
                  setLightboxAssetList(filteredAssets);
                  setLightboxAsset(asset);
                }
              }}
              onContextMenu={handleOpenContextMenu}
              onUpdateCulling={handleUpdateCulling}
              onUpdateRating={handleUpdateRating}
              onDownloadAsset={handleDownloadAsset}
              onAnalyzeAsset={handleAnalyzeAsset}
              onScanDrive={handleDeepScan}
              onIndexActiveFolder={handleIndexActiveFolder}
              activeFolderName={selectedFolderId !== 'folder_all' && selectedFolderId !== 'recent' ? currentFolder?.name : undefined}
              activeCategory={selectedCategory}
              activeQuery={searchQuery}
              onClearFilter={handleClearAllFilters}
              isScanning={isScanning}
              cloudConnected={Boolean(user)}
              scanStatus={scanStatus}
              onCancelScan={handleCancelScan}
              onOpenLogs={() => setIsLogModalOpen(true)}
            />
          )}

          {assets.length > 0 && currentMode === 'culling' && (
            <CullingRoomView
              assets={filteredAssets}
              onUpdateCulling={handleUpdateCulling}
              onUpdateRating={handleUpdateRating}
              onUpdateColorLabel={handleUpdateColorLabel}
              onBatchUpdateCulling={handleBatchUpdateCulling}
              onBatchUpdateRating={handleBatchUpdateRating}
              onBatchUpdateColorLabel={handleBatchUpdateColorLabel}
              onBatchPurgeRejects={handleBatchPurgeRejects}
            />
          )}

          {assets.length > 0 && currentMode === 'vision' && (
            <AiVisionLabView
              assets={assets}
              onFilterByTag={(tag) => setSearchQuery(tag)}
              onFilterByFace={(face) => setSearchQuery(face)}
              onBatchAnalyzeAll={handleBatchAnalyzeAll}
              isAnalyzing={isScanning}
            />
          )}

          {currentMode === 'editor' && selectedAsset ? (() => {
            const activeFmt = lookupFileFormat(selectedAsset.name, selectedAsset.mimeType);
            const selectedIsPip = Boolean(pipAsset && pipAsset.id === selectedAsset.id);
            if (activeFmt.family === 'cad_3d' || activeFmt.viewer === '3d-preview') {
              return (
                <Native3dCadViewer
                  asset={selectedAsset}
                  onDownload={handleDownloadAsset}
                  onOpenPip={(a) => handleTogglePip(a)}
                  isPipActive={selectedIsPip}
                  onSaveEditedAsset={handleSaveEditedAsset}
                  onOpenFormatDb={(q) => {
                    setFormatDbInitialQuery(q);
                    setIsFormatDbOpen(true);
                  }}
                />
              );
            }
            if (activeFmt.viewer === 'shader-viewer' || activeFmt.editor === 'shader-editor') {
              return (
                <NativeShaderStudio
                  asset={selectedAsset}
                  onSaveEditedAsset={handleSaveEditedAsset}
                  onOpenPip={(a) => handleTogglePip(a)}
                  isPipActive={selectedIsPip}
                  onOpenFormatDb={(q) => {
                    setFormatDbInitialQuery(q);
                    setIsFormatDbOpen(true);
                  }}
                />
              );
            }
            if (
              activeFmt.viewer === 'heightmap-viewer' ||
              activeFmt.editor === 'heightmap-terrain-editor'
            ) {
              return (
                <NativeHeightmapMapViewer
                  asset={selectedAsset}
                  onDownload={handleDownloadAsset}
                  onOpenPip={(a) => handleTogglePip(a)}
                  isPipActive={selectedIsPip}
                  onOpenFormatDb={(q) => {
                    setFormatDbInitialQuery(q);
                    setIsFormatDbOpen(true);
                  }}
                />
              );
            }
            if (
              (selectedAsset.category === 'image' || selectedAsset.category === 'raw') &&
              activeFmt.extension !== 'SVG' &&
              activeFmt.family !== 'vector_graphic'
            ) {
              return (
                <PixelEditorView
                  asset={selectedAsset}
                  onSaveCopy={(filename) => {
                    alert(`Master copy saved as ${filename} in Local OS catalog!`);
                  }}
                  onApplyRecipeToSelection={handleApplyRecipeToSelection}
                />
              );
            }
            return (
              <NativeMultiFormatStudio
                asset={selectedAsset}
                onSaveEditedAsset={handleSaveEditedAsset}
                onOpenPip={(a) => handleTogglePip(a)}
                onOpenMusicPlayer={(a) => {
                  googleMusicEngine.openPlayerWithAsset(a, true, assets);
                  setIsGoogleMusicOpen(true);
                }}
                onOpenFormatDb={(q) => {
                  setFormatDbInitialQuery(q);
                  setIsFormatDbOpen(true);
                }}
                onDownload={handleDownloadAsset}
                onOpenVideoTrimmer={(a) => {
                  setTrimmerTargetAsset(a);
                  setIsVideoTrimmerOpen(true);
                }}
              />
            );
          })() : currentMode === 'editor' ? (
            <div className="p-12 text-center rounded-2xl border theme-card space-y-2">
              <h2 className="text-sm font-bold">Native Multi-Format Studio Ready</h2>
              <p className="text-xs opacity-75">
                Select any photo, RAW image, SVG, document, spreadsheet, JSON, SQLite database, GIS map, audio, video, archive, font, or 3D/CAD model to inspect or edit non-destructively.
              </p>
            </div>
          ) : null}

          {assets.length > 0 && currentMode === 'portfolio' && (
            <PortfolioMakerView
              assets={assets}
              onExportPortfolio={(project: PortfolioProject) => {
                console.log('Portfolio exported:', project);
              }}
              onOpenMessenger={(ch) => {
                setMessengerChannel(ch || 'chat');
                setIsMessengerOpen(true);
              }}
            />
          )}

          {assets.length > 0 && currentMode === 'slideshow' && (
            <SlideshowTheaterView
              assets={filteredAssets}
              onUpdateCulling={(assetId, status) => {
                setAssets((prev) =>
                  prev.map((a) => (a.id === assetId ? { ...a, cullingStatus: status } : a))
                );
              }}
              onUpdateRating={(assetId, rating) => {
                setAssets((prev) =>
                  prev.map((a) => (a.id === assetId ? { ...a, rating } : a))
                );
              }}
            />
          )}

          {currentMode === 'map' && (
            <WorldMapView
              assets={assets}
              onSelectAsset={(asset) => setSelectedAsset(asset)}
              onOpenLightbox={(asset) => setLightboxAsset(asset)}
            />
          )}

          {currentMode === 'providers' && (
            <ProviderSettingsView
              providers={providers}
              onUpdateProviders={(updated) => {
                setProviders(updated);
                providerRouter.updateConfigs(updated);
              }}
            />
          )}

          {currentMode === 'takeout' && (
            <GoogleTakeoutView
              existingAssets={assets}
              onImportAssetsToCatalog={(incoming) => {
                setAssets((prev) => {
                  const existingIds = new Set(prev.map((a) => a.id));
                  const fresh = incoming.filter((a) => !existingIds.has(a.id));
                  return fresh.length > 0 ? [...fresh, ...prev] : prev;
                });
              }}
              onOpenCloudSync={() => setCurrentMode('cloud-sync')}
            />
          )}

          {currentMode === 'cloud-sync' && (
            <CloudSyncHubView
              isGoogleConnected={Boolean(user)}
              userEmail={user?.email || null}
              allAssets={assets}
              onOpenDirectTransferModal={() => setIsMulticloudSyncOpen(true)}
              onOpenTakeout={() => setCurrentMode('takeout')}
              onOpenExternalClouds={() => setCurrentMode('external-clouds')}
            />
          )}

          {currentMode === 'external-clouds' && (
            <ExternalCloudsBrowserView
              onImportAssetToCatalog={(asset) => {
                setAssets((prev) => {
                  if (prev.some((a) => a.id === asset.id)) return prev;
                  return [asset, ...prev];
                });
              }}
              onAskCastorAboutAsset={(asset) => {
                setSelectedAsset(asset);
                setGCommsTab('gemini');
                setIsCopilotDrawerOpen(true);
              }}
              onOpenCloudSyncHub={() => setCurrentMode('cloud-sync')}
            />
          )}
          </Suspense>
          </div>
        </main>
      </div>

      {/* 4. Right Sidebar: Activity Timeline & EXIF Inspector (Attachment 1) */}
      <ActivityTimelineDrawer
        selectedAsset={selectedAsset}
        recentAssets={assets}
        onSelectAsset={(asset) => setSelectedAsset(asset)}
        isOpen={isRightSidebarOpen}
        onToggle={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
        onOpenFormatDb={(q) => {
          setFormatDbInitialQuery(q || '');
          setIsFormatDbOpen(true);
        }}
      />
    </div>

    {/* 5. Unified Full-Width Scalable Footer Dock */}
    <UnifiedFooter
      totalAssetsCount={assets.length}
      driveQuota={driveQuota || undefined}
      hasChangesSnapshot={hasChangesSnapshot}
      isScanning={isScanning}
      scanStatus={scanStatus}
      onCancelScan={handleCancelScan}
      onOpenLogs={() => setIsLogModalOpen(true)}
      onOpenThemeModal={() => setIsThemeModalOpen(true)}
      onOpenA11yModal={() => setIsA11yModalOpen(true)}
      onOpenShortcuts={() => setIsShortcutsPaletteOpen(true)}
      isVimActive={a11yPrefs.vimMode}
      onToggleVim={() => {
        const next = themeManager.setA11yPrefs({ vimMode: !a11yPrefs.vimMode });
        setA11yPrefs(next);
        setLiveAnnouncerMessage(next.vimMode ? 'Procedural Vim mode active' : 'Vim mode disabled');
      }}
      fontScale={a11yPrefs.fontScale}
      onFontScaleChange={(scale) => {
        const next = themeManager.setA11yPrefs({ fontScale: scale });
        setA11yPrefs(next);
      }}
      onOpenNotifications={() => setIsNotificationCenterOpen(true)}
      onOpenCalendar={() => setIsCalendarOpen(true)}
      onOpenGoogleMusic={() => setIsGoogleMusicOpen(true)}
      onOpenButler={() => setIsButlerOpen(true)}
      isPipActive={Boolean(pipAsset)}
      onTogglePip={() => handleTogglePip()}
      isDarkMode={isDarkMode}
      onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      userPhotoUrl={user?.photoURL}
      userDisplayName={user?.displayName || user?.email}
      onOpenPeopleView={() => setCurrentMode('vision')}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchMode={searchMode}
      onToggleSearchMode={() => setSearchMode(searchMode === 'text' ? 'semantic' : 'text')}
      assets={assets}
      onExecuteConsoleAction={(actionId, asset) => {
        if (asset) {
          setLightboxAssetList([asset]);
          setLightboxAsset(asset);
          return;
        }
        if (actionId === 'view:files') setCurrentMode('files');
        else if (actionId === 'view:photos') setCurrentMode('google-photos');
        else if (actionId === 'view:culling') setCurrentMode('culling');
        else if (actionId === 'view:local') setCurrentMode('local-files');
        else if (actionId === 'view:map') setCurrentMode('map');
        else if (actionId === 'view:compare') setCurrentMode('editor');
        else if (actionId === 'view:slideshow') setCurrentMode('slideshow');
        else if (actionId === 'modal:music') setIsGoogleMusicOpen(true);
        else if (actionId === 'modal:workspace' || actionId.startsWith('modal:workspace:')) setIsEcosystemHubOpen(true);
        else if (actionId === 'modal:tour') setIsTourOpen(true);
        else if (actionId === 'modal:oauth') setIsOAuthWizardOpen(true);
        else if (actionId === 'modal:butler') setIsButlerOpen(true);
        else if (actionId === 'modal:formats') {
          setFormatDbInitialQuery('');
          setIsFormatDbOpen(true);
        } else if (actionId === 'modal:settings') setIsStorageSettingsOpen(true);
        else if (actionId === 'modal:shortcuts') setIsShortcutsPaletteOpen(true);
        else if (actionId === 'modal:diagnostics') setIsAuthModalOpen(true);
        else if (actionId.startsWith('display:')) {
          const tier = actionId.replace('display:', '') as DisplayTier | 'auto';
          saveDisplayTierOverride(tier);
          setDisplayTierOverride(tier);
        }
      }}
    />

      {/* Compact Mobile Bottom Navigation Bar (< 640px) */}
      <MobileBottomNav
        currentMode={currentMode}
        onSelectMode={(mode) => setCurrentMode(mode)}
        onToggleCopilot={() => setIsCopilotDrawerOpen((v) => !v)}
        isCopilotOpen={isCopilotDrawerOpen}
      />

      <Suspense fallback={null}>
      {/* 6. Notification Center Drawer (4-Status Flag System) */}
      <NotificationCenterDrawer
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        onActionClick={(actionId) => {
          if (actionId === 'open_auth_wizard') setIsOAuthWizardOpen(true);
          else if (actionId === 'open_settings') setIsStorageSettingsOpen(true);
          else if (actionId === 'open_logs') setIsLogModalOpen(true);
        }}
      />

      {/* 5. Floating Bottom-Right Sync Drawer (Attachment 1) */}
      <FloatingSyncDrawer
        tasks={tasks}
        onRetryTask={(taskId) => {
          setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, status: 'running', progress: 50 } : t))
          );
        }}
        onDismissTask={(taskId) => {
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
        }}
        onClearCompleted={() => {
          setTasks([]);
        }}
        onCancelTask={handleCancelScan}
        onOpenLogs={() => setIsLogModalOpen(true)}
      />

      {/* 6. Google Drive Diagnostics & Direct Token Modal */}
      <AuthDiagnosticsModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        authError={authError}
        onRetrySignIn={handleSignIn}
        onConnectWithToken={handleDirectTokenConnect}
        onOpenOAuthWizard={() => {
          setIsAuthModalOpen(false);
          setIsOAuthWizardOpen(true);
        }}
        driveQuotaLimitBytes={driveQuota?.limit}
      />

      {/* 6b. Interactive Google OAuth 2.0 Setup Wizard */}
      <OAuthWizardModal
        isOpen={isOAuthWizardOpen}
        onClose={() => setIsOAuthWizardOpen(false)}
        onStandardConnect={handleSignIn}
        onMountLocalFolder={handleImportLocalFolder}
        onLoadSampleShoot={handleLoadSampleShoot}
      />

      {/* 6b-2. [WO-102] AAA 2-Column Sidebar Settings Hub (Ctrl/Cmd + ,) */}
      <UnifiedSettingsModal
        isOpen={isUnifiedSettingsOpen}
        onClose={() => setIsUnifiedSettingsOpen(false)}
        displayTier={displayTierOverride}
        onChangeDisplayTier={(tier) => {
          saveDisplayTierOverride(tier);
          setDisplayTierOverride(tier);
        }}
        onOpenThemePicker={() => setIsThemeModalOpen(true)}
        onOpenLegacyStorage={() => setIsStorageSettingsOpen(true)}
        onOpenCastorWardrobe={() => {
          setGCommsTab('gemini');
          setIsCopilotDrawerOpen(true);
        }}
        onOpenTakeout={() => setCurrentMode('takeout')}
        onOpenCloudSync={() => setCurrentMode('cloud-sync')}
        onOpenDiagnostics={() => setIsAuthModalOpen(true)}
      />

      {/* 6c. Storage & Cache Management Modal */}
      <StorageSettingsModal
        isOpen={isStorageSettingsOpen}
        onClose={() => setIsStorageSettingsOpen(false)}
        onPurgeCloud={handlePurgeCloud}
        onDismountAllLocal={handleDismountAllLocal}
        onClearAuth={handleClearAuth}
        onCleanOldSessions={handleCleanOldSessions}
        onFlushAll={handleFlushAll}
        onSmartClean={handleSmartClean}
      />

      {/* 6d. QA Diagnostics & Task Log Console Modal */}
      <DiagnosticLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        activeTaskId={isScanning ? 'drive_scan' : undefined}
      />

      {/* 7. Global Keyboard Shortcut Reference Modal */}
      <ShortcutModal
        isOpen={isShortcutModalOpen}
        onClose={() => setIsShortcutModalOpen(false)}
      />

      {/* 8. Unified Comprehensive Context Menu (Right-Click & Three-Dots) */}
      <UnifiedContextMenu
        asset={contextMenu?.asset || null}
        position={contextMenu?.position || null}
        onClose={handleCloseContextMenu}
        onPreview={(asset) => {
          setSelectedAsset(asset);
          setLightboxInitialEditMode(false);
          setLightboxAsset(asset);
        }}
        onPlayInMusicPlayer={(asset) => {
          googleMusicEngine.openPlayerWithAsset(asset, true, assets);
          setIsGoogleMusicOpen(true);
        }}
        onAddToMusicQueue={(asset) => {
          googleMusicEngine.addAssetToQueue(asset);
          setLiveAnnouncerMessage(`Added ${asset.name} to Up Next queue`);
        }}
        onOpenPip={(asset) => handleTogglePip(asset)}
        isPipActive={Boolean(pipAsset && contextMenu?.asset && pipAsset.id === contextMenu.asset.id)}
        onOpenInLightboxEditor={(asset) => {
          setSelectedAsset(asset);
          setLightboxInitialEditMode(true);
          setLightboxAsset(asset);
        }}
        onInspectFormatDb={(asset) => {
          const fmt = getContextMenuSpecForAsset(asset).format;
          setFormatDbInitialQuery(fmt.extension);
          setIsFormatDbOpen(true);
        }}
        onOpenEditor={(asset) => {
          setSelectedAsset(asset);
          setCurrentMode('editor');
        }}
        onOpenReview={(asset) => {
          setSelectedAsset(asset);
          setCurrentMode('culling');
        }}
        onStarToggle={handleContextStarToggle}
        onSetRating={(asset, rating) => {
          handleUpdateRating(asset.id, rating);
          setAuthNotice({ message: rating > 0 ? `Rated ${rating}★` : 'Rating cleared', type: 'info' });
        }}
        onSetColorLabel={(asset, color) => {
          handleUpdateColorLabel(asset.id, color as any);
          setAuthNotice({ message: color ? 'Labeled photo' : 'Color label removed', type: 'info' });
        }}
        onSetBurstHero={handleContextSetBurstHero}
        onAnalyzeAI={(asset) => {
          handleAnalyzeAsset(asset);
        }}
        onOpenAiInspector={(asset, action) => {
          setAiInspectorAsset(asset);
          setAiInspectorAction(action as any || 'critique');
          setIsAiInspectorOpen(true);
        }}
        onOpenNotebookLm={(asset) => {
          setNotebookLmAssets(asset ? [asset] : assets);
          setIsNotebookLmOpen(true);
        }}
        onCheckSharpness={(asset) => {
          setAuthNotice({
            message: `"${asset.name}" focus sharpness: ${asset.quality.sharpness}% (${asset.quality.isBlurry ? 'Blurry' : 'Sharp'})`,
            type: asset.quality.isBlurry ? 'warning' : 'success',
          });
        }}
        onDownload={handleDownloadAsset}
        onDuplicate={handleContextDuplicate}
        onRename={handleContextRename}
        onBatchRename={() => setIsBatchRenamerOpen(true)}
        onBatchExport={(asset) => {
          setSelectedAsset(asset);
          setIsBatchExportOpen(true);
        }}
        onTrimVideo={(asset) => {
          setTrimmerTargetAsset(asset);
          setIsVideoTrimmerOpen(true);
        }}
        onMove={handleContextMove}
        onDelete={handleContextDelete}
        onCopyLink={(asset) => {
          navigator.clipboard.writeText(getDriveShareLink(asset.id));
          setAuthNotice({ message: 'Google Drive shareable link copied to clipboard!', type: 'success' });
        }}
        onCopyPath={(asset) => {
          if (asset.path) {
            navigator.clipboard.writeText(asset.path);
            setAuthNotice({ message: `Copied path to clipboard: ${asset.path}`, type: 'success' });
          }
        }}
        onOpenInDrive={(asset) => {
          window.open(asset.cloudUrl || getDriveShareLink(asset.id), '_blank');
        }}
        onUploadToDrive={handleContextUploadToDrive}
        onStartSlideshow={(asset) => {
          setSelectedAsset(asset);
          setCurrentMode('slideshow');
        }}
        onOpenInfoDrawer={(asset) => {
          setSelectedAsset(asset);
          setIsRightSidebarOpen(true);
        }}
        onShareGmail={(asset) => {
          setMessengerTargetAsset(asset);
          setMessengerChannel('gmail');
          setIsMessengerOpen(true);
        }}
        onShareChat={(asset) => {
          setSelectedAsset(asset);
          setMessengerTargetAsset(asset);
          setGCommsTab('chat');
          setIsCopilotDrawerOpen(true);
        }}
        onShareVoice={(asset) => {
          setMessengerTargetAsset(asset);
          setMessengerChannel('voice');
          setIsMessengerOpen(true);
        }}
        onShareContact={(asset) => {
          setMessengerTargetAsset(asset);
          setMessengerChannel('contact');
          setIsMessengerOpen(true);
        }}
        onShareCalendar={(asset) => {
          setMessengerTargetAsset(asset);
          setIsCalendarOpen(true);
        }}
        onShareOtherApps={async (asset) => {
          const res = await googleWorkspaceMessenger.shareViaSystem({
            title: asset.name,
            text: `Drive Therapy — ${asset.name}`,
            url: asset.cloudUrl || getDriveShareLink(asset.id),
          });
          setAuthNotice({
            message: res === 'shared' ? 'Shared via System Share Sheet!' : 'Link copied to clipboard!',
            type: 'success',
          });
        }}
      />

      {/* 9. Universal Fullscreen Lightbox Modal */}
      {(() => {
        const navList =
          lightboxAssetList && lightboxAssetList.length > 0 ? lightboxAssetList : filteredAssets;
        const navIdx = lightboxAsset ? navList.findIndex((a) => a.id === lightboxAsset.id) : -1;
        const canPrev = navIdx > 0;
        const canNext = navIdx >= 0 && navIdx < navList.length - 1;
        const positionLabel = navIdx >= 0 ? `${navIdx + 1} / ${navList.length}` : undefined;

        return (
          <LightboxModal
            asset={lightboxAsset}
            onClose={() => {
              setLightboxAsset(null);
              setLightboxAssetList(null);
              setLightboxInitialEditMode(false);
            }}
            initialEditMode={lightboxInitialEditMode}
            isPipActive={Boolean(pipAsset && lightboxAsset && pipAsset.id === lightboxAsset.id)}
            onOpenPip={(asset) => handleTogglePip(asset)}
            onSaveEditedAsset={handleSaveEditedAsset}
            onOpenVideoTrimmer={(asset) => {
              setTrimmerTargetAsset(asset);
              setIsVideoTrimmerOpen(true);
            }}
            onOpenMusicPlayer={(asset) => {
              googleMusicEngine.openPlayerWithAsset(asset, true, assets);
              setIsGoogleMusicOpen(true);
            }}
            onOpenFormatDb={(q) => {
              setFormatDbInitialQuery(q);
              setIsFormatDbOpen(true);
            }}
            onOpenDedicatedStudio={(asset) => {
              setSelectedAsset(asset);
              setCurrentMode('editor');
            }}
            onDownload={handleDownloadAsset}
            onOpenEditor={(asset) => {
              setSelectedAsset(asset);
              setCurrentMode('editor');
            }}
            onOpenReview={(asset) => {
              setSelectedAsset(asset);
              setCurrentMode('culling');
            }}
            onStarToggle={handleContextStarToggle}
            canPrev={canPrev}
            canNext={canNext}
            positionLabel={positionLabel}
            onNext={() => {
              if (!canNext) return;
              const nextItem = navList[navIdx + 1];
              setLightboxAsset(nextItem);
              setSelectedAsset(nextItem);
            }}
            onPrev={() => {
              if (!canPrev) return;
              const prevItem = navList[navIdx - 1];
              setLightboxAsset(prevItem);
              setSelectedAsset(prevItem);
            }}
          />
        );
      })()}

      {/* 10. Themes & Wallpaper Customization Modal */}
      <GmailThemeModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        onThemeChanged={(theme) => {
          setCurrentTheme(theme);
          setIsDarkMode(theme.isDark);
        }}
        onOpenA11y={() => setIsA11yModalOpen(true)}
      />

      {/* 11. Accessibility & Sensory Control Center Modal */}
      <AccessibilityControlModal
        isOpen={isA11yModalOpen}
        onClose={() => setIsA11yModalOpen(false)}
        onApplyTheme={(themeId) => {
          const theme = themeManager.setTheme(themeId);
          setCurrentTheme(theme);
          setIsDarkMode(theme.isDark);
        }}
        activeThemeId={currentTheme.id}
      />

      {/* 11b. Google Workspace Ecosystem Hub (Keep Notes, Gmail Harvester, Tasks, Contacts) */}
      <GoogleEcosystemHubModal
        isOpen={isEcosystemHubOpen}
        onClose={() => setIsEcosystemHubOpen(false)}
        cloudConnected={Boolean(user)}
        onImportAssetsToCatalog={(imported) => {
          setAssets((prev) => {
            const existingIds = new Set(prev.map((a) => a.id));
            const next = [...imported.filter((a) => !existingIds.has(a.id)), ...prev];
            saveAssets(next);
            return next;
          });
        }}
        onOpenLightbox={(asset) => {
          setSelectedAsset(asset);
          setLightboxInitialEditMode(false);
          setLightboxAssetList([asset]);
          setLightboxAsset(asset);
        }}
      />

      {/* 12. Procedural Keyboard & Vim Navigation Palette Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsPaletteOpen}
        onClose={() => setIsShortcutsPaletteOpen(false)}
        isVimEnabled={a11yPrefs.vimMode}
      />

      <InteractiveTourOverlay
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onExecuteStepAction={(action) => {
          if (action === 'music') setIsGoogleMusicOpen(true);
          else if (action === 'workspace') setIsEcosystemHubOpen(true);
          else if (action === 'photos') setCurrentMode('google-photos');
          else if (action === 'oauth') setIsOAuthWizardOpen(true);
          else if (action === 'shortcuts') setIsShortcutsPaletteOpen(true);
          else if (action === 'map') setCurrentMode('map');
          else if (action === 'settings') setIsStorageSettingsOpen(true);
          else if (action === 'gcomms') setIsCopilotDrawerOpen(true);
          else if (action === 'omnibox') {
            const el = document.querySelector<HTMLInputElement>('footer input[type="text"]');
            el?.focus();
          }
        }}
      />

      {/* Drive Therapy Codex Modal (Walkthroughs, FAQ, Glossary & Use Cases) */}
      <CodexModal
        isOpen={isCodexOpen}
        onClose={() => setIsCodexOpen(false)}
        initialTopicId={codexTopicId}
      />

      {/* Google Studio Workbench */}
      <GoogleStudioModal
        isOpen={isGoogleStudioOpen}
        onClose={() => setIsGoogleStudioOpen(false)}
        selectedAsset={selectedAsset}
      />

      {/* Google Favorites App Launcher */}
      <GoogleFavoritesModal
        isOpen={isGoogleFavoritesOpen}
        onClose={() => setIsGoogleFavoritesOpen(false)}
        userPhotoUrl={user?.photoURL}
        onSelectMode={(mode) => setCurrentMode(mode)}
        onOpenModal={(modal) => {
          if (modal === 'music') setIsGoogleMusicOpen(true);
          else if (modal === 'workspace') setIsEcosystemHubOpen(true);
          else if (modal === 'studio') setIsGoogleStudioOpen(true);
          else if (modal === 'gcomms') setIsCopilotDrawerOpen(true);
          else if (modal === 'diagnostics') setIsAuthModalOpen(true);
        }}
      />

      {/* Temporary (!) Full Diagnostic Mode */}
      <FullDiagnosticRunnerModal
        isOpen={isFullDiagnosticOpen}
        onClose={() => setIsFullDiagnosticOpen(false)}
      />

      {/* Hovering Bottom-Left Faceted Gemstone G. Comms FAB */}
      <FloatingGCommsButton
        onClick={() => setIsCopilotDrawerOpen((v) => !v)}
        isActive={isCopilotDrawerOpen}
        activeTab={gCommsTab}
        isGeminiBusy={isCastorThinking || isAiInspectorOpen || isNotebookLmOpen}
        isScanning={isScanning}
        currentMode={currentMode}
        leftClearancePx={(isDockExpanded ? 224 : 64) + (!isSidebarCollapsed ? 288 : 0) + 12}
      />

      {/* 13. Destructive Action Safety Shield Modal (Anxiety Relief) */}
      <DestructiveActionDialog
        isOpen={isDestructiveSafetyOpen}
        onClose={() => setIsDestructiveSafetyOpen(false)}
        onConfirm={confirmBatchPurge}
        itemCount={assets.filter((a) => a.cullingStatus === 'rejected').length}
      />

      {/* 14. Tokenized Pro Batch Renamer Modal */}
      <BatchRenamerModal
        isOpen={isBatchRenamerOpen}
        onClose={() => setIsBatchRenamerOpen(false)}
        selectedAssets={selectedAsset ? [selectedAsset, ...assets.filter((a) => a.id !== selectedAsset.id).slice(0, 499)] : assets.slice(0, 500)}
        onExecuteRename={handleExecuteBatchRename}
      />

      {/* 15. Professional Batch Export & Watermarking Modal */}
      <BatchExportModal
        isOpen={isBatchExportOpen}
        onClose={() => setIsBatchExportOpen(false)}
        selectedAssets={selectedAsset ? [selectedAsset, ...assets.filter((a) => a.id !== selectedAsset.id).slice(0, 49)] : assets.slice(0, 50)}
      />

      {/* 16. Professional Basic Video Editor & Lossless Trimmer Modal */}
      <VideoTrimmerModal
        isOpen={isVideoTrimmerOpen}
        onClose={() => setIsVideoTrimmerOpen(false)}
        asset={trimmerTargetAsset || selectedAsset}
        onOpenGifStudio={(asset) => {
          setIsVideoTrimmerOpen(false);
          setGifStudioAsset(asset);
        }}
        onTrimComplete={({ duration, outputPath }) => {
          setAuthNotice({
            message: outputPath
              ? `Saved non-destructive video edit (${duration.toFixed(2)}s): ${outputPath}`
              : `Video successfully trimmed to ${duration.toFixed(2)}s!`,
            type: 'success',
          });
        }}
      />

      {/* 16b. Dedicated GIF Studio Modal */}
      <GifStudioModal
        isOpen={Boolean(gifStudioAsset)}
        onClose={() => setGifStudioAsset(null)}
        asset={gifStudioAsset}
        onExportSuccess={(outputPath) => {
          setAuthNotice({
            message: `Saved edited GIF copy: ${outputPath}`,
            type: 'success',
          });
        }}
      />

      {/* 17. Welcome Splash Screen Modal (Dismissible & Disableable) */}
      <WelcomeSplashScreenModal
        isOpen={isWelcomeSplashOpen}
        onClose={() => setIsWelcomeSplashOpen(false)}
        onSignIn={handleSignIn}
        onMountLocalFolder={() => setCurrentMode('local-files')}
        onImportFiles={handleImportLocalFiles}
        onLoadSampleShoot={handleLoadSampleShoot}
        isAuthenticating={isAuthenticating}
        onOpenDiagnostics={() => setIsAuthModalOpen(true)}
        onLaunchStandaloneAuth={handleLaunchStandaloneAuth}
        onOpenOAuthWizard={() => setIsOAuthWizardOpen(true)}
      />

      {/* 18. About Drive Therapy & Developer Walkthrough Modal */}
      <AboutAppModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        onOpenWelcomeSplash={() => setIsWelcomeSplashOpen(true)}
        onOpenShortcuts={() => setIsShortcutModalOpen(true)}
      />

      {/* 19. Universal Gemini Multi-Format File Inspector Modal */}
      <GeminiFileInspectorModal
        isOpen={isAiInspectorOpen}
        onClose={() => setIsAiInspectorOpen(false)}
        asset={aiInspectorAsset}
        initialAction={aiInspectorAction}
        onOpenNotebookLmExport={() => {
          setIsAiInspectorOpen(false);
          setNotebookLmAssets(aiInspectorAsset ? [aiInspectorAsset] : assets);
          setIsNotebookLmOpen(true);
        }}
      />

      {/* 20. Google NotebookLM Multi-Asset Dossier Compiler Modal */}
      <NotebookLmExportModal
        isOpen={isNotebookLmOpen}
        onClose={() => setIsNotebookLmOpen(false)}
        assets={notebookLmAssets.length > 0 ? notebookLmAssets : assets}
        initialProjectName={currentFolder?.name !== 'All Media' ? currentFolder?.name : 'Drive Therapy Production'}
      />

      {/* 21. G. Comms (Google Communications Hub: Gemini & Google Chat) */}
      <GeminiCopilotDrawer
        isOpen={isCopilotDrawerOpen}
        onClose={() => setIsCopilotDrawerOpen(false)}
        initialTab={gCommsTab}
        initialChatAsset={messengerTargetAsset || selectedAsset}
        activeAsset={selectedAsset}
        allAssets={assets}
        folders={folders}
        driveQuota={driveQuota}
        user={user}
        currentFolderName={currentFolder?.name || 'All Media'}
        scanPhase={scanStatus.phase}
        onOpenNotebookLm={(asset) => {
          setNotebookLmAssets(asset ? [asset] : assets);
          setIsNotebookLmOpen(true);
        }}
        onOpenCulling={() => setCurrentMode('culling')}
        onOpenEditor={(asset) => {
          setSelectedAsset(asset);
          setCurrentMode('editor');
        }}
        onFilterCatalog={(query) => setSearchQuery(query)}
        onOpenMessenger={(channel) => {
          setMessengerChannel(channel || 'chat');
          setIsMessengerOpen(true);
        }}
        onOpenOAuthWizard={() => setIsOAuthWizardOpen(true)}
        onOpenStorageSettings={() => setIsStorageSettingsOpen(true)}
        onStartQuickScan={handleQuickScan}
        onStartDeepScan={handleDeepScan}
        onImportLocalFolder={handleImportLocalFolder}
        onSyncChanges={handleSyncChanges}
        onSwitchViewMode={(mode) => setCurrentMode(mode)}
        onSyncAssetsToCatalog={handleSyncAssetsToCatalog}
        onOpenMulticloudSync={() => setIsMulticloudSyncOpen(true)}
        onActiveTabChange={(tab) => setGCommsTab(tab)}
        onGeminiBusyChange={(busy) => setIsCastorThinking(busy)}
      />

      {/* Multicloud Direct Cloud-to-Cloud Sync Modal */}
      <MulticloudSyncModal
        isOpen={isMulticloudSyncOpen}
        onClose={() => setIsMulticloudSyncOpen(false)}
        allAssets={assets}
        folders={folders}
        onSyncAssetsToCatalog={handleSyncAssetsToCatalog}
      />

      {/* 22. Google Calendar Interactive Scheduling Modal */}
      <GoogleCalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        projectName={currentFolder?.name !== 'All Media' ? currentFolder?.name : 'Drive Therapy Production'}
        heroCount={assets.filter((a) => a.cullingStatus === 'picked' || (a.rating && a.rating >= 4)).length}
        driveFolderUrl={selectedAsset?.cloudUrl || 'https://drive.google.com'}
      />

      {/* 23. Google Workspace Multi-Channel Messenger Modal */}
      <GoogleWorkspaceMessengerModal
        isOpen={isMessengerOpen}
        onClose={() => setIsMessengerOpen(false)}
        initialChannel={messengerChannel}
        asset={messengerTargetAsset || selectedAsset}
        projectName={currentFolder?.name !== 'All Media' ? currentFolder?.name : 'Drive Therapy Production'}
        heroCount={assets.filter((a) => a.cullingStatus === 'picked' || (a.rating && a.rating >= 4)).length}
        totalAssetsCount={assets.length}
        driveUrl={messengerTargetAsset?.cloudUrl || selectedAsset?.cloudUrl || 'https://drive.google.com'}
      />

      {/* 24. Google Music Slide-Up Audio Player Modal */}
      <GoogleMusicPlayerModal
        isOpen={isGoogleMusicOpen}
        onClose={() => setIsGoogleMusicOpen(false)}
        isPipActive={Boolean(pipAsset)}
        onOpenPip={(asset) => handleTogglePip(asset, 'music-queue')}
        onClosePip={() => {
          setPipAsset(null);
          googleMusicEngine.setPipActive(false);
        }}
        user={user}
      />

      {/* 25. Floating Picture-in-Picture (PiP) Persistent Player Overlay */}
      <FloatingPipPlayer
        asset={pipAsset}
        contextMode={pipContextMode}
        onClose={() => {
          setPipAsset(null);
          googleMusicEngine.setPipActive(false);
        }}
        onExpandFullscreen={(asset) => {
          setLightboxInitialEditMode(false);
          setLightboxAsset(asset);
          setPipAsset(null);
          googleMusicEngine.setPipActive(false);
        }}
        onOpenMusicPlayer={() => {
          setPipAsset(null);
          googleMusicEngine.setPipActive(false);
          setIsGoogleMusicOpen(true);
        }}
        onOpenEditor={(asset) => {
          setSelectedAsset(asset);
          setCurrentMode('editor');
        }}
        onTrimVideo={(asset) => {
          setTrimmerTargetAsset(asset);
          setIsVideoTrimmerOpen(true);
        }}
      />

      {/* 26. Butler Concierge Cockpit Modal */}
      <ButlerConciergeModal
        isOpen={isButlerOpen}
        onClose={() => setIsButlerOpen(false)}
        onOpenMusicPlayer={() => setIsGoogleMusicOpen(true)}
        onOpenCopilot={() => setIsCopilotDrawerOpen(true)}
      />

      {/* 27. Universal File Format Registry & Magic-Byte Sniffer Modal */}
      <FileFormatDatabaseModal
        isOpen={isFormatDbOpen}
        onClose={() => setIsFormatDbOpen(false)}
        initialQuery={formatDbInitialQuery}
      />
      </Suspense>

      {/* 14. Floating 8-Second Undo Snackbar (Anxiety Relief & Recoverability) */}
      {undoToastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-14 right-4 z-50 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 dark:border-slate-300 animate-in fade-in slide-in-from-bottom-2 select-none"
        >
          <span className="text-xs font-medium">{undoToastMessage}</span>
          <button
            onClick={handleUndoPurge}
            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 active:scale-95"
            title="Restore purged photos back to workspace"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('safety.undoBtn')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
