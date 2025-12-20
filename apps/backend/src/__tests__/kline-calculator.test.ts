import { describe, expect, it } from 'vitest';
import {
  calculateRequiredKlinesForML,
  MIN_KLINES_FOR_ML,
  MAX_KLINES_FOR_ML,
  DEFAULT_KLINES_FOR_ML
} from '../utils/kline-calculator';

describe('kline-calculator', () => {
  describe('constants', () => {
    it('should have correct constant values', () => {
      expect(MIN_KLINES_FOR_ML).toBe(100);
      expect(MAX_KLINES_FOR_ML).toBe(500);
      expect(DEFAULT_KLINES_FOR_ML).toBe(300);
    });
  });

  describe('calculateRequiredKlinesForML', () => {
    it('should return minimum klines for empty strategy array', () => {
      const result = calculateRequiredKlinesForML([]);
      expect(result).toBe(MIN_KLINES_FOR_ML);
    });

    it('should return minimum klines for strategy without indicators', () => {
      const strategies = [{ id: 'test-strategy' }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(MIN_KLINES_FOR_ML);
    });

    it('should calculate klines based on indicator period', () => {
      const strategies = [{
        id: 'test-strategy',
        indicators: {
          ema: { params: { period: 50 } }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(MIN_KLINES_FOR_ML);
    });

    it('should calculate klines for EMA200', () => {
      const strategies = [{
        id: 'test-strategy',
        indicators: {
          ema200: { params: { period: 200 } }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(300);
    });

    it('should use emaPeriod param', () => {
      const strategies = [{
        id: 'test-strategy',
        indicators: {
          ema: { params: { emaPeriod: 100 } }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(150);
    });

    it('should use smaPeriod param', () => {
      const strategies = [{
        id: 'test-strategy',
        indicators: {
          sma: { params: { smaPeriod: 150 } }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(225);
    });

    it('should use lookback param', () => {
      const strategies = [{
        id: 'test-strategy',
        indicators: {
          channel: { params: { lookback: 120 } }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(180);
    });

    it('should use kPeriod param', () => {
      const strategies = [{
        id: 'test-strategy',
        indicators: {
          stochastic: { params: { kPeriod: 80 } }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(120);
    });

    it('should use slowPeriod param', () => {
      const strategies = [{
        id: 'test-strategy',
        indicators: {
          macd: { params: { slowPeriod: 100 } }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(150);
    });

    it('should take max period from multiple indicators', () => {
      const strategies = [{
        id: 'test-strategy',
        indicators: {
          ema1: { params: { period: 50 } },
          ema2: { params: { period: 100 } },
          ema3: { params: { period: 200 } }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(300);
    });

    it('should resolve parameter references', () => {
      const strategies = [{
        id: 'test-strategy',
        indicators: {
          ema: { params: { period: '$emaPeriod' } }
        },
        parameters: {
          emaPeriod: { default: 150 }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(225);
    });

    it('should handle missing parameter reference', () => {
      const strategies = [{
        id: 'test-strategy',
        indicators: {
          ema: { params: { period: '$nonExistent' } }
        },
        parameters: {}
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(MIN_KLINES_FOR_ML);
    });

    it('should check trend-related parameters', () => {
      const strategies = [{
        id: 'test-strategy',
        parameters: {
          trendPeriod: { default: 180 }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(270);
    });

    it('should check ema-related parameters', () => {
      const strategies = [{
        id: 'test-strategy',
        parameters: {
          emaPeriod: { default: 200 }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(300);
    });

    it('should check sma-related parameters', () => {
      const strategies = [{
        id: 'test-strategy',
        parameters: {
          smaLong: { default: 250 }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(375);
    });

    it('should use trend filter period', () => {
      const strategies = [{
        id: 'test-strategy',
        filters: {
          trendFilter: { period: 200 }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(300);
    });

    it('should use EMA200 for onlyWithTrend', () => {
      const strategies = [{
        id: 'test-strategy',
        optimizedParams: {
          onlyWithTrend: true
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(300);
    });

    it('should take max from multiple strategies', () => {
      const strategies = [
        { id: 'strategy1', indicators: { ema: { params: { period: 50 } } } },
        { id: 'strategy2', indicators: { ema: { params: { period: 100 } } } },
        { id: 'strategy3', indicators: { ema: { params: { period: 200 } } } }
      ];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(300);
    });

    it('should respect minimum bound', () => {
      const strategies = [{
        id: 'test-strategy',
        indicators: {
          ema: { params: { period: 10 } }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(MIN_KLINES_FOR_ML);
    });

    it('should respect maximum bound', () => {
      const strategies = [{
        id: 'test-strategy',
        indicators: {
          ema: { params: { period: 1000 } }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(MAX_KLINES_FOR_ML);
    });

    it('should apply 1.5x multiplier', () => {
      const strategies = [{
        id: 'test-strategy',
        indicators: {
          ema: { params: { period: 100 } }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(150);
    });

    it('should handle string parameter that is not a reference', () => {
      const strategies = [{
        id: 'test-strategy',
        indicators: {
          ema: { params: { period: 'invalid' } }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(MIN_KLINES_FOR_ML);
    });

    it('should handle mixed numeric and reference params', () => {
      const strategies = [{
        id: 'test-strategy',
        indicators: {
          ema1: { params: { period: 50 } },
          ema2: { params: { period: '$longPeriod' } }
        },
        parameters: {
          longPeriod: { default: 200 }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(300);
    });

    it('should ignore non-period related parameters', () => {
      const strategies = [{
        id: 'test-strategy',
        parameters: {
          confidence: { default: 80 },
          riskReward: { default: 2.5 }
        }
      }];
      const result = calculateRequiredKlinesForML(strategies);
      expect(result).toBe(MIN_KLINES_FOR_ML);
    });
  });
});
