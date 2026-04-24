import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tradeExecutions } from '../../db/schema';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';
import { cleanupTables, getTestDatabase, setupTestDatabase, teardownTestDatabase } from '../helpers/test-db';
import { createAuthenticatedUser, createTestTradeExecution, createTestWallet } from '../helpers/test-fixtures';

describe('Trading Router', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  describe('createOrder', () => {
    it('should create a market order for paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.trading.createOrder({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: '0.001',
      });

      expect(result.orderId).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.side).toBe('BUY');
      expect(result.type).toBe('MARKET');
      expect(result.status).toBe('FILLED');
    });

    it('should create a limit order for paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.trading.createOrder({
        walletId: wallet.id,
        symbol: 'ETHUSDT',
        side: 'SELL',
        type: 'LIMIT',
        quantity: '0.1',
        price: '2500.00',
      });

      expect(result.orderId).toBeDefined();
      expect(result.symbol).toBe('ETHUSDT');
      expect(result.side).toBe('SELL');
      expect(result.type).toBe('LIMIT');
      expect(result.status).toBe('NEW');
    });

    it('should reject order for inactive wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await caller.wallet.update({
        id: wallet.id,
        isActive: false,
      });

      await expect(
        caller.trading.createOrder({
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'MARKET',
          quantity: '0.001',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should not allow creating order for another user wallet', async () => {
      const { user: user1, session: _session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const wallet = await createTestWallet({ userId: user1.id, walletType: 'paper' });
      const caller2 = createAuthenticatedCaller(user2, session2);

      await expect(
        caller2.trading.createOrder({
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'MARKET',
          quantity: '0.001',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.trading.createOrder({
          walletId: 'wallet-id',
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'MARKET',
          quantity: '0.001',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('getOrders', () => {
    it('should return orders for wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await caller.trading.createOrder({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: '0.001',
      });

      await caller.trading.createOrder({
        walletId: wallet.id,
        symbol: 'ETHUSDT',
        side: 'SELL',
        type: 'LIMIT',
        quantity: '0.1',
        price: '2500.00',
      });

      const orders = await caller.trading.getOrders({ walletId: wallet.id });

      expect(orders.length).toBe(2);
    });

    it('should filter orders by symbol', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await caller.trading.createOrder({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: '0.001',
      });

      await caller.trading.createOrder({
        walletId: wallet.id,
        symbol: 'ETHUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: '0.1',
      });

      const orders = await caller.trading.getOrders({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
      });

      expect(orders.length).toBe(1);
      expect(orders[0]!.symbol).toBe('BTCUSDT');
    });

    it('should respect limit parameter', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      for (let i = 0; i < 5; i++) {
        await caller.trading.createOrder({
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'MARKET',
          quantity: '0.001',
        });
      }

      const orders = await caller.trading.getOrders({
        walletId: wallet.id,
        limit: 3,
      });

      expect(orders.length).toBe(3);
    });
  });

  describe('getOrderById', () => {
    it('should return specific order', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const created = await caller.trading.createOrder({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: '0.001',
      });

      const order = await caller.trading.getOrderById({
        walletId: wallet.id,
        orderId: created.orderId,
      });

      expect(order.orderId).toBe(created.orderId);
      expect(order.symbol).toBe('BTCUSDT');
    });

    it('should throw NOT_FOUND for non-existent order', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.trading.getOrderById({
          walletId: wallet.id,
          orderId: '999999999',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('cancelOrder', () => {
    it('should cancel a pending order for paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const created = await caller.trading.createOrder({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.001',
        price: '50000.00',
      });

      const result = await caller.trading.cancelOrder({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        orderId: created.orderId,
      });

      expect(result.status).toBe('CANCELED');
    });
  });

  describe('syncOrders', () => {
    it('should return message for paper wallets', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.trading.syncOrders({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
      });

      expect(result.synced).toBe(0);
      expect(result.message).toBeDefined();
    });
  });

  describe('createPosition', () => {
    it('should create a LONG position', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.trading.createPosition({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        entryQty: '0.1',
        stopLoss: '45000',
        takeProfit: '60000',
      });

      expect(result.id).toBeDefined();
    });

    it('should create a SHORT position', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.trading.createPosition({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'SHORT',
        entryPrice: '50000',
        entryQty: '0.1',
        stopLoss: '55000',
        takeProfit: '40000',
      });

      expect(result.id).toBeDefined();
    });

    it('should reject position with insufficient risk/reward ratio', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.trading.createPosition({
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: '50000',
          entryQty: '0.1',
          stopLoss: '48000',
          takeProfit: '51000',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject invalid stop loss for LONG', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.trading.createPosition({
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: '50000',
          entryQty: '0.1',
          stopLoss: '55000',
          takeProfit: '60000',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('getPositions', () => {
    it('should return positions for wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await caller.trading.createPosition({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        entryQty: '0.1',
      });

      const positions = await caller.trading.getPositions({ walletId: wallet.id });

      expect(positions.length).toBe(1);
      expect(positions[0]!.symbol).toBe('BTCUSDT');
      expect(positions[0]!.side).toBe('LONG');
    });

    it('should filter by status', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await caller.trading.createPosition({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        entryQty: '0.1',
      });

      const openPositions = await caller.trading.getPositions({
        walletId: wallet.id,
        status: 'open',
      });

      const closedPositions = await caller.trading.getPositions({
        walletId: wallet.id,
        status: 'closed',
      });

      expect(openPositions.length).toBe(1);
      expect(closedPositions.length).toBe(0);
    });
  });

  describe('closePosition', () => {
    it('should close an open position (paper trading)', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const { id } = await caller.trading.createPosition({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        entryQty: '0.1',
      });

      const result = await caller.trading.closePosition({
        id,
        exitPrice: '55000',
      });

      expect(result.pnl).toBeDefined();
      expect(parseFloat(result.pnl)).toBeGreaterThan(0);
    });

    it('should calculate negative PnL for losing position', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const { id } = await caller.trading.createPosition({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        entryQty: '0.1',
      });

      const result = await caller.trading.closePosition({
        id,
        exitPrice: '45000',
      });

      expect(parseFloat(result.grossPnl)).toBeLessThan(0);
    });

    it('should throw NOT_FOUND for non-existent position', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.trading.closePosition({
          id: 'non-existent-id',
          exitPrice: '50000',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should not close already closed position', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const { id } = await caller.trading.createPosition({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        entryQty: '0.1',
      });

      await caller.trading.closePosition({
        id,
        exitPrice: '55000',
      });

      await expect(
        caller.trading.closePosition({
          id,
          exitPrice: '56000',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('setFuturesLeverage', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.trading.setFuturesLeverage({
          walletId: 'wallet-id',
          symbol: 'BTCUSDT',
          leverage: 10,
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('setFuturesMarginType', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.trading.setFuturesMarginType({
          walletId: 'wallet-id',
          symbol: 'BTCUSDT',
          marginType: 'ISOLATED',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('getFuturesAccountInfo', () => {
    it('should return simulated info for paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'paper',
        initialBalance: '10000',
      });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.trading.getFuturesAccountInfo({
        walletId: wallet.id,
      });

      expect(parseFloat(result.totalWalletBalance as string)).toBe(10000);
      expect(parseFloat(result.availableBalance as string)).toBe(10000);
      expect(result.positions).toEqual([]);
    });
  });

  describe('getTradeExecutions', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.trading.getTradeExecutions({ walletId: 'wallet-id' })
      ).rejects.toThrow(TRPCError);
    });

    it('should return trade executions for wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        status: 'open',
      });

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        symbol: 'ETHUSDT',
        status: 'closed',
      });

      const executions = await caller.trading.getTradeExecutions({
        walletId: wallet.id,
      });

      expect(executions.length).toBe(2);
    });

    it('should filter by status', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'open',
      });

      await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
      });

      const openExecutions = await caller.trading.getTradeExecutions({
        walletId: wallet.id,
        status: 'open',
      });

      expect(openExecutions.length).toBe(1);
      expect(openExecutions[0]!.status).toBe('open');
    });

    it('should return empty array for nonexistent wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.trading.getTradeExecutions({ walletId: 'nonexistent' });

      expect(result).toEqual([]);
    });
  });

  describe('closeTradeExecution', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.trading.closeTradeExecution({ id: 'exec-1', exitPrice: '50000' })
      ).rejects.toThrow(TRPCError);
    });

    it('should close an open trade execution', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      const execution = await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '48000',
        quantity: '0.1',
        status: 'open',
      });

      const result = await caller.trading.closeTradeExecution({
        id: execution.id,
        exitPrice: '50000',
      });

      expect(result.pnl).toBeDefined();
      expect(result.exitPrice).toBe('50000');

      const [closedExecution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, execution.id))
        .limit(1);

      expect(closedExecution!.status).toBe('closed');
    });

    it('should reject if execution not found', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.trading.closeTradeExecution({ id: 'nonexistent', exitPrice: '50000' })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject if execution already closed', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      const execution = await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'closed',
      });

      await expect(
        caller.trading.closeTradeExecution({ id: execution.id, exitPrice: '50000' })
      ).rejects.toThrow('not open');
    });
  });

  describe('cancelTradeExecution', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.trading.cancelTradeExecution({ id: 'exec-1' })
      ).rejects.toThrow(TRPCError);
    });

    it('should cancel a pending trade execution', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      const execution = await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'pending',
      });

      const result = await caller.trading.cancelTradeExecution({
        id: execution.id,
      });

      expect(result.success).toBe(true);

      const [cancelledExecution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, execution.id))
        .limit(1);

      expect(cancelledExecution!.status).toBe('cancelled');
    });

    it('should reject if execution not found', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.trading.cancelTradeExecution({ id: 'nonexistent' })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('updateTradeExecutionSLTP', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.trading.updateTradeExecutionSLTP({ id: 'exec-1', stopLoss: 45000 })
      ).rejects.toThrow(TRPCError);
    });

    it('should update stop loss and take profit', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      const execution = await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        stopLoss: '48000',
        takeProfit: '55000',
        status: 'open',
      });

      const result = await caller.trading.updateTradeExecutionSLTP({
        id: execution.id,
        stopLoss: 47000,
        takeProfit: 58000,
      });

      expect(result.success).toBe(true);

      const [updated] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, execution.id))
        .limit(1);

      expect(parseFloat(updated!.stopLoss!)).toBe(47000);
      expect(parseFloat(updated!.takeProfit!)).toBe(58000);
    });

    it('should reject if execution not found', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.trading.updateTradeExecutionSLTP({
          id: 'nonexistent',
          stopLoss: 45000,
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('getTickerPrices', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.trading.getTickerPrices({ symbols: ['BTCUSDT'] })
      ).rejects.toThrow(TRPCError);
    });

    it.skipIf(process.env.CI)('should return ticker prices for paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.trading.getTickerPrices({
        symbols: ['BTCUSDT', 'ETHUSDT'],
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('setFuturesPositionMode', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.trading.setFuturesPositionMode({
          walletId: 'wallet-id',
          dualSidePosition: true,
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should set position mode for paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.trading.setFuturesPositionMode({
        walletId: wallet.id,
        dualSidePosition: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('cancelIndividualProtectionOrder', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.trading.cancelIndividualProtectionOrder({
          executionIds: ['exec-1'],
          type: 'stopLoss',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should cancel stop loss for an open execution', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      const execution = await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        stopLoss: '48000',
        stopLossAlgoId: '12345',
        status: 'open',
      });

      const result = await caller.trading.cancelIndividualProtectionOrder({
        executionIds: [execution.id],
        type: 'stopLoss',
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.success).toBe(true);

      const [updated] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, execution.id))
        .limit(1);

      expect(updated!.stopLoss).toBeNull();
      expect(updated!.stopLossAlgoId).toBeNull();
      expect(updated!.status).toBe('open');
    });

    it('should cancel take profit for an open execution', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      const execution = await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        takeProfit: '55000',
        takeProfitAlgoId: '67890',
        status: 'open',
      });

      const result = await caller.trading.cancelIndividualProtectionOrder({
        executionIds: [execution.id],
        type: 'takeProfit',
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.success).toBe(true);

      const [updated] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, execution.id))
        .limit(1);

      expect(updated!.takeProfit).toBeNull();
      expect(updated!.takeProfitAlgoId).toBeNull();
      expect(updated!.status).toBe('open');
    });

    it('should handle multiple executions', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      const execution1 = await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        stopLoss: '48000',
        stopLossAlgoId: '11111',
        status: 'open',
      });

      const execution2 = await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        symbol: 'ETHUSDT',
        stopLoss: '2000',
        stopLossAlgoId: '22222',
        status: 'open',
      });

      const result = await caller.trading.cancelIndividualProtectionOrder({
        executionIds: [execution1.id, execution2.id],
        type: 'stopLoss',
      });

      expect(result.results).toHaveLength(2);
      expect(result.results.every(r => r.success)).toBe(true);

      const [updated1] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, execution1.id))
        .limit(1);

      const [updated2] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, execution2.id))
        .limit(1);

      expect(updated1!.stopLoss).toBeNull();
      expect(updated2!.stopLoss).toBeNull();
    });

    it('should return error for non-existent execution', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.trading.cancelIndividualProtectionOrder({
        executionIds: ['nonexistent'],
        type: 'stopLoss',
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.success).toBe(false);
      expect(result.results[0]!.error).toContain('not found');
    });

    it('should return error for closed execution', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const execution = await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        stopLoss: '48000',
        stopLossAlgoId: '12345',
        status: 'closed',
      });

      const result = await caller.trading.cancelIndividualProtectionOrder({
        executionIds: [execution.id],
        type: 'stopLoss',
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.success).toBe(false);
      expect(result.results[0]!.error).toContain('not open');
    });

    it('should succeed silently if no order to cancel', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const execution = await createTestTradeExecution({
        userId: user.id,
        walletId: wallet.id,
        status: 'open',
      });

      const result = await caller.trading.cancelIndividualProtectionOrder({
        executionIds: [execution.id],
        type: 'stopLoss',
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.success).toBe(true);
    });

    it('should not allow cancelling another user order', async () => {
      const { user: user1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2, session: session2 } = await createAuthenticatedUser({ email: 'user2@test.com' });

      const wallet = await createTestWallet({ userId: user1.id, walletType: 'paper' });
      const execution = await createTestTradeExecution({
        userId: user1.id,
        walletId: wallet.id,
        stopLoss: '48000',
        stopLossAlgoId: '12345',
        status: 'open',
      });

      const caller2 = createAuthenticatedCaller(user2, session2);

      const result = await caller2.trading.cancelIndividualProtectionOrder({
        executionIds: [execution.id],
        type: 'stopLoss',
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.success).toBe(false);
      expect(result.results[0]!.error).toContain('not found');
    });
  });

  describe('evaluateChecklist', () => {
    it('should require authentication', async () => {
      const caller = createUnauthenticatedCaller();
      await expect(
        caller.trading.evaluateChecklist({
          symbol: 'BTCUSDT',
          interval: '1h',
          marketType: 'FUTURES',
          conditions: [],
        }),
      ).rejects.toThrow(TRPCError);
    });

    it('should return empty results and zero totals when conditions are empty', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.trading.evaluateChecklist({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        conditions: [],
      });

      expect(result.results).toEqual([]);
      expect(result.score.requiredTotal).toBe(0);
      expect(result.score.preferredTotal).toBe(0);
      expect(result.score.requiredAllPassed).toBe(true);
    });

    it('should return NOT_FOUND when profileId does not exist', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.trading.evaluateChecklist({
          symbol: 'BTCUSDT',
          interval: '1h',
          marketType: 'FUTURES',
          profileId: 'nonexistent-profile-id',
        }),
      ).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' }),
      );
    });

    it('should reject when neither profileId nor conditions are supplied', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.trading.evaluateChecklist({
          symbol: 'BTCUSDT',
          interval: '1h',
          marketType: 'FUTURES',
        }),
      ).rejects.toThrow();
    });
  });
});
