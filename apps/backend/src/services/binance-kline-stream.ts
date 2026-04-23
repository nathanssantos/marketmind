import { serializeError } from '../utils/errors';
import type { MarketType } from '@marketmind/types';
import type { KlineInterval } from 'binance';
import { WebsocketClient } from 'binance';
import { WEBSOCKET_CONFIG } from '../constants';
import { silentWsLogger } from './binance-client';
import { logger } from './logger';
import { priceCache } from './price-cache';
import { getWebSocketService } from './websocket';
import { ReconnectionGuard, parseKlineMessage, persistKline } from './kline-stream-persistence';
import { klineSynthesisService } from './kline-synthesis';

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

const spotReconnectionGuard = new ReconnectionGuard();
const futuresReconnectionGuard = new ReconnectionGuard();

const STREAM_HEALTH_CHECK_INTERVAL_MS = 15_000;
const STREAM_STALE_THRESHOLD_MS = 60_000;
const STREAM_FORCED_RECONNECT_COOLDOWN_MS = 120_000;

export class BinanceKlineStreamService {
  private client: WebsocketClient | null = null;
  private subscriptions: Map<string, KlineStreamSubscription> = new Map();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.client) {
      logger.warn('Binance kline stream already running');
      return;
    }

    this.client = new WebsocketClient(
      { beautify: true, reconnectTimeout: WEBSOCKET_CONFIG.RECONNECT_DELAY_MS },
      silentWsLogger
    );

    this.client.on('message', (data) => {
      this.handleMessage(data);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.client as any).on('error', (error: unknown) => {
      logger.error({
        error: serializeError(error),
      }, 'Binance kline WebSocket error');
    });

    this.client.on('reconnected', () => {
      this.resubscribeAll();
    });

    this.startHealthWatchdog();
  }

  stop(): void {
    this.stopHealthWatchdog();
    if (this.client) {
      this.client.closeAll(true);
      this.client = null;
      this.subscriptions.clear();
    }
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
        logger.warn({
          symbol: sub.symbol,
          interval: sub.interval,
          silenceMs,
          marketType: 'SPOT',
        }, 'Kline stream silent — marking degraded');
        this.emitHealth(sub);
        klineSynthesisService.enable(sub.symbol, sub.interval, 'SPOT');
      } else if (silenceMs <= STREAM_STALE_THRESHOLD_MS && sub.healthStatus === 'degraded') {
        sub.healthStatus = 'healthy';
        logger.info({
          symbol: sub.symbol,
          interval: sub.interval,
          marketType: 'SPOT',
        }, 'Kline stream recovered');
        this.emitHealth(sub);
        klineSynthesisService.disable(sub.symbol, sub.interval, 'SPOT');
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
      marketType: 'SPOT',
      status: sub.healthStatus,
      lastMessageAt: sub.lastMessageAt || null,
      ...(sub.healthStatus === 'degraded' ? { reason: 'binance-stream-silent' } : {}),
    });
  }

  private forceReconnect(): void {
    logger.warn({ marketType: 'SPOT' }, 'Forcing SPOT kline WebSocket reconnect due to stale streams');
    const now = Date.now();
    for (const sub of this.subscriptions.values()) {
      sub.lastReconnectAt = now;
    }

    if (!this.client) return;

    try {
      this.client.closeAll(true);
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Error closing SPOT kline client during forced reconnect');
    }

    this.client = null;
    const subsSnapshot = Array.from(this.subscriptions.values());
    this.subscriptions.clear();

    this.start();

    for (const sub of subsSnapshot) {
      this.subscribe(sub.symbol, sub.interval);
      const key = `${sub.symbol}_${sub.interval}`.toLowerCase();
      const restored = this.subscriptions.get(key);
      if (restored) {
        restored.clientCount = sub.clientCount;
        restored.lastReconnectAt = now;
      }
    }
  }

  subscribe(symbol: string, interval: string): void {
    const key = `${symbol}_${interval}`.toLowerCase();
    const existing = this.subscriptions.get(key);

    if (existing) {
      existing.clientCount++;
      logger.trace({
        count: existing.clientCount,
      }, `Kline subscription count increased for ${key}`);
      return;
    }

    if (!this.client) {
      logger.error('Cannot subscribe: WebSocket client not initialized');
      return;
    }

    try {
      void this.client.subscribeSpotKline(symbol, interval as KlineInterval);

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
        logger.info({ symbol, interval, marketType: 'SPOT' }, 'New subscription inherits degraded state from existing market');
        this.emitHealth(newSub);
        klineSynthesisService.enable(symbol, interval, 'SPOT');
      }

    } catch (error) {
      logger.error({
        symbol,
        interval,
        error: serializeError(error),
      }, 'Failed to subscribe to kline stream');
    }
  }

  private isMarketCurrentlyDegraded(): boolean {
    for (const sub of this.subscriptions.values()) {
      if (sub.healthStatus === 'degraded') return true;
    }
    return false;
  }

  unsubscribe(symbol: string, interval: string): void {
    const key = `${symbol}_${interval}`.toLowerCase();
    const existing = this.subscriptions.get(key);

    if (!existing) return;

    existing.clientCount--;

    if (existing.clientCount <= 0) {
      if (this.client) {
        try {
          logger.trace(`Unsubscribed from kline stream: ${key}`);
        } catch (error) {
          logger.error({
            symbol,
            interval,
            error: serializeError(error),
          }, 'Failed to unsubscribe from kline stream');
        }
      }
      this.subscriptions.delete(key);
      klineSynthesisService.disable(symbol, interval, 'SPOT');
    } else {
      logger.trace({
        count: existing.clientCount,
      }, `Kline subscription count decreased for ${key}`);
    }
  }

  private handleMessage(data: unknown): void {
    try {
      const update = parseKlineMessage(data, 'SPOT');
      if (update) void this.processKlineUpdate(update);
    } catch (error) {
      logger.error({
        error: serializeError(error),
      }, 'Error processing kline message');
    }
  }

  private async processKlineUpdate(update: KlineUpdate): Promise<void> {
    try {
      this.recordMessageReceived(update.symbol, update.interval);
      priceCache.updateFromWebSocket(update.symbol, update.marketType, parseFloat(update.close));

      const wsService = getWebSocketService();
      if (wsService) wsService.emitKlineUpdate(update);

      if (update.isClosed) await persistKline(update, spotReconnectionGuard, 'SPOT');
    } catch (error) {
      logger.error({
        symbol: update.symbol,
        error: serializeError(error),
      }, 'Error processing kline update');
    }
  }

  private recordMessageReceived(symbol: string, interval: string): void {
    const key = `${symbol}_${interval}`.toLowerCase();
    const sub = this.subscriptions.get(key);
    if (!sub) return;
    sub.lastMessageAt = Date.now();
    if (sub.healthStatus === 'degraded') {
      sub.healthStatus = 'healthy';
      logger.info({ symbol, interval, marketType: 'SPOT' }, 'Kline stream recovered on message receipt');
      this.emitHealth(sub);
      klineSynthesisService.disable(symbol, interval, 'SPOT');
    }
  }

  private resubscribeAll(): void {
    logger.warn('SPOT WebSocket reconnected - resubscribing all streams');
    spotReconnectionGuard.onReconnect('SPOT');

    const subs = Array.from(this.subscriptions.values());
    this.subscriptions.clear();

    for (const sub of subs) {
      this.subscribe(sub.symbol, sub.interval);
      const key = `${sub.symbol}_${sub.interval}`.toLowerCase();
      const restored = this.subscriptions.get(key);
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

export const binanceKlineStreamService = new BinanceKlineStreamService();

type KlineCloseHandler = (update: KlineUpdate) => void;

export class BinanceFuturesKlineStreamService {
  private client: WebsocketClient | null = null;
  private subscriptions: Map<string, KlineStreamSubscription> = new Map();
  private klineCloseHandlers: KlineCloseHandler[] = [];
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.client) {
      logger.warn('Binance futures kline stream already running');
      return;
    }

    this.client = new WebsocketClient(
      { beautify: true, reconnectTimeout: WEBSOCKET_CONFIG.RECONNECT_DELAY_MS },
      silentWsLogger
    );

    this.client.on('message', (data) => {
      this.handleMessage(data);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.client as any).on('error', (error: unknown) => {
      logger.error({
        error: serializeError(error),
      }, 'Binance futures kline WebSocket error');
    });

    this.client.on('reconnected', () => {
      this.resubscribeAll();
    });

    this.startHealthWatchdog();
  }

  stop(): void {
    this.stopHealthWatchdog();
    if (this.client) {
      this.client.closeAll(true);
      this.client = null;
      this.subscriptions.clear();
    }
    this.klineCloseHandlers = [];
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
        logger.warn({
          symbol: sub.symbol,
          interval: sub.interval,
          silenceMs,
          marketType: 'FUTURES',
        }, 'Futures kline stream silent — marking degraded');
        this.emitHealth(sub);
        klineSynthesisService.enable(sub.symbol, sub.interval, 'FUTURES');
      } else if (silenceMs <= STREAM_STALE_THRESHOLD_MS && sub.healthStatus === 'degraded') {
        sub.healthStatus = 'healthy';
        logger.info({
          symbol: sub.symbol,
          interval: sub.interval,
          marketType: 'FUTURES',
        }, 'Futures kline stream recovered');
        this.emitHealth(sub);
        klineSynthesisService.disable(sub.symbol, sub.interval, 'FUTURES');
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
      marketType: 'FUTURES',
      status: sub.healthStatus,
      lastMessageAt: sub.lastMessageAt || null,
      ...(sub.healthStatus === 'degraded' ? { reason: 'binance-stream-silent' } : {}),
    });
  }

  private forceReconnect(): void {
    logger.warn({ marketType: 'FUTURES' }, 'Forcing FUTURES kline WebSocket reconnect due to stale streams');
    const now = Date.now();
    for (const sub of this.subscriptions.values()) {
      sub.lastReconnectAt = now;
    }

    if (!this.client) return;

    try {
      this.client.closeAll(true);
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Error closing FUTURES kline client during forced reconnect');
    }

    this.client = null;
    const subsSnapshot = Array.from(this.subscriptions.values());
    this.subscriptions.clear();

    this.start();

    for (const sub of subsSnapshot) {
      this.subscribe(sub.symbol, sub.interval);
      const key = `${sub.symbol}_${sub.interval}`.toLowerCase();
      const restored = this.subscriptions.get(key);
      if (restored) {
        restored.clientCount = sub.clientCount;
        restored.lastReconnectAt = now;
      }
    }
  }

  private recordMessageReceived(symbol: string, interval: string): void {
    const key = `${symbol}_${interval}`.toLowerCase();
    const sub = this.subscriptions.get(key);
    if (!sub) return;
    sub.lastMessageAt = Date.now();
    if (sub.healthStatus === 'degraded') {
      sub.healthStatus = 'healthy';
      logger.info({ symbol, interval, marketType: 'FUTURES' }, 'Futures kline stream recovered on message receipt');
      this.emitHealth(sub);
      klineSynthesisService.disable(symbol, interval, 'FUTURES');
    }
  }

  onKlineClose(handler: KlineCloseHandler): () => void {
    this.klineCloseHandlers.push(handler);
    return () => {
      const idx = this.klineCloseHandlers.indexOf(handler);
      if (idx >= 0) this.klineCloseHandlers.splice(idx, 1);
    };
  }

  subscribe(symbol: string, interval: string): void {
    const key = `${symbol}_${interval}`.toLowerCase();
    const existing = this.subscriptions.get(key);

    if (existing) {
      existing.clientCount++;
      return;
    }

    if (!this.client) this.start();

    if (!this.client) {
      logger.error('Cannot subscribe: Futures WebSocket client not initialized');
      return;
    }

    try {
      void this.client.subscribeKlines(symbol, interval as KlineInterval, 'usdm');

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
        logger.info({ symbol, interval, marketType: 'FUTURES' }, 'New subscription inherits degraded state from existing market');
        this.emitHealth(newSub);
        klineSynthesisService.enable(symbol, interval, 'FUTURES');
      }

    } catch (error) {
      logger.error({
        symbol,
        interval,
        error: serializeError(error),
      }, 'Failed to subscribe to futures kline stream');
    }
  }

  private isMarketCurrentlyDegraded(): boolean {
    for (const sub of this.subscriptions.values()) {
      if (sub.healthStatus === 'degraded') return true;
    }
    return false;
  }

  unsubscribe(symbol: string, interval: string): void {
    const key = `${symbol}_${interval}`.toLowerCase();
    const existing = this.subscriptions.get(key);

    if (!existing) return;

    existing.clientCount--;

    if (existing.clientCount <= 0) {
      if (this.client) {
        try {
          logger.trace(`Unsubscribed from futures kline stream: ${key}`);
        } catch (error) {
          logger.error({
            symbol,
            interval,
            error: serializeError(error),
          }, 'Failed to unsubscribe from futures kline stream');
        }
      }
      this.subscriptions.delete(key);
      klineSynthesisService.disable(symbol, interval, 'FUTURES');
    }
  }

  private handleMessage(data: unknown): void {
    try {
      const update = parseKlineMessage(data, 'FUTURES');
      if (update) void this.processKlineUpdate(update);
    } catch (error) {
      logger.error({
        error: serializeError(error),
      }, 'Error processing futures kline message');
    }
  }

  private async processKlineUpdate(update: KlineUpdate): Promise<void> {
    try {
      this.recordMessageReceived(update.symbol, update.interval);
      priceCache.updateFromWebSocket(update.symbol, update.marketType, parseFloat(update.close));

      const wsService = getWebSocketService();
      if (wsService) wsService.emitKlineUpdate(update);

      if (update.isClosed) {
        for (const handler of this.klineCloseHandlers) {
          try {
            handler(update);
          } catch (err) {
            logger.warn({ error: err }, 'Kline close handler error');
          }
        }
        await persistKline(update, futuresReconnectionGuard, 'FUTURES');
      }
    } catch (error) {
      logger.error({
        symbol: update.symbol,
        error: serializeError(error),
      }, 'Error processing futures kline update');
    }
  }

  private resubscribeAll(): void {
    logger.warn('FUTURES WebSocket reconnected - resubscribing all streams');
    futuresReconnectionGuard.onReconnect('FUTURES');

    const subs = Array.from(this.subscriptions.values());
    this.subscriptions.clear();

    for (const sub of subs) {
      this.subscribe(sub.symbol, sub.interval);
      const key = `${sub.symbol}_${sub.interval}`.toLowerCase();
      const restored = this.subscriptions.get(key);
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

export const binanceFuturesKlineStreamService = new BinanceFuturesKlineStreamService();
