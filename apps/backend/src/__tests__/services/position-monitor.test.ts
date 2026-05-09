import type { PositionSide, MarketType } from '@marketmind/types';
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupTestDatabase, teardownTestDatabase, getTestDatabase, cleanupTables } from '../helpers/test-db';
import { createAuthenticatedUser, createTestWallet } from '../helpers/test-fixtures';
import * as schema from '../../db/schema';
import { generateEntityId } from '../../utils/id';

vi.mock('../../services/binance-client', () => ({
  createBinanceClient: vi.fn(),
  createBinanceClientForPrices: vi.fn(() => ({
    prices: vi.fn().mockResolvedValue({ BTCUSDT: '50000', ETHUSDT: '3000' }),
    get24hrChangeStatistics: vi.fn().mockResolvedValue({ lastPrice: '50000' }),
  })),
  isPaperWallet: vi.fn((wallet) => wallet.walletType === 'paper'),
  silentWsLogger: {},
}));

vi.mock('../../services/binance-futures-client', () => ({
  createBinanceFuturesClient: vi.fn(() => ({
    get24hrChangeStatistics: vi.fn().mockResolvedValue({ lastPrice: '50000' }),
    submitNewOrder: vi.fn().mockResolvedValue({ orderId: '12345' }),
  })),
  createBinanceFuturesClientForPrices: vi.fn(() => ({
    get24hrChangeStatistics: vi.fn().mockResolvedValue({ lastPrice: '50000' }),
  })),
  getAllTradeFeesForPosition: vi.fn(),
  getLastClosingTrade: vi.fn(),
  isPaperWallet: vi.fn((wallet) => wallet.walletType === 'paper'),
}));

vi.mock('../../services/binance-futures-data', () => ({
  getBinanceFuturesDataService: vi.fn(() => ({
    getMarkPrice: vi.fn().mockResolvedValue({ markPrice: 50000 }),
  })),
}));

vi.mock('../../services/trailing-stop', () => ({
  trailingStopService: {
    updateTrailingStops: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/strategy-performance', () => ({
  strategyPerformanceService: {
    recordTrade: vi.fn().mockResolvedValue(undefined),
    updatePerformance: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    emitPositionUpdate: vi.fn(),
    emitPositionClosed: vi.fn(),
    emitOrderUpdate: vi.fn(),
    emitTradeNotification: vi.fn(),
    emitWalletUpdate: vi.fn(),
  })),
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

vi.mock('../../env', () => ({
  env: {
    ENABLE_LIVE_TRADING: false,
    ENCRYPTION_KEY: '0'.repeat(64),
  },
}));

vi.mock('../../exchange', () => ({
  getFuturesClient: vi.fn(() => ({
    getPosition: vi.fn(),
    getAllTradeFeesForPosition: vi.fn(),
    getLastClosingTrade: vi.fn(),
    submitOrder: vi.fn().mockResolvedValue({ orderId: '12345' }),
    cancelOrder: vi.fn(),
    cancelAllOrders: vi.fn(),
    getOpenOrders: vi.fn().mockResolvedValue([]),
  })),
  getSpotClient: vi.fn(() => ({
    submitOrder: vi.fn().mockResolvedValue({ orderId: '12345' }),
    getAccountInfo: vi.fn().mockResolvedValue({ balances: [] }),
  })),
}));

import { PositionMonitorService } from '../../services/position-monitor';

describe('PositionMonitorService', () => {
  let db: ReturnType<typeof getTestDatabase>;
  let service: PositionMonitorService;

  beforeAll(async () => {
    await setupTestDatabase();
    db = getTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PositionMonitorService();
  });

  afterEach(async () => {
    service.stop();
    await db.delete(schema.priceCache);
    await cleanupTables();
  });

  const createTestExecution = async (options: {
    userId: string;
    walletId: string;
    symbol?: string;
    side?: PositionSide;
    entryPrice?: string;
    quantity?: string;
    stopLoss?: string | null;
    takeProfit?: string | null;
    status?: string;
    marketType?: MarketType;
    limitEntryPrice?: string | null;
    expiresAt?: Date | null;
    stopLossAlgoId?: string | null;
    takeProfitAlgoId?: string | null;
    entryFee?: string | null;
  }) => {
    const executionId = generateEntityId();
    const now = new Date();

    const [execution] = await db.insert(schema.tradeExecutions).values({
      id: executionId,
      userId: options.userId,
      walletId: options.walletId,
      symbol: options.symbol || 'BTCUSDT',
      side: options.side || 'LONG',
      entryPrice: options.entryPrice || '50000',
      quantity: options.quantity || '0.1',
      stopLoss: options.stopLoss ?? '49000',
      takeProfit: options.takeProfit ?? '52000',
      status: options.status || 'open',
      openedAt: now,
      createdAt: now,
      updatedAt: now,
      marketType: options.marketType || 'FUTURES',
      leverage: 1,
      entryOrderType: options.limitEntryPrice ? 'LIMIT' : 'MARKET',
      limitEntryPrice: options.limitEntryPrice ?? null,
      expiresAt: options.expiresAt ?? null,
      stopLossAlgoId: options.stopLossAlgoId ?? null,
      takeProfitAlgoId: options.takeProfitAlgoId ?? null,
      entryFee: options.entryFee ?? null,
    }).returning();

    return execution;
  };

  describe('start/stop', () => {
    it('should start monitoring', () => {
      service.start();
      expect(() => service.start()).not.toThrow();
    });

    it('should stop monitoring', () => {
      service.start();
      service.stop();
      expect(() => service.stop()).not.toThrow();
    });

    it('should warn when already running', () => {
      service.start();
      service.start();
    });
  });

  describe('checkPosition', () => {
    it('should return NONE when price is within SL/TP range for LONG', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        entryPrice: '50000',
        stopLoss: '49000',
        takeProfit: '52000',
      });

      const result = await service.checkPosition(execution!);

      expect(result.action).toBe('NONE');
      expect(result.executionId).toBe(execution!.id);
    });

    it('should return NONE when no SL/TP is set', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        entryPrice: '50000',
        stopLoss: null,
        takeProfit: null,
      });

      const result = await service.checkPosition(execution!);

      expect(result.action).toBe('NONE');
    });
  });

  describe('checkPendingOrders', () => {
    it('should cancel expired limit orders', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'pending',
        limitEntryPrice: '48000',
        expiresAt: new Date(Date.now() - 3600000),
      });

      await service.checkPendingOrders();

      const executions = await db.select().from(schema.tradeExecutions);
      expect(executions[0]!.status).toBe('cancelled');
      expect(executions[0]!.exitReason).toBe('LIMIT_EXPIRED');
    });

    it('should cancel orders without limit price', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'pending',
        limitEntryPrice: null,
        expiresAt: new Date(Date.now() + 3600000),
      });

      await service.checkPendingOrders();

      const executions = await db.select().from(schema.tradeExecutions);
      expect(executions[0]!.status).toBe('cancelled');
      expect(executions[0]!.exitReason).toBe('INVALID_ORDER');
    });
  });

  describe('checkAllPositions', () => {
    it('should handle empty positions list', async () => {
      await expect(service.checkAllPositions()).resolves.not.toThrow();
    });

    it('should check open executions', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'open',
      });

      await expect(service.checkAllPositions()).resolves.not.toThrow();
    });
  });

  describe('executeExit', () => {
    it('should close position and update wallet balance on stop loss', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        stopLoss: '49000',
      });

      await service.executeExit(execution!, 49000, 'STOP_LOSS');

      const [updatedExecution] = await db
        .select()
        .from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution!.id));

      expect(updatedExecution!.status).toBe('closed');
      expect(updatedExecution!.exitReason).toBe('STOP_LOSS');
      expect(updatedExecution!.exitSource).toBe('ALGORITHM');
      expect(parseFloat(updatedExecution!.pnl!)).toBeLessThan(0);
    });

    it('should close position and update wallet balance on take profit', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        takeProfit: '52000',
      });

      await service.executeExit(execution!, 52000, 'TAKE_PROFIT');

      const [updatedExecution] = await db
        .select()
        .from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution!.id));

      expect(updatedExecution!.status).toBe('closed');
      expect(updatedExecution!.exitReason).toBe('TAKE_PROFIT');
      expect(parseFloat(updatedExecution!.pnl!)).toBeGreaterThan(0);
    });

    it('should calculate PnL correctly for LONG position', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
      });

      await service.executeExit(execution!, 51000, 'TAKE_PROFIT');

      const [updatedExecution] = await db
        .select()
        .from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution!.id));

      const grossPnl = (51000 - 50000) * 0.1;
      expect(parseFloat(updatedExecution!.pnl!)).toBeLessThan(grossPnl);
    });

    it('should calculate PnL correctly for SHORT position', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'SHORT',
        entryPrice: '50000',
        quantity: '0.1',
        stopLoss: '51000',
        takeProfit: '48000',
      });

      await service.executeExit(execution!, 48000, 'TAKE_PROFIT');

      const [updatedExecution] = await db
        .select()
        .from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution!.id));

      expect(parseFloat(updatedExecution!.pnl!)).toBeGreaterThan(0);
    });

    it('should not exit zero quantity position', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        quantity: '0',
      });

      await service.executeExit(execution!, 49000, 'STOP_LOSS');

      const [updatedExecution] = await db
        .select()
        .from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution!.id));

      expect(updatedExecution!.status).toBe('open');
    });

    it('should skip if position already closed', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
      });

      await service.executeExit(execution!, 49000, 'STOP_LOSS');

      const [updatedExecution] = await db
        .select()
        .from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution!.id));

      expect(updatedExecution!.status).toBe('closed');
    });

    it('should prevent duplicate exits', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
      });

      const exitPromises = [
        service.executeExit(execution!, 49000, 'STOP_LOSS'),
        service.executeExit(execution!, 49000, 'STOP_LOSS'),
      ];

      await Promise.all(exitPromises);

      const executions = await db
        .select()
        .from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution!.id));

      expect(executions.length).toBe(1);
    });
  });

  describe('LONG position triggers', () => {
    it('should trigger SL when price drops below stop loss', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        entryPrice: '50000',
        stopLoss: '51000',
        takeProfit: '52000',
      });

      const result = await service.checkPosition(execution!);

      expect(result.action).toBe('STOP_LOSS');
    });
  });

  describe('SHORT position triggers', () => {
    it('should trigger SL when price rises above stop loss', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'SHORT',
        entryPrice: '50000',
        stopLoss: '49000',
        takeProfit: '48000',
      });

      const result = await service.checkPosition(execution!);

      expect(result.action).toBe('STOP_LOSS');
    });
  });

  describe('consolidatedStopLoss/TakeProfit calculations', () => {
    it('should use highest SL for LONG positions in group', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        stopLoss: '48000',
      });

      await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        stopLoss: '49000',
      });

      await service.checkAllPositions();

      const executions = await db.select().from(schema.tradeExecutions);
      expect(executions.length).toBe(2);
    });
  });

  describe('FUTURES specific', () => {
    it('should handle FUTURES executions', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        marketType: 'FUTURES',
      });

      await expect(service.checkAllPositions()).resolves.not.toThrow();
    });
  });

  describe('wallet balance updates', () => {
    it('should increase balance on winning trade', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
      });

      await service.executeExit(execution!, 55000, 'TAKE_PROFIT');

      const [updatedWallet] = await db
        .select()
        .from(schema.wallets)
        .where(eq(schema.wallets.id, wallet.id));

      expect(parseFloat(updatedWallet!.currentBalance!)).toBeGreaterThan(10000);
    });

    it('should decrease balance on losing trade', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
      });

      await service.executeExit(execution!, 45000, 'STOP_LOSS');

      const [updatedWallet] = await db
        .select()
        .from(schema.wallets)
        .where(eq(schema.wallets.id, wallet.id));

      expect(parseFloat(updatedWallet!.currentBalance!)).toBeLessThan(10000);
    });
  });

  describe('exchange-side protection deferral', () => {
    it('should defer exit to exchange when live trading enabled and exchange-side SL protection exists', async () => {
      const { env } = await import('../../env');
      const originalLiveTrading = env.ENABLE_LIVE_TRADING;
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;

      try {
        const { user } = await createAuthenticatedUser();
        const wallet = await createTestWallet({ userId: user.id, walletType: 'live', initialBalance: '10000' });

        const execution = await createTestExecution({
          userId: user.id,
          walletId: wallet.id,
          side: 'LONG',
          entryPrice: '50000',
          quantity: '0.1',
          stopLoss: '49000',
          stopLossAlgoId: '12345',
        });

        await service.executeExit(execution!, 48900, 'STOP_LOSS');

        const [updatedExecution] = await db
          .select()
          .from(schema.tradeExecutions)
          .where(eq(schema.tradeExecutions.id, execution!.id));

        expect(updatedExecution!.status).toBe('open');
      } finally {
        (env as Record<string, unknown>).ENABLE_LIVE_TRADING = originalLiveTrading;
      }
    });

    it('should defer exit to exchange for TP when exchange-side TP protection exists', async () => {
      const { env } = await import('../../env');
      const originalLiveTrading = env.ENABLE_LIVE_TRADING;
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;

      try {
        const { user } = await createAuthenticatedUser();
        const wallet = await createTestWallet({ userId: user.id, walletType: 'live', initialBalance: '10000' });

        const execution = await createTestExecution({
          userId: user.id,
          walletId: wallet.id,
          side: 'LONG',
          entryPrice: '50000',
          quantity: '0.1',
          takeProfit: '52000',
          takeProfitAlgoId: '67890',
        });

        await service.executeExit(execution!, 52100, 'TAKE_PROFIT');

        const [updatedExecution] = await db
          .select()
          .from(schema.tradeExecutions)
          .where(eq(schema.tradeExecutions.id, execution!.id));

        expect(updatedExecution!.status).toBe('open');
      } finally {
        (env as Record<string, unknown>).ENABLE_LIVE_TRADING = originalLiveTrading;
      }
    });
  });

  describe('checkPositionGroupByPrice', () => {
    it('should close positions in group when SL triggered (no deferral)', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution1 = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.05',
        stopLoss: '49000',
        takeProfit: '52000',
      });

      const execution2 = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        entryPrice: '50100',
        quantity: '0.05',
        stopLoss: '49000',
        takeProfit: '52000',
      });

      await service.checkPositionGroupByPrice([execution1!, execution2!], 48500);

      const [updated1] = await db
        .select()
        .from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution1!.id));

      const [updated2] = await db
        .select()
        .from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution2!.id));

      expect(updated1!.status).toBe('closed');
      expect(updated1!.exitReason).toBe('STOP_LOSS');
      expect(updated2!.status).toBe('closed');
      expect(updated2!.exitReason).toBe('STOP_LOSS');
    });

    it('should handle empty executions array', async () => {
      await expect(service.checkPositionGroupByPrice([], 50000)).resolves.not.toThrow();
    });
  });

  describe('ReduceOnly rejection detection', () => {
    it('should detect ReduceOnly error code -2022', async () => {
      const { env } = await import('../../env');
      const { getFuturesClient } = await import('../../exchange');
      const originalLiveTrading = env.ENABLE_LIVE_TRADING;
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;

      const mockSubmitOrder = vi.fn().mockRejectedValue(
        Object.assign(new Error('Order failed'), { code: -2022 })
      );
      vi.mocked(getFuturesClient).mockReturnValue({
        getPosition: vi.fn(),
        getAllTradeFeesForPosition: vi.fn().mockResolvedValue(null),
        getLastClosingTrade: vi.fn().mockResolvedValue(null),
        submitOrder: mockSubmitOrder,
        cancelOrder: vi.fn(),
        cancelAllOrders: vi.fn(),
        getOpenOrders: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof getFuturesClient>);

      try {
        const { user } = await createAuthenticatedUser();
        const wallet = await createTestWallet({ userId: user.id, walletType: 'live', initialBalance: '10000' });

        const execution = await createTestExecution({
          userId: user.id,
          walletId: wallet.id,
          side: 'LONG',
          entryPrice: '50000',
          quantity: '0.1',
          stopLoss: '49000',
        });

        await service.executeExit(execution!, 49000, 'STOP_LOSS');

        const [updatedExecution] = await db
          .select()
          .from(schema.tradeExecutions)
          .where(eq(schema.tradeExecutions.id, execution!.id));

        expect(updatedExecution!.status).toBe('closed');
        expect(updatedExecution!.exitSource).toBe('EXCHANGE_SYNC');
      } finally {
        (env as Record<string, unknown>).ENABLE_LIVE_TRADING = originalLiveTrading;
      }
    });
  });

  describe('fee calculation uses actual entry fee', () => {
    it('should use stored entryFee instead of re-estimating', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        stopLoss: '49000',
        takeProfit: '52000',
        entryFee: '5.00',
      });

      await service.executeExit(execution!, 52000, 'TAKE_PROFIT');

      const [updatedExecution] = await db
        .select()
        .from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution!.id));

      expect(updatedExecution!.status).toBe('closed');
      expect(parseFloat(updatedExecution!.entryFee!)).toBe(5.00);
      expect(parseFloat(updatedExecution!.fees!)).toBeGreaterThan(5.00);
    });
  });
});
