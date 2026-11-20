/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Spatial 2D D-Pad / Arrow-Key Focus Navigation Engine for TV & Keyboard Power Users
 */

export type DpadDirection = 'up' | 'down' | 'left' | 'right';

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface SpatialCandidate<T = HTMLElement> {
  el: T;
  rect: RectLike;
}

export function findNextSpatialFocusable<T>(
  activeRect: RectLike,
  candidates: Array<SpatialCandidate<T>>,
  direction: DpadDirection
): T | null {
  const cx = activeRect.left + activeRect.width / 2;
  const cy = activeRect.top + activeRect.height / 2;

  let bestEl: T | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const cand of candidates) {
    const { rect } = cand;
    if (rect.width <= 0 || rect.height <= 0) continue;

    const tx = rect.left + rect.width / 2;
    const ty = rect.top + rect.height / 2;
    const dx = tx - cx;
    const dy = ty - cy;

    if (direction === 'right' && dx <= 4) continue;
    if (direction === 'left' && dx >= -4) continue;
    if (direction === 'down' && dy <= 4) continue;
    if (direction === 'up' && dy >= -4) continue;

    const primary = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy);
    const orthogonal = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = primary + orthogonal * 2.5;

    if (score < bestScore) {
      bestScore = score;
      bestEl = cand.el;
    }
  }

  return bestEl;
}
