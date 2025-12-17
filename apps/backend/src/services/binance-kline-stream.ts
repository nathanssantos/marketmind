import type { Interval } from '@marketmind/types';
import type { KlineInterval } from 'binance';
import { WebsocketClient } from 'binance';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { klines } from '../db/schema';
import { logger } from './logger';
import { getWebSocketService } from './websocket';

export interface KlineUpdate {
  symbol: string;
  interval: string;
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
  private readonly RECONNECT_DELAY_MS = 5000;

  start(): void {
    if (this.client) {
      logger.warn('Binance kline stream already running');
      return;
    }

    logger.info('Starting Binance kline stream service');

    this.client = new WebsocketClient({
      beautify: true,
      reconnectTimeout: this.RECONNECT_DELAY_MS,
    });

    this.client.on('message', (data) => {
      this.handleMessage(data);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.client as any).on('error', (error: unknown) => {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, 'Binance kline WebSocket error');
    });

    this.client.on('reconnected', () => {
      logger.info('Binance kline WebSocket reconnected');
      this.resubscribeAll();
    });
  }

  stop(): void {
    if (this.client) {
      this.client.closeAll(true);
      this.client = null;
      this.subscriptions.clear();
      logger.info('Binance kline stream service stopped');
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
      const stream = `${symbol.toLowerCase()}@kline_${interval}`;
      void this.client.subscribeSpotKline(symbol, interval as KlineInterval);

      this.subscriptions.set(key, {
        symbol,
        interval,
        clientCount: 1,
      });

      logger.info(`Subscribed to kline stream: ${stream}`);
    } catch (error) {
      logger.error({
        symbol,
        interval,
        error: error instanceof Error ? error.message : String(error),
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
          logger.info(`Unsubscribed from kline stream: ${key}`);
        } catch (error) {
          logger.error({
            symbol,
            interval,
            error: error instanceof Error ? error.message : String(error),
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

        this.processKlineUpdate(update);
      }
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, 'Error processing kline message');
    }
  }

  private async processKlineUpdate(update: KlineUpdate): Promise<void> {
    try {
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.emitKlineUpdate(update);
      }

      if (update.isClosed) {
        await this.persistKline(update);
        logger.info({ 
          symbol: update.symbol, 
          interval: update.interval, 
          openTime: new Date(update.openTime).toISOString(),
        }, '✅ Persisted closed kline');
      }
    } catch (error) {
      logger.error({
        symbol: update.symbol,
        error: error instanceof Error ? error.message : String(error),
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

      const openTime = new Date(update.openTime);
      const interval = update.interval as Interval;

      const existing = await db.query.klines.findFirst({
        where: and(
          eq(klines.symbol, update.symbol),
          eq(klines.interval, interval),
          eq(klines.openTime, openTime)
        ),
      });

      const klineData = {
        symbol: update.symbol,
        interval,
        openTime,
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

      if (existing) {
        await db
          .update(klines)
          .set(klineData)
          .where(
            and(
              eq(klines.symbol, update.symbol),
              eq(klines.interval, interval),
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
        error: error instanceof Error ? error.message : String(error),
      }, 'Error persisting kline to database');
    }
  }

  private resubscribeAll(): void {
    logger.info('Resubscribing to all kline streams');

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
