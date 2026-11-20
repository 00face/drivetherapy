/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Procedural Vim Navigation Hook
 * Ergonomic procedural keyboard navigation (j/k/h/l cursor motion, gg/G jumps,
 * / omnibox focus, y path/link yanking, p/x culling, and ? shortcut palette).
 */

import { useEffect, useRef } from 'react';
import { MediaAsset, CullingStatus } from '../types';

interface UseVimNavigationOptions {
  enabled: boolean;
  assets: MediaAsset[];
  selectedAssetId?: string;
  onSelectAsset: (asset: MediaAsset) => void;
  onUpdateCulling?: (id: string, status: CullingStatus) => void;
  onUpdateRating?: (id: string, rating: number) => void;
  onOpenShortcuts?: () => void;
  onOpenLightbox?: (asset: MediaAsset) => void;
  onToast?: (message: string) => void;
}

export function useVimNavigation({
  enabled,
  assets,
  selectedAssetId,
  onSelectAsset,
  onUpdateCulling,
  onUpdateRating,
  onOpenShortcuts,
  onOpenLightbox,
  onToast,
}: UseVimNavigationOptions) {
  const lastGPressTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in form inputs, except for Escape
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isInput) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      // Ignore when standard modifier keys are held (Cmd/Ctrl/Alt) except Shift for 'G' and '?'
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const currentIndex = assets.findIndex((a) => a.id === selectedAssetId);
      const activeAsset = currentIndex >= 0 ? assets[currentIndex] : assets[0];

      // Procedural Vim Commands:
      switch (e.key) {
        // Search focus: /
        case '/': {
          e.preventDefault();
          const searchInput = document.querySelector('header input[type="text"]') as HTMLInputElement | null;
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
          break;
        }

        // Help palette: ?
        case '?': {
          e.preventDefault();
          onOpenShortcuts?.();
          break;
        }

        // Down / Next: j or ArrowDown
        case 'j':
        case 'ArrowDown': {
          e.preventDefault();
          if (assets.length === 0) return;
          const nextIndex = currentIndex < assets.length - 1 ? currentIndex + 1 : 0;
          onSelectAsset(assets[nextIndex]);
          break;
        }

        // Up / Previous: k or ArrowUp
        case 'k':
        case 'ArrowUp': {
          e.preventDefault();
          if (assets.length === 0) return;
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : assets.length - 1;
          onSelectAsset(assets[prevIndex]);
          break;
        }

        // Left: h or ArrowLeft
        case 'h':
        case 'ArrowLeft': {
          e.preventDefault();
          if (assets.length === 0) return;
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
          onSelectAsset(assets[prevIndex]);
          break;
        }

        // Right: l or ArrowRight
        case 'l':
        case 'ArrowRight': {
          e.preventDefault();
          if (assets.length === 0) return;
          const nextIndex = currentIndex < assets.length - 1 ? currentIndex + 1 : assets.length - 1;
          onSelectAsset(assets[nextIndex]);
          break;
        }

        // gg: Jump to first item
        case 'g': {
          const now = Date.now();
          if (now - lastGPressTimeRef.current < 450) {
            e.preventDefault();
            if (assets.length > 0) {
              onSelectAsset(assets[0]);
              window.scrollTo({ top: 0, behavior: 'smooth' });
              onToast?.('Jumped to top [gg]');
            }
            lastGPressTimeRef.current = 0;
          } else {
            lastGPressTimeRef.current = now;
          }
          break;
        }

        // G: Jump to last item
        case 'G': {
          e.preventDefault();
          if (assets.length > 0) {
            const last = assets[assets.length - 1];
            onSelectAsset(last);
            onToast?.('Jumped to end [G]');
          }
          break;
        }

        // Yank: y -> Copy asset path or cloud link
        case 'y': {
          if (activeAsset) {
            e.preventDefault();
            const textToCopy = activeAsset.cloudUrl || activeAsset.path || activeAsset.name;
            if (navigator.clipboard) {
              navigator.clipboard.writeText(textToCopy).then(() => {
                onToast?.(`Yanked: ${activeAsset.name}`);
              }).catch(() => {});
            }
          }
          break;
        }

        // Pick / Keep: p
        case 'p': {
          if (activeAsset && onUpdateCulling) {
            e.preventDefault();
            onUpdateCulling(activeAsset.id, 'picked');
            onToast?.(`Kept: ${activeAsset.name}`);
          }
          break;
        }

        // Dismiss / Reject: x or d
        case 'x':
        case 'd': {
          if (activeAsset && onUpdateCulling) {
            e.preventDefault();
            onUpdateCulling(activeAsset.id, 'rejected');
            onToast?.(`Dismissed: ${activeAsset.name}`);
          }
          break;
        }

        // Unrate / Clear: u
        case 'u': {
          if (activeAsset && onUpdateCulling) {
            e.preventDefault();
            onUpdateCulling(activeAsset.id, 'unrated');
            onToast?.(`Cleared status: ${activeAsset.name}`);
          }
          break;
        }

        // Star rating: 1-5
        case '1':
        case '2':
        case '3':
        case '4':
        case '5': {
          if (activeAsset && onUpdateRating) {
            e.preventDefault();
            const stars = Number(e.key);
            onUpdateRating(activeAsset.id, stars);
            onToast?.(`Rated ${stars}★: ${activeAsset.name}`);
          }
          break;
        }

        // Zoom / Lightbox / Inspect: z or Enter
        case 'z':
        case 'Enter': {
          if (activeAsset && onOpenLightbox) {
            e.preventDefault();
            onOpenLightbox(activeAsset);
          }
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    assets,
    selectedAssetId,
    onSelectAsset,
    onUpdateCulling,
    onUpdateRating,
    onOpenShortcuts,
    onOpenLightbox,
    onToast,
  ]);
}
