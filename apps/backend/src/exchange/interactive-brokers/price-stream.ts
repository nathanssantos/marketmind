import { SecType } from '@stoqey/ib';
import { TickType } from '@stoqey/ib/dist/api/market/tickType';
import type { Contract, MarketDataTicks } from '@stoqey/ib';
import type { MarketType } from '@marketmind/types';
import { Subscription } from 'rxjs';
import type { IExchangePriceStream, PriceUpdate } from '../price-stream';
import type { ExchangeId } from '../types';
import { IBConnectionManager, getDefaultConnectionManager } from './connection-manager';
import type { IBPriceData } from './types';

const getTickValue = (ticks: MarketDataTicks, tickType: number): number | undefined => {
  return ticks.get(tickType as TickType)?.value;
};

type PriceUpdateHandler = (update: PriceUpdate) => void;

interface SubscriptionInfo {
  symbol: string;
  marketType: MarketType;
  subscription: Subscription;
  lastPrice: number;
  lastUpdate: number;
}

export class IBPriceStream implements IExchangePriceStream {
  readonly exchangeId: ExchangeId = 'INTERACTIVE_BROKERS';
  private connectionManager: IBConnectionManager;
  private subscriptions: Map<string, SubscriptionInfo> = new Map();
  private handlers: Set<PriceUpdateHandler> = new Set();
  private isRunning = false;
  private priceData: Map<string, IBPriceData> = new Map();

  constructor(connectionManager?: IBConnectionManager) {
    this.connectionManager = connectionManager ?? getDefaultConnectionManager();
  }

  private createContract(symbol: string): Contract {
    return {
      symbol: symbol.toUpperCase(),
      secType: SecType.STK,
      exchange: 'SMART',
      currency: 'USD',
    };
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
  }

  stop(): void {
    if (!this.isRunning) return;

    for (const [symbol, info] of this.subscriptions) {
      info.subscription.unsubscribe();
      this.subscriptions.delete(symbol);
    }

    this.priceData.clear();
    this.isRunning = false;
  }

  subscribe(symbol: string, marketType: MarketType): void {
    const upperSymbol = symbol.toUpperCase();

    if (this.subscriptions.has(upperSymbol)) {
      return;
    }

    if (!this.connectionManager.isConnected) {
      this.connectionManager.connect().then(() => {
        this.createSubscription(upperSymbol, marketType);
      });
    } else {
      this.createSubscription(upperSymbol, marketType);
    }
  }

  private createSubscription(symbol: string, marketType: MarketType): void {
    const contract = this.createContract(symbol);

    const genericTickList = '236';
    const observable = this.connectionManager.client.getMarketData(
      contract,
      genericTickList,
      false,
      false
    );

    const subscription = observable.subscribe({
      next: (marketDataUpdate) => {
        const ticks = marketDataUpdate.all;
        const lastPrice = getTickValue(ticks, TickType.LAST) ?? getTickValue(ticks, TickType.CLOSE) ?? 0;

        if (lastPrice > 0) {
          const update: PriceUpdate = {
            symbol,
            price: lastPrice,
            timestamp: Date.now(),
          };

          const existingData = this.priceData.get(symbol) ?? {
            symbol,
            bid: 0,
            ask: 0,
            last: 0,
            bidSize: 0,
            askSize: 0,
            lastSize: 0,
            volume: 0,
            close: 0,
            open: 0,
            high: 0,
            low: 0,
          };

          this.priceData.set(symbol, {
            ...existingData,
            bid: getTickValue(ticks, TickType.BID) ?? existingData.bid,
            ask: getTickValue(ticks, TickType.ASK) ?? existingData.ask,
            last: lastPrice,
            bidSize: getTickValue(ticks, TickType.BID_SIZE) ?? existingData.bidSize,
            askSize: getTickValue(ticks, TickType.ASK_SIZE) ?? existingData.askSize,
            lastSize: getTickValue(ticks, TickType.LAST_SIZE) ?? existingData.lastSize,
            volume: getTickValue(ticks, TickType.VOLUME) ?? existingData.volume,
            close: getTickValue(ticks, TickType.CLOSE) ?? existingData.close,
            open: getTickValue(ticks, TickType.OPEN) ?? existingData.open,
            high: getTickValue(ticks, TickType.HIGH) ?? existingData.high,
            low: getTickValue(ticks, TickType.LOW) ?? existingData.low,
          });

          const subInfo = this.subscriptions.get(symbol);
          if (subInfo) {
            subInfo.lastPrice = lastPrice;
            subInfo.lastUpdate = Date.now();
          }

          this.notifyHandlers(update);
        }
      },
      error: (err) => {
        console.error(`[IBPriceStream] Error for ${symbol}:`, err);
      },
    });

    this.subscriptions.set(symbol, {
      symbol,
      marketType,
      subscription,
      lastPrice: 0,
      lastUpdate: 0,
    });
  }

  unsubscribe(symbol: string): void {
    const upperSymbol = symbol.toUpperCase();
    const info = this.subscriptions.get(upperSymbol);

    if (info) {
      info.subscription.unsubscribe();
      this.subscriptions.delete(upperSymbol);
      this.priceData.delete(upperSymbol);
    }
  }

  isSubscribed(symbol: string): boolean {
    return this.subscriptions.has(symbol.toUpperCase());
  }

  onPriceUpdate(handler: PriceUpdateHandler): void {
    this.handlers.add(handler);
  }

  private notifyHandlers(update: PriceUpdate): void {
    for (const handler of this.handlers) {
      try {
        handler(update);
      } catch (error) {
        console.error('[IBPriceStream] Handler error:', error);
      }
    }
  }

  getPrice(symbol: string): number | undefined {
    return this.priceData.get(symbol.toUpperCase())?.last;
  }

  getPriceData(symbol: string): IBPriceData | undefined {
    return this.priceData.get(symbol.toUpperCase());
  }

  getAllPrices(): Map<string, number> {
    const prices = new Map<string, number>();
    for (const [symbol, data] of this.priceData) {
      if (data.last > 0) {
        prices.set(symbol, data.last);
      }
    }
    return prices;
  }
}
