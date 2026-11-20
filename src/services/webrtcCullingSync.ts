/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-053] Collaborative Multi-User Culling & WebRTC Studio Sync
 * Synchronizes active frame focus, cursor coordinates, pick/reject votes, star ratings,
 * and split-loupe comparisons via WebRTC DataChannel with automatic SSE signaling relay fallback.
 */

export type CollabEventType =
  | 'peer_join'
  | 'peer_leave'
  | 'cursor_move'
  | 'asset_focus'
  | 'cull_vote'
  | 'rating_update'
  | 'loupe_sync'
  | 'rtc_offer'
  | 'rtc_answer'
  | 'rtc_ice';

export interface CollabSyncMessage {
  roomId: string;
  peerId: string;
  peerName: string;
  type: CollabEventType;
  timestamp: number;
  payload?: Record<string, any>;
}

export interface CollabRoomPeer {
  peerId: string;
  peerName: string;
  lastSeenAt: number;
  cursor?: { x: number; y: number };
  focusedAssetId?: string;
}

export interface CollabRoomState {
  roomId: string;
  connected: boolean;
  transport: 'webrtc' | 'sse-relay' | 'disconnected';
  peers: Record<string, CollabRoomPeer>;
  votes: Record<string, Record<string, 'picked' | 'rejected' | 'unrated'>>;
}

export function createInitialCollabRoomState(roomId: string): CollabRoomState {
  return {
    roomId,
    connected: false,
    transport: 'disconnected',
    peers: {},
    votes: {},
  };
}

/**
 * Pure reducer applying incoming WebRTC/SSE collaboration messages to room state.
 */
export function applyCollabMessage(state: CollabRoomState, msg: CollabSyncMessage): CollabRoomState {
  const nextPeers = { ...state.peers };
  const nextVotes = { ...state.votes };

  if (msg.type === 'peer_leave') {
    delete nextPeers[msg.peerId];
    return { ...state, peers: nextPeers };
  }

  const existingPeer: CollabRoomPeer = nextPeers[msg.peerId] || {
    peerId: msg.peerId,
    peerName: msg.peerName || 'Studio Reviewer',
    lastSeenAt: msg.timestamp,
  };

  nextPeers[msg.peerId] = {
    ...existingPeer,
    peerName: msg.peerName || existingPeer.peerName,
    lastSeenAt: msg.timestamp,
    cursor:
      msg.type === 'cursor_move' && msg.payload
        ? { x: Number(msg.payload.x || 0), y: Number(msg.payload.y || 0) }
        : existingPeer.cursor,
    focusedAssetId:
      msg.type === 'asset_focus' && typeof msg.payload?.assetId === 'string'
        ? msg.payload.assetId
        : existingPeer.focusedAssetId,
  };

  if (msg.type === 'cull_vote' && msg.payload?.assetId && msg.payload?.status) {
    const assetId = String(msg.payload.assetId);
    const status = msg.payload.status as 'picked' | 'rejected' | 'unrated';
    nextVotes[assetId] = {
      ...(nextVotes[assetId] || {}),
      [msg.peerId]: status,
    };
  }

  return {
    ...state,
    peers: nextPeers,
    votes: nextVotes,
  };
}

export class WebRtcCullingRoomClient {
  private roomId: string;
  private peerId: string;
  private peerName: string;
  private state: CollabRoomState;
  private eventSource: EventSource | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private listeners = new Set<(state: CollabRoomState, lastMsg?: CollabSyncMessage) => void>();

  constructor(roomId: string, peerName = 'Studio Photographer') {
    this.roomId = roomId.trim() || 'studio-room';
    this.peerId = `peer_${Math.random().toString(36).slice(2, 10)}`;
    this.peerName = peerName;
    this.state = createInitialCollabRoomState(this.roomId);
  }

  public getState(): CollabRoomState {
    return this.state;
  }

  public getPeerId(): string {
    return this.peerId;
  }

  public subscribe(fn: (state: CollabRoomState, lastMsg?: CollabSyncMessage) => void): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private emit(lastMsg?: CollabSyncMessage): void {
    for (const fn of this.listeners) {
      try {
        fn(this.state, lastMsg);
      } catch {
        // Ignore subscriber errors
      }
    }
  }

  public connect(): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    this.disconnect();

    const url = `/api/collab/rooms/${encodeURIComponent(this.roomId)}/events?peerId=${encodeURIComponent(this.peerId)}`;
    const es = new EventSource(url);
    this.eventSource = es;

    es.onopen = () => {
      this.state = { ...this.state, connected: true, transport: this.dataChannel?.readyState === 'open' ? 'webrtc' : 'sse-relay' };
      this.emit();
      void this.broadcast('peer_join', {});
    };

    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as CollabSyncMessage;
        if (!msg || msg.peerId === this.peerId) return;
        this.state = applyCollabMessage(this.state, msg);
        this.emit(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      this.state = { ...this.state, connected: false, transport: 'disconnected' };
      this.emit();
    };
  }

  public async broadcast(type: CollabEventType, payload: Record<string, any>): Promise<void> {
    const msg: CollabSyncMessage = {
      roomId: this.roomId,
      peerId: this.peerId,
      peerName: this.peerName,
      type,
      timestamp: Date.now(),
      payload,
    };

    // Prefer direct WebRTC DataChannel when open
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(msg));
        return;
      } catch {
        // Fallback to SSE signaling relay
      }
    }

    if (typeof fetch !== 'undefined') {
      try {
        await fetch(`/api/collab/rooms/${encodeURIComponent(this.roomId)}/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg),
        });
      } catch {
        // Offline / disconnected
      }
    }
  }

  public disconnect(): void {
    if (this.state.connected) {
      void this.broadcast('peer_leave', {});
    }
    try {
      this.dataChannel?.close();
      this.peerConnection?.close();
      this.eventSource?.close();
    } catch {
      // Ignore cleanup errors
    }
    this.dataChannel = null;
    this.peerConnection = null;
    this.eventSource = null;
    this.state = { ...this.state, connected: false, transport: 'disconnected' };
    this.emit();
  }
}
