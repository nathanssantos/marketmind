import type { Interval } from '@marketmind/types';
import { and, desc, eq } from 'drizzle-orm';
import WebSocket from 'ws';
import { db } from '../db';
import { klines } from '../db/schema';
import { logger } from './logger';

interface BinanceKlineData {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
  T: number;
  q: string;
  n: number;
  V: string;
  Q: string;
  B: string;
  x: boolean;
}

interface BinanceKlineMessage {
  e: string;
  E: number;
  s: string;
  k: BinanceKlineData;
}

const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/ws';
const RECONNECT_DELAY = 5000;
const PING_INTERVAL = 30000;

class BinanceKlineSync {
  private connections = new Map<string, WebSocket>();
  private pingIntervals = new Map<string, NodeJS.Timeout>();
  private reconnectTimeouts = new Map<string, NodeJS.Timeout>();

  subscribe(symbol: string, interval: Interval): void {
    const key = `${symbol}@${interval}`;
    
    if (this.connections.has(key)) {
      logger.debug({ key }, 'Already subscribed to stream');
      return;
    }

    this.connect(symbol, interval);
  }

  private connect(symbol: string, interval: Interval): void {
    const key = `${symbol}@${interval}`;
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;
    const url = `${BINANCE_WS_BASE}/${stream}`;

    logger.info({ stream }, 'Connecting to Binance WebSocket');

    const ws = new WebSocket(url);

    ws.on('open', () => {
      logger.info({ stream }, 'Connected to Binance WebSocket');
      this.startPing(key, ws);
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as BinanceKlineMessage;
        
        if (message.e === 'kline') {
          this.processKline(symbol, interval, message.k);
        }
      } catch (error) {
        logger.error({ key, error }, 'Error processing WebSocket message');
      }
    });

    ws.on('error', (error: Error) => {
      logger.error({ key, error }, 'WebSocket error');
    });

    ws.on('close', () => {
      logger.info({ stream }, 'Disconnected from Binance WebSocket');
      this.cleanup(key);
      this.scheduleReconnect(symbol, interval);
    });

    this.connections.set(key, ws);
  }

  private async processKline(symbol: string, interval: Interval, kline: BinanceKlineData): Promise<void> {
    if (!kline.x) return;

    try {
      const klineData = {
        symbol,
        interval,
        marketType: 'SPOT' as const,
        openTime: new Date(kline.t),
        open: kline.o,
        high: kline.h,
        low: kline.l,
        close: kline.c,
        volume: kline.v,
        closeTime: new Date(kline.T),
        quoteVolume: kline.q,
        trades: kline.n,
        takerBuyBaseVolume: kline.V,
        takerBuyQuoteVolume: kline.Q,
      };

      const existing = await db.query.klines.findFirst({
        where: and(
          eq(klines.symbol, symbol),
          eq(klines.interval, interval),
          eq(klines.marketType, 'SPOT'),
          eq(klines.openTime, klineData.openTime)
        ),
      });

      if (existing) {
        await db
          .update(klines)
          .set(klineData)
          .where(
            and(
              eq(klines.symbol, symbol),
              eq(klines.interval, interval),
              eq(klines.marketType, 'SPOT'),
              eq(klines.openTime, klineData.openTime)
            )
          );
      } else {
        await db.insert(klines).values(klineData);
      }
    } catch (error) {
      logger.error({ symbol, interval, error }, 'Error persisting kline');
    }
  }

  private startPing(key: string, ws: WebSocket): void {
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, PING_INTERVAL);

    this.pingIntervals.set(key, interval);
  }

  private cleanup(key: string): void {
    const pingInterval = this.pingIntervals.get(key);
    if (pingInterval) {
      clearInterval(pingInterval);
      this.pingIntervals.delete(key);
    }

    this.connections.delete(key);
  }

  private scheduleReconnect(symbol: string, interval: Interval): void {
    const key = `${symbol}@${interval}`;
    
    const timeout = setTimeout(() => {
      logger.info({ key }, 'Reconnecting to Binance WebSocket');
      this.connect(symbol, interval);
      this.reconnectTimeouts.delete(key);
    }, RECONNECT_DELAY);

    this.reconnectTimeouts.set(key, timeout);
  }

  unsubscribe(symbol: string, interval: Interval): void {
    const key = `${symbol}@${interval}`;
    const ws = this.connections.get(key);

    if (ws) {
      ws.close();
      this.cleanup(key);
    }

    const reconnectTimeout = this.reconnectTimeouts.get(key);
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      this.reconnectTimeouts.delete(key);
    }
  }

  async getLatestKline(symbol: string, interval: Interval): Promise<Date | null> {
    const latest = await db.query.klines.findFirst({
      where: and(eq(klines.symbol, symbol), eq(klines.interval, interval), eq(klines.marketType, 'SPOT')),
      orderBy: [desc(klines.openTime)],
    });

    return latest?.openTime || null;
  }

  shutdown(): void {
    logger.info('Shutting down Binance WebSocket connections');
    
    for (const [key, ws] of this.connections.entries()) {
      ws.close();
      this.cleanup(key);
    }

    for (const timeout of this.reconnectTimeouts.values()) {
      clearTimeout(timeout);
    }
    
    this.reconnectTimeouts.clear();
  }
}

let binanceKlineSync: BinanceKlineSync | null = null;

export const getBinanceKlineSync = (): BinanceKlineSync => {
  if (!binanceKlineSync) {
    binanceKlineSync = new BinanceKlineSync();
  }
  return binanceKlineSync;
};

export const initializeBinanceKlineSync = (): BinanceKlineSync => {
  binanceKlineSync = new BinanceKlineSync();
  return binanceKlineSync;
};
