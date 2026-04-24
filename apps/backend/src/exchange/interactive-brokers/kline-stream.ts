import { SecType, WhatToShow, BarSizeSetting } from '@stoqey/ib';
import type { Contract, Bar } from '@stoqey/ib';
import { INTERVAL_MS, type Kline, type TimeInterval } from '@marketmind/types';
import type { Subscription } from 'rxjs';
import type { IExchangeKlineStream, KlineUpdate } from '../kline-stream';
import type { ExchangeId } from '../types';
import type { IBConnectionManager} from './connection-manager';
import { getDefaultConnectionManager } from './connection-manager';

type KlineUpdateHandler = (update: KlineUpdate) => void;

interface SubscriptionInfo {
  symbol: string;
  interval: string;
  subscription: Subscription;
  reqId: number;
}

const mapIntervalToBarSize = (interval: string): BarSizeSetting => {
  const mapping: Record<string, BarSizeSetting> = {
    '1m': BarSizeSetting.MINUTES_ONE,
    '5m': BarSizeSetting.MINUTES_FIVE,
    '15m': BarSizeSetting.MINUTES_FIFTEEN,
    '30m': BarSizeSetting.MINUTES_THIRTY,
    '1h': BarSizeSetting.HOURS_ONE,
    '2h': BarSizeSetting.HOURS_TWO,
    '4h': BarSizeSetting.HOURS_FOUR,
    '1d': BarSizeSetting.DAYS_ONE,
    '1w': BarSizeSetting.WEEKS_ONE,
    '1M': BarSizeSetting.MONTHS_ONE,
  };
  return mapping[interval] ?? BarSizeSetting.MINUTES_ONE;
};

const getNYTimezoneOffset = (date: Date): string => {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
  const nyStr = date.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false });
  const utcDate = new Date(utcStr);
  const nyDate = new Date(nyStr);
  const diffMs = nyDate.getTime() - utcDate.getTime();
  const diffHours = Math.round(diffMs / 3_600_000);
  const sign = diffHours >= 0 ? '+' : '-';
  return `${sign}${String(Math.abs(diffHours)).padStart(2, '0')}:00`;
};

const parseIBDateTime = (ibTime: string): number => {
  const refDate = new Date();
  const offset = getNYTimezoneOffset(refDate);

  if (ibTime.includes(' ')) {
    const [datePart, timePart] = ibTime.split(' ');
    if (!datePart) return Date.now();
    const year = datePart.slice(0, 4);
    const month = datePart.slice(4, 6);
    const day = datePart.slice(6, 8);
    const timeStr = timePart ?? '09:30:00';
    return new Date(`${year}-${month}-${day}T${timeStr}${offset}`).getTime();
  }
  const year = ibTime.slice(0, 4);
  const month = ibTime.slice(4, 6);
  const day = ibTime.slice(6, 8);
  return new Date(`${year}-${month}-${day}T09:30:00${offset}`).getTime();
};

const getIntervalMs = (interval: string): number =>
  INTERVAL_MS[interval as TimeInterval] ?? INTERVAL_MS['1m'];

const mapIBBarToKline = (bar: Bar, interval: string): Kline => {
  const openTime = parseIBDateTime(bar.time ?? '');
  const intervalMs = getIntervalMs(interval);

  return {
    openTime,
    closeTime: openTime + intervalMs - 1,
    open: String(bar.open ?? 0),
    high: String(bar.high ?? 0),
    low: String(bar.low ?? 0),
    close: String(bar.close ?? 0),
    volume: String(bar.volume ?? 0),
    quoteVolume: String((bar.volume ?? 0) * (bar.WAP ?? bar.close ?? 0)),
    trades: bar.count ?? 0,
    takerBuyBaseVolume: '0',
    takerBuyQuoteVolume: '0',
  };
};

export class IBKlineStream implements IExchangeKlineStream {
  readonly exchangeId: ExchangeId = 'INTERACTIVE_BROKERS';
  private connectionManager: IBConnectionManager;
  private subscriptions: Map<string, SubscriptionInfo> = new Map();
  private handlers: Set<KlineUpdateHandler> = new Set();
  private isRunning = false;

  constructor(connectionManager?: IBConnectionManager) {
    this.connectionManager = connectionManager ?? getDefaultConnectionManager();
  }

  private getSubscriptionKey(symbol: string, interval: string): string {
    return `${symbol}:${interval}`;
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

    for (const [key, info] of this.subscriptions) {
      info.subscription.unsubscribe();
      this.subscriptions.delete(key);
    }

    this.isRunning = false;
  }

  async subscribe(symbol: string, interval: string): Promise<void> {
    const key = this.getSubscriptionKey(symbol, interval);

    if (this.subscriptions.has(key)) {
      return;
    }

    if (!this.connectionManager.isConnected) {
      await this.connectionManager.connect();
    }

    this.createSubscription(symbol, interval);
  }

  private createSubscription(symbol: string, interval: string): void {
    const key = this.getSubscriptionKey(symbol, interval);
    const contract = this.createContract(symbol);
    const barSize = mapIntervalToBarSize(interval);

    const observable = this.connectionManager.client.getHistoricalDataUpdates(
      contract,
      barSize,
      WhatToShow.TRADES,
      1
    );

    const subscription = observable.subscribe({
      next: (bar: Bar) => {
        const kline = mapIBBarToKline(bar, interval);
        const update: KlineUpdate = {
          symbol,
          interval,
          marketType: 'SPOT',
          kline,
          isClosed: true,
        };
        this.notifyHandlers(update);
      },
      error: (err) => {
        console.error(`[IBKlineStream] Error for ${symbol}:${interval}:`, err);
      },
    });

    this.subscriptions.set(key, {
      symbol,
      interval,
      subscription,
      reqId: 0,
    });
  }

  unsubscribe(symbol: string, interval: string): void {
    const key = this.getSubscriptionKey(symbol, interval);
    const info = this.subscriptions.get(key);

    if (info) {
      info.subscription.unsubscribe();
      this.subscriptions.delete(key);
    }
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  onKlineUpdate(handler: KlineUpdateHandler): void {
    this.handlers.add(handler);
  }

  private notifyHandlers(update: KlineUpdate): void {
    for (const handler of this.handlers) {
      try {
        handler(update);
      } catch (error) {
        console.error('[IBKlineStream] Handler error:', error);
      }
    }
  }

  async getHistoricalData(
    symbol: string,
    interval: string,
    durationStr: string,
    endDateTime?: string,
    useRTH = false
  ): Promise<Kline[]> {
    if (!this.connectionManager.isConnected) {
      await this.connectionManager.connect();
    }

    const contract = this.createContract(symbol);
    const barSize = mapIntervalToBarSize(interval);

    const bars = await this.connectionManager.client.getHistoricalData(
      contract,
      endDateTime,
      durationStr,
      barSize,
      WhatToShow.TRADES,
      useRTH ? 1 : 0,
      1
    );

    return bars.map((bar) => mapIBBarToKline(bar, interval));
  }
}
