/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gemini Workspace Grounding & Offline RAG Context Builder
 * Harmonizes Gemini Chat with:
 *  1. User Search Indexes (LitHybridSearchIndex stats, folders, tags, live asset retrieval)
 *  2. Storage Providers & Quota (Google Drive quota/plan, enabled backends, cloud vs. local breakdown)
 *  3. Google Workspace OAuth Setup (active user, token health, granted scopes, active vs. missing capabilities)
 *
 * Strictly redacts raw OAuth tokens and storage credentials from all snapshots and prompts.
 */

import type { FolderNode, MediaAsset, OAuthTokenRecord } from '../types';
import { litSearchIndex, type FastIndexStats } from './fastSearchIndex';
import { loadStorageBackends, type StorageBackendConfig } from './storageProviderRegistry';
import {
  classifyAccountPlanLabel,
  resolvePostOAuthCapabilities,
  type ResolvedCapability,
} from './googleServiceCapabilities';
import {
  loadOAuthToken,
  isTokenExpired,
  isTokenExpiringSoon,
  getTokenRemainingSeconds,
} from './oauthStorage';
import type { ButlerState } from './butler/types';
import { buildCastorPersonaDirective } from './castorAgent';

export interface DriveQuotaSnapshot {
  usage: number;
  limit: number;
  usageInDrive: number;
  usageInDriveTrash?: number;
  percentage: number;
}

export interface WorkspaceUserIdentity {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

export type WorkspaceSuggestedActionType =
  | 'open_culling'
  | 'open_editor'
  | 'open_notebooklm'
  | 'filter_catalog'
  | 'open_oauth'
  | 'open_storage'
  | 'start_quick_scan'
  | 'start_deep_scan'
  | 'sync_drive_changes'
  | 'mount_local_folder'
  | 'request_incremental_scope'
  | 'open_google_photos'
  | 'open_local_files'
  | 'open_drive_browser'
  | 'open_photos_picker'
  | 'grant_local_search'
  | 'sync_found_assets'
  | 'open_multicloud_sync';

export interface WorkspaceSuggestedAction {
  type: WorkspaceSuggestedActionType;
  label: string;
  payload?: string | MediaAsset | MediaAsset[];
}

export interface WorkspaceActionRequest {
  id: string;
  kind: 'access_request' | 'user_action' | 'navigation';
  type: WorkspaceSuggestedActionType;
  label: string;
  description?: string;
  payload?: string | MediaAsset | MediaAsset[];
}

export interface MountedOsLocation {
  id: string;
  name: string;
  path: string;
  isIndexed: boolean;
}

export interface GeminiWorkspaceSnapshot {
  capturedAt: string;
  index: {
    liveCount: number;
    fossilCount: number;
    uniqueTokens: number;
    uniqueTrigrams: number;
    lastBuildMs: number;
    totalAssets: number;
    totalSizeBytes: number;
    categoryCounts: Record<string, number>;
    sourceCounts: Record<string, number>;
    pickedCount: number;
    rejectedCount: number;
    blurryCount: number;
    highRatedCount: number;
    folderCount: number;
    topFolders: Array<{ name: string; source: string; itemCount: number }>;
    topTags: Array<{ tag: string; count: number }>;
    largestAssets: Array<{ id: string; name: string; sizeBytes: number; category: string; source: string }>;
    currentFolderName: string;
    scanPhase: string;
  };
  storage: {
    driveQuota: (DriveQuotaSnapshot & { planLabel: string }) | null;
    activeBackendName: string;
    enabledBackends: Array<{ id: string; name: string; type: string }>;
    mountedOsLocations: MountedOsLocation[];
    localAssetCount: number;
    cloudAssetCount: number;
    photosAssetCount: number;
  };
  oauth: {
    isSignedIn: boolean;
    userName: string | null;
    userEmail: string | null;
    tokenStatus: 'valid' | 'expiring_soon' | 'expired' | 'none';
    tokenRemainingSeconds: number;
    tokenProvider: string | null;
    grantedScopes: string[];
    activeCapabilities: Array<{ id: string; name: string; category: string }>;
    missingIncrementalCapabilities: Array<{ id: string; name: string; incrementalScopeKey?: string }>;
    butlerServices: Record<string, string>;
  };
  activeAsset: {
    id: string;
    name: string;
    category: string;
    source: string;
    sizeBytes: number;
    rating: number;
    cullingStatus: string;
    tags: string[];
  } | null;
}

export interface BuildSnapshotInput {
  allAssets: MediaAsset[];
  folders?: FolderNode[];
  activeAsset?: MediaAsset | null;
  driveQuota?: DriveQuotaSnapshot | null;
  user?: WorkspaceUserIdentity | null;
  currentFolderName?: string;
  scanPhase?: string;
  mountedOsLocations?: Array<{ id: string; name: string; path: string }>;
  // Optional overrides for deterministic unit testing
  indexStats?: FastIndexStats;
  storageBackends?: StorageBackendConfig[];
  oauthToken?: OAuthTokenRecord | null;
  butlerState?: ButlerState | null;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'where', 'when', 'which',
  'show', 'find', 'search', 'list', 'give', 'tell', 'about', 'have', 'does', 'into',
  'your', 'mine', 'please', 'can', 'you', 'are', 'how', 'many', 'much', 'all', 'any',
  'files', 'file', 'assets', 'asset', 'index', 'indexed', 'catalog', 'storage', 'drive',
  'google', 'workspace', 'oauth', 'status', 'setup', 'check', 'audit', 'report', 'summary',
]);

export function formatBytesCompact(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val >= 100 || idx === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[idx]}`;
}

export function buildGeminiWorkspaceSnapshot(input: BuildSnapshotInput): GeminiWorkspaceSnapshot {
  const assets = Array.isArray(input.allAssets) ? input.allAssets : [];
  const folders = Array.isArray(input.folders) ? input.folders : [];
  const stats = input.indexStats || litSearchIndex.getStats();
  const backends = input.storageBackends || loadStorageBackends();
  const tokenRec = input.oauthToken !== undefined ? input.oauthToken : loadOAuthToken();
  const butler = input.butlerState || null;

  const categoryCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  const tagFreq = new Map<string, number>();

  let totalSizeBytes = 0;
  let pickedCount = 0;
  let rejectedCount = 0;
  let blurryCount = 0;
  let highRatedCount = 0;

  for (const a of assets) {
    const cat = a.category || 'image';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

    const src = a.source || 'local';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;

    totalSizeBytes += a.sizeBytes || a.size || 0;
    if (a.cullingStatus === 'picked' || a.isPicked) pickedCount++;
    if (a.cullingStatus === 'rejected' || a.isRejected) rejectedCount++;
    if (a.quality?.isBlurry) blurryCount++;
    if ((a.rating || 0) >= 4) highRatedCount++;

    for (const tag of a.tags || []) {
      const clean = (tag || '').trim();
      if (clean) tagFreq.set(clean, (tagFreq.get(clean) || 0) + 1);
    }
  }

  const topTags = Array.from(tagFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tag, count]) => ({ tag, count }));

  const topFolders = folders
    .filter((f) => f && f.name && f.name !== 'All Media')
    .sort((a, b) => (b.itemCount || 0) - (a.itemCount || 0))
    .slice(0, 8)
    .map((f) => ({ name: f.name, source: f.source, itemCount: f.itemCount || 0 }));

  const largestAssets = [...assets]
    .sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0))
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      name: a.name,
      sizeBytes: a.sizeBytes || 0,
      category: a.category,
      source: a.source,
    }));

  const enabledBackends = backends
    .filter((b) => b.enabled)
    .map((b) => ({ id: b.id, name: b.name, type: b.type }));

  const indexedPathsLower = new Set(
    folders
      .filter((f) => f && f.source === 'local' && f.path)
      .map((f) => f.path.toLowerCase())
  );
  const mountedOsLocations: MountedOsLocation[] = (input.mountedOsLocations || []).map((loc) => ({
    id: loc.id,
    name: loc.name,
    path: loc.path,
    isIndexed:
      indexedPathsLower.has(loc.path.toLowerCase()) ||
      assets.some((a) => a.source === 'local' && (a.path || '').toLowerCase().startsWith(loc.path.toLowerCase())),
  }));

  const driveQuota = input.driveQuota
    ? {
        ...input.driveQuota,
        planLabel: classifyAccountPlanLabel(input.driveQuota.limit),
      }
    : null;

  // Resolve OAuth identity strictly from live auth state (never guest placeholder)
  const butlerAcc =
    butler?.activeAccount && butler.activeAccount.email !== 'guest@drivetherapy.local'
      ? butler.activeAccount
      : null;

  const userEmail = input.user?.email || tokenRec?.userEmail || butlerAcc?.email || null;
  const userName = input.user?.displayName || butlerAcc?.name || null;

  let tokenStatus: 'valid' | 'expiring_soon' | 'expired' | 'none' = 'none';
  let tokenRemainingSeconds = 0;
  if (tokenRec?.accessToken) {
    tokenRemainingSeconds = getTokenRemainingSeconds(tokenRec);
    if (isTokenExpired(tokenRec, 0)) {
      tokenStatus = 'expired';
    } else if (isTokenExpiringSoon(tokenRec, 300)) {
      tokenStatus = 'expiring_soon';
    } else {
      tokenStatus = 'valid';
    }
  }

  const isSignedIn = Boolean(userEmail || tokenStatus === 'valid' || tokenStatus === 'expiring_soon');
  const grantedScopes = Array.isArray(tokenRec?.scopes) ? tokenRec.scopes.filter(Boolean) : [];
  const resolvedCaps: ResolvedCapability[] = resolvePostOAuthCapabilities(grantedScopes);

  const activeCapabilities = resolvedCaps
    .filter((c) => c.status === 'active')
    .map((c) => ({ id: c.id, name: c.name, category: c.category }));

  const missingIncrementalCapabilities = resolvedCaps
    .filter((c) => c.status === 'ready-incremental')
    .map((c) => ({ id: c.id, name: c.name, incrementalScopeKey: c.incrementalScopeKey }));

  const butlerServices: Record<string, string> = {};
  if (butler?.services) {
    for (const [k, svc] of Object.entries(butler.services)) {
      butlerServices[k] = svc.status;
    }
  }

  return {
    capturedAt: new Date().toISOString(),
    index: {
      liveCount: stats.liveCount || assets.length,
      fossilCount: stats.fossilCount || 0,
      uniqueTokens: stats.uniqueTokens || 0,
      uniqueTrigrams: stats.uniqueTrigrams || 0,
      lastBuildMs: stats.lastBuildMs || 0,
      totalAssets: assets.length,
      totalSizeBytes,
      categoryCounts,
      sourceCounts,
      pickedCount,
      rejectedCount,
      blurryCount,
      highRatedCount,
      folderCount: folders.length,
      topFolders,
      topTags,
      largestAssets,
      currentFolderName: input.currentFolderName || 'All Media',
      scanPhase: input.scanPhase || 'idle',
    },
    storage: {
      driveQuota,
      activeBackendName: enabledBackends[0]?.name || 'Google Drive',
      enabledBackends,
      mountedOsLocations,
      localAssetCount: sourceCounts.local || 0,
      cloudAssetCount: sourceCounts.cloud || 0,
      photosAssetCount: sourceCounts.photos || 0,
    },
    oauth: {
      isSignedIn,
      userName,
      userEmail,
      tokenStatus,
      tokenRemainingSeconds,
      tokenProvider: tokenRec?.provider || null,
      grantedScopes,
      activeCapabilities,
      missingIncrementalCapabilities,
      butlerServices,
    },
    activeAsset: input.activeAsset
      ? {
          id: input.activeAsset.id,
          name: input.activeAsset.name,
          category: input.activeAsset.category,
          source: input.activeAsset.source,
          sizeBytes: input.activeAsset.sizeBytes || 0,
          rating: input.activeAsset.rating || 0,
          cullingStatus: input.activeAsset.cullingStatus || 'unrated',
          tags: input.activeAsset.tags || [],
        }
      : null,
  };
}

/**
 * Retrieves the most relevant indexed assets for a natural-language user prompt
 * using LitHybridSearchIndex plus metadata scoring (tags, path, category, rating, source).
 */
export function retrieveIndexedMatchesForPrompt(
  prompt: string,
  allAssets: MediaAsset[],
  limit = 8
): MediaAsset[] {
  const clean = (prompt || '').trim().toLowerCase();
  if (!clean || allAssets.length === 0) return [];

  const terms = clean
    .split(/[^a-z0-9._-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  const wantsRaw = /\b(raw|dng|cr2|cr3|nef|arw|raf)\b/.test(clean);
  const wantsVideo = /\b(video|videos|clip|clips|mp4|mov|4k)\b/.test(clean);
  const wantsAudio = /\b(audio|music|song|songs|mp3|flac|wav|memo)\b/.test(clean);
  const wantsDoc = /\b(doc|docs|document|documents|pdf|sheet|spreadsheet|csv)\b/.test(clean);
  const wantsPicked = /\b(pick|picked|hero|heroes|best|favorite|favorites|4\s*star|5\s*star)\b/.test(clean);
  const wantsBlurry = /\b(blur|blurry|soft|out of focus|reject|rejected)\b/.test(clean);
  const wantsLocal = /\b(local|disk|computer|desktop|pictures|downloads)\b/.test(clean);
  const wantsCloud = /\b(cloud|drive)\b/.test(clean);

  // Pull fast candidates from LitHybridSearchIndex when available
  const litHits = new Map<string, number>();
  for (const term of terms.slice(0, 5)) {
    const found = litSearchIndex.search(term);
    for (const a of found) {
      litHits.set(a.id, (litHits.get(a.id) || 0) + 4);
    }
  }

  const scored: Array<{ asset: MediaAsset; score: number }> = [];

  for (const a of allAssets) {
    let score = litHits.get(a.id) || 0;
    const nameL = (a.name || '').toLowerCase();
    const pathL = (a.path || '').toLowerCase();
    const extL = (a.extension || '').toLowerCase();
    const tagsL = (a.tags || []).map((t) => t.toLowerCase());
    const descL = (a.aiDescription || '').toLowerCase();
    const camL = (a.exif?.camera || a.cameraModel || '').toLowerCase();

    for (const term of terms) {
      if (nameL.includes(term)) score += 6;
      if (pathL.includes(term)) score += 3;
      if (extL === term) score += 5;
      if (tagsL.some((t) => t.includes(term))) score += 5;
      if (descL.includes(term)) score += 3;
      if (camL.includes(term)) score += 4;
    }

    if (wantsRaw && a.category === 'raw') score += 5;
    if (wantsVideo && a.category === 'video') score += 5;
    if (wantsAudio && a.category === 'audio') score += 5;
    if (wantsDoc && (a.category === 'document' || a.category === 'data')) score += 5;
    if (wantsPicked && (a.cullingStatus === 'picked' || (a.rating || 0) >= 4)) score += 5;
    if (wantsBlurry && (a.quality?.isBlurry || a.cullingStatus === 'rejected')) score += 5;
    if (wantsLocal && a.source === 'local') score += 3;
    if (wantsCloud && a.source === 'cloud') score += 2;

    if (score > 0) {
      scored.push({ asset: a, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || (b.asset.rating || 0) - (a.asset.rating || 0))
    .slice(0, limit)
    .map((s) => s.asset);
}

/**
 * Formats a compact, strictly non-sensitive system grounding block for Gemini 2.5 Flash.
 * Never includes OAuth access tokens, refresh tokens, or storage backend secrets.
 */
export function formatWorkspaceSystemPrompt(
  snapshot: GeminiWorkspaceSnapshot,
  matchedAssets: MediaAsset[] = [],
  castorOutfitId = 'C-01'
): string {
  const { index, storage, oauth, activeAsset } = snapshot;

  const quotaLine = storage.driveQuota
    ? `${formatBytesCompact(storage.driveQuota.usage)} / ${formatBytesCompact(storage.driveQuota.limit)} (${storage.driveQuota.percentage}%, Trash: ${formatBytesCompact(storage.driveQuota.usageInDriveTrash || 0)}, Plan: ${storage.driveQuota.planLabel})`
    : 'Unavailable (Drive not synced or local-only session)';

  const catSummary = Object.entries(index.categoryCounts)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ') || 'none';

  const topFolderSummary = index.topFolders
    .map((f) => `${f.name} (${f.itemCount}, ${f.source})`)
    .join('; ') || 'none';

  const topTagSummary = index.topTags
    .map((t) => `${t.tag}(${t.count})`)
    .join(', ') || 'none';

  const enabledBackendsLine = storage.enabledBackends
    .map((b) => `${b.name} [${b.type}]`)
    .join(', ') || 'none';

  const mountedOsLine =
    storage.mountedOsLocations.length > 0
      ? storage.mountedOsLocations
          .map((loc) => `${loc.name} (${loc.path}) [${loc.isIndexed ? 'indexed' : 'mounted-unindexed'}]`)
          .join('; ')
      : 'not polled';

  const activeCapsLine = oauth.activeCapabilities.map((c) => c.name).join(', ') || 'Local CPU Only';
  const missingCapsLine =
    oauth.missingIncrementalCapabilities.map((c) => c.name).join(', ') || 'None';

  const matchedLines = matchedAssets
    .slice(0, 8)
    .map(
      (a) =>
        `- ${a.name} (${a.category}, ${a.source}, ${formatBytesCompact(a.sizeBytes || 0)}, rating:${a.rating || 0}, status:${a.cullingStatus}, path:${a.path || '/'}, tags:[${(a.tags || []).slice(0, 4).join(', ')}])`
    )
    .join('\n');

  return [
    buildCastorPersonaDirective(castorOutfitId),
    'Answer concisely using ONLY the verified live workspace telemetry below. Never fabricate files, quotas, or credentials.',
    '',
    '=== USER INDEX TELEMETRY ===',
    `Indexed Assets: ${index.totalAssets} (LiveIndex: ${index.liveCount}, FossilIndex: ${index.fossilCount}, Tokens: ${index.uniqueTokens}, Trigrams: ${index.uniqueTrigrams}, Build: ${index.lastBuildMs}ms)`,
    `Total Indexed Size: ${formatBytesCompact(index.totalSizeBytes)} | Active Folder: ${index.currentFolderName} | Scan Phase: ${index.scanPhase}`,
    `Categories: ${catSummary}`,
    `Curation: Picked=${index.pickedCount}, High-Rated(4-5★)=${index.highRatedCount}, Blurry=${index.blurryCount}, Rejected=${index.rejectedCount}`,
    `Top Folders (${index.folderCount} total): ${topFolderSummary}`,
    `Top Tags: ${topTagSummary}`,
    '',
    '=== STORAGE TELEMETRY ===',
    `Google Drive Quota: ${quotaLine}`,
    `Sources Breakdown: Cloud=${storage.cloudAssetCount}, Google Photos=${storage.photosAssetCount}, Local OS=${storage.localAssetCount}`,
    `Enabled Storage Backends: ${enabledBackendsLine}`,
    `Live Mounted OS Locations: ${mountedOsLine}`,
    '',
    '=== GOOGLE WORKSPACE OAUTH SETUP ===',
    `Signed In: ${oauth.isSignedIn ? `${oauth.userName || 'User'} <${oauth.userEmail || 'verified'}>` : 'No (Local/Offline Session)'}`,
    `OAuth Token Health: ${oauth.tokenStatus}${oauth.tokenRemainingSeconds > 0 ? ` (${Math.round(oauth.tokenRemainingSeconds / 60)} min remaining)` : ''}`,
    `Granted Scopes Count: ${oauth.grantedScopes.length}`,
    `Active Capabilities: ${activeCapsLine}`,
    `Available Incremental Scopes Not Yet Granted: ${missingCapsLine}`,
    activeAsset
      ? `\n=== ATTACHED / SELECTED ASSET ===\n${activeAsset.name} (${activeAsset.category}, ${activeAsset.source}, ${formatBytesCompact(activeAsset.sizeBytes)}, rating:${activeAsset.rating}, status:${activeAsset.cullingStatus}, tags:[${activeAsset.tags.join(', ')}])`
      : '',
    matchedLines ? `\n=== TOP INDEXED MATCHES FOR THIS QUERY ===\n${matchedLines}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Deterministic Zero-Key Offline Grounded Responder.
 * Guarantees accurate index, storage, and Google Workspace OAuth intelligence even with no API key.
 */
export function generateGroundedOfflineReply(
  prompt: string,
  snapshot: GeminiWorkspaceSnapshot,
  matchedAssets: MediaAsset[] = []
): { text: string; suggestedAction?: WorkspaceSuggestedAction } {
  const q = (prompt || '').toLowerCase();
  const { index, storage, oauth } = snapshot;

  // 1. Google Workspace OAuth / Auth / Scopes inquiry
  if (/\b(oauth|auth|sign\s?in|login|scope|scopes|workspace|token|permission|permissions|connect|account)\b/.test(q)) {
    const statusLine = oauth.isSignedIn
      ? `Connected as **${oauth.userName || oauth.userEmail}** (${oauth.userEmail || 'active session'}) — Token: **${oauth.tokenStatus}**${oauth.tokenRemainingSeconds > 0 ? ` (${Math.round(oauth.tokenRemainingSeconds / 60)}m left)` : ''}`
      : 'Not currently signed in to Google Workspace (running in Zero-Key Local/Offline mode).';

    const activeList = oauth.activeCapabilities.map((c) => `- ✅ ${c.name}`).join('\n');
    const missingList =
      oauth.missingIncrementalCapabilities.length > 0
        ? oauth.missingIncrementalCapabilities.map((c) => `- ➕ ${c.name}`).join('\n')
        : '- All free Workspace incremental scopes are active.';

    return {
      text: `### Google Workspace OAuth Status\n${statusLine}\n\n**Active Capabilities (${oauth.activeCapabilities.length}):**\n${activeList}\n\n**Optional Incremental Scopes Ready to Grant (${oauth.missingIncrementalCapabilities.length}):**\n${missingList}`,
      suggestedAction: {
        type: 'open_oauth',
        label: oauth.isSignedIn ? 'Inspect OAuth & Grant Scopes' : 'Connect Google Workspace (OAuth Wizard)',
      },
    };
  }

  // 2. Storage / Quota / Space / Providers inquiry
  if (/\b(storage|quota|space|disk|gb|tb|provider|providers|backend|backends|largest|biggest|trash|clean|janitor)\b/.test(q)) {
    const quotaText = storage.driveQuota
      ? `- **Google Drive Quota**: **${formatBytesCompact(storage.driveQuota.usage)}** / **${formatBytesCompact(storage.driveQuota.limit)}** (**${storage.driveQuota.percentage}%** used · ${storage.driveQuota.planLabel})\n- **Drive Trash**: ${formatBytesCompact(storage.driveQuota.usageInDriveTrash || 0)}`
      : `- **Google Drive Quota**: Not synced yet (sign in with Google Drive OAuth to pull live quota telemetry).`;

    const backendsText = storage.enabledBackends
      .map((b) => `- **${b.name}** (\`${b.type}\`)`)
      .join('\n');

    const largestText =
      index.largestAssets.length > 0
        ? index.largestAssets
            .map((a) => `- **${a.name}** — ${formatBytesCompact(a.sizeBytes)} (${a.source}/${a.category})`)
            .join('\n')
        : '- No indexed files yet.';

    return {
      text: `### Storage & Quota Audit\n${quotaText}\n- **Catalog Footprint**: **${formatBytesCompact(index.totalSizeBytes)}** across **${index.totalAssets.toLocaleString()}** indexed files (Cloud: ${storage.cloudAssetCount}, Photos: ${storage.photosAssetCount}, Local OS: ${storage.localAssetCount})\n\n**Enabled Storage Providers (${storage.enabledBackends.length}):**\n${backendsText}\n\n**Largest Indexed Assets:**\n${largestText}`,
      suggestedAction: {
        type: 'open_storage',
        label: 'Open Storage & Provider Settings',
      },
    };
  }

  // 3. NotebookLM Dossier inquiry
  if (/\b(notebooklm|dossier|brief|study)\b/.test(q)) {
    return {
      text: `### NotebookLM Dossier Readiness\n- **Indexed Catalog**: **${index.totalAssets.toLocaleString()}** items (${index.pickedCount} picked, ${index.highRatedCount} rated 4★+)\n- **Active Folder**: **${index.currentFolderName}**\n- **Top Tags**: ${index.topTags.slice(0, 6).map((t) => `#${t.tag}`).join(' ') || 'None tagged yet'}\n\nYour indexed metadata and assets are ready to compile into a NotebookLM dossier.`,
      suggestedAction: {
        type: 'open_notebooklm',
        label: 'Open NotebookLM Compiler',
      },
    };
  }

  // 4. Culling / Quality inquiry
  if (/\b(cull|culling|blur|blurry|sharp|pick|picked|reject|rejected|rating|best)\b/.test(q)) {
    return {
      text: `### Catalog Curation & Quality Assessment\n- **Total Indexed**: **${index.totalAssets.toLocaleString()}** files\n- **Picked Heroes**: **${index.pickedCount}** · **4–5★ Rated**: **${index.highRatedCount}**\n- **Detected Blurry**: **${index.blurryCount}** · **Rejected**: **${index.rejectedCount}**\n\nEnter the Culling Room to review bursts and filter out soft frames non-destructively.`,
      suggestedAction: {
        type: 'open_culling',
        label: 'Enter Culling Room',
      },
    };
  }

  // 5. Empty index guidance
  if (index.totalAssets === 0) {
    return {
      text: `### Your Search Index Is Currently Empty\n- **Workspace OAuth**: ${oauth.isSignedIn ? `Connected (${oauth.userEmail})` : 'Not connected'}\n- **Enabled Storage**: ${storage.enabledBackends.map((b) => b.name).join(', ')}\n\nRun a **Quick 300 Scan** (fast preview) or **Deep Scan** to populate your hybrid search index, or mount a local folder.`,
      suggestedAction: oauth.isSignedIn
        ? { type: 'start_quick_scan', label: 'Run Quick 300 Drive Scan' }
        : { type: 'open_oauth', label: 'Connect Google Workspace' },
    };
  }

  // 6. Specific indexed matches found for the user's prompt
  if (matchedAssets.length > 0) {
    const matchList = matchedAssets
      .slice(0, 6)
      .map(
        (a) =>
          `- **${a.name}** (${a.category} · ${a.source} · ${formatBytesCompact(a.sizeBytes || 0)}${a.rating ? ` · ${a.rating}★` : ''})`
      )
      .join('\n');

    const queryTokens = prompt
      .replace(/[^a-zA-Z0-9._\-\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !STOP_WORDS.has(w.toLowerCase()))
      .slice(0, 3)
      .join(' ');

    return {
      text: `### Indexed Catalog Matches (${matchedAssets.length} found)\nSearched **${index.liveCount.toLocaleString()}** live indexed items (${index.uniqueTokens.toLocaleString()} tokens, ${index.uniqueTrigrams.toLocaleString()} trigrams):\n\n${matchList}\n\nClick any matched asset chip below to inspect or attach it, or filter the main catalog.`,
      suggestedAction: queryTokens
        ? { type: 'filter_catalog', label: `Filter Catalog for "${queryTokens}"`, payload: queryTokens }
        : { type: 'open_editor', label: `Inspect ${matchedAssets[0].name}`, payload: matchedAssets[0] },
    };
  }

  // 7. General Workspace & Index Overview
  const catSummary = Object.entries(index.categoryCounts)
    .map(([k, v]) => `${k}: **${v}**`)
    .join(' · ');

  return {
    text: `### Harmonized Workspace Overview\n- **Search Index**: **${index.totalAssets.toLocaleString()}** assets (${index.uniqueTokens.toLocaleString()} tokens, **${formatBytesCompact(index.totalSizeBytes)}**) across **${index.folderCount}** folders\n- **Breakdown**: ${catSummary}\n- **Storage**: ${storage.driveQuota ? `Drive ${storage.driveQuota.percentage}% used (${formatBytesCompact(storage.driveQuota.usage)} / ${formatBytesCompact(storage.driveQuota.limit)})` : `${storage.enabledBackends.length} storage backends enabled`}\n- **Google Workspace OAuth**: ${oauth.isSignedIn ? `Signed in as **${oauth.userEmail}** (${oauth.activeCapabilities.length} active capabilities)` : 'Offline / Local Session'}\n\nAsk me to **search your indexed files**, **audit storage & quota**, or **check Google Workspace OAuth scopes**.`,
    suggestedAction: oauth.isSignedIn
      ? { type: 'open_storage', label: 'Manage Storage & Index' }
      : { type: 'open_oauth', label: 'Connect Google Workspace' },
  };
}
