/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Workspace Multi-Channel Messenger Service
 * Powers messaging and dispatch from Drive Therapy across:
 * - 💬 Google Chat (Cards V2 schema, webhooks, Spaces)
 * - 📞 Google Voice (Client SMS/MMS with 160-char segment counter)
 * - 📧 Gmail (Web composer & mailto with shoot summaries)
 * - 👥 Client Contact Directory (local storage sync)
 * - 🌐 Other Apps / System Share Sheet (Web Share API)
 */

import { MediaAsset } from '../types';

export interface ClientContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  lastShootProject?: string;
  updatedAt: number;
}

export interface ChatCardSection {
  header?: string;
  widgets: any[];
}

export interface GoogleChatCardV2 {
  cardsV2: [
    {
      cardId: string;
      card: {
        header: {
          title: string;
          subtitle: string;
          imageUrl?: string;
          imageType?: 'CIRCLE' | 'SQUARE';
        };
        sections: ChatCardSection[];
      };
    }
  ];
}

export interface MessagePayload {
  projectName: string;
  clientName?: string;
  heroCount?: number;
  totalAssetsCount?: number;
  driveUrl?: string;
  thumbnailUrl?: string;
  assetName?: string;
  customNotes?: string;
  targetPhone?: string;
  targetEmail?: string;
  webhookUrl?: string;
}

const CONTACTS_STORAGE_KEY = 'dt_client_contacts_v1';
const CHAT_WEBHOOK_STORAGE_KEY = 'dt_chat_webhook_url_v1';

export class GoogleWorkspaceMessenger {
  /**
   * Constructs a Google Chat Card V2 JSON payload for Space / Webhook dispatch.
   */
  public buildGoogleChatCard(payload: MessagePayload): GoogleChatCardV2 {
    const {
      projectName,
      clientName = 'Valued Client',
      heroCount = 0,
      totalAssetsCount = 0,
      driveUrl = 'https://drive.google.com',
      thumbnailUrl,
      assetName,
      customNotes,
    } = payload;

    const sections: ChatCardSection[] = [
      {
        header: '📸 Shoot Production Status',
        widgets: [
          {
            decoratedText: {
              topLabel: 'Client / Account',
              text: `<b>${clientName}</b>`,
              startIcon: { knownIcon: 'MEMBERSHIP' },
            },
          },
          {
            decoratedText: {
              topLabel: 'Culling Milestones',
              text: `<b>${heroCount} Hero Picks</b> approved of ${totalAssetsCount} total captures`,
              startIcon: { knownIcon: 'STAR' },
            },
          },
        ],
      },
    ];

    if (assetName) {
      sections[0].widgets.push({
        decoratedText: {
          topLabel: 'Featured Asset',
          text: `<code>${assetName}</code>`,
          startIcon: { knownIcon: 'CONFIRMATION_NUMBER_ICON' },
        },
      });
    }

    if (customNotes) {
      sections.push({
        header: '📝 Director Notes',
        widgets: [
          {
            textParagraph: {
              text: customNotes,
            },
          },
        ],
      });
    }

    // Call to Action Buttons
    sections.push({
      widgets: [
        {
          buttonList: {
            buttons: [
              {
                text: 'Open Google Drive Gallery',
                onClick: {
                  openLink: {
                    url: driveUrl,
                  },
                },
              },
            ],
          },
        },
      ],
    });

    return {
      cardsV2: [
        {
          cardId: `dt_chat_${Date.now()}`,
          card: {
            header: {
              title: `Drive Therapy — ${projectName}`,
              subtitle: 'Digital Asset Delivery & Client Review',
              imageUrl:
                thumbnailUrl ||
                'https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/photo_camera/default/48px.svg',
              imageType: 'SQUARE',
            },
            sections,
          },
        },
      ],
    };
  }

  /**
   * Dispatches a Google Chat card to an incoming webhook URL.
   */
  public async sendGoogleChatWebhook(webhookUrl: string, card: GoogleChatCardV2): Promise<boolean> {
    if (!webhookUrl || !webhookUrl.startsWith('https://chat.googleapis.com/')) {
      throw new Error('Please provide a valid Google Chat webhook URL (https://chat.googleapis.com/...)');
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(card),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Google Chat webhook error (${response.status}): ${errText || response.statusText}`);
    }

    return true;
  }

  /**
   * Formats a rich Markdown message suitable for pasting directly into Google Chat Spaces.
   */
  public formatGoogleChatMarkdown(payload: MessagePayload): string {
    const {
      projectName,
      clientName = 'Valued Client',
      heroCount = 0,
      totalAssetsCount = 0,
      driveUrl = 'https://drive.google.com',
      customNotes,
    } = payload;

    return `📸 *Drive Therapy Production Delivery: ${projectName}*
*Client:* ${clientName}
*Status:* ${heroCount} Hero Picks approved out of ${totalAssetsCount} master captures
${customNotes ? `*Notes:* ${customNotes}\n` : ''}
*Google Drive Gallery Link:* ${driveUrl}

_Dispatched via Drive Therapy Studio_`;
  }

  /**
   * Formats a concise, client-friendly SMS for Google Voice.
   */
  public formatGoogleVoiceSms(
    templateType: 'gallery_ready' | 'culling_deadline' | 'invoice_brief' | 'custom',
    payload: MessagePayload
  ): string {
    const {
      projectName,
      clientName = 'there',
      heroCount = 0,
      driveUrl = 'https://drive.google.com',
      customNotes = '',
    } = payload;

    switch (templateType) {
      case 'gallery_ready':
        return `Hi ${clientName}! Your photo gallery for ${projectName} is ready with ${heroCount} approved hero picks. View here: ${driveUrl} — Sent via Drive Therapy`;

      case 'culling_deadline':
        return `Hi ${clientName}, please review and confirm your selections for ${projectName}: ${driveUrl} — Sent via Drive Therapy`;

      case 'invoice_brief':
        return `Hi ${clientName}, the production files and deliverables for ${projectName} are ready in Drive: ${driveUrl} — Sent via Drive Therapy`;

      case 'custom':
      default:
        return customNotes || `Hi ${clientName}, here is your gallery link for ${projectName}: ${driveUrl}`;
    }
  }

  /**
   * Calculates SMS character count and GSM segment split (160 characters per segment).
   */
  public calculateSmsSegments(text: string): { chars: number; segments: number; maxPerSegment: number } {
    const chars = text.length;
    // Standard GSM-7 160 chars for single, 153 for multi-segment
    const maxPerSegment = chars <= 160 ? 160 : 153;
    const segments = Math.max(1, Math.ceil(chars / maxPerSegment));
    return { chars, segments, maxPerSegment };
  }

  /**
   * Builds Google Voice web message URL.
   */
  public buildGoogleVoiceWebUrl(phone: string, text: string): string {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    const encodedPhone = encodeURIComponent(cleanPhone);
    return `https://voice.google.com/u/0/messages?query=${encodedPhone}`;
  }

  /**
   * Builds standard `sms:` URI for native device handling.
   */
  public buildSmsUri(phone: string, text: string): string {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    return `sms:${cleanPhone}?body=${encodeURIComponent(text)}`;
  }

  /**
   * Validates standard US or international phone number format.
   */
  public validatePhoneNumber(phone: string): boolean {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  }

  /**
   * Builds web Gmail composer URL with prefilled recipient, subject and body.
   */
  public buildGmailComposeUrl(params: { to?: string; subject: string; body: string }): string {
    const query = new URLSearchParams({
      view: 'cm',
      fs: '1',
      to: params.to || '',
      su: params.subject,
      body: params.body,
    });
    return `https://mail.google.com/mail/?${query.toString()}`;
  }

  /**
   * Builds standard `mailto:` link with prefilled fields.
   */
  public buildMailtoUrl(params: { to?: string; subject: string; body: string }): string {
    const query = new URLSearchParams({
      subject: params.subject,
      body: params.body,
    });
    return `mailto:${params.to || ''}?${query.toString()}`;
  }

  /**
   * Shares asset or project via Web Share API (WhatsApp, Slack, AirDrop, etc.) with clipboard fallback.
   */
  public async shareViaSystem(params: { title: string; text: string; url: string }): Promise<'shared' | 'copied'> {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(params);
        return 'shared';
      } catch (err: any) {
        if (err.name === 'AbortError') return 'shared';
      }
    }

    // Fallback: copy to clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${params.text}\n${params.url}`);
      return 'copied';
    }

    return 'copied';
  }

  // --- Client Contact Directory Storage ---

  public getSavedContacts(): ClientContact[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(CONTACTS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public saveContact(contact: Omit<ClientContact, 'id' | 'updatedAt'>): ClientContact {
    const contacts = this.getSavedContacts();
    const newContact: ClientContact = {
      ...contact,
      id: `contact_${Date.now()}`,
      updatedAt: Date.now(),
    };
    const updated = [newContact, ...contacts.filter((c) => c.phone !== contact.phone && c.email !== contact.email)];
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(updated.slice(0, 50)));
      } catch {}
    }
    return newContact;
  }

  public deleteContact(id: string): void {
    const contacts = this.getSavedContacts().filter((c) => c.id !== id);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
      } catch {}
    }
  }

  public getSavedWebhookUrl(): string {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(CHAT_WEBHOOK_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  }

  public saveWebhookUrl(url: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CHAT_WEBHOOK_STORAGE_KEY, url.trim());
    } catch {}
  }
}

export const googleWorkspaceMessenger = new GoogleWorkspaceMessenger();
