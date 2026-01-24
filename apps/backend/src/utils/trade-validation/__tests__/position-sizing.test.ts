import { describe, expect, it } from 'vitest';
import { calculateUnifiedPositionSize } from '../position-sizing';
import type { Kline } from '@marketmind/types';

const createNormalVolatilityKlines = (count: number, basePrice: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i++) {
    const variation = basePrice * 0.01;
    klines.push({
      openTime: Date.now() + i * 3600000,
      closeTime: Date.now() + (i + 1) * 3600000,
      open: String(basePrice),
      high: String(basePrice + variation),
      low: String(basePrice - variation),
      close: String(basePrice),
      volume: '1000',
      quoteVolume: '100000',
      trades: 100,
      takerBuyBaseVolume: '500',
      takerBuyQuoteVolume: '50000',
    });
  }
  return klines;
};

describe('calculateUnifiedPositionSize', () => {
  describe('fixed-fractional method', () => {
    it('should calculate position size based on max percentage', () => {
      const result = calculateUnifiedPositionSize({
        equity: 10000,
        entryPrice: 100,
        method: 'fixed-fractional',
        maxPositionSizePercent: 10,
        applyVolatilityAdjustment: false,
      });

      expect(result.positionValue).toBe(1000);
      expect(result.quantity).toBeCloseTo(10, 1);
      expect(result.positionPercent).toBe(10);
      expect(result.volatilityFactor).toBe(1.0);
      expect(result.rationale).toContain('Fixed 10%');
    });
  });

  describe('risk-based method', () => {
    it('should calculate position size based on risk per trade', () => {
      const result = calculateUnifiedPositionSize({
        equity: 10000,
        entryPrice: 100,
        stopLoss: 95,
        method: 'risk-based',
        maxPositionSizePercent: 50,
        riskPerTrade: 2,
        applyVolatilityAdjustment: false,
      });

      expect(result.positionPercent).toBeCloseTo(40, 0);
      expect(result.rationale).toContain('Risk 2%');
    });

    it('should fallback to fixed when no stop loss', () => {
      const result = calculateUnifiedPositionSize({
        equity: 10000,
        entryPrice: 100,
        method: 'risk-based',
        maxPositionSizePercent: 50,
        applyVolatilityAdjustment: false,
      });

      expect(result.rationale).toContain('No stop loss');
    });
  });

  describe('kelly method', () => {
    it('should calculate position using Kelly criterion', () => {
      const result = calculateUnifiedPositionSize({
        equity: 10000,
        entryPrice: 100,
        method: 'kelly',
        maxPositionSizePercent: 50,
        historicalStats: {
          winRate: 0.6,
          avgWinPercent: 3,
          avgLossPercent: 2,
        },
        kellyFraction: 0.25,
        applyVolatilityAdjustment: false,
      });

      expect(result.positionPercent).toBeGreaterThan(0);
      expect(result.rationale).toContain('Kelly');
      expect(result.rationale).toContain('WR=60.0%');
    });

    it('should use default stats when not provided', () => {
      const result = calculateUnifiedPositionSize({
        equity: 10000,
        entryPrice: 100,
        method: 'kelly',
        maxPositionSizePercent: 50,
        applyVolatilityAdjustment: false,
      });

      expect(result.positionPercent).toBeGreaterThan(0);
      expect(result.rationale).toContain('Kelly');
    });
  });

  describe('volatility method', () => {
    it('should calculate position based on ATR', () => {
      const result = calculateUnifiedPositionSize({
        equity: 10000,
        entryPrice: 100,
        method: 'volatility',
        maxPositionSizePercent: 50,
        atr: 2,
        applyVolatilityAdjustment: false,
      });

      expect(result.rationale).toContain('Volatility-adjusted');
      expect(result.rationale).toContain('ATR=');
    });

    it('should fallback to fixed when no ATR', () => {
      const result = calculateUnifiedPositionSize({
        equity: 10000,
        entryPrice: 100,
        method: 'volatility',
        maxPositionSizePercent: 50,
        applyVolatilityAdjustment: false,
      });

      expect(result.rationale).toContain('No ATR');
    });
  });

  describe('volatility adjustment', () => {
    it('should apply volatility adjustment when enabled', () => {
      const klines = createNormalVolatilityKlines(20, 100);

      const result = calculateUnifiedPositionSize({
        equity: 10000,
        entryPrice: 100,
        method: 'fixed-fractional',
        maxPositionSizePercent: 10,
        klines,
        applyVolatilityAdjustment: true,
      });

      expect(result.volatilityFactor).toBe(1.0);
    });

    it('should not apply volatility adjustment when disabled', () => {
      const result = calculateUnifiedPositionSize({
        equity: 10000,
        entryPrice: 100,
        method: 'fixed-fractional',
        maxPositionSizePercent: 10,
        applyVolatilityAdjustment: false,
      });

      expect(result.volatilityFactor).toBe(1.0);
    });
  });

  describe('constraints', () => {
    it('should respect max position size percent', () => {
      const result = calculateUnifiedPositionSize({
        equity: 10000,
        entryPrice: 100,
        stopLoss: 99.9,
        method: 'risk-based',
        maxPositionSizePercent: 10,
        riskPerTrade: 5,
        applyVolatilityAdjustment: false,
      });

      expect(result.positionPercent).toBeLessThanOrEqual(10);
    });

    it('should respect min position size percent', () => {
      const result = calculateUnifiedPositionSize({
        equity: 10000,
        entryPrice: 100,
        method: 'kelly',
        maxPositionSizePercent: 50,
        historicalStats: {
          winRate: 0.4,
          avgWinPercent: 1,
          avgLossPercent: 2,
        },
        minPositionPercent: 1,
        applyVolatilityAdjustment: false,
      });

      expect(result.positionPercent).toBeGreaterThanOrEqual(1);
    });
  });

  describe('risk amount calculation', () => {
    it('should calculate risk amount with stop loss', () => {
      const result = calculateUnifiedPositionSize({
        equity: 10000,
        entryPrice: 100,
        stopLoss: 95,
        method: 'fixed-fractional',
        maxPositionSizePercent: 10,
        applyVolatilityAdjustment: false,
      });

      expect(result.riskAmount).toBeCloseTo(50, 0);
    });

    it('should calculate risk amount without stop loss', () => {
      const result = calculateUnifiedPositionSize({
        equity: 10000,
        entryPrice: 100,
        method: 'fixed-fractional',
        maxPositionSizePercent: 10,
        applyVolatilityAdjustment: false,
      });

      expect(result.riskAmount).toBeGreaterThan(0);
    });
  });
});
