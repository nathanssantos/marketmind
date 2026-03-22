import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kline } from '@marketmind/types';

vi.mock('../../db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock('../../db/schema', () => ({
  tradeExecutions: {
    userId: 'userId',
    walletId: 'walletId',
    symbol: 'symbol',
    side: 'side',
    status: 'status',
  },
}));

vi.mock('../../services/dynamic-pyramid-evaluator', () => ({
  evaluateDynamicConditions: vi.fn(),
  calculateLeverageAdjustedScaleFactor: vi.fn(() => 0.8),
}));

vi.mock('../../services/fibonacci-pyramid-evaluator', () => ({
  evaluateFiboPyramidTrigger: vi.fn(),
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

vi.mock('../../services/pyramid-calculations', () => ({
  calculateBaseSize: vi.fn(() => 1.0),
  calculateWeightedAvgPrice: vi.fn(() => 100),
  logPyramidDecision: vi.fn(),
  roundQuantity: vi.fn((q: number) => Math.floor(q * 100000) / 100000),
}));

import {
  evaluateDynamicPyramid,
  evaluateFibonacciPyramid,
} from '../../services/pyramid-mode-evaluators';
import { evaluateDynamicConditions, calculateLeverageAdjustedScaleFactor } from '../../services/dynamic-pyramid-evaluator';
import { evaluateFiboPyramidTrigger } from '../../services/fibonacci-pyramid-evaluator';
import { db } from '../../db';
import type { PyramidConfig, PyramidEvaluation } from '../../services/pyramid-calculations';

const mockedEvaluateDynamicConditions = vi.mocked(evaluateDynamicConditions);
const mockedEvaluateFiboPyramidTrigger = vi.mocked(evaluateFiboPyramidTrigger);
const mockedCalculateLeverageAdjustedScaleFactor = vi.mocked(calculateLeverageAdjustedScaleFactor);

const createKline = (close: number, index: number): Kline => ({
  openTime: Date.now() + index * 60000,
  open: String(close),
  high: String(close + 1),
  low: String(close - 1),
  close: String(close),
  volume: '1000',
  closeTime: Date.now() + (index + 1) * 60000 - 1,
  quoteVolume: '10000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '5000',
});

const createKlines = (count: number): Kline[] =>
  Array.from({ length: count }, (_, i) => createKline(100 + i, i));

const defaultConfig: PyramidConfig = {
  profitThreshold: 0.01,
  minDistance: 0.005,
  maxEntries: 5,
  scaleFactor: 0.8,
  mlConfidenceBoost: 1.2,
  mode: 'dynamic',
  useAtr: true,
  useAdx: true,
  useRsi: false,
  adxThreshold: 25,
  rsiLowerBound: 40,
  rsiUpperBound: 60,
  fiboLevels: ['1', '1.272', '1.618'],
  leverage: 1,
  leverageAware: true,
};

describe('evaluateDynamicPyramid', () => {
  let mockEvaluateStatic: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluateStatic = vi.fn();
  });

  it('should reject when dynamic conditions fail', async () => {
    mockedEvaluateDynamicConditions.mockReturnValue({
      canPyramid: false,
      reason: 'ADX below threshold',
      adjustedMinDistance: 0.005,
      adjustedScaleFactor: 0.8,
      adxValue: 15,
      rsiValue: 50,
      atrValue: 0.02,
      atrRatio: 1,
    });

    const result = await evaluateDynamicPyramid(
      mockEvaluateStatic, 'u1', 'w1', 'BTCUSDT', 'LONG', 100,
      createKlines(50), defaultConfig
    );

    expect(result.canPyramid).toBe(false);
    expect(result.mode).toBe('dynamic');
    expect(result.adxValue).toBe(15);
    expect(mockEvaluateStatic).not.toHaveBeenCalled();
  });

  it('should delegate to evaluateStatic with adjusted config when dynamic passes', async () => {
    mockedEvaluateDynamicConditions.mockReturnValue({
      canPyramid: true,
      reason: 'OK',
      adjustedMinDistance: 0.003,
      adjustedScaleFactor: 0.75,
      adxValue: 35,
      rsiValue: 55,
      atrValue: 0.03,
      atrRatio: 1.2,
    });

    const staticResult: PyramidEvaluation = {
      canPyramid: true,
      reason: 'Pyramid allowed',
      suggestedSize: 0.5,
      currentEntries: 1,
      maxEntries: 5,
      profitPercent: 0.02,
      exposurePercent: 10,
    };
    mockEvaluateStatic.mockResolvedValue(staticResult);

    const result = await evaluateDynamicPyramid(
      mockEvaluateStatic, 'u1', 'w1', 'BTCUSDT', 'LONG', 110,
      createKlines(50), defaultConfig
    );

    expect(result.canPyramid).toBe(true);
    expect(result.mode).toBe('dynamic');
    expect(result.adxValue).toBe(35);
    expect(result.adjustedScaleFactor).toBe(0.75);
    expect(result.adjustedMinDistance).toBe(0.003);
    expect(mockEvaluateStatic).toHaveBeenCalledWith(
      'u1', 'w1', 'BTCUSDT', 'LONG', 110, undefined,
      expect.objectContaining({ minDistance: 0.003, scaleFactor: 0.75 })
    );
  });

  it('should propagate static rejection with dynamic metadata', async () => {
    mockedEvaluateDynamicConditions.mockReturnValue({
      canPyramid: true,
      reason: 'OK',
      adjustedMinDistance: 0.003,
      adjustedScaleFactor: 0.75,
      adxValue: 35,
      rsiValue: 55,
      atrValue: 0.03,
      atrRatio: 1.2,
    });

    const staticResult: PyramidEvaluation = {
      canPyramid: false,
      reason: 'Max entries reached',
      suggestedSize: 0,
      currentEntries: 5,
      maxEntries: 5,
      profitPercent: 0.05,
      exposurePercent: 50,
    };
    mockEvaluateStatic.mockResolvedValue(staticResult);

    const result = await evaluateDynamicPyramid(
      mockEvaluateStatic, 'u1', 'w1', 'BTCUSDT', 'LONG', 110,
      createKlines(50), defaultConfig
    );

    expect(result.canPyramid).toBe(false);
    expect(result.mode).toBe('dynamic');
    expect(result.adxValue).toBe(35);
  });

  it('should pass mlConfidence to evaluateStatic', async () => {
    mockedEvaluateDynamicConditions.mockReturnValue({
      canPyramid: true,
      reason: 'OK',
      adjustedMinDistance: 0.005,
      adjustedScaleFactor: 0.8,
      adxValue: 30,
      rsiValue: 50,
      atrValue: 0.02,
      atrRatio: 1,
    });
    mockEvaluateStatic.mockResolvedValue({
      canPyramid: true, reason: 'OK', suggestedSize: 0.5,
      currentEntries: 1, maxEntries: 5, profitPercent: 0.02, exposurePercent: 10,
    });

    await evaluateDynamicPyramid(
      mockEvaluateStatic, 'u1', 'w1', 'BTCUSDT', 'LONG', 110,
      createKlines(50), defaultConfig, 0.85
    );

    expect(mockEvaluateStatic).toHaveBeenCalledWith(
      'u1', 'w1', 'BTCUSDT', 'LONG', 110, 0.85,
      expect.any(Object)
    );
  });
});

describe('evaluateFibonacciPyramid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject when no existing position', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as never);

    const result = await evaluateFibonacciPyramid(
      'u1', 'w1', 'BTCUSDT', 'LONG', 110, null, defaultConfig
    );

    expect(result.canPyramid).toBe(false);
    expect(result.reason).toContain('No existing position');
    expect(result.mode).toBe('fibonacci');
  });

  it('should reject when maximum entries reached', async () => {
    const executions = Array.from({ length: 5 }, () => ({
      entryPrice: '100',
      quantity: '1',
      side: 'LONG',
      openedAt: new Date(),
      stopLoss: '90',
    }));

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(executions),
      }),
    } as never);

    const result = await evaluateFibonacciPyramid(
      'u1', 'w1', 'BTCUSDT', 'LONG', 110, null, defaultConfig
    );

    expect(result.canPyramid).toBe(false);
    expect(result.reason).toContain('Maximum entries');
    expect(result.currentEntries).toBe(5);
  });

  it('should reject when stop loss is zero and not provided', async () => {
    const executions = [
      { entryPrice: '100', quantity: '1', side: 'LONG', openedAt: new Date(), stopLoss: null },
    ];

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(executions),
      }),
    } as never);

    const result = await evaluateFibonacciPyramid(
      'u1', 'w1', 'BTCUSDT', 'LONG', 110, null, defaultConfig
    );

    expect(result.canPyramid).toBe(false);
    expect(result.reason).toContain('Stop loss required');
  });

  it('should use provided stop loss over execution stop loss', async () => {
    const executions = [
      { entryPrice: '100', quantity: '1', side: 'LONG', openedAt: new Date(), stopLoss: '85' },
    ];

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(executions),
      }),
    } as never);

    mockedEvaluateFiboPyramidTrigger.mockReturnValue({
      canPyramid: true,
      triggerLevel: '1.272',
      nextLevel: '1.618',
      priceAtLevel: 112,
      distanceToNextPercent: 3,
      reason: 'Level triggered',
    });

    mockedCalculateLeverageAdjustedScaleFactor.mockReturnValue(0.8);

    await evaluateFibonacciPyramid(
      'u1', 'w1', 'BTCUSDT', 'LONG', 110, 90, defaultConfig
    );

    expect(mockedEvaluateFiboPyramidTrigger).toHaveBeenCalledWith(
      'BTCUSDT', 'LONG', 100, 90, 110, expect.any(Object)
    );
  });

  it('should reject when fibonacci trigger evaluation fails', async () => {
    const executions = [
      { entryPrice: '100', quantity: '1', side: 'LONG', openedAt: new Date(), stopLoss: '90' },
    ];

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(executions),
      }),
    } as never);

    mockedEvaluateFiboPyramidTrigger.mockReturnValue({
      canPyramid: false,
      triggerLevel: null,
      nextLevel: '1.272',
      priceAtLevel: null,
      distanceToNextPercent: 5,
      reason: 'Price has not reached next Fibonacci level',
    });

    const result = await evaluateFibonacciPyramid(
      'u1', 'w1', 'BTCUSDT', 'LONG', 105, null, defaultConfig
    );

    expect(result.canPyramid).toBe(false);
    expect(result.fiboTriggerLevel).toBe('1.272');
    expect(result.mode).toBe('fibonacci');
  });

  it('should approve and calculate scaled size when fibonacci trigger passes', async () => {
    const executions = [
      { entryPrice: '100', quantity: '1', side: 'LONG', openedAt: new Date(), stopLoss: '90' },
    ];

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(executions),
      }),
    } as never);

    mockedEvaluateFiboPyramidTrigger.mockReturnValue({
      canPyramid: true,
      triggerLevel: '1.272',
      nextLevel: '1.618',
      priceAtLevel: 112,
      distanceToNextPercent: 3,
      reason: 'Level triggered',
    });

    mockedCalculateLeverageAdjustedScaleFactor.mockReturnValue(0.8);

    const result = await evaluateFibonacciPyramid(
      'u1', 'w1', 'BTCUSDT', 'LONG', 112, null, defaultConfig
    );

    expect(result.canPyramid).toBe(true);
    expect(result.mode).toBe('fibonacci');
    expect(result.fiboTriggerLevel).toBe('1.272');
    expect(result.suggestedSize).toBeGreaterThan(0);
    expect(result.currentEntries).toBe(1);
    expect(result.adjustedScaleFactor).toBe(0.8);
  });

  it('should calculate LONG profit percent correctly', async () => {
    const executions = [
      { entryPrice: '100', quantity: '1', side: 'LONG', openedAt: new Date(), stopLoss: '90' },
    ];

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(executions),
      }),
    } as never);

    mockedEvaluateFiboPyramidTrigger.mockReturnValue({
      canPyramid: true,
      triggerLevel: '1.272',
      nextLevel: '1.618',
      priceAtLevel: 110,
      distanceToNextPercent: 3,
      reason: 'Level triggered',
    });

    const result = await evaluateFibonacciPyramid(
      'u1', 'w1', 'BTCUSDT', 'LONG', 110, null, defaultConfig
    );

    expect(result.profitPercent).toBeCloseTo(0.1);
  });

  it('should calculate SHORT profit percent correctly', async () => {
    const executions = [
      { entryPrice: '100', quantity: '1', side: 'SHORT', openedAt: new Date(), stopLoss: '110' },
    ];

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(executions),
      }),
    } as never);

    mockedEvaluateFiboPyramidTrigger.mockReturnValue({
      canPyramid: true,
      triggerLevel: '1.272',
      nextLevel: '1.618',
      priceAtLevel: 90,
      distanceToNextPercent: 3,
      reason: 'Level triggered',
    });

    const result = await evaluateFibonacciPyramid(
      'u1', 'w1', 'BTCUSDT', 'SHORT', 90, null, defaultConfig
    );

    expect(result.profitPercent).toBeCloseTo(0.1);
  });

  it('should fall back to execution stop loss when provided stop loss is null', async () => {
    const executions = [
      { entryPrice: '100', quantity: '1', side: 'LONG', openedAt: new Date(), stopLoss: '92' },
    ];

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(executions),
      }),
    } as never);

    mockedEvaluateFiboPyramidTrigger.mockReturnValue({
      canPyramid: false,
      triggerLevel: null,
      nextLevel: '1',
      priceAtLevel: null,
      distanceToNextPercent: 5,
      reason: 'Not triggered',
    });

    await evaluateFibonacciPyramid(
      'u1', 'w1', 'BTCUSDT', 'LONG', 105, null, defaultConfig
    );

    expect(mockedEvaluateFiboPyramidTrigger).toHaveBeenCalledWith(
      'BTCUSDT', 'LONG', 100, 92, 105, expect.any(Object)
    );
  });
});
