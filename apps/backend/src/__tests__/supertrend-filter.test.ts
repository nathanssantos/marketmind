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

import { checkSupertrendCondition, SUPERTREND_FILTER } from '../utils/filters/supertrend-filter';

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
  Array.from({ length: count }, (_, i) => createKline(100 + i, i));

describe('checkSupertrendCondition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('insufficient klines', () => {
    it('should return soft pass when klines < period', async () => {
      const result = await checkSupertrendCondition(createKlines(5), 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.trend).toBeNull();
      expect(result.value).toBeNull();
      expect(result.reason).toContain('Insufficient');
    });

    it('should not call computeMulti for insufficient klines', async () => {
      await checkSupertrendCondition(createKlines(3), 'LONG');
      expect(mockComputeMulti).not.toHaveBeenCalled();
    });

    it('should use custom period for kline check', async () => {
      const result = await checkSupertrendCondition(createKlines(15), 'LONG', 20);

      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('Insufficient');
    });
  });

  describe('null trend', () => {
    it('should return soft pass when trend is null', async () => {
      mockComputeMulti.mockResolvedValue({
        direction: [null],
        value: [98.5],
      });
      const result = await checkSupertrendCondition(createKlines(15), 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.trend).toBeNull();
      expect(result.value).toBe(98.5);
      expect(result.reason).toContain('not yet determined');
    });
  });

  describe('LONG direction', () => {
    it('should allow LONG when trend is up (bullish)', async () => {
      mockComputeMulti.mockResolvedValue({
        direction: [-1],
        value: [95.0],
      });
      const result = await checkSupertrendCondition(createKlines(15), 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.trend).toBe('up');
      expect(result.value).toBe(95.0);
      expect(result.reason).toContain('LONG allowed');
      expect(result.reason).toContain('bullish');
    });

    it('should block LONG when trend is down (bearish)', async () => {
      mockComputeMulti.mockResolvedValue({
        direction: [1],
        value: [105.0],
      });
      const result = await checkSupertrendCondition(createKlines(15), 'LONG');

      expect(result.isAllowed).toBe(false);
      expect(result.trend).toBe('down');
      expect(result.value).toBe(105.0);
      expect(result.reason).toContain('LONG blocked');
      expect(result.reason).toContain('bearish');
    });
  });

  describe('SHORT direction', () => {
    it('should allow SHORT when trend is down (bearish)', async () => {
      mockComputeMulti.mockResolvedValue({
        direction: [1],
        value: [105.0],
      });
      const result = await checkSupertrendCondition(createKlines(15), 'SHORT');

      expect(result.isAllowed).toBe(true);
      expect(result.trend).toBe('down');
      expect(result.reason).toContain('SHORT allowed');
      expect(result.reason).toContain('bearish');
    });

    it('should block SHORT when trend is up (bullish)', async () => {
      mockComputeMulti.mockResolvedValue({
        direction: [-1],
        value: [95.0],
      });
      const result = await checkSupertrendCondition(createKlines(15), 'SHORT');

      expect(result.isAllowed).toBe(false);
      expect(result.trend).toBe('up');
      expect(result.reason).toContain('SHORT blocked');
      expect(result.reason).toContain('bullish');
    });
  });

  describe('custom parameters', () => {
    it('should pass custom period and multiplier to computeMulti', async () => {
      mockComputeMulti.mockResolvedValue({
        direction: [-1],
        value: [95.0],
      });
      await checkSupertrendCondition(createKlines(25), 'LONG', 20, 2.5);

      expect(mockComputeMulti).toHaveBeenCalledWith('supertrend', expect.any(Array), { period: 20, multiplier: 2.5 });
    });
  });

  describe('uses last value from arrays', () => {
    it('should use last trend and value from multi-element arrays', async () => {
      mockComputeMulti.mockResolvedValue({
        direction: [1, 1, -1],
        value: [102, 101, 95.0],
      });
      const result = await checkSupertrendCondition(createKlines(15), 'LONG');

      expect(result.trend).toBe('up');
      expect(result.value).toBe(95.0);
      expect(result.isAllowed).toBe(true);
    });
  });

  describe('undefined value', () => {
    it('should handle undefined value gracefully', async () => {
      mockComputeMulti.mockResolvedValue({
        direction: [-1],
        value: [],
      });
      const result = await checkSupertrendCondition(createKlines(15), 'LONG');

      expect(result.value).toBeNull();
      expect(result.isAllowed).toBe(true);
    });
  });

  describe('SUPERTREND_FILTER constants', () => {
    it('should export correct default values', () => {
      expect(SUPERTREND_FILTER.DEFAULT_PERIOD).toBe(10);
      expect(SUPERTREND_FILTER.DEFAULT_MULTIPLIER).toBe(3);
    });
  });
});
