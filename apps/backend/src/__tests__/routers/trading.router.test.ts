import { TRPCError } from '@trpc/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, cleanupTables } from '../helpers/test-db';
import { createAuthenticatedUser, createTestWallet } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';

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
          orderId: 999999999,
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
          stopLoss: '49000',
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
});
