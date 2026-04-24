import { WebsocketClient } from 'binance';
import { INTERVAL_MS } from '@marketmind/types';
import type { TimeInterval, MarketType } from '@marketmind/types';
import { WEBSOCKET_CONFIG } from '../constants';
import { silentWsLogger } from './binance-client';
import { logger } from './logger';
import { getWebSocketService } from './websocket';
import { serializeError } from '../utils/errors';

const EMIT_THROTTLE_MS = 200;

interface SyntheticKlineState {
  symbol: string;
  interval: TimeInterval;
  intervalMs: number;
  marketType: MarketType;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number;
  takerBuyVolume: number;
  lastEmitAt: number;
  dirty: boolean;
}

const alignToInterval = (timestamp: number, intervalMs: number): number => {
  return Math.floor(timestamp / intervalMs) * intervalMs;
};

const toNumberString = (n: number, decimals = 8): string => {
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(decimals);
};

export class KlineSynthesisService {
  private client: WebsocketClient | null = null;
  private subscribedSymbols: Set<string> = new Set();
  private states: Map<string, SyntheticKlineState> = new Map();
  private activeSet: Set<string> = new Set();
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  private getKey(symbol: string, interval: string, marketType: MarketType): string {
    return `${marketType}:${symbol.toUpperCase()}:${interval}`;
  }

  start(): void {
    if (this.client) return;

    this.client = new WebsocketClient(
      { beautify: true, reconnectTimeout: WEBSOCKET_CONFIG.RECONNECT_DELAY_MS },
      silentWsLogger
    );

    this.client.on('message', (data) => {
      this.handleMessage(data);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.client as any).on('error', (error: unknown) => {
      logger.error({ error: serializeError(error) }, 'Kline synthesis WebSocket error');
    });

    this.client.on('reconnected', () => {
      const symbols = Array.from(this.subscribedSymbols);
      this.subscribedSymbols.clear();
      for (const key of symbols) {
        const [market, symbol] = key.split(':');
        if (market && symbol) this.subscribeTrade(symbol, market === 'SPOT' ? 'SPOT' : 'FUTURES');
      }
    });

    this.flushInterval = setInterval(() => this.flushPending(), EMIT_THROTTLE_MS);
    logger.info('Kline synthesis service started');
  }

  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    if (this.client) {
      this.client.closeAll(true);
      this.client = null;
    }
    this.subscribedSymbols.clear();
    this.states.clear();
    this.activeSet.clear();
  }

  enable(symbol: string, interval: string, marketType: MarketType): void {
    if (!this.client) this.start();

    const key = this.getKey(symbol, interval, marketType);
    if (this.activeSet.has(key)) return;

    this.activeSet.add(key);
    this.subscribeTrade(symbol, marketType);
    logger.info({ symbol, interval, marketType }, 'Kline synthesis enabled');
  }

  disable(symbol: string, interval: string, marketType: MarketType): void {
    const key = this.getKey(symbol, interval, marketType);
    if (!this.activeSet.has(key)) return;

    this.activeSet.delete(key);
    this.states.delete(key);

    const stillNeeded = Array.from(this.activeSet).some((k) => {
      const [m, s] = k.split(':');
      return m === marketType && s === symbol.toUpperCase();
    });
    if (!stillNeeded) {
      this.subscribedSymbols.delete(`${marketType}:${symbol.toUpperCase()}`);
    }

    logger.info({ symbol, interval, marketType }, 'Kline synthesis disabled');
  }

  isActive(symbol: string, interval: string, marketType: MarketType): boolean {
    return this.activeSet.has(this.getKey(symbol, interval, marketType));
  }

  private subscribeTrade(symbol: string, marketType: MarketType): void {
    if (!this.client) return;
    const subKey = `${marketType}:${symbol.toUpperCase()}`;
    if (this.subscribedSymbols.has(subKey)) return;
    try {
      void this.client.subscribeTrades(symbol, marketType === 'SPOT' ? 'spot' : 'usdm');
      this.subscribedSymbols.add(subKey);
    } catch (error) {
      logger.error({ symbol, marketType, error: serializeError(error) }, 'Failed to subscribe trade for synthesis');
    }
  }

  private handleMessage(data: unknown): void {
    try {
      if (typeof data !== 'object' || data === null) return;
      const message = data as Record<string, unknown>;
      const eventType = message['eventType'] ?? message['e'];
      if (eventType !== 'trade') return;

      const symbol = (message['symbol'] ?? message['s']) as string | undefined;
      if (!symbol) return;

      const priceValue = message['price'] ?? message['p'];
      const quantityValue = message['quantity'] ?? message['q'];
      const tsValue = message['tradeTime'] ?? message['T'] ?? Date.now();

      const price = typeof priceValue === 'string' ? parseFloat(priceValue) : Number(priceValue);
      const quantity = typeof quantityValue === 'string' ? parseFloat(quantityValue) : Number(quantityValue);
      const timestamp = Number(tsValue);

      if (!Number.isFinite(price) || price <= 0) return;
      if (!Number.isFinite(quantity) || quantity < 0) return;
      if (!Number.isFinite(timestamp)) return;

      this.applyTradeToActiveBuckets(symbol, price, quantity, timestamp);
    } catch (err) {
      logger.error({ error: serializeError(err) }, 'Error in synthesis trade handler');
    }
  }

  private applyTradeToActiveBuckets(symbol: string, price: number, quantity: number, timestamp: number): void {
    const upperSymbol = symbol.toUpperCase();

    for (const key of this.activeSet) {
      const [market, keySymbol, intervalStr] = key.split(':');
      if (!market || !keySymbol || !intervalStr) continue;
      if (keySymbol !== upperSymbol) continue;

      const interval = intervalStr as TimeInterval;
      const intervalMs = INTERVAL_MS[interval];
      if (!intervalMs) continue;

      const marketType: MarketType = market === 'SPOT' ? 'SPOT' : 'FUTURES';
      const bucketStart = alignToInterval(timestamp, intervalMs);
      const bucketEnd = bucketStart + intervalMs - 1;

      const existing = this.states.get(key);
      if (existing && existing.openTime !== bucketStart) {
        this.emitState(existing, true);
        this.states.delete(key);
      }

      const current = this.states.get(key);
      if (!current) {
        const newState: SyntheticKlineState = {
          symbol: upperSymbol,
          interval,
          intervalMs,
          marketType,
          openTime: bucketStart,
          closeTime: bucketEnd,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: quantity,
          trades: 1,
          takerBuyVolume: 0,
          lastEmitAt: 0,
          dirty: true,
        };
        this.states.set(key, newState);
        continue;
      }

      current.high = Math.max(current.high, price);
      current.low = Math.min(current.low, price);
      current.close = price;
      current.volume += quantity;
      current.trades += 1;
      current.dirty = true;
    }
  }

  private flushPending(): void {
    const now = Date.now();
    for (const state of this.states.values()) {
      if (!state.dirty) continue;
      if (now - state.lastEmitAt < EMIT_THROTTLE_MS) continue;
      this.emitState(state, false);
    }
  }

  private emitState(state: SyntheticKlineState, isClosed: boolean): void {
    const ws = getWebSocketService();
    if (!ws) return;
    ws.emitKlineUpdate({
      symbol: state.symbol,
      interval: state.interval,
      openTime: state.openTime,
      closeTime: state.closeTime,
      open: toNumberString(state.open),
      high: toNumberString(state.high),
      low: toNumberString(state.low),
      close: toNumberString(state.close),
      volume: toNumberString(state.volume),
      isClosed,
      timestamp: Date.now(),
      synthetic: true,
    });
    state.lastEmitAt = Date.now();
    state.dirty = false;
  }

  getActiveCount(): number {
    return this.activeSet.size;
  }
}

export const klineSynthesisService = new KlineSynthesisService();
