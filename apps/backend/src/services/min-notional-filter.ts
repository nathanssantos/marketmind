import type { MarketType } from '@marketmind/types';
import { TRADING_DEFAULTS } from '@marketmind/types';
import { TIME_MS } from '../constants';
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
}

export interface CapitalRequirement {
  walletBalance: number;
  leverage: number;
  activeWatchersCount: number;
  exposureMultiplier: number;
}

export class MinNotionalFilterService {
  private futuresFiltersCache: CacheEntry<Map<string, SymbolFilters>> | null = null;
  private spotFiltersCache: CacheEntry<Map<string, SymbolFilters>> | null = null;
  private cacheTTL = TIME_MS.HOUR;

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
      const response = await fetch(`${FUTURES_BASE_URL}/fapi/v1/exchangeInfo`);
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
      const response = await fetch(`${SPOT_BASE_URL}/api/v3/exchangeInfo`);
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

  calculateCapitalPerWatcher(req: CapitalRequirement): number {
    const { walletBalance, leverage, activeWatchersCount, exposureMultiplier } = req;

    const availableCapital = walletBalance * leverage;

    if (activeWatchersCount <= 0) {
      return availableCapital * (TRADING_DEFAULTS.MAX_POSITION_SIZE_PERCENT / 100);
    }

    const exposurePerWatcher = Math.min((100 * exposureMultiplier) / activeWatchersCount, 100);
    return (availableCapital * exposurePerWatcher) / 100;
  }

  async filterSymbolsByCapital(
    symbols: string[],
    capitalReq: CapitalRequirement,
    marketType: MarketType
  ): Promise<CapitalFilterResult> {
    const filters = await this.getSymbolFilters(marketType);
    const capitalPerWatcher = this.calculateCapitalPerWatcher(capitalReq);

    const eligible: string[] = [];
    const filtered: string[] = [];
    const filterReasons = new Map<string, string>();

    for (const symbol of symbols) {
      const symbolFilter = filters.get(symbol);

      if (!symbolFilter) {
        eligible.push(symbol);
        continue;
      }

      const safetyMargin = 1.1;
      const requiredCapital = symbolFilter.minNotional * safetyMargin;

      if (capitalPerWatcher >= requiredCapital) {
        eligible.push(symbol);
      } else {
        filtered.push(symbol);
        filterReasons.set(
          symbol,
          `Capital per watcher (${capitalPerWatcher.toFixed(2)}) < min notional (${symbolFilter.minNotional.toFixed(2)})`
        );
      }
    }

    if (filtered.length > 0) {
      logger.info(
        {
          marketType,
          capitalPerWatcher: capitalPerWatcher.toFixed(2),
          eligibleCount: eligible.length,
          filteredCount: filtered.length,
          filteredSymbols: filtered.slice(0, 5),
        },
        '[MinNotionalFilter] Filtered symbols by capital requirement'
      );
    }

    return { eligible, filtered, filterReasons };
  }

  getMinNotionalForSymbol(symbol: string, marketType: MarketType): number {
    const cache = marketType === 'FUTURES' ? this.futuresFiltersCache : this.spotFiltersCache;
    const defaultMin = marketType === 'FUTURES' ? 5 : 10;
    return cache?.data.get(symbol)?.minNotional ?? defaultMin;
  }

  clearCache(): void {
    this.futuresFiltersCache = null;
    this.spotFiltersCache = null;
  }
}

let minNotionalFilterService: MinNotionalFilterService | null = null;

export const getMinNotionalFilterService = (): MinNotionalFilterService => {
  if (!minNotionalFilterService) {
    minNotionalFilterService = new MinNotionalFilterService();
  }
  return minNotionalFilterService;
};
