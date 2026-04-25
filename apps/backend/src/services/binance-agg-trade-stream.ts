/* eslint-disable @typescript-eslint/no-base-to-string -- Binance WS message values are unknown but documented strings; explicit cast at every read would be 50+ lines of noise */
import { WebsocketClient } from 'binance';
import type { AggTrade } from '@marketmind/types';
import { SCALPING_DEFAULTS } from '@marketmind/types';
import { SCALPING_STREAM } from '../constants/scalping';
import { serializeError } from '../utils/errors';
import { silentWsLogger } from './binance-client';
import { logger } from './logger';
import { getWebSocketService } from './websocket';
import { db } from '../db';
import { aggTrades as aggTradesTable } from '../db/schema';

type AggTradeObserver = (trade: AggTrade) => void;

export class BinanceAggTradeStreamService {
  private client: WebsocketClient | null = null;
  private subscribedSymbols = new Set<string>();
  private observers: AggTradeObserver[] = [];
  private isReconnecting = false;
  private buffer: AggTrade[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private rollingAvgVolume = new Map<string, { sum: number; count: number }>();

  start(): void {
    if (this.client) return;

    this.client = new WebsocketClient(
      { beautify: true, reconnectTimeout: SCALPING_STREAM.RECONNECT_DELAY_MS },
      silentWsLogger
    );

    this.client.on('message', (data) => this.handleMessage(data));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.client as any).on('error', (error: unknown) => {
      logger.error({ error: serializeError(error) }, 'AggTrade WebSocket error');
    });

    this.client.on('reconnected', () => {
      if (this.isReconnecting) return;
      this.isReconnecting = true;
      this.resubscribeAll();
      setTimeout(() => { this.isReconnecting = false; }, 2000);
    });

    this.flushTimer = setInterval(() => {
      void this.flushBuffer();
    }, SCALPING_DEFAULTS.AGG_TRADE_FLUSH_INTERVAL_MS);

    logger.info('AggTrade stream service started');
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    void this.flushBuffer();

    if (this.client) {
      this.client.closeAll(true);
      this.client = null;
      this.subscribedSymbols.clear();
      this.rollingAvgVolume.clear();
      logger.info('AggTrade stream service stopped');
    }
  }

  subscribe(symbol: string): void {
    const s = symbol.toLowerCase();
    if (!this.client || this.subscribedSymbols.has(s)) return;

    try {
      void this.client.subscribeAggregateTrades(s, 'usdm');
      this.subscribedSymbols.add(s);
      logger.trace({ symbol: s }, 'Subscribed to aggTrades');
    } catch (error) {
      logger.error({ error: serializeError(error), symbol: s }, 'Failed to subscribe aggTrades');
    }
  }

  unsubscribe(symbol: string): void {
    const s = symbol.toLowerCase();
    this.subscribedSymbols.delete(s);
    this.rollingAvgVolume.delete(s);
  }

  onAggTradeUpdate(handler: AggTradeObserver): () => void {
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
      if (eventType !== 'aggTrade') return;

      const symbol = (msg['symbol'] ?? msg['s']) as string;
      if (!symbol) return;

      const price = parseFloat(String(msg['price'] ?? msg['p'] ?? '0'));
      const quantity = parseFloat(String(msg['quantity'] ?? msg['q'] ?? '0'));
      if (price <= 0 || quantity <= 0) return;

      const trade: AggTrade = {
        tradeId: Number(msg['aggregateTradeId'] ?? msg['a'] ?? 0),
        symbol,
        price,
        quantity,
        quoteQuantity: price * quantity,
        isBuyerMaker: Boolean(msg['isBuyerMaker'] ?? msg['m']),
        timestamp: Number(msg['tradeTime'] ?? msg['T'] ?? Date.now()),
        marketType: 'FUTURES',
      };

      this.buffer.push(trade);
      if (this.buffer.length >= SCALPING_DEFAULTS.AGG_TRADE_BUFFER_SIZE) {
        void this.flushBuffer();
      }

      this.updateRollingAvg(symbol, quantity);
      const avg = this.getRollingAvg(symbol);
      const isLargeTrade = avg > 0 && quantity > avg * SCALPING_DEFAULTS.LARGE_TRADE_MULTIPLIER;

      const wsService = getWebSocketService();
      if (wsService) {
        wsService.emitAggTradeUpdate(symbol, trade, isLargeTrade);
      }

      for (const observer of this.observers) {
        try {
          observer(trade);
        } catch (err) {
          logger.warn({ error: err }, 'AggTrade observer error');
        }
      }
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Error handling aggTrade message');
    }
  }

  private updateRollingAvg(symbol: string, quantity: number): void {
    const s = symbol.toLowerCase();
    const existing = this.rollingAvgVolume.get(s) ?? { sum: 0, count: 0 };
    existing.sum += quantity;
    existing.count += 1;

    if (existing.count > 1000) {
      existing.sum = (existing.sum / existing.count) * 500;
      existing.count = 500;
    }
    this.rollingAvgVolume.set(s, existing);
  }

  private getRollingAvg(symbol: string): number {
    const entry = this.rollingAvgVolume.get(symbol.toLowerCase());
    if (!entry || entry.count === 0) return 0;
    return entry.sum / entry.count;
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.buffer.length);

    try {
      const records = batch.map((t) => ({
        symbol: t.symbol,
        tradeId: t.tradeId,
        price: String(t.price),
        quantity: String(t.quantity),
        quoteQuantity: String(t.quoteQuantity),
        isBuyerMaker: t.isBuyerMaker,
        marketType: t.marketType,
        timestamp: new Date(t.timestamp),
      }));

      await db.insert(aggTradesTable).values(records).onConflictDoNothing();
    } catch (error) {
      logger.error({ error: serializeError(error), batchSize: batch.length }, 'Failed to flush aggTrades to DB');
    }
  }

  private resubscribeAll(): void {
    const symbols = Array.from(this.subscribedSymbols);
    this.subscribedSymbols.clear();
    for (const s of symbols) {
      this.subscribe(s);
    }
    logger.info({ count: symbols.length }, 'AggTrade resubscription complete');
  }

  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }
}

export const binanceAggTradeStreamService = new BinanceAggTradeStreamService();
