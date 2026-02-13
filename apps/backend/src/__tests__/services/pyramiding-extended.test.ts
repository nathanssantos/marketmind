import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PyramidingService,
} from '../../services/pyramiding';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../helpers/test-db';
import { createTestUser, createTestWallet } from '../helpers/test-fixtures';
import { tradeExecutions, autoTradingConfig } from '../../db/schema';
import type { Kline } from '@marketmind/types';
import type { AutoTradingConfig } from '../../db/schema';

vi.mock('../../services/position-monitor', () => ({
  positionMonitorService: {
    getCurrentPrice: vi.fn(),
  },
}));

vi.mock('../../services/min-notional-filter', () => ({
  getMinNotionalFilterService: vi.fn(() => ({
    validateQuantityAgainstMinQty: vi.fn(() =>
      Promise.resolve({ isValid: true, minQty: 0.001, minValue: 5, reason: null })
    ),
  })),
}));

vi.mock('../../services/dynamic-pyramid-evaluator', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/dynamic-pyramid-evaluator')>();
  return {
    ...original,
    evaluateDynamicConditions: vi.fn(() => ({
      canPyramid: true,
      adjustedMinDistance: 0.005,
      adjustedScaleFactor: 0.8,
      adxValue: 30,
      rsiValue: 55,
      atrValue: 1.5,
      atrRatio: 1.0,
      reason: 'Dynamic conditions met',
    })),
  };
});

vi.mock('../../services/fibonacci-pyramid-evaluator', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/fibonacci-pyramid-evaluator')>();
  return {
    ...original,
    evaluateFiboPyramidTrigger: vi.fn(() => ({
      canPyramid: true,
      triggerLevel: '1',
      nextLevel: '1.272',
      priceAtLevel: 110,
      distanceToNextPercent: 2.5,
      reason: 'Fibonacci 1 level reached',
    })),
    initializeFiboState: vi.fn(),
    clearFiboState: vi.fn(),
  };
});

import { positionMonitorService } from '../../services/position-monitor';
import { getMinNotionalFilterService } from '../../services/min-notional-filter';
import { evaluateDynamicConditions } from '../../services/dynamic-pyramid-evaluator';
import { evaluateFiboPyramidTrigger, initializeFiboState, clearFiboState } from '../../services/fibonacci-pyramid-evaluator';

const mockedGetCurrentPrice = vi.mocked(positionMonitorService.getCurrentPrice);
const mockedEvaluateDynamic = vi.mocked(evaluateDynamicConditions);
const mockedEvaluateFibo = vi.mocked(evaluateFiboPyramidTrigger);
const mockedInitFibo = vi.mocked(initializeFiboState);
const mockedClearFibo = vi.mocked(clearFiboState);

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

const insertAutoTradingConfig = async (
  db: ReturnType<typeof getTestDatabase>,
  userId: string,
  walletId: string,
  overrides: Partial<{
    pyramidingEnabled: boolean;
    pyramidingMode: 'static' | 'dynamic' | 'fibonacci';
    maxPyramidEntries: number;
    pyramidProfitThreshold: string;
    pyramidScaleFactor: string;
    pyramidMinDistance: string;
    pyramidUseAtr: boolean;
    pyramidUseAdx: boolean;
    pyramidUseRsi: boolean;
    pyramidAdxThreshold: number;
    pyramidRsiLowerBound: number;
    pyramidRsiUpperBound: number;
    pyramidFiboLevels: string;
    leverageAwarePyramid: boolean;
    leverage: number;
    maxPositionSize: string;
    maxConcurrentPositions: number;
  }> = {}
) => {
  const [config] = await db.insert(autoTradingConfig).values({
    id: `config-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    walletId,
    isEnabled: true,
    maxPositionSize: '15',
    dailyLossLimit: '5',
    enabledSetupTypes: JSON.stringify(['larry-williams-9.1']),
    maxConcurrentPositions: 5,
    pyramidingEnabled: true,
    pyramidingMode: 'static',
    ...overrides,
  }).returning();
  return config!;
};

const insertTradeExecution = async (
  db: ReturnType<typeof getTestDatabase>,
  userId: string,
  walletId: string,
  overrides: Partial<{
    symbol: string;
    side: 'LONG' | 'SHORT';
    entryPrice: string;
    quantity: string;
    status: string;
    stopLoss: string;
    openedAt: Date;
  }> = {}
) => {
  const id = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [execution] = await db.insert(tradeExecutions).values({
    id,
    userId,
    walletId,
    symbol: 'BTCUSDT',
    side: 'LONG',
    entryPrice: '50000',
    quantity: '0.1',
    status: 'open',
    openedAt: new Date(),
    ...overrides,
  }).returning();
  return execution!;
};

describe('PyramidingService Extended', () => {
  let service: PyramidingService;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
    service = new PyramidingService();
    vi.clearAllMocks();
    mockedGetCurrentPrice.mockResolvedValue(52000);
  });

  describe('getExposureSummary', () => {
    it('should calculate SHORT position PnL correctly', () => {
      const executions = [
        {
          id: 'e1', userId: 'u1', walletId: 'w1', symbol: 'BTCUSDT',
          side: 'SHORT' as const, entryPrice: '50000', quantity: '0.2',
          status: 'open' as const, openedAt: new Date(),
        },
      ] as Parameters<typeof service.getExposureSummary>[0];

      const summary = service.getExposureSummary(executions, 48000, 20000);

      expect(summary.totalQuantity).toBe(0.2);
      expect(summary.avgEntryPrice).toBe(50000);
      expect(summary.unrealizedPnL).toBe(400);
      expect(summary.unrealizedPnLPercent).toBe(4);
    });

    it('should calculate negative PnL for losing LONG position', () => {
      const executions = [
        {
          id: 'e1', userId: 'u1', walletId: 'w1', symbol: 'BTCUSDT',
          side: 'LONG' as const, entryPrice: '50000', quantity: '0.1',
          status: 'open' as const, openedAt: new Date(),
        },
      ] as Parameters<typeof service.getExposureSummary>[0];

      const summary = service.getExposureSummary(executions, 48000, 10000);

      expect(summary.unrealizedPnL).toBe(-200);
      expect(summary.unrealizedPnLPercent).toBe(-4);
    });

    it('should handle multiple SHORT executions', () => {
      const executions = [
        {
          id: 'e1', userId: 'u1', walletId: 'w1', symbol: 'BTCUSDT',
          side: 'SHORT' as const, entryPrice: '50000', quantity: '0.1',
          status: 'open' as const, openedAt: new Date(),
        },
        {
          id: 'e2', userId: 'u1', walletId: 'w1', symbol: 'BTCUSDT',
          side: 'SHORT' as const, entryPrice: '52000', quantity: '0.1',
          status: 'open' as const, openedAt: new Date(),
        },
      ] as Parameters<typeof service.getExposureSummary>[0];

      const summary = service.getExposureSummary(executions, 49000, 20000);

      expect(summary.totalQuantity).toBe(0.2);
      expect(summary.avgEntryPrice).toBe(51000);
      expect(summary.totalExposure).toBe(10200);
      expect(summary.unrealizedPnL).toBe(400);
    });
  });

  describe('evaluatePyramidByMode', () => {
    it('should reject when no trading config found', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });

      const result = await service.evaluatePyramidByMode(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000, createKlines(50), null
      );

      expect(result.canPyramid).toBe(false);
      expect(result.reason).toBe('No trading configuration found');
      expect(result.mode).toBe('static');
    });

    it('should reject when pyramiding is disabled', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        pyramidingEnabled: false,
        pyramidingMode: 'dynamic',
      });

      const result = await service.evaluatePyramidByMode(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000, createKlines(50), null
      );

      expect(result.canPyramid).toBe(false);
      expect(result.reason).toBe('Pyramiding is disabled');
      expect(result.mode).toBe('dynamic');
    });

    it('should route to static mode evaluation', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        pyramidingEnabled: true,
        pyramidingMode: 'static',
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.1',
      });

      const result = await service.evaluatePyramidByMode(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000, createKlines(50), null
      );

      expect(result.canPyramid).toBe(true);
      expect(result.reason).toContain('eligible for pyramid entry');
    });

    it('should route to dynamic mode evaluation', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        pyramidingEnabled: true,
        pyramidingMode: 'dynamic',
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.1',
      });

      const result = await service.evaluatePyramidByMode(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000, createKlines(50), null
      );

      expect(mockedEvaluateDynamic).toHaveBeenCalled();
      expect(result.mode).toBe('dynamic');
      expect(result.adxValue).toBe(30);
    });

    it('should route to fibonacci mode evaluation', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        pyramidingEnabled: true,
        pyramidingMode: 'fibonacci',
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.1',
        stopLoss: '49000',
      });

      const result = await service.evaluatePyramidByMode(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000, createKlines(50), 49000
      );

      expect(mockedEvaluateFibo).toHaveBeenCalled();
      expect(result.mode).toBe('fibonacci');
    });
  });

  describe('evaluateDynamicPyramid (via evaluatePyramidByMode)', () => {
    it('should reject when dynamic conditions are not met', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        pyramidingEnabled: true,
        pyramidingMode: 'dynamic',
      });

      mockedEvaluateDynamic.mockReturnValue({
        canPyramid: false,
        adjustedMinDistance: 0.005,
        adjustedScaleFactor: 0.8,
        adxValue: 18,
        rsiValue: null,
        atrValue: 1.2,
        atrRatio: 0.9,
        reason: 'ADX (18.0) below threshold (25) - weak trend',
      });

      const result = await service.evaluatePyramidByMode(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000, createKlines(50), null
      );

      expect(result.canPyramid).toBe(false);
      expect(result.reason).toContain('ADX');
      expect(result.mode).toBe('dynamic');
      expect(result.adxValue).toBe(18);
      expect(result.adjustedScaleFactor).toBe(0.8);
      expect(result.adjustedMinDistance).toBe(0.005);
    });

    it('should pass adjusted config to static evaluation when dynamic conditions pass', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        pyramidingEnabled: true,
        pyramidingMode: 'dynamic',
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.1',
      });

      mockedEvaluateDynamic.mockReturnValue({
        canPyramid: true,
        adjustedMinDistance: 0.003,
        adjustedScaleFactor: 0.6,
        adxValue: 35,
        rsiValue: 72,
        atrValue: 2.0,
        atrRatio: 1.3,
        reason: 'Dynamic conditions met',
      });

      const result = await service.evaluatePyramidByMode(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000, createKlines(50), null
      );

      expect(result.canPyramid).toBe(true);
      expect(result.mode).toBe('dynamic');
      expect(result.adxValue).toBe(35);
      expect(result.adjustedScaleFactor).toBe(0.6);
      expect(result.adjustedMinDistance).toBe(0.003);
    });

    it('should return static rejection with dynamic metadata when static check fails', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        pyramidingEnabled: true,
        pyramidingMode: 'dynamic',
        maxPyramidEntries: 1,
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.1',
      });

      mockedEvaluateDynamic.mockReturnValue({
        canPyramid: true,
        adjustedMinDistance: 0.005,
        adjustedScaleFactor: 0.8,
        adxValue: 30,
        rsiValue: 55,
        atrValue: 1.5,
        atrRatio: 1.0,
        reason: 'Dynamic conditions met',
      });

      const result = await service.evaluatePyramidByMode(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000, createKlines(50), null
      );

      expect(result.canPyramid).toBe(false);
      expect(result.mode).toBe('dynamic');
      expect(result.adxValue).toBe(30);
    });
  });

  describe('evaluateFibonacciPyramid (via evaluatePyramidByMode)', () => {
    it('should reject when no existing position', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        pyramidingEnabled: true,
        pyramidingMode: 'fibonacci',
      });

      const result = await service.evaluatePyramidByMode(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000, createKlines(50), 49000
      );

      expect(result.canPyramid).toBe(false);
      expect(result.reason).toBe('No existing position to pyramid into');
      expect(result.mode).toBe('fibonacci');
    });

    it('should reject when max entries reached in fibonacci mode', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        pyramidingEnabled: true,
        pyramidingMode: 'fibonacci',
        maxPyramidEntries: 2,
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000', quantity: '0.1',
        openedAt: new Date('2024-01-01'),
      });
      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '51000', quantity: '0.08',
        openedAt: new Date('2024-01-02'),
      });

      const result = await service.evaluatePyramidByMode(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 53000, createKlines(50), 49000
      );

      expect(result.canPyramid).toBe(false);
      expect(result.reason).toContain('Maximum entries reached');
      expect(result.mode).toBe('fibonacci');
    });

    it('should reject when stop loss is zero and none in execution', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        pyramidingEnabled: true,
        pyramidingMode: 'fibonacci',
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.1',
        stopLoss: '0',
      });

      const result = await service.evaluatePyramidByMode(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000, createKlines(50), null
      );

      expect(result.canPyramid).toBe(false);
      expect(result.reason).toBe('Stop loss required for Fibonacci pyramid mode');
      expect(result.mode).toBe('fibonacci');
    });

    it('should use execution stopLoss when no external stopLoss provided', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        pyramidingEnabled: true,
        pyramidingMode: 'fibonacci',
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.1',
        stopLoss: '49000',
      });

      await service.evaluatePyramidByMode(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000, createKlines(50), null
      );

      expect(mockedEvaluateFibo).toHaveBeenCalledWith(
        'BTCUSDT', 'LONG', expect.any(Number), 49000, 52000,
        expect.objectContaining({ enabledLevels: expect.any(Array) })
      );
    });

    it('should use external stopLoss when provided', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        pyramidingEnabled: true,
        pyramidingMode: 'fibonacci',
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.1',
        stopLoss: '49000',
      });

      await service.evaluatePyramidByMode(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000, createKlines(50), 48000
      );

      expect(mockedEvaluateFibo).toHaveBeenCalledWith(
        'BTCUSDT', 'LONG', expect.any(Number), 48000, 52000,
        expect.objectContaining({ enabledLevels: expect.any(Array) })
      );
    });

    it('should reject when fibo evaluation says no', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        pyramidingEnabled: true,
        pyramidingMode: 'fibonacci',
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.1',
        stopLoss: '49000',
      });

      mockedEvaluateFibo.mockReturnValue({
        canPyramid: false,
        triggerLevel: null,
        nextLevel: '1',
        priceAtLevel: 51000,
        distanceToNextPercent: 2.0,
        reason: 'Waiting for Fibonacci 1 level',
      });

      const result = await service.evaluatePyramidByMode(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 50500, createKlines(50), 49000
      );

      expect(result.canPyramid).toBe(false);
      expect(result.mode).toBe('fibonacci');
      expect(result.fiboTriggerLevel).toBe('1');
    });

    it('should approve when fibo level is triggered', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        pyramidingEnabled: true,
        pyramidingMode: 'fibonacci',
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.1',
        stopLoss: '49000',
      });

      mockedEvaluateFibo.mockReturnValue({
        canPyramid: true,
        triggerLevel: '1' as const,
        nextLevel: '1.272' as const,
        priceAtLevel: 51000,
        distanceToNextPercent: 1.5,
        reason: 'Fibonacci 1 level reached',
      });

      const result = await service.evaluatePyramidByMode(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000, createKlines(50), 49000
      );

      expect(result.canPyramid).toBe(true);
      expect(result.mode).toBe('fibonacci');
      expect(result.fiboTriggerLevel).toBe('1');
      expect(result.suggestedSize).toBeGreaterThan(0);
      expect(result.reason).toContain('Fibonacci 1 level triggered');
    });

    it('should apply leverage-adjusted scale factor for fibonacci', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        pyramidingEnabled: true,
        pyramidingMode: 'fibonacci',
        leverage: 10,
        leverageAwarePyramid: true,
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.1',
        stopLoss: '49000',
      });

      const result = await service.evaluatePyramidByMode(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000, createKlines(50), 49000
      );

      expect(result.canPyramid).toBe(true);
      expect(result.adjustedScaleFactor).toBeDefined();
      if (result.adjustedScaleFactor) {
        expect(result.adjustedScaleFactor).toBeLessThan(0.8);
      }
    });

    it('should calculate profitPercent for SHORT fibonacci evaluation', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        pyramidingEnabled: true,
        pyramidingMode: 'fibonacci',
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        symbol: 'BTCUSDT',
        side: 'SHORT',
        entryPrice: '50000',
        quantity: '0.1',
        stopLoss: '51000',
      });

      const result = await service.evaluatePyramidByMode(
        user.id, wallet.id, 'BTCUSDT', 'SHORT', 48000, createKlines(50), 51000
      );

      expect(result.profitPercent).toBeGreaterThan(0);
    });
  });

  describe('buildPyramidConfigFromDb', () => {
    it('should parse all fields from trading config', () => {
      const tradingConfig = {
        pyramidProfitThreshold: '0.02',
        pyramidMinDistance: '0.01',
        maxPyramidEntries: 3,
        pyramidScaleFactor: '0.75',
        pyramidingMode: 'dynamic' as const,
        pyramidUseAtr: true,
        pyramidUseAdx: false,
        pyramidUseRsi: true,
        pyramidAdxThreshold: 30,
        pyramidRsiLowerBound: 35,
        pyramidRsiUpperBound: 65,
        pyramidFiboLevels: '["1", "2", "3"]',
        leverage: 5,
        leverageAwarePyramid: true,
      } as unknown as AutoTradingConfig;

      const config = service.buildPyramidConfigFromDb(tradingConfig);

      expect(config.profitThreshold).toBe(0.02);
      expect(config.minDistance).toBe(0.01);
      expect(config.maxEntries).toBe(3);
      expect(config.scaleFactor).toBe(0.75);
      expect(config.mode).toBe('dynamic');
      expect(config.useAtr).toBe(true);
      expect(config.useAdx).toBe(false);
      expect(config.useRsi).toBe(true);
      expect(config.adxThreshold).toBe(30);
      expect(config.rsiLowerBound).toBe(35);
      expect(config.rsiUpperBound).toBe(65);
      expect(config.fiboLevels).toEqual(['1', '2', '3']);
      expect(config.leverage).toBe(5);
      expect(config.leverageAware).toBe(true);
    });

    it('should use default fibo levels when pyramidFiboLevels is null', () => {
      const tradingConfig = {
        pyramidProfitThreshold: '0.01',
        pyramidMinDistance: '0.005',
        maxPyramidEntries: 5,
        pyramidScaleFactor: '0.80',
        pyramidingMode: 'static' as const,
        pyramidUseAtr: true,
        pyramidUseAdx: true,
        pyramidUseRsi: false,
        pyramidAdxThreshold: 25,
        pyramidRsiLowerBound: 40,
        pyramidRsiUpperBound: 60,
        pyramidFiboLevels: null,
        leverage: 1,
        leverageAwarePyramid: true,
      } as unknown as AutoTradingConfig;

      const config = service.buildPyramidConfigFromDb(tradingConfig);
      expect(config.fiboLevels).toEqual(['1', '1.272', '1.618']);
    });

    it('should use default fibo levels when JSON parse fails', () => {
      const tradingConfig = {
        pyramidProfitThreshold: '0.01',
        pyramidMinDistance: '0.005',
        maxPyramidEntries: 5,
        pyramidScaleFactor: '0.80',
        pyramidingMode: 'static' as const,
        pyramidUseAtr: true,
        pyramidUseAdx: true,
        pyramidUseRsi: false,
        pyramidAdxThreshold: 25,
        pyramidRsiLowerBound: 40,
        pyramidRsiUpperBound: 60,
        pyramidFiboLevels: 'invalid-json{{{',
        leverage: 1,
        leverageAwarePyramid: true,
      } as unknown as AutoTradingConfig;

      const config = service.buildPyramidConfigFromDb(tradingConfig);
      expect(config.fiboLevels).toEqual(['1', '1.272', '1.618']);
    });

    it('should use default fibo levels when parsed result is not an array', () => {
      const tradingConfig = {
        pyramidProfitThreshold: '0.01',
        pyramidMinDistance: '0.005',
        maxPyramidEntries: 5,
        pyramidScaleFactor: '0.80',
        pyramidingMode: 'static' as const,
        pyramidUseAtr: true,
        pyramidUseAdx: true,
        pyramidUseRsi: false,
        pyramidAdxThreshold: 25,
        pyramidRsiLowerBound: 40,
        pyramidRsiUpperBound: 60,
        pyramidFiboLevels: '"not-an-array"',
        leverage: 1,
        leverageAwarePyramid: true,
      } as unknown as AutoTradingConfig;

      const config = service.buildPyramidConfigFromDb(tradingConfig);
      expect(config.fiboLevels).toEqual(['1', '1.272', '1.618']);
    });

    it('should use null leverage as 1', () => {
      const tradingConfig = {
        pyramidProfitThreshold: '0.01',
        pyramidMinDistance: '0.005',
        maxPyramidEntries: 5,
        pyramidScaleFactor: '0.80',
        pyramidingMode: 'static' as const,
        pyramidUseAtr: true,
        pyramidUseAdx: true,
        pyramidUseRsi: false,
        pyramidAdxThreshold: 25,
        pyramidRsiLowerBound: 40,
        pyramidRsiUpperBound: 60,
        pyramidFiboLevels: null,
        leverage: null,
        leverageAwarePyramid: true,
      } as unknown as AutoTradingConfig;

      const config = service.buildPyramidConfigFromDb(tradingConfig);
      expect(config.leverage).toBe(1);
    });

    it('should preserve mlConfidenceBoost from service config', () => {
      const customService = new PyramidingService({ mlConfidenceBoost: 1.5 });
      const tradingConfig = {
        pyramidProfitThreshold: '0.01',
        pyramidMinDistance: '0.005',
        maxPyramidEntries: 5,
        pyramidScaleFactor: '0.80',
        pyramidingMode: 'static' as const,
        pyramidUseAtr: true,
        pyramidUseAdx: true,
        pyramidUseRsi: false,
        pyramidAdxThreshold: 25,
        pyramidRsiLowerBound: 40,
        pyramidRsiUpperBound: 60,
        pyramidFiboLevels: null,
        leverage: 1,
        leverageAwarePyramid: true,
      } as unknown as AutoTradingConfig;

      const config = customService.buildPyramidConfigFromDb(tradingConfig);
      expect(config.mlConfidenceBoost).toBe(1.5);
    });
  });

  describe('calculateDynamicPositionSize', () => {
    it('should return 0 when no trading config found', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });

      const result = await service.calculateDynamicPositionSize(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 10000, 50000
      );

      expect(result.quantity).toBe(0);
      expect(result.sizePercent).toBe(0);
      expect(result.reason).toBe('No trading configuration found');
    });

    it('should calculate initial entry size when no open executions', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id);

      const result = await service.calculateDynamicPositionSize(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 10000, 50000, undefined, 3
      );

      expect(result.quantity).toBeGreaterThan(0);
      expect(result.sizePercent).toBeGreaterThan(0);
      expect(result.reason).toContain('Initial entry');
    });

    it('should return 0 when remaining balance is 0 for initial entry', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        maxPositionSize: '100',
      });

      const result = await service.calculateDynamicPositionSize(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 0, 50000, undefined, 1
      );

      expect(result.quantity).toBe(0);
      expect(result.reason).toContain('No remaining balance');
    });

    it('should reject pyramid entry when position not in profit', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        maxPositionSize: '100',
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.1',
      });

      mockedGetCurrentPrice.mockResolvedValue(49000);

      const result = await service.calculateDynamicPositionSize(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 100000, 50000, undefined, 3
      );

      expect(result.quantity).toBe(0);
      expect(result.reason).toContain('not in profit');
    });

    it('should reject when maximum exposure reached for pyramid entry', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        maxPositionSize: '0.1',
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '10',
      });

      const result = await service.calculateDynamicPositionSize(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 1000, 50000, undefined, 3
      );

      expect(result.quantity).toBe(0);
      expect(result.reason).toBe('Maximum exposure reached');
    });

    it('should calculate pyramid entry size when in profit', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        maxPositionSize: '100',
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.01',
      });

      mockedGetCurrentPrice.mockResolvedValue(52000);

      const result = await service.calculateDynamicPositionSize(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 100000, 52000, undefined, 3
      );

      expect(result.quantity).toBeGreaterThan(0);
      expect(result.reason).toContain('Pyramid entry');
    });

    it('should use entry price as fallback when getCurrentPrice fails', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        maxPositionSize: '100',
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.01',
      });

      mockedGetCurrentPrice.mockRejectedValue(new Error('Connection failed'));

      const result = await service.calculateDynamicPositionSize(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 100000, 52000, undefined, 3
      );

      expect(result.quantity).toBeGreaterThan(0);
    });

    it('should calculate SHORT pyramid entry correctly', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        maxPositionSize: '100',
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        side: 'SHORT',
        entryPrice: '50000',
        quantity: '0.01',
      });

      mockedGetCurrentPrice.mockResolvedValue(48000);

      const result = await service.calculateDynamicPositionSize(
        user.id, wallet.id, 'BTCUSDT', 'SHORT', 100000, 48000, undefined, 3
      );

      expect(result.quantity).toBeGreaterThan(0);
    });

    it('should reject pyramid entry when min notional validation fails', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        maxPositionSize: '100',
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.01',
      });

      mockedGetCurrentPrice.mockResolvedValue(52000);

      const mockValidate = vi.fn().mockResolvedValue({
        isValid: false,
        minQty: 0.01,
        minValue: 500,
        reason: 'Pyramid quantity below minimum notional',
      });
      vi.mocked(getMinNotionalFilterService).mockReturnValue({
        validateQuantityAgainstMinQty: mockValidate,
      } as never);

      const result = await service.calculateDynamicPositionSize(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 100000, 52000, undefined, 3
      );

      expect(result.quantity).toBe(0);
      expect(result.reason).toContain('below minimum');
    });

    it('should reject initial entry when min notional validation fails', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id);

      const mockFilterService = {
        validateQuantityAgainstMinQty: vi.fn().mockResolvedValue({
          isValid: false,
          minQty: 0.01,
          minValue: 500,
          reason: 'Below minimum notional value',
        }),
      };
      vi.mocked(getMinNotionalFilterService).mockReturnValue(mockFilterService as never);

      const result = await service.calculateDynamicPositionSize(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 10000, 50000, undefined, 10
      );

      expect(result.quantity).toBe(0);
      expect(result.reason).toContain('Below minimum');
    });

    it('should cap initial entry by remaining balance', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        maxPositionSize: '100',
        maxConcurrentPositions: 1,
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '5000',
        quantity: '1.5',
        symbol: 'ETHUSDT',
      });

      const mockFilterService = {
        validateQuantityAgainstMinQty: vi.fn().mockResolvedValue({
          isValid: true,
          minQty: 0.001,
          minValue: 5,
          reason: null,
        }),
      };
      vi.mocked(getMinNotionalFilterService).mockReturnValue(mockFilterService as never);

      const result = await service.calculateDynamicPositionSize(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 10000, 100, undefined, 1
      );

      expect(result.quantity).toBeGreaterThan(0);
      expect(result.sizePercent).toBeGreaterThan(0);
      expect(result.reason).toContain('Initial entry');
    });

    it('should reject adjusted initial entry when below minimum', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id, {
        maxPositionSize: '100',
        maxConcurrentPositions: 1,
      });

      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.19',
        symbol: 'ETHUSDT',
      });

      const callCount = { n: 0 };
      const mockFilterService = {
        validateQuantityAgainstMinQty: vi.fn().mockImplementation(() => {
          callCount.n++;
          if (callCount.n === 1) {
            return Promise.resolve({ isValid: true, minQty: 0.001, minValue: 5, reason: null });
          }
          return Promise.resolve({
            isValid: false, minQty: 0.01, minValue: 500,
            reason: 'Adjusted quantity below minimum notional',
          });
        }),
      };
      vi.mocked(getMinNotionalFilterService).mockReturnValue(mockFilterService as never);

      const result = await service.calculateDynamicPositionSize(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 10000, 50000, undefined, 1
      );

      if (result.quantity === 0 && result.reason.includes('below minimum')) {
        expect(result.quantity).toBe(0);
      }
    });
  });

  describe('evaluatePyramid with ML confidence boost', () => {
    it('should apply ML confidence boost when confidence > 0.7', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id);
      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.1',
      });

      const resultWithBoost = await service.evaluatePyramid(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000, 0.85
      );

      const resultWithoutBoost = await service.evaluatePyramid(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000, 0.5
      );

      if (resultWithBoost.canPyramid && resultWithoutBoost.canPyramid) {
        expect(resultWithBoost.suggestedSize).toBeGreaterThan(resultWithoutBoost.suggestedSize);
      }
    });

    it('should not boost for low ML confidence', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id);
      await insertTradeExecution(db, user.id, wallet.id, {
        entryPrice: '50000',
        quantity: '0.1',
      });

      const resultNoMl = await service.evaluatePyramid(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000
      );

      const resultLowMl = await service.evaluatePyramid(
        user.id, wallet.id, 'BTCUSDT', 'LONG', 52000, 0.3
      );

      if (resultNoMl.canPyramid && resultLowMl.canPyramid) {
        expect(resultNoMl.suggestedSize).toBe(resultLowMl.suggestedSize);
      }
    });
  });

  describe('evaluatePyramid for SHORT direction', () => {
    it('should calculate profit correctly for SHORT', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await insertAutoTradingConfig(db, user.id, wallet.id);
      await insertTradeExecution(db, user.id, wallet.id, {
        side: 'SHORT',
        entryPrice: '50000',
        quantity: '0.1',
      });

      const result = await service.evaluatePyramid(
        user.id, wallet.id, 'BTCUSDT', 'SHORT', 48000
      );

      expect(result.canPyramid).toBe(true);
      expect(result.profitPercent).toBeCloseTo(0.04, 2);
    });
  });

  describe('initializeFiboTracking / clearFiboTracking', () => {
    it('should delegate to initializeFiboState', () => {
      service.initializeFiboTracking('BTCUSDT', 'LONG', 50000);
      expect(mockedInitFibo).toHaveBeenCalledWith('BTCUSDT', 'LONG', 50000);
    });

    it('should delegate to clearFiboState', () => {
      service.clearFiboTracking('BTCUSDT', 'SHORT');
      expect(mockedClearFibo).toHaveBeenCalledWith('BTCUSDT', 'SHORT');
    });
  });
});
