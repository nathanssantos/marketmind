import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  PyramidingService,
  calculateWeightedAvgPrice,
  calculateTotalExposure,
  calculateBaseSize,
  roundQuantity,
  calculatePyramidProfitPercent,
  calculatePyramidSize,
  calculateBreakevenStopLoss,
  shouldUpdatePyramidStopLoss,
  getConsolidatedStopLoss,
  DEFAULT_PYRAMIDING_CONFIG,
  type ExecutionLike,
} from '../../services/pyramiding';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../helpers/test-db';
import { createTestUser, createTestWallet } from '../helpers/test-fixtures';
import { tradeExecutions, autoTradingConfig } from '../../db/schema';

describe('Pyramiding - Pure Utility Functions', () => {
  describe('calculateWeightedAvgPrice', () => {
    it('should calculate weighted average for single execution', () => {
      const executions: ExecutionLike[] = [
        { entryPrice: '100', quantity: '10', openedAt: new Date() },
      ];

      expect(calculateWeightedAvgPrice(executions)).toBe(100);
    });

    it('should calculate weighted average for multiple executions', () => {
      const executions: ExecutionLike[] = [
        { entryPrice: '100', quantity: '10', openedAt: new Date() },
        { entryPrice: '110', quantity: '10', openedAt: new Date() },
      ];

      expect(calculateWeightedAvgPrice(executions)).toBe(105);
    });

    it('should weight by quantity correctly', () => {
      const executions: ExecutionLike[] = [
        { entryPrice: '100', quantity: '30', openedAt: new Date() },
        { entryPrice: '120', quantity: '10', openedAt: new Date() },
      ];

      expect(calculateWeightedAvgPrice(executions)).toBe(105);
    });

    it('should return 0 for empty array', () => {
      expect(calculateWeightedAvgPrice([])).toBe(0);
    });
  });

  describe('calculateTotalExposure', () => {
    it('should calculate total exposure correctly', () => {
      const executions: ExecutionLike[] = [
        { entryPrice: '100', quantity: '10', openedAt: new Date() },
        { entryPrice: '50', quantity: '20', openedAt: new Date() },
      ];

      expect(calculateTotalExposure(executions)).toBe(2000);
    });

    it('should return 0 for empty array', () => {
      expect(calculateTotalExposure([])).toBe(0);
    });
  });

  describe('calculateBaseSize', () => {
    it('should return quantity of first (oldest) execution', () => {
      const now = Date.now();
      const executions: ExecutionLike[] = [
        { entryPrice: '100', quantity: '10', openedAt: new Date(now + 1000) },
        { entryPrice: '100', quantity: '5', openedAt: new Date(now) },
      ];

      expect(calculateBaseSize(executions)).toBe(5);
    });

    it('should return 0 for empty array', () => {
      expect(calculateBaseSize([])).toBe(0);
    });
  });

  describe('roundQuantity', () => {
    it('should round quantities less than 1 to 5 decimal places', () => {
      expect(roundQuantity(0.123456789)).toBe(0.12345);
    });

    it('should round quantities between 1 and 10 to 3 decimal places', () => {
      expect(roundQuantity(5.123456789)).toBe(5.123);
    });

    it('should round quantities >= 10 to 2 decimal places', () => {
      expect(roundQuantity(15.6789)).toBe(15.67);
    });

    it('should floor, not round', () => {
      expect(roundQuantity(0.99999)).toBe(0.99999);
      expect(roundQuantity(9.9999)).toBe(9.999);
    });
  });

  describe('calculatePyramidProfitPercent', () => {
    it('should calculate profit for LONG position', () => {
      const profit = calculatePyramidProfitPercent(100, 110, 'LONG');
      expect(profit).toBe(0.1);
    });

    it('should calculate loss for LONG position', () => {
      const profit = calculatePyramidProfitPercent(100, 90, 'LONG');
      expect(profit).toBe(-0.1);
    });

    it('should calculate profit for SHORT position', () => {
      const profit = calculatePyramidProfitPercent(100, 90, 'SHORT');
      expect(profit).toBe(0.1);
    });

    it('should calculate loss for SHORT position', () => {
      const profit = calculatePyramidProfitPercent(100, 110, 'SHORT');
      expect(profit).toBe(-0.1);
    });
  });

  describe('calculatePyramidSize', () => {
    it('should calculate scaled size based on entry count', () => {
      const size = calculatePyramidSize(100, 1, 0.8);
      expect(size).toBe(80);
    });

    it('should compound scale factor for multiple entries', () => {
      const size = calculatePyramidSize(100, 2, 0.8);
      expect(size).toBeCloseTo(64, 5);
    });

    it('should boost size for high ML confidence', () => {
      const size = calculatePyramidSize(100, 0, 0.8, 0.8, 1.2);
      expect(size).toBe(120);
    });

    it('should not boost for low ML confidence', () => {
      const size = calculatePyramidSize(100, 0, 0.8, 0.5, 1.2);
      expect(size).toBe(100);
    });
  });

  describe('calculateBreakevenStopLoss', () => {
    it('should calculate breakeven stop for LONG position', () => {
      const stop = calculateBreakevenStopLoss(100, 'LONG', 0.002);
      expect(stop).toBe(100.2);
    });

    it('should calculate breakeven stop for SHORT position', () => {
      const stop = calculateBreakevenStopLoss(100, 'SHORT', 0.002);
      expect(stop).toBe(99.8);
    });

    it('should use default buffer of 0.002', () => {
      const stop = calculateBreakevenStopLoss(100, 'LONG');
      expect(stop).toBe(100.2);
    });
  });

  describe('shouldUpdatePyramidStopLoss', () => {
    it('should return true when new stop is better for LONG', () => {
      expect(shouldUpdatePyramidStopLoss(102, 100, 'LONG')).toBe(true);
    });

    it('should return false when new stop is worse for LONG', () => {
      expect(shouldUpdatePyramidStopLoss(98, 100, 'LONG')).toBe(false);
    });

    it('should return true when new stop is better for SHORT', () => {
      expect(shouldUpdatePyramidStopLoss(98, 100, 'SHORT')).toBe(true);
    });

    it('should return false when new stop is worse for SHORT', () => {
      expect(shouldUpdatePyramidStopLoss(102, 100, 'SHORT')).toBe(false);
    });
  });

  describe('getConsolidatedStopLoss', () => {
    it('should return highest stop for LONG positions', () => {
      const executions: ExecutionLike[] = [
        { entryPrice: '100', quantity: '10', stopLoss: '95', openedAt: new Date() },
        { entryPrice: '105', quantity: '10', stopLoss: '98', openedAt: new Date() },
      ];

      expect(getConsolidatedStopLoss(executions, 'LONG')).toBe(98);
    });

    it('should return lowest stop for SHORT positions', () => {
      const executions: ExecutionLike[] = [
        { entryPrice: '100', quantity: '10', stopLoss: '105', openedAt: new Date() },
        { entryPrice: '95', quantity: '10', stopLoss: '102', openedAt: new Date() },
      ];

      expect(getConsolidatedStopLoss(executions, 'SHORT')).toBe(102);
    });

    it('should return null when no stops are set', () => {
      const executions: ExecutionLike[] = [
        { entryPrice: '100', quantity: '10', openedAt: new Date() },
      ];

      expect(getConsolidatedStopLoss(executions, 'LONG')).toBeNull();
    });

    it('should ignore executions without stop loss', () => {
      const executions: ExecutionLike[] = [
        { entryPrice: '100', quantity: '10', openedAt: new Date() },
        { entryPrice: '105', quantity: '10', stopLoss: '98', openedAt: new Date() },
      ];

      expect(getConsolidatedStopLoss(executions, 'LONG')).toBe(98);
    });
  });
});

describe('PyramidingService', () => {
  let pyramidingService: PyramidingService;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
    pyramidingService = new PyramidingService();
  });

  describe('configuration', () => {
    it('should use default config', () => {
      const config = pyramidingService.getConfig();

      expect(config.profitThreshold).toBe(DEFAULT_PYRAMIDING_CONFIG.profitThreshold);
      expect(config.minDistance).toBe(DEFAULT_PYRAMIDING_CONFIG.minDistance);
      expect(config.maxEntries).toBe(DEFAULT_PYRAMIDING_CONFIG.maxEntries);
      expect(config.scaleFactor).toBe(DEFAULT_PYRAMIDING_CONFIG.scaleFactor);
    });

    it('should accept custom config in constructor', () => {
      const customService = new PyramidingService({
        maxEntries: 3,
        scaleFactor: 0.5,
      });

      const config = customService.getConfig();
      expect(config.maxEntries).toBe(3);
      expect(config.scaleFactor).toBe(0.5);
      expect(config.profitThreshold).toBe(DEFAULT_PYRAMIDING_CONFIG.profitThreshold);
    });

    it('should update config', () => {
      pyramidingService.updateConfig({ maxEntries: 10 });

      const config = pyramidingService.getConfig();
      expect(config.maxEntries).toBe(10);
    });
  });

  describe('evaluatePyramid', () => {
    it('should reject when no existing position', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });

      const result = await pyramidingService.evaluatePyramid(
        user.id,
        wallet.id,
        'BTCUSDT',
        'LONG',
        50000
      );

      expect(result.canPyramid).toBe(false);
      expect(result.reason).toContain('No existing position');
      expect(result.currentEntries).toBe(0);
    });

    it('should reject when max entries reached', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await db.insert(autoTradingConfig).values({
        id: 'config-1',
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        maxPositionSize: '15',
        dailyLossLimit: '5',
        enabledSetupTypes: JSON.stringify(['larry-williams-9.1']),
        maxConcurrentPositions: 5,
      });

      for (let i = 0; i < 5; i++) {
        await db.insert(tradeExecutions).values({
          id: `exec-${i}`,
          userId: user.id,
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: '50000',
          quantity: '0.1',
          status: 'open',
          openedAt: new Date(),
        });
      }

      const result = await pyramidingService.evaluatePyramid(
        user.id,
        wallet.id,
        'BTCUSDT',
        'LONG',
        55000
      );

      expect(result.canPyramid).toBe(false);
      expect(result.reason).toContain('Maximum entries reached');
      expect(result.currentEntries).toBe(5);
    });

    it('should reject when position not in sufficient profit', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await db.insert(autoTradingConfig).values({
        id: 'config-1',
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        maxPositionSize: '15',
        dailyLossLimit: '5',
        enabledSetupTypes: JSON.stringify(['larry-williams-9.1']),
        maxConcurrentPositions: 5,
      });

      await db.insert(tradeExecutions).values({
        id: 'exec-1',
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        openedAt: new Date(),
      });

      const result = await pyramidingService.evaluatePyramid(
        user.id,
        wallet.id,
        'BTCUSDT',
        'LONG',
        50100
      );

      expect(result.canPyramid).toBe(false);
      expect(result.reason).toContain('not in sufficient profit');
    });

    it('should reject when too close to last entry', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await db.insert(autoTradingConfig).values({
        id: 'config-1',
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        maxPositionSize: '15',
        dailyLossLimit: '5',
        enabledSetupTypes: JSON.stringify(['larry-williams-9.1']),
        maxConcurrentPositions: 5,
      });

      await db.insert(tradeExecutions).values({
        id: 'exec-1',
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        openedAt: new Date(),
      });

      const result = await pyramidingService.evaluatePyramid(
        user.id,
        wallet.id,
        'BTCUSDT',
        'LONG',
        50600,
        undefined,
        { profitThreshold: 0.01, minDistance: 0.02 }
      );

      expect(result.canPyramid).toBe(false);
      expect(result.reason).toContain('Too close to last entry');
    });

    it('should reject when no trading config found', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await db.insert(tradeExecutions).values({
        id: 'exec-1',
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        openedAt: new Date(),
      });

      const result = await pyramidingService.evaluatePyramid(
        user.id,
        wallet.id,
        'BTCUSDT',
        'LONG',
        51000
      );

      expect(result.canPyramid).toBe(false);
      expect(result.reason).toContain('No trading configuration found');
    });

    it('should approve pyramid when conditions are met', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();

      await db.insert(autoTradingConfig).values({
        id: 'config-1',
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        maxPositionSize: '15',
        dailyLossLimit: '5',
        enabledSetupTypes: JSON.stringify(['larry-williams-9.1']),
        maxConcurrentPositions: 5,
      });

      await db.insert(tradeExecutions).values({
        id: 'exec-1',
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        openedAt: new Date(),
      });

      const result = await pyramidingService.evaluatePyramid(
        user.id,
        wallet.id,
        'BTCUSDT',
        'LONG',
        52000
      );

      expect(result.canPyramid).toBe(true);
      expect(result.reason).toContain('eligible for pyramid entry');
      expect(result.suggestedSize).toBeGreaterThan(0);
      expect(result.profitPercent).toBeCloseTo(0.04, 2);
    });
  });

  describe('adjustStopLossForPyramid', () => {
    it('should return null for single execution', async () => {
      const db = getTestDatabase();
      const executions = [
        {
          id: 'exec-1',
          userId: 'user-1',
          walletId: 'wallet-1',
          symbol: 'BTCUSDT',
          side: 'LONG' as const,
          entryPrice: '50000',
          quantity: '0.1',
          status: 'open' as const,
          stopLoss: '49000',
          openedAt: new Date(),
        },
      ];

      const result = await pyramidingService.adjustStopLossForPyramid(
        executions as Parameters<typeof pyramidingService.adjustStopLossForPyramid>[0],
        'LONG'
      );

      expect(result).toBeNull();
    });

    it('should calculate breakeven stop for LONG with multiple entries', async () => {
      const executions = [
        {
          id: 'exec-1',
          userId: 'user-1',
          walletId: 'wallet-1',
          symbol: 'BTCUSDT',
          side: 'LONG' as const,
          entryPrice: '50000',
          quantity: '0.1',
          status: 'open' as const,
          stopLoss: '49000',
          openedAt: new Date(),
        },
        {
          id: 'exec-2',
          userId: 'user-1',
          walletId: 'wallet-1',
          symbol: 'BTCUSDT',
          side: 'LONG' as const,
          entryPrice: '52000',
          quantity: '0.08',
          status: 'open' as const,
          stopLoss: '50000',
          openedAt: new Date(),
        },
      ];

      const result = await pyramidingService.adjustStopLossForPyramid(
        executions as Parameters<typeof pyramidingService.adjustStopLossForPyramid>[0],
        'LONG'
      );

      expect(result).toBeGreaterThan(50000);
    });
  });

  describe('getExposureSummary', () => {
    it('should return zeros for empty executions', () => {
      const summary = pyramidingService.getExposureSummary([], 50000, 10000);

      expect(summary.totalQuantity).toBe(0);
      expect(summary.avgEntryPrice).toBe(0);
      expect(summary.totalExposure).toBe(0);
      expect(summary.exposurePercent).toBe(0);
      expect(summary.unrealizedPnL).toBe(0);
    });

    it('should calculate exposure summary correctly for LONG', () => {
      const executions = [
        {
          id: 'exec-1',
          userId: 'user-1',
          walletId: 'wallet-1',
          symbol: 'BTCUSDT',
          side: 'LONG' as const,
          entryPrice: '50000',
          quantity: '0.1',
          status: 'open' as const,
          openedAt: new Date(),
        },
        {
          id: 'exec-2',
          userId: 'user-1',
          walletId: 'wallet-1',
          symbol: 'BTCUSDT',
          side: 'LONG' as const,
          entryPrice: '52000',
          quantity: '0.1',
          status: 'open' as const,
          openedAt: new Date(),
        },
      ];

      const summary = pyramidingService.getExposureSummary(
        executions as Parameters<typeof pyramidingService.getExposureSummary>[0],
        53000,
        10000
      );

      expect(summary.totalQuantity).toBe(0.2);
      expect(summary.avgEntryPrice).toBe(51000);
      expect(summary.totalExposure).toBe(10200);
      expect(summary.exposurePercent).toBe(102);
      expect(summary.unrealizedPnL).toBe(400);
      expect(summary.unrealizedPnLPercent).toBeCloseTo(3.92, 1);
    });
  });
});
