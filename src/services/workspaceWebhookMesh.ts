/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-054] Dedicated Google Workspace Bot Gateway & Webhook Event Mesh
 * Provides HMAC-SHA256 payload signing/verification, Google Chat Card V2 builders,
 * and SSRF-safe outbound studio automation webhook dispatch.
 */

export interface GoogleChatCardV2Payload {
  text?: string;
  cardsV2: Array<{
    cardId: string;
    card: {
      header: { title: string; subtitle?: string };
      sections: Array<{
        header?: string;
        widgets: Array<Record<string, any>>;
      }>;
    };
  }>;
}

export interface WebhookEventRecord {
  id: string;
  direction: 'inbound' | 'outbound';
  source: string;
  eventType: string;
  timestamp: string;
  status: 'ok' | 'rejected' | 'error';
  summary: string;
}

async function computeHmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function signWebhookPayload(secret: string, body: string): Promise<string> {
  const hex = await computeHmacSha256Hex(secret, body);
  return `sha256=${hex}`;
}

export async function verifyWebhookSignature(
  secret: string,
  body: string,
  signatureHeader: string
): Promise<boolean> {
  if (!secret || !signatureHeader) return false;
  const expected = await signWebhookPayload(secret, body);
  if (expected.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}

export function buildExportCompleteCardV2(options: {
  projectName: string;
  exportedCount: number;
  presetName: string;
  driveFolderUrl?: string;
}): GoogleChatCardV2Payload {
  return {
    text: `Drive Therapy Export Ready: ${options.projectName} (${options.exportedCount} files)`,
    cardsV2: [
      {
        cardId: `export_${Date.now()}`,
        card: {
          header: {
            title: `Export Complete — ${options.projectName}`,
            subtitle: `${options.exportedCount} assets · Preset: ${options.presetName}`,
          },
          sections: [
            {
              widgets: [
                {
                  decoratedText: {
                    topLabel: 'Status',
                    text: 'Non-destructive export package verified & ready for client review.',
                  },
                },
                ...(options.driveFolderUrl
                  ? [
                      {
                        buttonList: {
                          buttons: [
                            {
                              text: 'Open Deliverable in Drive',
                              onClick: { openLink: { url: options.driveFolderUrl } },
                            },
                          ],
                        },
                      },
                    ]
                  : []),
              ],
            },
          ],
        },
      },
    ],
  };
}

export function buildCullingSummaryCardV2(options: {
  projectName: string;
  pickedCount: number;
  rejectedCount: number;
  totalCount: number;
}): GoogleChatCardV2Payload {
  return {
    text: `Culling Summary for ${options.projectName}: ${options.pickedCount} picks / ${options.totalCount} total`,
    cardsV2: [
      {
        cardId: `cull_${Date.now()}`,
        card: {
          header: {
            title: `Culling Summary — ${options.projectName}`,
            subtitle: `Picked: ${options.pickedCount} · Rejected: ${options.rejectedCount} · Total: ${options.totalCount}`,
          },
          sections: [
            {
              widgets: [
                {
                  decoratedText: {
                    topLabel: 'Hero Selection Rate',
                    text: `${options.totalCount > 0 ? Math.round((options.pickedCount / options.totalCount) * 100) : 0}% selected as hero picks`,
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

export async function dispatchStudioWebhook(options: {
  targetUrl: string;
  payload: Record<string, any>;
  secret?: string;
}): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await fetch('/api/webhooks/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok && Boolean(data.success),
    status: res.status,
    error: data.error,
  };
}
