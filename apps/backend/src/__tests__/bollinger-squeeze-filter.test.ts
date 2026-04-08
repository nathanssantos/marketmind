import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Kline } from '@marketmind/types';

const { mockComputeMulti } = vi.hoisted(() => ({
  mockComputeMulti: vi.fn(),
}));

vi.mock('../services/pine/PineIndicatorService', () => ({
  PineIndicatorService: class {
    compute = vi.fn();
    computeMulti = mockComputeMulti;
  },
}));

import { checkBollingerSqueezeCondition, BOLLINGER_SQUEEZE_FILTER } from '../utils/filters/bollinger-squeeze-filter';

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

const createKlines = (count: number): Kline[] =>
  Array.from({ length: count }, (_, i) => createKline(100 + i * 0.1, i));

describe('checkBollingerSqueezeCondition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('insufficient klines', () => {
    it('should return soft pass when klines < period', async () => {
      const result = await checkBollingerSqueezeCondition(createKlines(10));

      expect(result.isAllowed).toBe(true);
      expect(result.bbWidth).toBeNull();
      expect(result.isSqueezing).toBe(false);
      expect(result.reason).toContain('Insufficient');
    });

    it('should not call computeMulti for insufficient klines', async () => {
      await checkBollingerSqueezeCondition(createKlines(5));
      expect(mockComputeMulti).not.toHaveBeenCalled();
    });

    it('should use custom period for kline check', async () => {
      const result = await checkBollingerSqueezeCondition(createKlines(15), 0.1, 30);

      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('Insufficient');
    });
  });

  describe('null BB calculation', () => {
    it('should return soft pass when computeMulti returns null values', async () => {
      mockComputeMulti.mockResolvedValue({ upper: [null], middle: [null], lower: [null] });
      const result = await checkBollingerSqueezeCondition(createKlines(25));

      expect(result.isAllowed).toBe(true);
      expect(result.bbWidth).toBeNull();
      expect(result.reason).toContain('returned null');
    });
  });

  describe('volatility squeeze (trade blocked)', () => {
    it('should block trade when BB width is below threshold', async () => {
      mockComputeMulti.mockResolvedValue({ upper: [102.5], middle: [100], lower: [97.5] });

      const result = await checkBollingerSqueezeCondition(createKlines(25));

      expect(result.isAllowed).toBe(false);
      expect(result.bbWidth).toBeCloseTo(0.05);
      expect(result.isSqueezing).toBe(true);
      expect(result.reason).toContain('squeeze');
    });

    it('should block when width is just below threshold', async () => {
      mockComputeMulti.mockResolvedValue({ upper: [104.95], middle: [100], lower: [95.05] });

      const result = await checkBollingerSqueezeCondition(createKlines(25));

      expect(result.isAllowed).toBe(false);
      expect(result.isSqueezing).toBe(true);
    });
  });

  describe('sufficient volatility (trade allowed)', () => {
    it('should allow trade when BB width is above threshold', async () => {
      mockComputeMulti.mockResolvedValue({ upper: [110], middle: [100], lower: [90] });

      const result = await checkBollingerSqueezeCondition(createKlines(25));

      expect(result.isAllowed).toBe(true);
      expect(result.bbWidth).toBeCloseTo(0.2);
      expect(result.isSqueezing).toBe(false);
      expect(result.reason).toContain('sufficient volatility');
      expect(result.reason).toContain('20.00%');
    });

    it('should allow when width equals threshold', async () => {
      mockComputeMulti.mockResolvedValue({ upper: [105], middle: [100], lower: [95] });

      const result = await checkBollingerSqueezeCondition(createKlines(25), 0.1);

      expect(result.isAllowed).toBe(true);
      expect(result.isSqueezing).toBe(false);
    });
  });

  describe('custom parameters', () => {
    it('should use custom threshold', async () => {
      mockComputeMulti.mockResolvedValue({ upper: [107.5], middle: [100], lower: [92.5] });

      const result = await checkBollingerSqueezeCondition(createKlines(25), 0.2);

      expect(result.isAllowed).toBe(false);
      expect(result.isSqueezing).toBe(true);
    });

    it('should pass custom period and stdDev to computeMulti', async () => {
      mockComputeMulti.mockResolvedValue({ upper: [110], middle: [100], lower: [90] });

      await checkBollingerSqueezeCondition(createKlines(35), 0.1, 30, 2.5);

      expect(mockComputeMulti).toHaveBeenCalledWith('bb', expect.any(Array), { period: 30, stdDev: 2.5 });
    });
  });

  describe('BOLLINGER_SQUEEZE_FILTER constants', () => {
    it('should export correct default values', () => {
      expect(BOLLINGER_SQUEEZE_FILTER.DEFAULT_PERIOD).toBe(20);
      expect(BOLLINGER_SQUEEZE_FILTER.DEFAULT_STD_DEV).toBe(2);
      expect(BOLLINGER_SQUEEZE_FILTER.DEFAULT_THRESHOLD).toBe(0.1);
    });
  });
});
