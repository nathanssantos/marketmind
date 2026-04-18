import { SecType } from '@stoqey/ib';
import type { TickType } from '@stoqey/ib/dist/api/market/tickType';
import type { Contract, MarketDataTicks } from '@stoqey/ib';
import type { IBConnectionManager} from './connection-manager';
import { getDefaultConnectionManager } from './connection-manager';
import type { ShortabilityInfo, ShortDifficulty } from './types';

const SHORTABLE_GENERIC_TICK = '236';

const SHORTABILITY_THRESHOLDS = {
  UNAVAILABLE: 1.5,
  HARD_TO_BORROW: 2.5,
} as const;

const TICK_TYPE_SHORTABLE = 46;

const getTickValue = (ticks: MarketDataTicks, tickType: number): number | undefined => {
  return ticks.get(tickType as TickType)?.value;
};

const classifyShortability = (shortableValue: number): ShortDifficulty => {
  if (shortableValue <= SHORTABILITY_THRESHOLDS.UNAVAILABLE) {
    return 'unavailable';
  }
  if (shortableValue <= SHORTABILITY_THRESHOLDS.HARD_TO_BORROW) {
    return 'hard';
  }
  return 'easy';
};

const estimateSharesAvailable = (shortableValue: number): number => {
  if (shortableValue <= SHORTABILITY_THRESHOLDS.UNAVAILABLE) {
    return 0;
  }
  if (shortableValue <= SHORTABILITY_THRESHOLDS.HARD_TO_BORROW) {
    return Math.floor((shortableValue - 1.5) * 1000);
  }
  return 1000 + Math.floor((shortableValue - 2.5) * 10000);
};

export class ShortableChecker {
  private connectionManager: IBConnectionManager;
  private cache: Map<string, { info: ShortabilityInfo; timestamp: number }> = new Map();
  private readonly cacheTtlMs = 60_000;

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

  async checkShortability(symbol: string): Promise<ShortabilityInfo> {
    const upperSymbol = symbol.toUpperCase();

    const cached = this.cache.get(upperSymbol);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.info;
    }

    if (!this.connectionManager.isConnected) {
      await this.connectionManager.connect();
    }

    const contract = this.createContract(upperSymbol);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout checking shortability for ${upperSymbol}`));
      }, 10_000);

      const observable = this.connectionManager.client.getMarketData(
        contract,
        SHORTABLE_GENERIC_TICK,
        true,
        false
      );

      const subscription = observable.subscribe({
        next: (marketDataUpdate) => {
          const ticks = marketDataUpdate.all;
          const shortableValue = getTickValue(ticks, TICK_TYPE_SHORTABLE) ?? 0;

          const difficulty = classifyShortability(shortableValue);
          const sharesAvailable = estimateSharesAvailable(shortableValue);

          const info: ShortabilityInfo = {
            symbol: upperSymbol,
            available: difficulty !== 'unavailable',
            difficulty,
            sharesAvailable,
            borrowFeeRate: undefined,
            rebateRate: undefined,
          };

          this.cache.set(upperSymbol, { info, timestamp: Date.now() });

          clearTimeout(timeout);
          subscription.unsubscribe();
          resolve(info);
        },
        error: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });
    });
  }

  async checkMultipleShortability(symbols: string[]): Promise<Map<string, ShortabilityInfo>> {
    const results = new Map<string, ShortabilityInfo>();

    const promises = symbols.map(async (symbol) => {
      try {
        const info = await this.checkShortability(symbol);
        results.set(symbol.toUpperCase(), info);
      } catch (error) {
        console.error(`[ShortableChecker] Error checking ${symbol}:`, error);
        results.set(symbol.toUpperCase(), {
          symbol: symbol.toUpperCase(),
          available: false,
          difficulty: 'unavailable',
          sharesAvailable: 0,
        });
      }
    });

    await Promise.all(promises);
    return results;
  }

  isShortable(symbol: string): boolean {
    const cached = this.cache.get(symbol.toUpperCase());
    return cached?.info.available ?? false;
  }

  getShortDifficulty(symbol: string): ShortDifficulty | undefined {
    const cached = this.cache.get(symbol.toUpperCase());
    return cached?.info.difficulty;
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearSymbolCache(symbol: string): void {
    this.cache.delete(symbol.toUpperCase());
  }
}

export const shortableChecker = new ShortableChecker();
