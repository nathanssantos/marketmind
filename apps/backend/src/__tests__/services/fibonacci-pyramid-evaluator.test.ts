import { beforeEach, describe, expect, it } from 'vitest';
import {
  calculateFiboTargetPrice,
  evaluateFiboPyramidTrigger,
  getFiboLevelsWithPrices,
  getTriggeredLevelsCount,
  initializeFiboState,
  clearFiboState,
  getFiboState,
  resetAllFiboStates,
  type FiboPyramidConfig,
  type FiboLevel,
} from '../../services/fibonacci-pyramid-evaluator';

const defaultFiboConfig: FiboPyramidConfig = {
  enabledLevels: ['1', '1.272', '1.618'],
  leverage: 1,
  leverageAware: true,
  baseScaleFactor: 0.8,
};

describe('calculateFiboTargetPrice', () => {
  it('should calculate LONG target at 1:1 risk/reward', () => {
    const target = calculateFiboTargetPrice(100, 95, 'LONG', '1');
    expect(target).toBe(105);
  });

  it('should calculate LONG target at 1.272 extension', () => {
    const target = calculateFiboTargetPrice(100, 90, 'LONG', '1.272');
    expect(target).toBeCloseTo(112.72, 2);
  });

  it('should calculate LONG target at 1.618 extension', () => {
    const target = calculateFiboTargetPrice(100, 90, 'LONG', '1.618');
    expect(target).toBeCloseTo(116.18, 2);
  });

  it('should calculate SHORT target at 1:1 risk/reward', () => {
    const target = calculateFiboTargetPrice(100, 105, 'SHORT', '1');
    expect(target).toBe(95);
  });

  it('should calculate SHORT target at 1.272 extension', () => {
    const target = calculateFiboTargetPrice(100, 110, 'SHORT', '1.272');
    expect(target).toBeCloseTo(87.28, 2);
  });

  it('should calculate SHORT target at 1.618 extension', () => {
    const target = calculateFiboTargetPrice(100, 110, 'SHORT', '1.618');
    expect(target).toBeCloseTo(83.82, 2);
  });

  it('should handle 2x extension for LONG', () => {
    const target = calculateFiboTargetPrice(100, 90, 'LONG', '2');
    expect(target).toBe(120);
  });

  it('should handle 2x extension for SHORT', () => {
    const target = calculateFiboTargetPrice(100, 110, 'SHORT', '2');
    expect(target).toBe(80);
  });

  it('should handle 2.618 extension', () => {
    const target = calculateFiboTargetPrice(100, 90, 'LONG', '2.618');
    expect(target).toBeCloseTo(126.18, 2);
  });

  it('should handle 3x extension', () => {
    const target = calculateFiboTargetPrice(100, 90, 'LONG', '3');
    expect(target).toBe(130);
  });

  it('should handle 4.236 extension', () => {
    const target = calculateFiboTargetPrice(100, 90, 'LONG', '4.236');
    expect(target).toBeCloseTo(142.36, 2);
  });

  it('should handle small risk/reward distances', () => {
    const target = calculateFiboTargetPrice(50000, 49990, 'LONG', '1');
    expect(target).toBe(50010);
  });

  it('should handle equal entry and stop loss (zero risk)', () => {
    const target = calculateFiboTargetPrice(100, 100, 'LONG', '1.618');
    expect(target).toBe(100);
  });
});

describe('initializeFiboState / clearFiboState / getFiboState', () => {
  beforeEach(() => {
    resetAllFiboStates();
  });

  it('should initialize state for a symbol-direction pair', () => {
    initializeFiboState('BTCUSDT', 'LONG', 50000);
    const state = getFiboState('BTCUSDT', 'LONG');

    expect(state).toBeDefined();
    expect(state?.symbol).toBe('BTCUSDT');
    expect(state?.direction).toBe('LONG');
    expect(state?.entryPrice).toBe(50000);
    expect(state?.triggeredLevels.size).toBe(0);
  });

  it('should keep LONG and SHORT states separate', () => {
    initializeFiboState('BTCUSDT', 'LONG', 50000);
    initializeFiboState('BTCUSDT', 'SHORT', 52000);

    const longState = getFiboState('BTCUSDT', 'LONG');
    const shortState = getFiboState('BTCUSDT', 'SHORT');

    expect(longState?.entryPrice).toBe(50000);
    expect(shortState?.entryPrice).toBe(52000);
  });

  it('should return undefined for non-existent state', () => {
    expect(getFiboState('BTCUSDT', 'LONG')).toBeUndefined();
  });

  it('should clear state for a specific symbol-direction', () => {
    initializeFiboState('BTCUSDT', 'LONG', 50000);
    initializeFiboState('BTCUSDT', 'SHORT', 52000);

    clearFiboState('BTCUSDT', 'LONG');

    expect(getFiboState('BTCUSDT', 'LONG')).toBeUndefined();
    expect(getFiboState('BTCUSDT', 'SHORT')).toBeDefined();
  });

  it('should overwrite existing state on re-initialize', () => {
    initializeFiboState('BTCUSDT', 'LONG', 50000);
    initializeFiboState('BTCUSDT', 'LONG', 55000);

    const state = getFiboState('BTCUSDT', 'LONG');
    expect(state?.entryPrice).toBe(55000);
    expect(state?.triggeredLevels.size).toBe(0);
  });
});

describe('resetAllFiboStates', () => {
  it('should clear all states', () => {
    initializeFiboState('BTCUSDT', 'LONG', 50000);
    initializeFiboState('ETHUSDT', 'SHORT', 3000);

    resetAllFiboStates();

    expect(getFiboState('BTCUSDT', 'LONG')).toBeUndefined();
    expect(getFiboState('ETHUSDT', 'SHORT')).toBeUndefined();
  });
});

describe('evaluateFiboPyramidTrigger', () => {
  beforeEach(() => {
    resetAllFiboStates();
  });

  it('should auto-initialize state when none exists', () => {
    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 110, defaultFiboConfig
    );

    expect(getFiboState('BTCUSDT', 'LONG')).toBeDefined();
    expect(result.canPyramid).toBe(true);
    expect(result.triggerLevel).toBe('1');
  });

  it('should auto-initialize state but not trigger when price below first level', () => {
    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 106, defaultFiboConfig
    );

    expect(getFiboState('BTCUSDT', 'LONG')).toBeDefined();
    expect(result.canPyramid).toBe(false);
    expect(result.reason).toContain('Waiting for Fibonacci 1 level');
  });

  it('should reject when all levels are triggered', () => {
    initializeFiboState('BTCUSDT', 'LONG', 100);

    evaluateFiboPyramidTrigger('BTCUSDT', 'LONG', 100, 90, 115, defaultFiboConfig);
    evaluateFiboPyramidTrigger('BTCUSDT', 'LONG', 100, 90, 120, defaultFiboConfig);

    const result = evaluateFiboPyramidTrigger('BTCUSDT', 'LONG', 100, 90, 130, defaultFiboConfig);

    expect(result.canPyramid).toBe(false);
    expect(result.reason).toBe('All enabled Fibonacci levels have been triggered');
    expect(result.triggerLevel).toBeNull();
    expect(result.nextLevel).toBeNull();
  });

  it('should reject when position is not in profit (LONG)', () => {
    initializeFiboState('BTCUSDT', 'LONG', 100);

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 98, defaultFiboConfig
    );

    expect(result.canPyramid).toBe(false);
    expect(result.reason).toBe('Position not in profit');
    expect(result.nextLevel).toBe('1');
    expect(result.priceAtLevel).toBe(110);
  });

  it('should reject when position is not in profit (SHORT)', () => {
    initializeFiboState('BTCUSDT', 'SHORT', 100);

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'SHORT', 100, 110, 102, defaultFiboConfig
    );

    expect(result.canPyramid).toBe(false);
    expect(result.reason).toBe('Position not in profit');
  });

  it('should trigger level 1 for LONG when price reaches target', () => {
    initializeFiboState('BTCUSDT', 'LONG', 100);

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 110, defaultFiboConfig
    );

    expect(result.canPyramid).toBe(true);
    expect(result.triggerLevel).toBe('1');
    expect(result.reason).toContain('Fibonacci 1 level reached');
    expect(result.priceAtLevel).toBe(110);
    expect(result.nextLevel).toBe('1.272');
  });

  it('should trigger level 1 for SHORT when price reaches target', () => {
    initializeFiboState('BTCUSDT', 'SHORT', 100);

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'SHORT', 100, 110, 90, defaultFiboConfig
    );

    expect(result.canPyramid).toBe(true);
    expect(result.triggerLevel).toBe('1');
    expect(result.priceAtLevel).toBe(90);
  });

  it('should trigger multiple levels at once when price jumps far', () => {
    initializeFiboState('BTCUSDT', 'LONG', 100);

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 120, defaultFiboConfig
    );

    expect(result.canPyramid).toBe(true);
    expect(result.triggerLevel).toBe('1.618');

    const state = getFiboState('BTCUSDT', 'LONG');
    expect(state?.triggeredLevels.has('1')).toBe(true);
    expect(state?.triggeredLevels.has('1.272')).toBe(true);
    expect(state?.triggeredLevels.has('1.618')).toBe(true);
  });

  it('should not re-trigger already triggered levels', () => {
    initializeFiboState('BTCUSDT', 'LONG', 100);

    evaluateFiboPyramidTrigger('BTCUSDT', 'LONG', 100, 90, 112, defaultFiboConfig);

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 112, defaultFiboConfig
    );

    expect(result.canPyramid).toBe(false);
    expect(result.reason).toContain('Waiting for Fibonacci');
    expect(result.nextLevel).toBe('1.272');
  });

  it('should trigger next level sequentially', () => {
    initializeFiboState('BTCUSDT', 'LONG', 100);

    const firstResult = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 110, defaultFiboConfig
    );
    expect(firstResult.canPyramid).toBe(true);
    expect(firstResult.triggerLevel).toBe('1');
    expect(firstResult.nextLevel).toBe('1.272');

    const secondResult = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 112.72, defaultFiboConfig
    );
    expect(secondResult.canPyramid).toBe(true);
    expect(secondResult.triggerLevel).toBe('1.272');
    expect(secondResult.nextLevel).toBe('1.618');

    const thirdResult = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 116.18, defaultFiboConfig
    );
    expect(thirdResult.canPyramid).toBe(true);
    expect(thirdResult.triggerLevel).toBe('1.618');
    expect(thirdResult.nextLevel).toBeNull();
    expect(thirdResult.distanceToNextPercent).toBeNull();
  });

  it('should report waiting state with correct next level price', () => {
    initializeFiboState('BTCUSDT', 'LONG', 100);

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 102, defaultFiboConfig
    );

    expect(result.canPyramid).toBe(false);
    expect(result.nextLevel).toBe('1');
    expect(result.priceAtLevel).toBe(110);
    expect(result.distanceToNextPercent).toBeGreaterThan(0);
    expect(result.reason).toContain('Waiting for Fibonacci 1 level');
  });

  it('should calculate distanceToNextPercent correctly', () => {
    initializeFiboState('BTCUSDT', 'LONG', 100);

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 105, defaultFiboConfig
    );

    expect(result.distanceToNextPercent).toBeCloseTo(
      Math.abs((110 - 105) / 105) * 100, 1
    );
  });

  it('should handle custom fibo levels', () => {
    initializeFiboState('BTCUSDT', 'LONG', 100);

    const customConfig: FiboPyramidConfig = {
      ...defaultFiboConfig,
      enabledLevels: ['2', '3'],
    };

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 110, customConfig
    );

    expect(result.canPyramid).toBe(false);
    expect(result.nextLevel).toBe('2');
    expect(result.priceAtLevel).toBe(120);
  });

  it('should sort enabled levels by value', () => {
    initializeFiboState('BTCUSDT', 'LONG', 100);

    const unsortedConfig: FiboPyramidConfig = {
      ...defaultFiboConfig,
      enabledLevels: ['1.618', '1', '1.272'],
    };

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 110, unsortedConfig
    );

    expect(result.triggerLevel).toBe('1');
    expect(result.nextLevel).toBe('1.272');
  });

  it('should handle position at break-even (not in profit LONG)', () => {
    initializeFiboState('BTCUSDT', 'LONG', 100);

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 100, defaultFiboConfig
    );

    expect(result.canPyramid).toBe(false);
    expect(result.reason).toBe('Position not in profit');
  });

  it('should handle position at break-even (not in profit SHORT)', () => {
    initializeFiboState('BTCUSDT', 'SHORT', 100);

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'SHORT', 100, 110, 100, defaultFiboConfig
    );

    expect(result.canPyramid).toBe(false);
    expect(result.reason).toBe('Position not in profit');
  });

  it('should trigger when price exactly equals level price (LONG)', () => {
    initializeFiboState('BTCUSDT', 'LONG', 100);

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 110, defaultFiboConfig
    );

    expect(result.canPyramid).toBe(true);
    expect(result.triggerLevel).toBe('1');
  });

  it('should trigger when price exactly equals level price (SHORT)', () => {
    initializeFiboState('BTCUSDT', 'SHORT', 100);

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'SHORT', 100, 110, 90, defaultFiboConfig
    );

    expect(result.canPyramid).toBe(true);
    expect(result.triggerLevel).toBe('1');
  });

  it('should not trigger when price is just below level (LONG)', () => {
    initializeFiboState('BTCUSDT', 'LONG', 100);

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 109.99, defaultFiboConfig
    );

    expect(result.canPyramid).toBe(false);
  });

  it('should not trigger when price is just above level (SHORT)', () => {
    initializeFiboState('BTCUSDT', 'SHORT', 100);

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'SHORT', 100, 110, 90.01, defaultFiboConfig
    );

    expect(result.canPyramid).toBe(false);
  });

  it('should report null distanceToNextPercent when no next level exists after trigger', () => {
    const singleLevelConfig: FiboPyramidConfig = {
      ...defaultFiboConfig,
      enabledLevels: ['1'],
    };

    initializeFiboState('BTCUSDT', 'LONG', 100);

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 110, singleLevelConfig
    );

    expect(result.canPyramid).toBe(true);
    expect(result.nextLevel).toBeNull();
    expect(result.distanceToNextPercent).toBeNull();
  });

  it('should report null distanceToNextPercent when not in profit and no next level', () => {
    const singleLevelConfig: FiboPyramidConfig = {
      ...defaultFiboConfig,
      enabledLevels: [],
    };

    initializeFiboState('BTCUSDT', 'LONG', 100);

    const result = evaluateFiboPyramidTrigger(
      'BTCUSDT', 'LONG', 100, 90, 98, singleLevelConfig
    );

    expect(result.canPyramid).toBe(false);
    expect(result.reason).toBe('All enabled Fibonacci levels have been triggered');
  });
});

describe('getFiboLevelsWithPrices', () => {
  it('should return level prices for LONG direction', () => {
    const levels = getFiboLevelsWithPrices(100, 90, 'LONG', ['1', '1.272', '1.618']);

    expect(levels).toHaveLength(3);
    expect(levels[0]?.level).toBe('1');
    expect(levels[0]?.price).toBe(110);
    expect(levels[1]?.level).toBe('1.272');
    expect(levels[1]?.price).toBeCloseTo(112.72, 2);
    expect(levels[2]?.level).toBe('1.618');
    expect(levels[2]?.price).toBeCloseTo(116.18, 2);
  });

  it('should return level prices for SHORT direction', () => {
    const levels = getFiboLevelsWithPrices(100, 110, 'SHORT', ['1', '1.618']);

    expect(levels).toHaveLength(2);
    expect(levels[0]?.level).toBe('1');
    expect(levels[0]?.price).toBe(90);
    expect(levels[1]?.level).toBe('1.618');
    expect(levels[1]?.price).toBeCloseTo(83.82, 2);
  });

  it('should calculate percentFromEntry correctly', () => {
    const levels = getFiboLevelsWithPrices(100, 90, 'LONG', ['1']);

    expect(levels[0]?.percentFromEntry).toBe(10);
  });

  it('should return empty array for empty levels', () => {
    const levels = getFiboLevelsWithPrices(100, 90, 'LONG', []);
    expect(levels).toEqual([]);
  });

  it('should handle all available extension levels', () => {
    const allLevels: FiboLevel[] = ['1', '1.272', '1.382', '1.618', '2', '2.618', '3', '3.618', '4.236'];
    const levels = getFiboLevelsWithPrices(100, 90, 'LONG', allLevels);

    expect(levels).toHaveLength(9);
    levels.forEach((level) => {
      expect(level.price).toBeGreaterThan(100);
      expect(level.percentFromEntry).toBeGreaterThan(0);
    });
  });
});

describe('getTriggeredLevelsCount', () => {
  beforeEach(() => {
    resetAllFiboStates();
  });

  it('should return 0 when no state exists', () => {
    expect(getTriggeredLevelsCount('BTCUSDT', 'LONG')).toBe(0);
  });

  it('should return 0 when state exists but no levels triggered', () => {
    initializeFiboState('BTCUSDT', 'LONG', 50000);
    expect(getTriggeredLevelsCount('BTCUSDT', 'LONG')).toBe(0);
  });

  it('should return correct count after triggering levels', () => {
    initializeFiboState('BTCUSDT', 'LONG', 100);

    evaluateFiboPyramidTrigger('BTCUSDT', 'LONG', 100, 90, 110, defaultFiboConfig);
    expect(getTriggeredLevelsCount('BTCUSDT', 'LONG')).toBe(1);

    evaluateFiboPyramidTrigger('BTCUSDT', 'LONG', 100, 90, 112.72, defaultFiboConfig);
    expect(getTriggeredLevelsCount('BTCUSDT', 'LONG')).toBe(2);
  });

  it('should not increment count on duplicate triggers', () => {
    initializeFiboState('BTCUSDT', 'LONG', 100);

    evaluateFiboPyramidTrigger('BTCUSDT', 'LONG', 100, 90, 110, defaultFiboConfig);
    evaluateFiboPyramidTrigger('BTCUSDT', 'LONG', 100, 90, 110, defaultFiboConfig);

    expect(getTriggeredLevelsCount('BTCUSDT', 'LONG')).toBe(1);
  });

  it('should track counts independently per symbol-direction', () => {
    initializeFiboState('BTCUSDT', 'LONG', 100);
    initializeFiboState('ETHUSDT', 'LONG', 100);

    evaluateFiboPyramidTrigger('BTCUSDT', 'LONG', 100, 90, 120, defaultFiboConfig);

    expect(getTriggeredLevelsCount('BTCUSDT', 'LONG')).toBeGreaterThan(0);
    expect(getTriggeredLevelsCount('ETHUSDT', 'LONG')).toBe(0);
  });
});
