import { describe, it, expect, vi, beforeEach } from 'vitest';
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

import { checkChoppinessCondition, CHOPPINESS_FILTER } from '../utils/filters/choppiness-filter';

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

const createKlines = (count: number, basePrice = 100): Kline[] =>
  Array.from({ length: count }, (_, i) => createKline(basePrice + i * 0.1, i));

const setupChoppinessMocks = (targetChoppiness: number | null, klineCount: number, period = 14) => {
  if (targetChoppiness === null) {
    mockCompute.mockImplementation((type: string) => {
      if (type === 'atr') return Promise.resolve(Array(klineCount).fill(null));
      if (type === 'highest') return Promise.resolve(Array(klineCount).fill(null));
      if (type === 'lowest') return Promise.resolve(Array(klineCount).fill(null));
      return Promise.resolve([]);
    });
    return;
  }

  const atrPerBar = 2.0;
  const atrSum = atrPerBar * period;
  const ratio = Math.pow(period, targetChoppiness / 100);
  const range = atrSum / ratio;

  const highValue = 100 + range;
  const lowValue = 100;

  const atrValues: (number | null)[] = Array.from({ length: klineCount }, (_, i) =>
    i >= 1 ? atrPerBar : null
  );
  const highestValues: (number | null)[] = Array.from({ length: klineCount }, (_, i) =>
    i >= period - 1 ? highValue : null
  );
  const lowestValues: (number | null)[] = Array.from({ length: klineCount }, (_, i) =>
    i >= period - 1 ? lowValue : null
  );

  mockCompute.mockImplementation((type: string) => {
    if (type === 'atr') return Promise.resolve(atrValues);
    if (type === 'highest') return Promise.resolve(highestValues);
    if (type === 'lowest') return Promise.resolve(lowestValues);
    return Promise.resolve([]);
  });
};

describe('checkChoppinessCondition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('insufficient klines', () => {
    it('should return soft pass when klines < period', async () => {
      const result = await checkChoppinessCondition(createKlines(5));

      expect(result.isAllowed).toBe(true);
      expect(result.choppinessValue).toBeNull();
      expect(result.isChoppy).toBe(false);
      expect(result.isTrending).toBe(false);
      expect(result.reason).toContain('Insufficient klines');
      expect(result.reason).toContain('5');
    });

    it('should not call PineIndicatorService.compute for insufficient klines', async () => {
      await checkChoppinessCondition(createKlines(3));
      expect(mockCompute).not.toHaveBeenCalled();
    });
  });

  describe('invalid calculation result', () => {
    it('should return soft pass when all indicator values are null', async () => {
      setupChoppinessMocks(null, 20);
      const result = await checkChoppinessCondition(createKlines(20));

      expect(result.isAllowed).toBe(true);
      expect(result.choppinessValue).toBeNull();
      expect(result.reason).toContain('invalid value');
    });

    it('should return soft pass when range is zero', async () => {
      mockCompute.mockImplementation((type: string) => {
        if (type === 'atr') return Promise.resolve(Array.from({ length: 20 }, (_, i) => i >= 1 ? 1.0 : null));
        if (type === 'highest') return Promise.resolve(Array.from({ length: 20 }, (_, i) => i >= 13 ? 100 : null));
        if (type === 'lowest') return Promise.resolve(Array.from({ length: 20 }, (_, i) => i >= 13 ? 100 : null));
        return Promise.resolve([]);
      });
      const result = await checkChoppinessCondition(createKlines(20));

      expect(result.isAllowed).toBe(true);
      expect(result.choppinessValue).toBeNull();
    });
  });

  describe('choppy market (high choppiness)', () => {
    it('should block trade when choppiness > high threshold', async () => {
      setupChoppinessMocks(65.0, 20);
      const result = await checkChoppinessCondition(createKlines(20));

      expect(result.isAllowed).toBe(false);
      expect(result.choppinessValue).not.toBeNull();
      expect(result.choppinessValue!).toBeCloseTo(65.0, 1);
      expect(result.isChoppy).toBe(true);
      expect(result.isTrending).toBe(false);
      expect(result.reason).toContain('choppy');
    });

    it('should block at exactly above threshold', async () => {
      setupChoppinessMocks(61.81, 20);
      const result = await checkChoppinessCondition(createKlines(20));

      expect(result.isAllowed).toBe(false);
      expect(result.isChoppy).toBe(true);
    });
  });

  describe('trending market (low choppiness)', () => {
    it('should allow trade and flag as trending when choppiness < low threshold', async () => {
      setupChoppinessMocks(30.0, 20);
      const result = await checkChoppinessCondition(createKlines(20));

      expect(result.isAllowed).toBe(true);
      expect(result.choppinessValue).not.toBeNull();
      expect(result.choppinessValue!).toBeCloseTo(30.0, 1);
      expect(result.isChoppy).toBe(false);
      expect(result.isTrending).toBe(true);
      expect(result.reason).toContain('trending');
    });
  });

  describe('neutral market (between thresholds)', () => {
    it('should allow trade when between thresholds', async () => {
      setupChoppinessMocks(50.0, 20);
      const result = await checkChoppinessCondition(createKlines(20));

      expect(result.isAllowed).toBe(true);
      expect(result.choppinessValue).not.toBeNull();
      expect(result.choppinessValue!).toBeCloseTo(50.0, 1);
      expect(result.isChoppy).toBe(false);
      expect(result.isTrending).toBe(false);
      expect(result.reason).toContain('acceptable');
    });

    it('should allow at exactly the high threshold', async () => {
      setupChoppinessMocks(61.79, 20);
      const result = await checkChoppinessCondition(createKlines(20));

      expect(result.isAllowed).toBe(true);
      expect(result.isChoppy).toBe(false);
    });

    it('should allow at exactly the low threshold', async () => {
      setupChoppinessMocks(38.2, 20);
      const result = await checkChoppinessCondition(createKlines(20));

      expect(result.isAllowed).toBe(true);
      expect(result.isTrending).toBe(false);
    });
  });

  describe('custom thresholds and period', () => {
    it('should use custom thresholds', async () => {
      setupChoppinessMocks(55.0, 20);
      const result = await checkChoppinessCondition(createKlines(20), 50, 30, 14);

      expect(result.isAllowed).toBe(false);
      expect(result.isChoppy).toBe(true);
    });

    it('should use custom period for kline check', async () => {
      const result = await checkChoppinessCondition(createKlines(8), 61.8, 38.2, 10);

      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('Insufficient');
      expect(mockCompute).not.toHaveBeenCalled();
    });

    it('should pass custom period to PineIndicatorService.compute', async () => {
      setupChoppinessMocks(45.0, 30, 25);
      await checkChoppinessCondition(createKlines(30), 61.8, 38.2, 25);

      expect(mockCompute).toHaveBeenCalledWith('highest', expect.any(Array), { period: 25 });
      expect(mockCompute).toHaveBeenCalledWith('lowest', expect.any(Array), { period: 25 });
      expect(mockCompute).toHaveBeenCalledWith('atr', expect.any(Array), { period: 1 });
    });
  });

  describe('CHOPPINESS_FILTER constants', () => {
    it('should export correct default values', () => {
      expect(CHOPPINESS_FILTER.HIGH_THRESHOLD).toBe(61.8);
      expect(CHOPPINESS_FILTER.LOW_THRESHOLD).toBe(38.2);
      expect(CHOPPINESS_FILTER.DEFAULT_PERIOD).toBe(14);
    });
  });

  describe('uses last choppiness value', () => {
    it('should compute choppiness from PineTS indicator values and use last value', async () => {
      setupChoppinessMocks(30.0, 20);
      const result = await checkChoppinessCondition(createKlines(20));

      expect(result.choppinessValue).not.toBeNull();
      expect(result.isTrending).toBe(true);
    });
  });
});
