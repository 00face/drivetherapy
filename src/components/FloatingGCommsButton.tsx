/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Floating Gemstone G. Comms Button (Half-Size, 40% Translucent, Non-Obscuring + Draggable)
 * Two-layer composite:
 *  1) Alpha-transparent faceted gemstone chat bubble PNG (36px inside 44px hit target, 40% idle opacity)
 *  2) Animated floating 4-color Gemini Star SVG glowing inside the crystal core
 *
 * Default anchor: bottom-[70px] left-[76px] (clear of 64px MiniDock & 52px UnifiedFooter).
 * Supports pointer-drag repositioning persisted in localStorage; double-click resets position.
 */

import React, { useEffect, useRef, useState } from 'react';

export type GCommsGemColor = 'diamond' | 'sapphire' | 'emerald' | 'amber' | 'amethyst';

export const GEM_VARIANTS: Array<{ id: GCommsGemColor; label: string; src: string; glow: string }> = [
  { id: 'diamond', label: 'Diamond', src: '/assets/gems/gem_diamond.png', glow: 'rgba(186, 230, 253, 0.55)' },
  { id: 'sapphire', label: 'Sapphire', src: '/assets/gems/gem_sapphire.png', glow: 'rgba(59, 130, 246, 0.55)' },
  { id: 'emerald', label: 'Emerald', src: '/assets/gems/gem_emerald.png', glow: 'rgba(16, 185, 129, 0.55)' },
  { id: 'amber', label: 'Amber', src: '/assets/gems/gem_amber.png', glow: 'rgba(245, 158, 11, 0.55)' },
  { id: 'amethyst', label: 'Amethyst', src: '/assets/gems/gem_amethyst.png', glow: 'rgba(192, 38, 211, 0.55)' },
];

const GEM_STORAGE_KEY = 'dt_gcomms_gem_v1';
const POS_STORAGE_KEY = 'dt_gcomms_pos_v1';

interface SavedPosition {
  left: number;
  bottom: number;
}

const DEFAULT_POSITION: SavedPosition = { left: 76, bottom: 70 };

export function resolveReactiveGemColor(params: {
  isActive?: boolean;
  activeTab?: string;
  isGeminiBusy?: boolean;
  isScanning?: boolean;
  currentMode?: string;
}): GCommsGemColor {
  if (params.isGeminiBusy) {
    return 'amethyst';
  }
  if (params.isActive && params.activeTab === 'chat') {
    return 'emerald';
  }
  if (params.isActive) {
    return 'sapphire';
  }
  if (params.isScanning) {
    return 'amber';
  }
  if (params.currentMode === 'culling' || params.currentMode === 'google-photos') {
    return 'amethyst';
  }
  return 'diamond';
}

interface FloatingGCommsButtonProps {
  onClick: () => void;
  isActive?: boolean;
  activeTab?: string;
  isGeminiBusy?: boolean;
  isScanning?: boolean;
  currentMode?: string;
  leftClearancePx?: number;
}

export const FloatingGCommsButton: React.FC<FloatingGCommsButtonProps> = ({
  onClick,
  isActive = false,
  activeTab,
  isGeminiBusy = false,
  isScanning = false,
  currentMode,
  leftClearancePx = 76,
}) => {
  const [manualOverride, setManualOverride] = useState<GCommsGemColor | 'auto'>(() => {
    try {
      const saved = localStorage.getItem(GEM_STORAGE_KEY) as GCommsGemColor | 'auto' | null;
      return saved && (saved === 'auto' || GEM_VARIANTS.some((g) => g.id === saved)) ? saved : 'auto';
    } catch {
      return 'auto';
    }
  });

  const [position, setPosition] = useState<SavedPosition>(() => {
    try {
      const raw = localStorage.getItem(POS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedPosition>;
        if (typeof parsed.left === 'number' && typeof parsed.bottom === 'number') {
          return {
            left: Math.max(72, parsed.left),
            bottom: Math.max(64, parsed.bottom),
          };
        }
      }
    } catch {}
    return DEFAULT_POSITION;
  });

  const dragRef = useRef<{
    startX: number;
    startY: number;
    origLeft: number;
    origBottom: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    const onResize = () => {
      setPosition((prev) => ({
        left: Math.max(72, Math.min(window.innerWidth - 56, prev.left)),
        bottom: Math.max(64, Math.min(window.innerHeight - 64, prev.bottom)),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const resolvedColor: GCommsGemColor =
    manualOverride !== 'auto'
      ? manualOverride
      : resolveReactiveGemColor({ isActive, activeTab, isGeminiBusy, isScanning, currentMode });

  const activeGem = GEM_VARIANTS.find((g) => g.id === resolvedColor) || GEM_VARIANTS[0];
  const engaged = isActive || isGeminiBusy;

  const cycleGem = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const order: Array<GCommsGemColor | 'auto'> = ['auto', 'diamond', 'sapphire', 'emerald', 'amber', 'amethyst'];
    const next = order[(order.indexOf(manualOverride) + 1) % order.length];
    setManualOverride(next);
    try {
      localStorage.setItem(GEM_STORAGE_KEY, next);
    } catch {}
  };

  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: effectiveLeft,
      origBottom: position.bottom,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragRef.current;
    if (!state) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < 6) return;
    if (!state.moved) setIsDragging(true);
    state.moved = true;
    const maxLeft = typeof window !== 'undefined' ? window.innerWidth - 56 : 1200;
    const maxBottom = typeof window !== 'undefined' ? window.innerHeight - 64 : 720;
    const nextPos: SavedPosition = {
      left: Math.max(72, Math.min(maxLeft, Math.round(state.origLeft + dx))),
      bottom: Math.max(64, Math.min(maxBottom, Math.round(state.origBottom - dy))),
    };
    setPosition(nextPos);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragRef.current;
    if (!state) return;
    dragRef.current = null;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    if (state.moved) {
      try {
        localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(position));
      } catch {}
    } else {
      onClick();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPosition(DEFAULT_POSITION);
    try {
      localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(DEFAULT_POSITION));
    } catch {}
  };

  const effectiveLeft = position.left < 560 ? Math.max(leftClearancePx, position.left) : position.left;
  const [isHovered, setIsHovered] = useState(false);

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const alignRightEdge = effectiveLeft > viewportWidth - 260;
  const alignLeftEdge = effectiveLeft < 180;
  const placeBelow = position.bottom > viewportHeight - 130;

  const statusText = isGeminiBusy
    ? 'Castor Thinking'
    : isActive && activeTab === 'chat'
    ? 'Google Chat Open · Click to Close'
    : isActive
    ? 'Castor Chat Open · Click to Close'
    : isScanning
    ? 'Drive Scan Active'
    : 'Click to Open G. Comms';

  return (
    <div
      className="fixed left-0 bottom-0 z-[60] flex items-center select-none will-change-transform"
      style={{
        transform: `translate3d(${effectiveLeft}px, ${-position.bottom}px, 0)`,
        transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative">
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          onContextMenu={cycleGem}
          onFocus={() => setIsHovered(true)}
          onBlur={() => setIsHovered(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick();
            }
          }}
          aria-label={`${isActive ? 'Close' : 'Open'} G. Comms (${activeGem.label} Gemstone)`}
          aria-pressed={isActive}
          className={`relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1074B1] dt-gem-float cursor-grab active:cursor-grabbing group transition-opacity duration-300 touch-none ${
            engaged ? 'opacity-100' : 'opacity-50 hover:opacity-100 focus-visible:opacity-100'
          }`}
          style={{
            filter: `drop-shadow(0 4px 10px ${activeGem.glow})`,
          }}
        >
          {/* Layer 1: Realistic Faceted Gemstone Chat Bubble PNG (Half Size: 36px) */}
          <img
            src={activeGem.src}
            alt={`${activeGem.label} chat bubble`}
            className={`w-9 h-9 object-contain pointer-events-none transition-transform duration-300 group-hover:scale-110 ${
              isGeminiBusy ? 'animate-pulse' : ''
            }`}
            draggable={false}
          />

          {/* Layer 2: Animated Floating 4-Color Gemini Star Glowing Inside */}
          <svg
            viewBox="0 0 64 64"
            className="w-4 h-4 absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none dt-gemini-star-glow"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="dtGeminiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#EA4335" />
                <stop offset="33%" stopColor="#FBBC05" />
                <stop offset="66%" stopColor="#34A853" />
                <stop offset="100%" stopColor="#4285F4" />
              </linearGradient>
              <filter id="dtGeminiBloom" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path
              d="M32 4 C34.5 21 43 29.5 60 32 C43 34.5 34.5 43 32 60 C29.5 43 21 34.5 4 32 C21 29.5 29.5 21 32 4 Z"
              fill="url(#dtGeminiGrad)"
              filter="url(#dtGeminiBloom)"
            />
          </svg>
        </button>

        {/* Viewport-Clamped Tooltip (Never Clips Off-Screen) */}
        {isHovered && !isDragging && (
          <div
            role="tooltip"
            className={`pointer-events-none absolute z-[70] w-max max-w-[min(260px,calc(100vw-24px))] px-3 py-1.5 rounded-xl border shadow-xl text-[11px] leading-snug font-medium dt-motion-fade ${
              placeBelow ? 'top-full mt-2' : 'bottom-full mb-2'
            } ${
              alignLeftEdge
                ? 'left-0'
                : alignRightEdge
                ? 'right-0'
                : 'left-1/2 -translate-x-1/2'
            }`}
            style={{
              backgroundColor: 'var(--theme-surface, #0f172a)',
              borderColor: 'var(--theme-border, rgba(148,163,184,0.35))',
              color: 'var(--theme-text, #f8fafc)',
            }}
          >
            <div className="font-bold">
              G. Comms · {activeGem.label}
              {manualOverride === 'auto' ? ' (Auto)' : ''}
            </div>
            <div className="opacity-80">{statusText}</div>
            <div className="opacity-65 text-[10px]">
              Drag to move · Double-click reset · Right-click gem
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
