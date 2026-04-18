import { WebsocketClient } from 'binance';
import { WEBSOCKET_CONFIG } from '../constants';
import { serializeError } from '../utils/errors';
import { silentWsLogger } from './binance-client';
import { logger } from './logger';
import { getWebSocketService } from './websocket';

export interface TickerUpdate {
  symbol: string;
  priceChangePercent: number;
  lastPrice: number;
  timestamp: number;
}

type Market = 'spot' | 'usdm';

export class BinanceTickerStreamService {
  private client: WebsocketClient | null = null;
  private subscribedSymbols: Map<string, Market> = new Map();
  private isReconnecting = false;

  start(): void {
    if (this.client) {
      logger.warn('Binance ticker stream already running');
      return;
    }

    this.client = new WebsocketClient(
      { beautify: true, reconnectTimeout: WEBSOCKET_CONFIG.RECONNECT_DELAY_MS },
      silentWsLogger,
    );

    this.client.on('message', (data) => this.handleMessage(data));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.client as any).on('error', (error: unknown) => {
      logger.error({ error: serializeError(error) }, 'Binance ticker WebSocket error');
    });

    this.client.on('reconnected', () => {
      if (this.isReconnecting) return;
      this.isReconnecting = true;
      this.resubscribeAll();
      setTimeout(() => { this.isReconnecting = false; }, 2000);
    });

    logger.info('Binance ticker stream service started');
  }

  stop(): void {
    if (this.client) {
      this.client.closeAll(true);
      this.client = null;
      this.subscribedSymbols.clear();
      logger.info('Binance ticker stream service stopped');
    }
  }

  subscribe(symbol: string, market: Market = 'usdm'): void {
    if (!this.client) return;
    const s = symbol.toLowerCase();
    if (this.subscribedSymbols.has(s)) return;

    try {
      void this.client.subscribeSymbol24hrTicker(s, market);
      this.subscribedSymbols.set(s, market);
    } catch (error) {
      logger.error({ error: serializeError(error), symbol: s }, 'Failed to subscribe to ticker');
    }
  }

  unsubscribe(symbol: string): void {
    this.subscribedSymbols.delete(symbol.toLowerCase());
  }

  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols.keys());
  }

  private handleMessage(data: unknown): void {
    try {
      if (typeof data !== 'object' || data === null) return;

      const msg = data as Record<string, unknown>;
      const eventType = msg['eventType'] ?? msg['e'];
      if (eventType !== '24hrTicker') return;

      const rawSymbol = (msg['symbol'] ?? msg['s']) as string | undefined;
      if (!rawSymbol) return;

      const priceChangePercent = parseFloat(
        String(msg['priceChangePercent'] ?? msg['P'] ?? '0'),
      );
      const lastPrice = parseFloat(String(msg['lastPrice'] ?? msg['curDayClose'] ?? msg['c'] ?? '0'));

      if (!Number.isFinite(priceChangePercent)) return;

      const update: TickerUpdate = {
        symbol: rawSymbol.toUpperCase(),
        priceChangePercent,
        lastPrice,
        timestamp: Date.now(),
      };

      const ws = getWebSocketService();
      if (ws) ws.emitTickerUpdate(update.symbol, update);
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Error handling ticker message');
    }
  }

  private resubscribeAll(): void {
    const entries = Array.from(this.subscribedSymbols.entries());
    this.subscribedSymbols.clear();
    for (const [symbol, market] of entries) {
      this.subscribe(symbol, market);
    }
    logger.info({ count: entries.length }, 'Ticker resubscription complete');
  }
}

export const binanceTickerStreamService = new BinanceTickerStreamService();
