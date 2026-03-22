import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  ComputedIndicators,
  FibonacciProjectionData,
  Kline,
  SetupDirection,
} from '@marketmind/types';

vi.mock('../../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

vi.mock('@marketmind/indicators', () => ({
  calculateFibonacciProjection: vi.fn().mockReturnValue(null),
  selectDynamicFibonacciLevel: vi.fn().mockReturnValue({ level: 1.618, reason: 'default' }),
}));

import {
  calculateFibonacciProjectionData,
  validateFibonacciEntryProgress,
  extractTriggerCandles,
  extractIndicatorValues,
} from '../FibonacciHelper';
import { calculateFibonacciProjection, selectDynamicFibonacciLevel } from '@marketmind/indicators';
import type { IndicatorEngine } from '../IndicatorEngine';

const createMockKline = (close: number, index: number): Kline => {
  const baseTime = new Date('2024-01-01').getTime() + index * 3600000;
  return {
    openTime: baseTime,
    closeTime: baseTime + 3599999,
    open: (close - 1).toString(),
    high: (close + 2).toString(),
    low: (close - 2).toString(),
    close: close.toString(),
    volume: '1000',
    quoteVolume: (1000 * close).toString(),
    trades: 100,
    takerBuyBaseVolume: '500',
    takerBuyQuoteVolume: (500 * close).toString(),
  };
};

const generateKlines = (count: number, basePrice: number = 100): Kline[] =>
  Array.from({ length: count }, (_, i) => createMockKline(basePrice + i, i));

describe('FibonacciHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateFibonacciProjectionData', () => {
    const mockIndicatorEngine = {
      resolveIndicatorValue: vi.fn().mockReturnValue(null),
    } as unknown as IndicatorEngine;

    it('should return undefined when projection is null', () => {
      vi.mocked(calculateFibonacciProjection).mockReturnValue(null);
      const klines = generateKlines(30);
      const result = calculateFibonacciProjectionData(
        klines, 25, 'LONG', {}, undefined, 'nearest', mockIndicatorEngine, true
      );
      expect(result).toBeUndefined();
    });

    it('should return projection data when calculation succeeds', () => {
      const mockProjection = {
        swingLow: { price: 90, index: 5, timestamp: 1000 },
        swingHigh: { price: 110, index: 15, timestamp: 2000 },
        levels: [
          { level: 0.618, price: 102.36, label: '0.618' },
          { level: 1.0, price: 110, label: '1.0' },
          { level: 1.618, price: 122.36, label: '1.618' },
        ],
        range: 20,
      };
      vi.mocked(calculateFibonacciProjection).mockReturnValue(mockProjection);
      const klines = generateKlines(30);
      const result = calculateFibonacciProjectionData(
        klines, 25, 'LONG', {}, undefined, 'nearest', mockIndicatorEngine, true
      );
      expect(result).toBeDefined();
      expect(result?.swingLow.price).toBe(90);
      expect(result?.swingHigh.price).toBe(110);
      expect(result?.levels).toHaveLength(3);
      expect(result?.range).toBe(20);
      expect(result?.primaryLevel).toBe(1.618);
    });

    it('should use interval as lookback when provided', () => {
      vi.mocked(calculateFibonacciProjection).mockReturnValue(null);
      const klines = generateKlines(30);
      calculateFibonacciProjectionData(
        klines, 25, 'LONG', {}, '4h' as any, 'extended', mockIndicatorEngine, true
      );
      expect(calculateFibonacciProjection).toHaveBeenCalledWith(klines, 25, '4h', 'LONG', 'extended');
    });

    it('should use default lookback (100) when interval is undefined', () => {
      vi.mocked(calculateFibonacciProjection).mockReturnValue(null);
      const klines = generateKlines(30);
      calculateFibonacciProjectionData(
        klines, 25, 'LONG', {}, undefined, 'nearest', mockIndicatorEngine, true
      );
      expect(calculateFibonacciProjection).toHaveBeenCalledWith(klines, 25, 100, 'LONG', 'nearest');
    });

    it('should use dynamic fibonacci level when ADX and ATR are available', () => {
      const mockProjection = {
        swingLow: { price: 90, index: 5, timestamp: 1000 },
        swingHigh: { price: 110, index: 15, timestamp: 2000 },
        levels: [{ level: 1.618, price: 122.36, label: '1.618' }],
        range: 20,
      };
      vi.mocked(calculateFibonacciProjection).mockReturnValue(mockProjection);
      vi.mocked(selectDynamicFibonacciLevel).mockReturnValue({ level: 2.618, reason: 'strong_trend' });

      const mockEngine = {
        resolveIndicatorValue: vi.fn().mockImplementation((_indicators: ComputedIndicators, type: string) => {
          if (type === 'adx') return 30;
          if (type === 'atr') return 5;
          return null;
        }),
      } as unknown as IndicatorEngine;

      const klines = generateKlines(30);
      const result = calculateFibonacciProjectionData(
        klines, 25, 'LONG', {}, undefined, 'nearest', mockEngine, false
      );
      expect(result?.primaryLevel).toBe(2.618);
      expect(selectDynamicFibonacciLevel).toHaveBeenCalled();
    });

    it('should default to 1.618 when ADX is null', () => {
      const mockProjection = {
        swingLow: { price: 90, index: 5, timestamp: 1000 },
        swingHigh: { price: 110, index: 15, timestamp: 2000 },
        levels: [],
        range: 20,
      };
      vi.mocked(calculateFibonacciProjection).mockReturnValue(mockProjection);

      const mockEngine = {
        resolveIndicatorValue: vi.fn().mockReturnValue(null),
      } as unknown as IndicatorEngine;

      const klines = generateKlines(30);
      const result = calculateFibonacciProjectionData(
        klines, 25, 'LONG', {}, undefined, 'nearest', mockEngine, false
      );
      expect(result?.primaryLevel).toBe(1.618);
    });
  });

  describe('validateFibonacciEntryProgress', () => {
    const fibProjection: FibonacciProjectionData = {
      swingLow: { price: 90, index: 5, timestamp: 1000 },
      swingHigh: { price: 110, index: 15, timestamp: 2000 },
      levels: [],
      range: 20,
      primaryLevel: 1.618,
    };

    it('should return valid with progress 0 when no projection', () => {
      const result = validateFibonacciEntryProgress(100, undefined, 'LONG', 80, true);
      expect(result.valid).toBe(true);
      expect(result.progress).toBe(0);
    });

    it('should return valid when swing range is zero', () => {
      const zeroRange: FibonacciProjectionData = {
        ...fibProjection,
        swingLow: { price: 100, index: 5, timestamp: 1000 },
        swingHigh: { price: 100, index: 15, timestamp: 2000 },
      };
      const result = validateFibonacciEntryProgress(100, zeroRange, 'LONG', 80, true);
      expect(result.valid).toBe(true);
      expect(result.reason).toBe('invalid_swing_range');
    });

    it('should return valid when swing range is negative', () => {
      const negRange: FibonacciProjectionData = {
        ...fibProjection,
        swingLow: { price: 110, index: 5, timestamp: 1000 },
        swingHigh: { price: 90, index: 15, timestamp: 2000 },
      };
      const result = validateFibonacciEntryProgress(100, negRange, 'LONG', 80, true);
      expect(result.valid).toBe(true);
      expect(result.reason).toBe('invalid_swing_range');
    });

    it('should calculate correct progress for LONG', () => {
      const result = validateFibonacciEntryProgress(100, fibProjection, 'LONG', 80, true);
      expect(result.progress).toBe(50);
      expect(result.valid).toBe(true);
    });

    it('should calculate correct progress for SHORT', () => {
      const result = validateFibonacciEntryProgress(100, fibProjection, 'SHORT', 80, true);
      expect(result.progress).toBe(50);
      expect(result.valid).toBe(true);
    });

    it('should reject when progress exceeds maxProgress for LONG', () => {
      const result = validateFibonacciEntryProgress(108, fibProjection, 'LONG', 80, true);
      expect(result.progress).toBe(90);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('entry_above_max_fib_level');
    });

    it('should reject when progress exceeds maxProgress for SHORT', () => {
      const result = validateFibonacciEntryProgress(92, fibProjection, 'SHORT', 80, true);
      expect(result.progress).toBe(90);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('entry_above_max_fib_level');
    });

    it('should accept entry at exact maxProgress boundary', () => {
      const result = validateFibonacciEntryProgress(106, fibProjection, 'LONG', 80, true);
      expect(result.progress).toBe(80);
      expect(result.valid).toBe(true);
    });

    it('should accept entry at swing low for LONG (0% progress)', () => {
      const result = validateFibonacciEntryProgress(90, fibProjection, 'LONG', 80, true);
      expect(result.progress).toBe(0);
      expect(result.valid).toBe(true);
    });

    it('should accept entry at swing high for SHORT (0% progress)', () => {
      const result = validateFibonacciEntryProgress(110, fibProjection, 'SHORT', 80, true);
      expect(result.progress).toBe(0);
      expect(result.valid).toBe(true);
    });
  });

  describe('extractTriggerCandles', () => {
    it('should extract candles with correct offsets', () => {
      const klines = generateKlines(10);
      const result = extractTriggerCandles(klines, 8, 3);
      expect(result).toHaveLength(3);
      expect(result[0]?.offset).toBe(-2);
      expect(result[1]?.offset).toBe(-1);
      expect(result[2]?.offset).toBe(0);
    });

    it('should handle lookback of 1 (only current candle)', () => {
      const klines = generateKlines(10);
      const result = extractTriggerCandles(klines, 5, 1);
      expect(result).toHaveLength(1);
      expect(result[0]?.offset).toBe(-0);
    });

    it('should handle edge case when currentIndex is 0', () => {
      const klines = generateKlines(10);
      const result = extractTriggerCandles(klines, 0, 3);
      expect(result).toHaveLength(1);
      expect(result[0]?.offset).toBe(0);
    });

    it('should skip indices below 0', () => {
      const klines = generateKlines(5);
      const result = extractTriggerCandles(klines, 1, 5);
      expect(result).toHaveLength(2);
      expect(result[0]?.offset).toBe(-1);
      expect(result[1]?.offset).toBe(0);
    });

    it('should skip indices beyond klines length', () => {
      const klines = generateKlines(3);
      const result = extractTriggerCandles(klines, 5, 2);
      expect(result).toHaveLength(0);
    });

    it('should parse string values to numbers', () => {
      const klines = generateKlines(5);
      const result = extractTriggerCandles(klines, 2, 1);
      expect(typeof result[0]?.close).toBe('number');
      expect(typeof result[0]?.open).toBe('number');
      expect(typeof result[0]?.high).toBe('number');
      expect(typeof result[0]?.low).toBe('number');
      expect(typeof result[0]?.volume).toBe('number');
    });

    it('should return empty array for empty klines', () => {
      const result = extractTriggerCandles([], 0, 3);
      expect(result).toHaveLength(0);
    });
  });

  describe('extractIndicatorValues', () => {
    it('should extract simple array indicator values', () => {
      const indicators: ComputedIndicators = {
        rsi: { values: [null, 45, 55, 65] },
      };
      const result = extractIndicatorValues(indicators, 3);
      expect(result['rsi']).toBe(65);
      expect(result['rsiPrev']).toBe(55);
      expect(result['rsiPrev2']).toBe(45);
    });

    it('should handle null current value', () => {
      const indicators: ComputedIndicators = {
        rsi: { values: [null, 45, null] },
      };
      const result = extractIndicatorValues(indicators, 2);
      expect(result['rsi']).toBeUndefined();
      expect(result['rsiPrev']).toBe(45);
    });

    it('should handle sub-values (MACD-like indicators)', () => {
      const indicators: ComputedIndicators = {
        macd: {
          values: {
            macd: [null, 1.5, 2.0, 2.5],
            signal: [null, 1.0, 1.3, 1.8],
            histogram: [null, 0.5, 0.7, 0.7],
          },
        },
      };
      const result = extractIndicatorValues(indicators, 3);
      expect(result['macd.macd']).toBe(2.5);
      expect(result['macd.macdPrev']).toBe(2.0);
      expect(result['macd.signal']).toBe(1.8);
      expect(result['macd.signalPrev']).toBe(1.3);
    });

    it('should skip indicators starting with underscore', () => {
      const indicators: ComputedIndicators = {
        _internal: { values: [1, 2, 3] },
        rsi: { values: [30, 40, 50] },
      };
      const result = extractIndicatorValues(indicators, 2);
      expect(result['_internal']).toBeUndefined();
      expect(result['rsi']).toBe(50);
    });

    it('should handle index 0 (no prev values)', () => {
      const indicators: ComputedIndicators = {
        rsi: { values: [50] },
      };
      const result = extractIndicatorValues(indicators, 0);
      expect(result['rsi']).toBe(50);
      expect(result['rsiPrev']).toBeUndefined();
      expect(result['rsiPrev2']).toBeUndefined();
    });

    it('should handle index 1 (no prev2)', () => {
      const indicators: ComputedIndicators = {
        rsi: { values: [40, 50] },
      };
      const result = extractIndicatorValues(indicators, 1);
      expect(result['rsi']).toBe(50);
      expect(result['rsiPrev']).toBe(40);
      expect(result['rsiPrev2']).toBeUndefined();
    });

    it('should handle empty indicators', () => {
      const result = extractIndicatorValues({}, 5);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should skip undefined values in sub-keys', () => {
      const indicators: ComputedIndicators = {
        macd: {
          values: {
            macd: [null, null, undefined as any],
            signal: [null, null, 1.5],
          },
        },
      };
      const result = extractIndicatorValues(indicators, 2);
      expect(result['macd.macd']).toBeUndefined();
      expect(result['macd.signal']).toBe(1.5);
    });
  });
});
