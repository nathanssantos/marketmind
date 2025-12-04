import { WebsocketClient } from 'binance';
import { eq } from 'drizzle-orm';
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
  private reconnectTimeout: NodeJS.Timeout | null = null;
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

    this.client.on('error', (error) => {
      logger.error('Binance WebSocket error', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    this.client.on('reconnected', () => {
      logger.info('Binance WebSocket reconnected');
      this.resubscribeAll();
    });

    this.subscribeToActivePositions();

    setInterval(() => {
      this.subscribeToActivePositions();
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

      if (message['e'] === 'trade' && typeof message['s'] === 'string') {
        const symbol = message['s'] as string;
        const price = parseFloat(message['p'] as string);
        const timestamp = message['T'] as number;

        this.processPriceUpdate({
          symbol,
          price,
          timestamp,
        });
      }
    } catch (error) {
      logger.error('Error handling Binance message', {
        error: error instanceof Error ? error.message : String(error),
      });
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

      for (const execution of openExecutions) {
        if (execution.status === 'open') {
          await positionMonitorService.checkPositionByPrice(execution, update.price);
        }
      }
    } catch (error) {
      logger.error('Error processing price update', {
        symbol: update.symbol,
        price: update.price,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async subscribeToActivePositions(): Promise<void> {
    try {
      const openExecutions = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.status, 'open'));

      const symbolsToSubscribe = new Set<string>();
      for (const execution of openExecutions) {
        symbolsToSubscribe.add(execution.symbol.toLowerCase());
      }

      const currentSymbols = new Set(this.subscribedSymbols);
      for (const symbol of currentSymbols) {
        if (!symbolsToSubscribe.has(symbol)) {
          this.unsubscribe(symbol);
        }
      }

      for (const symbol of symbolsToSubscribe) {
        if (!this.subscribedSymbols.has(symbol)) {
          this.subscribe(symbol);
        }
      }

      if (symbolsToSubscribe.size > 0) {
        logger.info(
          `Subscribed to ${symbolsToSubscribe.size} symbols: ${Array.from(symbolsToSubscribe).join(', ')}`
        );
      }
    } catch (error) {
      logger.error('Error subscribing to active positions', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private subscribe(symbol: string): void {
    if (!this.client || this.subscribedSymbols.has(symbol)) {
      return;
    }

    try {
      this.client.subscribeTrades(symbol, 'spot');
      this.subscribedSymbols.add(symbol);
      logger.info(`Subscribed to trades for ${symbol}`);
    } catch (error) {
      logger.error(`Failed to subscribe to ${symbol}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private unsubscribe(symbol: string): void {
    if (!this.client || !this.subscribedSymbols.has(symbol)) {
      return;
    }

    try {
      this.subscribedSymbols.delete(symbol);
      logger.info(`Unsubscribed from trades for ${symbol}`);
    } catch (error) {
      logger.error(`Failed to unsubscribe from ${symbol}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private resubscribeAll(): void {
    const symbols = Array.from(this.subscribedSymbols);
    this.subscribedSymbols.clear();

    for (const symbol of symbols) {
      this.subscribe(symbol);
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
