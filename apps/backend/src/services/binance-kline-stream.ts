import { serializeError } from '../utils/errors';
import type { Interval, MarketType } from '@marketmind/types';
import type { KlineInterval } from 'binance';
import { WebsocketClient } from 'binance';
import { and, eq } from 'drizzle-orm';
import { WEBSOCKET_CONFIG } from '../constants';
import { db } from '../db';
import { klines } from '../db/schema';
import { silentWsLogger } from './binance-client';
import { logger } from './logger';
import { priceCache } from './price-cache';
import { getWebSocketService } from './websocket';
import { KlineValidator, compareOHLC } from './kline-validator';

class ReconnectionGuard {
  private isInGracePeriod = false;
  private readonly GRACE_PERIOD_MS = 60 * 1000;

  onReconnect(marketType: MarketType): void {
    this.isInGracePeriod = true;

    logger.warn({ marketType }, 'WebSocket reconnected - entering grace period (60s)');

    setTimeout(() => {
      this.isInGracePeriod = false;
      logger.info({ marketType }, 'Grace period ended - resuming normal kline persistence');

      void this.triggerPostReconnectionCheck();
    }, this.GRACE_PERIOD_MS);
  }

  shouldPersistKline(): boolean {
    return !this.isInGracePeriod;
  }

  private async triggerPostReconnectionCheck(): Promise<void> {
    const { getKlineMaintenance } = await import('./kline-maintenance');
    const maintenance = getKlineMaintenance();
    await maintenance.checkAfterReconnection();
  }
}

const reconnectionGuard = new ReconnectionGuard();

const fetchKlineFromREST = async (
  symbol: string,
  interval: string,
  openTime: number,
  marketType: MarketType
): Promise<{
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
} | null> => {
  try {
    const baseUrl = marketType === 'FUTURES'
      ? 'https://fapi.binance.com/fapi/v1/klines'
      : 'https://api.binance.com/api/v3/klines';

    const response = await fetch(`${baseUrl}?symbol=${symbol}&interval=${interval}&startTime=${openTime}&limit=1`);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.length) return null;

    const k = data[0];
    return {
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4],
      volume: k[5],
      closeTime: k[6],
      quoteVolume: k[7],
      trades: k[8],
      takerBuyBaseVolume: k[9],
      takerBuyQuoteVolume: k[10],
    };
  } catch {
    return null;
  }
};

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
      logger.debug({
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

    if (!existing) {
      return;
    }

    existing.clientCount--;

    if (existing.clientCount <= 0) {
      if (this.client) {
        try {
          logger.debug(`Unsubscribed from kline stream: ${key}`);
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
      logger.debug({
        count: existing.clientCount,
      }, `Kline subscription count decreased for ${key}`);
    }
  }

  private handleMessage(data: unknown): void {
    try {
      if (typeof data !== 'object' || data === null) {
        return;
      }

      const message = data as Record<string, unknown>;

      if (message['e'] === 'kline' && typeof message['k'] === 'object') {
        const klineData = message['k'] as Record<string, unknown>;

        const update: KlineUpdate = {
          symbol: klineData['s'] as string,
          interval: klineData['i'] as string,
          marketType: 'SPOT',
          openTime: klineData['t'] as number,
          closeTime: klineData['T'] as number,
          open: klineData['o'] as string,
          high: klineData['h'] as string,
          low: klineData['l'] as string,
          close: klineData['c'] as string,
          volume: klineData['v'] as string,
          quoteVolume: klineData['q'] as string,
          trades: klineData['n'] as number,
          takerBuyBaseVolume: klineData['V'] as string,
          takerBuyQuoteVolume: klineData['Q'] as string,
          isClosed: klineData['x'] as boolean,
          timestamp: Date.now(),
        };

       void this.processKlineUpdate(update);
      }
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
      if (wsService) {
        wsService.emitKlineUpdate(update);
      }

      if (update.isClosed) {
        await this.persistKline(update);
      }
    } catch (error) {
      logger.error({
        symbol: update.symbol,
        error: serializeError(error),
      }, 'Error processing kline update');
    }
  }

  private async persistKline(update: KlineUpdate): Promise<void> {
    try {
      if (!update.isClosed) {
        logger.warn({
          symbol: update.symbol,
          interval: update.interval,
          openTime: new Date(update.openTime).toISOString(),
        }, '🚨 CRITICAL: Attempted to persist an OPEN candle - This should NEVER happen!');
        return;
      }

      if (!reconnectionGuard.shouldPersistKline()) {
        logger.debug({
          symbol: update.symbol,
          interval: update.interval,
          openTime: new Date(update.openTime).toISOString(),
        }, 'Skipping persistence during grace period');
        return;
      }

      const openTime = new Date(update.openTime);
      const interval = update.interval as Interval;

      const existing = await db.query.klines.findFirst({
        where: and(
          eq(klines.symbol, update.symbol),
          eq(klines.interval, interval),
          eq(klines.marketType, update.marketType),
          eq(klines.openTime, openTime)
        ),
      });

      const restData = await fetchKlineFromREST(update.symbol, update.interval, update.openTime, update.marketType);

      let finalData = {
        open: update.open,
        high: update.high,
        low: update.low,
        close: update.close,
        volume: update.volume,
        closeTime: new Date(update.closeTime),
        quoteVolume: update.quoteVolume,
        trades: update.trades,
        takerBuyBaseVolume: update.takerBuyBaseVolume,
        takerBuyQuoteVolume: update.takerBuyQuoteVolume,
      };

      if (restData) {
        const comparison = compareOHLC(update, restData);

        if (comparison.hasMismatch) {
          logger.warn({
            symbol: update.symbol,
            interval: update.interval,
            openTime: openTime.toISOString(),
            mismatchFields: comparison.mismatchFields.join(', '),
            ws: comparison.ws,
            rest: comparison.rest,
          }, 'WebSocket data differs from REST API, using REST data');

          finalData = {
            open: restData.open,
            high: restData.high,
            low: restData.low,
            close: restData.close,
            volume: restData.volume,
            closeTime: new Date(restData.closeTime),
            quoteVolume: restData.quoteVolume,
            trades: restData.trades,
            takerBuyBaseVolume: restData.takerBuyBaseVolume,
            takerBuyQuoteVolume: restData.takerBuyQuoteVolume,
          };
        }
      } else {
        const suspiciousCheck = KlineValidator.isKlineDataSuspicious(update, existing ?? undefined);
        if (!suspiciousCheck.isValid) {
          logger.warn({
            symbol: update.symbol,
            interval: update.interval,
            openTime: openTime.toISOString(),
            wsVolume: update.volume,
            reason: suspiciousCheck.reason,
          }, 'Suspicious kline data and REST API unavailable');
        }
      }

      const klineData = {
        symbol: update.symbol,
        interval,
        marketType: update.marketType,
        openTime,
        ...finalData,
      };

      if (existing) {
        await db
          .update(klines)
          .set(klineData)
          .where(
            and(
              eq(klines.symbol, update.symbol),
              eq(klines.interval, interval),
              eq(klines.marketType, update.marketType),
              eq(klines.openTime, openTime)
            )
          );
      } else {
        await db.insert(klines).values(klineData);
      }
    } catch (error) {
      logger.error({
        symbol: update.symbol,
        interval: update.interval,
        error: serializeError(error),
      }, 'Error persisting kline to database');
    }
  }

  private resubscribeAll(): void {
    logger.warn('SPOT WebSocket reconnected - resubscribing all streams');
    reconnectionGuard.onReconnect('SPOT');

    const subs = Array.from(this.subscriptions.values());
    this.subscriptions.clear();

    for (const sub of subs) {
      this.subscribe(sub.symbol, sub.interval);
      const key = `${sub.symbol}_${sub.interval}`.toLowerCase();
      const restored = this.subscriptions.get(key);
      if (restored) {
        restored.clientCount = sub.clientCount;
      }
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

export class BinanceFuturesKlineStreamService {
  private client: WebsocketClient | null = null;
  private subscriptions: Map<string, KlineStreamSubscription> = new Map();

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
  }

  subscribe(symbol: string, interval: string): void {
    const key = `${symbol}_${interval}`.toLowerCase();
    const existing = this.subscriptions.get(key);

    if (existing) {
      existing.clientCount++;
      return;
    }

    if (!this.client) {
      this.start();
    }

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

    if (!existing) {
      return;
    }

    existing.clientCount--;

    if (existing.clientCount <= 0) {
      if (this.client) {
        try {
          logger.debug(`Unsubscribed from futures kline stream: ${key}`);
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
      if (typeof data !== 'object' || data === null) {
        return;
      }

      const message = data as Record<string, unknown>;

      if (message['e'] === 'kline' && typeof message['k'] === 'object') {
        const klineData = message['k'] as Record<string, unknown>;

        const update: KlineUpdate = {
          symbol: klineData['s'] as string,
          interval: klineData['i'] as string,
          marketType: 'FUTURES',
          openTime: klineData['t'] as number,
          closeTime: klineData['T'] as number,
          open: klineData['o'] as string,
          high: klineData['h'] as string,
          low: klineData['l'] as string,
          close: klineData['c'] as string,
          volume: klineData['v'] as string,
          quoteVolume: klineData['q'] as string,
          trades: klineData['n'] as number,
          takerBuyBaseVolume: klineData['V'] as string,
          takerBuyQuoteVolume: klineData['Q'] as string,
          isClosed: klineData['x'] as boolean,
          timestamp: Date.now(),
        };

       void this.processKlineUpdate(update);
      }
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
      if (wsService) {
        wsService.emitKlineUpdate(update);
      }

      if (update.isClosed) {
        await this.persistKline(update);
      }
    } catch (error) {
      logger.error({
        symbol: update.symbol,
        error: serializeError(error),
      }, 'Error processing futures kline update');
    }
  }

  private async persistKline(update: KlineUpdate): Promise<void> {
    try {
      if (!update.isClosed) {
        logger.warn({
          symbol: update.symbol,
          interval: update.interval,
          openTime: new Date(update.openTime).toISOString(),
        }, '🚨 CRITICAL: Attempted to persist an OPEN futures candle - This should NEVER happen!');
        return;
      }

      if (!reconnectionGuard.shouldPersistKline()) {
        logger.debug({
          symbol: update.symbol,
          interval: update.interval,
          openTime: new Date(update.openTime).toISOString(),
        }, 'Skipping FUTURES persistence during grace period');
        return;
      }

      const openTime = new Date(update.openTime);
      const interval = update.interval as Interval;

      const existing = await db.query.klines.findFirst({
        where: and(
          eq(klines.symbol, update.symbol),
          eq(klines.interval, interval),
          eq(klines.marketType, 'FUTURES'),
          eq(klines.openTime, openTime)
        ),
      });

      const restData = await fetchKlineFromREST(update.symbol, update.interval, update.openTime, 'FUTURES');

      let finalData = {
        open: update.open,
        high: update.high,
        low: update.low,
        close: update.close,
        volume: update.volume,
        closeTime: new Date(update.closeTime),
        quoteVolume: update.quoteVolume,
        trades: update.trades,
        takerBuyBaseVolume: update.takerBuyBaseVolume,
        takerBuyQuoteVolume: update.takerBuyQuoteVolume,
      };

      if (restData) {
        const comparison = compareOHLC(update, restData);

        if (comparison.hasMismatch) {
          logger.warn({
            symbol: update.symbol,
            interval: update.interval,
            openTime: openTime.toISOString(),
            mismatchFields: comparison.mismatchFields.join(', '),
            ws: comparison.ws,
            rest: comparison.rest,
          }, 'WebSocket data differs from REST API, using REST data');

          finalData = {
            open: restData.open,
            high: restData.high,
            low: restData.low,
            close: restData.close,
            volume: restData.volume,
            closeTime: new Date(restData.closeTime),
            quoteVolume: restData.quoteVolume,
            trades: restData.trades,
            takerBuyBaseVolume: restData.takerBuyBaseVolume,
            takerBuyQuoteVolume: restData.takerBuyQuoteVolume,
          };
        }
      } else {
        const suspiciousCheck = KlineValidator.isKlineDataSuspicious(update, existing ?? undefined);
        if (!suspiciousCheck.isValid) {
          logger.warn({
            symbol: update.symbol,
            interval: update.interval,
            openTime: openTime.toISOString(),
            wsVolume: update.volume,
            reason: suspiciousCheck.reason,
          }, 'Suspicious futures kline data and REST API unavailable');
        }
      }

      const klineData = {
        symbol: update.symbol,
        interval,
        marketType: 'FUTURES' as const,
        openTime,
        ...finalData,
      };

      if (existing) {
        await db
          .update(klines)
          .set(klineData)
          .where(
            and(
              eq(klines.symbol, update.symbol),
              eq(klines.interval, interval),
              eq(klines.marketType, 'FUTURES'),
              eq(klines.openTime, openTime)
            )
          );
      } else {
        await db.insert(klines).values(klineData);
      }
    } catch (error) {
      logger.error({
        symbol: update.symbol,
        interval: update.interval,
        error: serializeError(error),
      }, 'Error persisting futures kline to database');
    }
  }

  private resubscribeAll(): void {
    logger.warn('FUTURES WebSocket reconnected - resubscribing all streams');
    reconnectionGuard.onReconnect('FUTURES');

    const subs = Array.from(this.subscriptions.values());
    this.subscriptions.clear();

    for (const sub of subs) {
      this.subscribe(sub.symbol, sub.interval);
      const key = `${sub.symbol}_${sub.interval}`.toLowerCase();
      const restored = this.subscriptions.get(key);
      if (restored) {
        restored.clientCount = sub.clientCount;
      }
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
