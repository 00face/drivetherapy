/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Cloud & Workspace Free vs. Paid Service Capabilities Matrix
 * Verified against Google's November 2026 pricing & OAuth scope documentation.
 * Automatically classifies what is active after OAuth login with $0 Cloud Billing.
 */

export type ServiceBillingTier = 'free-no-billing' | 'free-tier-billing-required' | 'workspace-paid' | 'local-cpu';

export type CapabilityStatus = 'active' | 'ready-incremental' | 'billing-optional' | 'workspace-upgrade';

export interface GoogleServiceCapability {
  id: string;
  name: string;
  category: 'storage' | 'workspace' | 'ai' | 'maps' | 'cloud';
  billingTier: ServiceBillingTier;
  requiredScopes: string[];
  freeAllowance: string;
  driveTherapyBenefit: string;
  incrementalScopeKey?: string;
  consoleLibraryUrl?: string;
}

export interface ResolvedCapability extends GoogleServiceCapability {
  status: CapabilityStatus;
  grantedScopesMatched: string[];
}

export const GOOGLE_SERVICE_CAPABILITIES: GoogleServiceCapability[] = [
  {
    id: 'drive-api',
    name: 'Google Drive API v3 & Changes Sync',
    category: 'storage',
    billingTier: 'free-no-billing',
    requiredScopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
    ],
    freeAllowance: 'Standard quota (1M units/min/project) · $0',
    driveTherapyBenefit: 'Fast delta sync, file browsing, uploads, and non-destructive metadata',
    consoleLibraryUrl: 'https://console.cloud.google.com/apis/library/drive.googleapis.com',
  },
  {
    id: 'google-picker',
    name: 'Google Picker & Docs/Sheets/Slides Export',
    category: 'workspace',
    billingTier: 'free-no-billing',
    requiredScopes: ['https://www.googleapis.com/auth/drive.file'],
    freeAllowance: 'Free · Non-sensitive scope · $0',
    driveTherapyBenefit: 'Privacy-first file selection & PDF/DOCX/CSV/PPTX export',
    consoleLibraryUrl: 'https://console.cloud.google.com/apis/library/picker.googleapis.com',
  },
  {
    id: 'google-photos',
    name: 'Google Photos Library & Picker',
    category: 'storage',
    billingTier: 'free-no-billing',
    requiredScopes: [
      'https://www.googleapis.com/auth/photoslibrary.readonly',
      'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
    ],
    freeAllowance: 'Free · $0',
    driveTherapyBenefit: 'Albums, bursts, and photo culling directly from Google Photos',
    consoleLibraryUrl: 'https://console.cloud.google.com/apis/library/photospicker.googleapis.com',
  },
  {
    id: 'google-tasks',
    name: 'Google Tasks',
    category: 'workspace',
    billingTier: 'free-no-billing',
    requiredScopes: ['https://www.googleapis.com/auth/tasks'],
    freeAllowance: 'Free · No Cloud Billing · $0',
    driveTherapyBenefit: 'Link culling checklists and shoot deliverables to Tasks',
    incrementalScopeKey: 'tasks',
    consoleLibraryUrl: 'https://console.cloud.google.com/apis/library/tasks.googleapis.com',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    category: 'workspace',
    billingTier: 'free-no-billing',
    requiredScopes: ['https://www.googleapis.com/auth/calendar.events'],
    freeAllowance: 'Free · No Cloud Billing · $0',
    driveTherapyBenefit: 'Attach Drive shoots & deadlines to Calendar milestones',
    incrementalScopeKey: 'calendar',
    consoleLibraryUrl: 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com',
  },
  {
    id: 'google-contacts',
    name: 'Google People & Contacts',
    category: 'workspace',
    billingTier: 'free-no-billing',
    requiredScopes: ['https://www.googleapis.com/auth/contacts.readonly'],
    freeAllowance: 'Free · No Cloud Billing · $0',
    driveTherapyBenefit: 'Autocomplete recipients for Drive Share & G. Comms',
    incrementalScopeKey: 'contacts',
    consoleLibraryUrl: 'https://console.cloud.google.com/apis/library/people.googleapis.com',
  },
  {
    id: 'gmail-attachments',
    name: 'Gmail Attachment Harvester',
    category: 'workspace',
    billingTier: 'free-no-billing',
    requiredScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    freeAllowance: 'Free · No Cloud Billing · $0',
    driveTherapyBenefit: 'Import photo/PDF email attachments straight into catalog',
    incrementalScopeKey: 'gmail',
    consoleLibraryUrl: 'https://console.cloud.google.com/apis/library/gmail.googleapis.com',
  },
  {
    id: 'local-cpu-models',
    name: 'Local CPU Mini-Models (Tesseract + Transformers + Ollama)',
    category: 'ai',
    billingTier: 'local-cpu',
    requiredScopes: [],
    freeAllowance: '100% Free · Offline CPU WASM / Local Ollama',
    driveTherapyBenefit: 'Zero-cost OCR, summaries, captions, and code helpers on low-end CPUs',
  },
  {
    id: 'google-maps-platform',
    name: 'Google Maps Platform (+ FOSS OSM/Carto Fallback)',
    category: 'maps',
    billingTier: 'free-tier-billing-required',
    requiredScopes: [],
    freeAllowance: '10k Essentials / 5k Pro free events/mo (OSM is $0 zero-key)',
    driveTherapyBenefit: 'Interactive geotagged photo mapping & GeoJSON/GPX/KML layers',
    consoleLibraryUrl: 'https://console.cloud.google.com/apis/library/maps-backend.googleapis.com',
  },
  {
    id: 'gcs-archive',
    name: 'Google Cloud Storage (GCS Cold Archive)',
    category: 'cloud',
    billingTier: 'free-tier-billing-required',
    requiredScopes: ['https://www.googleapis.com/auth/devstorage.read_only'],
    freeAllowance: '5 GB-months free in eligible US regions (Cloud Billing req.)',
    driveTherapyBenefit: 'Browse & archive RAW/4K masters outside personal Drive quota',
    incrementalScopeKey: 'gcs',
  },
  {
    id: 'workspace-enterprise',
    name: 'Shared Drives, Drive Labels & Vault',
    category: 'workspace',
    billingTier: 'workspace-paid',
    requiredScopes: ['https://www.googleapis.com/auth/drive'],
    freeAllowance: 'Requires Workspace Business Standard+ / Enterprise seat',
    driveTherapyBenefit: 'Team pooled storage (2TB–5TB/user) and governed labels',
  },
];

export function classifyAccountPlanLabel(quotaLimitBytes?: number): string {
  if (!quotaLimitBytes || quotaLimitBytes <= 0) return 'Standard / Unknown Quota';
  const gb = quotaLimitBytes / (1024 * 1024 * 1024);
  if (gb <= 20) return 'Google Account Free (15 GB)';
  if (gb <= 150) return 'Google One Basic (100 GB)';
  if (gb <= 500) return 'Google AI Plus / One (200–400 GB)';
  if (gb <= 2500) return 'Google One / Workspace Standard (2 TB)';
  if (gb <= 6000) return 'Google AI Pro / Workspace Plus (5 TB)';
  return 'Google AI Ultra / Enterprise (20+ TB)';
}

export function resolvePostOAuthCapabilities(grantedScopes: string[] = []): ResolvedCapability[] {
  const normalized = new Set(grantedScopes.map((s) => s.trim().toLowerCase()));

  return GOOGLE_SERVICE_CAPABILITIES.map((cap) => {
    const matched = cap.requiredScopes.filter((reqScope) => normalized.has(reqScope.toLowerCase()));

    let status: CapabilityStatus;
    if (cap.billingTier === 'local-cpu') {
      status = 'active';
    } else if (cap.billingTier === 'free-tier-billing-required') {
      status = matched.length > 0 ? 'active' : 'billing-optional';
    } else if (cap.billingTier === 'workspace-paid') {
      status = matched.length > 0 ? 'active' : 'workspace-upgrade';
    } else {
      // free-no-billing
      status =
        cap.requiredScopes.length === 0 || matched.length > 0
          ? 'active'
          : 'ready-incremental';
    }

    return {
      ...cap,
      status,
      grantedScopesMatched: matched,
    };
  });
}
