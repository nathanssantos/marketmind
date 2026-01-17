import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../helpers/test-db';
import { createTestWallet, createAuthenticatedUser } from '../helpers/test-fixtures';
import { autoTradingConfig, tradeExecutions } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateEntityId } from '../../utils/id';

vi.mock('../../services/price-cache', () => ({
  priceCache: {
    get: vi.fn().mockResolvedValue(50000),
  },
}));

vi.mock('../../services/websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    emitPositionUpdate: vi.fn(),
    emitNotification: vi.fn(),
  })),
}));

import { OpportunityCostManagerService } from '../../services/opportunity-cost-manager';
import type { OpportunityCostConfig, StaleTradeCheck } from '../../services/opportunity-cost-manager';
import { priceCache } from '../../services/price-cache';

describe('OpportunityCostManagerService', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
    vi.clearAllMocks();
  });

  describe('calculatePriceMovementPercent', () => {
    it('should calculate price movement for LONG with upward movement', () => {
      const service = new OpportunityCostManagerService();
      const calculatePriceMovementPercent = (service as unknown as {
        calculatePriceMovementPercent: (entryPrice: number, highestPrice: number, lowestPrice: number, side: 'LONG' | 'SHORT') => number;
      }).calculatePriceMovementPercent.bind(service);

      const result = calculatePriceMovementPercent(100, 110, 95, 'LONG');
      expect(result).toBe(10);
    });

    it('should calculate price movement for LONG with downward movement being greater', () => {
      const service = new OpportunityCostManagerService();
      const calculatePriceMovementPercent = (service as unknown as {
        calculatePriceMovementPercent: (entryPrice: number, highestPrice: number, lowestPrice: number, side: 'LONG' | 'SHORT') => number;
      }).calculatePriceMovementPercent.bind(service);

      const result = calculatePriceMovementPercent(100, 102, 85, 'LONG');
      expect(result).toBe(15);
    });

    it('should calculate price movement for SHORT with downward movement', () => {
      const service = new OpportunityCostManagerService();
      const calculatePriceMovementPercent = (service as unknown as {
        calculatePriceMovementPercent: (entryPrice: number, highestPrice: number, lowestPrice: number, side: 'LONG' | 'SHORT') => number;
      }).calculatePriceMovementPercent.bind(service);

      const result = calculatePriceMovementPercent(100, 105, 90, 'SHORT');
      expect(result).toBe(10);
    });

    it('should calculate price movement for SHORT with upward movement being greater', () => {
      const service = new OpportunityCostManagerService();
      const calculatePriceMovementPercent = (service as unknown as {
        calculatePriceMovementPercent: (entryPrice: number, highestPrice: number, lowestPrice: number, side: 'LONG' | 'SHORT') => number;
      }).calculatePriceMovementPercent.bind(service);

      const result = calculatePriceMovementPercent(100, 115, 98, 'SHORT');
      expect(result).toBe(15);
    });

    it('should return 0 when entry price is 0', () => {
      const service = new OpportunityCostManagerService();
      const calculatePriceMovementPercent = (service as unknown as {
        calculatePriceMovementPercent: (entryPrice: number, highestPrice: number, lowestPrice: number, side: 'LONG' | 'SHORT') => number;
      }).calculatePriceMovementPercent.bind(service);

      const result = calculatePriceMovementPercent(0, 110, 90, 'LONG');
      expect(result).toBe(0);
    });
  });

  describe('calculateProfitPercent', () => {
    it('should calculate positive profit for LONG when price is up', () => {
      const service = new OpportunityCostManagerService();
      const calculateProfitPercent = (service as unknown as {
        calculateProfitPercent: (entryPrice: number, currentPrice: number, side: 'LONG' | 'SHORT') => number;
      }).calculateProfitPercent.bind(service);

      const result = calculateProfitPercent(100, 110, 'LONG');
      expect(result).toBe(10);
    });

    it('should calculate negative profit for LONG when price is down', () => {
      const service = new OpportunityCostManagerService();
      const calculateProfitPercent = (service as unknown as {
        calculateProfitPercent: (entryPrice: number, currentPrice: number, side: 'LONG' | 'SHORT') => number;
      }).calculateProfitPercent.bind(service);

      const result = calculateProfitPercent(100, 90, 'LONG');
      expect(result).toBe(-10);
    });

    it('should calculate positive profit for SHORT when price is down', () => {
      const service = new OpportunityCostManagerService();
      const calculateProfitPercent = (service as unknown as {
        calculateProfitPercent: (entryPrice: number, currentPrice: number, side: 'LONG' | 'SHORT') => number;
      }).calculateProfitPercent.bind(service);

      const result = calculateProfitPercent(100, 90, 'SHORT');
      expect(result).toBe(10);
    });

    it('should calculate negative profit for SHORT when price is up', () => {
      const service = new OpportunityCostManagerService();
      const calculateProfitPercent = (service as unknown as {
        calculateProfitPercent: (entryPrice: number, currentPrice: number, side: 'LONG' | 'SHORT') => number;
      }).calculateProfitPercent.bind(service);

      const result = calculateProfitPercent(100, 110, 'SHORT');
      expect(result).toBe(-10);
    });

    it('should return 0 when entry price is 0', () => {
      const service = new OpportunityCostManagerService();
      const calculateProfitPercent = (service as unknown as {
        calculateProfitPercent: (entryPrice: number, currentPrice: number, side: 'LONG' | 'SHORT') => number;
      }).calculateProfitPercent.bind(service);

      const result = calculateProfitPercent(0, 110, 'LONG');
      expect(result).toBe(0);
    });
  });

  describe('calculateTightenedStop', () => {
    it('should calculate tightened stop for LONG position', () => {
      const service = new OpportunityCostManagerService();
      const calculateTightenedStop = (service as unknown as {
        calculateTightenedStop: (
          execution: { entryPrice: string; stopLoss: string; barsInTrade: number; side: 'LONG' | 'SHORT' },
          config: OpportunityCostConfig,
          currentPrice: number,
          profitPercent: number
        ) => number;
      }).calculateTightenedStop.bind(service);

      const execution = {
        entryPrice: '50000',
        stopLoss: '48000',
        barsInTrade: 15,
        side: 'LONG' as const,
      };

      const config: OpportunityCostConfig = {
        opportunityCostEnabled: true,
        maxHoldingPeriodBars: 20,
        stalePriceThresholdPercent: 0.5,
        staleTradeAction: 'TIGHTEN_STOP',
        timeBasedStopTighteningEnabled: true,
        timeTightenAfterBars: 10,
        timeTightenPercentPerBar: 5,
      };

      const result = calculateTightenedStop(execution, config, 52000, 4);
      expect(result).toBeGreaterThan(48000);
      expect(result).toBeLessThanOrEqual(52000);
    });

    it('should calculate tightened stop for SHORT position', () => {
      const service = new OpportunityCostManagerService();
      const calculateTightenedStop = (service as unknown as {
        calculateTightenedStop: (
          execution: { entryPrice: string; stopLoss: string; barsInTrade: number; side: 'LONG' | 'SHORT' },
          config: OpportunityCostConfig,
          currentPrice: number,
          profitPercent: number
        ) => number;
      }).calculateTightenedStop.bind(service);

      const execution = {
        entryPrice: '50000',
        stopLoss: '52000',
        barsInTrade: 15,
        side: 'SHORT' as const,
      };

      const config: OpportunityCostConfig = {
        opportunityCostEnabled: true,
        maxHoldingPeriodBars: 20,
        stalePriceThresholdPercent: 0.5,
        staleTradeAction: 'TIGHTEN_STOP',
        timeBasedStopTighteningEnabled: true,
        timeTightenAfterBars: 10,
        timeTightenPercentPerBar: 5,
      };

      const result = calculateTightenedStop(execution, config, 48000, 4);
      expect(result).toBeLessThan(52000);
      expect(result).toBeGreaterThanOrEqual(48000);
    });

    it('should respect max lock percent (80%)', () => {
      const service = new OpportunityCostManagerService();
      const calculateTightenedStop = (service as unknown as {
        calculateTightenedStop: (
          execution: { entryPrice: string; stopLoss: string; barsInTrade: number; side: 'LONG' | 'SHORT' },
          config: OpportunityCostConfig,
          currentPrice: number,
          profitPercent: number
        ) => number;
      }).calculateTightenedStop.bind(service);

      const execution = {
        entryPrice: '50000',
        stopLoss: '48000',
        barsInTrade: 100,
        side: 'LONG' as const,
      };

      const config: OpportunityCostConfig = {
        opportunityCostEnabled: true,
        maxHoldingPeriodBars: 20,
        stalePriceThresholdPercent: 0.5,
        staleTradeAction: 'TIGHTEN_STOP',
        timeBasedStopTighteningEnabled: true,
        timeTightenAfterBars: 10,
        timeTightenPercentPerBar: 5,
      };

      const result = calculateTightenedStop(execution, config, 55000, 10);
      const maxLockAmount = (55000 - 50000) * 0.8;
      const expectedMaxStop = 50000 + maxLockAmount;
      expect(result).toBeLessThanOrEqual(expectedMaxStop);
    });

    it('should not move stop backwards for LONG', () => {
      const service = new OpportunityCostManagerService();
      const calculateTightenedStop = (service as unknown as {
        calculateTightenedStop: (
          execution: { entryPrice: string; stopLoss: string; barsInTrade: number; side: 'LONG' | 'SHORT' },
          config: OpportunityCostConfig,
          currentPrice: number,
          profitPercent: number
        ) => number;
      }).calculateTightenedStop.bind(service);

      const execution = {
        entryPrice: '50000',
        stopLoss: '51000',
        barsInTrade: 11,
        side: 'LONG' as const,
      };

      const config: OpportunityCostConfig = {
        opportunityCostEnabled: true,
        maxHoldingPeriodBars: 20,
        stalePriceThresholdPercent: 0.5,
        staleTradeAction: 'TIGHTEN_STOP',
        timeBasedStopTighteningEnabled: true,
        timeTightenAfterBars: 10,
        timeTightenPercentPerBar: 5,
      };

      const result = calculateTightenedStop(execution, config, 52000, 4);
      expect(result).toBeGreaterThanOrEqual(51000);
    });
  });

  describe('checkPosition', () => {
    it('should detect stale trade when bars exceed max and movement is low', async () => {
      const service = new OpportunityCostManagerService();

      const execution = {
        id: 'test-exec-1',
        symbol: 'BTCUSDT',
        side: 'LONG' as const,
        entryPrice: '50000',
        stopLoss: '48000',
        barsInTrade: 25,
        highestPriceSinceEntry: '50200',
        lowestPriceSinceEntry: '49800',
      };

      const config: OpportunityCostConfig = {
        opportunityCostEnabled: true,
        maxHoldingPeriodBars: 20,
        stalePriceThresholdPercent: 0.5,
        staleTradeAction: 'ALERT_ONLY',
        timeBasedStopTighteningEnabled: true,
        timeTightenAfterBars: 10,
        timeTightenPercentPerBar: 5,
      };

      const result = await service.checkPosition(execution as never, config, 50100);

      expect(result.isStale).toBe(true);
      expect(result.recommendedAction).toBe('ALERT');
      expect(result.priceMovementPercent).toBeLessThan(0.5);
    });

    it('should not detect stale trade when price movement is significant', async () => {
      const service = new OpportunityCostManagerService();

      const execution = {
        id: 'test-exec-2',
        symbol: 'BTCUSDT',
        side: 'LONG' as const,
        entryPrice: '50000',
        stopLoss: '48000',
        barsInTrade: 25,
        highestPriceSinceEntry: '52000',
        lowestPriceSinceEntry: '49000',
      };

      const config: OpportunityCostConfig = {
        opportunityCostEnabled: true,
        maxHoldingPeriodBars: 20,
        stalePriceThresholdPercent: 0.5,
        staleTradeAction: 'ALERT_ONLY',
        timeBasedStopTighteningEnabled: true,
        timeTightenAfterBars: 10,
        timeTightenPercentPerBar: 5,
      };

      const result = await service.checkPosition(execution as never, config, 51000);

      expect(result.isStale).toBe(false);
      expect(result.priceMovementPercent).toBeGreaterThan(0.5);
    });

    it('should recommend TIGHTEN for stale trade in profit with TIGHTEN_STOP action', async () => {
      const service = new OpportunityCostManagerService();

      const execution = {
        id: 'test-exec-3',
        symbol: 'BTCUSDT',
        side: 'LONG' as const,
        entryPrice: '50000',
        stopLoss: '48000',
        barsInTrade: 25,
        highestPriceSinceEntry: '50200',
        lowestPriceSinceEntry: '49800',
      };

      const config: OpportunityCostConfig = {
        opportunityCostEnabled: true,
        maxHoldingPeriodBars: 20,
        stalePriceThresholdPercent: 0.5,
        staleTradeAction: 'TIGHTEN_STOP',
        timeBasedStopTighteningEnabled: true,
        timeTightenAfterBars: 10,
        timeTightenPercentPerBar: 5,
      };

      const result = await service.checkPosition(execution as never, config, 51000);

      expect(result.isStale).toBe(true);
      expect(result.recommendedAction).toBe('TIGHTEN');
      expect(result.newStopLoss).toBeDefined();
    });

    it('should recommend ALERT for stale trade in loss with TIGHTEN_STOP action', async () => {
      const service = new OpportunityCostManagerService();

      const execution = {
        id: 'test-exec-4',
        symbol: 'BTCUSDT',
        side: 'LONG' as const,
        entryPrice: '50000',
        stopLoss: '48000',
        barsInTrade: 25,
        highestPriceSinceEntry: '50200',
        lowestPriceSinceEntry: '49800',
      };

      const config: OpportunityCostConfig = {
        opportunityCostEnabled: true,
        maxHoldingPeriodBars: 20,
        stalePriceThresholdPercent: 0.5,
        staleTradeAction: 'TIGHTEN_STOP',
        timeBasedStopTighteningEnabled: true,
        timeTightenAfterBars: 10,
        timeTightenPercentPerBar: 5,
      };

      const result = await service.checkPosition(execution as never, config, 49500);

      expect(result.isStale).toBe(true);
      expect(result.recommendedAction).toBe('ALERT');
      expect(result.newStopLoss).toBeUndefined();
    });

    it('should recommend CLOSE for stale trade with AUTO_CLOSE action', async () => {
      const service = new OpportunityCostManagerService();

      const execution = {
        id: 'test-exec-5',
        symbol: 'BTCUSDT',
        side: 'LONG' as const,
        entryPrice: '50000',
        stopLoss: '48000',
        barsInTrade: 25,
        highestPriceSinceEntry: '50200',
        lowestPriceSinceEntry: '49800',
      };

      const config: OpportunityCostConfig = {
        opportunityCostEnabled: true,
        maxHoldingPeriodBars: 20,
        stalePriceThresholdPercent: 0.5,
        staleTradeAction: 'AUTO_CLOSE',
        timeBasedStopTighteningEnabled: true,
        timeTightenAfterBars: 10,
        timeTightenPercentPerBar: 5,
      };

      const result = await service.checkPosition(execution as never, config, 50100);

      expect(result.isStale).toBe(true);
      expect(result.recommendedAction).toBe('CLOSE');
    });

    it('should recommend time-based tightening when not stale but in profit', async () => {
      const service = new OpportunityCostManagerService();

      const execution = {
        id: 'test-exec-6',
        symbol: 'BTCUSDT',
        side: 'LONG' as const,
        entryPrice: '50000',
        stopLoss: '48000',
        barsInTrade: 15,
        highestPriceSinceEntry: '53000',
        lowestPriceSinceEntry: '49500',
      };

      const config: OpportunityCostConfig = {
        opportunityCostEnabled: true,
        maxHoldingPeriodBars: 20,
        stalePriceThresholdPercent: 0.5,
        staleTradeAction: 'ALERT_ONLY',
        timeBasedStopTighteningEnabled: true,
        timeTightenAfterBars: 10,
        timeTightenPercentPerBar: 5,
      };

      const result = await service.checkPosition(execution as never, config, 52000);

      expect(result.isStale).toBe(false);
      expect(result.recommendedAction).toBe('TIGHTEN');
      expect(result.newStopLoss).toBeDefined();
    });
  });

  describe('incrementBarsInTrade', () => {
    it('should increment bar count for open position', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({ userId: user.id });

      const executionId = generateEntityId();
      await db.insert(tradeExecutions).values({
        id: executionId,
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        barsInTrade: 5,
        highestPriceSinceEntry: '50500',
        lowestPriceSinceEntry: '49500',
        openedAt: new Date(),
      });

      const service = new OpportunityCostManagerService();
      const result = await service.incrementBarsInTrade(executionId, 51000);

      expect(result).not.toBeNull();
      expect(result!.newBarsInTrade).toBe(6);
      expect(result!.executionId).toBe(executionId);

      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId));

      expect(execution!.barsInTrade).toBe(6);
    });

    it('should update highest price when current price is higher', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({ userId: user.id });

      const executionId = generateEntityId();
      await db.insert(tradeExecutions).values({
        id: executionId,
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        barsInTrade: 5,
        highestPriceSinceEntry: '50500',
        lowestPriceSinceEntry: '49500',
        openedAt: new Date(),
      });

      const service = new OpportunityCostManagerService();
      await service.incrementBarsInTrade(executionId, 52000);

      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId));

      expect(parseFloat(execution!.highestPriceSinceEntry!)).toBe(52000);
    });

    it('should update lowest price when current price is lower', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({ userId: user.id });

      const executionId = generateEntityId();
      await db.insert(tradeExecutions).values({
        id: executionId,
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        barsInTrade: 5,
        highestPriceSinceEntry: '50500',
        lowestPriceSinceEntry: '49500',
        openedAt: new Date(),
      });

      const service = new OpportunityCostManagerService();
      await service.incrementBarsInTrade(executionId, 48000);

      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId));

      expect(parseFloat(execution!.lowestPriceSinceEntry!)).toBe(48000);
    });

    it('should return null for non-existent execution', async () => {
      const service = new OpportunityCostManagerService();
      const result = await service.incrementBarsInTrade('non-existent-id', 50000);

      expect(result).toBeNull();
    });

    it('should return null for closed execution', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({ userId: user.id });

      const executionId = generateEntityId();
      await db.insert(tradeExecutions).values({
        id: executionId,
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'closed',
        barsInTrade: 5,
        openedAt: new Date(),
      });

      const service = new OpportunityCostManagerService();
      const result = await service.incrementBarsInTrade(executionId, 50000);

      expect(result).toBeNull();
    });

    it('should track significant movement', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({ userId: user.id });

      await db.insert(autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        opportunityCostEnabled: true,
        stalePriceThresholdPercent: '0.5',
        enabledSetupTypes: JSON.stringify(['larry-williams-9-1']),
      });

      const executionId = generateEntityId();
      await db.insert(tradeExecutions).values({
        id: executionId,
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        barsInTrade: 5,
        highestPriceSinceEntry: '50000',
        lowestPriceSinceEntry: '50000',
        openedAt: new Date(),
      });

      const service = new OpportunityCostManagerService();
      const result = await service.incrementBarsInTrade(executionId, 51000);

      expect(result!.significantMovement).toBe(true);
      expect(result!.priceMovementPercent).toBeGreaterThan(0.5);
    });
  });

  describe('checkAllPositions', () => {
    it('should return empty array when no open executions', async () => {
      const service = new OpportunityCostManagerService();
      const results = await service.checkAllPositions();

      expect(results).toEqual([]);
    });

    it('should skip wallets without opportunity cost enabled', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({ userId: user.id });

      await db.insert(autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        opportunityCostEnabled: false,
        enabledSetupTypes: JSON.stringify(['larry-williams-9-1']),
      });

      await db.insert(tradeExecutions).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        barsInTrade: 25,
        highestPriceSinceEntry: '50200',
        lowestPriceSinceEntry: '49800',
        openedAt: new Date(),
      });

      vi.mocked(priceCache.get).mockResolvedValue(50100);

      const service = new OpportunityCostManagerService();
      const results = await service.checkAllPositions();

      expect(results).toEqual([]);
    });

    it('should check positions when opportunity cost is enabled', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({ userId: user.id });

      await db.insert(autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        opportunityCostEnabled: true,
        maxHoldingPeriodBars: 20,
        stalePriceThresholdPercent: '0.5',
        staleTradeAction: 'ALERT_ONLY',
        timeBasedStopTighteningEnabled: true,
        timeTightenAfterBars: 10,
        timeTightenPercentPerBar: '5',
        enabledSetupTypes: JSON.stringify(['larry-williams-9-1']),
      });

      await db.insert(tradeExecutions).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        barsInTrade: 25,
        highestPriceSinceEntry: '50200',
        lowestPriceSinceEntry: '49800',
        openedAt: new Date(),
      });

      vi.mocked(priceCache.get).mockResolvedValue(50100);

      const service = new OpportunityCostManagerService();
      const results = await service.checkAllPositions();

      expect(results.length).toBe(1);
      expect(results[0].symbol).toBe('BTCUSDT');
      expect(results[0].isStale).toBe(true);
    });
  });

  describe('handleStalePosition', () => {
    it('should close position when action is CLOSE', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({ userId: user.id });

      const executionId = generateEntityId();
      await db.insert(tradeExecutions).values({
        id: executionId,
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        barsInTrade: 25,
        openedAt: new Date(),
      });

      const execution = (await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId))
        .then(rows => rows[0]))!;

      const config: OpportunityCostConfig = {
        opportunityCostEnabled: true,
        maxHoldingPeriodBars: 20,
        stalePriceThresholdPercent: 0.5,
        staleTradeAction: 'AUTO_CLOSE',
        timeBasedStopTighteningEnabled: true,
        timeTightenAfterBars: 10,
        timeTightenPercentPerBar: 5,
      };

      const check: StaleTradeCheck = {
        executionId,
        symbol: 'BTCUSDT',
        side: 'LONG',
        barsInTrade: 25,
        priceMovementPercent: 0.3,
        isStale: true,
        profitPercent: 2,
        currentPrice: 51000,
        recommendedAction: 'CLOSE',
        reason: 'Auto-closing stale trade after 25 bars',
      };

      const service = new OpportunityCostManagerService();
      await service.handleStalePosition(execution, config, check, 51000);

      const [updatedExecution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId));

      expect(updatedExecution!.status).toBe('closed');
      expect(updatedExecution!.exitReason).toBe('STALE_TRADE');
      expect(updatedExecution!.exitSource).toBe('OPPORTUNITY_COST');
      expect(parseFloat(updatedExecution!.exitPrice!)).toBe(51000);
    });

    it('should update stop loss when action is TIGHTEN', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();

      const wallet = await createTestWallet({ userId: user.id });

      const executionId = generateEntityId();
      await db.insert(tradeExecutions).values({
        id: executionId,
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        stopLoss: '48000',
        quantity: '0.1',
        status: 'open',
        barsInTrade: 25,
        openedAt: new Date(),
      });

      const execution = (await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId))
        .then(rows => rows[0]))!;

      const config: OpportunityCostConfig = {
        opportunityCostEnabled: true,
        maxHoldingPeriodBars: 20,
        stalePriceThresholdPercent: 0.5,
        staleTradeAction: 'TIGHTEN_STOP',
        timeBasedStopTighteningEnabled: true,
        timeTightenAfterBars: 10,
        timeTightenPercentPerBar: 5,
      };

      const check: StaleTradeCheck = {
        executionId,
        symbol: 'BTCUSDT',
        side: 'LONG',
        barsInTrade: 25,
        priceMovementPercent: 0.3,
        isStale: true,
        profitPercent: 2,
        currentPrice: 51000,
        recommendedAction: 'TIGHTEN',
        newStopLoss: 50500,
        reason: 'Tightening stop due to stale trade',
      };

      const service = new OpportunityCostManagerService();
      await service.handleStalePosition(execution, config, check, 51000);

      const [updatedExecution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId));

      expect(parseFloat(updatedExecution!.stopLoss!)).toBe(50500);
    });
  });
});
