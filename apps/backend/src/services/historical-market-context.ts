import type { MarketContextData } from '@marketmind/types';
import { logger } from './logger';


interface FundingRateEntry {
  symbol: string;
  fundingRate: number;
  fundingTime: number;
}

interface HistoricalMarketContextConfig {
  fearGreed: {
    enabled: boolean;
    thresholdLow: number;
    thresholdHigh: number;
    action: 'block' | 'reduce_size' | 'warn_only';
    sizeReduction?: number;
  };
  fundingRate: {
    enabled: boolean;
    threshold: number;
    action: 'block' | 'penalize' | 'warn_only';
    penalty?: number;
  };
}

export interface HistoricalMarketContextResult {
  shouldTrade: boolean;
  reason?: string;
  positionSizeMultiplier: number;
  confidenceAdjustment: number;
  warnings: string[];
  appliedFilters: string[];
}

const DEFAULT_CONFIG: HistoricalMarketContextConfig = {
  fearGreed: {
    enabled: true,
    thresholdLow: 20,
    thresholdHigh: 80,
    action: 'reduce_size',
    sizeReduction: 50,
  },
  fundingRate: {
    enabled: true,
    threshold: 0.05,
    action: 'penalize',
    penalty: 20,
  },
};

export class HistoricalMarketContextService {
  private fearGreedCache: Map<string, number> = new Map();
  private fundingRateCache: Map<string, Map<number, number>> = new Map();
  private dataLoaded: boolean = false;
  private config: HistoricalMarketContextConfig;

  constructor(config?: Partial<HistoricalMarketContextConfig>) {
    this.config = {
      fearGreed: { ...DEFAULT_CONFIG.fearGreed, ...config?.fearGreed },
      fundingRate: { ...DEFAULT_CONFIG.fundingRate, ...config?.fundingRate },
    };
  }

  async initialize(startDate: Date, endDate: Date, symbols: string[]): Promise<void> {
    logger.info({ startDate, endDate, symbols }, 'Initializing historical market context data');

    await Promise.all([
      this.fetchHistoricalFearGreed(startDate, endDate),
      ...symbols.map(symbol => this.fetchHistoricalFundingRates(symbol, startDate, endDate)),
    ]);

    this.dataLoaded = true;
    logger.info({
      fearGreedEntries: this.fearGreedCache.size,
      fundingRateSymbols: this.fundingRateCache.size,
    }, 'Historical market context data loaded');
  }

  private async fetchHistoricalFearGreed(startDate: Date, endDate: Date): Promise<void> {
    try {
      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(endDate.getTime() / 1000);
      const daysDiff = Math.ceil((endTimestamp - startTimestamp) / 86400);
      const limit = Math.min(daysDiff + 30, 2000);

      const response = await fetch(`https://api.alternative.me/fng/?limit=${limit}&format=json`);
      if (!response.ok) {
        logger.warn({ status: response.status }, 'Failed to fetch Fear/Greed index history');
        return;
      }

      const data = await response.json();
      const entries = data?.data as Array<{ value: string; timestamp: string }> | undefined;

      if (!entries || entries.length === 0) {
        logger.warn('No Fear/Greed data returned from API');
        return;
      }

      for (const entry of entries) {
        const timestamp = parseInt(entry.timestamp, 10) * 1000;
        if (timestamp >= startDate.getTime() && timestamp <= endDate.getTime()) {
          const dateKey = this.getDateKey(timestamp);
          this.fearGreedCache.set(dateKey, parseInt(entry.value, 10));
        }
      }

      logger.info({ entries: this.fearGreedCache.size }, 'Fear/Greed historical data loaded');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error fetching Fear/Greed history');
    }
  }

  private async fetchHistoricalFundingRates(symbol: string, startDate: Date, endDate: Date): Promise<void> {
    try {
      const symbolCache = new Map<number, number>();
      let currentStart = startDate.getTime();
      const endTime = endDate.getTime();

      while (currentStart < endTime) {
        const url = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&startTime=${currentStart}&endTime=${endTime}&limit=1000`;
        const response = await fetch(url);

        if (!response.ok) {
          if (response.status === 429) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          logger.warn({ symbol, status: response.status }, 'Failed to fetch funding rate history');
          break;
        }

        const data = await response.json() as FundingRateEntry[];

        if (!data || data.length === 0) break;

        for (const entry of data) {
          symbolCache.set(entry.fundingTime, parseFloat(String(entry.fundingRate)) * 100);
        }

        const lastEntry = data[data.length - 1];
        if (lastEntry) {
          currentStart = lastEntry.fundingTime + 1;
        } else {
          break;
        }

        if (data.length < 1000) break;
      }

      this.fundingRateCache.set(symbol, symbolCache);
      logger.info({ symbol, entries: symbolCache.size }, 'Funding rate historical data loaded');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), symbol }, 'Error fetching funding rate history');
    }
  }

  private getDateKey(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  private findNearestFundingRate(symbol: string, timestamp: number): number | undefined {
    const symbolCache = this.fundingRateCache.get(symbol);
    if (!symbolCache || symbolCache.size === 0) return undefined;

    const times = Array.from(symbolCache.keys()).sort((a, b) => a - b);
    let nearest = times[0];
    let minDiff = Math.abs(timestamp - nearest!);

    for (const time of times) {
      const diff = Math.abs(timestamp - time);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = time;
      }
      if (time > timestamp) break;
    }

    return nearest !== undefined ? symbolCache.get(nearest) : undefined;
  }

  getMarketContextAtTimestamp(timestamp: number, symbol: string): MarketContextData {
    const dateKey = this.getDateKey(timestamp);
    const fearGreedIndex = this.fearGreedCache.get(dateKey) ?? 50;
    const fundingRate = this.findNearestFundingRate(symbol, timestamp);

    return {
      fearGreedIndex,
      fundingRate,
      btcDominance: 50,
      btcDominanceChange24h: undefined,
      openInterest: undefined,
      openInterestChange24h: undefined,
      timestamp: new Date(timestamp),
    };
  }

  evaluateSetup(
    timestamp: number,
    symbol: string,
    direction: 'LONG' | 'SHORT'
  ): HistoricalMarketContextResult {
    const result: HistoricalMarketContextResult = {
      shouldTrade: true,
      positionSizeMultiplier: 1.0,
      confidenceAdjustment: 0,
      warnings: [],
      appliedFilters: [],
    };

    if (!this.dataLoaded) return result;

    const context = this.getMarketContextAtTimestamp(timestamp, symbol);
    const isLong = direction === 'LONG';

    if (this.config.fearGreed.enabled) {
      const { thresholdLow, thresholdHigh, action, sizeReduction } = this.config.fearGreed;

      if (context.fearGreedIndex <= thresholdLow) {
        result.appliedFilters.push(`fear_greed_extreme_fear (${context.fearGreedIndex})`);
        this.applyAction(action, sizeReduction ?? 50, 0, result, `Extreme fear (${context.fearGreedIndex})`);
      }

      if (context.fearGreedIndex >= thresholdHigh && isLong) {
        result.appliedFilters.push(`fear_greed_extreme_greed (${context.fearGreedIndex})`);
        this.applyAction(action, sizeReduction ?? 50, 0, result, `Extreme greed on LONG (${context.fearGreedIndex})`);
      }
    }

    if (this.config.fundingRate.enabled && context.fundingRate !== undefined) {
      const { threshold, action, penalty } = this.config.fundingRate;

      if (context.fundingRate > threshold && isLong) {
        result.appliedFilters.push(`funding_rate_high_long (${context.fundingRate.toFixed(4)}%)`);
        this.applyAction(action, 0, penalty ?? 20, result, `High funding rate on LONG (${context.fundingRate.toFixed(4)}%)`);
      }

      if (context.fundingRate < -threshold && !isLong) {
        result.appliedFilters.push(`funding_rate_low_short (${context.fundingRate.toFixed(4)}%)`);
        this.applyAction(action, 0, penalty ?? 20, result, `Low funding rate on SHORT (${context.fundingRate.toFixed(4)}%)`);
      }
    }

    return result;
  }

  private applyAction(
    action: 'block' | 'reduce_size' | 'penalize' | 'warn_only',
    sizeReduction: number,
    confidencePenalty: number,
    result: HistoricalMarketContextResult,
    reason: string
  ): void {
    switch (action) {
      case 'block':
        result.shouldTrade = false;
        result.reason = reason;
        break;
      case 'reduce_size':
        result.positionSizeMultiplier *= (100 - sizeReduction) / 100;
        result.warnings.push(reason);
        break;
      case 'penalize':
        result.confidenceAdjustment -= confidencePenalty;
        result.warnings.push(reason);
        break;
      case 'warn_only':
        result.warnings.push(reason);
        break;
    }
  }

  isDataLoaded(): boolean {
    return this.dataLoaded;
  }

  getStats(): { fearGreedEntries: number; fundingRateSymbols: number; fundingRateEntries: number } {
    let totalFundingEntries = 0;
    for (const cache of this.fundingRateCache.values()) {
      totalFundingEntries += cache.size;
    }

    return {
      fearGreedEntries: this.fearGreedCache.size,
      fundingRateSymbols: this.fundingRateCache.size,
      fundingRateEntries: totalFundingEntries,
    };
  }

  clear(): void {
    this.fearGreedCache.clear();
    this.fundingRateCache.clear();
    this.dataLoaded = false;
  }
}

export const historicalMarketContextService = new HistoricalMarketContextService();
