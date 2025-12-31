import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kline, StrategyDefinition, IndicatorDefinition } from '@marketmind/types';

vi.mock('@marketmind/indicators', () => ({
  calculateSMA: vi.fn(() => [50000, 50100, 50200]),
  calculateEMA: vi.fn(() => [50000, 50100, 50200]),
  calculateRSI: vi.fn(() => ({ values: [30, 50, 70] })),
  calculateBollingerBandsArray: vi.fn(() => [
    { upper: 52000, middle: 50000, lower: 48000 },
    { upper: 52100, middle: 50100, lower: 48100 },
  ]),
  calculateATR: vi.fn(() => [500, 600, 700]),
  calculateMACD: vi.fn(() => ({
    macd: [100, 150, 200],
    signal: [80, 120, 160],
    histogram: [20, 30, 40],
  })),
  calculateStochastic: vi.fn(() => ({
    k: [20, 50, 80],
    d: [25, 55, 75],
  })),
  calculateADX: vi.fn(() => ({
    adx: [20, 25, 30],
    plusDI: [30, 35, 40],
    minusDI: [15, 18, 20],
  })),
  calculateCCI: vi.fn(() => [50, 100, 150]),
  calculateKeltner: vi.fn(() => ({
    upper: [52000, 52100],
    middle: [50000, 50100],
    lower: [48000, 48100],
  })),
  calculateSupertrend: vi.fn(() => ({
    value: [49500, 49600],
    trend: ['up', 'up'],
  })),
  calculateDonchian: vi.fn(() => ({
    upper: [52000, 52100],
    middle: [50000, 50100],
    lower: [48000, 48100],
  })),
  calculateIBS: vi.fn(() => ({ values: [0.3, 0.5, 0.7] })),
  calculateCumulativeRSI: vi.fn(() => ({ values: [25, 50, 75] })),
  calculateNR7: vi.fn(() => ({ isNR7: [false, true, false] })),
  calculateNDayHighLow: vi.fn(() => ({
    isNDayHigh: [false, true, false],
    isNDayLow: [true, false, false],
    highestClose: [51000, 52000, 51500],
    lowestClose: [49000, 49500, 49200],
  })),
  calculatePercentBSeries: vi.fn(() => ({ values: [0.2, 0.5, 0.8] })),
}));

import { IndicatorCache } from '../IndicatorCache';
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateBollingerBandsArray,
  calculateATR,
  calculateMACD,
} from '@marketmind/indicators';

const createMockKlines = (count: number): Kline[] => {
  return Array(count).fill(null).map((_, i) => ({
    openTime: Date.now() + i * 3600000,
    closeTime: Date.now() + (i + 1) * 3600000,
    open: String(50000 + i * 100),
    high: String(50500 + i * 100),
    low: String(49500 + i * 100),
    close: String(50100 + i * 100),
    volume: '1000',
    quoteVolume: '50000000',
    trades: 1000,
    takerBuyBaseVolume: '500',
    takerBuyQuoteVolume: '25000000',
  }));
};

const createMockStrategy = (indicators: Record<string, IndicatorDefinition>): StrategyDefinition => ({
  id: 'test-strategy',
  name: 'Test Strategy',
  version: '1.0.0',
  description: 'Test',
  author: 'test',
  parameters: {
    smaPeriod: { default: 20 },
    emaPeriod: { default: 9 },
  },
  indicators,
  entry: {},
  exit: {
    stopLoss: { type: 'percent', value: 2 },
    takeProfit: { type: 'percent', value: 4 },
  },
});

describe('IndicatorCache', () => {
  let cache: IndicatorCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new IndicatorCache();
  });

  describe('initialize', () => {
    it('should initialize with klines and parse price data', () => {
      const klines = createMockKlines(5);

      cache.initialize(klines);

      const priceData = cache.getPriceData();
      expect(priceData).not.toBeNull();
      expect(priceData!.open).toHaveLength(5);
      expect(priceData!.high).toHaveLength(5);
      expect(priceData!.low).toHaveLength(5);
      expect(priceData!.close).toHaveLength(5);
      expect(priceData!.volume).toHaveLength(5);
    });

    it('should clear previous cache on re-initialization', () => {
      const klines = createMockKlines(5);
      const strategy = createMockStrategy({
        sma: { type: 'sma', params: { period: 20 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});
      expect(cache.getStats().cacheSize).toBeGreaterThan(0);

      cache.initialize(klines);
      expect(cache.getStats().cacheSize).toBe(0);
    });
  });

  describe('precomputeForStrategies', () => {
    it('should compute unique indicators for strategies', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        sma: { type: 'sma', params: { period: 20 } },
        ema: { type: 'ema', params: { period: 9 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateSMA).toHaveBeenCalled();
      expect(calculateEMA).toHaveBeenCalled();
      expect(cache.getStats().cacheSize).toBe(2);
    });

    it('should deduplicate same indicator across strategies', () => {
      const klines = createMockKlines(30);
      const strategy1 = createMockStrategy({
        sma: { type: 'sma', params: { period: 20 } },
      });
      const strategy2 = createMockStrategy({
        sma: { type: 'sma', params: { period: 20 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy1, strategy2], {});

      expect(calculateSMA).toHaveBeenCalledTimes(1);
      expect(cache.getStats().cacheSize).toBe(1);
    });

    it('should compute separate indicators with different params', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        sma20: { type: 'sma', params: { period: 20 } },
        sma50: { type: 'sma', params: { period: 50 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateSMA).toHaveBeenCalledTimes(2);
      expect(cache.getStats().cacheSize).toBe(2);
    });

    it('should resolve parameter references', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        sma: { type: 'sma', params: { period: '$smaPeriod' } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], { smaPeriod: 25 });

      expect(calculateSMA).toHaveBeenCalled();
    });

    it('should skip strategies without indicators', () => {
      const klines = createMockKlines(30);
      const strategy: StrategyDefinition = {
        id: 'no-indicators',
        name: 'No Indicators',
        version: '1.0.0',
        description: 'Test',
        author: 'test',
        parameters: {},
        indicators: {},
        entry: {},
        exit: { stopLoss: { type: 'percent', value: 2 } },
      };

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(cache.getStats().cacheSize).toBe(0);
    });
  });

  describe('get', () => {
    it('should return cached indicator', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        sma: { type: 'sma', params: { period: 20 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      const result = cache.get('sma', { period: 20 });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('sma');
    });

    it('should return null for non-cached indicator', () => {
      const klines = createMockKlines(30);
      cache.initialize(klines);

      const result = cache.get('sma', { period: 20 });

      expect(result).toBeNull();
    });

    it('should return null for different params', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        sma: { type: 'sma', params: { period: 20 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      const result = cache.get('sma', { period: 50 });

      expect(result).toBeNull();
    });
  });

  describe('getForDefinition', () => {
    it('should resolve params and return cached indicator', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        sma: { type: 'sma', params: { period: 20 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      const definition: IndicatorDefinition = { type: 'sma', params: { period: 20 } };
      const result = cache.getForDefinition(definition, {});

      expect(result).not.toBeNull();
      expect(result!.type).toBe('sma');
    });

    it('should resolve parameter references', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        sma: { type: 'sma', params: { period: '$smaPeriod' } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], { smaPeriod: 20 });

      const definition: IndicatorDefinition = { type: 'sma', params: { period: '$smaPeriod' } };
      const result = cache.getForDefinition(definition, { smaPeriod: 20 });

      expect(result).not.toBeNull();
    });

    it('should use strategy default for unresolved params', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        sma: { type: 'sma', params: { period: '$smaPeriod' } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      const definition: IndicatorDefinition = { type: 'sma', params: { period: '$smaPeriod' } };
      const result = cache.getForDefinition(definition, {}, { smaPeriod: { default: 20 } });

      expect(result).not.toBeNull();
    });
  });

  describe('indicator computation', () => {
    it('should compute SMA indicator', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        sma: { type: 'sma', params: { period: 20 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      const result = cache.get('sma', { period: 20 });
      expect(result!.type).toBe('sma');
      expect(result!.values).toEqual([50000, 50100, 50200]);
    });

    it('should compute EMA indicator', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        ema: { type: 'ema', params: { period: 9 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      const result = cache.get('ema', { period: 9 });
      expect(result!.type).toBe('ema');
    });

    it('should compute RSI indicator', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        rsi: { type: 'rsi', params: { period: 14 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateRSI).toHaveBeenCalled();
    });

    it('should compute Bollinger Bands indicator', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        bb: { type: 'bollingerBands', params: { period: 20, stdDev: 2 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateBollingerBandsArray).toHaveBeenCalled();
      const result = cache.get('bollingerBands', { period: 20, stdDev: 2 });
      expect(result!.values).toHaveProperty('upper');
      expect(result!.values).toHaveProperty('middle');
      expect(result!.values).toHaveProperty('lower');
    });

    it('should compute ATR indicator', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        atr: { type: 'atr', params: { period: 14 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateATR).toHaveBeenCalled();
    });

    it('should compute MACD indicator', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        macd: { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateMACD).toHaveBeenCalled();
      const result = cache.get('macd', { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
      expect(result!.values).toHaveProperty('macd');
      expect(result!.values).toHaveProperty('signal');
      expect(result!.values).toHaveProperty('histogram');
    });

    it('should return null for uninitialized cache', () => {
      const strategy = createMockStrategy({
        sma: { type: 'sma', params: { period: 20 } },
      });

      cache.precomputeForStrategies([strategy], {});

      const result = cache.get('sma', { period: 20 });
      expect(result).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all cached data', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        sma: { type: 'sma', params: { period: 20 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});
      expect(cache.getStats().cacheSize).toBeGreaterThan(0);

      cache.clear();

      expect(cache.getStats().cacheSize).toBe(0);
      expect(cache.getPriceData()).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        sma: { type: 'sma', params: { period: 20 } },
        ema: { type: 'ema', params: { period: 9 } },
        rsi: { type: 'rsi', params: { period: 14 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      const stats = cache.getStats();

      expect(stats.cacheSize).toBe(3);
      expect(stats.indicatorTypes).toContain('sma');
      expect(stats.indicatorTypes).toContain('ema');
      expect(stats.indicatorTypes).toContain('rsi');
    });

    it('should return empty stats for empty cache', () => {
      const stats = cache.getStats();

      expect(stats.cacheSize).toBe(0);
      expect(stats.indicatorTypes).toEqual([]);
    });
  });

  describe('getPriceData', () => {
    it('should return null when not initialized', () => {
      expect(cache.getPriceData()).toBeNull();
    });

    it('should return parsed price data after initialization', () => {
      const klines = createMockKlines(3);
      cache.initialize(klines);

      const priceData = cache.getPriceData();

      expect(priceData).not.toBeNull();
      expect(priceData!.open[0]).toBe(50000);
      expect(priceData!.close[0]).toBe(50100);
    });
  });
});
