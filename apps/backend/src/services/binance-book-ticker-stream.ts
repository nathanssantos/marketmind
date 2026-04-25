/* eslint-disable @typescript-eslint/no-base-to-string -- Binance WS message values are unknown but documented strings; explicit cast at every read would be 50+ lines of noise */
import { WebsocketClient } from 'binance';
import type { BookTickerUpdate } from '@marketmind/types';
import { SCALPING_STREAM } from '../constants/scalping';
import { serializeError } from '../utils/errors';
import { silentWsLogger } from './binance-client';
import { logger } from './logger';
import { getWebSocketService } from './websocket';

type BookTickerObserver = (update: BookTickerUpdate) => void;

export class BinanceBookTickerStreamService {
  private client: WebsocketClient | null = null;
  private subscribedSymbols = new Set<string>();
  private observers: BookTickerObserver[] = [];
  private isReconnecting = false;

  start(): void {
    if (this.client) return;

    this.client = new WebsocketClient(
      { beautify: true, reconnectTimeout: SCALPING_STREAM.RECONNECT_DELAY_MS },
      silentWsLogger
    );

    this.client.on('message', (data) => this.handleMessage(data));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.client as any).on('error', (error: unknown) => {
      logger.error({ error: serializeError(error) }, 'BookTicker WebSocket error');
    });

    this.client.on('reconnected', () => {
      if (this.isReconnecting) return;
      this.isReconnecting = true;
      this.resubscribeAll();
      setTimeout(() => { this.isReconnecting = false; }, 2000);
    });

    logger.info('BookTicker stream service started');
  }

  stop(): void {
    if (this.client) {
      this.client.closeAll(true);
      this.client = null;
      this.subscribedSymbols.clear();
      logger.info('BookTicker stream service stopped');
    }
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

  private handleMessage(data: unknown): void {
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
