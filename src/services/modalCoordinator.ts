/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-114] Unified Modal Stack Coordinator
 * Guarantees deterministic single-stack modal ordering and Escape key dismissal
 * while allowing independent dockable drawers (G. Comms & Music Player) to stay open.
 */

export type PrimaryModalId =
  | 'settings'
  | 'storage-settings'
  | 'oauth-wizard'
  | 'theme'
  | 'a11y'
  | 'shortcuts'
  | 'about'
  | 'tour'
  | 'codex'
  | 'logs'
  | 'format-db'
  | 'calendar'
  | 'messenger'
  | 'butler'
  | 'multicloud-sync'
  | 'batch-renamer'
  | 'batch-export'
  | 'video-trimmer'
  | 'lightbox'
  | 'destructive-confirm';

export interface ModalStackState {
  stack: PrimaryModalId[];
}

export function createModalStackState(): ModalStackState {
  return { stack: [] };
}

export function openPrimaryModal(
  state: ModalStackState,
  modalId: PrimaryModalId,
  options?: { allowStackOver?: boolean }
): ModalStackState {
  if (options?.allowStackOver) {
    const filtered = state.stack.filter((id) => id !== modalId);
    return { stack: [...filtered, modalId] };
  }
  return { stack: [modalId] };
}

export function closePrimaryModal(state: ModalStackState, modalId: PrimaryModalId): ModalStackState {
  return { stack: state.stack.filter((id) => id !== modalId) };
}

export function closeTopPrimaryModal(state: ModalStackState): {
  next: ModalStackState;
  closed: PrimaryModalId | null;
} {
  if (state.stack.length === 0) {
    return { next: state, closed: null };
  }
  const closed = state.stack[state.stack.length - 1];
  return {
    next: { stack: state.stack.slice(0, -1) },
    closed,
  };
}

export function getTopPrimaryModal(state: ModalStackState): PrimaryModalId | null {
  return state.stack.length > 0 ? state.stack[state.stack.length - 1] : null;
}

export function closeAllPrimaryModals(): ModalStackState {
  return { stack: [] };
}
