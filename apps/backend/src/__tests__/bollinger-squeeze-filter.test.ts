import { describe, it, expect, vi } from 'vitest';
import type { Kline } from '@marketmind/types';

vi.mock('@marketmind/indicators', () => ({
  calculateBollingerBands: vi.fn(),
  calculateBBWidth: vi.fn(),
}));

import { checkBollingerSqueezeCondition, BOLLINGER_SQUEEZE_FILTER } from '../utils/filters/bollinger-squeeze-filter';
import { calculateBollingerBands, calculateBBWidth } from '@marketmind/indicators';

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
    it('should return soft pass when klines < period', () => {
      const result = checkBollingerSqueezeCondition(createKlines(10));

      expect(result.isAllowed).toBe(true);
      expect(result.bbWidth).toBeNull();
      expect(result.isSqueezing).toBe(false);
      expect(result.reason).toContain('Insufficient');
    });

    it('should not call calculateBollingerBands for insufficient klines', () => {
      checkBollingerSqueezeCondition(createKlines(5));
      expect(calculateBollingerBands).not.toHaveBeenCalled();
    });

    it('should use custom period for kline check', () => {
      const result = checkBollingerSqueezeCondition(createKlines(15), 0.1, 30);

      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('Insufficient');
    });
  });

  describe('null BB calculation', () => {
    it('should return soft pass when calculateBollingerBands returns null', () => {
      vi.mocked(calculateBollingerBands).mockReturnValue(null as never);
      const result = checkBollingerSqueezeCondition(createKlines(25));

      expect(result.isAllowed).toBe(true);
      expect(result.bbWidth).toBeNull();
      expect(result.reason).toContain('returned null');
    });
  });

  describe('volatility squeeze (trade blocked)', () => {
    it('should block trade when BB width is below threshold', () => {
      const bbResult = { upper: 105, middle: 100, lower: 95 };
      vi.mocked(calculateBollingerBands).mockReturnValue(bbResult);
      vi.mocked(calculateBBWidth).mockReturnValue(0.05);

      const result = checkBollingerSqueezeCondition(createKlines(25));

      expect(result.isAllowed).toBe(false);
      expect(result.bbWidth).toBe(0.05);
      expect(result.isSqueezing).toBe(true);
      expect(result.reason).toContain('squeeze');
      expect(result.reason).toContain('5.00%');
    });

    it('should block when width is just below threshold', () => {
      const bbResult = { upper: 105, middle: 100, lower: 95 };
      vi.mocked(calculateBollingerBands).mockReturnValue(bbResult);
      vi.mocked(calculateBBWidth).mockReturnValue(0.099);

      const result = checkBollingerSqueezeCondition(createKlines(25));

      expect(result.isAllowed).toBe(false);
      expect(result.isSqueezing).toBe(true);
    });
  });

  describe('sufficient volatility (trade allowed)', () => {
    it('should allow trade when BB width is above threshold', () => {
      const bbResult = { upper: 110, middle: 100, lower: 90 };
      vi.mocked(calculateBollingerBands).mockReturnValue(bbResult);
      vi.mocked(calculateBBWidth).mockReturnValue(0.2);

      const result = checkBollingerSqueezeCondition(createKlines(25));

      expect(result.isAllowed).toBe(true);
      expect(result.bbWidth).toBe(0.2);
      expect(result.isSqueezing).toBe(false);
      expect(result.reason).toContain('sufficient volatility');
      expect(result.reason).toContain('20.00%');
    });

    it('should allow when width equals threshold', () => {
      const bbResult = { upper: 105, middle: 100, lower: 95 };
      vi.mocked(calculateBollingerBands).mockReturnValue(bbResult);
      vi.mocked(calculateBBWidth).mockReturnValue(0.1);

      const result = checkBollingerSqueezeCondition(createKlines(25));

      expect(result.isAllowed).toBe(true);
      expect(result.isSqueezing).toBe(false);
    });
  });

  describe('custom parameters', () => {
    it('should use custom threshold', () => {
      const bbResult = { upper: 105, middle: 100, lower: 95 };
      vi.mocked(calculateBollingerBands).mockReturnValue(bbResult);
      vi.mocked(calculateBBWidth).mockReturnValue(0.15);

      const result = checkBollingerSqueezeCondition(createKlines(25), 0.2);

      expect(result.isAllowed).toBe(false);
      expect(result.isSqueezing).toBe(true);
    });

    it('should pass custom period and stdDev to calculateBollingerBands', () => {
      const bbResult = { upper: 110, middle: 100, lower: 90 };
      vi.mocked(calculateBollingerBands).mockReturnValue(bbResult);
      vi.mocked(calculateBBWidth).mockReturnValue(0.2);

      checkBollingerSqueezeCondition(createKlines(35), 0.1, 30, 2.5);

      expect(calculateBollingerBands).toHaveBeenCalledWith(expect.any(Array), 30, 2.5);
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
