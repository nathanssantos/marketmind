/* eslint-disable @typescript-eslint/no-base-to-string -- Binance WS message values are unknown but documented strings; explicit cast at every read would be 50+ lines of noise */
import type { BookTickerUpdate } from '@marketmind/types';
import { serializeError } from '../utils/errors';
import { logger } from './logger';
import { getWebSocketService } from './websocket';
import { BinanceWebSocketStreamBase } from './binance-ws-stream-base';

type BookTickerObserver = (update: BookTickerUpdate) => void;

export class BinanceBookTickerStreamService extends BinanceWebSocketStreamBase {
  protected readonly label = 'BookTicker';
  private subscribedSymbols = new Set<string>();
  private observers: BookTickerObserver[] = [];

  protected override onStop(): void {
    this.subscribedSymbols.clear();
  }

  protected onReconnected(): void {
    this.resubscribeAll();
  }

  subscribe(symbol: string): void {
    const s = symbol.toLowerCase();
    if (!this.client || this.subscribedSymbols.has(s)) return;

    try {
      void this.client.subscribeSymbolBookTicker(s, 'usdm');
      this.subscribedSymbols.add(s);
      logger.trace({ symbol: s }, 'Subscribed to bookTicker');
    } catch (error) {
      logger.error({ error: serializeError(error), symbol: s }, 'Failed to subscribe bookTicker');
    }
  }

  unsubscribe(symbol: string): void {
    const s = symbol.toLowerCase();
    this.subscribedSymbols.delete(s);
  }

  onBookTickerUpdate(handler: BookTickerObserver): () => void {
    this.observers.push(handler);
    return () => {
      const idx = this.observers.indexOf(handler);
      if (idx >= 0) this.observers.splice(idx, 1);
    };
  }

  protected handleMessage(data: unknown): void {
    try {
      if (typeof data !== 'object' || data === null) return;

      const msg = data as Record<string, unknown>;
      const eventType = msg['eventType'] ?? msg['e'];
      if (eventType !== 'bookTicker') return;

      const symbol = (msg['symbol'] ?? msg['s']) as string;
      if (!symbol) return;

      const bidPrice = parseFloat(String(msg['bestBidPrice'] ?? msg['b'] ?? '0'));
      const bidQty = parseFloat(String(msg['bestBidQuantity'] ?? msg['B'] ?? '0'));
      const askPrice = parseFloat(String(msg['bestAskPrice'] ?? msg['a'] ?? '0'));
      const askQty = parseFloat(String(msg['bestAskQuantity'] ?? msg['A'] ?? '0'));

      if (bidPrice <= 0 || askPrice <= 0) return;

      const microprice = (bidPrice * askQty + askPrice * bidQty) / (bidQty + askQty);
      const spread = askPrice - bidPrice;
      const spreadPercent = (spread / askPrice) * 100;

      const update: BookTickerUpdate = {
        symbol,
        bidPrice,
        bidQty,
        askPrice,
        askQty,
        microprice,
        spread,
        spreadPercent,
        timestamp: Date.now(),
      };

      const wsService = getWebSocketService();
      if (wsService) {
        wsService.emitBookTickerUpdate(symbol, update);
      }

      for (const observer of this.observers) {
        try {
          observer(update);
        } catch (err) {
          logger.warn({ error: err }, 'BookTicker observer error');
        }
      }
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Error handling bookTicker message');
    }
  }

  private resubscribeAll(): void {
    const symbols = Array.from(this.subscribedSymbols);
    this.subscribedSymbols.clear();
    for (const s of symbols) {
      this.subscribe(s);
    }
    logger.info({ count: symbols.length }, 'BookTicker resubscription complete');
  }

  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }
}

export const binanceBookTickerStreamService = new BinanceBookTickerStreamService();
