import type { Kline, MarketType, MomentumTimingResult } from '@marketmind/types';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { klines } from '../db/schema';
import { mapDbKlinesReversed } from '../utils/kline-mapper';
import { logger } from './logger';
import { checkAdxCondition, type AdxFilterResult } from '../utils/filters/adx-filter';
import { checkBtcCorrelation, type BtcCorrelationResult } from '../utils/filters/btc-correlation-filter';
import { checkMomentumTiming } from '../utils/filters/momentum-timing-filter';
import { checkVolumeCondition, type VolumeFilterResult } from '../utils/filters/volume-filter';
import { checkTrendCondition, type TrendFilterResult } from '../utils/filters/trend-filter';

const MIN_KLINES_FOR_VALIDATION = 100;

export interface FilterConfig {
  useBtcCorrelationFilter?: boolean;
  useVolumeFilter?: boolean;
  useMomentumTimingFilter?: boolean;
  useAdxFilter?: boolean;
  useTrendFilter?: boolean;
  useConfluenceScoring?: boolean;
  confluenceMinScore?: number;
}

export interface FilterValidationResult {
  symbol: string;
  wouldPassFilters: boolean;
  confluenceScore: number;
  passedFilters: string[];
  failingFilters: string[];
  filterResults: {
    btcCorrelation?: { passed: boolean; reason?: string; result?: BtcCorrelationResult };
    volume?: { passed: boolean; result?: VolumeFilterResult };
    momentumTiming?: { passed: boolean; reason?: string; result?: MomentumTimingResult };
    adx?: { passed: boolean; reason?: string; result?: AdxFilterResult };
    trend?: { passed: boolean; result?: TrendFilterResult };
  };
}

export interface FilterPreValidatorConfig {
  interval: string;
  marketType: MarketType;
  filters: FilterConfig;
}

export class FilterPreValidator {
  private btcKlinesCache: { klines: Kline[]; timestamp: number } | null = null;
  private btcCacheTTL = 60000;

  async validateSymbol(
    symbol: string,
    direction: 'LONG' | 'SHORT',
    config: FilterPreValidatorConfig
  ): Promise<FilterValidationResult> {
    const dbKlines = await db.query.klines.findMany({
      where: and(
        eq(klines.symbol, symbol),
        eq(klines.interval, config.interval),
        eq(klines.marketType, config.marketType)
      ),
      orderBy: [desc(klines.openTime)],
      limit: MIN_KLINES_FOR_VALIDATION,
    });

    if (dbKlines.length < MIN_KLINES_FOR_VALIDATION) {
      return {
        symbol,
        wouldPassFilters: false,
        confluenceScore: 0,
        passedFilters: [],
        failingFilters: ['insufficient_data'],
        filterResults: {},
      };
    }

    const klinesData = mapDbKlinesReversed(dbKlines);
    const passedFilters: string[] = [];
    const failingFilters: string[] = [];
    const filterResults: FilterValidationResult['filterResults'] = {};

    if (config.filters.useBtcCorrelationFilter && symbol !== 'BTCUSDT') {
      const btcKlines = await this.getBtcKlines(config.interval);
      const btcResult = checkBtcCorrelation(btcKlines, direction, symbol);
      filterResults.btcCorrelation = {
        passed: btcResult.isAllowed,
        reason: btcResult.reason,
        result: btcResult
      };
      if (btcResult.isAllowed) {
        passedFilters.push('btcCorrelation');
      } else {
        failingFilters.push('btcCorrelation');
      }
    }

    if (config.filters.useVolumeFilter) {
      const volumeResult = checkVolumeCondition(klinesData, direction, 'breakout');
      filterResults.volume = { passed: volumeResult.isAllowed, result: volumeResult };
      if (volumeResult.isAllowed) {
        passedFilters.push('volume');
      } else {
        failingFilters.push('volume');
      }
    }

    if (config.filters.useMomentumTimingFilter) {
      const momentumResult = checkMomentumTiming(klinesData, direction);
      filterResults.momentumTiming = {
        passed: momentumResult.isAllowed,
        reason: momentumResult.reason,
        result: momentumResult
      };
      if (momentumResult.isAllowed) {
        passedFilters.push('momentumTiming');
      } else {
        failingFilters.push('momentumTiming');
      }
    }

    if (config.filters.useAdxFilter) {
      const adxResult = checkAdxCondition(klinesData, direction);
      filterResults.adx = {
        passed: adxResult.isAllowed,
        reason: adxResult.reason,
        result: adxResult
      };
      if (adxResult.isAllowed) {
        passedFilters.push('adx');
      } else {
        failingFilters.push('adx');
      }
    }

    if (config.filters.useTrendFilter) {
      const trendResult = checkTrendCondition(klinesData, direction);
      filterResults.trend = { passed: trendResult.isAllowed, result: trendResult };
      if (trendResult.isAllowed) {
        passedFilters.push('trend');
      } else {
        failingFilters.push('trend');
      }
    }

    const totalFilters = passedFilters.length + failingFilters.length;
    const confluenceScore = totalFilters > 0
      ? (passedFilters.length / totalFilters) * 100
      : 100;

    let wouldPassFilters = failingFilters.length === 0;

    if (config.filters.useConfluenceScoring) {
      const minScore = config.filters.confluenceMinScore ?? 60;
      wouldPassFilters = confluenceScore >= minScore;
    }

    return {
      symbol,
      wouldPassFilters,
      confluenceScore,
      passedFilters,
      failingFilters,
      filterResults,
    };
  }

  async validateSymbols(
    symbols: string[],
    direction: 'LONG' | 'SHORT',
    config: FilterPreValidatorConfig
  ): Promise<Map<string, FilterValidationResult>> {
    const results = new Map<string, FilterValidationResult>();

    const validationPromises = symbols.map(async (symbol) => {
      try {
        const result = await this.validateSymbol(symbol, direction, config);
        results.set(symbol, result);
      } catch (error) {
        logger.warn({ symbol, error }, '[FilterPreValidator] Failed to validate symbol');
        results.set(symbol, {
          symbol,
          wouldPassFilters: false,
          confluenceScore: 0,
          passedFilters: [],
          failingFilters: ['error'],
          filterResults: {},
        });
      }
    });

    await Promise.all(validationPromises);
    return results;
  }

  private async getBtcKlines(interval: string): Promise<Kline[]> {
    const now = Date.now();
    if (this.btcKlinesCache && now - this.btcKlinesCache.timestamp < this.btcCacheTTL) {
      return this.btcKlinesCache.klines;
    }

    const btcDbKlines = await db.query.klines.findMany({
      where: and(eq(klines.symbol, 'BTCUSDT'), eq(klines.interval, interval)),
      orderBy: [desc(klines.openTime)],
      limit: 100,
    });

    const btcKlinesData = mapDbKlinesReversed(btcDbKlines);
    this.btcKlinesCache = { klines: btcKlinesData, timestamp: now };
    return btcKlinesData;
  }

  clearCache(): void {
    this.btcKlinesCache = null;
  }
}

let filterPreValidatorInstance: FilterPreValidator | null = null;

export const getFilterPreValidator = (): FilterPreValidator => {
  if (!filterPreValidatorInstance) {
    filterPreValidatorInstance = new FilterPreValidator();
  }
  return filterPreValidatorInstance;
};
