import { describe, it, expect, vi } from 'vitest';
import type { Kline } from '@marketmind/types';

const { mockCompute, mockComputeMulti } = vi.hoisted(() => ({
  mockCompute: vi.fn(),
  mockComputeMulti: vi.fn(),
}));

vi.mock('../services/pine/PineIndicatorService', () => ({
  PineIndicatorService: class {
    compute = mockCompute;
    computeMulti = mockComputeMulti;
  },
}));

import { checkDirectionFilter, DIRECTION_FILTER } from '../utils/filters/direction-filter';

const createKline = (close: number, index: number): Kline => ({
  openTime: Date.now() + index * 60000,
  open: String(close),
  high: String(close + 1),
  low: String(close - 1),
  close: String(close),
  volume: '1000',
  closeTime: Date.now() + (index + 1) * 60000 - 1,
  quoteVolume: '10000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '5000',
});

const createKlines = (count: number, lastClose = 100): Kline[] =>
  Array.from({ length: count }, (_, i) =>
    createKline(i === count - 1 ? lastClose : 100, i),
  );

const createKlinesPrev = (count: number, prevClose: number, lastClose = prevClose): Kline[] =>
  Array.from({ length: count }, (_, i) =>
    createKline(
      i === count - 1 ? lastClose : i === count - 2 ? prevClose : 100,
      i,
    ),
  );

const buildEmaArray = (length: number, lastValue: number, slopeDirection: 'up' | 'down' | 'flat' = 'flat'): (number | null)[] => {
  const arr: (number | null)[] = new Array(length).fill(null);
  const lookback = DIRECTION_FILTER.SLOPE_LOOKBACK;
  const startIdx = length - lookback;

  for (let i = 0; i < lookback; i++) {
    let val: number;
    if (slopeDirection === 'up') {
      val = lastValue - (lookback - 1 - i) * (lastValue * 0.002);
    } else if (slopeDirection === 'down') {
      val = lastValue + (lookback - 1 - i) * (lastValue * 0.002);
    } else {
      val = lastValue;
    }
    arr[startIdx + i] = val;
  }
  arr[length - 1] = lastValue;
  return arr;
};

describe('checkDirectionFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('insufficient klines', () => {
    it('should return soft pass when klines < MIN_KLINES_REQUIRED', async () => {
      const klines = createKlines(100, 50);
      const result = await checkDirectionFilter(klines, 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.direction).toBe('NEUTRAL');
      expect(result.ema200).toBeNull();
      expect(result.ema200Slope).toBeNull();
      expect(result.reason).toContain('Insufficient');
    });

    it('should return current price even with insufficient klines', async () => {
      const klines = createKlines(100, 50);
      const result = await checkDirectionFilter(klines, 'LONG');

      expect(result.currentPrice).toBe(50);
    });

    it('should return 0 for currentPrice when klines array is empty', async () => {
      const result = await checkDirectionFilter([], 'LONG');

      expect(result.currentPrice).toBe(0);
      expect(result.isAllowed).toBe(true);
    });
  });

  describe('invalid EMA calculation', () => {
    it('should return soft pass when EMA200 is null', async () => {
      const klines = createKlines(220, 100);
      mockCompute.mockResolvedValue(new Array(220).fill(null));
      const result = await checkDirectionFilter(klines, 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.direction).toBe('NEUTRAL');
      expect(result.reason).toContain('EMA200 calculation incomplete');
    });

    it('should return soft pass when EMA200 is NaN', async () => {
      const klines = createKlines(220, 100);
      const emaValues = new Array(220).fill(100);
      emaValues[218] = NaN;
      mockCompute.mockResolvedValue(emaValues);
      const result = await checkDirectionFilter(klines, 'LONG');

      expect(result.isAllowed).toBe(true);
    });

    it('should return soft pass when EMA200 is 0', async () => {
      const klines = createKlines(220, 100);
      const emaValues = new Array(220).fill(100);
      emaValues[218] = 0;
      mockCompute.mockResolvedValue(emaValues);
      const result = await checkDirectionFilter(klines, 'LONG');

      expect(result.isAllowed).toBe(true);
    });
  });

  describe('BULLISH market', () => {
    it('should allow LONG in bullish market (price above EMA, positive slope)', async () => {
      const klines = createKlines(220, 110);
      mockCompute.mockResolvedValue(buildEmaArray(220, 100, 'up'));
      const result = await checkDirectionFilter(klines, 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.direction).toBe('BULLISH');
      expect(result.reason).toContain('LONG allowed');
    });

    it('should block SHORT in bullish market by default', async () => {
      const klines = createKlines(220, 110);
      mockCompute.mockResolvedValue(buildEmaArray(220, 100, 'up'));
      const result = await checkDirectionFilter(klines, 'SHORT');

      expect(result.isAllowed).toBe(false);
      expect(result.direction).toBe('BULLISH');
      expect(result.reason).toContain('SHORT blocked');
      expect(result.reason).toContain('BULLISH');
    });

    it('should allow SHORT in bullish market when override enabled', async () => {
      const klines = createKlines(220, 110);
      mockCompute.mockResolvedValue(buildEmaArray(220, 100, 'up'));
      const result = await checkDirectionFilter(klines, 'SHORT', { enableShortInBullMarket: true });

      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('override enabled');
    });
  });

  describe('BEARISH market', () => {
    it('should block LONG in bearish market by default', async () => {
      const klines = createKlines(220, 90);
      mockCompute.mockResolvedValue(buildEmaArray(220, 100, 'down'));
      const result = await checkDirectionFilter(klines, 'LONG');

      expect(result.isAllowed).toBe(false);
      expect(result.direction).toBe('BEARISH');
      expect(result.reason).toContain('LONG blocked');
      expect(result.reason).toContain('BEARISH');
    });

    it('should allow LONG in bearish market when override enabled', async () => {
      const klines = createKlines(220, 90);
      mockCompute.mockResolvedValue(buildEmaArray(220, 100, 'down'));
      const result = await checkDirectionFilter(klines, 'LONG', { enableLongInBearMarket: true });

      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('override enabled');
    });

    it('should allow SHORT in bearish market', async () => {
      const klines = createKlines(220, 90);
      mockCompute.mockResolvedValue(buildEmaArray(220, 100, 'down'));
      const result = await checkDirectionFilter(klines, 'SHORT');

      expect(result.isAllowed).toBe(true);
      expect(result.direction).toBe('BEARISH');
    });
  });

  describe('NEUTRAL market', () => {
    it('should allow LONG when price above EMA with flat slope (classified BULLISH)', async () => {
      const klines = createKlinesPrev(220, 101);
      mockCompute.mockResolvedValue(buildEmaArray(220, 100, 'flat'));
      const result = await checkDirectionFilter(klines, 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.direction).toBe('BULLISH');
    });

    it('should allow SHORT when price below EMA with flat slope (classified BEARISH)', async () => {
      const klines = createKlinesPrev(220, 99);
      mockCompute.mockResolvedValue(buildEmaArray(220, 100, 'flat'));
      const result = await checkDirectionFilter(klines, 'SHORT');

      expect(result.isAllowed).toBe(true);
      expect(result.direction).toBe('BEARISH');
    });
  });

  describe('price vs EMA200 percent', () => {
    it('should calculate correct percentage difference', async () => {
      const klines = createKlinesPrev(220, 110);
      mockCompute.mockResolvedValue(buildEmaArray(220, 100, 'up'));
      const result = await checkDirectionFilter(klines, 'LONG');

      expect(result.priceVsEma200Percent).toBeCloseTo(10.0, 0);
    });
  });

  describe('string close values', () => {
    it('should handle string close values in klines', async () => {
      const klines = createKlinesPrev(220, 110);
      klines[218]!.close = '110' as unknown as string;
      mockCompute.mockResolvedValue(buildEmaArray(220, 100, 'up'));
      const result = await checkDirectionFilter(klines, 'LONG');

      expect(result.currentPrice).toBe(110);
    });
  });

  describe('DIRECTION_FILTER constants', () => {
    it('should export correct default values', () => {
      expect(DIRECTION_FILTER.EMA_PERIOD).toBe(200);
      expect(DIRECTION_FILTER.MIN_KLINES_REQUIRED).toBe(212);
      expect(DIRECTION_FILTER.SLOPE_LOOKBACK).toBe(20);
      expect(DIRECTION_FILTER.SLOPE_THRESHOLD).toBe(0.001);
    });
  });
});
