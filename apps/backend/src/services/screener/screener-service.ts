import type {
  Kline,
  ScreenerConfig,
  ScreenerFilterCondition,
  ScreenerResponse,
  ScreenerResultRow,
  ScreenerSortField,
} from '@marketmind/types';
import { and, eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { SCREENER } from '../../constants/screener';
import { db } from '../../db/client';
import { klines as klinesTable } from '../../db/schema';
import { mapDbKlinesReversed } from '../../utils/kline-mapper';
import { getMarketCapDataService, type TopCoin } from '../market-cap-data';
import { get24hrTickerData, type Ticker24hr } from '../binance-exchange-info';
import { smartBackfillKlines } from '../binance-historical';
import { smartBackfillIBKlines } from '../ib-historical';
import {
  IndicatorEngine,
  isTickerBasedIndicator,
  type ScreenerTickerData as TickerData,
  type ScreenerExtraData as ExtraData,
} from '../indicator-engine';
import { evaluateFilters, needsPreviousValues, getLookbackBars } from './filter-evaluator';

interface CacheEntry {
  response: ScreenerResponse;
  timestamp: number;
}

const hashConfig = (config: ScreenerConfig): string => {
  const normalized = JSON.stringify({
    assetClass: config.assetClass,
    marketType: config.marketType,
    exchange: config.exchange,
    interval: config.interval,
    filters: config.filters,
    sortBy: config.sortBy,
    sortDirection: config.sortDirection,
    limit: config.limit,
    presetId: config.presetId,
  });
  return createHash('md5').update(normalized).digest('hex');
};

const toTickerData = (ticker: Ticker24hr): TickerData => ({
  priceChange: ticker.priceChange,
  priceChangePercent: ticker.priceChangePercent,
  lastPrice: ticker.lastPrice,
  volume: ticker.volume,
  quoteVolume: ticker.quoteVolume,
});

const getParamsMap = (conditions: ScreenerFilterCondition[]): Record<string, Record<string, number>> => {
  const map: Record<string, Record<string, number>> = {};
  for (const cond of conditions) {
    if (cond.indicatorParams) map[cond.indicator] = { ...map[cond.indicator], ...cond.indicatorParams };
    if (cond.compareIndicator && cond.compareIndicatorParams) {
      map[cond.compareIndicator] = { ...map[cond.compareIndicator], ...cond.compareIndicatorParams };
    }
  }
  return map;
};

const getRequiredIndicatorIds = (conditions: ScreenerFilterCondition[]): string[] => {
  const ids = new Set<string>();
  for (const cond of conditions) {
    ids.add(cond.indicator);
    if (cond.compareIndicator) ids.add(cond.compareIndicator);
  }
  ids.add('RSI');
  ids.add('ADX');
  ids.add('ATR_PERCENT');
  ids.add('VOLUME_RATIO');
  return [...ids];
};

const getSortValue = (row: ScreenerResultRow, field: ScreenerSortField): number => {
  switch (field) {
    case 'symbol': return 0;
    case 'price': return row.price;
    case 'priceChange24h': return row.priceChangePercent24h;
    case 'volume24h': return row.volume24h;
    case 'marketCapRank': return row.marketCapRank ?? 9999;
    case 'rsi': return row.indicators['RSI'] ?? 50;
    case 'adx': return row.indicators['ADX'] ?? 0;
    case 'atrPercent': return row.indicators['ATR_PERCENT'] ?? 0;
    case 'compositeScore': return row.compositeScore;
    case 'volumeRatio': return row.indicators['VOLUME_RATIO'] ?? 0;
    case 'quoteVolume24h': return row.quoteVolume24h;
    default: return 0;
  }
};

const computeCompositeScore = (
  indicators: Record<string, number | null>,
  matchedFilters: number,
  totalFilters: number,
): number => {
  let score = 0;
  const filterScore = totalFilters > 0 ? (matchedFilters / totalFilters) * 40 : 20;
  score += filterScore;

  const rsi = indicators['RSI'];
  if (rsi !== null && rsi !== undefined) {
    if (rsi >= 40 && rsi <= 60) score += 10;
    else if (rsi >= 30 && rsi <= 70) score += 15;
    else score += 5;
  }

  const adx = indicators['ADX'];
  if (adx !== null && adx !== undefined && adx > 20) score += Math.min(20, adx * 0.5);

  const volRatio = indicators['VOLUME_RATIO'];
  if (volRatio !== null && volRatio !== undefined && volRatio > 1) score += Math.min(20, volRatio * 5);

  return Math.min(100, score);
};

const fetchKlinesFromDb = async (
  symbol: string,
  interval: string,
  marketType: 'SPOT' | 'FUTURES',
  limit: number,
): Promise<Kline[]> => {
  const dbKlines = await db
    .select()
    .from(klinesTable)
    .where(
      and(
        eq(klinesTable.symbol, symbol),
        eq(klinesTable.interval, interval),
        eq(klinesTable.marketType, marketType),
      ),
    )
    .orderBy(sql`${klinesTable.openTime} DESC`)
    .limit(limit);

  return mapDbKlinesReversed(dbKlines);
};

const pLimit = (concurrency: number) => {
  let active = 0;
  const queue: (() => void)[] = [];

  const next = () => {
    if (queue.length > 0 && active < concurrency) {
      active++;
      queue.shift()!();
    }
  };

  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        fn()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            active--;
            next();
          });
      };

      if (active < concurrency) {
        active++;
        run();
      } else {
        queue.push(run);
      }
    });
};

export class ScreenerService {
  private cache = new Map<string, CacheEntry>();

  clearCache(): void {
    this.cache.clear();
  }

  async runScreener(config: ScreenerConfig): Promise<ScreenerResponse> {
    const startTime = Date.now();
    const cacheKey = hashConfig(config);

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SCREENER.RESULTS_CACHE_TTL_MS) {
      return { ...cached.response, cachedAt: cached.timestamp };
    }

    const limit = Math.min(config.limit ?? SCREENER.DEFAULT_SCAN_LIMIT, SCREENER.MAX_SYMBOLS_PER_SCAN);
    const interval = config.interval ?? SCREENER.DEFAULT_INTERVAL;
    const marketType = config.marketType ?? 'FUTURES';
    const isIB = config.exchange === 'INTERACTIVE_BROKERS' || config.assetClass === 'STOCKS';

    const { symbols, topCoinMap, tickerMap, btcKlines } = await this.fetchMarketData(
      config,
      limit,
      marketType,
      isIB,
      interval,
    );

    const tickerFilteredSymbols = this.preFilterByTicker(symbols, config.filters, tickerMap, topCoinMap);

    const klineMap = await this.fetchKlinesBatch(tickerFilteredSymbols, interval, marketType, isIB);

    const paramsMap = getParamsMap(config.filters);
    const requiredIds = getRequiredIndicatorIds(config.filters);
    const requiresPrev = needsPreviousValues(config.filters);
    const lookbackBars = getLookbackBars(config.filters);

    const results: ScreenerResultRow[] = [];
    const engine = new IndicatorEngine();

    for (const symbol of tickerFilteredSymbols) {
      const klineData = klineMap.get(symbol);
      const ticker = tickerMap.get(symbol);
      const topCoin = topCoinMap.get(symbol);

      const tickerD: TickerData | undefined = ticker ? toTickerData(ticker) : undefined;
      const extra: ExtraData = {
        marketCapRank: topCoin?.marketCapRank ?? null,
        btcKlines,
        fundingRate: null,
      };

      const indicators = engine.evaluateScreenerIndicators(
        requiredIds as Parameters<typeof engine.evaluateScreenerIndicators>[0],
        klineData ?? [],
        paramsMap,
        tickerD,
        extra,
      );

      let previousValues: Record<string, number | null> | undefined;
      if (requiresPrev && klineData && klineData.length > lookbackBars) {
        previousValues = {};
        for (const cond of config.filters) {
          if (['CROSSES_ABOVE', 'CROSSES_BELOW', 'INCREASING', 'DECREASING'].includes(cond.operator)) {
            previousValues[cond.indicator] = engine.getScreenerPreviousValue(
              cond.indicator,
              klineData,
              lookbackBars,
              paramsMap[cond.indicator],
            );
          }
        }
      }

      if (config.filters.length > 0) {
        for (const cond of config.filters) {
          if (cond.compareIndicator && indicators[cond.compareIndicator] === undefined) {
            indicators[cond.compareIndicator] = engine.evaluateScreenerIndicator(
              cond.compareIndicator,
              klineData ?? [],
              cond.compareIndicatorParams ?? {},
              tickerD,
              extra,
            );
          }
        }
      }

      const evalResult = evaluateFilters(config.filters, indicators, previousValues);

      if (config.filters.length === 0 || evalResult.passed) {
        const price = ticker?.lastPrice ?? (klineData?.length ? parseFloat(String(klineData[klineData.length - 1]!.close)) : 0);
        results.push({
          symbol,
          displayName: topCoin?.name ?? symbol.replace('USDT', ''),
          price,
          priceChange24h: ticker?.priceChange ?? 0,
          priceChangePercent24h: ticker?.priceChangePercent ?? 0,
          volume24h: ticker?.volume ?? 0,
          quoteVolume24h: ticker?.quoteVolume ?? 0,
          marketCapRank: topCoin?.marketCapRank ?? null,
          indicators,
          matchedFilters: evalResult.matchedCount,
          totalFilters: config.filters.length,
          compositeScore: computeCompositeScore(indicators, evalResult.matchedCount, config.filters.length),
        });
      }
    }

    const sortBy = config.sortBy ?? 'compositeScore';
    const sortDir = config.sortDirection ?? 'desc';

    if (sortBy === 'symbol') {
      results.sort((a, b) => sortDir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol));
    } else {
      results.sort((a, b) => {
        const va = getSortValue(a, sortBy);
        const vb = getSortValue(b, sortBy);
        return sortDir === 'asc' ? va - vb : vb - va;
      });
    }

    const finalResults = results.slice(0, limit);

    const response: ScreenerResponse = {
      results: finalResults,
      totalSymbolsScanned: symbols.length,
      totalMatched: results.length,
      executionTimeMs: Date.now() - startTime,
      cachedAt: null,
      config,
    };

    this.cache.set(cacheKey, { response, timestamp: Date.now() });
    return response;
  }

  private async fetchMarketData(
    config: ScreenerConfig,
    limit: number,
    marketType: 'SPOT' | 'FUTURES',
    isIB: boolean,
    interval: string,
  ) {
    let symbols: string[] = [];
    const topCoinMap = new Map<string, TopCoin>();
    let btcKlines: Kline[] = [];

    if (!isIB) {
      const mcService = getMarketCapDataService();
      const topCoins = await mcService.getTopCoinsByMarketCap(
        Math.min(limit * 2, SCREENER.MAX_SYMBOLS_PER_SCAN),
        marketType,
      );
      for (const coin of topCoins) {
        symbols.push(coin.binanceSymbol);
        topCoinMap.set(coin.binanceSymbol, coin);
      }

      const hasBtcFilter = config.filters.some((f) => f.indicator === 'BTC_CORRELATION');
      if (hasBtcFilter) {
        btcKlines = await fetchKlinesFromDb('BTCUSDT', interval, marketType, SCREENER.MIN_KLINES_REQUIRED);
        if (btcKlines.length < 30) {
          await smartBackfillKlines('BTCUSDT', interval as Parameters<typeof smartBackfillKlines>[1], SCREENER.MIN_KLINES_REQUIRED, marketType);
          btcKlines = await fetchKlinesFromDb('BTCUSDT', interval, marketType, SCREENER.MIN_KLINES_REQUIRED);
        }
      }
    }

    const tickerMap = new Map<string, Ticker24hr>();
    if (!isIB && symbols.length > 0) {
      const tickers = await get24hrTickerData(symbols, marketType);
      for (const [sym, ticker] of tickers) tickerMap.set(sym, ticker);
    }

    return { symbols, topCoinMap, tickerMap, btcKlines };
  }

  private preFilterByTicker(
    symbols: string[],
    filters: ScreenerFilterCondition[],
    tickerMap: Map<string, Ticker24hr>,
    topCoinMap: Map<string, TopCoin>,
  ): string[] {
    const tickerFilters = filters.filter((f) => isTickerBasedIndicator(f.indicator));
    if (tickerFilters.length === 0) return symbols;

    return symbols.filter((symbol) => {
      const ticker = tickerMap.get(symbol);
      const topCoin = topCoinMap.get(symbol);

      for (const filter of tickerFilters) {
        let value: number | null = null;

        switch (filter.indicator) {
          case 'PRICE_CHANGE_24H':
            value = ticker?.priceChange ?? null;
            break;
          case 'PRICE_CHANGE_PERCENT_24H':
            value = ticker?.priceChangePercent ?? null;
            break;
          case 'VOLUME_24H':
            value = ticker?.volume ?? null;
            break;
          case 'QUOTE_VOLUME_24H':
            value = ticker?.quoteVolume ?? null;
            break;
          case 'MARKET_CAP_RANK':
            value = topCoin?.marketCapRank ?? null;
            break;
          default:
            continue;
        }

        if (value === null) return false;

        if (filter.operator === 'ABOVE' && filter.value !== undefined && value <= filter.value) return false;
        if (filter.operator === 'BELOW' && filter.value !== undefined && value >= filter.value) return false;
        if (filter.operator === 'BETWEEN' && filter.value !== undefined && filter.valueMax !== undefined) {
          if (value < filter.value || value > filter.valueMax) return false;
        }
      }

      return true;
    });
  }

  private async fetchKlinesBatch(
    symbols: string[],
    interval: string,
    marketType: 'SPOT' | 'FUTURES',
    isIB: boolean,
  ): Promise<Map<string, Kline[]>> {
    const klineMap = new Map<string, Kline[]>();
    const limit = pLimit(SCREENER.KLINE_BATCH_SIZE);

    const tasks = symbols.map((symbol) =>
      limit(async () => {
        try {
          if (isIB) {
            await smartBackfillIBKlines(symbol, interval as Parameters<typeof smartBackfillIBKlines>[1], SCREENER.MIN_KLINES_REQUIRED);
          } else {
            await smartBackfillKlines(symbol, interval as Parameters<typeof smartBackfillKlines>[1], SCREENER.MIN_KLINES_REQUIRED, marketType);
          }
          const data = await fetchKlinesFromDb(symbol, interval, marketType, SCREENER.MIN_KLINES_REQUIRED);
          klineMap.set(symbol, data);
        } catch {
          klineMap.set(symbol, []);
        }
      }),
    );

    await Promise.all(tasks);
    return klineMap;
  }
}

let instance: ScreenerService | null = null;

export const getScreenerService = (): ScreenerService => {
  if (!instance) instance = new ScreenerService();
  return instance;
};

export const resetScreenerService = (): void => {
  instance = null;
};
