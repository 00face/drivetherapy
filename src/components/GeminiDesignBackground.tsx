/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gemini Design Animated Ambient Background
 * Faithful to Google Design's "Gemini AI Visual Design" guidelines:
 *  - Pure obsidian dark canvas (#000000)
 *  - Fluid "Spectrum Shift" orbiting diffused gradients with sweeping orbital motion
 *  - Animated negative-space 4-point Gemini sparkle & breathing radial voice-wave ripples
 *  - Strictly non-interactive (pointer-events-none z-0) and calm-motion / reduced-motion safe
 */

import React from 'react';

export const GeminiDesignBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden -z-10 select-none bg-[#000000]"
      aria-hidden="true"
    >
      {/* Spectrum Shift Orbiting Diffused Gradients */}
      <div
        className="absolute inset-0"
        style={{ filter: 'blur(68px) saturate(1.55)', opacity: 0.58 }}
      >
        {/* Leading Gemini Indigo / Blue Spectrum Orb */}
        <div
          className="absolute top-[6%] left-[12%] w-[44vw] h-[44vw] max-w-[640px] max-h-[640px] rounded-full gd-gemini-orb-1"
          style={{
            background:
              'radial-gradient(circle at 35% 35%, #4285F4 0%, #6E56CF 48%, transparent 76%)',
          }}
        />
        {/* Analogous Violet / Warm Rose Aura */}
        <div
          className="absolute top-[42%] left-[56%] w-[42vw] h-[42vw] max-w-[600px] max-h-[600px] rounded-full gd-gemini-orb-2"
          style={{
            background:
              'radial-gradient(circle at 40% 40%, #A142F4 0%, #F472B6 48%, #FFD9E2 68%, transparent 82%)',
          }}
        />
        {/* Luminous Cyan / Mint / Solar Spark Orb */}
        <div
          className="absolute bottom-[4%] left-[22%] w-[38vw] h-[38vw] max-w-[540px] max-h-[540px] rounded-full gd-gemini-orb-3"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, #24C1E0 0%, #34D399 45%, #FAE366 72%, transparent 88%)',
          }}
        />
      </div>

      {/* Animated Foundational Radial Voice-Wave Ripples & 4-Point Gemini Sparkle */}
      <svg
        viewBox="0 0 800 800"
        className="absolute -right-16 -bottom-16 w-[560px] h-[560px] opacity-[0.18] gd-gemini-sparkle"
        fill="none"
      >
        <circle cx="400" cy="400" r="145" stroke="#8AB4F8" strokeWidth="1.6" />
        <circle cx="400" cy="400" r="235" stroke="#FFD9E2" strokeWidth="1.3" strokeDasharray="8 12" />
        <circle cx="400" cy="400" r="325" stroke="#FAE366" strokeWidth="1.1" />
        <path
          d="M400 300 C409 358 442 391 500 400 C442 409 409 442 400 500 C391 442 358 409 300 400 C358 391 391 358 400 300 Z"
          fill="url(#gdSparkGrad)"
        />
        <defs>
          <linearGradient id="gdSparkGrad" x1="300" y1="300" x2="500" y2="500" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8AB4F8" />
            <stop offset="55%" stopColor="#A142F4" />
            <stop offset="100%" stopColor="#FFD9E2" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};
