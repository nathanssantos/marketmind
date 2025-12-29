import { WebsocketClient } from 'binance';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { tradeExecutions } from '../db/schema';
import { logger } from './logger';
import { positionMonitorService } from './position-monitor';
import { getWebSocketService } from './websocket';

export interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

export class BinancePriceStreamService {
  private client: WebsocketClient | null = null;
  private subscribedSymbols: Set<string> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isReconnecting = false;
  private readonly RECONNECT_DELAY_MS = 5000;

  start(): void {
    if (this.client) {
      logger.warn('Binance price stream already running');
      return;
    }

    logger.info('Starting Binance price stream service');

    this.client = new WebsocketClient({
      beautify: true,
      reconnectTimeout: this.RECONNECT_DELAY_MS,
    });

    this.client.on('message', (data) => {
      this.handleMessage(data);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.client as any).on('error', (error: unknown) => {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
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

    setInterval(() => {
      void this.subscribeToActivePositions();
    }, 60000);
  }

  stop(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.client) {
      this.client.closeAll(true);
      this.client = null;
      this.subscribedSymbols.clear();
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
        error: error instanceof Error ? error.message : String(error),
      }, 'Error handling Binance message');
    }
  }

  private async processPriceUpdate(update: PriceUpdate): Promise<void> {
    try {
      await positionMonitorService.updatePrice(update.symbol, update.price);

      const wsService = getWebSocketService();
      if (wsService) {
        wsService.emitPriceUpdate(update.symbol, update.price, update.timestamp);
      }

      const openExecutions = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.symbol, update.symbol));

      const openOnly = openExecutions.filter(e => e.status === 'open');
      if (openOnly.length === 0) return;

      const groups = positionMonitorService.groupExecutionsBySymbolAndSidePublic(openOnly);

      for (const [_groupKey, groupExecutions] of groups) {
        await positionMonitorService.checkPositionGroupByPrice(groupExecutions, update.price);
      }
    } catch (error) {
      logger.error({
        symbol: update.symbol,
        price: update.price,
        error: error instanceof Error ? error.message : String(error),
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
        logger.info({
          newSymbols: newSubscriptions,
          totalSubscribed: this.subscribedSymbols.size,
        }, `Subscribed to ${newSubscriptions.length} new symbol(s)`);
      }

      if (unsubscribed.length > 0) {
        logger.info({
          removedSymbols: unsubscribed,
          totalSubscribed: this.subscribedSymbols.size,
        }, `Unsubscribed from ${unsubscribed.length} symbol(s) - no open positions`);
      }
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
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
      logger.info({ symbol, market }, `📊 Subscribed to ${market.toUpperCase()} trades stream`);
      this.subscribedSymbols.add(symbol);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, `Failed to subscribe to ${symbol}`);
    }
  }

  private unsubscribe(symbol: string): void {
    if (!this.client || !this.subscribedSymbols.has(symbol)) {
      return;
    }

    this.subscribedSymbols.delete(symbol);
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
        error: error instanceof Error ? error.message : String(error),
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
