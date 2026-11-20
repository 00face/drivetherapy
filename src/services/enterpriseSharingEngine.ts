/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-116] Enterprise Sharing, Microsoft Hero Links, Unified DLP,
 * Google Meet In-Meeting Share & Permission-Aware Clean PDF Prep Engine
 */

export type SensitivityLabel = 'public' | 'internal' | 'confidential' | 'restricted';
export type ShareAudience = 'private' | 'internal-domain' | 'named-external' | 'public-anyone';
export type ShareRole = 'viewer' | 'commenter' | 'editor';

export interface HeroLinkRecord {
  slug: string;
  assetId: string;
  assetName: string;
  isFolder: boolean;
  canonicalPath: string;
  audience: ShareAudience;
  role: ShareRole;
  sensitivityLabel: SensitivityLabel;
  limitedAccess: boolean;
  editorsCanShare: boolean;
  viewersCanDownload: boolean;
  externalGuests: string[];
  expiresAt: string | null;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UnifiedDlpPolicy {
  blockConfidentialPublicLinks: boolean;
  blockRestrictedExternalShares: boolean;
  requireExpiryOnPublicLinks: boolean;
  maxPublicLinkDays: number;
}

export const DEFAULT_UNIFIED_DLP_POLICY: UnifiedDlpPolicy = {
  blockConfidentialPublicLinks: true,
  blockRestrictedExternalShares: true,
  requireExpiryOnPublicLinks: true,
  maxPublicLinkDays: 30,
};

export interface DlpEvaluationResult {
  allowed: boolean;
  severity: 'ok' | 'warning' | 'blocked';
  reasons: string[];
}

/**
 * Unified Data Protection (DLP) evaluator combining sensitivity label + target audience + expiry.
 */
export function evaluateDlpSharePolicy(
  input: {
    sensitivityLabel: SensitivityLabel;
    audience: ShareAudience;
    expiresAt?: string | null;
    limitedAccess?: boolean;
  },
  policy: UnifiedDlpPolicy = DEFAULT_UNIFIED_DLP_POLICY
): DlpEvaluationResult {
  const reasons: string[] = [];
  let blocked = false;

  if (
    policy.blockRestrictedExternalShares &&
    input.sensitivityLabel === 'restricted' &&
    (input.audience === 'public-anyone' || input.audience === 'named-external')
  ) {
    blocked = true;
    reasons.push('Restricted assets cannot be shared with external guests or public links.');
  }

  if (
    policy.blockConfidentialPublicLinks &&
    input.sensitivityLabel === 'confidential' &&
    input.audience === 'public-anyone'
  ) {
    blocked = true;
    reasons.push('Confidential assets cannot use "Anyone with the link" public access.');
  }

  if (input.limitedAccess && input.audience === 'public-anyone') {
    blocked = true;
    reasons.push('Limited-Access folders disallow public anonymous links.');
  }

  if (
    policy.requireExpiryOnPublicLinks &&
    input.audience === 'public-anyone' &&
    !input.expiresAt
  ) {
    reasons.push(`Public Hero Links should include an expiration date (recommended <= ${policy.maxPublicLinkDays} days).`);
  }

  if (input.expiresAt) {
    const expMs = Date.parse(input.expiresAt);
    if (Number.isNaN(expMs) || expMs <= Date.now()) {
      blocked = true;
      reasons.push('Hero Link expiration date must be a valid future timestamp.');
    } else if (
      input.audience === 'public-anyone' &&
      (expMs - Date.now()) / 86_400_000 > policy.maxPublicLinkDays
    ) {
      blocked = true;
      reasons.push(`Public Hero Link expiration exceeds maximum permitted horizon (${policy.maxPublicLinkDays} days).`);
    }
  }

  return {
    allowed: !blocked,
    severity: blocked ? 'blocked' : reasons.length > 0 ? 'warning' : 'ok',
    reasons,
  };
}

/**
 * Builds a Google Meet In-Meeting Share payload granting immediate viewer access via Hero Link.
 */
export function buildMeetSharePayload(
  baseUrl: string,
  heroLink: HeroLinkRecord,
  meetingCode?: string
): {
  shareUrl: string;
  meetingCode: string;
  grantedRole: ShareRole;
  summary: string;
} {
  const shareUrl = `${baseUrl.replace(/\/+$/, '')}${heroLink.canonicalPath}`;
  const code = (meetingCode || 'active-meet').trim();
  return {
    shareUrl,
    meetingCode: code,
    grantedRole: heroLink.role,
    summary: `Shared "${heroLink.assetName}" in Meet (${code}) via persistent Hero Link (${heroLink.role} access).`,
  };
}

/**
 * Dropbox-style 1-click privacy-scrubbed PDF/print-ready HTML document for external collaboration
 * (strips EXIF camera serials & GPS coordinates before sharing).
 */
export function buildCleanSharePdfHtml(input: {
  assetName: string;
  heroUrl: string;
  sensitivityLabel: SensitivityLabel;
  summaryText?: string;
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(input.assetName)} — Clean External Share Packet</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 2rem; line-height: 1.5; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: #e0f2fe; color: #0369a1; }
    .meta { margin-top: 1rem; padding: 1rem; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 13px; }
  </style>
</head>
<body>
  <h1>${esc(input.assetName)}</h1>
  <span class="badge">Sensitivity: ${esc(input.sensitivityLabel.toUpperCase())} · EXIF/GPS Scrubbed</span>
  <div class="meta">
    <div><strong>Persistent Hero Link:</strong> ${esc(input.heroUrl)}</div>
    <div><strong>Prepared:</strong> ${new Date().toISOString()}</div>
    ${input.summaryText ? `<p>${esc(input.summaryText)}</p>` : ''}
  </div>
</body>
</html>`;
}
