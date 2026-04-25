import { serializeError } from '../utils/errors';
import { WebsocketClient } from 'binance';
import { and, eq, inArray } from 'drizzle-orm';
import { ROOM_PREFIXES } from '@marketmind/types';
import { AUTO_TRADING_TIMING, WEBSOCKET_CONFIG } from '../constants';
import { db } from '../db';
import type { TradeExecution } from '../db/schema';
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

export interface TradeTick {
  symbol: string;
  price: number;
  quantity: number;
  timestamp: number;
  marketType: 'SPOT' | 'FUTURES';
}

export type TradeTickHandler = (tick: TradeTick) => void;

const POSITION_CHECK_THROTTLE_MS = AUTO_TRADING_TIMING.POSITION_CHECK_THROTTLE_MS;
const SUBSCRIPTION_RECONCILE_SAFETY_MS = 30 * 60_000;
const EXECUTION_CACHE_TTL_MS = 10_000;

export class BinancePriceStreamService {
  private client: WebsocketClient | null = null;
  private subscribedSymbols: Set<string> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isReconnecting = false;
  private subscriptionInterval: ReturnType<typeof setInterval> | null = null;
  private lastPositionCheck: Map<string, number> = new Map();
  private openExecutionsCache: Map<string, { executions: TradeExecution[]; timestamp: number }> = new Map();
  private priceObservers: Array<(symbol: string, price: number, timestamp: number) => void> = [];
  private tradeTickObservers: TradeTickHandler[] = [];

  start(): void {
    if (this.client) {
      logger.warn('Binance price stream already running');
      return;
    }

    logger.trace('Starting Binance price stream service');

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

    this.client.on('open', (data) => {
      logger.info({ wsKey: data?.wsKey }, 'Binance WebSocket connection opened');
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.client as any).on('close', () => {
      logger.warn('Binance WebSocket connection closed');
    });

    this.client.on('reconnecting', (data) => {
      logger.info({ wsKey: data?.wsKey }, 'Binance WebSocket reconnecting...');
    });

    this.client.on('reconnected', () => {
      if (this.isReconnecting) {
        logger.trace('Ignoring duplicate reconnected event');
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

    void this.reconcileSubscriptions();

    this.subscriptionInterval = setInterval(() => {
      void this.reconcileSubscriptions();
    }, SUBSCRIPTION_RECONCILE_SAFETY_MS);
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
      this.openExecutionsCache.clear();
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

        const quantityValue = message['quantity'] ?? message['q'];
        const quantity = typeof quantityValue === 'number'
          ? quantityValue
          : typeof quantityValue === 'string'
            ? parseFloat(quantityValue)
            : 0;

        if (this.tradeTickObservers.length > 0 && !isNaN(quantity)) {
          const tick: TradeTick = {
            symbol,
            price,
            quantity,
            timestamp,
            marketType: 'FUTURES',
          };
          for (const observer of this.tradeTickObservers) {
            try {
              observer(tick);
            } catch (err) {
              logger.warn({ error: serializeError(err) }, 'tradeTick observer error');
            }
          }
        }

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

  public onPriceUpdate(handler: (symbol: string, price: number, timestamp: number) => void): () => void {
    this.priceObservers.push(handler);
    return () => {
      const idx = this.priceObservers.indexOf(handler);
      if (idx >= 0) this.priceObservers.splice(idx, 1);
    };
  }

  public onTradeTick(handler: TradeTickHandler): () => void {
    this.tradeTickObservers.push(handler);
    return () => {
      const idx = this.tradeTickObservers.indexOf(handler);
      if (idx >= 0) this.tradeTickObservers.splice(idx, 1);
    };
  }

  private async processPriceUpdate(update: PriceUpdate): Promise<void> {
    try {
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.emitPriceUpdate(update.symbol, update.price, update.timestamp);
      }

      for (const observer of this.priceObservers) {
        try {
          observer(update.symbol, update.price, update.timestamp);
        } catch (err) {
          logger.warn({ error: err }, 'Price observer error');
        }
      }

      const now = Date.now();
      const lastCheck = this.lastPositionCheck.get(update.symbol) || 0;
      if (now - lastCheck < POSITION_CHECK_THROTTLE_MS) {
        return;
      }
      this.lastPositionCheck.set(update.symbol, now);

      void positionMonitorService.updatePrice(update.symbol, update.price);

      const openExecutions = await this.getOpenExecutionsForSymbol(update.symbol);
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

  private async getOpenExecutionsForSymbol(symbol: string): Promise<TradeExecution[]> {
    const cached = this.openExecutionsCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < EXECUTION_CACHE_TTL_MS) {
      return cached.executions;
    }

    const executions = await db
      .select()
      .from(tradeExecutions)
      .where(and(
        eq(tradeExecutions.symbol, symbol),
        eq(tradeExecutions.status, 'open')
      ));

    this.openExecutionsCache.set(symbol, { executions, timestamp: Date.now() });
    return executions;
  }

  public invalidateExecutionCache(symbol?: string): void {
    if (symbol) {
      this.openExecutionsCache.delete(symbol);
    } else {
      this.openExecutionsCache.clear();
    }
  }

  public async reconcileSubscriptions(): Promise<void> {
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

      const wsService = getWebSocketService();
      const viewedRooms = wsService?.getActiveRooms(ROOM_PREFIXES.prices) ?? [];
      for (const symbol of viewedRooms) {
        futuresSymbols.add(symbol.toLowerCase());
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
        }
      }

      if (newSubscriptions.length > 0) {
        logger.trace({
          newSymbols: newSubscriptions,
          totalSubscribed: this.subscribedSymbols.size,
        }, `Subscribed to ${newSubscriptions.length} new symbol(s)`);
      }

      if (unsubscribed.length > 0) {
        logger.trace({
          removedSymbols: unsubscribed,
          totalSubscribed: this.subscribedSymbols.size,
        }, `Unsubscribed from ${unsubscribed.length} symbol(s) — no open positions and no active room subscribers`);
      }
    } catch (error) {
      logger.error({
        error: serializeError(error),
      }, 'Error reconciling price-stream subscriptions');
    }
  }

  private subscribe(symbol: string, market: 'spot' | 'usdm' = 'usdm'): void {
    if (!this.client) {
      return;
    }

    if (this.subscribedSymbols.has(symbol)) {
      return;
    }

    try {
      // Use @aggTrade (public market stream) instead of @trade. The Binance SDK
      // routes `subscribeTrades` for usdm/coinm to a "private" wsKey that requires
      // API authentication and returns HTTP 400 without it; this silently drops
      // every futures trade subscription. `subscribeAggregateTrades` routes to
      // the public `usdmMarket` wsKey. Aggregated trades carry the same price/qty
      // info our `handleMessage` already recognizes (`e: 'aggTrade'`).
      void this.client.subscribeAggregateTrades(symbol, market);
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
      logger.trace('No symbols to resubscribe');
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
