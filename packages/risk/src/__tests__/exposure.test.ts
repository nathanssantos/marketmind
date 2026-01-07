import { describe, it, expect } from 'vitest';
import {
  calculateDynamicExposure,
  calculatePositionExposure,
  calculateMaxPositionValue,
  calculateMaxTotalExposure,
  calculateMaxDailyLoss,
  calculateDrawdownPercent,
  validateOrderSizePure,
  calculateExposureUtilization,
  canOpenNewPosition,
} from '../exposure';

describe('calculateDynamicExposure', () => {
  const defaultConfig = {
    exposureMultiplier: 1.5,
    maxPositionSizePercent: 10,
    maxConcurrentPositions: 5,
  };

  it('should divide exposure evenly among watchers', () => {
    const result = calculateDynamicExposure(10000, 4, defaultConfig);

    expect(result.exposurePerWatcher).toBe(37.5);
    expect(result.maxPositionValue).toBe(3750);
    expect(result.maxTotalExposure).toBe(15000);
  });

  it('should cap exposure at 100%', () => {
    const result = calculateDynamicExposure(10000, 1, defaultConfig);

    expect(result.exposurePerWatcher).toBe(100);
    expect(result.maxPositionValue).toBe(10000);
  });

  it('should fallback to maxPositionSizePercent with 0 watchers', () => {
    const result = calculateDynamicExposure(10000, 0, defaultConfig);

    expect(result.exposurePerWatcher).toBe(10);
    expect(result.maxPositionValue).toBe(1000);
    expect(result.maxTotalExposure).toBe(5000);
  });

  it('should calculate correctly with 2 watchers', () => {
    const result = calculateDynamicExposure(10000, 2, defaultConfig);

    expect(result.exposurePerWatcher).toBe(75);
    expect(result.maxPositionValue).toBe(7500);
    expect(result.maxTotalExposure).toBe(15000);
  });

  it('should calculate correctly with 3 watchers', () => {
    const result = calculateDynamicExposure(10000, 3, defaultConfig);

    expect(result.exposurePerWatcher).toBe(50);
    expect(result.maxPositionValue).toBe(5000);
    expect(result.maxTotalExposure).toBe(15000);
  });

  it('should handle higher exposure multiplier', () => {
    const highMultiplierConfig = { ...defaultConfig, exposureMultiplier: 2.0 };
    const result = calculateDynamicExposure(10000, 4, highMultiplierConfig);

    expect(result.exposurePerWatcher).toBe(50);
    expect(result.maxPositionValue).toBe(5000);
    expect(result.maxTotalExposure).toBe(20000);
  });

  it('should handle many watchers with low per-watcher exposure', () => {
    const result = calculateDynamicExposure(10000, 10, defaultConfig);

    expect(result.exposurePerWatcher).toBe(15);
    expect(result.maxPositionValue).toBe(1500);
    expect(result.maxTotalExposure).toBe(15000);
  });
});

describe('calculatePositionExposure', () => {
  it('should calculate total exposure from positions', () => {
    const positions = [
      { entryPrice: 100, quantity: 10 },
      { entryPrice: 50, quantity: 20 },
    ];

    const result = calculatePositionExposure(positions);

    expect(result).toBe(2000);
  });

  it('should return 0 for empty positions', () => {
    const result = calculatePositionExposure([]);

    expect(result).toBe(0);
  });

  it('should handle single position', () => {
    const positions = [{ entryPrice: 45000, quantity: 0.1 }];

    const result = calculatePositionExposure(positions);

    expect(result).toBe(4500);
  });
});

describe('calculateMaxPositionValue', () => {
  it('should calculate max position value', () => {
    const result = calculateMaxPositionValue(10000, 15);

    expect(result).toBe(1500);
  });

  it('should handle 100% position size', () => {
    const result = calculateMaxPositionValue(10000, 100);

    expect(result).toBe(10000);
  });
});

describe('calculateMaxTotalExposure', () => {
  it('should calculate max total exposure', () => {
    const result = calculateMaxTotalExposure(10000, 15, 5);

    expect(result).toBe(7500);
  });
});

describe('calculateMaxDailyLoss', () => {
  it('should calculate max daily loss', () => {
    const result = calculateMaxDailyLoss(10000, 5);

    expect(result).toBe(500);
  });
});

describe('calculateDrawdownPercent', () => {
  it('should calculate drawdown percentage', () => {
    const result = calculateDrawdownPercent(10000, 8500);

    expect(result).toBe(15);
  });

  it('should return 0 for initial balance <= 0', () => {
    const result = calculateDrawdownPercent(0, 1000);

    expect(result).toBe(0);
  });

  it('should return 0 when current equals initial', () => {
    const result = calculateDrawdownPercent(10000, 10000);

    expect(result).toBe(0);
  });

  it('should handle negative drawdown (profit)', () => {
    const result = calculateDrawdownPercent(10000, 11000);

    expect(result).toBe(-10);
  });
});

describe('validateOrderSizePure', () => {
  it('should validate valid order size', () => {
    const result = validateOrderSizePure(10000, 1000, 15);

    expect(result.isValid).toBe(true);
    expect(result.maxAllowed).toBe(1500);
  });

  it('should reject order exceeding max', () => {
    const result = validateOrderSizePure(10000, 2000, 15);

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('exceeds maximum');
    expect(result.maxAllowed).toBe(1500);
  });

  it('should accept order at exact max', () => {
    const result = validateOrderSizePure(10000, 1500, 15);

    expect(result.isValid).toBe(true);
  });
});

describe('calculateExposureUtilization', () => {
  it('should calculate utilization percentage', () => {
    const result = calculateExposureUtilization(5000, 10000);

    expect(result).toBe(50);
  });

  it('should return 0 when max is 0', () => {
    const result = calculateExposureUtilization(5000, 0);

    expect(result).toBe(0);
  });

  it('should handle over 100% utilization', () => {
    const result = calculateExposureUtilization(15000, 10000);

    expect(result).toBe(150);
  });
});

describe('canOpenNewPosition', () => {
  it('should allow position within limits', () => {
    const result = canOpenNewPosition(5000, 2000, 10000);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should reject position exceeding limits', () => {
    const result = canOpenNewPosition(8000, 3000, 10000);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('would exceed max');
  });

  it('should allow position at exact limit', () => {
    const result = canOpenNewPosition(7000, 3000, 10000);

    expect(result.allowed).toBe(true);
  });
});
