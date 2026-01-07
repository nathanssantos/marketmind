import { describe, it, expect } from 'vitest';
import {
  calculateWeightedAvgPrice,
  calculateTotalExposure,
  roundQuantity,
  calculatePositionSize,
  calculateRiskBasedPositionSize,
} from '../positionSizing';

describe('calculateWeightedAvgPrice', () => {
  it('should calculate weighted average price', () => {
    const executions = [
      { entryPrice: 100, quantity: 10 },
      { entryPrice: 120, quantity: 10 },
    ];

    const result = calculateWeightedAvgPrice(executions);

    expect(result).toBe(110);
  });

  it('should handle different quantities', () => {
    const executions = [
      { entryPrice: 100, quantity: 30 },
      { entryPrice: 200, quantity: 10 },
    ];

    const result = calculateWeightedAvgPrice(executions);

    expect(result).toBe(125);
  });

  it('should return 0 for empty executions', () => {
    const result = calculateWeightedAvgPrice([]);

    expect(result).toBe(0);
  });

  it('should handle single execution', () => {
    const executions = [{ entryPrice: 45000, quantity: 0.5 }];

    const result = calculateWeightedAvgPrice(executions);

    expect(result).toBe(45000);
  });
});

describe('calculateTotalExposure', () => {
  it('should calculate total exposure', () => {
    const executions = [
      { entryPrice: 100, quantity: 10 },
      { entryPrice: 50, quantity: 20 },
    ];

    const result = calculateTotalExposure(executions);

    expect(result).toBe(2000);
  });

  it('should return 0 for empty executions', () => {
    const result = calculateTotalExposure([]);

    expect(result).toBe(0);
  });
});

describe('roundQuantity', () => {
  it('should round small quantities (< 1) to 5 decimals', () => {
    const result = roundQuantity(0.123456789);

    expect(result).toBe(0.12345);
  });

  it('should round medium quantities (1-10) to 3 decimals', () => {
    const result = roundQuantity(5.123456);

    expect(result).toBe(5.123);
  });

  it('should round large quantities (>= 10) to 2 decimals', () => {
    const result = roundQuantity(123.456789);

    expect(result).toBe(123.45);
  });

  it('should floor, not round up', () => {
    const result = roundQuantity(0.999999);

    expect(result).toBe(0.99999);
  });
});

describe('calculatePositionSize', () => {
  it('should calculate position size from exposure percent', () => {
    const result = calculatePositionSize(10000, 100, 10);

    expect(result.positionValue).toBe(1000);
    expect(result.quantity).toBe(10);
  });

  it('should calculate for high-priced assets', () => {
    const result = calculatePositionSize(10000, 45000, 10);

    expect(result.positionValue).toBe(1000);
    expect(result.quantity).toBeCloseTo(0.02222, 4);
  });

  it('should round quantity appropriately', () => {
    const result = calculatePositionSize(10000, 45678.12, 15);

    expect(result.positionValue).toBe(1500);
    expect(result.quantity).toBe(0.03283);
  });
});

describe('calculateRiskBasedPositionSize', () => {
  it('should calculate position size based on risk', () => {
    const result = calculateRiskBasedPositionSize(10000, 100, 95, 2);

    expect(result.quantity).toBe(40);
    expect(result.positionValue).toBe(4000);
  });

  it('should return 0 when stopLoss equals entryPrice', () => {
    const result = calculateRiskBasedPositionSize(10000, 100, 100, 2);

    expect(result.quantity).toBe(0);
    expect(result.positionValue).toBe(0);
  });

  it('should handle SHORT positions (stopLoss > entryPrice)', () => {
    const result = calculateRiskBasedPositionSize(10000, 100, 105, 2);

    expect(result.quantity).toBe(40);
    expect(result.positionValue).toBe(4000);
  });

  it('should calculate correctly for crypto prices', () => {
    const result = calculateRiskBasedPositionSize(10000, 45000, 44000, 1);

    expect(result.quantity).toBe(0.1);
    expect(result.positionValue).toBe(4500);
  });
});
