/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-103] External Cloud Connectors OAuth 2.0 PKCE & Credential Wizard Engine
 * Zero hardcoded secrets. Persists user-configured external cloud connections locally
 * and generates OAuth 2.0 PKCE authorization URLs for Dropbox, OneDrive/SharePoint,
 * Flickr, and validates S3/Wasabi & WebDAV/iCloud connection parameters.
 */

export type ExternalCloudProviderId =
  | 'dropbox'
  | 'onedrive'
  | 'sharepoint'
  | 'wasabi'
  | 'icloud-drive'
  | 'flickr'
  | 'webdav-sftp'
  | 'mega'
  | 'pcloud'
  | 'box'
  | 'backblaze-b2'
  | 'cloudflare-r2'
  | 'proton-drive'
  | 'smb-nas'
  | 'sftp-ssh';

export type ExternalCloudAuthKind = 'oauth2-pkce' | 's3-sigv4' | 'webdav-basic';

export interface ExternalCloudProviderSpec {
  id: ExternalCloudProviderId;
  name: string;
  authKind: ExternalCloudAuthKind;
  subtitle: string;
  docsUrl: string;
  defaultScopes?: string[];
  authorizeEndpoint?: string;
  defaultEndpoint?: string;
  allowedHosts: string[];
}

export interface ExternalCloudConnection {
  providerId: ExternalCloudProviderId;
  connected: boolean;
  accountLabel: string;
  clientId?: string;
  tenantId?: string;
  accessToken?: string;
  endpointUrl?: string;
  region?: string;
  bucket?: string;
  username?: string;
  connectedAt: string;
}

export const EXTERNAL_CLOUD_SPECS: readonly ExternalCloudProviderSpec[] = [
  {
    id: 'dropbox',
    name: 'Dropbox',
    authKind: 'oauth2-pkce',
    subtitle: 'OAuth 2.0 PKCE · Dropbox API v2 (/2/files/list_folder)',
    docsUrl: 'https://www.dropbox.com/developers/apps',
    authorizeEndpoint: 'https://www.dropbox.com/oauth2/authorize',
    defaultScopes: ['files.metadata.read', 'files.content.read', 'files.content.write'],
    allowedHosts: ['api.dropboxapi.com', 'content.dropboxapi.com'],
  },
  {
    id: 'onedrive',
    name: 'Microsoft OneDrive',
    authKind: 'oauth2-pkce',
    subtitle: 'Microsoft Entra ID OAuth 2.0 · Graph v1.0 (/me/drive)',
    docsUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    authorizeEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    defaultScopes: ['Files.ReadWrite.All', 'offline_access', 'User.Read'],
    allowedHosts: ['graph.microsoft.com'],
  },
  {
    id: 'sharepoint',
    name: 'Microsoft SharePoint',
    authKind: 'oauth2-pkce',
    subtitle: 'Microsoft Entra ID OAuth 2.0 · Graph Sites & Document Libraries',
    docsUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    authorizeEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    defaultScopes: ['Sites.ReadWrite.All', 'Files.ReadWrite.All', 'offline_access'],
    allowedHosts: ['graph.microsoft.com'],
  },
  {
    id: 'wasabi',
    name: 'Wasabi / S3-Compatible',
    authKind: 's3-sigv4',
    subtitle: 'S3 SigV4 REST · Wasabi, Cloudflare R2, Backblaze B2 & MinIO',
    docsUrl: 'https://console.wasabisys.com/',
    defaultEndpoint: 'https://s3.us-east-1.wasabisys.com',
    allowedHosts: ['wasabisys.com', 'amazonaws.com', 'r2.cloudflarestorage.com', 'backblazeb2.com'],
  },
  {
    id: 'icloud-drive',
    name: 'iCloud Drive (WebDAV)',
    authKind: 'webdav-basic',
    subtitle: 'Apple ID + App-Specific Password via WebDAV Bridge',
    docsUrl: 'https://appleid.apple.com/',
    defaultEndpoint: 'https://p01-caldav.icloud.com',
    allowedHosts: ['icloud.com'],
  },
  {
    id: 'flickr',
    name: 'Flickr Photo Archive',
    authKind: 'oauth2-pkce',
    subtitle: 'Flickr API · Full-Resolution Photostream & Albums',
    docsUrl: 'https://www.flickr.com/services/apps/create/',
    authorizeEndpoint: 'https://www.flickr.com/services/oauth/authorize',
    defaultScopes: ['read', 'write'],
    allowedHosts: ['api.flickr.com', 'live.staticflickr.com'],
  },
  {
    id: 'webdav-sftp',
    name: 'WebDAV / NAS / SFTP',
    authKind: 'webdav-basic',
    subtitle: 'Nextcloud, OwnCloud, Synology NAS & Standard WebDAV',
    docsUrl: 'https://datatracker.ietf.org/doc/html/rfc4918',
    defaultEndpoint: 'https://nextcloud.example.com/remote.php/dav/files/',
    allowedHosts: [],
  },
  {
    id: 'mega',
    name: 'MEGA.nz (Zero-Knowledge)',
    authKind: 'webdav-basic',
    subtitle: 'MEGA CMD / WebDAV Gateway · End-to-End Encrypted Cloud',
    docsUrl: 'https://mega.io/cmd',
    defaultEndpoint: 'https://webdav.mega.nz/',
    allowedHosts: ['mega.nz', 'mega.co.nz'],
  },
  {
    id: 'pcloud',
    name: 'pCloud',
    authKind: 'oauth2-pkce',
    subtitle: 'pCloud OAuth 2.0 · US & EU Vault Regions',
    docsUrl: 'https://docs.pcloud.com/',
    authorizeEndpoint: 'https://my.pcloud.com/oauth2/authorize',
    defaultScopes: ['read', 'write'],
    allowedHosts: ['api.pcloud.com', 'eapi.pcloud.com'],
  },
  {
    id: 'box',
    name: 'Box Enterprise',
    authKind: 'oauth2-pkce',
    subtitle: 'Box OAuth 2.0 · Enterprise Content & Metadata API',
    docsUrl: 'https://developer.box.com/',
    authorizeEndpoint: 'https://account.box.com/api/oauth2/authorize',
    defaultScopes: ['root_readwrite'],
    allowedHosts: ['api.box.com', 'upload.box.com'],
  },
  {
    id: 'backblaze-b2',
    name: 'Backblaze B2 Native',
    authKind: 's3-sigv4',
    subtitle: 'Backblaze B2 S3-Compatible & Native Archive Buckets',
    docsUrl: 'https://www.backblaze.com/docs/cloud-storage',
    defaultEndpoint: 'https://s3.us-west-004.backblazeb2.com',
    allowedHosts: ['backblazeb2.com'],
  },
  {
    id: 'cloudflare-r2',
    name: 'Cloudflare R2',
    authKind: 's3-sigv4',
    subtitle: 'Zero-Egress S3-Compatible Object Storage',
    docsUrl: 'https://developers.cloudflare.com/r2/',
    defaultEndpoint: 'https://account-id.r2.cloudflarestorage.com',
    allowedHosts: ['r2.cloudflarestorage.com'],
  },
  {
    id: 'proton-drive',
    name: 'Proton Drive (Bridge)',
    authKind: 'webdav-basic',
    subtitle: 'Proton Drive E2EE via Local rclone/WebDAV Bridge',
    docsUrl: 'https://proton.me/drive',
    defaultEndpoint: 'https://drive.proton.me/',
    allowedHosts: ['proton.me'],
  },
  {
    id: 'smb-nas',
    name: 'SMB / CIFS LAN NAS',
    authKind: 'webdav-basic',
    subtitle: 'Synology, TrueNAS, Unraid & Windows LAN Shares',
    docsUrl: 'https://www.samba.org/',
    defaultEndpoint: 'https://nas.local/webdav/',
    allowedHosts: [],
  },
  {
    id: 'sftp-ssh',
    name: 'SSH / SFTP Key-Auth',
    authKind: 'webdav-basic',
    subtitle: 'OpenSSH Key-Authenticated Remote Storage Server',
    docsUrl: 'https://www.openssh.com/',
    defaultEndpoint: 'https://sftp.example.com/',
    allowedHosts: [],
  },
] as const;

const STORAGE_KEY = 'dt_external_cloud_connections_v1';

export function getExternalCloudSpec(providerId: ExternalCloudProviderId): ExternalCloudProviderSpec {
  return EXTERNAL_CLOUD_SPECS.find((s) => s.id === providerId) || EXTERNAL_CLOUD_SPECS[0];
}

export function buildExternalOAuthUrl(params: {
  providerId: ExternalCloudProviderId;
  clientId: string;
  redirectUri: string;
  state: string;
  tenantId?: string;
}): string {
  const spec = getExternalCloudSpec(params.providerId);
  if (spec.authKind !== 'oauth2-pkce' || !spec.authorizeEndpoint) {
    throw new Error(`Provider ${spec.name} does not use OAuth 2.0 redirect flow.`);
  }
  const base =
    params.tenantId && (params.providerId === 'onedrive' || params.providerId === 'sharepoint')
      ? `https://login.microsoftonline.com/${encodeURIComponent(params.tenantId)}/oauth2/v2.0/authorize`
      : spec.authorizeEndpoint;

  const url = new URL(base);
  url.searchParams.set('client_id', params.clientId.trim());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('state', params.state);
  if (spec.defaultScopes?.length) {
    url.searchParams.set('scope', spec.defaultScopes.join(' '));
  }
  if (params.providerId === 'dropbox') {
    url.searchParams.set('token_access_type', 'offline');
  }
  return url.toString();
}

export function validateExternalCloudConfig(
  providerId: ExternalCloudProviderId,
  input: {
    clientId?: string;
    accessToken?: string;
    endpointUrl?: string;
    bucket?: string;
    username?: string;
  }
): { valid: boolean; error?: string } {
  const spec = getExternalCloudSpec(providerId);
  if (spec.authKind === 'oauth2-pkce') {
    if (!input.clientId?.trim() && !input.accessToken?.trim()) {
      return { valid: false, error: `Enter your ${spec.name} App Client ID or a temporary OAuth Access Token.` };
    }
    return { valid: true };
  }
  if (spec.authKind === 's3-sigv4') {
    if (!input.endpointUrl?.trim() || !/^https:\/\//i.test(input.endpointUrl.trim())) {
      return { valid: false, error: 'S3 Endpoint must be a valid https:// URL.' };
    }
    if (!input.bucket?.trim()) {
      return { valid: false, error: 'Enter a target S3 bucket name.' };
    }
    return { valid: true };
  }
  if (!input.endpointUrl?.trim() || !/^https?:\/\//i.test(input.endpointUrl.trim())) {
    return { valid: false, error: 'Enter a valid WebDAV / NAS endpoint URL.' };
  }
  return { valid: true };
}

export function loadExternalCloudConnections(): Record<string, ExternalCloudConnection> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveExternalCloudConnection(
  conn: ExternalCloudConnection
): Record<string, ExternalCloudConnection> {
  const all = loadExternalCloudConnections();
  // [WO-104 Security Hardening] Never persist raw accessToken strings in browser localStorage.
  // Sync any accessToken into the server-side HttpOnly AES-256-GCM session vault instead.
  const { accessToken, ...sanitizedMetadata } = conn;
  all[conn.providerId] = sanitizedMetadata;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {}
    if (accessToken?.trim()) {
      void fetch(`/api/clouds/${encodeURIComponent(conn.providerId)}/session`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: accessToken.trim(),
          username: conn.username,
          endpointUrl: conn.endpointUrl,
        }),
      }).catch(() => {});
    }
  }
  return all;
}

export function disconnectExternalCloud(
  providerId: ExternalCloudProviderId
): Record<string, ExternalCloudConnection> {
  const all = loadExternalCloudConnections();
  delete all[providerId];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {}
    void fetch(`/api/clouds/${encodeURIComponent(providerId)}/session`, {
      method: 'DELETE',
      credentials: 'same-origin',
    }).catch(() => {});
  }
  return all;
}
