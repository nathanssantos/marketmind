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
}

const spotReconnectionGuard = new ReconnectionGuard();
const futuresReconnectionGuard = new ReconnectionGuard();

export class BinanceKlineStreamService {
  private client: WebsocketClient | null = null;
  private subscriptions: Map<string, KlineStreamSubscription> = new Map();

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
  }

  stop(): void {
    if (this.client) {
      this.client.closeAll(true);
      this.client = null;
      this.subscriptions.clear();
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

      this.subscriptions.set(key, {
        symbol,
        interval,
        clientCount: 1,
      });

    } catch (error) {
      logger.error({
        symbol,
        interval,
        error: serializeError(error),
      }, 'Failed to subscribe to kline stream');
    }
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
  }

  stop(): void {
    if (this.client) {
      this.client.closeAll(true);
      this.client = null;
      this.subscriptions.clear();
    }
    this.klineCloseHandlers = [];
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

      this.subscriptions.set(key, {
        symbol,
        interval,
        clientCount: 1,
      });

    } catch (error) {
      logger.error({
        symbol,
        interval,
        error: serializeError(error),
      }, 'Failed to subscribe to futures kline stream');
    }
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
