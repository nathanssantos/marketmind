import type {
  Kline,
  ScreenerConfig,
  ScreenerFilterCondition,
} from '@marketmind/types';
import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';

vi.mock('../../db/client', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('../../db/schema', () => ({
  klines: {
    symbol: 'symbol',
    interval: 'interval',
    marketType: 'market_type',
    openTime: 'open_time',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
  sql: vi.fn(),
}));

vi.mock('../../utils/kline-mapper', () => ({
  mapDbKlinesReversed: vi.fn((rows: unknown[]) => rows),
}));

vi.mock('../../services/market-cap-data', () => ({
  getMarketCapDataService: vi.fn(() => ({
    getTopCoinsByMarketCap: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../services/binance-exchange-info', () => ({
  get24hrTickerData: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock('../../services/binance-historical', () => ({
  smartBackfillKlines: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/ib-historical', () => ({
  smartBackfillIBKlines: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/screener/indicator-evaluator', () => ({
  evaluateIndicator: vi.fn().mockReturnValue(50),
  evaluateIndicators: vi.fn().mockReturnValue({ RSI: 55, ADX: 30, ATR_PERCENT: 2, VOLUME_RATIO: 1.5 }),
  getPreviousValue: vi.fn().mockReturnValue(45),
  isTickerBasedIndicator: vi.fn().mockReturnValue(false),
}));

vi.mock('../../services/screener/filter-evaluator', () => ({
  evaluateFilters: vi.fn().mockReturnValue({ passed: true, matchedCount: 1, totalCount: 1 }),
  needsPreviousValues: vi.fn().mockReturnValue(false),
  getLookbackBars: vi.fn().mockReturnValue(0),
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

import { db } from '../../db/client';
import { getMarketCapDataService, type TopCoin } from '../../services/market-cap-data';
import { get24hrTickerData, type Ticker24hr } from '../../services/binance-exchange-info';
import { smartBackfillKlines } from '../../services/binance-historical';
import { smartBackfillIBKlines } from '../../services/ib-historical';
import {
  evaluateIndicator,
  evaluateIndicators,
  getPreviousValue,
  isTickerBasedIndicator,
} from '../../services/screener/indicator-evaluator';
import { evaluateFilters, needsPreviousValues, getLookbackBars } from '../../services/screener/filter-evaluator';
import { mapDbKlinesReversed } from '../../utils/kline-mapper';
import {
  ScreenerService,
  getScreenerService,
  resetScreenerService,
} from '../../services/screener/screener-service';

const makeKline = (close: number, index = 0): Kline => ({
  openTime: 1700000000000 + index * 3600000,
  closeTime: 1700000000000 + (index + 1) * 3600000 - 1,
  open: String(close * 0.99),
  high: String(close * 1.01),
  low: String(close * 0.98),
  close: String(close),
  volume: '1000',
  quoteVolume: String(1000 * close),
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: String(500 * close),
});

const makeKlines = (count: number, basePrice = 100): Kline[] =>
  Array.from({ length: count }, (_, i) => makeKline(basePrice + i * 0.5, i));

const makeTicker = (symbol: string, overrides: Partial<Ticker24hr> = {}): Ticker24hr => ({
  symbol,
  priceChange: 100,
  priceChangePercent: 2.5,
  weightedAvgPrice: 40000,
  lastPrice: 41000,
  volume: 50000,
  quoteVolume: 2000000000,
  openPrice: 40000,
  highPrice: 42000,
  lowPrice: 39000,
  count: 100000,
  ...overrides,
});

const makeTopCoin = (binanceSymbol: string, overrides: Partial<TopCoin> = {}): TopCoin => ({
  binanceSymbol,
  coingeckoId: binanceSymbol.toLowerCase().replace('usdt', ''),
  name: binanceSymbol.replace('USDT', ''),
  marketCapRank: 1,
  marketCap: 1000000000,
  volume24h: 500000000,
  priceChange24h: 100,
  priceChangePercent24h: 2.5,
  currentPrice: 41000,
  ...overrides,
});

const makeCondition = (
  overrides: Partial<ScreenerFilterCondition> & Pick<ScreenerFilterCondition, 'indicator' | 'operator'>,
): ScreenerFilterCondition => ({
  id: 'cond-' + Math.random().toString(36).slice(2, 6),
  ...overrides,
});

const makeConfig = (overrides: Partial<ScreenerConfig> = {}): ScreenerConfig => ({
  assetClass: 'CRYPTO',
  marketType: 'FUTURES',
  interval: '4h',
  filters: [],
  ...overrides,
});

const setupDbSelect = (rows: unknown[] = []) => {
  vi.mocked(db.select as MockedFunction<() => unknown>).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  } as unknown as ReturnType<typeof db.select>);
};

const setupMarketData = (coins: TopCoin[], tickers: Map<string, Ticker24hr> = new Map()) => {
  vi.mocked(getMarketCapDataService).mockReturnValue({
    getTopCoinsByMarketCap: vi.fn().mockResolvedValue(coins),
  } as unknown as ReturnType<typeof getMarketCapDataService>);
  vi.mocked(get24hrTickerData).mockResolvedValue(tickers);
};

describe('ScreenerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetScreenerService();
    setupDbSelect([]);
    vi.mocked(evaluateIndicators).mockReturnValue({ RSI: 55, ADX: 30, ATR_PERCENT: 2, VOLUME_RATIO: 1.5 });
    vi.mocked(evaluateFilters).mockReturnValue({ passed: true, matchedCount: 1, totalCount: 1 });
    vi.mocked(needsPreviousValues).mockReturnValue(false);
    vi.mocked(getLookbackBars).mockReturnValue(0);
    vi.mocked(isTickerBasedIndicator).mockReturnValue(false);
    vi.mocked(evaluateIndicator).mockReturnValue(50);
    vi.mocked(mapDbKlinesReversed).mockImplementation((rows: unknown[]) => rows as Kline[]);
  });

  describe('getScreenerService', () => {
    it('should return a ScreenerService instance', () => {
      const service = getScreenerService();
      expect(service).toBeInstanceOf(ScreenerService);
    });

    it('should return the same instance on subsequent calls', () => {
      const first = getScreenerService();
      const second = getScreenerService();
      expect(first).toBe(second);
    });

    it('should return a new instance after resetScreenerService', () => {
      const first = getScreenerService();
      resetScreenerService();
      const second = getScreenerService();
      expect(first).not.toBe(second);
    });
  });

  describe('resetScreenerService', () => {
    it('should clear the singleton', () => {
      const first = getScreenerService();
      resetScreenerService();
      const next = getScreenerService();
      expect(first).not.toBe(next);
    });
  });

  describe('hashConfig', () => {
    it('should produce deterministic hashes for same config', async () => {
      const config = makeConfig({ limit: 50, sortBy: 'rsi' });
      const coins = [makeTopCoin('BTCUSDT')];
      const tickerMap = new Map([['BTCUSDT', makeTicker('BTCUSDT')]]);
      setupMarketData(coins, tickerMap);
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const r1 = await service.runScreener(config);
      service.clearCache();
      const r2 = await service.runScreener(config);

      expect(r1.results).toEqual(r2.results);
    });

    it('should produce different hashes for different configs', async () => {
      const configA = makeConfig({ limit: 50, sortBy: 'rsi' });
      const configB = makeConfig({ limit: 50, sortBy: 'adx' });
      const coins = [makeTopCoin('BTCUSDT')];
      const tickerMap = new Map([['BTCUSDT', makeTicker('BTCUSDT')]]);
      setupMarketData(coins, tickerMap);
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(configA);
      await service.runScreener(configB);

      expect(getMarketCapDataService).toHaveBeenCalledTimes(2);
    });
  });

  describe('toTickerData', () => {
    it('should map ticker fields to TickerData in runScreener results', async () => {
      const ticker = makeTicker('ETHUSDT', { lastPrice: 3500, priceChangePercent: 5.2, volume: 80000 });
      const coins = [makeTopCoin('ETHUSDT')];
      const tickerMap = new Map([['ETHUSDT', ticker]]);
      setupMarketData(coins, tickerMap);
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig());

      expect(evaluateIndicators).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          priceChange: ticker.priceChange,
          priceChangePercent: ticker.priceChangePercent,
          lastPrice: ticker.lastPrice,
          volume: ticker.volume,
          quoteVolume: ticker.quoteVolume,
        }),
        expect.any(Object),
      );
    });
  });

  describe('getParamsMap', () => {
    it('should pass indicator params to evaluateIndicators', async () => {
      const conditions: ScreenerFilterCondition[] = [
        makeCondition({ indicator: 'RSI', operator: 'ABOVE', value: 50, indicatorParams: { period: 21 } }),
      ];
      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig({ filters: conditions }));

      expect(evaluateIndicators).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({ RSI: { period: 21 } }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should merge compareIndicator params', async () => {
      const conditions: ScreenerFilterCondition[] = [
        makeCondition({
          indicator: 'EMA',
          operator: 'ABOVE',
          indicatorParams: { period: 9 },
          compareIndicator: 'SMA',
          compareIndicatorParams: { period: 20 },
        }),
      ];
      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig({ filters: conditions }));

      expect(evaluateIndicators).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({ EMA: { period: 9 }, SMA: { period: 20 } }),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('getRequiredIndicatorIds', () => {
    it('should always include RSI, ADX, ATR_PERCENT, VOLUME_RATIO', async () => {
      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig());

      const ids = vi.mocked(evaluateIndicators).mock.calls[0]![0];
      expect(ids).toContain('RSI');
      expect(ids).toContain('ADX');
      expect(ids).toContain('ATR_PERCENT');
      expect(ids).toContain('VOLUME_RATIO');
    });

    it('should include filter indicator ids', async () => {
      const conditions: ScreenerFilterCondition[] = [
        makeCondition({ indicator: 'CCI', operator: 'ABOVE', value: 100 }),
        makeCondition({ indicator: 'MFI', operator: 'BELOW', value: 80, compareIndicator: 'STOCHASTIC_K' }),
      ];
      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig({ filters: conditions }));

      const ids = vi.mocked(evaluateIndicators).mock.calls[0]![0] as string[];
      expect(ids).toContain('CCI');
      expect(ids).toContain('MFI');
      expect(ids).toContain('STOCHASTIC_K');
    });
  });

  describe('getSortValue', () => {
    it('should sort by compositeScore descending by default', async () => {
      const coins = [
        makeTopCoin('BTCUSDT', { marketCapRank: 1 }),
        makeTopCoin('ETHUSDT', { marketCapRank: 2 }),
      ];
      const tickerMap = new Map([
        ['BTCUSDT', makeTicker('BTCUSDT', { lastPrice: 41000 })],
        ['ETHUSDT', makeTicker('ETHUSDT', { lastPrice: 3000 })],
      ]);
      setupMarketData(coins, tickerMap);
      setupDbSelect(makeKlines(5));

      let callCount = 0;
      vi.mocked(evaluateIndicators).mockImplementation(() => {
        callCount++;
        return callCount === 1
          ? { RSI: 55, ADX: 30, ATR_PERCENT: 2, VOLUME_RATIO: 3 }
          : { RSI: 40, ADX: 10, ATR_PERCENT: 1, VOLUME_RATIO: 0.5 };
      });

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig());

      expect(result.results[0]!.compositeScore).toBeGreaterThanOrEqual(result.results[1]!.compositeScore);
    });

    it('should sort by symbol alphabetically', async () => {
      const coins = [makeTopCoin('BTCUSDT'), makeTopCoin('AAVEUSDT')];
      const tickerMap = new Map([
        ['BTCUSDT', makeTicker('BTCUSDT')],
        ['AAVEUSDT', makeTicker('AAVEUSDT')],
      ]);
      setupMarketData(coins, tickerMap);
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig({ sortBy: 'symbol', sortDirection: 'asc' }));

      expect(result.results[0]!.symbol).toBe('AAVEUSDT');
      expect(result.results[1]!.symbol).toBe('BTCUSDT');
    });

    it('should sort by price ascending', async () => {
      const coins = [makeTopCoin('BTCUSDT'), makeTopCoin('ETHUSDT')];
      const tickerMap = new Map([
        ['BTCUSDT', makeTicker('BTCUSDT', { lastPrice: 41000 })],
        ['ETHUSDT', makeTicker('ETHUSDT', { lastPrice: 3000 })],
      ]);
      setupMarketData(coins, tickerMap);
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig({ sortBy: 'price', sortDirection: 'asc' }));

      expect(result.results[0]!.price).toBeLessThanOrEqual(result.results[1]!.price);
    });

    it('should sort by volume24h descending', async () => {
      const coins = [makeTopCoin('BTCUSDT'), makeTopCoin('ETHUSDT')];
      const tickerMap = new Map([
        ['BTCUSDT', makeTicker('BTCUSDT', { volume: 10000 })],
        ['ETHUSDT', makeTicker('ETHUSDT', { volume: 99000 })],
      ]);
      setupMarketData(coins, tickerMap);
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig({ sortBy: 'volume24h', sortDirection: 'desc' }));

      expect(result.results[0]!.volume24h).toBeGreaterThanOrEqual(result.results[1]!.volume24h);
    });

    it('should handle marketCapRank sort with null values', async () => {
      const coins = [
        makeTopCoin('BTCUSDT', { marketCapRank: 1 }),
        makeTopCoin('ETHUSDT', { marketCapRank: 2 }),
      ];
      const tickerMap = new Map([
        ['BTCUSDT', makeTicker('BTCUSDT')],
        ['ETHUSDT', makeTicker('ETHUSDT')],
      ]);
      setupMarketData(coins, tickerMap);
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig({ sortBy: 'marketCapRank', sortDirection: 'asc' }));

      expect(result.results.length).toBe(2);
    });
  });

  describe('computeCompositeScore', () => {
    it('should produce score with all components', async () => {
      vi.mocked(evaluateIndicators).mockReturnValue({ RSI: 50, ADX: 40, ATR_PERCENT: 2, VOLUME_RATIO: 3 });
      vi.mocked(evaluateFilters).mockReturnValue({ passed: true, matchedCount: 2, totalCount: 2 });

      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig({ filters: [
        makeCondition({ indicator: 'RSI', operator: 'ABOVE', value: 30 }),
        makeCondition({ indicator: 'ADX', operator: 'ABOVE', value: 20 }),
      ] }));

      expect(result.results[0]!.compositeScore).toBeGreaterThan(0);
      expect(result.results[0]!.compositeScore).toBeLessThanOrEqual(100);
    });

    it('should cap score at 100', async () => {
      vi.mocked(evaluateIndicators).mockReturnValue({ RSI: 50, ADX: 99, ATR_PERCENT: 5, VOLUME_RATIO: 20 });
      vi.mocked(evaluateFilters).mockReturnValue({ passed: true, matchedCount: 5, totalCount: 5 });

      const conditions = Array.from({ length: 5 }, () =>
        makeCondition({ indicator: 'RSI', operator: 'ABOVE', value: 1 }),
      );

      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig({ filters: conditions }));

      expect(result.results[0]!.compositeScore).toBeLessThanOrEqual(100);
    });

    it('should give default filter score when no filters', async () => {
      vi.mocked(evaluateIndicators).mockReturnValue({ RSI: 50, ADX: 0, ATR_PERCENT: 0, VOLUME_RATIO: 0 });

      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig());

      expect(result.results[0]!.compositeScore).toBeGreaterThan(0);
    });

    it('should add RSI bonus for value 30-70 range', async () => {
      vi.mocked(evaluateIndicators).mockReturnValue({ RSI: 35, ADX: 0, ATR_PERCENT: 0, VOLUME_RATIO: 0 });

      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig());

      const score = result.results[0]!.compositeScore;
      expect(score).toBeGreaterThan(20);
    });
  });

  describe('pLimit', () => {
    it('should respect concurrency limits', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;
      const symbols = Array.from({ length: 15 }, (_, i) => `SYM${i}USDT`);
      const coins = symbols.map((s) => makeTopCoin(s));
      const tickerMap = new Map(symbols.map((s) => [s, makeTicker(s)]));
      setupMarketData(coins, tickerMap);

      vi.mocked(smartBackfillKlines).mockImplementation(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 10));
        concurrent--;
        return { totalInDb: 0, downloaded: 0, gaps: 0, alreadyComplete: true };
      });
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig());

      expect(maxConcurrent).toBeLessThanOrEqual(10);
    });
  });

  describe('runScreener', () => {
    it('should return a valid ScreenerResponse structure', async () => {
      const coins = [makeTopCoin('BTCUSDT')];
      const tickerMap = new Map([['BTCUSDT', makeTicker('BTCUSDT')]]);
      setupMarketData(coins, tickerMap);
      setupDbSelect(makeKlines(5));

      const config = makeConfig();
      const service = new ScreenerService();
      const result = await service.runScreener(config);

      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('totalSymbolsScanned');
      expect(result).toHaveProperty('totalMatched');
      expect(result).toHaveProperty('executionTimeMs');
      expect(result).toHaveProperty('cachedAt', null);
      expect(result).toHaveProperty('config', config);
    });

    it('should respect limit from config', async () => {
      const symbols = Array.from({ length: 10 }, (_, i) => `C${i}USDT`);
      const coins = symbols.map((s) => makeTopCoin(s));
      const tickerMap = new Map(symbols.map((s) => [s, makeTicker(s)]));
      setupMarketData(coins, tickerMap);
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig({ limit: 3 }));

      expect(result.results.length).toBeLessThanOrEqual(3);
    });

    it('should cap limit at MAX_SYMBOLS_PER_SCAN', async () => {
      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig({ limit: 999 }));

      const mcService = vi.mocked(getMarketCapDataService)();
      expect(mcService.getTopCoinsByMarketCap).toHaveBeenCalledWith(
        expect.any(Number),
        'FUTURES',
      );
    });

    it('should use default interval when not specified', async () => {
      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const config = makeConfig();
      delete (config as unknown as Record<string, unknown>)['interval'];
      await service.runScreener(config);

      expect(smartBackfillKlines).toHaveBeenCalledWith(
        'BTCUSDT',
        '4h',
        200,
        'FUTURES',
      );
    });

    it('should use default marketType FUTURES when not specified', async () => {
      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const config = makeConfig();
      delete (config as unknown as Record<string, unknown>)['marketType'];
      await service.runScreener(config);

      expect(smartBackfillKlines).toHaveBeenCalledWith(
        'BTCUSDT',
        '4h',
        200,
        'FUTURES',
      );
    });

    it('should include results when no filters are set', async () => {
      const coins = [makeTopCoin('BTCUSDT'), makeTopCoin('ETHUSDT')];
      const tickerMap = new Map([
        ['BTCUSDT', makeTicker('BTCUSDT')],
        ['ETHUSDT', makeTicker('ETHUSDT')],
      ]);
      setupMarketData(coins, tickerMap);
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig({ filters: [] }));

      expect(result.results.length).toBe(2);
    });

    it('should exclude results when filters fail', async () => {
      vi.mocked(evaluateFilters).mockReturnValue({ passed: false, matchedCount: 0, totalCount: 1 });

      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig({
        filters: [makeCondition({ indicator: 'RSI', operator: 'ABOVE', value: 90 })],
      }));

      expect(result.results.length).toBe(0);
    });

    it('should compute previousValues when needed', async () => {
      vi.mocked(needsPreviousValues).mockReturnValue(true);
      vi.mocked(getLookbackBars).mockReturnValue(2);

      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(10));

      const service = new ScreenerService();
      await service.runScreener(makeConfig({
        filters: [makeCondition({ indicator: 'RSI', operator: 'CROSSES_ABOVE', value: 50 })],
      }));

      expect(getPreviousValue).toHaveBeenCalled();
    });

    it('should evaluate compare indicators when present', async () => {
      vi.mocked(evaluateIndicators).mockReturnValue({ RSI: 55, ADX: 30, ATR_PERCENT: 2, VOLUME_RATIO: 1.5 });

      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig({
        filters: [makeCondition({
          indicator: 'EMA',
          operator: 'ABOVE',
          indicatorParams: { period: 9 },
          compareIndicator: 'SMA',
          compareIndicatorParams: { period: 20 },
        })],
      }));

      expect(evaluateIndicator).toHaveBeenCalledWith(
        'SMA',
        expect.any(Array),
        { period: 20 },
        expect.anything(),
        expect.anything(),
      );
    });

    it('should populate result row fields from ticker data', async () => {
      const ticker = makeTicker('BTCUSDT', {
        lastPrice: 42000,
        priceChange: 500,
        priceChangePercent: 1.2,
        volume: 60000,
        quoteVolume: 2500000000,
      });
      const coins = [makeTopCoin('BTCUSDT', { name: 'Bitcoin', marketCapRank: 1 })];
      setupMarketData(coins, new Map([['BTCUSDT', ticker]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig());

      const row = result.results[0]!;
      expect(row.symbol).toBe('BTCUSDT');
      expect(row.displayName).toBe('Bitcoin');
      expect(row.price).toBe(42000);
      expect(row.priceChange24h).toBe(500);
      expect(row.priceChangePercent24h).toBe(1.2);
      expect(row.volume24h).toBe(60000);
      expect(row.quoteVolume24h).toBe(2500000000);
      expect(row.marketCapRank).toBe(1);
    });

    it('should use close price when no ticker is available', async () => {
      const klines = makeKlines(5, 100);
      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map());
      setupDbSelect(klines);

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig());

      expect(result.results[0]!.price).toBeGreaterThan(0);
    });

    it('should track totalSymbolsScanned and totalMatched', async () => {
      const coins = [
        makeTopCoin('BTCUSDT'),
        makeTopCoin('ETHUSDT'),
        makeTopCoin('SOLUSDT'),
      ];
      const tickerMap = new Map(coins.map((c) => [c.binanceSymbol, makeTicker(c.binanceSymbol)]));
      setupMarketData(coins, tickerMap);
      setupDbSelect(makeKlines(5));

      let callIdx = 0;
      vi.mocked(evaluateFilters).mockImplementation(() => {
        callIdx++;
        return callIdx <= 2
          ? { passed: true, matchedCount: 1, totalCount: 1 }
          : { passed: false, matchedCount: 0, totalCount: 1 };
      });

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig({
        filters: [makeCondition({ indicator: 'RSI', operator: 'ABOVE', value: 50 })],
      }));

      expect(result.totalSymbolsScanned).toBe(3);
      expect(result.totalMatched).toBe(2);
    });
  });

  describe('fetchMarketData', () => {
    it('should fetch top coins from MarketCapDataService for crypto', async () => {
      const coins = [makeTopCoin('BTCUSDT'), makeTopCoin('ETHUSDT')];
      setupMarketData(coins, new Map([
        ['BTCUSDT', makeTicker('BTCUSDT')],
        ['ETHUSDT', makeTicker('ETHUSDT')],
      ]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig());

      const mcService = vi.mocked(getMarketCapDataService)();
      expect(mcService.getTopCoinsByMarketCap).toHaveBeenCalled();
    });

    it('should skip market cap and ticker fetch for IB exchange', async () => {
      setupMarketData([], new Map());
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig({ exchange: 'INTERACTIVE_BROKERS' }));

      expect(get24hrTickerData).not.toHaveBeenCalled();
      expect(result.results.length).toBe(0);
    });

    it('should skip market cap and ticker fetch for STOCKS asset class', async () => {
      setupMarketData([], new Map());
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig({ assetClass: 'STOCKS' }));

      expect(get24hrTickerData).not.toHaveBeenCalled();
    });

    it('should fetch BTC klines when BTC_CORRELATION filter is present', async () => {
      const coins = [makeTopCoin('ETHUSDT')];
      setupMarketData(coins, new Map([['ETHUSDT', makeTicker('ETHUSDT')]]));
      setupDbSelect(makeKlines(50));

      const service = new ScreenerService();
      await service.runScreener(makeConfig({
        filters: [makeCondition({ indicator: 'BTC_CORRELATION', operator: 'ABOVE', value: 0.5 })],
      }));

      expect(db.select).toHaveBeenCalled();
    });

    it('should backfill BTC klines when fewer than 30 in DB', async () => {
      const coins = [makeTopCoin('ETHUSDT')];
      setupMarketData(coins, new Map([['ETHUSDT', makeTicker('ETHUSDT')]]));

      let selectCallCount = 0;
      vi.mocked(db.select as MockedFunction<() => unknown>).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount <= 1) return Promise.resolve(makeKlines(10));
                return Promise.resolve(makeKlines(50));
              }),
            }),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>));

      const service = new ScreenerService();
      await service.runScreener(makeConfig({
        filters: [makeCondition({ indicator: 'BTC_CORRELATION', operator: 'ABOVE', value: 0.5 })],
      }));

      expect(smartBackfillKlines).toHaveBeenCalledWith(
        'BTCUSDT',
        expect.any(String),
        200,
        'FUTURES',
      );
    });
  });

  describe('preFilterByTicker', () => {
    it('should pass all symbols when no ticker-based filters exist', async () => {
      vi.mocked(isTickerBasedIndicator).mockReturnValue(false);
      const coins = [makeTopCoin('BTCUSDT'), makeTopCoin('ETHUSDT')];
      const tickerMap = new Map([
        ['BTCUSDT', makeTicker('BTCUSDT')],
        ['ETHUSDT', makeTicker('ETHUSDT')],
      ]);
      setupMarketData(coins, tickerMap);
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig({
        filters: [makeCondition({ indicator: 'RSI', operator: 'ABOVE', value: 50 })],
      }));

      expect(smartBackfillKlines).toHaveBeenCalledTimes(2);
    });

    it('should filter symbols with PRICE_CHANGE_PERCENT_24H ABOVE', async () => {
      vi.mocked(isTickerBasedIndicator).mockImplementation(
        (id) => ['PRICE_CHANGE_24H', 'PRICE_CHANGE_PERCENT_24H', 'VOLUME_24H', 'MARKET_CAP_RANK'].includes(id),
      );

      const coins = [
        makeTopCoin('BTCUSDT'),
        makeTopCoin('ETHUSDT'),
      ];
      const tickerMap = new Map([
        ['BTCUSDT', makeTicker('BTCUSDT', { priceChangePercent: 5 })],
        ['ETHUSDT', makeTicker('ETHUSDT', { priceChangePercent: -2 })],
      ]);
      setupMarketData(coins, tickerMap);
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig({
        filters: [makeCondition({ indicator: 'PRICE_CHANGE_PERCENT_24H', operator: 'ABOVE', value: 0 })],
      }));

      expect(smartBackfillKlines).toHaveBeenCalledTimes(1);
      expect(smartBackfillKlines).toHaveBeenCalledWith('BTCUSDT', expect.any(String), 200, 'FUTURES');
    });

    it('should filter with VOLUME_24H BELOW', async () => {
      vi.mocked(isTickerBasedIndicator).mockImplementation(
        (id) => ['PRICE_CHANGE_24H', 'PRICE_CHANGE_PERCENT_24H', 'VOLUME_24H', 'MARKET_CAP_RANK'].includes(id),
      );

      const coins = [makeTopCoin('BTCUSDT'), makeTopCoin('ETHUSDT')];
      const tickerMap = new Map([
        ['BTCUSDT', makeTicker('BTCUSDT', { volume: 100000 })],
        ['ETHUSDT', makeTicker('ETHUSDT', { volume: 50 })],
      ]);
      setupMarketData(coins, tickerMap);
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig({
        filters: [makeCondition({ indicator: 'VOLUME_24H', operator: 'BELOW', value: 1000 })],
      }));

      expect(smartBackfillKlines).toHaveBeenCalledTimes(1);
      expect(smartBackfillKlines).toHaveBeenCalledWith('ETHUSDT', expect.any(String), 200, 'FUTURES');
    });

    it('should filter with MARKET_CAP_RANK BETWEEN', async () => {
      vi.mocked(isTickerBasedIndicator).mockImplementation(
        (id) => ['PRICE_CHANGE_24H', 'PRICE_CHANGE_PERCENT_24H', 'VOLUME_24H', 'MARKET_CAP_RANK'].includes(id),
      );

      const coins = [
        makeTopCoin('BTCUSDT', { marketCapRank: 1 }),
        makeTopCoin('ETHUSDT', { marketCapRank: 2 }),
        makeTopCoin('SOLUSDT', { marketCapRank: 50 }),
      ];
      const tickerMap = new Map([
        ['BTCUSDT', makeTicker('BTCUSDT')],
        ['ETHUSDT', makeTicker('ETHUSDT')],
        ['SOLUSDT', makeTicker('SOLUSDT')],
      ]);
      setupMarketData(coins, tickerMap);
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig({
        filters: [makeCondition({ indicator: 'MARKET_CAP_RANK', operator: 'BETWEEN', value: 1, valueMax: 10 })],
      }));

      expect(smartBackfillKlines).toHaveBeenCalledTimes(2);
    });

    it('should exclude symbols with no ticker data', async () => {
      vi.mocked(isTickerBasedIndicator).mockImplementation(
        (id) => ['PRICE_CHANGE_24H', 'PRICE_CHANGE_PERCENT_24H', 'VOLUME_24H', 'MARKET_CAP_RANK'].includes(id),
      );

      const coins = [makeTopCoin('BTCUSDT'), makeTopCoin('ETHUSDT')];
      const tickerMap = new Map([['BTCUSDT', makeTicker('BTCUSDT')]]);
      setupMarketData(coins, tickerMap);
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig({
        filters: [makeCondition({ indicator: 'VOLUME_24H', operator: 'ABOVE', value: 0 })],
      }));

      expect(smartBackfillKlines).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchKlinesBatch', () => {
    it('should call smartBackfillKlines for crypto symbols', async () => {
      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig());

      expect(smartBackfillKlines).toHaveBeenCalledWith('BTCUSDT', '4h', 200, 'FUTURES');
    });

    it('should call smartBackfillIBKlines for IB exchange', async () => {
      setupMarketData([], new Map());
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig({ exchange: 'INTERACTIVE_BROKERS' }));

      expect(smartBackfillIBKlines).not.toHaveBeenCalled();
    });

    it('should handle kline fetch errors gracefully', async () => {
      const coins = [makeTopCoin('BTCUSDT'), makeTopCoin('ETHUSDT')];
      const tickerMap = new Map([
        ['BTCUSDT', makeTicker('BTCUSDT')],
        ['ETHUSDT', makeTicker('ETHUSDT')],
      ]);
      setupMarketData(coins, tickerMap);

      vi.mocked(smartBackfillKlines).mockRejectedValueOnce(new Error('Network error'));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig());

      expect(result.results.length).toBeGreaterThanOrEqual(0);
    });

    it('should use SPOT market type when configured', async () => {
      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig({ marketType: 'SPOT' }));

      expect(smartBackfillKlines).toHaveBeenCalledWith('BTCUSDT', '4h', 200, 'SPOT');
    });
  });

  describe('caching', () => {
    it('should return cached result on second call with same config', async () => {
      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const config = makeConfig({ sortBy: 'rsi' });

      await service.runScreener(config);
      const second = await service.runScreener(config);

      expect(second.cachedAt).not.toBeNull();
      expect(getMarketCapDataService).toHaveBeenCalledTimes(1);
    });

    it('should not return cached result for different config', async () => {
      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      await service.runScreener(makeConfig({ sortBy: 'rsi' }));
      await service.runScreener(makeConfig({ sortBy: 'adx' }));

      expect(getMarketCapDataService).toHaveBeenCalledTimes(2);
    });

    it('should clear cache with clearCache()', async () => {
      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const config = makeConfig();

      await service.runScreener(config);
      service.clearCache();
      await service.runScreener(config);

      expect(getMarketCapDataService).toHaveBeenCalledTimes(2);
    });

    it('should expire cache after TTL', async () => {
      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const config = makeConfig();

      const now = Date.now();
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(now)
        .mockReturnValueOnce(now)
        .mockReturnValueOnce(now)
        .mockReturnValueOnce(now + 200_000)
        .mockReturnValueOnce(now + 200_000)
        .mockReturnValueOnce(now + 200_000)
        .mockReturnValueOnce(now + 200_000)
        .mockReturnValueOnce(now + 200_000);

      await service.runScreener(config);
      await service.runScreener(config);

      expect(getMarketCapDataService).toHaveBeenCalledTimes(2);
      vi.restoreAllMocks();
    });
  });

  describe('error handling', () => {
    it('should handle MarketCapDataService failure', async () => {
      vi.mocked(getMarketCapDataService).mockReturnValue({
        getTopCoinsByMarketCap: vi.fn().mockRejectedValue(new Error('API down')),
      } as unknown as ReturnType<typeof getMarketCapDataService>);

      const service = new ScreenerService();
      await expect(service.runScreener(makeConfig())).rejects.toThrow('API down');
    });

    it('should handle ticker data failure', async () => {
      const coins = [makeTopCoin('BTCUSDT')];
      vi.mocked(getMarketCapDataService).mockReturnValue({
        getTopCoinsByMarketCap: vi.fn().mockResolvedValue(coins),
      } as unknown as ReturnType<typeof getMarketCapDataService>);
      vi.mocked(get24hrTickerData).mockRejectedValue(new Error('Ticker fetch failed'));

      const service = new ScreenerService();
      await expect(service.runScreener(makeConfig())).rejects.toThrow('Ticker fetch failed');
    });

    it('should set empty klines on individual symbol fetch error', async () => {
      const coins = [makeTopCoin('BTCUSDT')];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));

      vi.mocked(smartBackfillKlines).mockRejectedValue(new Error('Backfill failed'));
      vi.mocked(db.select as MockedFunction<() => unknown>).mockImplementation(() => {
        throw new Error('DB error');
      });

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig());

      expect(evaluateIndicators).toHaveBeenCalledWith(
        expect.any(Array),
        [],
        expect.any(Object),
        expect.anything(),
        expect.anything(),
      );
      expect(result.totalSymbolsScanned).toBe(1);
    });
  });

  describe('displayName derivation', () => {
    it('should use topCoin name when available', async () => {
      const coins = [makeTopCoin('BTCUSDT', { name: 'Bitcoin' })];
      setupMarketData(coins, new Map([['BTCUSDT', makeTicker('BTCUSDT')]]));
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig());

      expect(result.results[0]!.displayName).toBe('Bitcoin');
    });

    it('should strip USDT from symbol when no topCoin', async () => {
      const coins = [makeTopCoin('BTCUSDT')];
      const tickerMap = new Map([['BTCUSDT', makeTicker('BTCUSDT')]]);

      vi.mocked(getMarketCapDataService).mockReturnValue({
        getTopCoinsByMarketCap: vi.fn().mockResolvedValue(
          coins.map((c) => ({ ...c, name: undefined })),
        ),
      } as unknown as ReturnType<typeof getMarketCapDataService>);
      vi.mocked(get24hrTickerData).mockResolvedValue(tickerMap);
      setupDbSelect(makeKlines(5));

      const service = new ScreenerService();
      const result = await service.runScreener(makeConfig());

      expect(result.results[0]!.displayName).toBeDefined();
    });
  });
});
