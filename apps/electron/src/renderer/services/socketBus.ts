import { io, type Socket } from 'socket.io-client';
import {
  CLIENT_TO_SERVER_EVENTS,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@marketmind/types';
import { BACKEND_URL } from '@shared/constants/api';
import { useConnectionStore } from '../store/connectionStore';
import { exposeSocketForE2E } from '../utils/e2eBridge';
import { perfMonitor } from '../utils/canvas/perfMonitor';

type ServerEvent = keyof ServerToClientEvents;
type ClientEvent = keyof ClientToServerEvents;

type ServerHandler<E extends ServerEvent> = ServerToClientEvents[E];

interface RoomEntry {
  count: number;
  /** Re-emit subscription on (re)connect. */
  resubscribe: () => void;
  /** Emit unsubscribe when last consumer releases. */
  unsubscribe: () => void;
}

const RAF_BATCHED_EVENTS: ReadonlySet<ServerEvent> = new Set<ServerEvent>([
  'price:update',
  'kline:update',
  'aggTrade:update',
  'depth:update',
  'bookTicker:update',
  'scalpingMetrics:update',
]);

type AnyHandler = (...args: unknown[]) => void;

class SocketBus {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private rooms = new Map<string, RoomEntry>();
  private listeners = new Map<ServerEvent, Set<AnyHandler>>();
  private installedDispatchers = new Set<ServerEvent>();
  private rafScheduled = new Set<ServerEvent>();
  private latestRafPayload = new Map<string, unknown>();

  private ensureSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (this.socket) return this.socket;
    this.socket = io(BACKEND_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 50,
      transports: ['websocket'],
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      useConnectionStore.getState().setWsConnected(true);
      for (const entry of this.rooms.values()) entry.resubscribe();
    });
    this.socket.on('disconnect', () => useConnectionStore.getState().setWsConnected(false));
    this.socket.on('connect_error', () => useConnectionStore.getState().setWsConnected(false));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.socket as any).io.on('reconnect_failed', () => {
      console.warn('[SocketBus] Reconnection failed after 50 attempts — backend may be offline');
    });

    exposeSocketForE2E(this.socket);
    return this.socket;
  }

  private maybeTeardown(): void {
    if (this.socket && this.rooms.size === 0 && this.listeners.size === 0) {
      this.socket.disconnect();
      this.socket = null;
      this.installedDispatchers.clear();
      useConnectionStore.getState().setWsConnected(false);
      exposeSocketForE2E(null);
    }
  }

  private dispatch<E extends ServerEvent>(event: E, payload: Parameters<ServerHandler<E>>[0]): void {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;
    perfMonitor.recordSocketDispatch(event, handlers.size);
    for (const h of handlers) {
      try {
        (h as ServerHandler<E>)(payload as never);
      } catch (err) {
        console.error(`[SocketBus] handler for ${event} threw`, err);
      }
    }
  }

  private flushRafEvent(event: ServerEvent): void {
    this.rafScheduled.delete(event);
    const prefix = `${event}:`;
    const keys: string[] = [];
    for (const key of this.latestRafPayload.keys()) {
      if (key.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) {
      const payload = this.latestRafPayload.get(key);
      this.latestRafPayload.delete(key);
      if (payload !== undefined) this.dispatch(event, payload);
    }
  }

  private rafKey(event: ServerEvent, payload: unknown): string {
    if (payload && typeof payload === 'object') {
      const p = payload as { symbol?: string; interval?: string };
      if (p.symbol) {
        const intervalSuffix = p.interval ? `:${p.interval}` : '';
        return `${event}:${p.symbol}${intervalSuffix}`;
      }
    }
    return `${event}:__bare__`;
  }

  private installDispatcher<E extends ServerEvent>(event: E): void {
    if (this.installedDispatchers.has(event)) return;
    this.installedDispatchers.add(event);
    const sock = this.ensureSocket();
    if (RAF_BATCHED_EVENTS.has(event)) {
      const handler = ((payload: unknown) => {
        this.latestRafPayload.set(this.rafKey(event, payload), payload);
        if (!this.rafScheduled.has(event)) {
          this.rafScheduled.add(event);
          requestAnimationFrame(() => this.flushRafEvent(event));
        }
      }) as ServerHandler<E>;
      sock.on(event, handler as never);
    } else {
      const handler = ((payload: unknown) => this.dispatch(event, payload)) as ServerHandler<E>;
      sock.on(event, handler as never);
    }
  }

  /**
   * Listen for a server event. Multiple consumers share a single underlying
   * socket.on listener. High-rate events (price/kline/depth/etc.) are
   * RAF-coalesced — handlers fire once per frame with the latest payload per
   * (event, symbol[, interval]) key.
   */
  on<E extends ServerEvent>(event: E, handler: ServerHandler<E>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
      this.installDispatcher(event);
    }
    set.add(handler as AnyHandler);
    return () => {
      const s = this.listeners.get(event);
      if (!s) return;
      s.delete(handler as AnyHandler);
      if (s.size === 0) {
        this.listeners.delete(event);
        this.maybeTeardown();
      }
    };
  }

  emit<E extends ClientEvent>(event: E, ...args: Parameters<ClientToServerEvents[E]>): void {
    const sock = this.ensureSocket();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sock.emit as any)(event, ...args);
  }

  /**
   * Refcounted room subscription. The first consumer for a given dedup key
   * emits the subscribe event; the last one to release emits unsubscribe.
   * The dedup key MUST uniquely identify the room (e.g. "prices:BTCUSDT").
   */
  subscribeRoom(args: {
    dedupKey: string;
    subscribe: () => void;
    unsubscribe: () => void;
  }): () => void {
    const { dedupKey, subscribe, unsubscribe } = args;
    let entry = this.rooms.get(dedupKey);
    if (!entry) {
      this.ensureSocket();
      entry = {
        count: 0,
        resubscribe: subscribe,
        unsubscribe,
      };
      this.rooms.set(dedupKey, entry);
      if (this.socket?.connected) subscribe();
    }
    entry.count += 1;

    return () => {
      const e = this.rooms.get(dedupKey);
      if (!e) return;
      e.count -= 1;
      if (e.count <= 0) {
        if (this.socket?.connected) {
          try {
            e.unsubscribe();
          } catch {
            // best-effort
          }
        }
        this.rooms.delete(dedupKey);
        this.maybeTeardown();
      }
    };
  }

  /** Returns true if the underlying socket is connected. */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /** Direct socket access for E2E and existing legacy paths. Avoid in new code. */
  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketBus = new SocketBus();

export const SOCKET_EVENTS = CLIENT_TO_SERVER_EVENTS;
