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
    trend: ['up', 'down'],
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
  calculateStochastic,
  calculateADX,
  calculateCCI,
  calculateKeltner,
  calculateSupertrend,
  calculateDonchian,
  calculateIBS,
  calculateCumulativeRSI,
  calculateNR7,
  calculateNDayHighLow,
  calculatePercentBSeries,
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

describe('IndicatorCache - Extended Coverage', () => {
  let cache: IndicatorCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new IndicatorCache();
  });

  describe('Stochastic indicator computation', () => {
    it('should compute stochastic indicator with default params', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        stoch: { type: 'stochastic', params: { kPeriod: 14, kSmoothing: 3, dPeriod: 3 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateStochastic).toHaveBeenCalled();
      const result = cache.get('stochastic', { kPeriod: 14, kSmoothing: 3, dPeriod: 3 });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('stochastic');
      expect(result!.values).toHaveProperty('k');
      expect(result!.values).toHaveProperty('d');
    });

    it('should use default params when not specified', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        stoch: { type: 'stochastic', params: {} },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateStochastic).toHaveBeenCalledWith(
        expect.anything(),
        14,
        3,
        3
      );
    });
  });

  describe('ADX indicator computation', () => {
    it('should compute ADX indicator', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        adx: { type: 'adx', params: { period: 14 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateADX).toHaveBeenCalled();
      const result = cache.get('adx', { period: 14 });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('adx');
      expect(result!.values).toHaveProperty('adx');
      expect(result!.values).toHaveProperty('plusDI');
      expect(result!.values).toHaveProperty('minusDI');
    });

    it('should use default ADX period when not specified', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        adx: { type: 'adx', params: {} },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateADX).toHaveBeenCalledWith(expect.anything(), 14);
    });
  });

  describe('CCI indicator computation', () => {
    it('should compute CCI indicator', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        cci: { type: 'cci', params: { period: 20 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateCCI).toHaveBeenCalled();
      const result = cache.get('cci', { period: 20 });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('cci');
      expect(result!.values).toEqual([50, 100, 150]);
    });

    it('should use default CCI period when not specified', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        cci: { type: 'cci', params: {} },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateCCI).toHaveBeenCalledWith(expect.anything(), 20);
    });
  });

  describe('Keltner channel computation', () => {
    it('should compute Keltner channels', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        keltner: { type: 'keltner', params: { emaPeriod: 20, atrPeriod: 10, multiplier: 2 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateKeltner).toHaveBeenCalled();
      const result = cache.get('keltner', { emaPeriod: 20, atrPeriod: 10, multiplier: 2 });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('keltner');
      expect(result!.values).toHaveProperty('upper');
      expect(result!.values).toHaveProperty('middle');
      expect(result!.values).toHaveProperty('lower');
    });

    it('should use default Keltner params when not specified', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        keltner: { type: 'keltner', params: {} },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateKeltner).toHaveBeenCalledWith(
        expect.anything(),
        20,
        10,
        2
      );
    });
  });

  describe('Supertrend indicator computation', () => {
    it('should compute Supertrend indicator', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        supertrend: { type: 'supertrend', params: { period: 10, multiplier: 3 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateSupertrend).toHaveBeenCalled();
      const result = cache.get('supertrend', { period: 10, multiplier: 3 });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('supertrend');
      expect(result!.values).toHaveProperty('value');
      expect(result!.values).toHaveProperty('trend');
    });

    it('should convert trend strings to numeric values', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        supertrend: { type: 'supertrend', params: { period: 10, multiplier: 3 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      const result = cache.get('supertrend', { period: 10, multiplier: 3 });
      const trendValues = (result!.values as { trend: (number | null)[] }).trend;
      expect(trendValues[0]).toBe(1);
      expect(trendValues[1]).toBe(-1);
    });

    it('should use default Supertrend params when not specified', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        supertrend: { type: 'supertrend', params: {} },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateSupertrend).toHaveBeenCalledWith(
        expect.anything(),
        10,
        3
      );
    });
  });

  describe('Donchian channel computation', () => {
    it('should compute Donchian channels', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        donchian: { type: 'donchian', params: { period: 20 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateDonchian).toHaveBeenCalled();
      const result = cache.get('donchian', { period: 20 });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('donchian');
      expect(result!.values).toHaveProperty('upper');
      expect(result!.values).toHaveProperty('middle');
      expect(result!.values).toHaveProperty('lower');
    });

    it('should use default Donchian period when not specified', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        donchian: { type: 'donchian', params: {} },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateDonchian).toHaveBeenCalledWith(expect.anything(), 20);
    });
  });

  describe('IBS indicator computation', () => {
    it('should compute IBS indicator', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        ibs: { type: 'ibs', params: {} },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateIBS).toHaveBeenCalled();
      const result = cache.get('ibs', {});
      expect(result).not.toBeNull();
      expect(result!.type).toBe('ibs');
      expect(result!.values).toEqual([0.3, 0.5, 0.7]);
    });
  });

  describe('Cumulative RSI computation', () => {
    it('should compute Cumulative RSI indicator', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        cumRsi: { type: 'cumulativeRsi', params: { rsiPeriod: 2, cumulativePeriod: 2 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateCumulativeRSI).toHaveBeenCalled();
      const result = cache.get('cumulativeRsi', { rsiPeriod: 2, cumulativePeriod: 2 });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('cumulativeRsi');
      expect(result!.values).toEqual([25, 50, 75]);
    });

    it('should use default Cumulative RSI params when not specified', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        cumRsi: { type: 'cumulativeRsi', params: {} },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateCumulativeRSI).toHaveBeenCalledWith(
        expect.anything(),
        2,
        2
      );
    });
  });

  describe('NR7 indicator computation', () => {
    it('should compute NR7 indicator', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        nr7: { type: 'nr7', params: {} },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateNR7).toHaveBeenCalled();
      const result = cache.get('nr7', {});
      expect(result).not.toBeNull();
      expect(result!.type).toBe('nr7');
      expect(result!.values).toEqual([0, 1, 0]);
    });
  });

  describe('N-Day High/Low computation', () => {
    it('should compute N-Day High/Low indicator', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        ndhl: { type: 'nDayHighLow', params: { days: 7 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateNDayHighLow).toHaveBeenCalled();
      const result = cache.get('nDayHighLow', { days: 7 });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('nDayHighLow');
      expect(result!.values).toHaveProperty('isNDayHigh');
      expect(result!.values).toHaveProperty('isNDayLow');
      expect(result!.values).toHaveProperty('highestClose');
      expect(result!.values).toHaveProperty('lowestClose');
    });

    it('should convert boolean arrays to numeric arrays', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        ndhl: { type: 'nDayHighLow', params: { days: 7 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      const result = cache.get('nDayHighLow', { days: 7 });
      const values = result!.values as {
        isNDayHigh: number[];
        isNDayLow: number[];
      };
      expect(values.isNDayHigh).toEqual([0, 1, 0]);
      expect(values.isNDayLow).toEqual([1, 0, 0]);
    });

    it('should use default days when not specified', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        ndhl: { type: 'nDayHighLow', params: {} },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculateNDayHighLow).toHaveBeenCalledWith(expect.anything(), 7);
    });
  });

  describe('Percent B computation', () => {
    it('should compute Percent B indicator', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        percentB: { type: 'percentB', params: { period: 20, stdDev: 2 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculatePercentBSeries).toHaveBeenCalled();
      const result = cache.get('percentB', { period: 20, stdDev: 2 });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('percentB');
      expect(result!.values).toEqual([0.2, 0.5, 0.8]);
    });

    it('should use default Percent B params when not specified', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        percentB: { type: 'percentB', params: {} },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(calculatePercentBSeries).toHaveBeenCalledWith(
        expect.anything(),
        20,
        2
      );
    });
  });

  describe('Unknown indicator type', () => {
    it('should return null for unknown indicator type', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        unknown: { type: 'unknownType' as any, params: {} },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      expect(cache.getStats().cacheSize).toBe(0);
    });
  });

  describe('resolveParams edge cases', () => {
    it('should resolve to 0 when parameter reference not found in global or strategy params', () => {
      const klines = createMockKlines(30);
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        author: 'test',
        parameters: {},
        indicators: {
          sma: { type: 'sma', params: { period: '$missingParam' } },
        },
        entry: {},
        exit: { stopLoss: { type: 'percent', value: 2 } },
      };

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      const result = cache.get('sma', { period: 0 });
      expect(result).not.toBeNull();
    });

    it('should handle undefined indicatorParams in resolveParams', () => {
      const klines = createMockKlines(30);
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        author: 'test',
        parameters: {},
        indicators: {
          sma: { type: 'sma' },
        },
        entry: {},
        exit: { stopLoss: { type: 'percent', value: 2 } },
      };

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      const result = cache.get('sma', {});
      expect(result).not.toBeNull();
    });

    it('should prefer global params over strategy default params', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        sma: { type: 'sma', params: { period: '$smaPeriod' } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], { smaPeriod: 50 });

      const result = cache.get('sma', { period: 50 });
      expect(result).not.toBeNull();
    });
  });

  describe('getForDefinition with strategyParameters', () => {
    it('should fall back to strategy default when param is not in globalParams', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        sma: { type: 'sma', params: { period: '$smaPeriod' } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      const definition: IndicatorDefinition = { type: 'sma', params: { period: '$smaPeriod' } };
      const result = cache.getForDefinition(
        definition,
        {},
        { smaPeriod: { default: 20 } }
      );

      expect(result).not.toBeNull();
    });
  });

  describe('Multiple indicator types in single strategy', () => {
    it('should compute all different indicator types in one strategy', () => {
      const klines = createMockKlines(30);
      const strategy = createMockStrategy({
        stoch: { type: 'stochastic', params: { kPeriod: 14, kSmoothing: 3, dPeriod: 3 } },
        adx: { type: 'adx', params: { period: 14 } },
        cci: { type: 'cci', params: { period: 20 } },
        keltner: { type: 'keltner', params: { emaPeriod: 20, atrPeriod: 10, multiplier: 2 } },
        supertrend: { type: 'supertrend', params: { period: 10, multiplier: 3 } },
        donchian: { type: 'donchian', params: { period: 20 } },
        ibs: { type: 'ibs', params: {} },
        nr7: { type: 'nr7', params: {} },
        percentB: { type: 'percentB', params: { period: 20, stdDev: 2 } },
      });

      cache.initialize(klines);
      cache.precomputeForStrategies([strategy], {});

      const stats = cache.getStats();
      expect(stats.cacheSize).toBe(9);
      expect(stats.indicatorTypes).toContain('stochastic');
      expect(stats.indicatorTypes).toContain('adx');
      expect(stats.indicatorTypes).toContain('cci');
      expect(stats.indicatorTypes).toContain('keltner');
      expect(stats.indicatorTypes).toContain('supertrend');
      expect(stats.indicatorTypes).toContain('donchian');
      expect(stats.indicatorTypes).toContain('ibs');
      expect(stats.indicatorTypes).toContain('nr7');
      expect(stats.indicatorTypes).toContain('percentB');
    });
  });
});
