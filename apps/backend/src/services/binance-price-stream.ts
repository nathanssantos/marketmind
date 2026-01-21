import { serializeError } from '../utils/errors';
import { WebsocketClient } from 'binance';
import { and, eq, inArray } from 'drizzle-orm';
import { WEBSOCKET_CONFIG } from '../constants';
import { db } from '../db';
import { tradeExecutions } from '../db/schema';
import { silentWsLogger } from './binance-client';
import { logger } from './logger';
import { positionMonitorService } from './position-monitor';
import { getWebSocketService } from './websocket';

export interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

const POSITION_CHECK_THROTTLE_MS = 500;

export class BinancePriceStreamService {
  private client: WebsocketClient | null = null;
  private subscribedSymbols: Set<string> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isReconnecting = false;
  private subscriptionInterval: ReturnType<typeof setInterval> | null = null;
  private lastPositionCheck: Map<string, number> = new Map();

  start(): void {
    if (this.client) {
      logger.warn('Binance price stream already running');
      return;
    }

    logger.debug('Starting Binance price stream service');

    this.client = new WebsocketClient(
      { beautify: true, reconnectTimeout: WEBSOCKET_CONFIG.RECONNECT_DELAY_MS },
      silentWsLogger
    );

    this.client.on('message', (data) => {
      this.handleMessage(data);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.client as any).on('error', (error: unknown) => {
      logger.error({
        error: serializeError(error),
      }, 'Binance WebSocket error');
    });

    this.client.on('reconnected', () => {
      if (this.isReconnecting) {
        logger.debug('Ignoring duplicate reconnected event');
        return;
      }
      this.isReconnecting = true;
      logger.info({
        symbolCount: this.subscribedSymbols.size,
        symbols: Array.from(this.subscribedSymbols),
      }, 'Binance WebSocket reconnected - resubscribing');
      void this.resubscribeAll();
      setTimeout(() => {
        this.isReconnecting = false;
      }, 2000);
    });

    void this.subscribeToActivePositions();

    this.subscriptionInterval = setInterval(() => {
      void this.subscribeToActivePositions();
    }, 60000);
  }

  stop(): void {
    if (this.subscriptionInterval) {
      clearInterval(this.subscriptionInterval);
      this.subscriptionInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.client) {
      this.client.closeAll(true);
      this.client = null;
      this.subscribedSymbols.clear();
      this.lastPositionCheck.clear();
      logger.info('Binance price stream service stopped');
    }
  }

  private handleMessage(data: unknown): void {
    try {
      if (typeof data !== 'object' || data === null) {
        return;
      }

      const message = data as Record<string, unknown>;
      const eventType = message['eventType'] ?? message['e'];

      if (eventType === 'aggTrade' || eventType === 'trade') {
        const symbol = (message['symbol'] ?? message['s']) as string;
        if (!symbol) return;

        const priceValue = message['price'] ?? message['p'];
        const price = typeof priceValue === 'number'
          ? priceValue
          : typeof priceValue === 'string'
            ? parseFloat(priceValue)
            : NaN;

        if (isNaN(price) || price <= 0) return;

        const timestamp = (message['tradeTime'] ?? message['T'] ?? Date.now()) as number;

        void this.processPriceUpdate({
          symbol,
          price,
          timestamp,
        });
      }
    } catch (error) {
      logger.error({
        error: serializeError(error),
      }, 'Error handling Binance message');
    }
  }

  private async processPriceUpdate(update: PriceUpdate): Promise<void> {
    try {
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.emitPriceUpdate(update.symbol, update.price, update.timestamp);
      }

      const now = Date.now();
      const lastCheck = this.lastPositionCheck.get(update.symbol) || 0;
      if (now - lastCheck < POSITION_CHECK_THROTTLE_MS) {
        return;
      }
      this.lastPositionCheck.set(update.symbol, now);

      void positionMonitorService.updatePrice(update.symbol, update.price);

      const openExecutions = await db
        .select()
        .from(tradeExecutions)
        .where(and(
          eq(tradeExecutions.symbol, update.symbol),
          eq(tradeExecutions.status, 'open')
        ));

      if (openExecutions.length === 0) return;

      const groups = positionMonitorService.groupExecutionsBySymbolAndSidePublic(openExecutions);

      for (const [_groupKey, groupExecutions] of groups) {
        await positionMonitorService.checkPositionGroupByPrice(groupExecutions, update.price);
      }
    } catch (error) {
      logger.error({
        symbol: update.symbol,
        price: update.price,
        error: serializeError(error),
      }, 'Error processing price update');
    }
  }

  private async subscribeToActivePositions(): Promise<void> {
    try {
      const openExecutions = await db
        .select()
        .from(tradeExecutions)
        .where(inArray(tradeExecutions.status, ['open', 'pending']));

      const spotSymbols = new Set<string>();
      const futuresSymbols = new Set<string>();

      for (const execution of openExecutions) {
        const symbol = execution.symbol.toLowerCase();
        if (execution.marketType === 'FUTURES') {
          futuresSymbols.add(symbol);
        } else {
          spotSymbols.add(symbol);
        }
      }

      const allSymbolsNeeded = new Set([...spotSymbols, ...futuresSymbols]);

      const currentSymbols = new Set(this.subscribedSymbols);
      const unsubscribed: string[] = [];
      for (const symbol of currentSymbols) {
        if (!allSymbolsNeeded.has(symbol)) {
          this.unsubscribe(symbol);
          unsubscribed.push(symbol);
        }
      }

      const newSubscriptions: string[] = [];
      for (const symbol of spotSymbols) {
        if (!this.subscribedSymbols.has(symbol)) {
          this.subscribe(symbol, 'spot');
          newSubscriptions.push(`${symbol}:spot`);
        }
      }

      for (const symbol of futuresSymbols) {
        if (!this.subscribedSymbols.has(symbol)) {
          this.subscribe(symbol, 'usdm');
          newSubscriptions.push(`${symbol}:futures`);
        } else {
          this.subscribe(symbol, 'usdm');
        }
      }

      if (newSubscriptions.length > 0) {
        logger.debug({
          newSymbols: newSubscriptions,
          totalSubscribed: this.subscribedSymbols.size,
        }, `Subscribed to ${newSubscriptions.length} new symbol(s)`);
      }

      if (unsubscribed.length > 0) {
        logger.debug({
          removedSymbols: unsubscribed,
          totalSubscribed: this.subscribedSymbols.size,
        }, `Unsubscribed from ${unsubscribed.length} symbol(s) - no open positions`);
      }
    } catch (error) {
      logger.error({
        error: serializeError(error),
      }, 'Error subscribing to active positions');
    }
  }

  private subscribe(symbol: string, market: 'spot' | 'usdm' = 'spot'): void {
    if (!this.client) {
      return;
    }

    if (market === 'spot' && this.subscribedSymbols.has(symbol)) {
      return;
    }

    try {
      void this.client.subscribeTrades(symbol, market);
      this.subscribedSymbols.add(symbol);
    } catch (error) {
      logger.error({
        error: serializeError(error),
      }, `Failed to subscribe to ${symbol}`);
    }
  }

  private unsubscribe(symbol: string): void {
    if (!this.client || !this.subscribedSymbols.has(symbol)) {
      return;
    }

    this.subscribedSymbols.delete(symbol);
    this.lastPositionCheck.delete(symbol);
  }

  private async resubscribeAll(): Promise<void> {
    const symbols = Array.from(this.subscribedSymbols);
    if (symbols.length === 0) {
      logger.debug('No symbols to resubscribe');
      return;
    }

    this.subscribedSymbols.clear();

    try {
      const openExecutions = await db
        .select()
        .from(tradeExecutions)
        .where(inArray(tradeExecutions.status, ['open', 'pending']));

      const futuresSymbols = new Set<string>();
      for (const execution of openExecutions) {
        if (execution.marketType === 'FUTURES') {
          futuresSymbols.add(execution.symbol.toLowerCase());
        }
      }

      for (const symbol of symbols) {
        const market = futuresSymbols.has(symbol) ? 'usdm' : 'spot';
        this.subscribe(symbol, market);
      }

      logger.info({
        resubscribedCount: symbols.length,
        symbols,
        futuresCount: futuresSymbols.size,
      }, 'Resubscription complete');
    } catch (error) {
      logger.error({
        error: serializeError(error),
      }, 'Error during resubscription - falling back to spot');

      for (const symbol of symbols) {
        this.subscribe(symbol);
      }
    }
  }

  public subscribeSymbol(symbol: string): void {
    this.subscribe(symbol.toLowerCase());
  }

  public unsubscribeSymbol(symbol: string): void {
    this.unsubscribe(symbol.toLowerCase());
  }

  public getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }
}

export const binancePriceStreamService = new BinancePriceStreamService();
