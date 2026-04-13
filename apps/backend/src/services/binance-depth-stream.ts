import { WebsocketClient, MainClient } from 'binance';
import type { DepthLevel, DepthUpdate } from '@marketmind/types';
import { SCALPING_DEFAULTS } from '@marketmind/types';
import { SCALPING_STREAM } from '../constants/scalping';
import { serializeError } from '../utils/errors';
import { silentWsLogger } from './binance-client';
import { logger } from './logger';
import { getWebSocketService } from './websocket';

type DepthObserver = (update: DepthUpdate) => void;

interface LocalBook {
  bids: Map<number, number>;
  asks: Map<number, number>;
  lastUpdateId: number;
  lastSnapshotTime: number;
}

export class BinanceDepthStreamService {
  private client: WebsocketClient | null = null;
  private restClient: MainClient | null = null;
  private subscribedSymbols = new Set<string>();
  private observers: DepthObserver[] = [];
  private isReconnecting = false;
  private books = new Map<string, LocalBook>();
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;

  start(restClient: MainClient): void {
    if (this.client) return;

    this.restClient = restClient;

    this.client = new WebsocketClient(
      { beautify: true, reconnectTimeout: SCALPING_STREAM.RECONNECT_DELAY_MS },
      silentWsLogger
    );

    this.client.on('message', (data) => this.handleMessage(data));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.client as any).on('error', (error: unknown) => {
      logger.error({ error: serializeError(error) }, 'Depth WebSocket error');
    });

    this.client.on('reconnected', () => {
      if (this.isReconnecting) return;
      this.isReconnecting = true;
      this.resubscribeAll();
      setTimeout(() => { this.isReconnecting = false; }, 2000);
    });

    this.snapshotTimer = setInterval(() => {
      void this.refreshSnapshots();
    }, SCALPING_DEFAULTS.BOOK_SNAPSHOT_INTERVAL_MS);

    logger.info('Depth stream service started');
  }

  stop(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }

    if (this.client) {
      this.client.closeAll(true);
      this.client = null;
      this.subscribedSymbols.clear();
      this.books.clear();
      logger.info('Depth stream service stopped');
    }
  }

  subscribe(symbol: string): void {
    const s = symbol.toLowerCase();
    if (!this.client || this.subscribedSymbols.has(s)) return;

    try {
      void this.client.subscribeDiffBookDepth(s, 100, 'usdm');
      this.subscribedSymbols.add(s);
      this.books.set(s, { bids: new Map(), asks: new Map(), lastUpdateId: 0, lastSnapshotTime: 0 });
      void this.fetchSnapshot(s);
      logger.trace({ symbol: s }, 'Subscribed to depth');
    } catch (error) {
      logger.error({ error: serializeError(error), symbol: s }, 'Failed to subscribe depth');
    }
  }

  unsubscribe(symbol: string): void {
    const s = symbol.toLowerCase();
    this.subscribedSymbols.delete(s);
    this.books.delete(s);
  }

  onDepthUpdate(handler: DepthObserver): () => void {
    this.observers.push(handler);
    return () => {
      const idx = this.observers.indexOf(handler);
      if (idx >= 0) this.observers.splice(idx, 1);
    };
  }

  getBook(symbol: string): { bids: DepthLevel[]; asks: DepthLevel[] } | null {
    const book = this.books.get(symbol.toLowerCase());
    if (!book) return null;

    return {
      bids: this.getTopLevels(book.bids, SCALPING_DEFAULTS.DEPTH_LEVELS, true),
      asks: this.getTopLevels(book.asks, SCALPING_DEFAULTS.DEPTH_LEVELS, false),
    };
  }

  getFullBook(symbol: string): { bids: Map<number, number>; asks: Map<number, number> } | null {
    const book = this.books.get(symbol.toLowerCase());
    if (!book) return null;
    return { bids: book.bids, asks: book.asks };
  }

  private handleMessage(data: unknown): void {
    try {
      if (typeof data !== 'object' || data === null) return;

      const msg = data as Record<string, unknown>;
      const eventType = msg['eventType'] ?? msg['e'];
      if (eventType !== 'depthUpdate') return;

      const symbol = ((msg['symbol'] ?? msg['s']) as string)?.toLowerCase();
      if (!symbol) return;

      const book = this.books.get(symbol);
      if (!book) return;

      const lastUpdateId = Number(msg['finalUpdateId'] ?? msg['u'] ?? 0);
      if (lastUpdateId <= book.lastUpdateId) return;
      book.lastUpdateId = lastUpdateId;

      const bids = (msg['bidDepthDelta'] ?? msg['bids'] ?? msg['b']) as Array<[string, string]> | undefined;
      const asks = (msg['askDepthDelta'] ?? msg['asks'] ?? msg['a']) as Array<[string, string]> | undefined;

      if (Array.isArray(bids)) {
        for (const [priceStr, qtyStr] of bids) {
          const price = parseFloat(priceStr);
          const qty = parseFloat(qtyStr);
          if (qty === 0) book.bids.delete(price);
          else book.bids.set(price, qty);
        }
      }

      if (Array.isArray(asks)) {
        for (const [priceStr, qtyStr] of asks) {
          const price = parseFloat(priceStr);
          const qty = parseFloat(qtyStr);
          if (qty === 0) book.asks.delete(price);
          else book.asks.set(price, qty);
        }
      }

      const topBids = this.getTopLevels(book.bids, SCALPING_DEFAULTS.DEPTH_LEVELS, true);
      const topAsks = this.getTopLevels(book.asks, SCALPING_DEFAULTS.DEPTH_LEVELS, false);

      const update: DepthUpdate = {
        symbol: symbol.toUpperCase(),
        bids: topBids,
        asks: topAsks,
        lastUpdateId,
        timestamp: Date.now(),
      };

      const wsService = getWebSocketService();
      if (wsService) {
        wsService.emitDepthUpdate(symbol.toUpperCase(), update);
      }

      for (const observer of this.observers) {
        try {
          observer(update);
        } catch (err) {
          logger.warn({ error: err }, 'Depth observer error');
        }
      }
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Error handling depth message');
    }
  }

  private getTopLevels(map: Map<number, number>, count: number, descending: boolean): DepthLevel[] {
    const entries = Array.from(map.entries());
    entries.sort((a, b) => descending ? b[0] - a[0] : a[0] - b[0]);
    return entries.slice(0, count).map(([price, quantity]) => ({ price, quantity }));
  }

  private async fetchSnapshot(symbol: string): Promise<void> {
    if (!this.restClient) return;

    try {
      const data = await this.restClient.getOrderBook({ symbol: symbol.toUpperCase(), limit: 1000 });
      const book = this.books.get(symbol);
      if (!book) return;

      book.bids.clear();
      book.asks.clear();

      for (const [priceStr, qtyStr] of data.bids) {
        book.bids.set(parseFloat(String(priceStr)), parseFloat(String(qtyStr)));
      }
      for (const [priceStr, qtyStr] of data.asks) {
        book.asks.set(parseFloat(String(priceStr)), parseFloat(String(qtyStr)));
      }

      book.lastSnapshotTime = Date.now();
      logger.trace({ symbol, bids: book.bids.size, asks: book.asks.size }, 'Depth snapshot loaded');
    } catch (error) {
      const errStr = JSON.stringify(error);
      if (errStr.includes('Invalid symbol') || (error && typeof error === 'object' && 'code' in error && (error as Record<string, unknown>)['code'] === -1121)) {
        logger.warn({ symbol }, 'Invalid symbol for depth, unsubscribing');
        this.subscribedSymbols.delete(symbol);
        this.books.delete(symbol);
        return;
      }
      logger.error({ error: serializeError(error), symbol }, 'Failed to fetch depth snapshot');
    }
  }

  private async refreshSnapshots(): Promise<void> {
    const now = Date.now();
    for (const symbol of this.subscribedSymbols) {
      const book = this.books.get(symbol);
      if (!book || now - book.lastSnapshotTime < SCALPING_DEFAULTS.BOOK_SNAPSHOT_INTERVAL_MS) continue;
      await this.fetchSnapshot(symbol);
    }
  }

  private resubscribeAll(): void {
    const symbols = Array.from(this.subscribedSymbols);
    this.subscribedSymbols.clear();
    this.books.clear();
    for (const s of symbols) {
      this.subscribe(s);
    }
    logger.info({ count: symbols.length }, 'Depth resubscription complete');
  }

  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }
}

export const binanceDepthStreamService = new BinanceDepthStreamService();
