/* eslint-disable @typescript-eslint/no-base-to-string -- Binance WS message values are unknown but documented strings; explicit cast at every read would be 50+ lines of noise */
import { WebsocketClient } from 'binance';
import type { MarkPriceUpdate } from '@marketmind/types';
import { SCALPING_STREAM } from '../constants/scalping';
import { serializeError } from '../utils/errors';
import { silentWsLogger } from './binance-client';
import { logger } from './logger';
import { getWebSocketService } from './websocket';

type MarkPriceObserver = (update: MarkPriceUpdate) => void;

interface CachedMarkPrice extends MarkPriceUpdate {
  receivedAt: number;
}

/**
 * Subscribes to Binance Futures `<symbol>@markPrice@1s` streams.
 *
 * One message per second per symbol carries:
 *  - markPrice (mark price used for liquidation / unrealized PnL)
 *  - indexPrice (composite index used for derivative pricing)
 *  - estimatedSettlePrice
 *  - fundingRate (`r`) — current funding rate
 *  - nextFundingTime (`T`) — ms timestamp of next funding payment
 *
 * Replaces three REST polls:
 *  - `getMarkPrice` on-demand RPC inside order/position mutation flows
 *    (read from cache; falls back to REST only if cache empty).
 *  - `funding-rate-service.ts` 5-minute setInterval on
 *    `/fapi/v1/premiumIndex` (cache + nextFundingTime drives payment
 *    application without periodic REST hits).
 *  - any future "current funding rate" or "live mark price" widget on
 *    the frontend.
 */
export class BinanceMarkPriceStreamService {
  private client: WebsocketClient | null = null;
  private subscribedSymbols = new Set<string>();
  private observers: MarkPriceObserver[] = [];
  private isReconnecting = false;
  // Per-symbol cache so consumers can read the latest mark/funding
  // values synchronously without an async REST round-trip.
  private cache = new Map<string, CachedMarkPrice>();

  start(): void {
    if (this.client) return;

    this.client = new WebsocketClient(
      { beautify: true, reconnectTimeout: SCALPING_STREAM.RECONNECT_DELAY_MS },
      silentWsLogger
    );

    this.client.on('message', (data) => this.handleMessage(data));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.client as any).on('error', (error: unknown) => {
      logger.error({ error: serializeError(error) }, 'MarkPrice WebSocket error');
    });

    this.client.on('reconnected', () => {
      if (this.isReconnecting) return;
      this.isReconnecting = true;
      this.resubscribeAll();
      setTimeout(() => { this.isReconnecting = false; }, 2000);
    });

    logger.info('MarkPrice stream service started');
  }

  stop(): void {
    if (this.client) {
      this.client.closeAll(true);
      this.client = null;
      this.subscribedSymbols.clear();
      this.cache.clear();
      logger.info('MarkPrice stream service stopped');
    }
  }

  subscribe(symbol: string): void {
    const s = symbol.toLowerCase();
    if (!this.client || this.subscribedSymbols.has(s)) return;

    try {
      // 1000ms = `<symbol>@markPrice@1s` in raw stream form. The 3000ms
      // alternative would be `<symbol>@markPrice` and is too slow for
      // a live funding-rate / mark-price widget.
      void this.client.subscribeMarkPrice(s, 'usdm', 1000);
      this.subscribedSymbols.add(s);
      logger.trace({ symbol: s }, 'Subscribed to markPrice');
    } catch (error) {
      logger.error({ error: serializeError(error), symbol: s }, 'Failed to subscribe markPrice');
    }
  }

  unsubscribe(symbol: string): void {
    const s = symbol.toLowerCase();
    this.subscribedSymbols.delete(s);
    this.cache.delete(s.toUpperCase());
  }

  onMarkPriceUpdate(handler: MarkPriceObserver): () => void {
    this.observers.push(handler);
    return () => {
      const idx = this.observers.indexOf(handler);
      if (idx >= 0) this.observers.splice(idx, 1);
    };
  }

  /**
   * Returns the latest cached MarkPriceUpdate for a symbol, or null if
   * the stream hasn't published one yet. Callers that need
   * authoritative mark price (mutations, paper-position MTM) should
   * fall back to REST when this returns null.
   *
   * `maxAgeMs` lets the caller reject stale cache entries — useful
   * during stream disconnects where the last value could be many
   * seconds old. Default 10s matches typical Binance stream latency
   * tolerance.
   */
  getCached(symbol: string, maxAgeMs: number = 10_000): MarkPriceUpdate | null {
    const cached = this.cache.get(symbol.toUpperCase());
    if (!cached) return null;
    if (Date.now() - cached.receivedAt > maxAgeMs) return null;
    return cached;
  }

  private handleMessage(data: unknown): void {
    try {
      if (typeof data !== 'object' || data === null) return;

      const msg = data as Record<string, unknown>;
      const eventType = msg['eventType'] ?? msg['e'];
      if (eventType !== 'markPriceUpdate') return;

      const symbol = ((msg['symbol'] ?? msg['s']) as string)?.toUpperCase();
      if (!symbol) return;

      const markPrice = parseFloat(String(msg['markPrice'] ?? msg['p'] ?? '0'));
      const indexPrice = parseFloat(String(msg['indexPrice'] ?? msg['i'] ?? '0'));
      const estimatedSettlePrice = parseFloat(String(msg['estimatedSettlePrice'] ?? msg['P'] ?? '0'));
      const fundingRate = parseFloat(String(msg['fundingRate'] ?? msg['r'] ?? '0'));
      const nextFundingTime = parseInt(String(msg['nextFundingTime'] ?? msg['T'] ?? '0'), 10);
      const eventTime = parseInt(String(msg['eventTime'] ?? msg['E'] ?? Date.now()), 10);

      if (markPrice <= 0) return;

      const update: MarkPriceUpdate = {
        symbol,
        markPrice,
        indexPrice,
        estimatedSettlePrice,
        fundingRate,
        nextFundingTime,
        timestamp: eventTime,
      };

      this.cache.set(symbol, { ...update, receivedAt: Date.now() });

      const wsService = getWebSocketService();
      if (wsService) {
        wsService.emitMarkPriceUpdate(symbol, update);
      }

      for (const observer of this.observers) {
        try {
          observer(update);
        } catch (err) {
          logger.warn({ error: err }, 'MarkPrice observer error');
        }
      }
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Error handling markPrice message');
    }
  }

  private resubscribeAll(): void {
    const symbols = Array.from(this.subscribedSymbols);
    this.subscribedSymbols.clear();
    for (const s of symbols) {
      this.subscribe(s);
    }
    logger.info({ count: symbols.length }, 'MarkPrice resubscription complete');
  }

  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }
}

export const binanceMarkPriceStreamService = new BinanceMarkPriceStreamService();
