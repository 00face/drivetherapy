/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-055] Mobile Touch Ergonomics — Pointer Momentum & One-Handed Swipe Gestures
 * Maps touch/pointer swipes in Culling Room and mobile drawers:
 *  - swipe-right -> Pick
 *  - swipe-left  -> Reject
 *  - swipe-up    -> Star / Favorite
 *  - swipe-down  -> Dismiss / Back
 */

export type SwipeDirection = 'swipe-right' | 'swipe-left' | 'swipe-up' | 'swipe-down' | 'none';

export interface PointerPoint {
  x: number;
  y: number;
  timestamp: number;
}

export interface SwipeResult {
  direction: SwipeDirection;
  distancePx: number;
  velocityPxPerMs: number;
}

export function evaluateSwipeGesture(
  start: PointerPoint,
  end: PointerPoint,
  minDistancePx = 56,
  maxDurationMs = 750
): SwipeResult {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const elapsed = Math.max(1, end.timestamp - start.timestamp);
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const distancePx = Math.hypot(dx, dy);
  const velocityPxPerMs = distancePx / elapsed;

  if (elapsed > maxDurationMs || distancePx < minDistancePx) {
    return { direction: 'none', distancePx, velocityPxPerMs };
  }

  // Axis-locked decision with 1.25x dominance ratio to avoid accidental diagonal triggers
  if (absX >= absY * 1.25) {
    return {
      direction: dx > 0 ? 'swipe-right' : 'swipe-left',
      distancePx,
      velocityPxPerMs,
    };
  }

  if (absY >= absX * 1.25) {
    return {
      direction: dy < 0 ? 'swipe-up' : 'swipe-down',
      distancePx,
      velocityPxPerMs,
    };
  }

  return { direction: 'none', distancePx, velocityPxPerMs };
}
