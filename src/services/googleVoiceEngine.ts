/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Voice Browser-Level Calling & DTMF Keypad Engine
 * Leverages Google Chrome's native interception of the callto: and tel: protocols
 * to launch browser-level Google Voice calls directly from hyperlink text.
 *
 * Features:
 * - callto: and tel: protocol execution
 * - Web Audio API DTMF dual-tone multi-frequency audio synthesizer
 * - Standard 12-key keypad layout (1-9, *, 0, #) with letters
 * - Contact directory matching Image Attachment 4 (Mom Main/Mobile)
 */

export interface VoiceContact {
  id: string;
  name: string;
  phone: string;
  type: 'Main' | 'Mobile' | 'Work' | 'Home';
  avatarColor?: string;
  avatarPattern?: 'checker' | 'circle' | 'user';
}

// DTMF standard frequencies: Low group (rows) and High group (columns)
const DTMF_FREQUENCIES: Record<string, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
};

export class GoogleVoiceEngine {
  private audioCtx: AudioContext | null = null;

  /**
   * Triggers Chrome's browser-level calling by launching callto: and tel: protocols.
   */
  public triggerChromeCall(phoneNumber: string): { protocolUrl: string; webUrl: string } {
    const cleanDigits = phoneNumber.replace(/[^\d+]/g, '');
    const protocolUrl = `callto:${cleanDigits}`;
    const webUrl = `https://voice.google.com/u/0/calls?query=${encodeURIComponent(cleanDigits)}`;

    if (typeof window !== 'undefined') {
      try {
        // Attempt browser-level protocol interception
        window.location.href = protocolUrl;
      } catch {
        // Fallback to Google Voice web dialer
        window.open(webUrl, '_blank');
      }
    }

    return { protocolUrl, webUrl };
  }

  /**
   * Triggers SMS dispatch via native sms: URI and Google Voice web messages.
   */
  public triggerSms(phoneNumber: string, messageText?: string): { smsUri: string; webUrl: string } {
    const cleanDigits = phoneNumber.replace(/[^\d+]/g, '');
    const encodedBody = messageText ? encodeURIComponent(messageText) : '';
    const smsUri = `sms:${cleanDigits}${encodedBody ? `?body=${encodedBody}` : ''}`;
    const webUrl = `https://voice.google.com/u/0/messages?query=${encodeURIComponent(cleanDigits)}`;

    if (typeof window !== 'undefined') {
      try {
        window.location.href = smsUri;
      } catch {
        window.open(webUrl, '_blank');
      }
    }

    return { smsUri, webUrl };
  }

  /**
   * Plays authentic dual-tone multi-frequency (DTMF) dialpad sound using Web Audio API.
   */
  public playDtmfTone(key: string, durationMs: number = 100): void {
    if (typeof window === 'undefined') return;
    const freqs = DTMF_FREQUENCIES[key];
    if (!freqs) return;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!this.audioCtx || this.audioCtx.state === 'suspended') {
        this.audioCtx = new AudioCtxClass();
      }

      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const stopTime = now + durationMs / 1000;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, stopTime);
      gain.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freqs[0], now);
      osc1.connect(gain);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freqs[1], now);
      osc2.connect(gain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(stopTime);
      osc2.stop(stopTime);
    } catch {}
  }

  /**
   * Formats raw phone digits into standard US (XXX) XXX-XXXX presentation.
   */
  public formatPhoneDisplay(input: string): string {
    const digits = input.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }

  /**
   * Returns contacts matching Image Attachment 4.
   */
  public getPresetVoiceContacts(): VoiceContact[] {
    return [
      {
        id: 'contact_mom_main',
        name: 'Mom',
        phone: '(701) 339-3414',
        type: 'Main',
        avatarPattern: 'checker',
      },
      {
        id: 'contact_mom_mobile',
        name: 'Mom',
        phone: '(970) 236-6062',
        type: 'Mobile',
        avatarPattern: 'checker',
      },
      {
        id: 'contact_studio_director',
        name: 'Studio Creative Director',
        phone: '(415) 555-0192',
        type: 'Work',
        avatarColor: '#1074B1',
        avatarPattern: 'circle',
      },
      {
        id: 'contact_client_vogue',
        name: 'Vogue Client Editorial',
        phone: '(212) 555-0144',
        type: 'Work',
        avatarColor: '#52B197',
        avatarPattern: 'circle',
      },
    ];
  }
}

export const googleVoiceEngine = new GoogleVoiceEngine();
