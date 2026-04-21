import { TRPCError } from '@trpc/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ENABLED_SETUPS } from '../../constants';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../helpers/test-db';
import { createAuthenticatedUser, createTestWallet, createTestTradingProfile, createTestActiveWatcher, createTestAutoTradingConfig } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';
import { autoTradingConfig, tradeExecutions, setupDetections, activeWatchers } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateEntityId } from '../../utils/id';

vi.mock('../../services/binance-kline-stream', () => ({
  binanceKlineStreamService: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getActiveSubscriptions: vi.fn().mockReturnValue([]),
  },
  binanceFuturesKlineStreamService: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getActiveSubscriptions: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../../services/kline-prefetch', () => ({
  checkKlineAvailability: vi.fn().mockResolvedValue({
    hasSufficient: true,
    totalAvailable: 5000,
    required: 4500,
    apiExhausted: false,
  }),
  prefetchKlines: vi.fn().mockResolvedValue({
    success: true,
    downloaded: 0,
    totalInDb: 5000,
    gaps: 0,
    alreadyComplete: true,
  }),
  prefetchKlinesAsync: vi.fn(),
}));

vi.mock('../../services/symbol-mapping', () => ({
  getValidBinanceSymbols: vi.fn().mockResolvedValue(['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT']),
  mapAndValidateSymbols: vi.fn().mockResolvedValue(['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT']),
  getAvailableSymbolsSet: vi.fn().mockResolvedValue(new Set(['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'])),
}));

vi.mock('../../services/market-cap-data', () => ({
  getMarketCapDataService: vi.fn(() => ({
    getTopCoinsByMarketCap: vi.fn().mockResolvedValue([
      { symbol: 'BTCUSDT', marketCap: 1000000000000 },
      { symbol: 'ETHUSDT', marketCap: 500000000000 },
      { symbol: 'BNBUSDT', marketCap: 100000000000 },
    ]),
  })),
}));

vi.mock('../../services/opportunity-scoring', () => ({
  getOpportunityScoringService: vi.fn(() => ({
    getSymbolScores: vi.fn().mockResolvedValue([
      { symbol: 'BTCUSDT', score: 85, breakdown: {} },
      { symbol: 'ETHUSDT', score: 80, breakdown: {} },
    ]),
  })),
}));

describe('Auto-Trading Router', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  describe('getConfig', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.getConfig({ walletId: 'test-wallet' })
      ).rejects.toThrow(TRPCError);
    });

    it('should create default config if not exists', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      const config = await caller.autoTrading.getConfig({ walletId: wallet.id });

      expect(config).toBeDefined();
      expect(config.walletId).toBe(wallet.id);
      expect(config.isEnabled).toBe(false);
      expect(config.maxConcurrentPositions).toBe(3);
      expect(parseFloat(config.maxPositionSize as string)).toBe(10);
      expect(config.enabledSetupTypes).toContain(DEFAULT_ENABLED_SETUPS[0]);
    });

    it('should return existing config', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();
      const caller = createAuthenticatedCaller(user, session);

      await db.insert(autoTradingConfig).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
        maxConcurrentPositions: 5,
        maxPositionSize: '20',
        dailyLossLimit: '3',
        enabledSetupTypes: JSON.stringify(['larry-williams-9-1']),
      });

      const config = await caller.autoTrading.getConfig({ walletId: wallet.id });

      expect(config.isEnabled).toBe(true);
      expect(config.maxConcurrentPositions).toBe(5);
      expect(parseFloat(config.maxPositionSize as string)).toBe(20);
      expect(parseFloat(config.dailyLossLimit as string)).toBe(3);
    });

    it('should reject if wallet does not belong to user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2 } = await createAuthenticatedUser({ email: 'user2@test.com' });
      const wallet = await createTestWallet({ userId: user2.id });
      const caller = createAuthenticatedCaller(user1, session1);

      await expect(
        caller.autoTrading.getConfig({ walletId: wallet.id })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('updateConfig', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.updateConfig({ walletId: 'test-wallet', isEnabled: true })
      ).rejects.toThrow(TRPCError);
    });

    it('should update config successfully', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await caller.autoTrading.getConfig({ walletId: wallet.id });

      const testSetups = [DEFAULT_ENABLED_SETUPS[0], DEFAULT_ENABLED_SETUPS[1]];
      const result = await caller.autoTrading.updateConfig({
        walletId: wallet.id,
        isEnabled: true,
        maxConcurrentPositions: 10,
        maxPositionSize: '25',
        dailyLossLimit: '3',
        enabledSetupTypes: [...testSetups],
      });

      expect(result.success).toBe(true);

      const config = await caller.autoTrading.getConfig({ walletId: wallet.id });
      expect(config.isEnabled).toBe(true);
      expect(config.maxConcurrentPositions).toBe(10);
      expect(parseFloat(config.maxPositionSize as string)).toBe(25);
      expect(parseFloat(config.dailyLossLimit as string)).toBe(3);
      expect(config.enabledSetupTypes).toContain(testSetups[0]);
      expect(config.enabledSetupTypes).toContain(testSetups[1]);
    });

    it('should reject if config does not exist', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.autoTrading.updateConfig({ walletId: wallet.id, isEnabled: true })
      ).rejects.toThrow(TRPCError);
    });

    it('should update only specified fields', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await caller.autoTrading.getConfig({ walletId: wallet.id });

      await caller.autoTrading.updateConfig({
        walletId: wallet.id,
        isEnabled: true,
      });

      const config = await caller.autoTrading.getConfig({ walletId: wallet.id });
      expect(config.isEnabled).toBe(true);
      expect(config.maxConcurrentPositions).toBe(3);
    });
  });

  describe('executeSetup', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.executeSetup({ setupId: 'setup-1', walletId: 'wallet-1' })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject if setup not found', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await caller.autoTrading.getConfig({ walletId: wallet.id });

      await expect(
        caller.autoTrading.executeSetup({ setupId: 'nonexistent', walletId: wallet.id })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject if auto-trading not enabled', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();
      const caller = createAuthenticatedCaller(user, session);

      await caller.autoTrading.getConfig({ walletId: wallet.id });

      const setupId = generateEntityId();
      await db.insert(setupDetections).values({
        id: setupId,
        userId: user.id,
        symbol: 'BTCUSDT',
        interval: '1h',
        setupType: 'larry-williams-9-1',
        direction: 'LONG',
        entryPrice: '50000',
        stopLoss: '49000',
        takeProfit: '52000',
        confidence: 80,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await expect(
        caller.autoTrading.executeSetup({ setupId, walletId: wallet.id })
      ).rejects.toThrow('Auto-trading is not enabled');
    });

    it('should reject if setup type not enabled', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();
      const caller = createAuthenticatedCaller(user, session);

      await caller.autoTrading.getConfig({ walletId: wallet.id });
      await caller.autoTrading.updateConfig({
        walletId: wallet.id,
        isEnabled: true,
        enabledSetupTypes: ['larry-williams-9-2'],
      });

      const setupId = generateEntityId();
      await db.insert(setupDetections).values({
        id: setupId,
        userId: user.id,
        symbol: 'BTCUSDT',
        interval: '1h',
        setupType: 'larry-williams-9-1',
        direction: 'LONG',
        entryPrice: '50000',
        stopLoss: '49000',
        takeProfit: '52000',
        confidence: 80,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await expect(
        caller.autoTrading.executeSetup({ setupId, walletId: wallet.id })
      ).rejects.toThrow('is not enabled');
    });

    it('should reject if missing stop loss', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();
      const caller = createAuthenticatedCaller(user, session);

      await caller.autoTrading.getConfig({ walletId: wallet.id });
      await caller.autoTrading.updateConfig({
        walletId: wallet.id,
        isEnabled: true,
        enabledSetupTypes: ['larry-williams-9-1'],
      });

      const setupId = generateEntityId();
      await db.insert(setupDetections).values({
        id: setupId,
        userId: user.id,
        symbol: 'BTCUSDT',
        interval: '1h',
        setupType: 'larry-williams-9-1',
        direction: 'LONG',
        entryPrice: '50000',
        takeProfit: '52000',
        confidence: 80,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await expect(
        caller.autoTrading.executeSetup({ setupId, walletId: wallet.id })
      ).rejects.toThrow('Stop loss is required');
    });

    it('should reject if risk/reward ratio too low', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();
      const caller = createAuthenticatedCaller(user, session);

      await caller.autoTrading.getConfig({ walletId: wallet.id });
      await caller.autoTrading.updateConfig({
        walletId: wallet.id,
        isEnabled: true,
        enabledSetupTypes: ['larry-williams-9-1'],
      });

      const setupId = generateEntityId();
      await db.insert(setupDetections).values({
        id: setupId,
        userId: user.id,
        symbol: 'BTCUSDT',
        interval: '1h',
        setupType: 'larry-williams-9-1',
        direction: 'LONG',
        entryPrice: '50000',
        stopLoss: '49000',
        takeProfit: '50500',
        confidence: 80,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await expect(
        caller.autoTrading.executeSetup({ setupId, walletId: wallet.id })
      ).rejects.toThrow('below minimum required');
    });

    it('should create execution for valid setup', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();
      const caller = createAuthenticatedCaller(user, session);

      await caller.autoTrading.getConfig({ walletId: wallet.id });
      await caller.autoTrading.updateConfig({
        walletId: wallet.id,
        isEnabled: true,
        enabledSetupTypes: ['larry-williams-9-1'],
      });

      const setupId = generateEntityId();
      await db.insert(setupDetections).values({
        id: setupId,
        userId: user.id,
        symbol: 'BTCUSDT',
        interval: '1h',
        setupType: 'larry-williams-9-1',
        direction: 'LONG',
        entryPrice: '50000',
        stopLoss: '49000',
        takeProfit: '53000',
        confidence: 80,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const result = await caller.autoTrading.executeSetup({ setupId, walletId: wallet.id });

      expect(result.executionId).toBeDefined();
      expect(result.message).toContain('successfully');

      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, result.executionId));

      expect(execution).toBeDefined();
      expect(execution!.symbol).toBe('BTCUSDT');
      expect(execution!.side).toBe('LONG');
      expect(execution!.status).toBe('open');
    });
  });

  describe('cancelExecution', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.cancelExecution({ executionId: 'exec-1' })
      ).rejects.toThrow(TRPCError);
    });

    it('should cancel open execution', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();
      const caller = createAuthenticatedCaller(user, session);

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
        openedAt: new Date(),
      });

      const result = await caller.autoTrading.cancelExecution({ executionId });

      expect(result.success).toBe(true);

      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId));

      expect(execution!.status).toBe('cancelled');
    });

    it('should reject if execution not found', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.autoTrading.cancelExecution({ executionId: 'nonexistent' })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject if execution not open', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();
      const caller = createAuthenticatedCaller(user, session);

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
        openedAt: new Date(),
        closedAt: new Date(),
      });

      await expect(
        caller.autoTrading.cancelExecution({ executionId })
      ).rejects.toThrow('Can only cancel open executions');
    });
  });

  describe('getActiveExecutions', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.getActiveExecutions({ walletId: 'wallet-1' })
      ).rejects.toThrow(TRPCError);
    });

    it('should return active executions', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();
      const caller = createAuthenticatedCaller(user, session);

      await db.insert(tradeExecutions).values([
        {
          id: generateEntityId(),
          userId: user.id,
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: '50000',
          quantity: '0.1',
          status: 'open',
          openedAt: new Date(),
        },
        {
          id: generateEntityId(),
          userId: user.id,
          walletId: wallet.id,
          symbol: 'ETHUSDT',
          side: 'SHORT',
          entryPrice: '3000',
          quantity: '1',
          status: 'open',
          openedAt: new Date(),
        },
        {
          id: generateEntityId(),
          userId: user.id,
          walletId: wallet.id,
          symbol: 'XRPUSDT',
          side: 'LONG',
          entryPrice: '1',
          quantity: '1000',
          status: 'closed',
          openedAt: new Date(),
          closedAt: new Date(),
        },
      ]);

      const executions = await caller.autoTrading.getActiveExecutions({ walletId: wallet.id });

      expect(executions.length).toBe(2);
    });
  });

  describe('getExecutionHistory', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.getExecutionHistory({ walletId: 'wallet-1' })
      ).rejects.toThrow(TRPCError);
    });

    it('should return execution history with filters', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();
      const caller = createAuthenticatedCaller(user, session);

      await db.insert(tradeExecutions).values([
        {
          id: generateEntityId(),
          userId: user.id,
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: '50000',
          quantity: '0.1',
          status: 'open',
          openedAt: new Date(),
        },
        {
          id: generateEntityId(),
          userId: user.id,
          walletId: wallet.id,
          symbol: 'ETHUSDT',
          side: 'LONG',
          entryPrice: '3000',
          quantity: '1',
          status: 'closed',
          openedAt: new Date(),
          closedAt: new Date(),
        },
      ]);

      const allExecutions = await caller.autoTrading.getExecutionHistory({ walletId: wallet.id });
      expect(allExecutions.length).toBe(2);

      const closedExecutions = await caller.autoTrading.getExecutionHistory({
        walletId: wallet.id,
        status: 'closed',
      });
      expect(closedExecutions.length).toBe(1);
      expect(closedExecutions[0]!.symbol).toBe('ETHUSDT');
    });
  });

  describe('closeExecution', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.closeExecution({ executionId: 'exec-1', exitPrice: '51000' })
      ).rejects.toThrow(TRPCError);
    });

    it('should close execution and calculate PnL', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();
      const caller = createAuthenticatedCaller(user, session);

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
        openedAt: new Date(),
      });

      const result = await caller.autoTrading.closeExecution({
        executionId,
        exitPrice: '51000',
      });

      expect(result.pnl).toBeDefined();
      expect(parseFloat(result.pnlPercent)).toBeCloseTo(1.92, 1);

      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId));

      expect(execution!.status).toBe('closed');
      expect(parseFloat(execution!.exitPrice!)).toBe(51000);
    });

    it('should calculate PnL correctly for SHORT position', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();
      const caller = createAuthenticatedCaller(user, session);

      const executionId = generateEntityId();
      await db.insert(tradeExecutions).values({
        id: executionId,
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'SHORT',
        entryPrice: '50000',
        quantity: '0.1',
        status: 'open',
        openedAt: new Date(),
      });

      const result = await caller.autoTrading.closeExecution({
        executionId,
        exitPrice: '49000',
      });

      expect(parseFloat(result.pnlPercent)).toBeCloseTo(1.92, 1);
    });

    it('should reject if execution not found', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.autoTrading.closeExecution({ executionId: 'nonexistent', exitPrice: '51000' })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject if execution not open', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();
      const caller = createAuthenticatedCaller(user, session);

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
        openedAt: new Date(),
        closedAt: new Date(),
      });

      await expect(
        caller.autoTrading.closeExecution({ executionId, exitPrice: '51000' })
      ).rejects.toThrow('Execution is not open');
    });
  });

  describe('getWatcherStatus', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.getWatcherStatus({ walletId: 'wallet-1' })
      ).rejects.toThrow(TRPCError);
    });

    it('should return watcher status', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      const status = await caller.autoTrading.getWatcherStatus({ walletId: wallet.id });

      expect(status).toBeDefined();
      expect(status.active).toBeDefined();
      expect(status.watchers).toBeDefined();
    });

    it('should include database watchers in status', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const profile = await createTestTradingProfile({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await createTestActiveWatcher({
        userId: user.id,
        walletId: wallet.id,
        profileId: profile.id,
        symbol: 'BTCUSDT',
        interval: '1h',
      });

      const status = await caller.autoTrading.getWatcherStatus({ walletId: wallet.id });

      expect(status.watchers).toBeDefined();
    });
  });

  describe('startWatcher', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.startWatcher({
          walletId: 'wallet-1',
          symbol: 'BTCUSDT',
          interval: '1h',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject if wallet not found', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.autoTrading.startWatcher({
          walletId: 'nonexistent',
          symbol: 'BTCUSDT',
          interval: '1h',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject if wallet does not belong to user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2 } = await createAuthenticatedUser({ email: 'user2@test.com' });
      const wallet = await createTestWallet({ userId: user2.id });
      const caller = createAuthenticatedCaller(user1, session1);

      await expect(
        caller.autoTrading.startWatcher({
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          interval: '1h',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should start watcher and create database entry', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const profile = await createTestTradingProfile({ userId: user.id });
      const db = getTestDatabase();
      const caller = createAuthenticatedCaller(user, session);

      await createTestAutoTradingConfig({
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
      });

      const result = await caller.autoTrading.startWatcher({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        interval: '1h',
        profileId: profile.id,
      });

      expect(result.success).toBe(true);

      const watchers = await db
        .select()
        .from(activeWatchers)
        .where(eq(activeWatchers.walletId, wallet.id));

      expect(watchers.length).toBe(1);
      expect(watchers[0]!.symbol).toBe('BTCUSDT');
      expect(watchers[0]!.interval).toBe('1h');
    });
  });

  describe('stopWatcher', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.stopWatcher({
          walletId: 'wallet-1',
          symbol: 'BTCUSDT',
          interval: '1h',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should stop watcher successfully', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await createTestActiveWatcher({
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        interval: '1h',
      });

      const result = await caller.autoTrading.stopWatcher({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        interval: '1h',
      });

      expect(result.success).toBe(true);
    });

    it('should reject if wallet not found', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.autoTrading.stopWatcher({
          walletId: 'nonexistent',
          symbol: 'BTCUSDT',
          interval: '1h',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('stopAllWatchers', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.stopAllWatchers({ walletId: 'wallet-1' })
      ).rejects.toThrow(TRPCError);
    });

    it('should stop all watchers for wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();
      const caller = createAuthenticatedCaller(user, session);

      await createTestActiveWatcher({
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        interval: '1h',
      });

      await createTestActiveWatcher({
        userId: user.id,
        walletId: wallet.id,
        symbol: 'ETHUSDT',
        interval: '1h',
      });

      const result = await caller.autoTrading.stopAllWatchers({ walletId: wallet.id });

      expect(result.success).toBe(true);

      const watchers = await db
        .select()
        .from(activeWatchers)
        .where(eq(activeWatchers.walletId, wallet.id));

      expect(watchers.length).toBe(0);
    });

    it('should not affect other users watchers', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2 } = await createAuthenticatedUser({ email: 'user2@test.com' });
      const wallet1 = await createTestWallet({ userId: user1.id });
      const wallet2 = await createTestWallet({ userId: user2.id });
      const db = getTestDatabase();
      const caller = createAuthenticatedCaller(user1, session1);

      await createTestActiveWatcher({
        userId: user1.id,
        walletId: wallet1.id,
        symbol: 'BTCUSDT',
        interval: '1h',
      });

      await createTestActiveWatcher({
        userId: user2.id,
        walletId: wallet2.id,
        symbol: 'ETHUSDT',
        interval: '1h',
      });

      await caller.autoTrading.stopAllWatchers({ walletId: wallet1.id });

      const user2Watchers = await db
        .select()
        .from(activeWatchers)
        .where(eq(activeWatchers.walletId, wallet2.id));

      expect(user2Watchers.length).toBe(1);
    });
  });

  describe('getTopSymbols', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.getTopSymbols({ limit: 10 })
      ).rejects.toThrow(TRPCError);
    });

    it.skipIf(process.env.CI)('should return symbols list', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.autoTrading.getTopSymbols({ limit: 10 });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('startWatchersBulk', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.startWatchersBulk({
          walletId: 'wallet-1',
          symbols: ['BTCUSDT', 'ETHUSDT'],
          interval: '1h',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject if wallet not found', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.autoTrading.startWatchersBulk({
          walletId: 'nonexistent',
          symbols: ['BTCUSDT'],
          interval: '1h',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('getRotationHistory', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.getRotationHistory({ walletId: 'wallet-1' })
      ).rejects.toThrow(TRPCError);
    });

    it('should return rotation history object', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.autoTrading.getRotationHistory({ walletId: wallet.id });

      expect(result).toBeDefined();
      expect(result.history).toBeDefined();
      expect(Array.isArray(result.history)).toBe(true);
      expect(result.isActive).toBeDefined();
    });
  });

  describe('getRotationStatus', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.getRotationStatus({ walletId: 'wallet-1' })
      ).rejects.toThrow(TRPCError);
    });

    it('should return rotation status', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.autoTrading.getRotationStatus({ walletId: wallet.id });

      expect(result).toBeDefined();
    });
  });

  describe('getBtcTrendStatus', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.autoTrading.getBtcTrendStatus()).rejects.toThrow(TRPCError);
    });

    it('should return BTC trend status', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.autoTrading.getBtcTrendStatus();

      expect(result).toBeDefined();
      expect(typeof result.trend).toBe('string');
    });
  });

  describe('emergencyStop', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.emergencyStop({ walletId: 'wallet-1' })
      ).rejects.toThrow(TRPCError);
    });

    it('should stop all trading activity', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const db = getTestDatabase();
      const caller = createAuthenticatedCaller(user, session);

      await createTestAutoTradingConfig({
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
      });

      await createTestActiveWatcher({
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        interval: '1h',
      });

      const result = await caller.autoTrading.emergencyStop({ walletId: wallet.id });

      expect(result.success).toBe(true);

      const watchers = await db
        .select()
        .from(activeWatchers)
        .where(eq(activeWatchers.walletId, wallet.id));

      expect(watchers.length).toBe(0);

      const [config] = await db
        .select()
        .from(autoTradingConfig)
        .where(eq(autoTradingConfig.walletId, wallet.id));

      expect(config!.isEnabled).toBe(false);
    });

    it('should reject if wallet not found', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.autoTrading.emergencyStop({ walletId: 'nonexistent' })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('triggerSymbolRotation', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.triggerSymbolRotation({ walletId: 'wallet-1' })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject if wallet not found', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.autoTrading.triggerSymbolRotation({ walletId: 'nonexistent' })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject if dynamic symbol selection not enabled', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await createTestAutoTradingConfig({
        userId: user.id,
        walletId: wallet.id,
        isEnabled: true,
      });

      await expect(
        caller.autoTrading.triggerSymbolRotation({ walletId: wallet.id })
      ).rejects.toThrow('Dynamic symbol selection is not enabled');
    });
  });

  describe('getDynamicSymbolScores', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.getDynamicSymbolScores({ limit: 10 })
      ).rejects.toThrow(TRPCError);
    });

    it('should return scores array', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.autoTrading.getDynamicSymbolScores({ limit: 10 });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getTopCoinsByMarketCap', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.getTopCoinsByMarketCap({ limit: 10 })
      ).rejects.toThrow(TRPCError);
    });

    it('should return list of coins', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.autoTrading.getTopCoinsByMarketCap({ limit: 10 });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getBatchFundingRates', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.autoTrading.getBatchFundingRates({ symbols: ['BTCUSDT'] })
      ).rejects.toThrow(TRPCError);
    });

    it('should return funding rates object', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.autoTrading.getBatchFundingRates({ symbols: ['BTCUSDT', 'ETHUSDT'] });

      expect(typeof result).toBe('object');
    });
  });
});
