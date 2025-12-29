import { describe, it, expect } from 'vitest';
import { PositionSizer } from '../PositionSizer';

describe('PositionSizer', () => {
  describe('calculatePositionSize', () => {
    describe('fixed-fractional method', () => {
      it('should calculate fixed percentage of equity', () => {
        const result = PositionSizer.calculatePositionSize(10000, 100, undefined, {
          method: 'fixed-fractional',
          fixedPercent: 5,
        });

        expect(result.positionPercent).toBe(5);
        expect(result.positionValue).toBe(500);
        expect(result.positionSize).toBe(5);
        expect(result.method).toBe('fixed-fractional');
      });

      it('should use default 10% when fixedPercent not specified', () => {
        const result = PositionSizer.calculatePositionSize(10000, 100, undefined, {
          method: 'fixed-fractional',
        });

        expect(result.positionPercent).toBe(10);
        expect(result.positionValue).toBe(1000);
      });

      it('should respect min/max position limits', () => {
        const resultMin = PositionSizer.calculatePositionSize(10000, 100, undefined, {
          method: 'fixed-fractional',
          fixedPercent: 0.1,
          minPositionPercent: 2,
        });
        expect(resultMin.positionPercent).toBe(2);

        const resultMax = PositionSizer.calculatePositionSize(10000, 100, undefined, {
          method: 'fixed-fractional',
          fixedPercent: 150,
          maxPositionPercent: 50,
        });
        expect(resultMax.positionPercent).toBe(50);
      });
    });

    describe('risk-based method', () => {
      it('should calculate position size based on stop loss distance', () => {
        const result = PositionSizer.calculatePositionSize(10000, 100, 95, {
          method: 'risk-based',
          riskPerTrade: 2,
        });

        expect(result.positionPercent).toBe(40);
        expect(result.positionValue).toBe(4000);
        expect(result.positionSize).toBe(40);
        expect(result.method).toBe('risk-based');
      });

      it('should fallback to fixed when no stop loss', () => {
        const result = PositionSizer.calculatePositionSize(10000, 100, undefined, {
          method: 'risk-based',
          riskPerTrade: 2,
        });

        expect(result.positionPercent).toBe(10);
        expect(result.rationale).toContain('No stop loss');
      });

      it('should fallback when stop loss equals entry', () => {
        const result = PositionSizer.calculatePositionSize(10000, 100, 100, {
          method: 'risk-based',
          riskPerTrade: 2,
        });

        expect(result.positionPercent).toBe(10);
        expect(result.rationale).toContain('No stop loss');
      });

      it('should use default 2% risk when not specified', () => {
        const result = PositionSizer.calculatePositionSize(10000, 100, 98, {
          method: 'risk-based',
        });

        expect(result.method).toBe('risk-based');
        expect(result.riskAmount).toBeGreaterThan(0);
      });
    });

    describe('kelly method', () => {
      it('should calculate Kelly criterion position size', () => {
        const result = PositionSizer.calculatePositionSize(10000, 100, 95, {
          method: 'kelly',
          winRate: 0.6,
          avgWinPercent: 5,
          avgLossPercent: 2,
          kellyFraction: 0.25,
        });

        expect(result.positionPercent).toBeGreaterThan(0);
        expect(result.method).toBe('kelly');
        expect(result.rationale).toContain('Kelly');
      });

      it('should apply Kelly fraction correctly', () => {
        const fullKelly = PositionSizer.calculatePositionSize(10000, 100, 95, {
          method: 'kelly',
          winRate: 0.6,
          avgWinPercent: 5,
          avgLossPercent: 2,
          kellyFraction: 1.0,
        });

        const halfKelly = PositionSizer.calculatePositionSize(10000, 100, 95, {
          method: 'kelly',
          winRate: 0.6,
          avgWinPercent: 5,
          avgLossPercent: 2,
          kellyFraction: 0.5,
        });

        expect(halfKelly.positionPercent).toBeLessThan(fullKelly.positionPercent);
      });

      it('should respect min/max bounds', () => {
        const result = PositionSizer.calculatePositionSize(10000, 100, 95, {
          method: 'kelly',
          winRate: 0.9,
          avgWinPercent: 20,
          avgLossPercent: 1,
          kellyFraction: 1.0,
          maxPositionPercent: 25,
        });

        expect(result.positionPercent).toBeLessThanOrEqual(25);
      });
    });

    describe('volatility method', () => {
      it('should calculate volatility-based position size', () => {
        const result = PositionSizer.calculatePositionSize(10000, 100, undefined, {
          method: 'volatility',
          atr: 2,
          atrMultiplier: 2.0,
        });

        expect(result.positionPercent).toBeGreaterThan(0);
        expect(result.method).toBe('volatility');
        expect(result.rationale).toContain('Volatility-adjusted');
      });

      it('should fallback when ATR is 0', () => {
        const result = PositionSizer.calculatePositionSize(10000, 100, undefined, {
          method: 'volatility',
          atr: 0,
        });

        expect(result.positionPercent).toBe(10);
        expect(result.rationale).toContain('No ATR');
      });

      it('should increase position size when volatility is low', () => {
        const lowVol = PositionSizer.calculatePositionSize(10000, 100, undefined, {
          method: 'volatility',
          atr: 1,
        });

        const highVol = PositionSizer.calculatePositionSize(10000, 100, undefined, {
          method: 'volatility',
          atr: 4,
        });

        expect(lowVol.positionPercent).toBeGreaterThan(highVol.positionPercent);
      });
    });

    describe('riskAmount calculation', () => {
      it('should calculate risk amount with stop loss', () => {
        const result = PositionSizer.calculatePositionSize(10000, 100, 95, {
          method: 'fixed-fractional',
          fixedPercent: 10,
        });

        expect(result.riskAmount).toBe(50);
      });

      it('should use default risk percent without stop loss', () => {
        const result = PositionSizer.calculatePositionSize(10000, 100, undefined, {
          method: 'fixed-fractional',
          fixedPercent: 10,
        });

        expect(result.riskAmount).toBe(20);
      });
    });
  });

  describe('calculateOptimalKellyFraction', () => {
    it('should return default fraction for average performance', () => {
      const fraction = PositionSizer.calculateOptimalKellyFraction(0.5, 1.5, 10);
      expect(fraction).toBe(0.25);
    });

    it('should increase fraction for high win rate', () => {
      const fraction = PositionSizer.calculateOptimalKellyFraction(0.6, 1.5, 10);
      expect(fraction).toBeGreaterThan(0.25);
    });

    it('should increase fraction for high profit factor', () => {
      const fraction = PositionSizer.calculateOptimalKellyFraction(0.5, 2.5, 10);
      expect(fraction).toBeGreaterThan(0.25);
    });

    it('should decrease fraction for low profit factor', () => {
      const fraction = PositionSizer.calculateOptimalKellyFraction(0.5, 1.1, 10);
      expect(fraction).toBeLessThan(0.25);
    });

    it('should decrease fraction for high drawdown', () => {
      const fraction = PositionSizer.calculateOptimalKellyFraction(0.5, 1.5, 25);
      expect(fraction).toBeLessThan(0.25);
    });

    it('should increase fraction for low drawdown', () => {
      const fraction = PositionSizer.calculateOptimalKellyFraction(0.5, 1.5, 3);
      expect(fraction).toBeGreaterThan(0.25);
    });

    it('should respect min/max bounds', () => {
      const veryLow = PositionSizer.calculateOptimalKellyFraction(0.3, 0.8, 30);
      expect(veryLow).toBeGreaterThanOrEqual(0.1);

      const veryHigh = PositionSizer.calculateOptimalKellyFraction(0.8, 3.0, 2);
      expect(veryHigh).toBeLessThanOrEqual(0.5);
    });
  });

  describe('recommendMethod', () => {
    it('should recommend risk-based with stop loss and few trades', () => {
      const method = PositionSizer.recommendMethod(0.5, 1.5, 20, true);
      expect(method).toBe('risk-based');
    });

    it('should recommend fixed-fractional without stop loss and few trades', () => {
      const method = PositionSizer.recommendMethod(0.5, 1.5, 20, false);
      expect(method).toBe('fixed-fractional');
    });

    it('should recommend kelly for good strategy with enough trades', () => {
      const method = PositionSizer.recommendMethod(0.5, 2.0, 100, true);
      expect(method).toBe('kelly');
    });

    it('should recommend risk-based when win rate too high for kelly', () => {
      const method = PositionSizer.recommendMethod(0.7, 2.0, 100, true);
      expect(method).toBe('risk-based');
    });

    it('should recommend risk-based when win rate too low for kelly', () => {
      const method = PositionSizer.recommendMethod(0.3, 2.0, 100, true);
      expect(method).toBe('risk-based');
    });

    it('should recommend fixed-fractional without stop loss', () => {
      const method = PositionSizer.recommendMethod(0.4, 1.2, 100, false);
      expect(method).toBe('fixed-fractional');
    });
  });
});
