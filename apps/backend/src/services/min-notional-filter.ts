import {
    calculateAvailableCapital,
    calculateDynamicExposure,
    calculateMaxAffordableWatchers,
    calculateMaxCapitalPerPosition,
    calculateMinRequiredForSymbol,
    getDefaultMinNotional,
} from '@marketmind/risk';
import type { MarketType } from '@marketmind/types';
import { CAPITAL_RULES, TRADING_DEFAULTS } from '@marketmind/types';
import { TIME_MS } from '../constants';
import { withRetryFetch } from '../utils/retry';
import { logger } from './logger';

const FUTURES_BASE_URL = 'https://fapi.binance.com';
const SPOT_BASE_URL = 'https://api.binance.com';

interface SymbolFilters {
  minNotional: number;
  minQty: number;
  stepSize: number;
  tickSize: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface CapitalFilterResult {
  eligible: string[];
  filtered: string[];
  filterReasons: Map<string, string>;
  capitalPerWatcher: number;
  maxAffordableWatchers: number;
}

export interface CapitalRequirement {
  walletBalance: number;
  leverage: number;
  targetWatchersCount: number;
  exposureMultiplier: number;
}

interface PriceCache {
  prices: Map<string, number>;
  timestamp: number;
}

export class MinNotionalFilterService {
  private futuresFiltersCache: CacheEntry<Map<string, SymbolFilters>> | null = null;
  private spotFiltersCache: CacheEntry<Map<string, SymbolFilters>> | null = null;
  private futuresPriceCache: PriceCache | null = null;
  private spotPriceCache: PriceCache | null = null;
  private cacheTTL = TIME_MS.HOUR;
  private priceCacheTTL = TIME_MS.MINUTE * 5;

  async getSymbolFilters(marketType: MarketType): Promise<Map<string, SymbolFilters>> {
    if (marketType === 'FUTURES') {
      return this.getFuturesFilters();
    }
    return this.getSpotFilters();
  }

  private async getFuturesFilters(): Promise<Map<string, SymbolFilters>> {
    if (this.futuresFiltersCache && Date.now() - this.futuresFiltersCache.timestamp < this.cacheTTL) {
      return this.futuresFiltersCache.data;
    }

    try {
      const response = await withRetryFetch(`${FUTURES_BASE_URL}/fapi/v1/exchangeInfo`);
      if (!response.ok) {
        logger.warn({ status: response.status }, '[MinNotionalFilter] Failed to fetch futures exchange info');
        return this.futuresFiltersCache?.data ?? new Map();
      }

      const data = await response.json();
      const filtersMap = new Map<string, SymbolFilters>();

      for (const symbol of data.symbols) {
        if (symbol.contractType !== 'PERPETUAL' || symbol.status !== 'TRADING') continue;

        let minNotional = 5;
        let minQty = 0;
        let stepSize = 0;
        let tickSize = 0;

        for (const filter of symbol.filters) {
          if (filter.filterType === 'MIN_NOTIONAL') {
            minNotional = parseFloat(filter.notional || filter.minNotional || '5');
          } else if (filter.filterType === 'LOT_SIZE') {
            minQty = parseFloat(filter.minQty || '0');
            stepSize = parseFloat(filter.stepSize || '0');
          } else if (filter.filterType === 'PRICE_FILTER') {
            tickSize = parseFloat(filter.tickSize || '0');
          }
        }

        filtersMap.set(symbol.symbol, { minNotional, minQty, stepSize, tickSize });
      }

      this.futuresFiltersCache = { data: filtersMap, timestamp: Date.now() };
      logger.info({ symbolCount: filtersMap.size }, '[MinNotionalFilter] Futures exchange info cached');

      return filtersMap;
    } catch (error) {
      logger.error({ error }, '[MinNotionalFilter] Error fetching futures exchange info');
      return this.futuresFiltersCache?.data ?? new Map();
    }
  }

  private async getSpotFilters(): Promise<Map<string, SymbolFilters>> {
    if (this.spotFiltersCache && Date.now() - this.spotFiltersCache.timestamp < this.cacheTTL) {
      return this.spotFiltersCache.data;
    }

    try {
      const response = await withRetryFetch(`${SPOT_BASE_URL}/api/v3/exchangeInfo`);
      if (!response.ok) {
        logger.warn({ status: response.status }, '[MinNotionalFilter] Failed to fetch spot exchange info');
        return this.spotFiltersCache?.data ?? new Map();
      }

      const data = await response.json();
      const filtersMap = new Map<string, SymbolFilters>();

      for (const symbol of data.symbols) {
        if (symbol.status !== 'TRADING') continue;
        if (!symbol.symbol.endsWith('USDT') && !symbol.symbol.endsWith('BUSD')) continue;

        let minNotional = 10;
        let minQty = 0;
        let stepSize = 0;
        let tickSize = 0;

        for (const filter of symbol.filters) {
          if (filter.filterType === 'NOTIONAL' || filter.filterType === 'MIN_NOTIONAL') {
            minNotional = parseFloat(filter.minNotional || '10');
          } else if (filter.filterType === 'LOT_SIZE') {
            minQty = parseFloat(filter.minQty || '0');
            stepSize = parseFloat(filter.stepSize || '0');
          } else if (filter.filterType === 'PRICE_FILTER') {
            tickSize = parseFloat(filter.tickSize || '0');
          }
        }

        filtersMap.set(symbol.symbol, { minNotional, minQty, stepSize, tickSize });
      }

      this.spotFiltersCache = { data: filtersMap, timestamp: Date.now() };
      logger.info({ symbolCount: filtersMap.size }, '[MinNotionalFilter] Spot exchange info cached');

      return filtersMap;
    } catch (error) {
      logger.error({ error }, '[MinNotionalFilter] Error fetching spot exchange info');
      return this.spotFiltersCache?.data ?? new Map();
    }
  }

  async getSymbolPrices(marketType: MarketType): Promise<Map<string, number>> {
    const cache = marketType === 'FUTURES' ? this.futuresPriceCache : this.spotPriceCache;
    if (cache && Date.now() - cache.timestamp < this.priceCacheTTL) {
      return cache.prices;
    }

    try {
      const baseUrl = marketType === 'FUTURES' ? FUTURES_BASE_URL : SPOT_BASE_URL;
      const endpoint = marketType === 'FUTURES' ? '/fapi/v1/ticker/price' : '/api/v3/ticker/price';
      const response = await withRetryFetch(`${baseUrl}${endpoint}`);

      if (!response.ok) {
        logger.warn({ status: response.status, marketType }, '[MinNotionalFilter] Failed to fetch prices');
        return cache?.prices ?? new Map();
      }

      const data: Array<{ symbol: string; price: string }> = await response.json();
      const pricesMap = new Map<string, number>();

      for (const ticker of data) {
        pricesMap.set(ticker.symbol, parseFloat(ticker.price));
      }

      const newCache: PriceCache = { prices: pricesMap, timestamp: Date.now() };
      if (marketType === 'FUTURES') {
        this.futuresPriceCache = newCache;
      } else {
        this.spotPriceCache = newCache;
      }

      return pricesMap;
    } catch (error) {
      logger.error({ error, marketType }, '[MinNotionalFilter] Error fetching prices');
      return cache?.prices ?? new Map();
    }
  }

  getAvailableCapital(walletBalance: number, leverage: number): number {
    return calculateAvailableCapital(walletBalance, leverage);
  }

  getMaxAffordableWatchers(
    availableCapital: number,
    exposureMultiplier: number,
    minRequiredPerPosition: number
  ): number {
    return calculateMaxAffordableWatchers(availableCapital, exposureMultiplier, minRequiredPerPosition);
  }

  getMinRequiredCapitalForSymbol(
    symbolFilter: SymbolFilters,
    price: number,
    safetyMargin: number = CAPITAL_RULES.SAFETY_MARGIN
  ): { minRequired: number; source: 'minNotional' | 'minQty' } {
    return calculateMinRequiredForSymbol(
      { minNotional: symbolFilter.minNotional, minQty: symbolFilter.minQty, price },
      safetyMargin
    );
  }

  getCapitalPerWatcher(
    availableCapital: number,
    watchersCount: number,
    exposureMultiplier: number
  ): number {
    const { maxPositionValue } = calculateDynamicExposure(
      availableCapital,
      watchersCount,
      {
        exposureMultiplier,
        maxPositionSizePercent: TRADING_DEFAULTS.MAX_POSITION_SIZE_PERCENT,
        maxConcurrentPositions: 1,
      }
    );
    return maxPositionValue;
  }

  async filterSymbolsByCapital(
    symbols: string[],
    capitalReq: CapitalRequirement,
    marketType: MarketType
  ): Promise<CapitalFilterResult> {
    const { walletBalance, leverage, targetWatchersCount, exposureMultiplier } = capitalReq;
    const filters = await this.getSymbolFilters(marketType);
    const prices = await this.getSymbolPrices(marketType);
    const availableCapital = calculateAvailableCapital(walletBalance, leverage);

    const maxCapitalPerPosition = calculateMaxCapitalPerPosition(availableCapital);
    const defaultMinNotional = getDefaultMinNotional(marketType);

    const capitalPerWatcher = this.getCapitalPerWatcher(
      availableCapital,
      targetWatchersCount,
      exposureMultiplier
    );

    const eligible: string[] = [];
    const filtered: string[] = [];
    const filterReasons = new Map<string, string>();

    for (const symbol of symbols) {
      if (eligible.length >= targetWatchersCount) {
        filtered.push(symbol);
        filterReasons.set(symbol, `Reached target count (${targetWatchersCount})`);
        continue;
      }

      const symbolFilter = filters.get(symbol);
      const price = prices.get(symbol);

      if (!symbolFilter) {
        eligible.push(symbol);
        continue;
      }

      const { minRequired, source } = this.getMinRequiredCapitalForSymbol(
        symbolFilter,
        price ?? 0
      );

      if (minRequired > maxCapitalPerPosition) {
        filtered.push(symbol);
        filterReasons.set(
          symbol,
          `Min required ($${minRequired.toFixed(2)}) exceeds 1/${CAPITAL_RULES.MAX_POSITION_CAPITAL_RATIO} of capital ($${maxCapitalPerPosition.toFixed(2)}) [source: ${source}]`
        );
        continue;
      }

      if (capitalPerWatcher >= minRequired) {
        eligible.push(symbol);
      } else {
        filtered.push(symbol);
        const minQtyValue = symbolFilter.minQty * (price ?? 0);
        filterReasons.set(
          symbol,
          `Capital per watcher ($${capitalPerWatcher.toFixed(2)}) < required ($${minRequired.toFixed(2)}) [source: ${source}, minNotional: $${symbolFilter.minNotional}, minQty: ${symbolFilter.minQty} @ $${price?.toFixed(2) ?? '?'} = $${minQtyValue.toFixed(2)}]`
        );
      }
    }

    const maxAffordableWatchers = calculateMaxAffordableWatchers(
      availableCapital,
      exposureMultiplier,
      Math.max(defaultMinNotional, maxCapitalPerPosition / CAPITAL_RULES.SAFETY_MARGIN)
    );

    logger.info(
      {
        marketType,
        walletBalance,
        leverage,
        availableCapital: availableCapital.toFixed(2),
        targetWatchersCount,
        maxAffordableWatchers,
        capitalPerWatcher: capitalPerWatcher.toFixed(2),
        maxCapitalPerPosition: maxCapitalPerPosition.toFixed(2),
        eligibleCount: eligible.length,
        filteredCount: filtered.length,
      },
      `[MinNotionalFilter] Capital filter applied (1/${CAPITAL_RULES.MAX_POSITION_CAPITAL_RATIO} rule)`
    );

    return { eligible, filtered, filterReasons, capitalPerWatcher, maxAffordableWatchers };
  }

  getMinNotionalForSymbol(symbol: string, marketType: MarketType): number {
    const cache = marketType === 'FUTURES' ? this.futuresFiltersCache : this.spotFiltersCache;
    return cache?.data.get(symbol)?.minNotional ?? getDefaultMinNotional(marketType);
  }

  getSymbolFilterDetails(symbol: string, marketType: MarketType): SymbolFilters | null {
    const cache = marketType === 'FUTURES' ? this.futuresFiltersCache : this.spotFiltersCache;
    return cache?.data.get(symbol) ?? null;
  }

  async validateQuantityAgainstMinQty(
    symbol: string,
    quantity: number,
    entryPrice: number,
    marketType: MarketType
  ): Promise<{ isValid: boolean; reason?: string; minQty?: number; minValue?: number }> {
    const filters = await this.getSymbolFilters(marketType);
    const symbolFilter = filters.get(symbol);

    if (!symbolFilter) {
      return { isValid: true };
    }

    const { minQty, stepSize, minNotional } = symbolFilter;

    if (minQty > 0 && quantity < minQty) {
      const minValueRequired = minQty * entryPrice;
      return {
        isValid: false,
        reason: `Quantity ${quantity.toFixed(6)} below minQty ${minQty} for ${symbol}. Need at least $${minValueRequired.toFixed(2)} per position.`,
        minQty,
        minValue: minValueRequired,
      };
    }

    if (stepSize > 0) {
      const adjustedQty = Math.floor(quantity / stepSize) * stepSize;
      if (adjustedQty < minQty) {
        const minValueRequired = minQty * entryPrice;
        return {
          isValid: false,
          reason: `Quantity ${quantity.toFixed(6)} rounds to ${adjustedQty.toFixed(6)} (stepSize: ${stepSize}), below minQty ${minQty}. Need at least $${minValueRequired.toFixed(2)} per position.`,
          minQty,
          minValue: minValueRequired,
        };
      }
    }

    const notionalValue = quantity * entryPrice;
    if (notionalValue < minNotional) {
      return {
        isValid: false,
        reason: `Notional value $${notionalValue.toFixed(2)} below minNotional $${minNotional} for ${symbol}.`,
        minQty,
        minValue: minNotional,
      };
    }

    return { isValid: true, minQty, minValue: minNotional };
  }

  clearCache(): void {
    this.futuresFiltersCache = null;
    this.spotFiltersCache = null;
    this.futuresPriceCache = null;
    this.spotPriceCache = null;
  }

  async calculateMaxWatchersFromSymbols(
    symbols: string[],
    walletBalance: number,
    leverage: number,
    exposureMultiplier: number,
    marketType: MarketType
  ): Promise<{ maxWatchers: number; capitalPerWatcher: number; eligibleSymbols: string[]; excludedSymbols: Map<string, string> }> {
    const filters = await this.getSymbolFilters(marketType);
    const prices = await this.getSymbolPrices(marketType);
    const availableCapital = walletBalance * leverage * exposureMultiplier;
    const maxCapitalPerPosition = availableCapital / CAPITAL_RULES.MAX_POSITION_CAPITAL_RATIO;

    logger.info({
      walletBalance,
      leverage,
      exposureMultiplier,
      availableCapital,
      maxCapitalPerPosition,
      symbolsCount: symbols.length,
      filtersCount: filters.size,
      pricesCount: prices.size,
    }, '[MinNotionalFilter] calculateMaxWatchersFromSymbols input');

    const eligibleSymbols: string[] = [];
    const excludedSymbols = new Map<string, string>();
    const eligibleMinNotionals: number[] = [];

    for (const symbol of symbols) {
      const symbolFilter = filters.get(symbol);
      const price = prices.get(symbol) ?? 0;

      let minRequired: number;
      if (!symbolFilter) {
        minRequired = getDefaultMinNotional(marketType) * CAPITAL_RULES.SAFETY_MARGIN;
      } else {
        const result = this.getMinRequiredCapitalForSymbol(symbolFilter, price);
        minRequired = result.minRequired;
      }

      if (minRequired > maxCapitalPerPosition) {
        excludedSymbols.set(symbol, `Min required $${minRequired.toFixed(2)} > 1/${CAPITAL_RULES.MAX_POSITION_CAPITAL_RATIO} of capital $${maxCapitalPerPosition.toFixed(2)}`);
        continue;
      }

      eligibleSymbols.push(symbol);
      eligibleMinNotionals.push(minRequired);
    }

    eligibleMinNotionals.sort((a, b) => a - b);

    let maxWatchers = 0;
    let totalRequired = 0;

    for (const minRequired of eligibleMinNotionals) {
      totalRequired += minRequired;
      if (totalRequired <= availableCapital) {
        maxWatchers++;
      } else {
        break;
      }
    }

    maxWatchers = Math.max(1, Math.min(maxWatchers, eligibleSymbols.length));
    const capitalPerWatcher = maxWatchers > 0 ? availableCapital / maxWatchers : availableCapital;

    logger.info({
      eligibleCount: eligibleSymbols.length,
      excludedCount: excludedSymbols.size,
      maxWatchers,
      capitalPerWatcher,
      firstExcluded: excludedSymbols.size > 0 ? Array.from(excludedSymbols.entries()).slice(0, 3) : [],
    }, '[MinNotionalFilter] calculateMaxWatchersFromSymbols result');

    return { maxWatchers, capitalPerWatcher, eligibleSymbols, excludedSymbols };
  }
}

let minNotionalFilterService: MinNotionalFilterService | null = null;

export const getMinNotionalFilterService = (): MinNotionalFilterService => {
  if (!minNotionalFilterService) {
    minNotionalFilterService = new MinNotionalFilterService();
  }
  return minNotionalFilterService;
};
