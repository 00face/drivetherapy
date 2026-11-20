/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-097] Google Ecosystem & Workspace Studio Backdrops
 * Provides:
 *  - Preloaded cross-fade Earth View satellite slideshow for Google Maps & Google Earth View
 *  - Centered, cover-fitted cross-fade slideshow for Google Chrome Artist Series
 *  - Radial-feathered & anti-aliased edge smoothing for Google Marketing Platform animation
 *  - Crisp 4K-sharp Material / Brand Kit studio backdrops for Firebase, Android, Cloud, Pay,
 *    Forms, Search, Classroom, Docs, Sheets, Slides, Keep, Meet, Photos, Calendar, NotebookLM,
 *    Play, Play Games, Ads, and Analytics.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  EARTH_VIEW_IDS,
  LOCAL_EARTH_VIEW_FALLBACKS,
  getEarthViewImageUrl,
} from '../services/earthViewCatalog';

export const GOOGLE_BRAND_BACKDROP_IDS = new Set<string>([
  'google-maps',
  'google-earth',
  'google-chrome',
  'google-marketing-platform',
  'google-firebase',
  'google-android',
  'google-cloud',
  'google-pay',
  'google-forms',
  'google-search',
  'google-classroom',
  'workspace-docs',
  'workspace-sheets',
  'workspace-slides',
  'workspace-keep',
  'workspace-meet',
  'workspace-photos',
  'workspace-calendar',
  'google-notebooklm',
  'google-play',
  'google-play-games',
  'google-ads',
  'google-analytics',
]);

interface BackdropSpec {
  baseBg: string;
  orbs: Array<{ pos: string; size: string; gradient: string; opacity: number }>;
  pattern: 'grid' | 'waves' | 'triangles' | 'contours' | 'constellation' | 'ribbons' | 'rings' | 'dots';
  patternColor: string;
  logoUrl?: string;
}

const STUDIO_BACKDROPS: Record<string, BackdropSpec> = {
  'google-firebase': {
    baseBg: '#0E131F',
    orbs: [
      { pos: 'top-[-12%] right-[6%]', size: 'w-[48vw] h-[48vw]', gradient: 'radial-gradient(circle, #FFCA28 0%, #FFA000 38%, transparent 72%)', opacity: 0.30 },
      { pos: 'bottom-[-14%] left-[8%]', size: 'w-[46vw] h-[46vw]', gradient: 'radial-gradient(circle, #DD2C00 0%, #F57C00 42%, transparent 74%)', opacity: 0.28 },
    ],
    pattern: 'grid',
    patternColor: 'rgba(255, 202, 40, 0.08)',
    logoUrl: '/themes/logos/firebase.svg',
  },
  'google-android': {
    baseBg: '#0A1612',
    orbs: [
      { pos: 'top-[-10%] left-[12%]', size: 'w-[46vw] h-[46vw]', gradient: 'radial-gradient(circle, #3DDC84 0%, #1B5E20 45%, transparent 75%)', opacity: 0.34 },
      { pos: 'bottom-[-12%] right-[10%]', size: 'w-[44vw] h-[44vw]', gradient: 'radial-gradient(circle, #073042 0%, #0D9488 45%, transparent 74%)', opacity: 0.42 },
    ],
    pattern: 'waves',
    patternColor: 'rgba(61, 220, 132, 0.14)',
  },
  'google-cloud': {
    baseBg: '#F4F8FF',
    orbs: [
      { pos: 'top-[-15%] left-[5%]', size: 'w-[44vw] h-[44vw]', gradient: 'radial-gradient(circle, #4285F4 0%, transparent 70%)', opacity: 0.22 },
      { pos: 'top-[10%] right-[-8%]', size: 'w-[38vw] h-[38vw]', gradient: 'radial-gradient(circle, #EA4335 0%, #FBBC04 45%, transparent 72%)', opacity: 0.18 },
      { pos: 'bottom-[-14%] left-[38%]', size: 'w-[42vw] h-[42vw]', gradient: 'radial-gradient(circle, #34A853 0%, transparent 72%)', opacity: 0.18 },
    ],
    pattern: 'ribbons',
    patternColor: 'rgba(21, 87, 176, 0.12)',
  },
  'google-pay': {
    baseBg: '#F5F9FF',
    orbs: [
      { pos: 'top-[-10%] left-[10%]', size: 'w-[42vw] h-[42vw]', gradient: 'radial-gradient(circle, #4285F4 0%, transparent 70%)', opacity: 0.20 },
      { pos: 'bottom-[-10%] right-[12%]', size: 'w-[42vw] h-[42vw]', gradient: 'radial-gradient(circle, #34A853 0%, #FBBC04 52%, transparent 74%)', opacity: 0.20 },
    ],
    pattern: 'ribbons',
    patternColor: 'rgba(21, 87, 176, 0.10)',
    logoUrl: '/themes/logos/google-pay.svg',
  },
  'google-forms': {
    baseBg: '#F7F3FF',
    orbs: [
      { pos: 'top-[-12%] right-[8%]', size: 'w-[44vw] h-[44vw]', gradient: 'radial-gradient(circle, #7C3AED 0%, #A78BFA 42%, transparent 72%)', opacity: 0.22 },
      { pos: 'bottom-[-12%] left-[8%]', size: 'w-[40vw] h-[40vw]', gradient: 'radial-gradient(circle, #673AB7 0%, transparent 72%)', opacity: 0.16 },
    ],
    pattern: 'dots',
    patternColor: 'rgba(124, 58, 237, 0.16)',
    logoUrl: '/themes/logos/workspace-forms.png',
  },
  'google-search': {
    baseBg: '#0E121B',
    orbs: [
      { pos: 'top-[6%] left-[12%]', size: 'w-[38vw] h-[38vw]', gradient: 'radial-gradient(circle, #4285F4 0%, transparent 72%)', opacity: 0.36 },
      { pos: 'top-[22%] right-[14%]', size: 'w-[34vw] h-[34vw]', gradient: 'radial-gradient(circle, #EA4335 0%, #FBBC04 50%, transparent 75%)', opacity: 0.26 },
      { pos: 'bottom-[4%] left-[40%]', size: 'w-[36vw] h-[36vw]', gradient: 'radial-gradient(circle, #34A853 0%, transparent 72%)', opacity: 0.28 },
    ],
    pattern: 'rings',
    patternColor: 'rgba(138, 180, 248, 0.14)',
  },
  'google-classroom': {
    baseBg: '#F0F9F4',
    orbs: [
      { pos: 'top-[-12%] right-[10%]', size: 'w-[44vw] h-[44vw]', gradient: 'radial-gradient(circle, #34A853 0%, transparent 72%)', opacity: 0.20 },
      { pos: 'bottom-[-12%] left-[10%]', size: 'w-[40vw] h-[40vw]', gradient: 'radial-gradient(circle, #FBBC04 0%, transparent 72%)', opacity: 0.18 },
    ],
    pattern: 'grid',
    patternColor: 'rgba(19, 115, 51, 0.11)',
    logoUrl: '/themes/logos/workspace-classroom.png',
  },
  'workspace-docs': {
    baseBg: '#F5F9FF',
    orbs: [
      { pos: 'top-[-12%] right-[12%]', size: 'w-[44vw] h-[44vw]', gradient: 'radial-gradient(circle, #4285F4 0%, transparent 72%)', opacity: 0.20 },
      { pos: 'bottom-[-14%] left-[8%]', size: 'w-[38vw] h-[38vw]', gradient: 'radial-gradient(circle, #8AB4F8 0%, transparent 72%)', opacity: 0.22 },
    ],
    pattern: 'waves',
    patternColor: 'rgba(21, 87, 176, 0.11)',
    logoUrl: '/themes/logos/workspace-docs.png',
  },
  'workspace-sheets': {
    baseBg: '#F2FAF5',
    orbs: [
      { pos: 'top-[-12%] right-[10%]', size: 'w-[44vw] h-[44vw]', gradient: 'radial-gradient(circle, #34A853 0%, transparent 72%)', opacity: 0.20 },
      { pos: 'bottom-[-14%] left-[10%]', size: 'w-[40vw] h-[40vw]', gradient: 'radial-gradient(circle, #81C995 0%, transparent 72%)', opacity: 0.20 },
    ],
    pattern: 'grid',
    patternColor: 'rgba(19, 115, 51, 0.10)',
    logoUrl: '/themes/logos/workspace-sheets.png',
  },
  'workspace-slides': {
    baseBg: '#FFFBF0',
    orbs: [
      { pos: 'top-[-12%] right-[10%]', size: 'w-[44vw] h-[44vw]', gradient: 'radial-gradient(circle, #F4B400 0%, transparent 72%)', opacity: 0.24 },
      { pos: 'bottom-[-14%] left-[10%]', size: 'w-[40vw] h-[40vw]', gradient: 'radial-gradient(circle, #FDE68A 0%, transparent 72%)', opacity: 0.26 },
    ],
    pattern: 'ribbons',
    patternColor: 'rgba(180, 83, 9, 0.11)',
    logoUrl: '/themes/logos/workspace-slides.png',
  },
  'workspace-keep': {
    baseBg: '#FEF7DF',
    orbs: [
      { pos: 'top-[-10%] left-[10%]', size: 'w-[42vw] h-[42vw]', gradient: 'radial-gradient(circle, #FBBC04 0%, transparent 72%)', opacity: 0.24 },
      { pos: 'bottom-[-12%] right-[10%]', size: 'w-[40vw] h-[40vw]', gradient: 'radial-gradient(circle, #F59E0B 0%, transparent 72%)', opacity: 0.18 },
    ],
    pattern: 'dots',
    patternColor: 'rgba(180, 83, 9, 0.15)',
    logoUrl: '/themes/logos/workspace-keep.png',
  },
  'workspace-meet': {
    baseBg: '#0C1A18',
    orbs: [
      { pos: 'top-[-10%] left-[10%]', size: 'w-[44vw] h-[44vw]', gradient: 'radial-gradient(circle, #00897B 0%, transparent 72%)', opacity: 0.36 },
      { pos: 'bottom-[-10%] right-[12%]', size: 'w-[42vw] h-[42vw]', gradient: 'radial-gradient(circle, #34A853 0%, #4285F4 55%, transparent 76%)', opacity: 0.28 },
    ],
    pattern: 'rings',
    patternColor: 'rgba(45, 212, 191, 0.14)',
    logoUrl: '/themes/logos/workspace-meet.png',
  },
  'workspace-photos': {
    baseBg: '#F8FAFD',
    orbs: [
      { pos: 'top-[-10%] left-[8%]', size: 'w-[38vw] h-[38vw]', gradient: 'radial-gradient(circle, #EA4335 0%, transparent 72%)', opacity: 0.16 },
      { pos: 'top-[8%] right-[8%]', size: 'w-[38vw] h-[38vw]', gradient: 'radial-gradient(circle, #FBBC04 0%, transparent 72%)', opacity: 0.18 },
      { pos: 'bottom-[-10%] left-[24%]', size: 'w-[38vw] h-[38vw]', gradient: 'radial-gradient(circle, #34A853 0%, #4285F4 55%, transparent 74%)', opacity: 0.18 },
    ],
    pattern: 'waves',
    patternColor: 'rgba(21, 87, 176, 0.10)',
    logoUrl: '/themes/logos/workspace-drive.png',
  },
  'workspace-calendar': {
    baseBg: '#F2F7FF',
    orbs: [
      { pos: 'top-[-12%] left-[12%]', size: 'w-[44vw] h-[44vw]', gradient: 'radial-gradient(circle, #4285F4 0%, transparent 72%)', opacity: 0.22 },
      { pos: 'bottom-[-12%] right-[10%]', size: 'w-[38vw] h-[38vw]', gradient: 'radial-gradient(circle, #34A853 0%, transparent 72%)', opacity: 0.16 },
    ],
    pattern: 'grid',
    patternColor: 'rgba(21, 87, 176, 0.11)',
    logoUrl: '/themes/logos/workspace-calendar.png',
  },
  'google-notebooklm': {
    baseBg: '#10141E',
    orbs: [
      { pos: 'top-[-10%] left-[14%]', size: 'w-[46vw] h-[46vw]', gradient: 'radial-gradient(circle, #3B82F6 0%, #6366F1 45%, transparent 75%)', opacity: 0.34 },
      { pos: 'bottom-[-12%] right-[12%]', size: 'w-[42vw] h-[42vw]', gradient: 'radial-gradient(circle, #34D399 0%, #06B6D4 48%, transparent 76%)', opacity: 0.28 },
    ],
    pattern: 'constellation',
    patternColor: 'rgba(138, 180, 248, 0.18)',
    logoUrl: '/themes/logos/workspace-gemini.png',
  },
  'google-play': {
    baseBg: '#F6FBF9',
    orbs: [
      { pos: 'top-[-12%] left-[8%]', size: 'w-[40vw] h-[40vw]', gradient: 'radial-gradient(circle, #00D2FF 0%, transparent 72%)', opacity: 0.20 },
      { pos: 'top-[10%] right-[8%]', size: 'w-[38vw] h-[38vw]', gradient: 'radial-gradient(circle, #00F076 0%, transparent 72%)', opacity: 0.18 },
      { pos: 'bottom-[-12%] left-[38%]', size: 'w-[40vw] h-[40vw]', gradient: 'radial-gradient(circle, #FFC900 0%, #FF3A44 55%, transparent 74%)', opacity: 0.16 },
    ],
    pattern: 'triangles',
    patternColor: 'rgba(1, 117, 82, 0.12)',
  },
  'google-play-games': {
    baseBg: '#0B120F',
    orbs: [
      { pos: 'top-[-10%] left-[12%]', size: 'w-[44vw] h-[44vw]', gradient: 'radial-gradient(circle, #00E676 0%, #00A152 48%, transparent 74%)', opacity: 0.32 },
      { pos: 'bottom-[-12%] right-[10%]', size: 'w-[42vw] h-[42vw]', gradient: 'radial-gradient(circle, #00B0FF 0%, transparent 72%)', opacity: 0.24 },
    ],
    pattern: 'triangles',
    patternColor: 'rgba(0, 230, 118, 0.14)',
  },
  'google-ads': {
    baseBg: '#F6F9FE',
    orbs: [
      { pos: 'top-[-10%] left-[10%]', size: 'w-[42vw] h-[42vw]', gradient: 'radial-gradient(circle, #FBBC04 0%, transparent 72%)', opacity: 0.22 },
      { pos: 'bottom-[-12%] right-[10%]', size: 'w-[44vw] h-[44vw]', gradient: 'radial-gradient(circle, #4285F4 0%, #34A853 55%, transparent 75%)', opacity: 0.20 },
    ],
    pattern: 'ribbons',
    patternColor: 'rgba(21, 87, 176, 0.11)',
  },
  'google-analytics': {
    baseBg: '#FFFBF2',
    orbs: [
      { pos: 'top-[-10%] right-[10%]', size: 'w-[44vw] h-[44vw]', gradient: 'radial-gradient(circle, #F9AB00 0%, #E37400 45%, transparent 74%)', opacity: 0.22 },
      { pos: 'bottom-[-12%] left-[10%]', size: 'w-[40vw] h-[40vw]', gradient: 'radial-gradient(circle, #FDE68A 0%, transparent 74%)', opacity: 0.26 },
    ],
    pattern: 'grid',
    patternColor: 'rgba(179, 89, 0, 0.12)',
  },
};

const CHROME_ARTIST_SLIDES: Array<
  | { kind: 'image'; src: string; label: string }
  | { kind: 'art'; bg: string; accents: [string, string, string]; label: string }
> = [
  { kind: 'image', src: '/themes/originals/google-chrome-artist-kaitlin.png', label: 'Rising Artists · Kaitlin' },
  { kind: 'art', bg: 'linear-gradient(135deg, #FCE7F3 0%, #DBEAFE 52%, #DCFCE7 100%)', accents: ['#F472B6', '#60A5FA', '#34D399'], label: 'Rising Artists · Botanical Bloom' },
  { kind: 'art', bg: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 45%, #E0E7FF 100%)', accents: ['#F59E0B', '#FB7185', '#6366F1'], label: 'Rising Artists · Sunlit Horizon' },
  { kind: 'art', bg: 'linear-gradient(135deg, #E0F2FE 0%, #EDE9FE 50%, #FCE7F3 100%)', accents: ['#38BDF8', '#A855F7', '#F43F5E'], label: 'Rising Artists · Prismatic Studio' },
];

const EarthViewSlideshowBackdrop: React.FC = () => {
  const [slotA, setSlotA] = useState<string>(LOCAL_EARTH_VIEW_FALLBACKS[0]);
  const [slotB, setSlotB] = useState<string>(LOCAL_EARTH_VIEW_FALLBACKS[1]);
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');
  const indexRef = useRef<number>(Math.floor(Math.random() * EARTH_VIEW_IDS.length));

  useEffect(() => {
    let cancelled = false;

    const advanceSlide = () => {
      if (typeof document !== 'undefined' && document.body.classList.contains('calm-motion')) {
        return;
      }
      indexRef.current = (indexRef.current + 1) % EARTH_VIEW_IDS.length;
      const nextId = EARTH_VIEW_IDS[indexRef.current];
      const candidateUrl = getEarthViewImageUrl(nextId);
      const fallbackUrl =
        LOCAL_EARTH_VIEW_FALLBACKS[indexRef.current % LOCAL_EARTH_VIEW_FALLBACKS.length];

      const preloader = new Image();
      preloader.onload = () => {
        if (cancelled) return;
        setActiveSlot((prev) => {
          if (prev === 'A') {
            setSlotB(candidateUrl);
            return 'B';
          }
          setSlotA(candidateUrl);
          return 'A';
        });
      };
      preloader.onerror = () => {
        if (cancelled) return;
        setActiveSlot((prev) => {
          if (prev === 'A') {
            setSlotB(fallbackUrl);
            return 'B';
          }
          setSlotA(fallbackUrl);
          return 'A';
        });
      };
      preloader.src = candidateUrl;
    };

    const initialTimer = window.setTimeout(advanceSlide, 5000);
    const interval = window.setInterval(advanceSlide, 18000);
    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 select-none bg-[#0A1622]" aria-hidden="true">
      <img
        src={slotA}
        alt=""
        className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-[2500ms] ease-in-out ${
          activeSlot === 'A' ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <img
        src={slotB}
        alt=""
        className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-[2500ms] ease-in-out ${
          activeSlot === 'B' ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {/* Subtle dark atmospheric scrim so translucent UI cards remain crystal clear */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/15 to-black/35" />
    </div>
  );
};

const ChromeArtistSlideshowBackdrop: React.FC = () => {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.body.classList.contains('calm-motion')) {
        return;
      }
      setActiveIdx((i) => (i + 1) % CHROME_ARTIST_SLIDES.length);
    }, 12000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 select-none bg-[#F8FAFD]" aria-hidden="true">
      {CHROME_ARTIST_SLIDES.map((slide, idx) => (
        <div
          key={slide.label}
          className={`absolute inset-0 transition-opacity duration-[2500ms] ease-in-out ${
            idx === activeIdx ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {slide.kind === 'image' ? (
            <img
              src={slide.src}
              alt=""
              className="w-full h-full object-cover object-center"
            />
          ) : (
            <div className="w-full h-full relative" style={{ background: slide.bg }}>
              <div
                className="absolute inset-0"
                style={{ filter: 'blur(64px)', opacity: 0.42 }}
              >
                <div
                  className="absolute top-[10%] left-[14%] w-[42vw] h-[42vw] rounded-full"
                  style={{ background: `radial-gradient(circle, ${slide.accents[0]} 0%, transparent 70%)` }}
                />
                <div
                  className="absolute bottom-[8%] right-[14%] w-[44vw] h-[44vw] rounded-full"
                  style={{ background: `radial-gradient(circle, ${slide.accents[1]} 0%, transparent 70%)` }}
                />
                <div
                  className="absolute top-[42%] left-[44%] w-[34vw] h-[34vw] rounded-full"
                  style={{ background: `radial-gradient(circle, ${slide.accents[2]} 0%, transparent 72%)` }}
                />
              </div>
            </div>
          )}
        </div>
      ))}
      <div className="absolute inset-0 bg-white/15" />
    </div>
  );
};

const MarketingPlatformSmoothedBackdrop: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 select-none bg-[#0F172A]" aria-hidden="true">
      {/* Ambient navy/blue aura */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 48%, rgba(37, 99, 235, 0.28) 0%, rgba(15, 23, 42, 0.96) 72%)',
        }}
      />
      {/* Radial-feathered & edge-smoothed GMP brand animation */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          WebkitMaskImage: 'radial-gradient(ellipse 68% 66% at 50% 50%, #000 52%, transparent 94%)',
          maskImage: 'radial-gradient(ellipse 68% 66% at 50% 50%, #000 52%, transparent 94%)',
        }}
      >
        <img
          src="/themes/originals/google-marketing-platform-2018.gif"
          alt=""
          className="w-full h-full object-cover object-center opacity-75"
          style={{ filter: 'blur(0.7px) contrast(1.03) saturate(1.08)' }}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/70 via-transparent to-[#0F172A]/50" />
    </div>
  );
};

export const GoogleBrandBackdrop: React.FC<{ themeId: string }> = ({ themeId }) => {
  if (!GOOGLE_BRAND_BACKDROP_IDS.has(themeId)) return null;

  if (themeId === 'google-maps' || themeId === 'google-earth') {
    return <EarthViewSlideshowBackdrop />;
  }
  if (themeId === 'google-chrome') {
    return <ChromeArtistSlideshowBackdrop />;
  }
  if (themeId === 'google-marketing-platform') {
    return <MarketingPlatformSmoothedBackdrop />;
  }

  const spec = STUDIO_BACKDROPS[themeId];
  if (!spec) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden -z-10 select-none"
      style={{ backgroundColor: spec.baseBg }}
      aria-hidden="true"
    >
      {/* Diffused Brand Palette Orbs */}
      <div className="absolute inset-0" style={{ filter: 'blur(72px)' }}>
        {spec.orbs.map((orb, i) => (
          <div
            key={i}
            className={`absolute rounded-full ${orb.pos} ${orb.size}`}
            style={{ background: orb.gradient, opacity: orb.opacity }}
          />
        ))}
      </div>

      {/* Crisp Resolution-Independent Architectural Pattern */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {spec.pattern === 'grid' && (
          <>
            <defs>
              <pattern id={`grid-${themeId}`} width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke={spec.patternColor} strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#grid-${themeId})`} />
          </>
        )}
        {spec.pattern === 'dots' && (
          <>
            <defs>
              <pattern id={`dots-${themeId}`} width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="4" cy="4" r="1.5" fill={spec.patternColor} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#dots-${themeId})`} />
          </>
        )}
        {spec.pattern === 'waves' && (
          <g fill="none" stroke={spec.patternColor} strokeWidth="1.5">
            <path d="M-100 220 Q 300 120 700 240 T 1600 200 T 2400 240" />
            <path d="M-100 380 Q 350 280 780 400 T 1650 360 T 2400 400" />
            <path d="M-100 560 Q 400 460 840 580 T 1700 540 T 2400 580" />
          </g>
        )}
        {spec.pattern === 'ribbons' && (
          <g fill="none" stroke={spec.patternColor} strokeWidth="2">
            <path d="M-80 680 C 320 420, 720 780, 1280 340 C 1640 80, 1960 280, 2320 120" />
            <path d="M-80 760 C 360 500, 760 840, 1320 420 C 1680 160, 2000 360, 2360 200" />
          </g>
        )}
        {spec.pattern === 'rings' && (
          <g fill="none" stroke={spec.patternColor} strokeWidth="1.4">
            <circle cx="82%" cy="76%" r="160" />
            <circle cx="82%" cy="76%" r="280" strokeDasharray="8 12" />
            <circle cx="82%" cy="76%" r="420" />
          </g>
        )}
        {spec.pattern === 'triangles' && (
          <g fill="none" stroke={spec.patternColor} strokeWidth="1.4">
            <polygon points="1180,140 1440,300 1180,460" />
            <polygon points="1240,200 1420,310 1240,420" />
            <polygon points="180,540 380,660 180,780" />
          </g>
        )}
        {spec.pattern === 'constellation' && (
          <g stroke={spec.patternColor} fill={spec.patternColor} strokeWidth="1.2">
            <line x1="16%" y1="22%" x2="32%" y2="38%" />
            <line x1="32%" y1="38%" x2="54%" y2="26%" />
            <line x1="54%" y1="26%" x2="78%" y2="48%" />
            <line x1="78%" y1="48%" x2="64%" y2="74%" />
            <circle cx="16%" cy="22%" r="4" />
            <circle cx="32%" cy="38%" r="5" />
            <circle cx="54%" cy="26%" r="4" />
            <circle cx="78%" cy="48%" r="5" />
            <circle cx="64%" cy="74%" r="4" />
          </g>
        )}
      </svg>

      {/* Subtle Official Brand Watermark in Bottom-Right */}
      {spec.logoUrl && (
        <img
          src={spec.logoUrl}
          alt=""
          className="absolute right-8 bottom-12 w-36 h-36 object-contain opacity-[0.12] select-none"
        />
      )}
    </div>
  );
};
