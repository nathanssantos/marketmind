import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExitContext, ExitLevel, Kline } from '@marketmind/types';

vi.mock('../../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

vi.mock('../../../volatility-profile', () => ({
  calculateATRPercent: vi.fn().mockReturnValue(2.0),
  getVolatilityAdjustedMultiplier: vi.fn((_base) => _base),
}));

vi.mock('@marketmind/indicators', () => ({
  findMostRecentSwingHigh: vi.fn().mockReturnValue(null),
  findMostRecentSwingLow: vi.fn().mockReturnValue(null),
  findSignificantSwingHigh: vi.fn().mockReturnValue(null),
  findSignificantSwingLow: vi.fn().mockReturnValue(null),
}));

import {
  findNearestLocalSwingLow,
  findNearestLocalSwingHigh,
  findSwingLow,
  findSwingHigh,
  calculateSwingHighLowStop,
} from '../exit-swing-helpers';
import {
  findMostRecentSwingHigh,
  findMostRecentSwingLow,
  findSignificantSwingHigh,
  findSignificantSwingLow,
} from '@marketmind/indicators';
import type { IndicatorEngine } from '../IndicatorEngine';

const createMockKline = (close: number, high: number, low: number, index: number): Kline => {
  const baseTime = new Date('2024-01-01').getTime() + index * 3600000;
  return {
    openTime: baseTime,
    closeTime: baseTime + 3599999,
    open: close.toString(),
    high: high.toString(),
    low: low.toString(),
    close: close.toString(),
    volume: '1000',
    quoteVolume: (1000 * close).toString(),
    trades: 100,
    takerBuyBaseVolume: '500',
    takerBuyQuoteVolume: (500 * close).toString(),
  };
};

const generateKlines = (count: number, basePrice: number = 100): Kline[] =>
  Array.from({ length: count }, (_, i) =>
    createMockKline(basePrice + i, basePrice + i + 5, basePrice + i - 5, i)
  );

describe('exit-swing-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findNearestLocalSwingLow', () => {
    it('should return swing price when findMostRecentSwingLow finds a swing', () => {
      vi.mocked(findMostRecentSwingLow).mockReturnValue({ price: 95, index: 15 });
      const klines = generateKlines(30);
      const result = findNearestLocalSwingLow(klines, 25);
      expect(result).toBe(95);
    });

    it('should fall back to findSwingLow when no nearest swing found', () => {
      vi.mocked(findMostRecentSwingLow).mockReturnValue(null);
      vi.mocked(findSignificantSwingLow).mockReturnValue({ price: 90, index: 10 });
      const klines = generateKlines(30);
      const result = findNearestLocalSwingLow(klines, 25);
      expect(result).toBe(90);
    });

    it('should handle null price in swing result', () => {
      vi.mocked(findMostRecentSwingLow).mockReturnValue({ price: 0, index: 15 });
      vi.mocked(findSignificantSwingLow).mockReturnValue({ price: 88, index: 8 });
      const klines = generateKlines(30);
      const result = findNearestLocalSwingLow(klines, 25);
      expect(result).toBe(88);
    });
  });

  describe('findNearestLocalSwingHigh', () => {
    it('should return swing price when findMostRecentSwingHigh finds a swing', () => {
      vi.mocked(findMostRecentSwingHigh).mockReturnValue({ price: 110, index: 18 });
      const klines = generateKlines(30);
      const result = findNearestLocalSwingHigh(klines, 25);
      expect(result).toBe(110);
    });

    it('should fall back to findSwingHigh when no nearest swing found', () => {
      vi.mocked(findMostRecentSwingHigh).mockReturnValue(null);
      vi.mocked(findSignificantSwingHigh).mockReturnValue({ price: 115, index: 12 });
      const klines = generateKlines(30);
      const result = findNearestLocalSwingHigh(klines, 25);
      expect(result).toBe(115);
    });
  });

  describe('findSwingLow', () => {
    it('should return significant swing low when found', () => {
      vi.mocked(findSignificantSwingLow).mockReturnValue({ price: 92, index: 8 });
      const klines = generateKlines(30);
      const result = findSwingLow(klines, 25);
      expect(result).toBe(92);
    });

    it('should fall back to most recent swing low', () => {
      vi.mocked(findSignificantSwingLow).mockReturnValue(null);
      vi.mocked(findMostRecentSwingLow).mockReturnValue({ price: 94, index: 20 });
      const klines = generateKlines(30);
      const result = findSwingLow(klines, 25);
      expect(result).toBe(94);
    });

    it('should fall back to minimum of recent lows when no swings found', () => {
      vi.mocked(findSignificantSwingLow).mockReturnValue(null);
      vi.mocked(findMostRecentSwingLow).mockReturnValue(null);
      const klines = generateKlines(30);
      const result = findSwingLow(klines, 25);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should use current kline low when fallback range is empty', () => {
      vi.mocked(findSignificantSwingLow).mockReturnValue(null);
      vi.mocked(findMostRecentSwingLow).mockReturnValue(null);
      const klines = generateKlines(5);
      const result = findSwingLow(klines, 2, 0);
      expect(typeof result).toBe('number');
    });

    it('should respect skipRecent parameter', () => {
      vi.mocked(findSignificantSwingLow).mockReturnValue(null);
      vi.mocked(findMostRecentSwingLow).mockReturnValue(null);
      const klines = generateKlines(30);
      findSwingLow(klines, 25, 5);
      expect(findSignificantSwingLow).toHaveBeenCalledWith(klines, 20, expect.any(Number));
    });
  });

  describe('findSwingHigh', () => {
    it('should return significant swing high when found', () => {
      vi.mocked(findSignificantSwingHigh).mockReturnValue({ price: 120, index: 10 });
      const klines = generateKlines(30);
      const result = findSwingHigh(klines, 25);
      expect(result).toBe(120);
    });

    it('should fall back to most recent swing high', () => {
      vi.mocked(findSignificantSwingHigh).mockReturnValue(null);
      vi.mocked(findMostRecentSwingHigh).mockReturnValue({ price: 118, index: 20 });
      const klines = generateKlines(30);
      const result = findSwingHigh(klines, 25);
      expect(result).toBe(118);
    });

    it('should fall back to maximum of recent highs when no swings found', () => {
      vi.mocked(findSignificantSwingHigh).mockReturnValue(null);
      vi.mocked(findMostRecentSwingHigh).mockReturnValue(null);
      const klines = generateKlines(30);
      const result = findSwingHigh(klines, 25);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should respect skipRecent parameter', () => {
      vi.mocked(findSignificantSwingHigh).mockReturnValue(null);
      vi.mocked(findMostRecentSwingHigh).mockReturnValue(null);
      const klines = generateKlines(30);
      findSwingHigh(klines, 25, 5);
      expect(findSignificantSwingHigh).toHaveBeenCalledWith(klines, 20, expect.any(Number));
    });
  });

  describe('calculateSwingHighLowStop', () => {
    const mockIndicatorEngine = {
      resolveIndicatorValue: vi.fn().mockReturnValue(2),
    } as unknown as IndicatorEngine;

    const mockResolveOperand = vi.fn().mockReturnValue(1.5);

    const createContext = (overrides: Partial<ExitContext> = {}): ExitContext => ({
      direction: 'LONG',
      entryPrice: 100,
      klines: generateKlines(30),
      currentIndex: 25,
      indicators: {},
      params: {},
      ...overrides,
    });

    const defaultExit: ExitLevel = { type: 'swingHighLow' };

    it('should throw when klines is empty', () => {
      const ctx = createContext({ klines: [], currentIndex: 0 });
      expect(() => calculateSwingHighLowStop(defaultExit, ctx, mockIndicatorEngine, mockResolveOperand))
        .toThrow('Insufficient klines');
    });

    it('should throw when currentIndex is less than 2', () => {
      const ctx = createContext({ currentIndex: 1 });
      expect(() => calculateSwingHighLowStop(defaultExit, ctx, mockIndicatorEngine, mockResolveOperand))
        .toThrow('Insufficient klines');
    });

    it('should calculate stop below entry for LONG direction', () => {
      vi.mocked(findSignificantSwingLow).mockReturnValue({ price: 90, index: 10 });
      const ctx = createContext({ direction: 'LONG', entryPrice: 100 });
      const result = calculateSwingHighLowStop(defaultExit, ctx, mockIndicatorEngine, mockResolveOperand);
      expect(result).toBeLessThan(100);
    });

    it('should calculate stop above entry for SHORT direction', () => {
      vi.mocked(findSignificantSwingHigh).mockReturnValue({ price: 110, index: 10 });
      const ctx = createContext({ direction: 'SHORT', entryPrice: 100 });
      const result = calculateSwingHighLowStop(defaultExit, ctx, mockIndicatorEngine, mockResolveOperand);
      expect(result).toBeGreaterThan(100);
    });

    it('should use fibonacci swing when available and not nearest_swing mode', () => {
      const fibSwing = {
        swingHigh: { price: 115, index: 5, timestamp: 0 },
        swingLow: { price: 85, index: 3, timestamp: 0 },
      };
      const ctx = createContext({
        direction: 'LONG',
        entryPrice: 100,
        fibonacciSwing: fibSwing,
      });
      const result = calculateSwingHighLowStop(defaultExit, ctx, mockIndicatorEngine, mockResolveOperand);
      expect(result).toBeLessThan(100);
    });

    it('should use nearest swing when initialStopMode is nearest_swing', () => {
      vi.mocked(findMostRecentSwingLow).mockReturnValue({ price: 92, index: 20 });
      const fibSwing = {
        swingHigh: { price: 115, index: 5, timestamp: 0 },
        swingLow: { price: 85, index: 3, timestamp: 0 },
      };
      const ctx = createContext({
        direction: 'LONG',
        entryPrice: 100,
        fibonacciSwing: fibSwing,
        initialStopMode: 'nearest_swing',
      });
      const result = calculateSwingHighLowStop(defaultExit, ctx, mockIndicatorEngine, mockResolveOperand);
      expect(result).toBeLessThan(100);
    });

    it('should apply ATR buffer when exit.buffer is specified with indicator atr', () => {
      vi.mocked(findSignificantSwingLow).mockReturnValue({ price: 95, index: 10 });
      const exit: ExitLevel = { type: 'swingHighLow', buffer: 1.5, indicator: 'atr' };
      const ctx = createContext({ direction: 'LONG', entryPrice: 100 });
      const result = calculateSwingHighLowStop(exit, ctx, mockIndicatorEngine, mockResolveOperand);
      expect(result).toBeLessThan(95);
    });

    it('should apply percent buffer when exit.buffer is specified without atr indicator', () => {
      vi.mocked(findSignificantSwingLow).mockReturnValue({ price: 95, index: 10 });
      const exit: ExitLevel = { type: 'swingHighLow', buffer: 1.0 };
      const ctx = createContext({ direction: 'LONG', entryPrice: 100 });
      const result = calculateSwingHighLowStop(exit, ctx, mockIndicatorEngine, mockResolveOperand);
      expect(result).toBeLessThan(95);
    });

    it('should apply default buffer when no buffer is specified', () => {
      vi.mocked(findSignificantSwingLow).mockReturnValue({ price: 95, index: 10 });
      const ctx = createContext({ direction: 'LONG', entryPrice: 100 });
      const result = calculateSwingHighLowStop(defaultExit, ctx, mockIndicatorEngine, mockResolveOperand);
      expect(result).toBeLessThan(95);
    });

    it('should apply fallback when stop is on wrong side for LONG', () => {
      vi.mocked(findSignificantSwingLow).mockReturnValue({ price: 105, index: 10 });
      vi.mocked(findMostRecentSwingLow).mockReturnValue(null);
      const ctx = createContext({ direction: 'LONG', entryPrice: 100 });
      const result = calculateSwingHighLowStop(defaultExit, ctx, mockIndicatorEngine, mockResolveOperand);
      expect(result).toBeLessThan(100);
    });

    it('should apply fallback when stop is on wrong side for SHORT', () => {
      vi.mocked(findSignificantSwingHigh).mockReturnValue({ price: 95, index: 10 });
      vi.mocked(findMostRecentSwingHigh).mockReturnValue(null);
      const ctx = createContext({ direction: 'SHORT', entryPrice: 100 });
      const result = calculateSwingHighLowStop(defaultExit, ctx, mockIndicatorEngine, mockResolveOperand);
      expect(result).toBeGreaterThan(100);
    });

    it('should apply fallback when separation is too small', () => {
      vi.mocked(findSignificantSwingLow).mockReturnValue({ price: 99.9, index: 10 });
      const ctx = createContext({ direction: 'LONG', entryPrice: 100 });
      const result = calculateSwingHighLowStop(defaultExit, ctx, mockIndicatorEngine, mockResolveOperand);
      expect(result).toBeLessThan(100);
      const separation = ((100 - result) / 100) * 100;
      expect(separation).toBeGreaterThanOrEqual(0.5);
    });

    it('should throw when stop is still invalid after fallback (entryPrice = 0 edge)', () => {
      vi.mocked(findSignificantSwingLow).mockReturnValue({ price: 0, index: 10 });
      vi.mocked(findMostRecentSwingLow).mockReturnValue(null);
      const zeroAtrEngine = {
        resolveIndicatorValue: vi.fn().mockReturnValue(0),
      } as unknown as IndicatorEngine;
      const ctx = createContext({ direction: 'LONG', entryPrice: 0, klines: generateKlines(30) });
      expect(() => calculateSwingHighLowStop(defaultExit, ctx, zeroAtrEngine, mockResolveOperand))
        .toThrow();
    });
  });
});
