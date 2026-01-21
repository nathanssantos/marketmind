import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../helpers/test-db';
import { createTestWallet, createAuthenticatedUser } from '../helpers/test-fixtures';
import { tradeExecutions, wallets, positions } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateEntityId } from '../../utils/id';
import {
  createFuturesOrderUpdateEvent,
  createFuturesAccountUpdateEvent,
  createFuturesMarginCallEvent,
  createFuturesConfigUpdateEvent,
  createFuturesAlgoUpdateEvent,
  createFuturesConditionalOrderRejectEvent,
} from '../helpers/binance-mock';

const { MockWebsocketClient, getMockWsClient, setMockWsClient: _setMockWsClient } = vi.hoisted(() => {
  let mockWsClient: MockWebSocketClient | undefined;

  interface MockWebSocketClient {
    on: ReturnType<typeof vi.fn>;
    subscribeUsdFuturesUserDataStream: ReturnType<typeof vi.fn>;
    closeAll: ReturnType<typeof vi.fn>;
    handlers: Record<string, ((data: unknown) => void)[]>;
    emit: (event: string, data: unknown) => void;
  }

  class MockWebsocketClient {
    handlers: Record<string, ((data: unknown) => void)[]> = {};
    on: ReturnType<typeof vi.fn>;
    subscribeUsdFuturesUserDataStream: ReturnType<typeof vi.fn>;
    closeAll: ReturnType<typeof vi.fn>;

    emit(event: string, data: unknown) {
      const eventHandlers = this.handlers[event] || [];
      eventHandlers.forEach(handler => handler(data));
    }

    constructor() {
      this.on = vi.fn((event: string, handler: (data: unknown) => void) => {
        if (!this.handlers[event]) this.handlers[event] = [];
        this.handlers[event].push(handler);
      });
      this.subscribeUsdFuturesUserDataStream = vi.fn().mockResolvedValue(undefined);
      this.closeAll = vi.fn();
      mockWsClient = this;
    }
  }

  return {
    MockWebsocketClient,
    getMockWsClient: () => mockWsClient,
    setMockWsClient: (client: MockWebSocketClient | undefined) => { mockWsClient = client; },
  };
});

vi.mock('binance', () => {
  return {
    WebsocketClient: MockWebsocketClient,
  };
});

vi.mock('../../services/binance-futures-client', () => ({
  createBinanceFuturesClient: vi.fn(() => ({
    cancelOrder: vi.fn().mockResolvedValue({ status: 'CANCELED' }),
  })),
  isPaperWallet: vi.fn((wallet) => wallet.walletType === 'paper'),
  getWalletType: vi.fn((wallet) => wallet.walletType === 'testnet' ? 'testnet' : 'live'),
  cancelFuturesAlgoOrder: vi.fn().mockResolvedValue({ status: 'CANCELLED' }),
}));

vi.mock('../../services/encryption', () => ({
  decryptApiKey: vi.fn((encrypted) => `decrypted_${encrypted}`),
}));

const mockEmitRiskAlert = vi.fn();
const mockEmitWalletUpdate = vi.fn();
const mockEmitPositionUpdate = vi.fn();
const mockEmitOrderUpdate = vi.fn();

vi.mock('../../services/websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    emitRiskAlert: mockEmitRiskAlert,
    emitWalletUpdate: mockEmitWalletUpdate,
    emitPositionUpdate: mockEmitPositionUpdate,
    emitOrderUpdate: mockEmitOrderUpdate,
  })),
}));

import { BinanceFuturesUserStreamService } from '../../services/binance-futures-user-stream';

describe('BinanceFuturesUserStreamService', () => {
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

  describe('start and stop', () => {
    it('should start the service', async () => {
      const service = new BinanceFuturesUserStreamService();
      await service.start();
      expect((service as unknown as { isRunning: boolean }).isRunning).toBe(true);
      service.stop();
    });

    it('should not start twice', async () => {
      const service = new BinanceFuturesUserStreamService();
      await service.start();
      await service.start();
      expect((service as unknown as { isRunning: boolean }).isRunning).toBe(true);
      service.stop();
    });

    it('should stop the service and close all connections', async () => {
      const service = new BinanceFuturesUserStreamService();
      await service.start();
      service.stop();
      expect((service as unknown as { isRunning: boolean }).isRunning).toBe(false);
    });
  });

  describe('subscribeWallet', () => {
    it('should skip paper wallets', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'paper',
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);

      expect(service.isWalletSubscribed(wallet.id)).toBe(false);
      service.stop();
    });

    it('should subscribe live wallets', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);

      expect(service.isWalletSubscribed(wallet.id)).toBe(true);
      service.stop();
    });

    it('should not subscribe same wallet twice', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);
      await service.subscribeWallet(wallet);

      expect(service.isWalletSubscribed(wallet.id)).toBe(true);
      service.stop();
    });
  });

  describe('unsubscribeWallet', () => {
    it('should unsubscribe a wallet', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);
      expect(service.isWalletSubscribed(wallet.id)).toBe(true);

      service.unsubscribeWallet(wallet.id);
      expect(service.isWalletSubscribed(wallet.id)).toBe(false);
      service.stop();
    });
  });


  describe('handleOrderUpdate - stop loss filled', () => {
    it('should close position when stop loss is filled', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        initialBalance: '10000',
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
        marketType: 'FUTURES',
        stopLossOrderId: 123456789,
        takeProfitOrderId: 987654321,
        leverage: 10,
        openedAt: new Date(),
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);

      const event = createFuturesOrderUpdateEvent({
        symbol: 'BTCUSDT',
        orderId: 123456789,
        status: 'FILLED',
        execType: 'TRADE',
        avgPrice: '49000',
        executedQty: '0.1',
      });

      getMockWsClient()?.emit('formattedMessage', event);

      await new Promise(resolve => setTimeout(resolve, 100));

      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId));

      expect(execution!.status).toBe('closed');
      expect(execution!.exitReason).toBe('STOP_LOSS');
      expect(parseFloat(execution!.exitPrice!)).toBe(49000);
      expect(mockEmitOrderUpdate).toHaveBeenCalled();

      service.stop();
    });
  });

  describe('handleOrderUpdate - take profit filled', () => {
    it('should close position when take profit is filled', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        initialBalance: '10000',
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
        marketType: 'FUTURES',
        stopLossOrderId: 123456789,
        takeProfitOrderId: 987654321,
        leverage: 10,
        openedAt: new Date(),
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);

      const event = createFuturesOrderUpdateEvent({
        symbol: 'BTCUSDT',
        orderId: 987654321,
        status: 'FILLED',
        execType: 'TRADE',
        avgPrice: '53000',
        executedQty: '0.1',
      });

      getMockWsClient()?.emit('formattedMessage', event);

      await new Promise(resolve => setTimeout(resolve, 100));

      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId));

      expect(execution!.status).toBe('closed');
      expect(execution!.exitReason).toBe('TAKE_PROFIT');
      expect(parseFloat(execution!.exitPrice!)).toBe(53000);

      service.stop();
    });
  });

  describe('handleOrderUpdate - SHORT position', () => {
    it('should calculate PnL correctly for SHORT position', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        initialBalance: '10000',
      });

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
        marketType: 'FUTURES',
        stopLossOrderId: 123456789,
        takeProfitOrderId: 987654321,
        leverage: 10,
        openedAt: new Date(),
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);

      const event = createFuturesOrderUpdateEvent({
        symbol: 'BTCUSDT',
        orderId: 987654321,
        status: 'FILLED',
        execType: 'TRADE',
        avgPrice: '48000',
        executedQty: '0.1',
      });

      getMockWsClient()?.emit('formattedMessage', event);

      await new Promise(resolve => setTimeout(resolve, 100));

      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId));

      expect(execution!.status).toBe('closed');
      expect(parseFloat(execution!.pnl!)).toBeGreaterThan(0);

      service.stop();
    });
  });

  describe('handleAccountUpdate', () => {
    it('should update wallet balance from account update', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        initialBalance: '10000',
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);

      const event = createFuturesAccountUpdateEvent({
        reason: 'DEPOSIT',
        balances: [{ asset: 'USDT', walletBalance: '15000', crossWalletBalance: '15000', balanceChange: '5000' }],
      });

      getMockWsClient()?.emit('formattedMessage', event);

      await new Promise(resolve => setTimeout(resolve, 100));

      const [updatedWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, wallet.id));

      expect(parseFloat(updatedWallet!.currentBalance!)).toBe(15000);
      expect(mockEmitWalletUpdate).toHaveBeenCalled();

      service.stop();
    });

    it('should update position from account update', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
      });

      const positionId = generateEntityId();
      await db.insert(positions).values({
        id: positionId,
        userId: user.id,
        walletId: wallet.id,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: '50000',
        entryQty: '0.1',
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);

      const event = createFuturesAccountUpdateEvent({
        reason: 'ORDER',
        positions: [{
          symbol: 'BTCUSDT',
          positionAmount: '0.1',
          entryPrice: '51000',
          cumulativeRealized: '0',
          unrealizedPnL: '100',
          marginType: 'ISOLATED',
          isolatedWallet: '500',
          positionSide: 'BOTH',
        }],
      });

      getMockWsClient()?.emit('formattedMessage', event);

      await new Promise(resolve => setTimeout(resolve, 100));

      const [updatedPosition] = await db
        .select()
        .from(positions)
        .where(eq(positions.id, positionId));

      expect(parseFloat(updatedPosition!.currentPrice!)).toBe(51000);
      expect(parseFloat(updatedPosition!.pnl!)).toBe(100);

      service.stop();
    });
  });

  describe('handleMarginCall', () => {
    it('should emit risk alert on margin call', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);

      const event = createFuturesMarginCallEvent({
        crossWalletBalance: '100',
        positions: [{
          symbol: 'BTCUSDT',
          positionSide: 'BOTH',
          positionAmount: '0.1',
          marginType: 'ISOLATED',
          isolatedWallet: '50',
          markPrice: '48000',
          unrealizedPnL: '-200',
          maintenanceMargin: '25',
        }],
      });

      getMockWsClient()?.emit('formattedMessage', event);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockEmitRiskAlert).toHaveBeenCalledWith(
        wallet.id,
        expect.objectContaining({
          type: 'LIQUIDATION_RISK',
          level: 'critical',
          symbol: 'BTCUSDT',
        })
      );

      service.stop();
    });
  });

  describe('handleConfigUpdate', () => {
    it('should handle leverage update silently', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);

      const event = createFuturesConfigUpdateEvent({
        symbol: 'BTCUSDT',
        leverage: 20,
      });

      expect(() => getMockWsClient()?.emit('formattedMessage', event)).not.toThrow();

      service.stop();
    });

    it('should handle multi-asset mode update silently', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);

      const event = createFuturesConfigUpdateEvent({
        multiAssetMode: true,
      });

      expect(() => getMockWsClient()?.emit('formattedMessage', event)).not.toThrow();

      service.stop();
    });
  });

  describe('error handling', () => {
    it('should handle invalid message gracefully', async () => {
      const { user } = await createAuthenticatedUser();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);

      expect(() => getMockWsClient()?.emit('formattedMessage', null)).not.toThrow();
      expect(() => getMockWsClient()?.emit('formattedMessage', 'invalid')).not.toThrow();
      expect(() => getMockWsClient()?.emit('formattedMessage', { e: 'UNKNOWN_EVENT' })).not.toThrow();

      service.stop();
    });
  });

  describe('handleAlgoOrderUpdate - OCO-like behavior', () => {
    it('should set exitReason when algo SL is triggered', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
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
        marketType: 'FUTURES',
        stopLossAlgoId: 111111,
        takeProfitAlgoId: 222222,
        leverage: 10,
        openedAt: new Date(),
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);

      const event = createFuturesAlgoUpdateEvent({
        symbol: 'BTCUSDT',
        algoId: 111111,
        status: 'TRIGGERED',
        orderType: 'STOP_MARKET',
        side: 'SELL',
      });

      getMockWsClient()?.emit('formattedMessage', event);

      await new Promise(resolve => setTimeout(resolve, 100));

      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId));

      expect(execution!.exitReason).toBe('STOP_LOSS');
      expect(execution!.status).toBe('open');

      service.stop();
    });

    it('should set exitReason when algo TP is triggered', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
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
        marketType: 'FUTURES',
        stopLossAlgoId: 111111,
        takeProfitAlgoId: 222222,
        leverage: 10,
        openedAt: new Date(),
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);

      const event = createFuturesAlgoUpdateEvent({
        symbol: 'BTCUSDT',
        algoId: 222222,
        status: 'TRIGGERED',
        orderType: 'TAKE_PROFIT_MARKET',
        side: 'SELL',
      });

      getMockWsClient()?.emit('formattedMessage', event);

      await new Promise(resolve => setTimeout(resolve, 100));

      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId));

      expect(execution!.exitReason).toBe('TAKE_PROFIT');
      expect(execution!.status).toBe('open');

      service.stop();
    });

    it('should ignore CANCELLED algo orders (manual cancel)', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
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
        marketType: 'FUTURES',
        stopLossAlgoId: 111111,
        takeProfitAlgoId: 222222,
        leverage: 10,
        openedAt: new Date(),
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);

      const event = createFuturesAlgoUpdateEvent({
        symbol: 'BTCUSDT',
        algoId: 111111,
        status: 'CANCELLED',
        orderType: 'STOP_MARKET',
      });

      getMockWsClient()?.emit('formattedMessage', event);

      await new Promise(resolve => setTimeout(resolve, 100));

      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId));

      expect(execution!.exitReason).toBeNull();
      expect(execution!.status).toBe('open');

      service.stop();
    });
  });

  describe('handleConditionalOrderReject', () => {
    it('should clear order IDs when order is rejected', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
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
        marketType: 'FUTURES',
        stopLoss: '49000',
        stopLossAlgoId: 111111,
        takeProfitAlgoId: 222222,
        leverage: 10,
        openedAt: new Date(),
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);

      const event = createFuturesConditionalOrderRejectEvent({
        symbol: 'BTCUSDT',
        orderId: 111111,
        reason: 'PRICE_NOT_MET',
      });

      getMockWsClient()?.emit('formattedMessage', event);

      await new Promise(resolve => setTimeout(resolve, 100));

      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId));

      expect(execution!.stopLoss).toBeNull();
      expect(execution!.stopLossAlgoId).toBeNull();
      expect(execution!.takeProfitAlgoId).toBe(222222);
      expect(execution!.status).toBe('open');

      service.stop();
    });
  });

  describe('order ID clearing on position close', () => {
    it('should clear all order IDs when position closes', async () => {
      const { user } = await createAuthenticatedUser();
      const db = getTestDatabase();
      const wallet = await createTestWallet({
        userId: user.id,
        walletType: 'live',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        initialBalance: '10000',
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
        marketType: 'FUTURES',
        stopLossOrderId: 111111,
        stopLossAlgoId: 333333,
        takeProfitOrderId: 222222,
        takeProfitAlgoId: 444444,
        leverage: 10,
        openedAt: new Date(),
      });

      const service = new BinanceFuturesUserStreamService();
      await service.subscribeWallet(wallet);

      const event = createFuturesOrderUpdateEvent({
        symbol: 'BTCUSDT',
        orderId: 111111,
        status: 'FILLED',
        execType: 'TRADE',
        avgPrice: '49000',
        executedQty: '0.1',
      });

      getMockWsClient()?.emit('formattedMessage', event);

      await new Promise(resolve => setTimeout(resolve, 100));

      const [execution] = await db
        .select()
        .from(tradeExecutions)
        .where(eq(tradeExecutions.id, executionId));

      expect(execution!.status).toBe('closed');
      expect(execution!.stopLossOrderId).toBeNull();
      expect(execution!.stopLossAlgoId).toBeNull();
      expect(execution!.takeProfitOrderId).toBeNull();
      expect(execution!.takeProfitAlgoId).toBeNull();

      service.stop();
    });
  });
});
