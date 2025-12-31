import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { setupTestDatabase, teardownTestDatabase, getTestDatabase, cleanupTables } from '../helpers/test-db';
import { createTestWallet, createAuthenticatedUser } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';
import * as schema from '../../db/schema';
import { generateEntityId } from '../../utils/id';

vi.mock('../../services/binance-futures-client', () => ({
  createBinanceFuturesClient: vi.fn(() => ({})),
  isPaperWallet: vi.fn((wallet) => wallet.walletType === 'paper'),
  setLeverage: vi.fn().mockResolvedValue({ leverage: 10, maxNotionalValue: '1000000', symbol: 'BTCUSDT' }),
  setMarginType: vi.fn().mockResolvedValue({ code: 200, msg: 'success' }),
  getPositions: vi.fn().mockResolvedValue([]),
  getPosition: vi.fn().mockResolvedValue(null),
  submitFuturesOrder: vi.fn().mockResolvedValue({
    orderId: 123456789,
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'MARKET',
    status: 'FILLED',
    price: '50000',
    origQty: '0.1',
    executedQty: '0.1',
    timeInForce: 'GTC',
    time: Date.now(),
    updateTime: Date.now(),
    reduceOnly: false,
  }),
  cancelFuturesOrder: vi.fn().mockResolvedValue({ status: 'CANCELED' }),
  closePosition: vi.fn().mockResolvedValue({ orderId: 123456789, side: 'SELL', origQty: '0.1' }),
  getOpenOrders: vi.fn().mockResolvedValue([]),
  getSymbolLeverageBrackets: vi.fn().mockResolvedValue([
    { bracket: 1, initialLeverage: 125, notionalCap: 50000, notionalFloor: 0, maintMarginRatio: 0.004, cum: 0 },
  ]),
}));

vi.mock('../../services/binance-futures-data', () => ({
  getBinanceFuturesDataService: vi.fn(() => ({
    getMarkPrice: vi.fn().mockResolvedValue({ symbol: 'BTCUSDT', markPrice: 50000, indexPrice: 49990, lastFundingRate: '0.0001' }),
    getCurrentFundingRate: vi.fn().mockResolvedValue({ symbol: 'BTCUSDT', fundingRate: '0.0001', fundingTime: Date.now() }),
    getExchangeInfo: vi.fn().mockResolvedValue({ symbols: [] }),
  })),
}));

describe('Futures Trading Router', () => {
  let db: ReturnType<typeof getTestDatabase>;

  beforeAll(async () => {
    await setupTestDatabase();
    db = getTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  afterEach(async () => {
    await cleanupTables();
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should reject unauthenticated requests for setLeverage', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.futuresTrading.setLeverage({ walletId: 'test', symbol: 'BTCUSDT', leverage: 10 })
      ).rejects.toThrow('UNAUTHORIZED');
    });

    it('should reject unauthenticated requests for createOrder', async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.futuresTrading.createOrder({
          walletId: 'test',
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'MARKET',
          quantity: '0.1',
        })
      ).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('setLeverage', () => {
    it('should set leverage for paper wallet without API call', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.futuresTrading.setLeverage({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        leverage: 10,
      });

      expect(result.leverage).toBe(10);
      expect(result.symbol).toBe('BTCUSDT');
    });

    it('should reject if wallet does not belong to user', async () => {
      const { user: user1, session: session1 } = await createAuthenticatedUser({ email: 'user1@test.com' });
      const { user: user2 } = await createAuthenticatedUser({ email: 'user2@test.com' });
      const wallet = await createTestWallet({ userId: user2.id });
      const caller = createAuthenticatedCaller(user1, session1);

      await expect(
        caller.futuresTrading.setLeverage({ walletId: wallet.id, symbol: 'BTCUSDT', leverage: 10 })
      ).rejects.toThrow();
    });

    it('should reject invalid leverage values', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.futuresTrading.setLeverage({ walletId: wallet.id, symbol: 'BTCUSDT', leverage: 0 })
      ).rejects.toThrow();

      await expect(
        caller.futuresTrading.setLeverage({ walletId: wallet.id, symbol: 'BTCUSDT', leverage: 150 })
      ).rejects.toThrow();
    });
  });

  describe('setMarginType', () => {
    it('should set margin type for paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.futuresTrading.setMarginType({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        marginType: 'ISOLATED',
      });

      expect(result.success).toBe(true);
      expect(result.marginType).toBe('ISOLATED');
    });

    it('should accept CROSSED margin type', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.futuresTrading.setMarginType({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        marginType: 'CROSSED',
      });

      expect(result.success).toBe(true);
      expect(result.marginType).toBe('CROSSED');
    });
  });

  describe('createOrder', () => {
    it('should create market order for paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.futuresTrading.createOrder({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: '0.1',
      });

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.side).toBe('BUY');
      expect(result.type).toBe('MARKET');
      expect(result.status).toBe('FILLED');
      expect(result.quantity).toBe('0.1');

      const [order] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.orderId, result.orderId))
        .limit(1);

      expect(order).toBeDefined();
      expect(order!.marketType).toBe('FUTURES');
    });

    it('should create limit order for paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.futuresTrading.createOrder({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'SELL',
        type: 'LIMIT',
        quantity: '0.05',
        price: '55000',
      });

      expect(result.status).toBe('NEW');
      expect(result.type).toBe('LIMIT');
    });

    it('should reject order for inactive wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id });
      const caller = createAuthenticatedCaller(user, session);

      await db
        .update(schema.wallets)
        .set({ isActive: false })
        .where(eq(schema.wallets.id, wallet.id));

      await expect(
        caller.futuresTrading.createOrder({
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'MARKET',
          quantity: '0.1',
        })
      ).rejects.toThrow('Wallet is inactive');
    });

    it('should persist setupId and setupType', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.futuresTrading.createOrder({
        walletId: wallet.id,
        symbol: 'ETHUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: '1.0',
        setupId: 'setup-123',
        setupType: 'larry-williams-9.1',
      });

      const [order] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.orderId, result.orderId))
        .limit(1);

      expect(order!.setupId).toBe('setup-123');
      expect(order!.setupType).toBe('larry-williams-9.1');
    });
  });

  describe('cancelOrder', () => {
    it('should cancel order for paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const createResult = await caller.futuresTrading.createOrder({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.1',
        price: '45000',
      });

      const cancelResult = await caller.futuresTrading.cancelOrder({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        orderId: createResult.orderId,
      });

      expect(cancelResult.status).toBe('CANCELED');

      const [order] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.orderId, createResult.orderId))
        .limit(1);

      expect(order!.status).toBe('CANCELED');
    });
  });

  describe('getPositions', () => {
    it('should return empty array when no positions exist', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const positions = await caller.futuresTrading.getPositions({ walletId: wallet.id });

      expect(positions).toEqual([]);
    });

    it('should return only open futures positions', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await db.insert(schema.positions).values([
        {
          id: generateEntityId(),
          userId: user.id,
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: '50000',
          entryQty: '0.1',
          status: 'open',
          marketType: 'FUTURES',
        },
        {
          id: generateEntityId(),
          userId: user.id,
          walletId: wallet.id,
          symbol: 'ETHUSDT',
          side: 'SHORT',
          entryPrice: '3000',
          entryQty: '1.0',
          status: 'closed',
          marketType: 'FUTURES',
        },
        {
          id: generateEntityId(),
          userId: user.id,
          walletId: wallet.id,
          symbol: 'SOLUSDT',
          side: 'LONG',
          entryPrice: '100',
          entryQty: '10',
          status: 'open',
          marketType: 'SPOT',
        },
      ]);

      const positions = await caller.futuresTrading.getPositions({ walletId: wallet.id });

      expect(positions.length).toBe(1);
      expect(positions[0]!.symbol).toBe('BTCUSDT');
      expect(positions[0]!.marketType).toBe('FUTURES');
    });
  });

  describe('getPosition', () => {
    it('should return null when position does not exist', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const position = await caller.futuresTrading.getPosition({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
      });

      expect(position).toBeNull();
    });

    it('should return position for specific symbol', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await db.insert(schema.positions).values({
        id: generateEntityId(),
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        entryQty: '0.1',
        status: 'open',
        marketType: 'FUTURES',
      });

      const position = await caller.futuresTrading.getPosition({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
      });

      expect(position).toBeDefined();
      expect(position!.symbol).toBe('BTCUSDT');
      expect(position!.side).toBe('LONG');
    });
  });

  describe('createPosition', () => {
    it('should create position with leverage and liquidation price', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.futuresTrading.createPosition({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        entryQty: '0.1',
        leverage: 10,
        marginType: 'ISOLATED',
      });

      expect(result.id).toBeDefined();
      expect(result.liquidationPrice).toBeDefined();

      const [position] = await db
        .select()
        .from(schema.positions)
        .where(eq(schema.positions.id, result.id))
        .limit(1);

      expect(position).toBeDefined();
      expect(position!.leverage).toBe(10);
      expect(position!.marginType).toBe('ISOLATED');
      expect(position!.marketType).toBe('FUTURES');
    });

    it('should create position with stop loss and take profit', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.futuresTrading.createPosition({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        entryQty: '0.1',
        stopLoss: '48000',
        takeProfit: '55000',
        leverage: 5,
      });

      expect(result.id).toBeDefined();

      const [position] = await db
        .select()
        .from(schema.positions)
        .where(eq(schema.positions.id, result.id))
        .limit(1);

      expect(parseFloat(position!.stopLoss!)).toBe(48000);
      expect(parseFloat(position!.takeProfit!)).toBe(55000);
    });

    it('should reject position with invalid risk/reward ratio', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.futuresTrading.createPosition({
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: '50000',
          entryQty: '0.1',
          stopLoss: '49000',
          takeProfit: '50500',
          leverage: 10,
        })
      ).rejects.toThrow('Risk/reward ratio');
    });

    it('should reject position with invalid stop loss for LONG', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.futuresTrading.createPosition({
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: '50000',
          entryQty: '0.1',
          stopLoss: '51000',
          takeProfit: '55000',
          leverage: 10,
        })
      ).rejects.toThrow('Invalid stop loss');
    });

    it('should reject position with invalid stop loss for SHORT', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.futuresTrading.createPosition({
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'SHORT',
          entryPrice: '50000',
          entryQty: '0.1',
          stopLoss: '49000',
          takeProfit: '45000',
          leverage: 10,
        })
      ).rejects.toThrow('Invalid stop loss');
    });
  });

  describe('closePosition', () => {
    it('should close paper position and calculate PnL', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const positionId = generateEntityId();
      await db.insert(schema.positions).values({
        id: positionId,
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '48000',
        entryQty: '0.1',
        currentPrice: '50000',
        status: 'open',
        marketType: 'FUTURES',
        leverage: 10,
        accumulatedFunding: '5',
      });

      const result = await caller.futuresTrading.closePosition({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        positionId,
      });

      expect(result.success).toBe(true);
      expect(result.positionId).toBe(positionId);
      expect(result.accumulatedFunding).toBe(5);

      const [position] = await db
        .select()
        .from(schema.positions)
        .where(eq(schema.positions.id, positionId))
        .limit(1);

      expect(position!.status).toBe('closed');
      expect(position!.closedAt).toBeDefined();
    });

    it('should reject if position not found', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.futuresTrading.closePosition({
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          positionId: 'nonexistent',
        })
      ).rejects.toThrow('Position not found');
    });
  });

  describe('getOpenOrders', () => {
    it('should return open orders for paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await db.insert(schema.orders).values([
        {
          orderId: 1,
          userId: user.id,
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          price: '45000',
          origQty: '0.1',
          status: 'NEW',
          marketType: 'FUTURES',
        },
        {
          orderId: 2,
          userId: user.id,
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'SELL',
          type: 'LIMIT',
          price: '55000',
          origQty: '0.1',
          status: 'FILLED',
          marketType: 'FUTURES',
        },
      ]);

      const openOrders = await caller.futuresTrading.getOpenOrders({ walletId: wallet.id });

      expect(openOrders.length).toBe(1);
      expect(openOrders[0]!.status).toBe('NEW');
    });

    it('should filter by symbol when provided', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      await db.insert(schema.orders).values([
        {
          orderId: 1,
          userId: user.id,
          walletId: wallet.id,
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          status: 'NEW',
          marketType: 'FUTURES',
        },
        {
          orderId: 2,
          userId: user.id,
          walletId: wallet.id,
          symbol: 'ETHUSDT',
          side: 'BUY',
          type: 'LIMIT',
          status: 'NEW',
          marketType: 'FUTURES',
        },
      ]);

      const btcOrders = await caller.futuresTrading.getOpenOrders({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
      });

      expect(btcOrders.length).toBe(1);
      expect(btcOrders[0]!.symbol).toBe('BTCUSDT');
    });
  });

  describe('getLeverageBrackets', () => {
    it('should return leverage brackets for paper wallet', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, walletType: 'paper' });
      const caller = createAuthenticatedCaller(user, session);

      const brackets = await caller.futuresTrading.getLeverageBrackets({
        walletId: wallet.id,
        symbol: 'BTCUSDT',
      });

      expect(brackets.length).toBeGreaterThan(0);
      expect(brackets[0]).toHaveProperty('initialLeverage');
      expect(brackets[0]).toHaveProperty('maintMarginRatio');
    });
  });

  describe('getMarkPrice', () => {
    it('should return mark price data', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const markPrice = await caller.futuresTrading.getMarkPrice({ symbol: 'BTCUSDT' });

      expect(markPrice).toBeDefined();
      expect(markPrice!.symbol).toBe('BTCUSDT');
      expect(markPrice!.markPrice).toBe(50000);
    });
  });

  describe('getFundingRate', () => {
    it('should return funding rate data', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const fundingRate = await caller.futuresTrading.getFundingRate({ symbol: 'BTCUSDT' });

      expect(fundingRate).toBeDefined();
      expect(fundingRate!.symbol).toBe('BTCUSDT');
      expect(fundingRate!.fundingRate).toBe('0.0001');
    });
  });

  describe('getExchangeInfo', () => {
    it('should return exchange info', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const exchangeInfo = await caller.futuresTrading.getExchangeInfo();

      expect(exchangeInfo).toBeDefined();
      expect(exchangeInfo).toHaveProperty('symbols');
    });
  });
});
