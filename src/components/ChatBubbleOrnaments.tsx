/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-099] Crisp Inline SVG Bubble Ornaments for Castor & Custom Google Chat
 * Strictly pointer-events-none, zero external image dependencies, crisp at any DPI.
 */

import React from 'react';
import type { ChatDecorationId } from '../services/chatDecorationEngine';

interface ChatBubbleOrnamentsProps {
  decorationId: ChatDecorationId;
  enabled: boolean;
}

export const ChatBubbleOrnaments: React.FC<ChatBubbleOrnamentsProps> = ({
  decorationId,
  enabled,
}) => {
  if (!enabled) return null;

  if (decorationId === 'sakura-glow') {
    return (
      <>
        {/* Top-left tiny heart beads */}
        <svg
          viewBox="0 0 42 12"
          className="pointer-events-none absolute -top-1.5 left-4 w-9 h-3 drop-shadow-[0_0_4px_rgba(249,168,212,0.8)]"
          aria-hidden="true"
        >
          <path d="M6 10 C3 7 1 5.2 1 3.4 A2.2 2.2 0 0 1 6 2.3 A2.2 2.2 0 0 1 11 3.4 C11 5.2 9 7 6 10 Z" fill="#FBCFE8" />
          <path d="M19 10 C16 7 14 5.2 14 3.4 A2.2 2.2 0 0 1 19 2.3 A2.2 2.2 0 0 1 24 3.4 C24 5.2 22 7 19 10 Z" fill="#F9A8D4" />
          <path d="M32 10 C29 7 27 5.2 27 3.4 A2.2 2.2 0 0 1 32 2.3 A2.2 2.2 0 0 1 37 3.4 C37 5.2 35 7 32 10 Z" fill="#F472B6" />
        </svg>
        {/* Bottom-left cherry blossom */}
        <svg
          viewBox="0 0 28 28"
          className="pointer-events-none absolute -bottom-2 -left-2 w-6 h-6 drop-shadow-[0_0_5px_rgba(249,168,212,0.75)]"
          aria-hidden="true"
        >
          <ellipse cx="14" cy="7" rx="3.4" ry="5" fill="#FBCFE8" />
          <ellipse cx="20.5" cy="12" rx="3.4" ry="5" transform="rotate(72 20.5 12)" fill="#F9A8D4" />
          <ellipse cx="18" cy="19.5" rx="3.4" ry="5" transform="rotate(144 18 19.5)" fill="#FBCFE8" />
          <ellipse cx="10" cy="19.5" rx="3.4" ry="5" transform="rotate(216 10 19.5)" fill="#F9A8D4" />
          <ellipse cx="7.5" cy="12" rx="3.4" ry="5" transform="rotate(288 7.5 12)" fill="#FBCFE8" />
          <circle cx="14" cy="14" r="2.6" fill="#FDE68A" />
        </svg>
        {/* Top-right hanging sparkle charm */}
        <svg
          viewBox="0 0 16 28"
          className="pointer-events-none absolute -top-1.5 right-2.5 w-3.5 h-6 drop-shadow-[0_0_4px_rgba(249,168,212,0.85)]"
          aria-hidden="true"
        >
          <circle cx="8" cy="5" r="3.2" fill="#F9A8D4" />
          <line x1="8" y1="8" x2="8" y2="21" stroke="#FBCFE8" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M8 18 L9.6 22 L13 23.5 L9.6 25 L8 28 L6.4 25 L3 23.5 L6.4 22 Z" fill="#FFF1F7" />
        </svg>
      </>
    );
  }

  if (decorationId === 'midnight-lantern') {
    return (
      <>
        {/* Top-left subtle moonlit corner filigree */}
        <svg
          viewBox="0 0 28 28"
          className="pointer-events-none absolute top-0 left-0 w-7 h-7 opacity-45"
          aria-hidden="true"
        >
          <path d="M1 1 L26 1 M1 1 L1 26 M1 1 L19 19 M1 10 Q10 10 10 1 M1 19 Q19 19 19 1" stroke="#CBD5E1" strokeWidth="0.9" fill="none" />
        </svg>
        {/* Bottom-right glowing lantern crest */}
        <svg
          viewBox="0 0 24 28"
          className="pointer-events-none absolute -bottom-1.5 right-2 w-5 h-6 drop-shadow-[0_0_6px_rgba(147,197,253,0.75)]"
          aria-hidden="true"
        >
          <rect x="6" y="7" width="12" height="16" rx="5" fill="#1E293B" stroke="#93C5FD" strokeWidth="1.2" />
          <circle cx="12" cy="15" r="3.2" fill="#BAE6FD" />
          <path d="M9 7 L12 3 L15 7" stroke="#CBD5E1" strokeWidth="1.2" fill="none" />
        </svg>
      </>
    );
  }

  if (decorationId === 'pastel-pixel') {
    return (
      <>
        {/* Top-right 8-bit pixel heart */}
        <svg
          viewBox="0 0 18 16"
          className="pointer-events-none absolute -top-2 right-3 w-4 h-4"
          style={{ imageRendering: 'pixelated' }}
          aria-hidden="true"
        >
          <rect x="2" y="2" width="4" height="2" fill="#F472B6" />
          <rect x="10" y="2" width="4" height="2" fill="#F472B6" />
          <rect x="0" y="4" width="16" height="4" fill="#F472B6" />
          <rect x="2" y="8" width="12" height="2" fill="#F9A8D4" />
          <rect x="4" y="10" width="8" height="2" fill="#F9A8D4" />
          <rect x="6" y="12" width="4" height="2" fill="#F472B6" />
          <rect x="3" y="4" width="2" height="2" fill="#FFFFFF" />
        </svg>
        {/* Bottom-left pixel star */}
        <svg
          viewBox="0 0 12 12"
          className="pointer-events-none absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5"
          aria-hidden="true"
        >
          <rect x="5" y="0" width="2" height="12" fill="#F472B6" />
          <rect x="0" y="5" width="12" height="2" fill="#F472B6" />
          <rect x="4" y="4" width="4" height="4" fill="#FFF1F7" />
        </svg>
      </>
    );
  }

  if (decorationId === 'rpg-tavern') {
    return (
      <svg
        viewBox="0 0 20 20"
        className="pointer-events-none absolute -top-2 right-3 w-4 h-4 drop-shadow-[0_0_5px_rgba(163,230,53,0.85)]"
        aria-hidden="true"
      >
        <path d="M11 1 L3 11 H10 L9 19 L17 9 H10 Z" fill="#A3E635" />
      </svg>
    );
  }

  return null;
};
