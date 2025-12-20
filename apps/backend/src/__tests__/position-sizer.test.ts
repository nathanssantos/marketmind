import { describe, expect, it } from 'vitest';
import { PositionSizer, type PositionSizingConfig } from '../services/backtesting/PositionSizer';

describe('PositionSizer', () => {
  const defaultEquity = 10000;
  const defaultEntryPrice = 100;
  const defaultStopLoss = 95;

  describe('calculatePositionSize', () => {
    describe('fixed-fractional method', () => {
      it('should use default fixed percent when no config provided', () => {
        const config: PositionSizingConfig = { method: 'fixed-fractional' };
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultStopLoss, config);

        expect(result.method).toBe('fixed-fractional');
        expect(result.positionPercent).toBe(10);
        expect(result.positionValue).toBe(1000);
        expect(result.positionSize).toBe(10);
      });

      it('should use custom fixed percent', () => {
        const config: PositionSizingConfig = { method: 'fixed-fractional', fixedPercent: 25 };
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultStopLoss, config);

        expect(result.positionPercent).toBe(25);
        expect(result.positionValue).toBe(2500);
      });

      it('should respect min position percent', () => {
        const config: PositionSizingConfig = { method: 'fixed-fractional', fixedPercent: 0.5, minPositionPercent: 5 };
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultStopLoss, config);

        expect(result.positionPercent).toBe(5);
      });

      it('should respect max position percent', () => {
        const config: PositionSizingConfig = { method: 'fixed-fractional', fixedPercent: 150, maxPositionPercent: 50 };
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultStopLoss, config);

        expect(result.positionPercent).toBe(50);
      });
    });

    describe('risk-based method', () => {
      it('should calculate position size based on risk percent and stop loss', () => {
        const config: PositionSizingConfig = { method: 'risk-based', riskPerTrade: 2 };
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultStopLoss, config);

        expect(result.method).toBe('risk-based');
        expect(result.positionPercent).toBe(40);
        expect(result.positionValue).toBe(4000);
        expect(result.riskAmount).toBeCloseTo(200, 0);
      });

      it('should fallback to fixed when no stop loss', () => {
        const config: PositionSizingConfig = { method: 'risk-based', riskPerTrade: 2 };
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, undefined, config);

        expect(result.positionPercent).toBe(10);
        expect(result.rationale).toContain('No stop loss');
      });

      it('should fallback to fixed when stop equals entry', () => {
        const config: PositionSizingConfig = { method: 'risk-based', riskPerTrade: 2 };
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultEntryPrice, config);

        expect(result.positionPercent).toBe(10);
      });

      it('should calculate correct position for tight stop loss', () => {
        const config: PositionSizingConfig = { method: 'risk-based', riskPerTrade: 1 };
        const tightStop = 99;
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, tightStop, config);

        expect(result.positionPercent).toBe(100);
      });

      it('should calculate correct position for wide stop loss', () => {
        const config: PositionSizingConfig = { method: 'risk-based', riskPerTrade: 1 };
        const wideStop = 80;
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, wideStop, config);

        expect(result.positionPercent).toBe(5);
      });

      it('should handle short position stop loss (above entry)', () => {
        const config: PositionSizingConfig = { method: 'risk-based', riskPerTrade: 2 };
        const shortStop = 105;
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, shortStop, config);

        expect(result.positionPercent).toBe(40);
      });
    });

    describe('kelly method', () => {
      it('should calculate Kelly criterion position size', () => {
        const config: PositionSizingConfig = {
          method: 'kelly',
          winRate: 0.6,
          avgWinPercent: 5,
          avgLossPercent: 2,
          kellyFraction: 0.25,
        };
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultStopLoss, config);

        expect(result.method).toBe('kelly');
        expect(result.positionPercent).toBeGreaterThan(0);
        expect(result.rationale).toContain('Kelly');
      });

      it('should use quarter Kelly by default', () => {
        const config: PositionSizingConfig = {
          method: 'kelly',
          winRate: 0.6,
          avgWinPercent: 4,
          avgLossPercent: 2,
        };
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultStopLoss, config);

        expect(result.rationale).toContain('0.25x Kelly');
      });

      it('should respect min position percent for negative Kelly', () => {
        const config: PositionSizingConfig = {
          method: 'kelly',
          winRate: 0.3,
          avgWinPercent: 2,
          avgLossPercent: 5,
          kellyFraction: 0.5,
        };
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultStopLoss, config);

        expect(result.positionPercent).toBe(1);
      });

      it('should calculate higher position for better edge', () => {
        const goodEdge: PositionSizingConfig = {
          method: 'kelly',
          winRate: 0.7,
          avgWinPercent: 6,
          avgLossPercent: 2,
          kellyFraction: 0.5,
        };
        const poorEdge: PositionSizingConfig = {
          method: 'kelly',
          winRate: 0.5,
          avgWinPercent: 3,
          avgLossPercent: 2,
          kellyFraction: 0.5,
        };

        const goodResult = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultStopLoss, goodEdge);
        const poorResult = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultStopLoss, poorEdge);

        expect(goodResult.positionPercent).toBeGreaterThan(poorResult.positionPercent);
      });
    });

    describe('volatility method', () => {
      it('should calculate position size based on ATR', () => {
        const config: PositionSizingConfig = {
          method: 'volatility',
          atr: 2,
          atrMultiplier: 2,
        };
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultStopLoss, config);

        expect(result.method).toBe('volatility');
        expect(result.rationale).toContain('Volatility-adjusted');
      });

      it('should fallback to fixed when ATR is 0', () => {
        const config: PositionSizingConfig = {
          method: 'volatility',
          atr: 0,
        };
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultStopLoss, config);

        expect(result.positionPercent).toBe(10);
        expect(result.rationale).toContain('No ATR');
      });

      it('should reduce position in high volatility', () => {
        const highVol: PositionSizingConfig = { method: 'volatility', atr: 5 };
        const lowVol: PositionSizingConfig = { method: 'volatility', atr: 1 };

        const highResult = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultStopLoss, highVol);
        const lowResult = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultStopLoss, lowVol);

        expect(highResult.positionPercent).toBeLessThan(lowResult.positionPercent);
      });

      it('should respect max position percent', () => {
        const config: PositionSizingConfig = {
          method: 'volatility',
          atr: 0.1,
          maxPositionPercent: 30,
        };
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultStopLoss, config);

        expect(result.positionPercent).toBeLessThanOrEqual(30);
      });
    });

    describe('position calculations', () => {
      it('should calculate correct position size from value', () => {
        const config: PositionSizingConfig = { method: 'fixed-fractional', fixedPercent: 20 };
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultStopLoss, config);

        expect(result.positionValue).toBe(2000);
        expect(result.positionSize).toBe(20);
      });

      it('should calculate risk amount with stop loss', () => {
        const config: PositionSizingConfig = { method: 'fixed-fractional', fixedPercent: 10 };
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, defaultStopLoss, config);

        const expectedRisk = Math.abs(defaultEntryPrice - defaultStopLoss) * result.positionSize;
        expect(result.riskAmount).toBeCloseTo(expectedRisk, 2);
      });

      it('should calculate risk amount without stop loss using default risk percent', () => {
        const config: PositionSizingConfig = { method: 'fixed-fractional', fixedPercent: 10 };
        const result = PositionSizer.calculatePositionSize(defaultEquity, defaultEntryPrice, undefined, config);

        expect(result.riskAmount).toBeCloseTo(result.positionValue * 0.02, 2);
      });
    });
  });

  describe('calculateOptimalKellyFraction', () => {
    it('should return default Kelly fraction for average stats', () => {
      const result = PositionSizer.calculateOptimalKellyFraction(0.5, 1.5, 10);
      expect(result).toBe(0.25);
    });

    it('should increase fraction for high win rate', () => {
      const result = PositionSizer.calculateOptimalKellyFraction(0.6, 1.5, 10);
      expect(result).toBeGreaterThan(0.25);
    });

    it('should increase fraction for high profit factor', () => {
      const result = PositionSizer.calculateOptimalKellyFraction(0.5, 2.5, 10);
      expect(result).toBeGreaterThan(0.25);
    });

    it('should decrease fraction for low profit factor', () => {
      const result = PositionSizer.calculateOptimalKellyFraction(0.5, 1.1, 10);
      expect(result).toBeLessThan(0.25);
    });

    it('should decrease fraction for high drawdown', () => {
      const result = PositionSizer.calculateOptimalKellyFraction(0.5, 1.5, 25);
      expect(result).toBeLessThan(0.25);
    });

    it('should increase fraction for low drawdown', () => {
      const result = PositionSizer.calculateOptimalKellyFraction(0.5, 1.5, 3);
      expect(result).toBeGreaterThan(0.25);
    });

    it('should respect minimum bound', () => {
      const result = PositionSizer.calculateOptimalKellyFraction(0.3, 0.8, 30);
      expect(result).toBe(0.1);
    });

    it('should respect maximum bound', () => {
      const result = PositionSizer.calculateOptimalKellyFraction(0.7, 3.0, 2);
      expect(result).toBeLessThanOrEqual(0.5);
      expect(result).toBe(0.45);
    });

    it('should combine multiple adjustments', () => {
      const highWinHighPF = PositionSizer.calculateOptimalKellyFraction(0.6, 2.5, 10);
      const lowWinLowPF = PositionSizer.calculateOptimalKellyFraction(0.4, 1.0, 25);

      expect(highWinHighPF).toBeGreaterThan(lowWinLowPF);
    });
  });

  describe('recommendMethod', () => {
    it('should recommend risk-based for few trades with stop loss', () => {
      const result = PositionSizer.recommendMethod(0.5, 1.5, 20, true);
      expect(result).toBe('risk-based');
    });

    it('should recommend fixed-fractional for few trades without stop loss', () => {
      const result = PositionSizer.recommendMethod(0.5, 1.5, 20, false);
      expect(result).toBe('fixed-fractional');
    });

    it('should recommend kelly for good edge with enough trades', () => {
      const result = PositionSizer.recommendMethod(0.5, 2.0, 100, true);
      expect(result).toBe('kelly');
    });

    it('should not recommend kelly for extreme win rates', () => {
      const highWR = PositionSizer.recommendMethod(0.8, 2.0, 100, true);
      const lowWR = PositionSizer.recommendMethod(0.25, 2.0, 100, true);

      expect(highWR).not.toBe('kelly');
      expect(lowWR).not.toBe('kelly');
    });

    it('should not recommend kelly for low profit factor', () => {
      const result = PositionSizer.recommendMethod(0.5, 1.2, 100, true);
      expect(result).not.toBe('kelly');
    });

    it('should recommend risk-based when kelly not suitable and has stop loss', () => {
      const result = PositionSizer.recommendMethod(0.8, 2.0, 100, true);
      expect(result).toBe('risk-based');
    });

    it('should recommend fixed-fractional when nothing else fits', () => {
      const result = PositionSizer.recommendMethod(0.8, 2.0, 100, false);
      expect(result).toBe('fixed-fractional');
    });
  });

  describe('edge cases', () => {
    it('should handle very small equity', () => {
      const config: PositionSizingConfig = { method: 'fixed-fractional', fixedPercent: 10 };
      const result = PositionSizer.calculatePositionSize(10, defaultEntryPrice, defaultStopLoss, config);

      expect(result.positionValue).toBe(1);
      expect(result.positionSize).toBe(0.01);
    });

    it('should handle very large equity', () => {
      const config: PositionSizingConfig = { method: 'fixed-fractional', fixedPercent: 10 };
      const result = PositionSizer.calculatePositionSize(1000000000, defaultEntryPrice, defaultStopLoss, config);

      expect(result.positionValue).toBe(100000000);
    });

    it('should handle high entry price', () => {
      const config: PositionSizingConfig = { method: 'fixed-fractional', fixedPercent: 10 };
      const result = PositionSizer.calculatePositionSize(defaultEquity, 50000, 49000, config);

      expect(result.positionSize).toBe(0.02);
    });

    it('should handle very low entry price', () => {
      const config: PositionSizingConfig = { method: 'fixed-fractional', fixedPercent: 10 };
      const result = PositionSizer.calculatePositionSize(defaultEquity, 0.001, 0.0009, config);

      expect(result.positionSize).toBe(1000000);
    });
  });
});
