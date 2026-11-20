/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gmail Attachment Harvester & Direct Media Send Service
 */

import { MediaAsset, MediaCategory } from '../types';
import { loadOAuthToken } from './googleDrive';

export interface GmailAttachmentItem {
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  subject: string;
  from: string;
  date: string;
}

function classifyMime(mimeType: string): MediaCategory {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed')) return 'archive';
  return 'document';
}

export function mapGmailAttachmentToAsset(att: GmailAttachmentItem): MediaAsset {
  const token = loadOAuthToken()?.accessToken || '';
  const streamUrl = `/api/gmail/attachment/${encodeURIComponent(att.messageId)}/${encodeURIComponent(att.attachmentId)}?mimeType=${encodeURIComponent(att.mimeType)}&filename=${encodeURIComponent(att.filename)}&access_token=${encodeURIComponent(token)}`;
  const extMatch = att.filename.match(/\.([^.]+)$/);
  const ext = extMatch ? extMatch[1].toUpperCase() : 'FILE';
  const cat = classifyMime(att.mimeType);

  return {
    id: `gmail_${att.messageId}_${att.attachmentId.slice(0, 12)}`,
    name: att.filename,
    source: 'cloud',
    category: cat,
    mimeType: att.mimeType,
    extension: ext,
    path: `Gmail/${att.subject || 'Attachment'}/${att.filename}`,
    sizeBytes: att.sizeBytes,
    modifiedTime: att.date || new Date().toISOString(),
    cloudUrl: streamUrl,
    thumbnailUrl: cat === 'image' ? streamUrl : '',
    isCached: false,
    cullingStatus: 'unrated',
    rating: 0,
    tags: ['Gmail', att.from].filter(Boolean),
    faces: [],
    quality: { sharpness: 85, exposure: 85, overall: 85, isBlurry: false },
    palette: [],
    exif: {},
    metadata: { gmailSubject: att.subject, gmailFrom: att.from },
  };
}

export async function fetchGmailAttachments(): Promise<GmailAttachmentItem[]> {
  const token = loadOAuthToken()?.accessToken;
  if (!token) throw new Error('Connect Google account first to harvest Gmail attachments.');
  const res = await fetch('/api/gmail/attachments', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Gmail attachments fetch failed (${res.status})`);
  return Array.isArray(data.attachments) ? data.attachments : [];
}

export async function sendGmailMessage(to: string, subject: string, bodyText: string): Promise<void> {
  const token = loadOAuthToken()?.accessToken;
  if (!token) throw new Error('Connect Google account first to send via Gmail.');
  const res = await fetch('/api/gmail/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, subject, body: bodyText }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Gmail send failed (${res.status})`);
}
