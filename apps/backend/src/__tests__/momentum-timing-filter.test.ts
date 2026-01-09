import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import {
  checkMomentumTiming,
  MOMENTUM_TIMING_FILTER,
} from '../utils/momentum-timing-filter';

const createKline = (
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
  index: number
): Kline => ({
  openTime: Date.now() + index * 60000,
  open: String(open),
  high: String(high),
  low: String(low),
  close: String(close),
  volume: String(volume),
  closeTime: Date.now() + (index + 1) * 60000 - 1,
  quoteVolume: String(volume * close),
  trades: 100,
  takerBuyBaseVolume: String(volume * 0.5),
  takerBuyQuoteVolume: String(volume * close * 0.5),
});

const MIN_KLINES = MOMENTUM_TIMING_FILTER.MIN_KLINES_REQUIRED + 20;

const createBullishKlines = (): Kline[] => {
  const klines: Kline[] = [];
  let price = 100;

  for (let i = 0; i < MIN_KLINES; i += 1) {
    const change = 0.5 + Math.random() * 0.5;
    const open = price;
    price = price + change;
    const close = price;
    const high = Math.max(open, close) + 0.2;
    const low = Math.min(open, close) - 0.1;
    const volume = 1000 + i * 50;

    klines.push(createKline(open, high, low, close, volume, i));
  }

  return klines;
};

const createBearishKlines = (): Kline[] => {
  const klines: Kline[] = [];
  let price = 150;

  for (let i = 0; i < MIN_KLINES; i += 1) {
    const change = -(0.5 + Math.random() * 0.5);
    const open = price;
    price = Math.max(price + change, 50);
    const close = price;
    const high = Math.max(open, close) + 0.1;
    const low = Math.min(open, close) - 0.2;
    const volume = 1000 + i * 50;

    klines.push(createKline(open, high, low, close, volume, i));
  }

  return klines;
};

const createSidewaysKlines = (): Kline[] => {
  const klines: Kline[] = [];
  let price = 100;

  for (let i = 0; i < MIN_KLINES; i += 1) {
    const change = (i % 2 === 0) ? 0.3 : -0.3;
    const open = price;
    price = price + change;
    const close = price;
    const high = Math.max(open, close) + 0.1;
    const low = Math.min(open, close) - 0.1;
    const volume = 1000;

    klines.push(createKline(open, high, low, close, volume, i));
  }

  return klines;
};

describe('checkMomentumTiming', () => {
  describe('LONG direction', () => {
    it('should allow LONG in bullish market with rising RSI and MFI confirmation', () => {
      const klines = createBullishKlines();
      const result = checkMomentumTiming(klines, 'LONG');

      expect(result.rsiValue).not.toBeNull();
      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('LONG allowed');
    });

    it('should block LONG in bearish market with low RSI', () => {
      const klines = createBearishKlines();
      const result = checkMomentumTiming(klines, 'LONG');

      expect(result.rsiValue).not.toBeNull();
      expect(result.rsiValue!).toBeLessThan(MOMENTUM_TIMING_FILTER.RSI_LONG_MIN);
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain('LONG blocked');
    });
  });

  describe('SHORT direction', () => {
    it('should allow SHORT in bearish market with falling RSI and MFI confirmation', () => {
      const klines = createBearishKlines();
      const result = checkMomentumTiming(klines, 'SHORT');

      expect(result.rsiValue).not.toBeNull();
      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('SHORT allowed');
    });

    it('should block SHORT in bullish market with high RSI', () => {
      const klines = createBullishKlines();
      const result = checkMomentumTiming(klines, 'SHORT');

      expect(result.rsiValue).not.toBeNull();
      expect(result.rsiValue!).toBeGreaterThanOrEqual(MOMENTUM_TIMING_FILTER.RSI_SHORT_MAX);
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain('SHORT blocked');
    });
  });

  describe('edge cases', () => {
    it('should return isAllowed=true (soft pass) when insufficient klines', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 10; i += 1) {
        klines.push(createKline(100, 105, 95, 100, 1000, i));
      }

      const result = checkMomentumTiming(klines, 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.rsiValue).toBeNull();
      expect(result.reason).toContain('Insufficient');
      expect(result.reason).toContain('soft pass');
    });

    it('should return RSI and MFI values when calculation succeeds', () => {
      const klines = createSidewaysKlines();
      const result = checkMomentumTiming(klines, 'LONG');

      expect(result.rsiValue).not.toBeNull();
      expect(result.rsiPrevValue).not.toBeNull();
      expect(typeof result.rsiValue).toBe('number');
    });

    it('should return RSI value between 0 and 100', () => {
      const klines = createSidewaysKlines();
      const result = checkMomentumTiming(klines, 'LONG');

      expect(result.rsiValue).not.toBeNull();
      expect(result.rsiValue).toBeGreaterThanOrEqual(0);
      expect(result.rsiValue).toBeLessThanOrEqual(100);
    });
  });

  describe('MOMENTUM_TIMING_FILTER constants', () => {
    it('should have correct default values', () => {
      expect(MOMENTUM_TIMING_FILTER.RSI_PERIOD).toBe(14);
      expect(MOMENTUM_TIMING_FILTER.MFI_PERIOD).toBe(14);
      expect(MOMENTUM_TIMING_FILTER.RSI_LONG_MIN).toBe(40);
      expect(MOMENTUM_TIMING_FILTER.RSI_SHORT_MAX).toBe(60);
      expect(MOMENTUM_TIMING_FILTER.MFI_LONG_MIN).toBe(30);
      expect(MOMENTUM_TIMING_FILTER.MFI_SHORT_MAX).toBe(70);
      expect(MOMENTUM_TIMING_FILTER.MIN_KLINES_REQUIRED).toBe(20);
    });
  });

  describe('result structure', () => {
    it('should return all required fields in MomentumTimingResult', () => {
      const klines = createSidewaysKlines();
      const result = checkMomentumTiming(klines, 'LONG');

      expect(result).toHaveProperty('isAllowed');
      expect(result).toHaveProperty('rsiValue');
      expect(result).toHaveProperty('rsiPrevValue');
      expect(result).toHaveProperty('rsiMomentum');
      expect(result).toHaveProperty('mfiValue');
      expect(result).toHaveProperty('mfiConfirmation');
      expect(result).toHaveProperty('reason');
    });

    it('should return valid momentum value (RISING, FALLING, or NEUTRAL)', () => {
      const klines = createBullishKlines();
      const result = checkMomentumTiming(klines, 'LONG');

      expect(['RISING', 'FALLING', 'NEUTRAL']).toContain(result.rsiMomentum);
    });

    it('should return rsiPrevValue for momentum calculation', () => {
      const klines = createBearishKlines();
      const result = checkMomentumTiming(klines, 'SHORT');

      expect(result.rsiPrevValue).not.toBeNull();
      expect(typeof result.rsiPrevValue).toBe('number');
    });
  });

  describe('MFI confirmation', () => {
    it('should include MFI in the reason when available', () => {
      const klines = createBullishKlines();
      const result = checkMomentumTiming(klines, 'LONG');

      if (result.mfiValue !== null) {
        expect(result.reason).toContain('MFI');
      }
    });
  });
});
