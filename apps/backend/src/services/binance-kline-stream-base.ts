import type { MarketType } from '@marketmind/types';
import { WebsocketClient } from 'binance';
import { WEBSOCKET_CONFIG } from '../constants';
import { serializeError } from '../utils/errors';
import { silentWsLogger } from './binance-client';
import { logger } from './logger';
import { priceCache } from './price-cache';
import { getWebSocketService } from './websocket';
import { type ReconnectionGuard, parseKlineMessage, persistKline } from './kline-stream-persistence';

export interface KlineUpdate {
  symbol: string;
  interval: string;
  marketType: MarketType;
  openTime: number;
  closeTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
  isClosed: boolean;
  timestamp: number;
}

interface KlineStreamSubscription {
  symbol: string;
  interval: string;
  clientCount: number;
  lastMessageAt: number;
  healthStatus: 'healthy' | 'degraded';
  lastReconnectAt: number;
}

const STREAM_HEALTH_CHECK_INTERVAL_MS = 15_000;
const STREAM_STALE_THRESHOLD_MS = 60_000;
const STREAM_FORCED_RECONNECT_COOLDOWN_MS = 120_000;

/**
 * Shared lifecycle + health-watchdog + persistence pipeline for the
 * Binance kline streams. The SPOT and FUTURES services were ~95%
 * identical (only the SDK subscribe call, the reconnection guard, the
 * marketType, and FUTURES' close-handler fan-out differed); this base
 * carries everything common and the two subclasses fill the gaps.
 *
 * Behavior is preserved exactly from the pre-unification classes:
 *  - per-(symbol,interval) clientCount refcounting
 *  - 15s health watchdog → degraded/healthy transitions + emitStreamHealth
 *  - forced reconnect when any stream is stale > 60s (cooldown 120s)
 *  - persistKline on closed candles via the per-market ReconnectionGuard
 *  - new subscriptions inherit a currently-degraded market's status
 */
export abstract class BinanceKlineStreamBase {
  protected client: WebsocketClient | null = null;
  protected subscriptions: Map<string, KlineStreamSubscription> = new Map();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  protected abstract readonly marketType: MarketType;
  protected abstract readonly reconnectionGuard: ReconnectionGuard;
  /** Log-message label, e.g. "kline" / "futures kline". */
  protected abstract readonly logLabel: string;
  /** FUTURES starts the client lazily on first subscribe; SPOT does not. */
  protected readonly autoStartOnSubscribe: boolean = false;

  /** Issue the market-specific SDK subscription for one symbol/interval. */
  protected abstract subscribeOnClient(symbol: string, interval: string): void;
  /** Hook fired for each CLOSED candle before persistence (FUTURES fans out to handlers). */
  protected onKlineClosed(_update: KlineUpdate): void {}
  /** Optional subclass cleanup on stop (FUTURES clears its handlers). */
  protected onStopCleanup(): void {}

  start(): void {
    if (this.client) {
      logger.warn(`Binance ${this.logLabel} stream already running`);
      return;
    }

    this.client = new WebsocketClient(
      { beautify: true, reconnectTimeout: WEBSOCKET_CONFIG.RECONNECT_DELAY_MS },
      silentWsLogger,
    );

    this.client.on('message', (data) => this.handleMessage(data));

    (this.client as unknown as { on: (e: string, cb: (a: unknown) => void) => void }).on(
      'error',
      (error: unknown) => {
        logger.error({ error: serializeError(error) }, `Binance ${this.logLabel} WebSocket error`);
      },
    );

    this.client.on('reconnected', () => this.resubscribeAll());

    this.startHealthWatchdog();
  }

  stop(): void {
    this.stopHealthWatchdog();
    if (this.client) {
      this.client.closeAll(true);
      this.client = null;
      this.subscriptions.clear();
    }
    this.onStopCleanup();
  }

  private startHealthWatchdog(): void {
    if (this.healthCheckInterval) return;
    this.healthCheckInterval = setInterval(() => this.checkStreamHealth(), STREAM_HEALTH_CHECK_INTERVAL_MS);
  }

  private stopHealthWatchdog(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private checkStreamHealth(): void {
    const now = Date.now();
    let anyStale = false;

    for (const sub of this.subscriptions.values()) {
      const silenceMs = now - sub.lastMessageAt;

      if (silenceMs > STREAM_STALE_THRESHOLD_MS && sub.healthStatus === 'healthy') {
        sub.healthStatus = 'degraded';
        anyStale = true;
        logger.warn({ symbol: sub.symbol, interval: sub.interval, silenceMs, marketType: this.marketType },
          `${this.logLabel} stream silent — marking degraded`);
        this.emitHealth(sub);
      } else if (silenceMs <= STREAM_STALE_THRESHOLD_MS && sub.healthStatus === 'degraded') {
        sub.healthStatus = 'healthy';
        logger.info({ symbol: sub.symbol, interval: sub.interval, marketType: this.marketType },
          `${this.logLabel} stream recovered`);
        this.emitHealth(sub);
      }
    }

    if (anyStale && now - this.getLatestReconnectAt() > STREAM_FORCED_RECONNECT_COOLDOWN_MS) {
      this.forceReconnect();
    }
  }

  private getLatestReconnectAt(): number {
    let latest = 0;
    for (const sub of this.subscriptions.values()) {
      if (sub.lastReconnectAt > latest) latest = sub.lastReconnectAt;
    }
    return latest;
  }

  private emitHealth(sub: KlineStreamSubscription): void {
    const wsService = getWebSocketService();
    if (!wsService) return;
    wsService.emitStreamHealth({
      symbol: sub.symbol,
      interval: sub.interval,
      marketType: this.marketType,
      status: sub.healthStatus,
      lastMessageAt: sub.lastMessageAt || null,
      ...(sub.healthStatus === 'degraded' ? { reason: 'binance-stream-silent' } : {}),
    });
  }

  private forceReconnect(): void {
    logger.warn({ marketType: this.marketType }, `Forcing ${this.marketType} kline WebSocket reconnect due to stale streams`);
    const now = Date.now();
    for (const sub of this.subscriptions.values()) sub.lastReconnectAt = now;

    if (!this.client) return;

    try {
      this.client.closeAll(true);
    } catch (error) {
      logger.error({ error: serializeError(error) }, `Error closing ${this.marketType} kline client during forced reconnect`);
    }

    this.client = null;
    const subsSnapshot = Array.from(this.subscriptions.values());
    this.subscriptions.clear();

    this.start();

    for (const sub of subsSnapshot) {
      this.subscribe(sub.symbol, sub.interval);
      const key = this.key(sub.symbol, sub.interval);
      const restored = this.subscriptions.get(key);
      if (restored) {
        restored.clientCount = sub.clientCount;
        restored.lastReconnectAt = now;
      }
    }
  }

  private key(symbol: string, interval: string): string {
    return `${symbol}_${interval}`.toLowerCase();
  }

  subscribe(symbol: string, interval: string): void {
    const key = this.key(symbol, interval);
    const existing = this.subscriptions.get(key);

    if (existing) {
      existing.clientCount++;
      logger.trace({ count: existing.clientCount }, `${this.logLabel} subscription count increased for ${key}`);
      return;
    }

    if (!this.client && this.autoStartOnSubscribe) this.start();

    if (!this.client) {
      logger.error(`Cannot subscribe: ${this.logLabel} WebSocket client not initialized`);
      return;
    }

    try {
      this.subscribeOnClient(symbol, interval);

      const inheritDegraded = this.isMarketCurrentlyDegraded();
      const newSub: KlineStreamSubscription = {
        symbol,
        interval,
        clientCount: 1,
        lastMessageAt: Date.now(),
        healthStatus: inheritDegraded ? 'degraded' : 'healthy',
        lastReconnectAt: 0,
      };
      this.subscriptions.set(key, newSub);

      if (inheritDegraded) {
        logger.info({ symbol, interval, marketType: this.marketType }, 'New subscription inherits degraded state from existing market');
        this.emitHealth(newSub);
      }
    } catch (error) {
      logger.error({ symbol, interval, error: serializeError(error) }, `Failed to subscribe to ${this.logLabel} stream`);
    }
  }

  private isMarketCurrentlyDegraded(): boolean {
    for (const sub of this.subscriptions.values()) {
      if (sub.healthStatus === 'degraded') return true;
    }
    return false;
  }

  unsubscribe(symbol: string, interval: string): void {
    const key = this.key(symbol, interval);
    const existing = this.subscriptions.get(key);
    if (!existing) return;

    existing.clientCount--;

    if (existing.clientCount <= 0) {
      logger.trace(`Unsubscribed from ${this.logLabel} stream: ${key}`);
      this.subscriptions.delete(key);
    } else {
      logger.trace({ count: existing.clientCount }, `${this.logLabel} subscription count decreased for ${key}`);
    }
  }

  private handleMessage(data: unknown): void {
    try {
      const update = parseKlineMessage(data, this.marketType);
      if (update) void this.processKlineUpdate(update);
    } catch (error) {
      logger.error({ error: serializeError(error) }, `Error processing ${this.logLabel} message`);
    }
  }

  private async processKlineUpdate(update: KlineUpdate): Promise<void> {
    try {
      this.recordMessageReceived(update.symbol, update.interval);
      priceCache.updateFromWebSocket(update.symbol, update.marketType, parseFloat(update.close));

      const wsService = getWebSocketService();
      if (wsService) wsService.emitKlineUpdate(update);

      if (update.isClosed) {
        this.onKlineClosed(update);
        await persistKline(update, this.reconnectionGuard, this.marketType);
      }
    } catch (error) {
      logger.error({ symbol: update.symbol, error: serializeError(error) }, `Error processing ${this.logLabel} update`);
    }
  }

  private recordMessageReceived(symbol: string, interval: string): void {
    const sub = this.subscriptions.get(this.key(symbol, interval));
    if (!sub) return;
    sub.lastMessageAt = Date.now();
    if (sub.healthStatus === 'degraded') {
      sub.healthStatus = 'healthy';
      logger.info({ symbol, interval, marketType: this.marketType }, `${this.logLabel} stream recovered on message receipt`);
      this.emitHealth(sub);
    }
  }

  private resubscribeAll(): void {
    logger.warn(`${this.marketType} WebSocket reconnected - resubscribing all streams`);
    this.reconnectionGuard.onReconnect(this.marketType);

    const subs = Array.from(this.subscriptions.values());
    this.subscriptions.clear();

    for (const sub of subs) {
      this.subscribe(sub.symbol, sub.interval);
      const restored = this.subscriptions.get(this.key(sub.symbol, sub.interval));
      if (restored) restored.clientCount = sub.clientCount;
    }
  }

  getActiveSubscriptions(): Array<{ symbol: string; interval: string; clients: number }> {
    return Array.from(this.subscriptions.values()).map((sub) => ({
      symbol: sub.symbol,
      interval: sub.interval,
      clients: sub.clientCount,
    }));
  }
}
