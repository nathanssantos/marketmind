import { describe, it, expect, vi } from 'vitest';
import type { Kline } from '@marketmind/types';

vi.mock('@marketmind/indicators', () => ({
  calculateChoppiness: vi.fn(),
  CHOPPINESS_FILTER: {
    HIGH_THRESHOLD: 61.8,
    LOW_THRESHOLD: 38.2,
    DEFAULT_PERIOD: 14,
  },
}));

import { checkChoppinessCondition, CHOPPINESS_FILTER } from '../utils/filters/choppiness-filter';
import { calculateChoppiness } from '@marketmind/indicators';

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

describe('checkChoppinessCondition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('insufficient klines', () => {
    it('should return soft pass when klines < period', () => {
      const result = checkChoppinessCondition(createKlines(5));

      expect(result.isAllowed).toBe(true);
      expect(result.choppinessValue).toBeNull();
      expect(result.isChoppy).toBe(false);
      expect(result.isTrending).toBe(false);
      expect(result.reason).toContain('Insufficient klines');
      expect(result.reason).toContain('5');
    });

    it('should not call calculateChoppiness for insufficient klines', () => {
      checkChoppinessCondition(createKlines(3));
      expect(calculateChoppiness).not.toHaveBeenCalled();
    });
  });

  describe('invalid calculation result', () => {
    it('should return soft pass when calculation returns NaN', () => {
      vi.mocked(calculateChoppiness).mockReturnValue([NaN]);
      const result = checkChoppinessCondition(createKlines(20));

      expect(result.isAllowed).toBe(true);
      expect(result.choppinessValue).toBeNull();
      expect(result.reason).toContain('invalid value');
    });

    it('should return soft pass when calculation returns undefined last value', () => {
      vi.mocked(calculateChoppiness).mockReturnValue([]);
      const result = checkChoppinessCondition(createKlines(20));

      expect(result.isAllowed).toBe(true);
      expect(result.choppinessValue).toBeNull();
    });
  });

  describe('choppy market (high choppiness)', () => {
    it('should block trade when choppiness > high threshold', () => {
      vi.mocked(calculateChoppiness).mockReturnValue([65.0]);
      const result = checkChoppinessCondition(createKlines(20));

      expect(result.isAllowed).toBe(false);
      expect(result.choppinessValue).toBe(65.0);
      expect(result.isChoppy).toBe(true);
      expect(result.isTrending).toBe(false);
      expect(result.reason).toContain('choppy');
      expect(result.reason).toContain('65.00');
    });

    it('should block at exactly above threshold', () => {
      vi.mocked(calculateChoppiness).mockReturnValue([61.81]);
      const result = checkChoppinessCondition(createKlines(20));

      expect(result.isAllowed).toBe(false);
      expect(result.isChoppy).toBe(true);
    });
  });

  describe('trending market (low choppiness)', () => {
    it('should allow trade and flag as trending when choppiness < low threshold', () => {
      vi.mocked(calculateChoppiness).mockReturnValue([30.0]);
      const result = checkChoppinessCondition(createKlines(20));

      expect(result.isAllowed).toBe(true);
      expect(result.choppinessValue).toBe(30.0);
      expect(result.isChoppy).toBe(false);
      expect(result.isTrending).toBe(true);
      expect(result.reason).toContain('trending');
    });
  });

  describe('neutral market (between thresholds)', () => {
    it('should allow trade when between thresholds', () => {
      vi.mocked(calculateChoppiness).mockReturnValue([50.0]);
      const result = checkChoppinessCondition(createKlines(20));

      expect(result.isAllowed).toBe(true);
      expect(result.choppinessValue).toBe(50.0);
      expect(result.isChoppy).toBe(false);
      expect(result.isTrending).toBe(false);
      expect(result.reason).toContain('acceptable');
    });

    it('should allow at exactly the high threshold', () => {
      vi.mocked(calculateChoppiness).mockReturnValue([61.8]);
      const result = checkChoppinessCondition(createKlines(20));

      expect(result.isAllowed).toBe(true);
      expect(result.isChoppy).toBe(false);
    });

    it('should allow at exactly the low threshold', () => {
      vi.mocked(calculateChoppiness).mockReturnValue([38.2]);
      const result = checkChoppinessCondition(createKlines(20));

      expect(result.isAllowed).toBe(true);
      expect(result.isTrending).toBe(false);
    });
  });

  describe('custom thresholds and period', () => {
    it('should use custom thresholds', () => {
      vi.mocked(calculateChoppiness).mockReturnValue([55.0]);
      const result = checkChoppinessCondition(createKlines(20), 50, 30, 14);

      expect(result.isAllowed).toBe(false);
      expect(result.isChoppy).toBe(true);
    });

    it('should use custom period for kline check', () => {
      const result = checkChoppinessCondition(createKlines(8), 61.8, 38.2, 10);

      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('Insufficient');
      expect(calculateChoppiness).not.toHaveBeenCalled();
    });

    it('should pass custom period to calculateChoppiness', () => {
      vi.mocked(calculateChoppiness).mockReturnValue([45.0]);
      checkChoppinessCondition(createKlines(30), 61.8, 38.2, 25);

      expect(calculateChoppiness).toHaveBeenCalledWith(expect.any(Array), 25);
    });
  });

  describe('CHOPPINESS_FILTER constants', () => {
    it('should export correct default values', () => {
      expect(CHOPPINESS_FILTER.HIGH_THRESHOLD).toBe(61.8);
      expect(CHOPPINESS_FILTER.LOW_THRESHOLD).toBe(38.2);
      expect(CHOPPINESS_FILTER.DEFAULT_PERIOD).toBe(14);
    });
  });

  describe('uses last value from array', () => {
    it('should use the last value from calculateChoppiness output', () => {
      vi.mocked(calculateChoppiness).mockReturnValue([70.0, 50.0, 30.0]);
      const result = checkChoppinessCondition(createKlines(20));

      expect(result.choppinessValue).toBe(30.0);
      expect(result.isTrending).toBe(true);
    });
  });
});
