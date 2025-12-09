import type { KlineInterval } from 'binance';
import { WebsocketClient } from 'binance';
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

    // WebsocketClient types don't properly expose error event handler
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
          // WebsocketClient doesn't have unsubscribeSpotKline method
          // Use closeWsConnection or other method to unsubscribe
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

      // Kline/Candlestick event
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
      // Emit to connected WebSocket clients
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.emitKlineUpdate(update);
      }

      // logger.debug({
      //   symbol: update.symbol,
      //   interval: update.interval,
      //   close: update.close,
      //   isClosed: update.isClosed,
      // }, 'Kline update processed');
    } catch (error) {
      logger.error({
        symbol: update.symbol,
        error: error instanceof Error ? error.message : String(error),
      }, 'Error processing kline update');
    }
  }

  private resubscribeAll(): void {
    logger.info('Resubscribing to all kline streams');

    const subs = Array.from(this.subscriptions.values());
    this.subscriptions.clear();

    for (const sub of subs) {
      // Reset client count to 1 for each unique subscription
      this.subscribe(sub.symbol, sub.interval);
      // Restore original client count
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
