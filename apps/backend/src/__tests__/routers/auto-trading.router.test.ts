import { TRPCError } from '@trpc/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../helpers/test-db';
import { createAuthenticatedUser, createTestWallet } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';
import { autoTradingConfig, tradeExecutions, setupDetections } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateEntityId } from '../../utils/id';

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
      expect(config.enabledSetupTypes).toContain('larry-williams-9-1');
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

      const result = await caller.autoTrading.updateConfig({
        walletId: wallet.id,
        isEnabled: true,
        maxConcurrentPositions: 10,
        maxPositionSize: '25',
        dailyLossLimit: '3',
        enabledSetupTypes: ['larry-williams-9-1', 'larry-williams-9-2'],
      });

      expect(result.success).toBe(true);

      const config = await caller.autoTrading.getConfig({ walletId: wallet.id });
      expect(config.isEnabled).toBe(true);
      expect(config.maxConcurrentPositions).toBe(10);
      expect(parseFloat(config.maxPositionSize as string)).toBe(25);
      expect(parseFloat(config.dailyLossLimit as string)).toBe(3);
      expect(config.enabledSetupTypes).toContain('larry-williams-9-1');
      expect(config.enabledSetupTypes).toContain('larry-williams-9-2');
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
      expect(parseFloat(result.pnlPercent)).toBeCloseTo(2, 1);

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

      expect(parseFloat(result.pnlPercent)).toBeCloseTo(2, 1);
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
  });
});
