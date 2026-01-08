import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { eq, and, desc } from 'drizzle-orm';
import { getTestDatabase, setupTestDatabase, teardownTestDatabase } from '../helpers/test-db';
import { createTestUser, createTestWallet, createTestTradingProfile } from '../helpers/test-fixtures';
import * as schema from '../../db/schema';
import { generateEntityId } from '../../utils/id';

vi.mock('../../services/binance-kline-stream', () => ({
  binanceKlineStreamService: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
  binanceFuturesKlineStreamService: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

vi.mock('../../services/position-monitor', () => ({
  positionMonitorService: {
    getCurrentPrice: vi.fn().mockResolvedValue(50000),
    invalidatePriceCache: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/websocket', () => ({
  getWebSocketService: vi.fn().mockReturnValue({
    emitPositionUpdate: vi.fn(),
    emitSetupDetected: vi.fn(),
  }),
}));

vi.mock('../../env', () => ({
  env: {
    ENABLE_LIVE_TRADING: false,
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  },
}));

const generateKlineSequence = (
  symbol: string,
  interval: string,
  count: number,
  basePrice: number,
  startTime: number,
  intervalMs: number
): schema.NewKline[] => {
  const klines: schema.NewKline[] = [];

  for (let i = 0; i < count; i++) {
    const openTime = new Date(startTime + i * intervalMs);
    const closeTime = new Date(startTime + (i + 1) * intervalMs - 1);

    const priceVariation = (Math.random() - 0.5) * 0.02 * basePrice;
    const open = basePrice + priceVariation;
    const close = open + (Math.random() - 0.5) * 0.01 * basePrice;
    const high = Math.max(open, close) + Math.random() * 0.005 * basePrice;
    const low = Math.min(open, close) - Math.random() * 0.005 * basePrice;

    klines.push({
      symbol,
      interval,
      marketType: 'SPOT',
      openTime,
      closeTime,
      open: open.toFixed(8),
      high: high.toFixed(8),
      low: low.toFixed(8),
      close: close.toFixed(8),
      volume: (1000 + Math.random() * 1000).toFixed(8),
      quoteVolume: ((1000 + Math.random() * 1000) * basePrice).toFixed(8),
      trades: Math.floor(100 + Math.random() * 100),
      takerBuyBaseVolume: (500 + Math.random() * 500).toFixed(8),
      takerBuyQuoteVolume: ((500 + Math.random() * 500) * basePrice).toFixed(8),
    });
  }

  return klines;
};

const generateTrendingKlines = (
  symbol: string,
  interval: string,
  count: number,
  startPrice: number,
  endPrice: number,
  startTime: number,
  intervalMs: number
): schema.NewKline[] => {
  const klines: schema.NewKline[] = [];
  const priceStep = (endPrice - startPrice) / count;

  for (let i = 0; i < count; i++) {
    const openTime = new Date(startTime + i * intervalMs);
    const closeTime = new Date(startTime + (i + 1) * intervalMs - 1);

    const baseLinePrice = startPrice + i * priceStep;
    const open = baseLinePrice;
    const close = baseLinePrice + priceStep;
    const high = Math.max(open, close) + Math.abs(priceStep) * 0.2;
    const low = Math.min(open, close) - Math.abs(priceStep) * 0.1;

    klines.push({
      symbol,
      interval,
      marketType: 'SPOT',
      openTime,
      closeTime,
      open: open.toFixed(8),
      high: high.toFixed(8),
      low: low.toFixed(8),
      close: close.toFixed(8),
      volume: (1000 + Math.random() * 1000).toFixed(8),
      quoteVolume: ((1000 + Math.random() * 1000) * open).toFixed(8),
      trades: Math.floor(100 + Math.random() * 100),
      takerBuyBaseVolume: (500 + Math.random() * 500).toFixed(8),
      takerBuyQuoteVolume: ((500 + Math.random() * 500) * open).toFixed(8),
    });
  }

  return klines;
};

describe('Auto-Trading Flow Integration Tests', () => {
  let db: ReturnType<typeof getTestDatabase>;

  beforeAll(async () => {
    await setupTestDatabase();
    db = getTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  afterEach(async () => {
    await db.delete(schema.setupDetections);
    await db.delete(schema.tradeExecutions);
    await db.delete(schema.tradeCooldowns);
    await db.delete(schema.activeWatchers);
    await db.delete(schema.klines);
    await db.delete(schema.autoTradingConfig);
    await db.delete(schema.tradingProfiles);
    await db.delete(schema.wallets);
    await db.delete(schema.sessions);
    await db.delete(schema.users);
    vi.clearAllMocks();
  });

  describe('AutoTradingService', () => {
    it('should calculate position size correctly with fixed sizing', async () => {
      const { AutoTradingService } = await import('../../services/auto-trading');
      const service = new AutoTradingService();

      const config = {
        id: 'config-1',
        userId: 'user-1',
        walletId: 'wallet-1',
        isEnabled: true,
        maxConcurrentPositions: 5,
        maxPositionSize: '10',
        dailyLossLimit: '5',
        enabledSetupTypes: '["larry-williams-9.1"]',
        positionSizing: 'fixed' as const,
        leverage: 1,
        marginType: 'ISOLATED' as const,
        positionMode: 'ONE_WAY' as const,
        useLimitOrders: false,
        useStochasticFilter: false,
        useAdxFilter: false,
        useTrendFilter: false,
        useMtfFilter: false,
        useBtcCorrelationFilter: false,
        useMarketRegimeFilter: false,
        useVolumeFilter: false,
        useFundingFilter: false,
        useConfluenceScoring: false,
        confluenceMinScore: 60,
        maxDrawdownPercent: '15',
        marginTopUpEnabled: false,
        marginTopUpThreshold: '30',
        marginTopUpPercent: '10',
        marginTopUpMaxCount: 3,
        exposureMultiplier: '1.50',
        tpCalculationMode: 'default' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const walletBalance = 10000;
      const entryPrice = 50000;
      const stopLoss = 49000;

      const result = await service.calculatePositionSize(
        config,
        walletBalance,
        entryPrice,
        stopLoss
      );

      expect(result.quantity).toBeGreaterThan(0);
      expect(result.notionalValue).toBeLessThanOrEqual(walletBalance * 0.1);
    });

    it('should validate risk limits correctly', async () => {
      const { AutoTradingService } = await import('../../services/auto-trading');
      const service = new AutoTradingService();

      const config = {
        id: 'config-1',
        userId: 'user-1',
        walletId: 'wallet-1',
        isEnabled: true,
        maxConcurrentPositions: 2,
        maxPositionSize: '10',
        dailyLossLimit: '5',
        enabledSetupTypes: '["larry-williams-9.1"]',
        positionSizing: 'fixed' as const,
        leverage: 1,
        marginType: 'ISOLATED' as const,
        positionMode: 'ONE_WAY' as const,
        useLimitOrders: false,
        useStochasticFilter: false,
        useAdxFilter: false,
        useTrendFilter: false,
        useMtfFilter: false,
        useBtcCorrelationFilter: false,
        useMarketRegimeFilter: false,
        useVolumeFilter: false,
        useFundingFilter: false,
        useConfluenceScoring: false,
        confluenceMinScore: 60,
        maxDrawdownPercent: '15',
        marginTopUpEnabled: false,
        marginTopUpThreshold: '30',
        marginTopUpPercent: '10',
        marginTopUpMaxCount: 3,
        exposureMultiplier: '1.50',
        tpCalculationMode: 'default' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const walletBalance = 10000;
      const positionSize = { quantity: 0.02, notionalValue: 1000, riskAmount: 20 };

      const validResult = service.validateRiskLimits(
        config,
        walletBalance,
        0,
        0,
        positionSize
      );
      expect(validResult.isValid).toBe(true);

      const dailyLossResult = service.validateRiskLimits(
        config,
        walletBalance,
        0,
        -600,
        positionSize
      );
      expect(dailyLossResult.isValid).toBe(false);
      expect(dailyLossResult.reason).toContain('Daily loss limit');

      const oversizeResult = service.validateRiskLimits(
        config,
        walletBalance,
        0,
        0,
        { quantity: 0.1, notionalValue: 5000, riskAmount: 100 }
      );
      expect(oversizeResult.isValid).toBe(false);
      expect(oversizeResult.reason).toContain('exceeds maximum');
    });

    it('should calculate fee viability correctly', async () => {
      const { AutoTradingService } = await import('../../services/auto-trading');
      const service = new AutoTradingService();

      const viableResult = service.calculateFeeViability(
        50000,
        49000,
        53000,
        'SPOT'
      );
      expect(viableResult.isViable).toBe(true);
      expect(viableResult.actualRR).toBeGreaterThan(viableResult.minRR);

      const nonViableResult = service.calculateFeeViability(
        50000,
        49500,
        50100,
        'SPOT'
      );
      expect(nonViableResult.actualRR).toBeLessThan(1);
    });
  });

  describe('CooldownService Integration', () => {
    it('should handle cooldown lifecycle correctly', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });

      await db.insert(schema.autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        enabledSetupTypes: JSON.stringify(['larry-williams-9.1']),
      });

      const { cooldownService } = await import('../../services/cooldown');

      const checkBefore = await cooldownService.checkCooldown(
        'larry-williams-9.1',
        'BTCUSDT',
        '4h',
        wallet.id
      );
      expect(checkBefore.inCooldown).toBe(false);

      await cooldownService.setCooldown(
        'larry-williams-9.1',
        'BTCUSDT',
        '4h',
        wallet.id,
        'test-exec-id',
        15,
        'Test cooldown'
      );

      const checkAfter = await cooldownService.checkCooldown(
        'larry-williams-9.1',
        'BTCUSDT',
        '4h',
        wallet.id
      );
      expect(checkAfter.inCooldown).toBe(true);
      expect(checkAfter.cooldownUntil).toBeDefined();
    });
  });

  describe('PyramidingService Integration', () => {
    it('should evaluate pyramid conditions correctly', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });

      await db.insert(schema.autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        enabledSetupTypes: JSON.stringify(['larry-williams-9.1']),
      });

      await db.insert(schema.tradeExecutions).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        setupType: 'larry-williams-9.1',
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '48000',
        quantity: '0.1',
        stopLoss: '47000',
        takeProfit: '52000',
        openedAt: new Date(),
        status: 'open',
        marketType: 'SPOT',
      });

      const { pyramidingService } = await import('../../services/pyramiding');

      const evalResult = await pyramidingService.evaluatePyramid(
        user.id,
        wallet.id,
        'BTCUSDT',
        'LONG',
        51000,
        0.8
      );

      expect(evalResult).toBeDefined();
      expect(evalResult.currentEntries).toBe(1);
    });
  });

  describe('RiskManagerService Integration', () => {
    it('should validate new positions against risk limits', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });

      const configId = generateEntityId();
      await db.insert(schema.autoTradingConfig).values({
        id: configId,
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        maxPositionSize: '10',
        dailyLossLimit: '5',
        maxConcurrentPositions: 3,
        enabledSetupTypes: JSON.stringify(['larry-williams-9.1']),
      });

      const [config] = await db
        .select()
        .from(schema.autoTradingConfig)
        .where(eq(schema.autoTradingConfig.id, configId))
        .limit(1);

      const { riskManagerService } = await import('../../services/risk-manager');

      const validationResult = await riskManagerService.validateNewPosition(
        wallet.id,
        config!,
        500
      );

      expect(validationResult.isValid).toBe(true);
    });

    it('should reject positions exceeding daily loss limit', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id, initialBalance: '10000' });

      const configId = generateEntityId();
      await db.insert(schema.autoTradingConfig).values({
        id: configId,
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        maxPositionSize: '10',
        dailyLossLimit: '5',
        maxConcurrentPositions: 3,
        enabledSetupTypes: JSON.stringify(['larry-williams-9.1']),
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await db.insert(schema.tradeExecutions).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        setupType: 'larry-williams-9.1',
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        exitPrice: '48000',
        quantity: '0.1',
        pnl: '-600',
        pnlPercent: '-6',
        openedAt: today,
        closedAt: new Date(),
        status: 'closed',
        marketType: 'SPOT',
      });

      const [config] = await db
        .select()
        .from(schema.autoTradingConfig)
        .where(eq(schema.autoTradingConfig.id, configId))
        .limit(1);

      const { riskManagerService } = await import('../../services/risk-manager');

      const validationResult = await riskManagerService.validateNewPosition(
        wallet.id,
        config!,
        500
      );

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.reason?.toLowerCase()).toContain('daily loss');
    });
  });

  describe('Trade Execution Database Operations', () => {
    it('should create and update trade executions correctly', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });

      const executionId = generateEntityId();

      await db.insert(schema.tradeExecutions).values({
        id: executionId,
        userId: user.id,
        walletId: wallet.id,
        setupType: 'larry-williams-9.1',
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        stopLoss: '49000',
        takeProfit: '52000',
        openedAt: new Date(),
        status: 'open',
        marketType: 'SPOT',
      });

      const [execution] = await db
        .select()
        .from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, executionId))
        .limit(1);

      expect(execution).toBeDefined();
      expect(execution!.symbol).toBe('BTCUSDT');
      expect(execution!.side).toBe('LONG');
      expect(execution!.status).toBe('open');

      const exitPrice = 51000;
      const entryPrice = parseFloat(execution!.entryPrice);
      const quantity = parseFloat(execution!.quantity);
      const pnl = (exitPrice - entryPrice) * quantity;
      const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;

      await db
        .update(schema.tradeExecutions)
        .set({
          exitPrice: exitPrice.toString(),
          pnl: pnl.toString(),
          pnlPercent: pnlPercent.toFixed(2),
          closedAt: new Date(),
          status: 'closed',
          exitSource: 'take_profit',
        })
        .where(eq(schema.tradeExecutions.id, executionId));

      const [closedExecution] = await db
        .select()
        .from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, executionId))
        .limit(1);

      expect(closedExecution!.status).toBe('closed');
      expect(parseFloat(closedExecution!.pnl!)).toBeCloseTo(100, 0);
      expect(closedExecution!.exitSource).toBe('take_profit');
    });

    it('should handle stop loss exit correctly', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });

      const executionId = generateEntityId();

      await db.insert(schema.tradeExecutions).values({
        id: executionId,
        userId: user.id,
        walletId: wallet.id,
        setupType: 'larry-williams-9.1',
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.1',
        stopLoss: '49000',
        takeProfit: '52000',
        openedAt: new Date(),
        status: 'open',
        marketType: 'SPOT',
      });

      const exitPrice = 49000;
      const entryPrice = 50000;
      const quantity = 0.1;
      const pnl = (exitPrice - entryPrice) * quantity;
      const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;

      await db
        .update(schema.tradeExecutions)
        .set({
          exitPrice: exitPrice.toString(),
          pnl: pnl.toString(),
          pnlPercent: pnlPercent.toFixed(2),
          closedAt: new Date(),
          status: 'closed',
          exitSource: 'stop_loss',
        })
        .where(eq(schema.tradeExecutions.id, executionId));

      const [closedExecution] = await db
        .select()
        .from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, executionId))
        .limit(1);

      expect(closedExecution!.status).toBe('closed');
      expect(parseFloat(closedExecution!.pnl!)).toBeCloseTo(-100, 0);
      expect(closedExecution!.exitSource).toBe('stop_loss');
    });

    it('should track multiple positions for the same symbol', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });

      await db.insert(schema.tradeExecutions).values([
        {
          id: generateEntityId(),
          userId: user.id,
          walletId: wallet.id,
          setupType: 'larry-williams-9.1',
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: '48000',
          quantity: '0.05',
          stopLoss: '47000',
          takeProfit: '52000',
          openedAt: new Date(Date.now() - 3600000),
          status: 'open',
          marketType: 'SPOT',
        },
        {
          id: generateEntityId(),
          userId: user.id,
          walletId: wallet.id,
          setupType: 'larry-williams-9.1',
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: '49000',
          quantity: '0.05',
          stopLoss: '48000',
          takeProfit: '52000',
          openedAt: new Date(),
          status: 'open',
          marketType: 'SPOT',
        },
      ]);

      const openPositions = await db
        .select()
        .from(schema.tradeExecutions)
        .where(
          and(
            eq(schema.tradeExecutions.walletId, wallet.id),
            eq(schema.tradeExecutions.symbol, 'BTCUSDT'),
            eq(schema.tradeExecutions.status, 'open')
          )
        );

      expect(openPositions.length).toBe(2);

      const totalQuantity = openPositions.reduce(
        (sum, pos) => sum + parseFloat(pos.quantity),
        0
      );
      expect(totalQuantity).toBeCloseTo(0.1, 5);

      const avgEntryPrice = openPositions.reduce(
        (sum, pos) => sum + parseFloat(pos.entryPrice) * parseFloat(pos.quantity),
        0
      ) / totalQuantity;
      expect(avgEntryPrice).toBeCloseTo(48500, 0);
    });
  });

  describe('Setup Detection Database Operations', () => {
    it('should create and query setup detections', async () => {
      const { user } = await createTestUser();

      const setupId = generateEntityId();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.insert(schema.setupDetections).values({
        id: setupId,
        userId: user.id,
        symbol: 'BTCUSDT',
        interval: '4h',
        setupType: 'larry-williams-9.1',
        direction: 'LONG',
        entryPrice: '50000',
        stopLoss: '49000',
        takeProfit: '52000',
        confidence: 75,
        riskReward: '2.0',
        detectedAt: new Date(),
        expiresAt,
      });

      const [detection] = await db
        .select()
        .from(schema.setupDetections)
        .where(eq(schema.setupDetections.id, setupId))
        .limit(1);

      expect(detection).toBeDefined();
      expect(detection!.setupType).toBe('larry-williams-9.1');
      expect(detection!.direction).toBe('LONG');
      expect(detection!.confidence).toBe(75);
    });

    it('should query active setups for user', async () => {
      const { user } = await createTestUser();

      const now = new Date();
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

      await db.insert(schema.setupDetections).values([
        {
          id: generateEntityId(),
          userId: user.id,
          symbol: 'BTCUSDT',
          interval: '4h',
          setupType: 'larry-williams-9.1',
          direction: 'LONG',
          entryPrice: '50000',
          confidence: 75,
          detectedAt: now,
          expiresAt: future,
        },
        {
          id: generateEntityId(),
          userId: user.id,
          symbol: 'ETHUSDT',
          interval: '4h',
          setupType: 'larry-williams-9.2',
          direction: 'SHORT',
          entryPrice: '3000',
          confidence: 80,
          detectedAt: now,
          expiresAt: future,
        },
        {
          id: generateEntityId(),
          userId: user.id,
          symbol: 'SOLUSDT',
          interval: '1h',
          setupType: 'larry-williams-9.1',
          direction: 'LONG',
          entryPrice: '100',
          confidence: 70,
          detectedAt: past,
          expiresAt: past,
        },
      ]);

      const activeSetups = await db
        .select()
        .from(schema.setupDetections)
        .where(
          and(
            eq(schema.setupDetections.userId, user.id),
            eq(schema.setupDetections.viewed, false)
          )
        )
        .orderBy(desc(schema.setupDetections.detectedAt));

      expect(activeSetups.length).toBe(3);
    });
  });

  describe('Klines Data Operations', () => {
    it('should insert and query klines correctly', async () => {
      const symbol = 'BTCUSDT';
      const interval = '4h';
      const intervalMs = 4 * 60 * 60 * 1000;
      const startTime = Date.now() - 50 * intervalMs;

      const testKlines = generateKlineSequence(symbol, interval, 50, 50000, startTime, intervalMs);

      await db.insert(schema.klines).values(testKlines);

      const fetchedKlines = await db
        .select()
        .from(schema.klines)
        .where(
          and(
            eq(schema.klines.symbol, symbol),
            eq(schema.klines.interval, interval)
          )
        )
        .orderBy(desc(schema.klines.openTime))
        .limit(50);

      expect(fetchedKlines.length).toBe(50);
      expect(fetchedKlines[0]!.symbol).toBe(symbol);
      expect(fetchedKlines[0]!.interval).toBe(interval);
    });

    it('should handle trending klines data', async () => {
      const symbol = 'ETHUSDT';
      const interval = '1h';
      const intervalMs = 60 * 60 * 1000;
      const startTime = Date.now() - 100 * intervalMs;

      const trendingKlines = generateTrendingKlines(
        symbol,
        interval,
        100,
        3000,
        3500,
        startTime,
        intervalMs
      );

      await db.insert(schema.klines).values(trendingKlines);

      const fetchedKlines = await db
        .select()
        .from(schema.klines)
        .where(
          and(
            eq(schema.klines.symbol, symbol),
            eq(schema.klines.interval, interval)
          )
        )
        .orderBy(schema.klines.openTime);

      expect(fetchedKlines.length).toBe(100);

      const firstPrice = parseFloat(fetchedKlines[0]!.close);
      const lastPrice = parseFloat(fetchedKlines[99]!.close);
      expect(lastPrice).toBeGreaterThan(firstPrice);
    });
  });

  describe('Active Watchers Persistence', () => {
    it('should persist and restore active watchers', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id });
      const profile = await createTestTradingProfile({
        userId: user.id,
        enabledSetupTypes: ['larry-williams-9.1'],
      });

      await db.insert(schema.autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        enabledSetupTypes: JSON.stringify(['larry-williams-9.1']),
      });

      const watcherId = `${wallet.id}-BTCUSDT-4h-SPOT`;

      await db.insert(schema.activeWatchers).values({
        id: watcherId,
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        interval: '4h',
        marketType: 'SPOT',
        profileId: profile.id,
        startedAt: new Date(),
      });

      const [persistedWatcher] = await db
        .select()
        .from(schema.activeWatchers)
        .where(eq(schema.activeWatchers.id, watcherId))
        .limit(1);

      expect(persistedWatcher).toBeDefined();
      expect(persistedWatcher!.symbol).toBe('BTCUSDT');
      expect(persistedWatcher!.interval).toBe('4h');
      expect(persistedWatcher!.profileId).toBe(profile.id);

      const allWatchers = await db
        .select()
        .from(schema.activeWatchers)
        .where(eq(schema.activeWatchers.walletId, wallet.id));

      expect(allWatchers.length).toBe(1);
    });
  });

  describe('Full Trading Cycle Simulation', () => {
    it('should complete a full trading cycle from detection to close', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id, initialBalance: '10000' });

      await db.insert(schema.autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        maxPositionSize: '10',
        dailyLossLimit: '5',
        maxConcurrentPositions: 3,
        enabledSetupTypes: JSON.stringify(['larry-williams-9.1']),
      });

      const setupId = generateEntityId();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.insert(schema.setupDetections).values({
        id: setupId,
        userId: user.id,
        symbol: 'BTCUSDT',
        interval: '4h',
        setupType: 'larry-williams-9.1',
        direction: 'LONG',
        entryPrice: '50000',
        stopLoss: '49000',
        takeProfit: '52000',
        confidence: 75,
        riskReward: '2.0',
        detectedAt: new Date(),
        expiresAt,
      });

      const executionId = generateEntityId();
      const entryPrice = 50000;
      const quantity = 0.02;

      await db.insert(schema.tradeExecutions).values({
        id: executionId,
        userId: user.id,
        walletId: wallet.id,
        setupId,
        setupType: 'larry-williams-9.1',
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: entryPrice.toString(),
        quantity: quantity.toFixed(8),
        stopLoss: '49000',
        takeProfit: '52000',
        openedAt: new Date(),
        status: 'open',
        marketType: 'SPOT',
      });

      const [openExecution] = await db
        .select()
        .from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, executionId))
        .limit(1);

      expect(openExecution!.status).toBe('open');
      expect(openExecution!.setupId).toBe(setupId);

      const exitPrice = 52000;
      const pnl = (exitPrice - entryPrice) * quantity;
      const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
      const fees = (entryPrice * quantity * 0.001) + (exitPrice * quantity * 0.001);

      await db
        .update(schema.tradeExecutions)
        .set({
          exitPrice: exitPrice.toString(),
          pnl: pnl.toString(),
          pnlPercent: pnlPercent.toFixed(2),
          fees: fees.toFixed(8),
          closedAt: new Date(),
          status: 'closed',
          exitSource: 'take_profit',
        })
        .where(eq(schema.tradeExecutions.id, executionId));

      const [closedExecution] = await db
        .select()
        .from(schema.tradeExecutions)
        .where(eq(schema.tradeExecutions.id, executionId))
        .limit(1);

      expect(closedExecution!.status).toBe('closed');
      expect(parseFloat(closedExecution!.pnl!)).toBeCloseTo(40, 0);
      expect(parseFloat(closedExecution!.pnlPercent!)).toBeCloseTo(4, 0);
      expect(closedExecution!.exitSource).toBe('take_profit');

      const newBalance = parseFloat(wallet.currentBalance!) + pnl - fees;

      await db
        .update(schema.wallets)
        .set({ currentBalance: newBalance.toFixed(8) })
        .where(eq(schema.wallets.id, wallet.id));

      const [updatedWallet] = await db
        .select()
        .from(schema.wallets)
        .where(eq(schema.wallets.id, wallet.id))
        .limit(1);

      expect(parseFloat(updatedWallet!.currentBalance!)).toBeGreaterThan(10000);
    });

    it('should handle multiple setups in sequence with cooldown', async () => {
      const { user } = await createTestUser();
      const wallet = await createTestWallet({ userId: user.id, initialBalance: '10000' });

      await db.insert(schema.autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        enabledSetupTypes: JSON.stringify(['larry-williams-9.1']),
      });

      const exec1Id = generateEntityId();
      await db.insert(schema.tradeExecutions).values({
        id: exec1Id,
        userId: user.id,
        walletId: wallet.id,
        setupType: 'larry-williams-9.1',
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        quantity: '0.02',
        stopLoss: '49000',
        takeProfit: '52000',
        openedAt: new Date(),
        status: 'open',
        marketType: 'SPOT',
      });

      const { cooldownService } = await import('../../services/cooldown');

      await cooldownService.setCooldown(
        'larry-williams-9.1',
        'BTCUSDT',
        '4h',
        wallet.id,
        exec1Id,
        15,
        'Trade executed'
      );

      const cooldownCheck = await cooldownService.checkCooldown(
        'larry-williams-9.1',
        'BTCUSDT',
        '4h',
        wallet.id
      );

      expect(cooldownCheck.inCooldown).toBe(true);

      await db
        .update(schema.tradeExecutions)
        .set({
          exitPrice: '51000',
          pnl: '20',
          pnlPercent: '2',
          closedAt: new Date(),
          status: 'closed',
          exitSource: 'take_profit',
        })
        .where(eq(schema.tradeExecutions.id, exec1Id));

      await db
        .delete(schema.tradeCooldowns)
        .where(eq(schema.tradeCooldowns.walletId, wallet.id));

      const cooldownAfterClear = await cooldownService.checkCooldown(
        'larry-williams-9.1',
        'BTCUSDT',
        '4h',
        wallet.id
      );

      expect(cooldownAfterClear.inCooldown).toBe(false);
    });
  });
});
