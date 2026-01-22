import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  calculateWeightedAvgPrice,
  calculateTotalExposure,
  roundQuantity,
  calculatePositionSize,
  calculateRiskBasedPositionSize,
} from '../positionSizing';
import type { PositionLike } from '../types';

const executionArbitrary = fc.record({
  entryPrice: fc.double({ min: 0.01, max: 100000, noNaN: true }),
  quantity: fc.double({ min: 0.0001, max: 10000, noNaN: true }),
});

const executionsArrayArbitrary = fc.array(executionArbitrary, { minLength: 1, maxLength: 20 });

describe('Property-Based Testing: Position Sizing', () => {
  describe('calculateWeightedAvgPrice Properties', () => {
    it('should always be between min and max entry prices', () => {
      fc.assert(
        fc.property(executionsArrayArbitrary, (executions) => {
          const result = calculateWeightedAvgPrice(executions);
          const prices = executions.map((e) => e.entryPrice);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          return result >= minPrice - 0.0001 && result <= maxPrice + 0.0001;
        }),
        { numRuns: 100 }
      );
    });

    it('should equal entryPrice for single execution', () => {
      fc.assert(
        fc.property(executionArbitrary, (execution) => {
          const result = calculateWeightedAvgPrice([execution]);
          return Math.abs(result - execution.entryPrice) < 0.0001;
        }),
        { numRuns: 100 }
      );
    });

    it('should be weighted towards larger quantities', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 10, max: 1000, noNaN: true }),
          fc.double({ min: 10, max: 1000, noNaN: true }),
          fc.double({ min: 0.01, max: 100, noNaN: true }),
          fc.double({ min: 0.01, max: 100, noNaN: true }),
          (price1, price2, qty1, qty2) => {
            if (price1 === price2) return true;
            const executions: PositionLike[] = [
              { entryPrice: price1, quantity: qty1 },
              { entryPrice: price2, quantity: qty2 },
            ];
            const result = calculateWeightedAvgPrice(executions);
            const simpleAvg = (price1 + price2) / 2;

            if (qty1 > qty2 && price1 < price2) return result < simpleAvg + 0.0001;
            if (qty1 > qty2 && price1 > price2) return result > simpleAvg - 0.0001;
            if (qty2 > qty1 && price2 < price1) return result < simpleAvg + 0.0001;
            if (qty2 > qty1 && price2 > price1) return result > simpleAvg - 0.0001;
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return positive value for positive inputs', () => {
      fc.assert(
        fc.property(executionsArrayArbitrary, (executions) => {
          const result = calculateWeightedAvgPrice(executions);
          return result > 0;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('calculateTotalExposure Properties', () => {
    it('should always be positive for non-empty inputs', () => {
      fc.assert(
        fc.property(executionsArrayArbitrary, (executions) => {
          const result = calculateTotalExposure(executions);
          return result > 0;
        }),
        { numRuns: 100 }
      );
    });

    it('should equal sum of individual exposures', () => {
      fc.assert(
        fc.property(executionsArrayArbitrary, (executions) => {
          const result = calculateTotalExposure(executions);
          const manualSum = executions.reduce((sum, e) => sum + e.entryPrice * e.quantity, 0);
          return Math.abs(result - manualSum) < 0.0001;
        }),
        { numRuns: 100 }
      );
    });

    it('should scale linearly with quantity', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 10000, noNaN: true }),
          fc.double({ min: 0.01, max: 1000, noNaN: true }),
          fc.double({ min: 1.1, max: 10, noNaN: true }),
          (price, qty, multiplier) => {
            const executions1: PositionLike[] = [{ entryPrice: price, quantity: qty }];
            const executions2: PositionLike[] = [{ entryPrice: price, quantity: qty * multiplier }];
            const result1 = calculateTotalExposure(executions1);
            const result2 = calculateTotalExposure(executions2);
            return Math.abs(result2 / result1 - multiplier) < 0.001;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('roundQuantity Properties', () => {
    it('should always return a value less than or equal to input', () => {
      fc.assert(
        fc.property(fc.double({ min: 0.00001, max: 1000000, noNaN: true }), (qty) => {
          const result = roundQuantity(qty);
          return result <= qty + 0.000001;
        }),
        { numRuns: 100 }
      );
    });

    it('should always return a positive value for positive input', () => {
      fc.assert(
        fc.property(fc.double({ min: 0.00001, max: 1000000, noNaN: true }), (qty) => {
          const result = roundQuantity(qty);
          return result >= 0;
        }),
        { numRuns: 100 }
      );
    });

    it('should have correct precision based on magnitude', () => {
      fc.assert(
        fc.property(fc.double({ min: 0.00001, max: 1000000, noNaN: true }), (qty) => {
          const result = roundQuantity(qty);
          const resultStr = result.toString();
          const decimals = resultStr.includes('.') ? resultStr.split('.')[1]?.length ?? 0 : 0;

          if (qty < 1) return decimals <= 5;
          if (qty < 10) return decimals <= 3;
          return decimals <= 2;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('calculatePositionSize Properties', () => {
    it('should never exceed account equity', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100, max: 10000000, noNaN: true }),
          fc.double({ min: 0.01, max: 100000, noNaN: true }),
          fc.double({ min: 0.1, max: 100, noNaN: true }),
          (equity, entryPrice, exposurePercent) => {
            const result = calculatePositionSize(equity, entryPrice, exposurePercent);
            return result.positionValue <= equity * (exposurePercent / 100) + 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate positionValue correctly', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100, max: 10000000, noNaN: true }),
          fc.double({ min: 0.01, max: 100000, noNaN: true }),
          fc.double({ min: 0.1, max: 100, noNaN: true }),
          (equity, entryPrice, exposurePercent) => {
            const result = calculatePositionSize(equity, entryPrice, exposurePercent);
            const expectedPositionValue = (equity * exposurePercent) / 100;
            return Math.abs(result.positionValue - expectedPositionValue) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have quantity that approximates positionValue / entryPrice', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1000, max: 10000000, noNaN: true }),
          fc.double({ min: 1, max: 100000, noNaN: true }),
          fc.double({ min: 1, max: 50, noNaN: true }),
          (equity, entryPrice, exposurePercent) => {
            const result = calculatePositionSize(equity, entryPrice, exposurePercent);
            const expectedQuantity = result.positionValue / entryPrice;
            return Math.abs(result.quantity - roundQuantity(expectedQuantity)) < 0.00001;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should scale linearly with exposure percent', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1000, max: 10000000, noNaN: true }),
          fc.double({ min: 1, max: 100000, noNaN: true }),
          fc.double({ min: 1, max: 25, noNaN: true }),
          (equity, entryPrice, exposurePercent) => {
            const result1 = calculatePositionSize(equity, entryPrice, exposurePercent);
            const result2 = calculatePositionSize(equity, entryPrice, exposurePercent * 2);
            return Math.abs(result2.positionValue / result1.positionValue - 2) < 0.001;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('calculateRiskBasedPositionSize Properties', () => {
    it('should never exceed risk amount for the trade', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1000, max: 10000000, noNaN: true }),
          fc.double({ min: 10, max: 100000, noNaN: true }),
          fc.double({ min: 0.01, max: 0.2, noNaN: true }),
          fc.double({ min: 0.1, max: 5, noNaN: true }),
          (equity, entryPrice, stopPercent, riskPercent) => {
            const stopLoss = entryPrice * (1 - stopPercent);
            const result = calculateRiskBasedPositionSize(equity, entryPrice, stopLoss, riskPercent);
            const actualRisk = result.quantity * Math.abs(entryPrice - stopLoss);
            const maxRisk = (equity * riskPercent) / 100;
            return actualRisk <= maxRisk + 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return zero quantity when stopLoss equals entryPrice', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1000, max: 10000000, noNaN: true }),
          fc.double({ min: 10, max: 100000, noNaN: true }),
          fc.double({ min: 0.1, max: 5, noNaN: true }),
          (equity, entryPrice, riskPercent) => {
            const result = calculateRiskBasedPositionSize(equity, entryPrice, entryPrice, riskPercent);
            return result.quantity === 0 && result.positionValue === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle both long and short positions symmetrically', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1000, max: 10000000, noNaN: true }),
          fc.double({ min: 100, max: 100000, noNaN: true }),
          fc.double({ min: 1, max: 20, noNaN: true }),
          fc.double({ min: 0.1, max: 5, noNaN: true }),
          (equity, entryPrice, stopDistance, riskPercent) => {
            const longStop = entryPrice - stopDistance;
            const shortStop = entryPrice + stopDistance;
            const longResult = calculateRiskBasedPositionSize(equity, entryPrice, longStop, riskPercent);
            const shortResult = calculateRiskBasedPositionSize(equity, entryPrice, shortStop, riskPercent);
            return Math.abs(longResult.quantity - shortResult.quantity) < 0.00001;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should increase position size with tighter stop loss', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 10000, max: 10000000, noNaN: true }),
          fc.double({ min: 100, max: 100000, noNaN: true }),
          fc.double({ min: 0.1, max: 5, noNaN: true }),
          (equity, entryPrice, riskPercent) => {
            const wideStop = entryPrice * 0.9;
            const tightStop = entryPrice * 0.95;
            const wideResult = calculateRiskBasedPositionSize(equity, entryPrice, wideStop, riskPercent);
            const tightResult = calculateRiskBasedPositionSize(equity, entryPrice, tightStop, riskPercent);
            return tightResult.quantity >= wideResult.quantity - 0.00001;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should scale approximately linearly with risk percent (accounting for rounding)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100000, max: 10000000, noNaN: true }),
          fc.double({ min: 100, max: 10000, noNaN: true }),
          fc.double({ min: 0.05, max: 0.15, noNaN: true }),
          fc.double({ min: 1, max: 2.5, noNaN: true }),
          (equity, entryPrice, stopPercent, riskPercent) => {
            const stopLoss = entryPrice * (1 - stopPercent);
            const result1 = calculateRiskBasedPositionSize(equity, entryPrice, stopLoss, riskPercent);
            const result2 = calculateRiskBasedPositionSize(equity, entryPrice, stopLoss, riskPercent * 2);
            if (result1.quantity === 0) return true;
            const ratio = result2.positionValue / result1.positionValue;
            return Math.abs(ratio - 2) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always return non-negative values', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1000, max: 10000000, noNaN: true }),
          fc.double({ min: 10, max: 100000, noNaN: true }),
          fc.double({ min: 5, max: 200000, noNaN: true }),
          fc.double({ min: 0.1, max: 10, noNaN: true }),
          (equity, entryPrice, stopLoss, riskPercent) => {
            const result = calculateRiskBasedPositionSize(equity, entryPrice, stopLoss, riskPercent);
            return result.quantity >= 0 && result.positionValue >= 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
