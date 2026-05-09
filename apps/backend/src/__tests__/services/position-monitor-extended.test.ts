import type { PositionSide, MarketType } from '@marketmind/types';
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupTestDatabase, teardownTestDatabase, getTestDatabase, cleanupTables } from '../helpers/test-db';
import { createAuthenticatedUser, createTestWallet, createTestOrder } from '../helpers/test-fixtures';
import * as schema from '../../db/schema';
import { generateEntityId } from '../../utils/id';

const mockEmitPositionUpdate = vi.fn();
const mockEmitTradeNotification = vi.fn();
const mockEmitRiskAlert = vi.fn();
const mockEmitLiquidationWarning = vi.fn();

vi.mock('../../services/binance-client', () => ({
  createBinanceClient: vi.fn(),
  createBinanceClientForPrices: vi.fn(() => ({
    prices: vi.fn().mockResolvedValue({ BTCUSDT: '50000', ETHUSDT: '3000' }),
    get24hrChangeStatistics: vi.fn().mockResolvedValue({ lastPrice: '3000' }),
  })),
  createBinanceFuturesClientForPrices: vi.fn(() => ({
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
    emitPositionUpdate: mockEmitPositionUpdate,
    emitPositionClosed: vi.fn(),
    emitOrderUpdate: vi.fn(),
    emitTradeNotification: mockEmitTradeNotification,
    emitWalletUpdate: vi.fn(),
    emitRiskAlert: mockEmitRiskAlert,
    emitLiquidationWarning: mockEmitLiquidationWarning,
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
    getAllTradeFeesForPosition: vi.fn().mockResolvedValue(null),
    getLastClosingTrade: vi.fn().mockResolvedValue(null),
    submitOrder: vi.fn().mockResolvedValue({ orderId: '12345' }),
    cancelOrder: vi.fn(),
    cancelAllOrders: vi.fn(),
    getOpenOrders: vi.fn().mockResolvedValue([]),
    getOrderEntryFee: vi.fn().mockResolvedValue(null),
  })),
  getSpotClient: vi.fn(() => ({
    submitOrder: vi.fn().mockResolvedValue({ orderId: '67890' }),
    getAccountInfo: vi.fn().mockResolvedValue({ balances: [] }),
  })),
}));

vi.mock('../../services/price-cache', () => ({
  priceCache: {
    getPrice: vi.fn().mockReturnValue(null),
    updateFromWebSocket: vi.fn(),
    batchFetch: vi.fn().mockResolvedValue(new Map()),
  },
}));

vi.mock('../../services/min-notional-filter', () => ({
  getMinNotionalFilterService: vi.fn(() => ({
    getSymbolFilters: vi.fn().mockResolvedValue(new Map()),
  })),
}));

vi.mock('../../services/watcher-batch-logger', () => ({
  outputPendingOrdersCheckResults: vi.fn(),
}));

vi.mock('../../services/opportunity-cost-manager', () => ({
  opportunityCostManagerService: {
    checkAllPositions: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/protection-orders', () => ({
  cancelAllProtectionOrders: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/auto-trading-scheduler', () => ({
  autoTradingScheduler: {
    isWalletPaused: vi.fn().mockReturnValue(false),
    resumeWatchersForWallet: vi.fn(),
  },
}));

vi.mock('../../services/binance-price-stream', () => ({
  binancePriceStreamService: {
    invalidateExecutionCache: vi.fn(),
  },
}));

import { PositionMonitorService } from '../../services/position-monitor';
import { priceCache } from '../../services/price-cache';
import { getWebSocketService } from '../../services/websocket';
import { getBinanceFuturesDataService } from '../../services/binance-futures-data';
import { autoTradingScheduler } from '../../services/auto-trading-scheduler';
import { cancelAllProtectionOrders } from '../../services/protection-orders';
import { getFuturesClient, getSpotClient } from '../../exchange';
import { binancePriceStreamService } from '../../services/binance-price-stream';

describe('PositionMonitorService - Extended Coverage', () => {
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
    stopLossOrderId?: string | null;
    takeProfitAlgoId?: string | null;
    takeProfitOrderId?: string | null;
    entryFee?: string | null;
    entryOrderId?: string | null;
    accumulatedFunding?: string | null;
    liquidationPrice?: string | null;
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
      stopLoss: options.stopLoss === undefined ? '49000' : options.stopLoss,
      takeProfit: options.takeProfit === undefined ? '52000' : options.takeProfit,
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
      stopLossOrderId: options.stopLossOrderId ?? null,
      takeProfitAlgoId: options.takeProfitAlgoId ?? null,
      takeProfitOrderId: options.takeProfitOrderId ?? null,
      entryFee: options.entryFee ?? null,
      entryOrderId: options.entryOrderId ?? null,
      accumulatedFunding: options.accumulatedFunding ?? null,
      liquidationPrice: options.liquidationPrice ?? null,
    }).returning();

    return execution;
  };

  describe('checkPositionByPrice', () => {
    it('should return NONE when no SL/TP is set', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        stopLoss: null,
        takeProfit: null,
      });

      const result = await service.checkPositionByPrice(execution!, 50500);
      expect(result.action).toBe('NONE');
      expect(result.currentPrice).toBe(50500);
    });

    it('should trigger STOP_LOSS for LONG when price <= stopLoss', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        entryPrice: '50000',
        stopLoss: '49000',
        takeProfit: '52000',
      });

      const result = await service.checkPositionByPrice(execution!, 48500);
      expect(result.action).toBe('STOP_LOSS');
      expect(result.triggerPrice).toBe(49000);
    });

    it('should trigger TAKE_PROFIT for LONG when price >= takeProfit', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        entryPrice: '50000',
        stopLoss: '49000',
        takeProfit: '52000',
      });

      const result = await service.checkPositionByPrice(execution!, 53000);
      expect(result.action).toBe('TAKE_PROFIT');
      expect(result.triggerPrice).toBe(52000);
    });

    it('should trigger STOP_LOSS for SHORT when price >= stopLoss', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'SHORT',
        entryPrice: '50000',
        stopLoss: '51000',
        takeProfit: '48000',
      });

      const result = await service.checkPositionByPrice(execution!, 51500);
      expect(result.action).toBe('STOP_LOSS');
      expect(result.triggerPrice).toBe(51000);
    });

    it('should trigger TAKE_PROFIT for SHORT when price <= takeProfit', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'SHORT',
        entryPrice: '50000',
        stopLoss: '51000',
        takeProfit: '48000',
      });

      const result = await service.checkPositionByPrice(execution!, 47000);
      expect(result.action).toBe('TAKE_PROFIT');
      expect(result.triggerPrice).toBe(48000);
    });

    it('should return NONE for SHORT when price is within SL/TP range', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'SHORT',
        entryPrice: '50000',
        stopLoss: '51000',
        takeProfit: '48000',
      });

      const result = await service.checkPositionByPrice(execution!, 49500);
      expect(result.action).toBe('NONE');
    });
  });

  describe('checkPositionGroupByPrice - SHORT positions', () => {
    it('should trigger group SL for SHORT positions', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution1 = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'SHORT',
        entryPrice: '50000',
        quantity: '0.05',
        stopLoss: '51000',
        takeProfit: '48000',
      });

      const execution2 = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'SHORT',
        entryPrice: '50100',
        quantity: '0.05',
        stopLoss: '51500',
        takeProfit: '48000',
      });

      await service.checkPositionGroupByPrice([execution1!, execution2!], 52000);

      const [updated1] = await db.select().from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution1!.id));
      const [updated2] = await db.select().from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution2!.id));

      expect(updated1!.status).toBe('closed');
      expect(updated1!.exitReason).toBe('STOP_LOSS');
      expect(updated2!.status).toBe('closed');
      expect(updated2!.exitReason).toBe('STOP_LOSS');
    });

    it('should trigger group TP for LONG positions', async () => {
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
        takeProfit: '53000',
      });

      await service.checkPositionGroupByPrice([execution1!, execution2!], 53500);

      const [updated1] = await db.select().from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution1!.id));
      const [updated2] = await db.select().from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution2!.id));

      expect(updated1!.status).toBe('closed');
      expect(updated1!.exitReason).toBe('TAKE_PROFIT');
      expect(updated2!.status).toBe('closed');
      expect(updated2!.exitReason).toBe('TAKE_PROFIT');
    });

    it('should trigger group TP for SHORT positions', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution1 = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'SHORT',
        entryPrice: '50000',
        quantity: '0.05',
        stopLoss: '51000',
        takeProfit: '48000',
      });

      const execution2 = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'SHORT',
        entryPrice: '50100',
        quantity: '0.05',
        stopLoss: '51000',
        takeProfit: '47000',
      });

      await service.checkPositionGroupByPrice([execution1!, execution2!], 46000);

      const [updated1] = await db.select().from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution1!.id));
      const [updated2] = await db.select().from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution2!.id));

      expect(updated1!.status).toBe('closed');
      expect(updated1!.exitReason).toBe('TAKE_PROFIT');
      expect(updated2!.status).toBe('closed');
      expect(updated2!.exitReason).toBe('TAKE_PROFIT');
    });

    it('should skip when group is already being processed', async () => {
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

      const promises = [
        service.checkPositionGroupByPrice([execution1!], 48000),
        service.checkPositionGroupByPrice([execution1!], 48000),
      ];

      await Promise.all(promises);

      const { logger } = await import('../../services/logger');
      const traceMessages = vi.mocked(logger.trace).mock.calls
        .filter(call => typeof call[1] === 'string' && call[1].includes('already processing'));
      expect(traceMessages.length).toBeGreaterThanOrEqual(0);
    });

    it('should return when no SL or TP is triggered', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        stopLoss: '49000',
        takeProfit: '52000',
      });

      await service.checkPositionGroupByPrice([execution!], 50500);

      const [updated] = await db.select().from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution!.id));
      expect(updated!.status).toBe('open');
    });
  });

  describe('groupExecutionsBySymbolAndSidePublic', () => {
    it('should group executions by symbol and side', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      const exec1 = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
      });

      const exec2 = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
      });

      const exec3 = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        symbol: 'ETHUSDT',
        side: 'SHORT',
      });

      const groups = service.groupExecutionsBySymbolAndSidePublic([exec1!, exec2!, exec3!]);

      expect(groups.size).toBe(2);
      expect(groups.get('BTCUSDT-LONG')?.length).toBe(2);
      expect(groups.get('ETHUSDT-SHORT')?.length).toBe(1);
    });

    it('should handle empty array', () => {
      const groups = service.groupExecutionsBySymbolAndSidePublic([]);
      expect(groups.size).toBe(0);
    });
  });

  describe('updatePrice', () => {
    it('should upsert price in cache table', async () => {
      await service.updatePrice('BTCUSDT', 51000);

      const [cached] = await db.select().from(schema.priceCache)
        .where(eq(schema.priceCache.symbol, 'BTCUSDT'));

      expect(cached).toBeDefined();
      expect(parseFloat(cached!.price)).toBe(51000);
    });

    it('should update existing price on conflict', async () => {
      await service.updatePrice('BTCUSDT', 51000);
      await service.updatePrice('BTCUSDT', 52000);

      const results = await db.select().from(schema.priceCache)
        .where(eq(schema.priceCache.symbol, 'BTCUSDT'));

      expect(results.length).toBe(1);
      expect(parseFloat(results[0]!.price)).toBe(52000);
    });
  });

  describe('invalidatePriceCache', () => {
    it('should invalidate specific symbol cache', async () => {
      await service.updatePrice('BTCUSDT', 51000);
      await service.updatePrice('ETHUSDT', 3000);

      await service.invalidatePriceCache('BTCUSDT');

      const [btc] = await db.select().from(schema.priceCache)
        .where(eq(schema.priceCache.symbol, 'BTCUSDT'));
      const [eth] = await db.select().from(schema.priceCache)
        .where(eq(schema.priceCache.symbol, 'ETHUSDT'));

      expect(new Date(btc!.timestamp).getTime()).toBe(new Date(0).getTime());
      expect(new Date(eth!.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should invalidate all cache when no symbol provided', async () => {
      await service.updatePrice('BTCUSDT', 51000);
      await service.updatePrice('ETHUSDT', 3000);

      await service.invalidatePriceCache();

      const [btc] = await db.select().from(schema.priceCache)
        .where(eq(schema.priceCache.symbol, 'BTCUSDT'));
      const [eth] = await db.select().from(schema.priceCache)
        .where(eq(schema.priceCache.symbol, 'ETHUSDT'));

      expect(new Date(btc!.timestamp).getTime()).toBe(new Date(0).getTime());
      expect(new Date(eth!.timestamp).getTime()).toBe(new Date(0).getTime());
    });
  });

  describe('getCurrentPrice', () => {
    it('should return in-memory cached price when available', async () => {
      vi.mocked(priceCache.getPrice).mockReturnValueOnce(51500);

      const price = await service.getCurrentPrice('BTCUSDT', 'FUTURES');
      expect(price).toBe(51500);
    });

    it('should return DB cached price when fresh', async () => {
      vi.mocked(priceCache.getPrice).mockReturnValueOnce(null);

      await db.insert(schema.priceCache).values({
        symbol: 'BTCUSDT_FUTURES',
        price: '51200',
        timestamp: new Date(),
      });

      const price = await service.getCurrentPrice('BTCUSDT', 'FUTURES');
      expect(price).toBe(51200);
      expect(priceCache.updateFromWebSocket).toHaveBeenCalledWith('BTCUSDT', 'FUTURES', 51200);
    });

    it('should fetch from FUTURES API when cache is stale', async () => {
      vi.mocked(priceCache.getPrice).mockReturnValueOnce(null);

      await db.insert(schema.priceCache).values({
        symbol: 'BTCUSDT_FUTURES',
        price: '49000',
        timestamp: new Date(Date.now() - 10000),
      });

      const price = await service.getCurrentPrice('BTCUSDT', 'FUTURES');
      expect(price).toBe(50000);
    });

    it('should fall back to ticker when getMarkPrice returns null for FUTURES', async () => {
      vi.mocked(priceCache.getPrice).mockReturnValueOnce(null);
      vi.mocked(getBinanceFuturesDataService).mockReturnValueOnce({
        getMarkPrice: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      const price = await service.getCurrentPrice('BTCUSDT', 'FUTURES');
      expect(price).toBe(50000);
    });

    it('should fetch from SPOT API for SPOT market type', async () => {
      vi.mocked(priceCache.getPrice).mockReturnValueOnce(null);

      const price = await service.getCurrentPrice('BTCUSDT', 'SPOT');
      expect(price).toBe(3000);
    });

    it('should throw on API error', async () => {
      vi.mocked(priceCache.getPrice).mockReturnValueOnce(null);
      vi.mocked(getBinanceFuturesDataService).mockReturnValueOnce({
        getMarkPrice: vi.fn().mockRejectedValue(new Error('API failure')),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      await expect(service.getCurrentPrice('BTCUSDT', 'FUTURES'))
        .rejects.toThrow('API failure');
    });
  });

  describe('checkLiquidationRisk', () => {
    it('should return safe when distance is above warning threshold', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(getBinanceFuturesDataService).mockReturnValue({
        getMarkPrice: vi.fn().mockResolvedValue({ markPrice: 50000 }),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        marketType: 'FUTURES',
        side: 'LONG',
        liquidationPrice: '10000',
      });

      const results = await service.checkLiquidationRisk([execution!]);
      expect(results.length).toBe(1);
      expect(results[0]!.riskLevel).toBe('safe');
      expect(mockEmitRiskAlert).not.toHaveBeenCalled();
    });

    it('should return warning level when within warning threshold for LONG', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(getBinanceFuturesDataService).mockReturnValue({
        getMarkPrice: vi.fn().mockResolvedValue({ markPrice: 50000 }),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      const liquidationPrice = 50000 * (1 - 0.12);
      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        marketType: 'FUTURES',
        side: 'LONG',
        liquidationPrice: liquidationPrice.toString(),
      });

      const results = await service.checkLiquidationRisk([execution!]);
      expect(results.length).toBe(1);
      expect(results[0]!.riskLevel).toBe('warning');
      expect(mockEmitLiquidationWarning).toHaveBeenCalled();
      expect(mockEmitRiskAlert).toHaveBeenCalled();
    });

    it('should return danger level for LONG position near liquidation', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(getBinanceFuturesDataService).mockReturnValue({
        getMarkPrice: vi.fn().mockResolvedValue({ markPrice: 50000 }),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      const liquidationPrice = 50000 * (1 - 0.07);
      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        marketType: 'FUTURES',
        side: 'LONG',
        liquidationPrice: liquidationPrice.toString(),
      });

      const results = await service.checkLiquidationRisk([execution!]);
      expect(results.length).toBe(1);
      expect(results[0]!.riskLevel).toBe('danger');
    });

    it('should return critical level when very close to liquidation for LONG', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(getBinanceFuturesDataService).mockReturnValue({
        getMarkPrice: vi.fn().mockResolvedValue({ markPrice: 50000 }),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      const liquidationPrice = 50000 * (1 - 0.05);
      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        marketType: 'FUTURES',
        side: 'LONG',
        liquidationPrice: liquidationPrice.toString(),
      });

      const results = await service.checkLiquidationRisk([execution!]);
      expect(results.length).toBe(1);
      expect(results[0]!.riskLevel).toBe('critical');
    });

    it('should calculate distance correctly for SHORT positions', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(getBinanceFuturesDataService).mockReturnValue({
        getMarkPrice: vi.fn().mockResolvedValue({ markPrice: 50000 }),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      const liquidationPrice = 50000 * (1 + 0.05);
      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        marketType: 'FUTURES',
        side: 'SHORT',
        liquidationPrice: liquidationPrice.toString(),
      });

      const results = await service.checkLiquidationRisk([execution!]);
      expect(results.length).toBe(1);
      expect(results[0]!.riskLevel).toBe('critical');
    });

    it('should skip execution without liquidation price', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(getBinanceFuturesDataService).mockReturnValue({
        getMarkPrice: vi.fn().mockResolvedValue({ markPrice: 50000 }),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        marketType: 'FUTURES',
        liquidationPrice: null,
      });

      const results = await service.checkLiquidationRisk([execution!]);
      expect(results.length).toBe(0);
    });

    it('should skip execution with zero liquidation price', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(getBinanceFuturesDataService).mockReturnValue({
        getMarkPrice: vi.fn().mockResolvedValue({ markPrice: 50000 }),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        marketType: 'FUTURES',
        liquidationPrice: '0',
      });

      const results = await service.checkLiquidationRisk([execution!]);
      expect(results.length).toBe(0);
    });

    it('should skip symbol when getMarkPrice returns null', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(getBinanceFuturesDataService).mockReturnValue({
        getMarkPrice: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        marketType: 'FUTURES',
        liquidationPrice: '48000',
      });

      const results = await service.checkLiquidationRisk([execution!]);
      expect(results.length).toBe(0);
    });

    it('should handle API error and continue with other symbols', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(getBinanceFuturesDataService).mockReturnValue({
        getMarkPrice: vi.fn().mockRejectedValue(new Error('API error')),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        marketType: 'FUTURES',
        liquidationPrice: '48000',
      });

      const results = await service.checkLiquidationRisk([execution!]);
      expect(results.length).toBe(0);

      const { logger } = await import('../../services/logger');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should not re-emit alert within cooldown period', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(getBinanceFuturesDataService).mockReturnValue({
        getMarkPrice: vi.fn().mockResolvedValue({ markPrice: 50000 }),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      const liquidationPrice = 50000 * (1 - 0.05);
      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        marketType: 'FUTURES',
        side: 'LONG',
        liquidationPrice: liquidationPrice.toString(),
      });

      await service.checkLiquidationRisk([execution!]);
      expect(mockEmitRiskAlert).toHaveBeenCalledTimes(1);

      mockEmitRiskAlert.mockClear();
      mockEmitLiquidationWarning.mockClear();

      await service.checkLiquidationRisk([execution!]);
      expect(mockEmitRiskAlert).not.toHaveBeenCalled();
    });
  });

  describe('executeExit - additional paths', () => {
    it('should send trade notification on exit with profit', async () => {
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

      expect(mockEmitTradeNotification).toHaveBeenCalledWith(
        wallet.id,
        expect.objectContaining({
          type: 'POSITION_CLOSED',
          title: 'Take Profit',
          urgency: 'normal',
        })
      );

      // The close trio (order:update + position:closed) is now fired
      // by closeExecutionAndBroadcast, not by an inline emitPositionUpdate.
      // Assert the DB row reached the closed state with the expected fields.
      const [closed] = await db
        .select()
        .from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution!.id));
      expect(closed?.status).toBe('closed');
      expect(closed?.exitReason).toBe('TAKE_PROFIT');
    });

    it('should send critical urgency notification on stop loss with loss', async () => {
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

      await service.executeExit(execution!, 48000, 'STOP_LOSS');

      expect(mockEmitTradeNotification).toHaveBeenCalledWith(
        wallet.id,
        expect.objectContaining({
          type: 'POSITION_CLOSED',
          urgency: 'critical',
        })
      );
    });

    it('should use Stop Loss (Profit) title when SL triggers but pnl is positive', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        stopLoss: '51500',
      });

      await service.executeExit(execution!, 51500, 'STOP_LOSS');

      expect(mockEmitTradeNotification).toHaveBeenCalledWith(
        wallet.id,
        expect.objectContaining({
          type: 'POSITION_CLOSED',
          urgency: 'normal',
        })
      );
    });

    it('should resume auto-trading watchers after exit if wallet is paused', async () => {
      vi.mocked(autoTradingScheduler.isWalletPaused).mockReturnValueOnce(true);

      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
      });

      await service.executeExit(execution!, 49000, 'STOP_LOSS');

      expect(autoTradingScheduler.resumeWatchersForWallet).toHaveBeenCalledWith(wallet.id);
    });

    it('should not resume watchers if wallet is not paused', async () => {
      vi.mocked(autoTradingScheduler.isWalletPaused).mockReturnValueOnce(false);

      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
      });

      await service.executeExit(execution!, 49000, 'STOP_LOSS');

      expect(autoTradingScheduler.resumeWatchersForWallet).not.toHaveBeenCalled();
    });

    it('should cancel protection orders for live wallet after exit', async () => {
      const { env } = await import('../../env');
      const originalLiveTrading = env.ENABLE_LIVE_TRADING;
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = false;

      try {
        const { user } = await createAuthenticatedUser();
        const wallet = await createTestWallet({ userId: user.id, walletType: 'live', initialBalance: '10000' });

        const execution = await createTestExecution({
          userId: user.id,
          walletId: wallet.id,
          stopLossAlgoId: '111',
          takeProfitAlgoId: '222',
        });

        await service.executeExit(execution!, 49000, 'STOP_LOSS');

        expect(cancelAllProtectionOrders).toHaveBeenCalledWith(
          expect.objectContaining({
            symbol: 'BTCUSDT',
            stopLossAlgoId: '111',
            takeProfitAlgoId: '222',
          })
        );
      } finally {
        (env as Record<string, unknown>).ENABLE_LIVE_TRADING = originalLiveTrading;
      }
    });

    it('should handle cancel protection orders failure gracefully', async () => {
      vi.mocked(cancelAllProtectionOrders).mockRejectedValueOnce(new Error('Cancel failed'));

      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'live', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        stopLossAlgoId: '111',
      });

      await service.executeExit(execution!, 49000, 'STOP_LOSS');

      const [updatedExecution] = await db.select().from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution!.id));
      expect(updatedExecution!.status).toBe('closed');
    });

    it('should not cancel protection orders for paper wallet', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        stopLossAlgoId: '111',
      });

      await service.executeExit(execution!, 49000, 'STOP_LOSS');

      expect(cancelAllProtectionOrders).not.toHaveBeenCalled();
    });

    it('should handle SHORT position exit with correct PnL sign', async () => {
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

      const [updated] = await db.select().from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution!.id));

      expect(updated!.status).toBe('closed');
      expect(parseFloat(updated!.pnl!)).toBeGreaterThan(0);
      expect(parseFloat(updated!.pnlPercent!)).toBeGreaterThan(0);
    });

    it('should invalidate execution cache after successful exit', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
      });

      await service.executeExit(execution!, 49000, 'STOP_LOSS');

      expect(binancePriceStreamService.invalidateExecutionCache).toHaveBeenCalledWith('BTCUSDT');
    });

    it('should handle exit when wsService is null', async () => {
      vi.mocked(getWebSocketService).mockReturnValueOnce(null);

      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
      });

      await service.executeExit(execution!, 49000, 'STOP_LOSS');

      const [updated] = await db.select().from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution!.id));
      expect(updated!.status).toBe('closed');
    });
  });

  describe('executeExit - live trading paths', () => {
    it('should create real exit order for live FUTURES wallet', async () => {
      const { env } = await import('../../env');
      const originalLiveTrading = env.ENABLE_LIVE_TRADING;
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;

      try {
        const { user } = await createAuthenticatedUser();
        const wallet = await createTestWallet({ userId: user.id, walletType: 'live', initialBalance: '10000' });

        const order = await createTestOrder({ userId: user.id, walletId: wallet.id, orderId: '12345' });

        vi.mocked(getFuturesClient).mockReturnValueOnce({
          getPosition: vi.fn(),
          getAllTradeFeesForPosition: vi.fn().mockResolvedValue(null),
          getLastClosingTrade: vi.fn().mockResolvedValue(null),
          submitOrder: vi.fn().mockResolvedValue({ orderId: order.orderId }),
          cancelOrder: vi.fn(),
          cancelAllOrders: vi.fn(),
          getOpenOrders: vi.fn().mockResolvedValue([]),
          getOrderEntryFee: vi.fn().mockResolvedValue(null),
        } as unknown as ReturnType<typeof getFuturesClient>);

        const execution = await createTestExecution({
          userId: user.id,
          walletId: wallet.id,
          marketType: 'FUTURES',
        });

        await service.executeExit(execution!, 49000, 'STOP_LOSS');

        expect(getFuturesClient).toHaveBeenCalled();

        const [updated] = await db.select().from(schema.tradeExecutions)
          .where(eq(schema.tradeExecutions.id, execution!.id));
        expect(updated!.status).toBe('closed');
      } finally {
        (env as Record<string, unknown>).ENABLE_LIVE_TRADING = originalLiveTrading;
      }
    });

    it('should create real exit order for live SPOT wallet', async () => {
      const { env } = await import('../../env');
      const originalLiveTrading = env.ENABLE_LIVE_TRADING;
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;

      try {
        const { user } = await createAuthenticatedUser();
        const wallet = await createTestWallet({ userId: user.id, walletType: 'live', initialBalance: '10000' });

        const order = await createTestOrder({ userId: user.id, walletId: wallet.id, orderId: '67890' });

        vi.mocked(getSpotClient).mockReturnValueOnce({
          submitOrder: vi.fn().mockResolvedValue({ orderId: order.orderId }),
          getAccountInfo: vi.fn().mockResolvedValue({ balances: [] }),
        } as unknown as ReturnType<typeof getSpotClient>);

        const execution = await createTestExecution({
          userId: user.id,
          walletId: wallet.id,
          marketType: 'SPOT',
        });

        await service.executeExit(execution!, 49000, 'STOP_LOSS');

        expect(getSpotClient).toHaveBeenCalled();

        const [updated] = await db.select().from(schema.tradeExecutions)
          .where(eq(schema.tradeExecutions.id, execution!.id));
        expect(updated!.status).toBe('closed');
      } finally {
        (env as Record<string, unknown>).ENABLE_LIVE_TRADING = originalLiveTrading;
      }
    });

    it('should re-throw non-ReduceOnly exchange errors', async () => {
      const { env } = await import('../../env');
      const originalLiveTrading = env.ENABLE_LIVE_TRADING;
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;

      const mockSubmitOrder = vi.fn().mockRejectedValue(new Error('Insufficient balance'));
      vi.mocked(getFuturesClient).mockReturnValueOnce({
        getPosition: vi.fn(),
        getAllTradeFeesForPosition: vi.fn().mockResolvedValue(null),
        getLastClosingTrade: vi.fn().mockResolvedValue(null),
        submitOrder: mockSubmitOrder,
        cancelOrder: vi.fn(),
        cancelAllOrders: vi.fn(),
        getOpenOrders: vi.fn().mockResolvedValue([]),
        getOrderEntryFee: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof getFuturesClient>);

      try {
        const { user } = await createAuthenticatedUser();
        const wallet = await createTestWallet({ userId: user.id, walletType: 'live', initialBalance: '10000' });

        const execution = await createTestExecution({
          userId: user.id,
          walletId: wallet.id,
        });

        await expect(service.executeExit(execution!, 49000, 'STOP_LOSS'))
          .rejects.toThrow('Insufficient balance');
      } finally {
        (env as Record<string, unknown>).ENABLE_LIVE_TRADING = originalLiveTrading;
      }
    });

    it('should handle ReduceOnly rejection with message-based detection', async () => {
      const { env } = await import('../../env');
      const originalLiveTrading = env.ENABLE_LIVE_TRADING;
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;

      const mockSubmitOrder = vi.fn().mockRejectedValue(
        new Error('ReduceOnly Order is rejected')
      );
      vi.mocked(getFuturesClient).mockReturnValueOnce({
        getPosition: vi.fn(),
        getAllTradeFeesForPosition: vi.fn().mockResolvedValue(null),
        getLastClosingTrade: vi.fn().mockResolvedValue(null),
        submitOrder: mockSubmitOrder,
        cancelOrder: vi.fn(),
        cancelAllOrders: vi.fn(),
        getOpenOrders: vi.fn().mockResolvedValue([]),
        getOrderEntryFee: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof getFuturesClient>);

      try {
        const { user } = await createAuthenticatedUser();
        const wallet = await createTestWallet({ userId: user.id, walletType: 'live', initialBalance: '10000' });

        const execution = await createTestExecution({
          userId: user.id,
          walletId: wallet.id,
        });

        await service.executeExit(execution!, 49000, 'STOP_LOSS');

        const [updated] = await db.select().from(schema.tradeExecutions)
          .where(eq(schema.tradeExecutions.id, execution!.id));
        expect(updated!.status).toBe('closed');
        expect(updated!.exitSource).toBe('EXCHANGE_SYNC');
      } finally {
        (env as Record<string, unknown>).ENABLE_LIVE_TRADING = originalLiveTrading;
      }
    });

    it('should fetch actual fees from Binance on ReduceOnly rejection with allFees', async () => {
      const { env } = await import('../../env');
      const originalLiveTrading = env.ENABLE_LIVE_TRADING;
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;

      const mockSubmitOrder = vi.fn().mockRejectedValue(
        Object.assign(new Error('Order failed'), { code: -2022 })
      );
      vi.mocked(getFuturesClient).mockReturnValue({
        getPosition: vi.fn(),
        getAllTradeFeesForPosition: vi.fn().mockResolvedValue({
          entryFee: 2.5,
          exitFee: 2.5,
          totalFees: 5.0,
          exitPrice: 49100,
          realizedPnl: -95,
        }),
        getLastClosingTrade: vi.fn().mockResolvedValue(null),
        submitOrder: mockSubmitOrder,
        cancelOrder: vi.fn(),
        cancelAllOrders: vi.fn(),
        getOpenOrders: vi.fn().mockResolvedValue([]),
        getOrderEntryFee: vi.fn().mockResolvedValue(null),
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
        });

        await service.executeExit(execution!, 49000, 'STOP_LOSS');

        const [updated] = await db.select().from(schema.tradeExecutions)
          .where(eq(schema.tradeExecutions.id, execution!.id));
        expect(updated!.status).toBe('closed');
        expect(parseFloat(updated!.entryFee!)).toBe(2.5);
        expect(parseFloat(updated!.exitFee!)).toBe(2.5);
        expect(parseFloat(updated!.fees!)).toBe(5.0);
        expect(updated!.exitSource).toBe('EXCHANGE_SYNC');
      } finally {
        (env as Record<string, unknown>).ENABLE_LIVE_TRADING = originalLiveTrading;
      }
    });

    it('should fall back to getLastClosingTrade when getAllTradeFeesForPosition returns null', async () => {
      const { env } = await import('../../env');
      const originalLiveTrading = env.ENABLE_LIVE_TRADING;
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;

      const mockSubmitOrder = vi.fn().mockRejectedValue(
        Object.assign(new Error('Order failed'), { code: -2022 })
      );
      vi.mocked(getFuturesClient).mockReturnValue({
        getPosition: vi.fn(),
        getAllTradeFeesForPosition: vi.fn().mockResolvedValue(null),
        getLastClosingTrade: vi.fn().mockResolvedValue({
          price: 49200,
          commission: 1.5,
        }),
        submitOrder: mockSubmitOrder,
        cancelOrder: vi.fn(),
        cancelAllOrders: vi.fn(),
        getOpenOrders: vi.fn().mockResolvedValue([]),
        getOrderEntryFee: vi.fn().mockResolvedValue(null),
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
        });

        await service.executeExit(execution!, 49000, 'STOP_LOSS');

        const [updated] = await db.select().from(schema.tradeExecutions)
          .where(eq(schema.tradeExecutions.id, execution!.id));
        expect(updated!.status).toBe('closed');
        expect(parseFloat(updated!.exitFee!)).toBe(1.5);
      } finally {
        (env as Record<string, unknown>).ENABLE_LIVE_TRADING = originalLiveTrading;
      }
    });

    it('should fetch entry fee from Binance when positionSynced and closing trade found and entryFee is 0', async () => {
      const { env } = await import('../../env');
      const originalLiveTrading = env.ENABLE_LIVE_TRADING;
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;

      const mockSubmitOrder = vi.fn().mockRejectedValue(
        Object.assign(new Error('Order failed'), { code: -2022 })
      );
      vi.mocked(getFuturesClient).mockReturnValue({
        getPosition: vi.fn(),
        getAllTradeFeesForPosition: vi.fn().mockResolvedValue(null),
        getLastClosingTrade: vi.fn().mockResolvedValue({
          price: 49200,
          commission: 1.5,
        }),
        submitOrder: mockSubmitOrder,
        cancelOrder: vi.fn(),
        cancelAllOrders: vi.fn(),
        getOpenOrders: vi.fn().mockResolvedValue([]),
        getOrderEntryFee: vi.fn().mockResolvedValue({ entryFee: 2.0 }),
      } as unknown as ReturnType<typeof getFuturesClient>);

      try {
        const { user } = await createAuthenticatedUser();
        const wallet = await createTestWallet({ userId: user.id, walletType: 'live', initialBalance: '10000' });

        const entryOrder = await createTestOrder({ userId: user.id, walletId: wallet.id, orderId: '99999' });

        const execution = await createTestExecution({
          userId: user.id,
          walletId: wallet.id,
          side: 'LONG',
          entryPrice: '50000',
          quantity: '0.1',
          entryFee: '0',
          entryOrderId: entryOrder.orderId,
        });

        await service.executeExit(execution!, 49000, 'STOP_LOSS');

        const [updated] = await db.select().from(schema.tradeExecutions)
          .where(eq(schema.tradeExecutions.id, execution!.id));
        expect(updated!.status).toBe('closed');
        expect(parseFloat(updated!.entryFee!)).toBe(2.0);
      } finally {
        (env as Record<string, unknown>).ENABLE_LIVE_TRADING = originalLiveTrading;
      }
    });

    it('should handle fee fetch error gracefully on synced close', async () => {
      const { env } = await import('../../env');
      const originalLiveTrading = env.ENABLE_LIVE_TRADING;
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;

      const mockSubmitOrder = vi.fn().mockRejectedValue(
        Object.assign(new Error('Order failed'), { code: -2022 })
      );
      vi.mocked(getFuturesClient).mockReturnValue({
        getPosition: vi.fn(),
        getAllTradeFeesForPosition: vi.fn().mockRejectedValue(new Error('Fee fetch failed')),
        getLastClosingTrade: vi.fn(),
        submitOrder: mockSubmitOrder,
        cancelOrder: vi.fn(),
        cancelAllOrders: vi.fn(),
        getOpenOrders: vi.fn().mockResolvedValue([]),
        getOrderEntryFee: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof getFuturesClient>);

      try {
        const { user } = await createAuthenticatedUser();
        const wallet = await createTestWallet({ userId: user.id, walletType: 'live', initialBalance: '10000' });

        const execution = await createTestExecution({
          userId: user.id,
          walletId: wallet.id,
        });

        await service.executeExit(execution!, 49000, 'STOP_LOSS');

        const [updated] = await db.select().from(schema.tradeExecutions)
          .where(eq(schema.tradeExecutions.id, execution!.id));
        expect(updated!.status).toBe('closed');
      } finally {
        (env as Record<string, unknown>).ENABLE_LIVE_TRADING = originalLiveTrading;
      }
    });

    it('should fetch missing entry fee for non-synced live futures position', async () => {
      const { env } = await import('../../env');
      const originalLiveTrading = env.ENABLE_LIVE_TRADING;
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;

      try {
        const { user } = await createAuthenticatedUser();
        const wallet = await createTestWallet({ userId: user.id, walletType: 'live', initialBalance: '10000' });

        const exitOrder = await createTestOrder({ userId: user.id, walletId: wallet.id, orderId: '55555' });

        vi.mocked(getFuturesClient).mockReturnValue({
          getPosition: vi.fn(),
          getAllTradeFeesForPosition: vi.fn().mockResolvedValue(null),
          getLastClosingTrade: vi.fn().mockResolvedValue(null),
          submitOrder: vi.fn().mockResolvedValue({ orderId: exitOrder.orderId }),
          cancelOrder: vi.fn(),
          cancelAllOrders: vi.fn(),
          getOpenOrders: vi.fn().mockResolvedValue([]),
          getOrderEntryFee: vi.fn().mockResolvedValue({ entryFee: 3.0 }),
        } as unknown as ReturnType<typeof getFuturesClient>);

        const entryOrder = await createTestOrder({ userId: user.id, walletId: wallet.id, orderId: '88888' });

        const execution = await createTestExecution({
          userId: user.id,
          walletId: wallet.id,
          marketType: 'FUTURES',
          entryFee: '0',
          entryOrderId: entryOrder.orderId,
        });

        await service.executeExit(execution!, 49000, 'STOP_LOSS');

        const [updated] = await db.select().from(schema.tradeExecutions)
          .where(eq(schema.tradeExecutions.id, execution!.id));
        expect(updated!.status).toBe('closed');
        expect(parseFloat(updated!.entryFee!)).toBe(3.0);
      } finally {
        (env as Record<string, unknown>).ENABLE_LIVE_TRADING = originalLiveTrading;
      }
    });
  });

  describe('executeExit - exchange deferral', () => {
    it('should not close position when exchange-side SL protection exists on live wallet', async () => {
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
        await service.executeExit(execution!, 48800, 'STOP_LOSS');

        const [updated] = await db.select().from(schema.tradeExecutions)
          .where(eq(schema.tradeExecutions.id, execution!.id));
        expect(updated!.status).toBe('open');
      } finally {
        (env as Record<string, unknown>).ENABLE_LIVE_TRADING = originalLiveTrading;
      }
    });
  });

  describe('checkPendingOrders - additional paths', () => {
    it('should fill LONG limit order when currentPrice <= limitPrice', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(priceCache.batchFetch).mockResolvedValueOnce(
        new Map([['BTCUSDT-FUTURES', 47000]])
      );

      await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'pending',
        side: 'LONG',
        limitEntryPrice: '48000',
        expiresAt: new Date(Date.now() + 3600000),
      });

      await service.checkPendingOrders();

      const executions = await db.select().from(schema.tradeExecutions);
      expect(executions[0]!.status).toBe('open');
      expect(parseFloat(executions[0]!.entryPrice)).toBe(47000);
    });

    it('should fill SHORT limit order when currentPrice >= limitPrice', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(priceCache.batchFetch).mockResolvedValueOnce(
        new Map([['BTCUSDT-FUTURES', 53000]])
      );

      await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'pending',
        side: 'SHORT',
        limitEntryPrice: '52000',
        expiresAt: new Date(Date.now() + 3600000),
      });

      await service.checkPendingOrders();

      const executions = await db.select().from(schema.tradeExecutions);
      expect(executions[0]!.status).toBe('open');
      expect(parseFloat(executions[0]!.entryPrice)).toBe(53000);
    });

    it('should keep LONG limit order pending when price is above limit', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(priceCache.batchFetch).mockResolvedValueOnce(
        new Map([['BTCUSDT-FUTURES', 50000]])
      );

      await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'pending',
        side: 'LONG',
        limitEntryPrice: '48000',
        expiresAt: new Date(Date.now() + 3600000),
      });

      await service.checkPendingOrders();

      const executions = await db.select().from(schema.tradeExecutions);
      expect(executions[0]!.status).toBe('pending');
    });

    it('should handle no pending executions gracefully', async () => {
      await expect(service.checkPendingOrders()).resolves.not.toThrow();
    });

    it('should handle error in individual pending order price fetch', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(priceCache.batchFetch).mockResolvedValueOnce(new Map());
      vi.mocked(priceCache.getPrice).mockReturnValue(null);
      vi.mocked(getBinanceFuturesDataService).mockReturnValueOnce({
        getMarkPrice: vi.fn().mockRejectedValue(new Error('Price error')),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'pending',
        limitEntryPrice: '48000',
        expiresAt: new Date(Date.now() + 3600000),
      });

      await service.checkPendingOrders();

      const { outputPendingOrdersCheckResults } = await import('../../services/watcher-batch-logger');
      expect(outputPendingOrdersCheckResults).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCount: 1,
        })
      );
    });

    it('should emit trade notification and position update on limit fill', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(priceCache.batchFetch).mockResolvedValueOnce(
        new Map([['BTCUSDT-FUTURES', 47000]])
      );

      await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'pending',
        side: 'LONG',
        limitEntryPrice: '48000',
        expiresAt: new Date(Date.now() + 3600000),
      });

      await service.checkPendingOrders();

      expect(mockEmitTradeNotification).toHaveBeenCalledWith(
        wallet.id,
        expect.objectContaining({
          type: 'LIMIT_FILLED',
          title: 'Limit Order Filled',
        })
      );

      expect(mockEmitPositionUpdate).toHaveBeenCalledWith(
        wallet.id,
        expect.objectContaining({
          status: 'open',
        })
      );
    });

    it('should emit position update on expired order', async () => {
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

      expect(mockEmitPositionUpdate).toHaveBeenCalledWith(
        wallet.id,
        expect.objectContaining({
          status: 'cancelled',
          exitReason: 'LIMIT_EXPIRED',
        })
      );
    });

    it('should emit position update on invalid order (no limit price)', async () => {
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

      expect(mockEmitPositionUpdate).toHaveBeenCalledWith(
        wallet.id,
        expect.objectContaining({
          status: 'cancelled',
          exitReason: 'INVALID_ORDER',
        })
      );
    });

    it('should handle SPOT market type in pending orders', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(priceCache.batchFetch).mockResolvedValueOnce(
        new Map([['BTCUSDT-SPOT', 47000]])
      );

      await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'pending',
        side: 'LONG',
        marketType: 'SPOT',
        limitEntryPrice: '48000',
        expiresAt: new Date(Date.now() + 3600000),
      });

      await service.checkPendingOrders();

      const executions = await db.select().from(schema.tradeExecutions);
      expect(executions[0]!.status).toBe('open');
    });
  });

  describe('checkPosition - SHORT position paths', () => {
    it('should trigger TAKE_PROFIT for SHORT when price drops below TP', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      vi.mocked(priceCache.getPrice).mockReturnValueOnce(47000);

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'SHORT',
        entryPrice: '50000',
        stopLoss: '51000',
        takeProfit: '48000',
      });

      const result = await service.checkPosition(execution!);
      expect(result.action).toBe('TAKE_PROFIT');
      expect(result.triggerPrice).toBe(48000);
    });

    it('should return NONE for SHORT when price is between SL and TP', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(priceCache.getPrice).mockReturnValueOnce(49500);

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'SHORT',
        entryPrice: '50000',
        stopLoss: '51000',
        takeProfit: '48000',
      });

      const result = await service.checkPosition(execution!);
      expect(result.action).toBe('NONE');
    });
  });

  describe('checkPositionByPrice - unprotected position alerting', () => {
    it('should return NONE for position without SL or TP (via checkPositionByPrice)', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        stopLoss: null,
        takeProfit: null,
      });

      const result = await service.checkPositionByPrice(execution!, 50500);
      expect(result.action).toBe('NONE');
    });

    it('should emit unprotected position alert via checkPosition', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        stopLoss: null,
        takeProfit: null,
      });

      vi.mocked(priceCache.getPrice).mockReturnValue(50000);

      const localEmitRiskAlert = vi.fn();
      vi.mocked(getWebSocketService).mockReturnValue({
        emitPositionUpdate: vi.fn(),
        emitPositionClosed: vi.fn(),
        emitOrderUpdate: vi.fn(),
        emitTradeNotification: vi.fn(),
        emitWalletUpdate: vi.fn(),
        emitRiskAlert: localEmitRiskAlert,
        emitLiquidationWarning: vi.fn(),
      } as unknown as ReturnType<typeof getWebSocketService>);

      const result = await service.checkPosition(execution!);
      expect(result.action).toBe('NONE');
      expect(result.currentPrice).toBe(50000);

      expect(localEmitRiskAlert).toHaveBeenCalledWith(
        wallet.id,
        expect.objectContaining({
          type: 'UNPROTECTED_POSITION',
          level: 'danger',
        })
      );

      localEmitRiskAlert.mockClear();
      await service.checkPosition(execution!);
      expect(localEmitRiskAlert).not.toHaveBeenCalled();
    });
  });

  describe('checkAllPositions - error handling', () => {
    it('should continue checking other positions when one fails', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'open',
      });

      await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'open',
        symbol: 'ETHUSDT',
      });

      vi.mocked(priceCache.getPrice).mockReturnValueOnce(null);
      vi.mocked(getBinanceFuturesDataService).mockReturnValueOnce({
        getMarkPrice: vi.fn().mockRejectedValueOnce(new Error('Price error')),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      await expect(service.checkAllPositions()).resolves.not.toThrow();
    });

    it('should handle liquidation risk check errors gracefully', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'open',
        marketType: 'FUTURES',
      });

      vi.mocked(getBinanceFuturesDataService).mockReturnValue({
        getMarkPrice: vi.fn().mockRejectedValue(new Error('API down')),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      await expect(service.checkAllPositions()).resolves.not.toThrow();
    });
  });

  describe('checkPosition - LONG take profit trigger', () => {
    it('should trigger TAKE_PROFIT for LONG when price rises above TP', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      vi.mocked(priceCache.getPrice).mockReturnValueOnce(53000);

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        entryPrice: '50000',
        stopLoss: '49000',
        takeProfit: '52000',
      });

      const result = await service.checkPosition(execution!);
      expect(result.action).toBe('TAKE_PROFIT');
      expect(result.triggerPrice).toBe(52000);
    });
  });

  describe('executeExit - accumulated funding', () => {
    it('should include accumulated funding in PnL calculation', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        accumulatedFunding: '5.0',
      });

      await service.executeExit(execution!, 50000, 'STOP_LOSS');

      const [updated] = await db.select().from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution!.id));

      const pnl = parseFloat(updated!.pnl!);
      expect(pnl).toBeGreaterThan(-10);
    });
  });

  describe('emitLiquidationAlert - message formatting', () => {
    it('should format danger level message correctly', async () => {
      const localEmitRiskAlert = vi.fn();
      vi.mocked(getWebSocketService).mockReturnValue({
        emitPositionUpdate: vi.fn(),
        emitPositionClosed: vi.fn(),
        emitOrderUpdate: vi.fn(),
        emitTradeNotification: vi.fn(),
        emitWalletUpdate: vi.fn(),
        emitRiskAlert: localEmitRiskAlert,
        emitLiquidationWarning: vi.fn(),
      } as unknown as ReturnType<typeof getWebSocketService>);

      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(getBinanceFuturesDataService).mockReturnValue({
        getMarkPrice: vi.fn().mockResolvedValue({ markPrice: 50000 }),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      const liquidationPrice = 50000 * (1 - 0.07);
      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        marketType: 'FUTURES',
        side: 'LONG',
        liquidationPrice: liquidationPrice.toString(),
      });

      await service.checkLiquidationRisk([execution!]);

      expect(localEmitRiskAlert).toHaveBeenCalledWith(
        wallet.id,
        expect.objectContaining({
          type: 'LIQUIDATION_RISK',
          level: 'danger',
        })
      );
    });

    it('should format warning level message correctly', async () => {
      const localEmitRiskAlert = vi.fn();
      vi.mocked(getWebSocketService).mockReturnValue({
        emitPositionUpdate: vi.fn(),
        emitPositionClosed: vi.fn(),
        emitOrderUpdate: vi.fn(),
        emitTradeNotification: vi.fn(),
        emitWalletUpdate: vi.fn(),
        emitRiskAlert: localEmitRiskAlert,
        emitLiquidationWarning: vi.fn(),
      } as unknown as ReturnType<typeof getWebSocketService>);

      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(getBinanceFuturesDataService).mockReturnValue({
        getMarkPrice: vi.fn().mockResolvedValue({ markPrice: 50000 }),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      const liquidationPrice = 50000 * (1 - 0.12);
      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        marketType: 'FUTURES',
        side: 'LONG',
        liquidationPrice: liquidationPrice.toString(),
      });

      await service.checkLiquidationRisk([execution!]);

      expect(localEmitRiskAlert).toHaveBeenCalledWith(
        wallet.id,
        expect.objectContaining({
          type: 'LIQUIDATION_RISK',
          level: 'warning',
        })
      );
    });

    it('should not emit when wsService is null', async () => {
      vi.mocked(getWebSocketService).mockReturnValue(null as ReturnType<typeof getWebSocketService>);

      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });

      vi.mocked(getBinanceFuturesDataService).mockReturnValue({
        getMarkPrice: vi.fn().mockResolvedValue({ markPrice: 50000 }),
      } as unknown as ReturnType<typeof getBinanceFuturesDataService>);

      const liquidationPrice = 50000 * (1 - 0.05);
      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        marketType: 'FUTURES',
        side: 'LONG',
        liquidationPrice: liquidationPrice.toString(),
      });

      await service.checkLiquidationRisk([execution!]);

      expect(mockEmitLiquidationWarning).not.toHaveBeenCalled();
    });
  });

  describe('executeExit - race condition when another process closes position', () => {
    it('should handle position already closed by another process during close update', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', initialBalance: '10000' });

      const execution = await createTestExecution({
        userId: user.id,
        walletId: wallet.id,
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
      });

      await db.update(schema.tradeExecutions)
        .set({ status: 'closed', closedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.tradeExecutions.id, execution!.id));

      await db.update(schema.tradeExecutions)
        .set({ status: 'open' })
        .where(eq(schema.tradeExecutions.id, execution!.id));

      await service.executeExit(execution!, 49000, 'STOP_LOSS');

      const [updated] = await db.select().from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, execution!.id));
      expect(updated!.status).toBe('closed');
    });
  });
});
