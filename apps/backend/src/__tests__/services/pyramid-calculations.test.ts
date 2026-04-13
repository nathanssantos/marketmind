import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/min-notional-filter', () => ({
  getMinNotionalFilterService: vi.fn(() => ({
    validateQuantityAgainstMinQty: vi.fn().mockResolvedValue({ isValid: true }),
  })),
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@marketmind/logger', () => ({
  colorize: vi.fn((text: string) => text),
}));

import {
  calculateWeightedAvgPrice,
  calculateTotalExposure,
  calculateBaseSize,
  roundQuantity,
  calculatePyramidProfitPercent,
  calculatePyramidSize,
  logPyramidDecision,
  getExposureSummary,
  calculateInitialPositionSize,
  DEFAULT_PYRAMIDING_CONFIG,
  type ExecutionLike,
} from '../../services/pyramid-calculations';
import { getMinNotionalFilterService } from '../../services/min-notional-filter';

const createExecution = (
  entryPrice: string,
  quantity: string,
  openedAt: Date = new Date(),
  side: string = 'LONG',
  stopLoss: string | null = null
): ExecutionLike => ({
  entryPrice,
  quantity,
  openedAt,
  side,
  stopLoss,
});

describe('DEFAULT_PYRAMIDING_CONFIG', () => {
  it('should have expected defaults', () => {
    expect(DEFAULT_PYRAMIDING_CONFIG.profitThreshold).toBe(0.01);
    expect(DEFAULT_PYRAMIDING_CONFIG.minDistance).toBe(0.005);
    expect(DEFAULT_PYRAMIDING_CONFIG.maxEntries).toBe(5);
    expect(DEFAULT_PYRAMIDING_CONFIG.scaleFactor).toBe(0.8);
    expect(DEFAULT_PYRAMIDING_CONFIG.mlConfidenceBoost).toBe(1.2);
    expect(DEFAULT_PYRAMIDING_CONFIG.mode).toBe('static');
    expect(DEFAULT_PYRAMIDING_CONFIG.useAtr).toBe(true);
    expect(DEFAULT_PYRAMIDING_CONFIG.useAdx).toBe(true);
    expect(DEFAULT_PYRAMIDING_CONFIG.useRsi).toBe(false);
    expect(DEFAULT_PYRAMIDING_CONFIG.leverage).toBe(1);
    expect(DEFAULT_PYRAMIDING_CONFIG.leverageAware).toBe(true);
  });
});

describe('calculateWeightedAvgPrice', () => {
  it('should return 0 for empty array', () => {
    expect(calculateWeightedAvgPrice([])).toBe(0);
  });

  it('should return price for single execution', () => {
    const executions = [createExecution('100', '1')];
    expect(calculateWeightedAvgPrice(executions)).toBe(100);
  });

  it('should calculate weighted average for multiple executions', () => {
    const executions = [
      createExecution('100', '2'),
      createExecution('200', '3'),
    ];
    const result = calculateWeightedAvgPrice(executions);
    expect(result).toBeCloseTo((100 * 2 + 200 * 3) / 5);
  });

  it('should handle executions with zero quantity', () => {
    const executions = [createExecution('100', '0')];
    expect(calculateWeightedAvgPrice(executions)).toBe(0);
  });
});

describe('calculateTotalExposure', () => {
  it('should return 0 for empty array', () => {
    expect(calculateTotalExposure([])).toBe(0);
  });

  it('should calculate exposure for single execution', () => {
    const executions = [createExecution('100', '2')];
    expect(calculateTotalExposure(executions)).toBe(200);
  });

  it('should sum exposure for multiple executions', () => {
    const executions = [
      createExecution('100', '2'),
      createExecution('50', '4'),
    ];
    expect(calculateTotalExposure(executions)).toBe(400);
  });
});

describe('calculateBaseSize', () => {
  it('should return 0 for empty array', () => {
    expect(calculateBaseSize([])).toBe(0);
  });

  it('should return quantity of the earliest execution', () => {
    const executions = [
      createExecution('100', '3', new Date('2024-01-02')),
      createExecution('110', '2', new Date('2024-01-01')),
      createExecution('120', '1', new Date('2024-01-03')),
    ];
    expect(calculateBaseSize(executions)).toBe(2);
  });

  it('should return quantity for single execution', () => {
    const executions = [createExecution('100', '5')];
    expect(calculateBaseSize(executions)).toBe(5);
  });
});

describe('roundQuantity', () => {
  it('should round to 5 decimal places for qty < 1', () => {
    expect(roundQuantity(0.123456789)).toBe(0.12345);
  });

  it('should round to 3 decimal places for qty >= 1 and < 10', () => {
    expect(roundQuantity(5.6789)).toBe(5.678);
  });

  it('should round to 2 decimal places for qty >= 10', () => {
    expect(roundQuantity(15.789)).toBe(15.78);
  });

  it('should floor (not round up)', () => {
    expect(roundQuantity(0.99999)).toBe(0.99999);
    expect(roundQuantity(9.9999)).toBe(9.999);
    expect(roundQuantity(99.999)).toBe(99.99);
  });

  it('should handle zero', () => {
    expect(roundQuantity(0)).toBe(0);
  });

  it('should handle boundary values', () => {
    expect(roundQuantity(1.0)).toBe(1.0);
    expect(roundQuantity(10.0)).toBe(10.0);
  });
});

describe('calculatePyramidProfitPercent', () => {
  it('should calculate positive profit for LONG when price is above entry', () => {
    expect(calculatePyramidProfitPercent(100, 110, 'LONG')).toBeCloseTo(0.1);
  });

  it('should calculate negative profit for LONG when price is below entry', () => {
    expect(calculatePyramidProfitPercent(100, 90, 'LONG')).toBeCloseTo(-0.1);
  });

  it('should calculate positive profit for SHORT when price is below entry', () => {
    expect(calculatePyramidProfitPercent(100, 90, 'SHORT')).toBeCloseTo(0.1);
  });

  it('should calculate negative profit for SHORT when price is above entry', () => {
    expect(calculatePyramidProfitPercent(100, 110, 'SHORT')).toBeCloseTo(-0.1);
  });

  it('should return 0 when current price equals entry', () => {
    expect(calculatePyramidProfitPercent(100, 100, 'LONG')).toBe(0);
    expect(calculatePyramidProfitPercent(100, 100, 'SHORT')).toBe(0);
  });
});

describe('calculatePyramidSize', () => {
  it('should scale size with scaleFactor and entryCount', () => {
    expect(calculatePyramidSize(1.0, 0, 0.8)).toBeCloseTo(1.0);
    expect(calculatePyramidSize(1.0, 1, 0.8)).toBeCloseTo(0.8);
    expect(calculatePyramidSize(1.0, 2, 0.8)).toBeCloseTo(0.64);
  });

  it('should apply ML confidence boost when confidence > 0.7', () => {
    const sizeWithoutML = calculatePyramidSize(1.0, 1, 0.8);
    const sizeWithML = calculatePyramidSize(1.0, 1, 0.8, 0.8);
    expect(sizeWithML).toBeCloseTo(sizeWithoutML * 1.2);
  });

  it('should not apply ML boost when confidence <= 0.7', () => {
    const sizeWithoutML = calculatePyramidSize(1.0, 1, 0.8);
    const sizeWithLowML = calculatePyramidSize(1.0, 1, 0.8, 0.5);
    expect(sizeWithLowML).toBeCloseTo(sizeWithoutML);
  });

  it('should not apply ML boost when confidence is undefined', () => {
    const base = calculatePyramidSize(1.0, 1, 0.8);
    const noML = calculatePyramidSize(1.0, 1, 0.8, undefined);
    expect(noML).toBeCloseTo(base);
  });

  it('should use custom mlConfidenceBoost', () => {
    const result = calculatePyramidSize(1.0, 0, 1.0, 0.9, 1.5);
    expect(result).toBeCloseTo(1.5);
  });

  it('should handle zero baseSize', () => {
    expect(calculatePyramidSize(0, 1, 0.8)).toBe(0);
  });

  it('should handle scaleFactor of 1 (no scaling)', () => {
    expect(calculatePyramidSize(2.0, 3, 1.0)).toBe(2.0);
  });
});

describe('logPyramidDecision', () => {
  it('should not throw for any action type', () => {
    expect(() => logPyramidDecision('EVALUATE', 'BTCUSDT', 'LONG', {})).not.toThrow();
    expect(() => logPyramidDecision('APPROVED', 'BTCUSDT', 'LONG', { profit: '5%' })).not.toThrow();
    expect(() => logPyramidDecision('REJECTED', 'BTCUSDT', 'SHORT', { reason: 'test' })).not.toThrow();
  });

  it('should filter out null and undefined values', () => {
    expect(() => logPyramidDecision('EVALUATE', 'BTCUSDT', 'LONG', {
      validField: 'yes',
      nullField: null,
      undefinedField: undefined,
      numberField: 42,
    })).not.toThrow();
  });
});

describe('getExposureSummary', () => {
  it('should return zeros for empty executions', () => {
    const result = getExposureSummary([], 100, 1000);
    expect(result.totalQuantity).toBe(0);
    expect(result.avgEntryPrice).toBe(0);
    expect(result.totalExposure).toBe(0);
    expect(result.exposurePercent).toBe(0);
    expect(result.unrealizedPnL).toBe(0);
    expect(result.unrealizedPnLPercent).toBe(0);
  });

  it('should calculate LONG exposure summary correctly', () => {
    const executions = [
      { entryPrice: '100', quantity: '2', side: 'LONG', openedAt: new Date() },
    ] as never;
    const result = getExposureSummary(executions, 110, 1000);
    expect(result.totalQuantity).toBe(2);
    expect(result.avgEntryPrice).toBe(100);
    expect(result.totalExposure).toBe(200);
    expect(result.exposurePercent).toBe(20);
    expect(result.unrealizedPnL).toBe(20);
    expect(result.unrealizedPnLPercent).toBe(10);
  });

  it('should calculate SHORT exposure summary correctly', () => {
    const executions = [
      { entryPrice: '100', quantity: '2', side: 'SHORT', openedAt: new Date() },
    ] as never;
    const result = getExposureSummary(executions, 90, 1000);
    expect(result.totalQuantity).toBe(2);
    expect(result.avgEntryPrice).toBe(100);
    expect(result.unrealizedPnL).toBe(20);
  });

  it('should calculate negative PnL for LONG losing position', () => {
    const executions = [
      { entryPrice: '100', quantity: '2', side: 'LONG', openedAt: new Date() },
    ] as never;
    const result = getExposureSummary(executions, 90, 1000);
    expect(result.unrealizedPnL).toBe(-20);
  });
});

describe('calculateInitialPositionSize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockService = {
      validateQuantityAgainstMinQty: vi.fn().mockResolvedValue({ isValid: true }),
    };
    vi.mocked(getMinNotionalFilterService).mockReturnValue(mockService as never);
  });

  it('should calculate position size from wallet balance and max percent', async () => {
    const result = await calculateInitialPositionSize('BTCUSDT', 10000, 50000, 5, 10000, 0);
    expect(result.quantity).toBeGreaterThan(0);
    expect(result.sizePercent).toBeCloseTo(5, 0);
  });

  it('should return zero when remaining balance is zero or negative', async () => {
    const result = await calculateInitialPositionSize('BTCUSDT', 10000, 50000, 5, 0, 10000);
    expect(result.quantity).toBe(0);
    expect(result.sizePercent).toBe(0);
  });

  it('should cap position value to remaining balance', async () => {
    const result = await calculateInitialPositionSize('BTCUSDT', 10000, 100, 50, 100, 9900);
    expect(result.quantity * 100).toBeLessThanOrEqual(100);
  });

  it('should return zero when min notional validation fails', async () => {
    const mockService = {
      validateQuantityAgainstMinQty: vi.fn().mockResolvedValue({
        isValid: false,
        reason: 'Below minimum notional',
        minQty: 0.001,
        minValue: 10,
      }),
    };
    vi.mocked(getMinNotionalFilterService).mockReturnValue(mockService as never);

    const result = await calculateInitialPositionSize('BTCUSDT', 10000, 50000, 5, 10000, 0);
    expect(result.quantity).toBe(0);
  });

  it('should handle adjusted quantity when actual value exceeds remaining', async () => {
    const result = await calculateInitialPositionSize('BTCUSDT', 10000, 10, 10, 50, 9950);
    expect(result.quantity * 10).toBeLessThanOrEqual(50);
  });

  it('should include watcher count in reason when provided', async () => {
    const result = await calculateInitialPositionSize('BTCUSDT', 10000, 50000, 5, 10000, 0, 3);
    expect(result.reason).toContain('3 watchers');
  });

  it('should mention config limit when no watcher count', async () => {
    const result = await calculateInitialPositionSize('BTCUSDT', 10000, 50000, 5, 10000, 0);
    expect(result.reason).toContain('config limit');
  });

  it('should return zero when position value is zero', async () => {
    const result = await calculateInitialPositionSize('BTCUSDT', 0, 50000, 5, 0, 0);
    expect(result.quantity).toBe(0);
  });
});
