import { describe, it, expect, vi } from 'vitest';
import type { Kline } from '@marketmind/types';

vi.mock('@marketmind/indicators', () => ({
  calculateIntradayVWAP: vi.fn(),
}));

import { checkVwapCondition, VWAP_FILTER } from '../utils/filters/vwap-filter';
import { calculateIntradayVWAP } from '@marketmind/indicators';

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
    createKline(i === count - 1 ? lastClose : 100 + i * 0.1, i),
  );

describe('checkVwapCondition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('insufficient klines', () => {
    it('should return soft pass when klines < MIN_KLINES_REQUIRED', () => {
      const result = checkVwapCondition(createKlines(3), 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.vwap).toBeNull();
      expect(result.currentPrice).toBeNull();
      expect(result.priceVsVwap).toBeNull();
      expect(result.reason).toContain('Insufficient');
    });

    it('should not call calculateIntradayVWAP for insufficient klines', () => {
      checkVwapCondition(createKlines(2), 'LONG');
      expect(calculateIntradayVWAP).not.toHaveBeenCalled();
    });
  });

  describe('invalid VWAP calculation', () => {
    it('should return soft pass when VWAP is NaN', () => {
      vi.mocked(calculateIntradayVWAP).mockReturnValue([NaN]);
      const result = checkVwapCondition(createKlines(10), 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.vwap).toBeNull();
      expect(result.reason).toContain('invalid value');
    });

    it('should return soft pass when VWAP array is empty', () => {
      vi.mocked(calculateIntradayVWAP).mockReturnValue([]);
      const result = checkVwapCondition(createKlines(10), 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.vwap).toBeNull();
    });
  });

  describe('LONG direction', () => {
    it('should allow LONG when price is above VWAP', () => {
      vi.mocked(calculateIntradayVWAP).mockReturnValue([95.0]);
      const result = checkVwapCondition(createKlines(10, 100), 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.vwap).toBe(95.0);
      expect(result.currentPrice).toBe(100);
      expect(result.priceVsVwap).toBe('ABOVE');
      expect(result.reason).toContain('LONG allowed');
      expect(result.reason).toContain('above');
    });

    it('should block LONG when price is below VWAP', () => {
      vi.mocked(calculateIntradayVWAP).mockReturnValue([105.0]);
      const result = checkVwapCondition(createKlines(10, 100), 'LONG');

      expect(result.isAllowed).toBe(false);
      expect(result.priceVsVwap).toBe('BELOW');
      expect(result.reason).toContain('LONG blocked');
      expect(result.reason).toContain('below VWAP');
    });

    it('should allow LONG when price is at VWAP', () => {
      vi.mocked(calculateIntradayVWAP).mockReturnValue([100.0]);
      const result = checkVwapCondition(createKlines(10, 100), 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.priceVsVwap).toBe('AT');
      expect(result.reason).toContain('at');
    });
  });

  describe('SHORT direction', () => {
    it('should allow SHORT when price is below VWAP', () => {
      vi.mocked(calculateIntradayVWAP).mockReturnValue([105.0]);
      const result = checkVwapCondition(createKlines(10, 100), 'SHORT');

      expect(result.isAllowed).toBe(true);
      expect(result.priceVsVwap).toBe('BELOW');
      expect(result.reason).toContain('SHORT allowed');
      expect(result.reason).toContain('below');
    });

    it('should block SHORT when price is above VWAP', () => {
      vi.mocked(calculateIntradayVWAP).mockReturnValue([95.0]);
      const result = checkVwapCondition(createKlines(10, 100), 'SHORT');

      expect(result.isAllowed).toBe(false);
      expect(result.priceVsVwap).toBe('ABOVE');
      expect(result.reason).toContain('SHORT blocked');
      expect(result.reason).toContain('above VWAP');
    });

    it('should allow SHORT when price is at VWAP', () => {
      vi.mocked(calculateIntradayVWAP).mockReturnValue([100.0]);
      const result = checkVwapCondition(createKlines(10, 100), 'SHORT');

      expect(result.isAllowed).toBe(true);
      expect(result.priceVsVwap).toBe('AT');
    });
  });

  describe('price vs VWAP classification', () => {
    it('should classify as AT when within 0.1% of VWAP', () => {
      vi.mocked(calculateIntradayVWAP).mockReturnValue([100.05]);
      const result = checkVwapCondition(createKlines(10, 100), 'LONG');

      expect(result.priceVsVwap).toBe('AT');
    });

    it('should classify as ABOVE when more than 0.1% above VWAP', () => {
      vi.mocked(calculateIntradayVWAP).mockReturnValue([99.0]);
      const result = checkVwapCondition(createKlines(10, 100), 'LONG');

      expect(result.priceVsVwap).toBe('ABOVE');
    });

    it('should classify as BELOW when more than 0.1% below VWAP', () => {
      vi.mocked(calculateIntradayVWAP).mockReturnValue([101.0]);
      const result = checkVwapCondition(createKlines(10, 100), 'LONG');

      expect(result.priceVsVwap).toBe('BELOW');
    });
  });

  describe('VWAP_FILTER constants', () => {
    it('should have correct default value', () => {
      expect(VWAP_FILTER.MIN_KLINES_REQUIRED).toBe(5);
    });
  });
});
