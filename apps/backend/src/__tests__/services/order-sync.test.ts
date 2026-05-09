import type { MarketType } from '@marketmind/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mockWalletsData: unknown[] = [];
let mockExecutionsData: unknown[] = [];
let mockAutoTradingConfigData: unknown[] = [];
let mockOrdersData: unknown[] = [];
let mockUpdateSetCalls: Array<{ status: string }> = [];

vi.mock('../../db', () => ({
  db: {
    select: (..._args: unknown[]) => ({
      from: (table: Record<string, unknown>) => {
        const isOrdersTable = table && 'orderId' in table;
        const isWalletsTable = table && 'id' in table && !('walletId' in table) && !('orderId' in table);
        const isAutoTradingConfigTable = table && 'autoCancelOrphans' in table;
        if (isOrdersTable) {
          // reconcileOrdersTable() — return mockOrdersData under .where()
          return {
            where: () => Promise.resolve(mockOrdersData),
          };
        }
        if (isWalletsTable) {
          const result = Promise.resolve(mockWalletsData);
          return result;
        }
        if (isAutoTradingConfigTable) {
          return {
            where: () => ({
              limit: () => Promise.resolve(mockAutoTradingConfigData),
            }),
          };
        }
        return {
          where: () => Promise.resolve(mockExecutionsData),
        };
      },
    }),
    // reconcileOrdersTable() updates the orders table when stale rows
    // are detected. Test mock returns a no-op chain so syncWallet
    // doesn't blow up; specific tests can override. The full chain
    // includes .returning() since the cascade-EXPIRED-to-exec path
    // uses it; resolves to [] so cascade emits nothing by default.
    update: (..._args: unknown[]) => ({
      set: (values: { status?: string }) => {
        if (values?.status) mockUpdateSetCalls.push({ status: values.status });
        return {
          where: () => {
            const promise = Promise.resolve([]) as unknown as Promise<unknown[]> & {
              returning: () => Promise<unknown[]>;
            };
            promise.returning = () => Promise.resolve([]);
            return promise;
          },
        };
      },
    }),
  },
}));

vi.mock('../../db/schema', () => ({
  wallets: { id: 'wallets.id' },
  autoTradingConfig: {
    walletId: 'autoTradingConfig.walletId',
    autoCancelOrphans: 'autoTradingConfig.autoCancelOrphans',
  },
  tradeExecutions: {
    walletId: 'tradeExecutions.walletId',
    status: 'tradeExecutions.status',
    marketType: 'tradeExecutions.marketType',
  },
  orders: {
    orderId: 'orders.orderId',
    walletId: 'orders.walletId',
    status: 'orders.status',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  desc: vi.fn((...args: unknown[]) => ({ type: 'desc', args })),
  inArray: vi.fn((...args: unknown[]) => ({ type: 'inArray', args })),
  or: vi.fn((...args: unknown[]) => ({ type: 'or', args })),
}));

const mockCreateBinanceFuturesClient = vi.fn();
const mockGetOpenAlgoOrders = vi.fn();
const mockGetPositions = vi.fn();
const mockIsPaperWallet = vi.fn();
const mockGetBinanceOpenOrders = vi.fn();

vi.mock('../../services/binance-futures-client', () => ({
  createBinanceFuturesClient: (...args: unknown[]) => mockCreateBinanceFuturesClient(...args),
  getOpenAlgoOrders: (...args: unknown[]) => mockGetOpenAlgoOrders(...args),
  getPositions: (...args: unknown[]) => mockGetPositions(...args),
  isPaperWallet: (...args: unknown[]) => mockIsPaperWallet(...args),
}));

// PR #495 added the regular-orders fetch + reconcileOrdersTable() to
// detect stale `NEW` rows in the orders table. Mock returns empty by
// default so existing tests don't see phantom orphan reconciliation.
vi.mock('../../services/binance-futures-orders', () => ({
  getOpenOrders: (...args: unknown[]) => mockGetBinanceOpenOrders(...args),
}));

const mockClearProtectionOrderIds = vi.fn();
const mockSyncProtectionOrderIdFromExchange = vi.fn();

vi.mock('../../services/execution-manager', () => ({
  clearProtectionOrderIds: (...args: unknown[]) => mockClearProtectionOrderIds(...args),
  syncProtectionOrderIdFromExchange: (...args: unknown[]) => mockSyncProtectionOrderIdFromExchange(...args),
}));

const mockCancelProtectionOrder = vi.fn();

vi.mock('../../services/protection-orders', () => ({
  cancelProtectionOrder: (...args: unknown[]) => mockCancelProtectionOrder(...args),
}));

const mockEmitRiskAlert = vi.fn();
const mockGetWebSocketService = vi.fn();

vi.mock('../../services/websocket', () => ({
  getWebSocketService: (...args: unknown[]) => mockGetWebSocketService(...args),
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
  serializeError: vi.fn((err: unknown) => err instanceof Error ? err.message : String(err)),
}));

import { OrderSyncService } from '../../services/order-sync';
import type { FuturesAlgoOrder } from '../../exchange/futures-client';

interface TestWallet {
  id: string;
  userId: string;
  name: string;
  walletType: 'live' | 'testnet' | 'paper';
  marketType: MarketType;
  apiKeyEncrypted: string;
  apiSecretEncrypted: string;
  exchange: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  initialBalance: string | null;
  currentBalance: string | null;
  totalWalletBalance: string | null;
  totalDeposits: string;
  totalWithdrawals: string;
  lastTransferSyncAt: Date | null;
  currency: string;
  agentTradingEnabled: boolean;
}

interface TestExecution {
  id: string;
  walletId: string;
  symbol: string;
  status: string;
  marketType: string;
  side: string;
  stopLoss: string | null;
  takeProfit: string | null;
  stopLossAlgoId: string | null;
  takeProfitAlgoId: string | null;
}

const createTestWallet = (overrides: Partial<TestWallet> = {}): TestWallet => ({
  id: 'wallet-1',
  userId: 'user-1',
  name: 'Test Wallet',
  walletType: 'live',
  marketType: 'FUTURES',
  apiKeyEncrypted: 'enc-key',
  apiSecretEncrypted: 'enc-secret',
  exchange: 'BINANCE',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  initialBalance: '10000',
  currentBalance: '10000',
  totalWalletBalance: null,
  totalDeposits: '0',
  totalWithdrawals: '0',
  lastTransferSyncAt: null,
  currency: 'USDT',
  agentTradingEnabled: false,
  ...overrides,
});

const createTestExecution = (overrides: Partial<TestExecution> = {}): TestExecution => ({
  id: 'exec-1',
  walletId: 'wallet-1',
  symbol: 'BTCUSDT',
  status: 'open',
  marketType: 'FUTURES',
  side: 'LONG',
  stopLoss: '45000',
  takeProfit: '55000',
  stopLossAlgoId: '100',
  takeProfitAlgoId: '200',
  ...overrides,
});

const createAlgoOrder = (overrides: Partial<FuturesAlgoOrder> = {}): FuturesAlgoOrder => ({
  algoId: '100',
  clientAlgoId: 'client-100',
  symbol: 'BTCUSDT',
  side: 'SELL',
  positionSide: 'BOTH',
  type: 'STOP_MARKET',
  quantity: '0.1',
  triggerPrice: '45000',
  algoStatus: 'NEW',
  reduceOnly: true,
  closePosition: false,
  createTime: Date.now(),
  updateTime: Date.now(),
  ...overrides,
});

describe('OrderSyncService', () => {
  let service: OrderSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    service = new OrderSyncService();

    mockWalletsData = [];
    mockExecutionsData = [];
    mockAutoTradingConfigData = [];
    mockOrdersData = [];

    mockCreateBinanceFuturesClient.mockReturnValue({});
    mockGetOpenAlgoOrders.mockResolvedValue([]);
    mockGetPositions.mockResolvedValue([]);
    mockGetBinanceOpenOrders.mockResolvedValue([]);
    mockIsPaperWallet.mockReturnValue(false);
    mockGetWebSocketService.mockReturnValue({
      emitRiskAlert: mockEmitRiskAlert,
    });
    mockCancelProtectionOrder.mockResolvedValue(true);
    mockSyncProtectionOrderIdFromExchange.mockResolvedValue(undefined);
    mockClearProtectionOrderIds.mockResolvedValue(undefined);
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  describe('start()', () => {
    it('should set isRunning and schedule interval', async () => {
      await service.start();
      expect(vi.getTimerCount()).toBe(1);
    });

    it('should not start twice when called consecutively', async () => {
      await service.start();
      await service.start();
      expect(vi.getTimerCount()).toBe(1);
    });

    it('should call syncAllWallets immediately when no delayFirstSync', async () => {
      await service.start();
      expect(mockGetOpenAlgoOrders).not.toHaveBeenCalled();
    });

    it('should delay first sync when delayFirstSync is specified', async () => {
      const startPromise = service.start({ delayFirstSync: 5000 });
      await startPromise;

      expect(mockIsPaperWallet).not.toHaveBeenCalled();

      const wallet = createTestWallet();
      mockWalletsData = [wallet];
      mockExecutionsData = [];

      await vi.advanceTimersByTimeAsync(5000);

      expect(vi.getTimerCount()).toBe(1);
    });

    it('should store autoCancelOrphans option', async () => {
      const wallet = createTestWallet();
      mockWalletsData = [wallet];
      mockExecutionsData = [];

      const orphanOrder = createAlgoOrder({ algoId: '999', symbol: 'ETHUSDT' });
      mockGetOpenAlgoOrders.mockResolvedValue([orphanOrder]);

      await service.start({ autoCancelOrphans: true });

      expect(mockCancelProtectionOrder).toHaveBeenCalled();
    });

    it('should store autoFixMismatches option', async () => {
      await service.start({ autoFixMismatches: true });
      expect(vi.getTimerCount()).toBe(1);
    });
  });

  describe('stop()', () => {
    it('should clear the sync interval', async () => {
      await service.start();
      expect(vi.getTimerCount()).toBe(1);

      service.stop();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('should be safe to call stop without starting', () => {
      expect(() => service.stop()).not.toThrow();
    });

    it('should allow restarting after stop', async () => {
      await service.start();
      service.stop();

      await service.start();
      expect(vi.getTimerCount()).toBe(1);
    });
  });

  describe('syncAllWallets()', () => {
    it('should return empty array when no wallets exist', async () => {
      mockWalletsData = [];
      const results = await service.syncAllWallets();
      expect(results).toEqual([]);
    });

    it('should filter out paper wallets', async () => {
      const paperWallet = createTestWallet({ walletType: 'paper' });
      mockIsPaperWallet.mockReturnValue(true);
      mockWalletsData = [paperWallet];

      const results = await service.syncAllWallets();
      expect(results).toEqual([]);
      expect(mockCreateBinanceFuturesClient).not.toHaveBeenCalled();
    });

    it('should filter out wallets without api keys', async () => {
      const wallet = createTestWallet({ apiKeyEncrypted: '', apiSecretEncrypted: '' });
      mockWalletsData = [wallet];

      const results = await service.syncAllWallets();
      expect(results).toEqual([]);
    });

    it('should filter out SPOT market wallets', async () => {
      const spotWallet = createTestWallet({ marketType: 'SPOT' });
      mockWalletsData = [spotWallet];

      const results = await service.syncAllWallets();
      expect(results).toEqual([]);
    });

    it('should sync each live futures wallet', async () => {
      const wallet1 = createTestWallet({ id: 'wallet-1' });
      const wallet2 = createTestWallet({ id: 'wallet-2' });
      mockWalletsData = [wallet1, wallet2];
      mockExecutionsData = [];

      const results = await service.syncAllWallets();
      expect(results).toHaveLength(2);
      expect(results[0]?.walletId).toBe('wallet-1');
      expect(results[1]?.walletId).toBe('wallet-2');
    });

    it('should handle errors from individual wallet syncs gracefully', async () => {
      const wallet = createTestWallet();
      mockWalletsData = [wallet];
      mockCreateBinanceFuturesClient.mockImplementation(() => {
        throw new Error('API key invalid');
      });

      const results = await service.syncAllWallets();
      expect(results).toHaveLength(1);
      expect(results[0]?.synced).toBe(false);
      expect(results[0]?.errors).toHaveLength(1);
      expect(results[0]?.errors[0]).toBe('API key invalid');
    });

    it('should handle top-level db error gracefully', async () => {
      vi.doMock('../../db', () => ({
        db: {
          select: () => {
            throw new Error('DB connection lost');
          },
        },
      }));

      const freshService = new OrderSyncService();
      mockWalletsData = [];

      const results = await freshService.syncAllWallets();
      expect(results).toEqual([]);
    });
  });

  describe('syncWallet()', () => {
    it('should return clean result when no orders or positions exist', async () => {
      const wallet = createTestWallet();
      mockExecutionsData = [];

      const result = await service.syncWallet(wallet);

      expect(result.synced).toBe(true);
      expect(result.orphanOrders).toEqual([]);
      expect(result.mismatchedOrders).toEqual([]);
      expect(result.fixedOrders).toEqual([]);
      expect(result.cancelledOrphans).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('should detect orphan orders not tracked in DB', async () => {
      const wallet = createTestWallet();
      const orphanOrder = createAlgoOrder({ algoId: '999', symbol: 'ETHUSDT' });

      mockExecutionsData = [];
      mockGetOpenAlgoOrders.mockResolvedValue([orphanOrder]);

      const result = await service.syncWallet(wallet);

      expect(result.orphanOrders).toHaveLength(1);
      expect(result.orphanOrders[0]?.algoId).toBe('999');
      expect(result.orphanOrders[0]?.symbol).toBe('ETHUSDT');
      expect(result.orphanOrders[0]?.hasPositionOnExchange).toBe(false);
    });

    it('should mark orphan orders that have positions on exchange', async () => {
      const wallet = createTestWallet();
      const orphanOrder = createAlgoOrder({ algoId: '999', symbol: 'BTCUSDT' });

      mockExecutionsData = [];
      mockGetOpenAlgoOrders.mockResolvedValue([orphanOrder]);
      mockGetPositions.mockResolvedValue([
        { symbol: 'BTCUSDT', positionAmt: '0.5' },
      ]);

      const result = await service.syncWallet(wallet);

      expect(result.orphanOrders[0]?.hasPositionOnExchange).toBe(true);
    });

    it('should not flag matched orders as orphans', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({ stopLossAlgoId: '100', takeProfitAlgoId: null });
      const matchedOrder = createAlgoOrder({ algoId: '100', type: 'STOP_MARKET', triggerPrice: '45000' });

      mockExecutionsData = [execution];
      mockGetOpenAlgoOrders.mockResolvedValue([matchedOrder]);

      const result = await service.syncWallet(wallet);

      expect(result.orphanOrders).toHaveLength(0);
    });

    it('should detect SL mismatch when SL order not found on exchange', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLossAlgoId: '100',
        takeProfitAlgoId: null,
      });

      mockExecutionsData = [execution];

      const result = await service.syncWallet(wallet);

      expect(result.mismatchedOrders).toHaveLength(1);
      expect(result.mismatchedOrders[0]?.field).toBe('stopLoss');
      expect(result.mismatchedOrders[0]?.dbAlgoId).toBe('100');
      expect(result.mismatchedOrders[0]?.exchangeAlgoId).toBeNull();
    });

    it('should detect TP mismatch when TP order not found on exchange', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLossAlgoId: null,
        takeProfitAlgoId: '200',
      });

      mockExecutionsData = [execution];

      const result = await service.syncWallet(wallet);

      expect(result.mismatchedOrders).toHaveLength(1);
      expect(result.mismatchedOrders[0]?.field).toBe('takeProfit');
      expect(result.mismatchedOrders[0]?.dbAlgoId).toBe('200');
    });

    it('should detect SL trigger price mismatch', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLoss: '45000',
        stopLossAlgoId: '100',
        takeProfitAlgoId: null,
      });
      const slOrder = createAlgoOrder({ algoId: '100', type: 'STOP_MARKET', triggerPrice: '44000' });

      mockExecutionsData = [execution];
      mockGetOpenAlgoOrders.mockResolvedValue([slOrder]);

      const result = await service.syncWallet(wallet);

      expect(result.mismatchedOrders).toHaveLength(1);
      expect(result.mismatchedOrders[0]?.field).toBe('stopLoss');
      expect(result.mismatchedOrders[0]?.dbValue).toBe(45000);
      expect(result.mismatchedOrders[0]?.exchangeTriggerPrice).toBe('44000');
    });

    it('should detect TP trigger price mismatch', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLossAlgoId: null,
        takeProfit: '55000',
        takeProfitAlgoId: '200',
      });
      const tpOrder = createAlgoOrder({
        algoId: '200',
        type: 'TAKE_PROFIT_MARKET',
        triggerPrice: '56000',
      });

      mockExecutionsData = [execution];
      mockGetOpenAlgoOrders.mockResolvedValue([tpOrder]);

      const result = await service.syncWallet(wallet);

      expect(result.mismatchedOrders).toHaveLength(1);
      expect(result.mismatchedOrders[0]?.field).toBe('takeProfit');
      expect(result.mismatchedOrders[0]?.dbValue).toBe(55000);
      expect(result.mismatchedOrders[0]?.exchangeTriggerPrice).toBe('56000');
    });

    it('should not report mismatch when SL trigger prices match', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLoss: '45000',
        stopLossAlgoId: '100',
        takeProfitAlgoId: null,
      });
      const slOrder = createAlgoOrder({ algoId: '100', type: 'STOP_MARKET', triggerPrice: '45000' });

      mockExecutionsData = [execution];
      mockGetOpenAlgoOrders.mockResolvedValue([slOrder]);

      const result = await service.syncWallet(wallet);

      expect(result.mismatchedOrders).toHaveLength(0);
    });

    it('should emit risk alert via websocket when orphan orders found', async () => {
      const wallet = createTestWallet();
      const orphanOrder = createAlgoOrder({ algoId: '999', symbol: 'SOLUSDT' });

      mockExecutionsData = [];
      mockGetOpenAlgoOrders.mockResolvedValue([orphanOrder]);

      await service.syncWallet(wallet);

      expect(mockEmitRiskAlert).toHaveBeenCalledWith(
        'wallet-1',
        expect.objectContaining({
          type: 'ORPHAN_ORDERS',
          level: 'warning',
        })
      );
    });

    it('should emit risk alert for mismatched orders', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({ stopLossAlgoId: '100', takeProfitAlgoId: null });

      mockExecutionsData = [execution];

      await service.syncWallet(wallet);

      expect(mockEmitRiskAlert).toHaveBeenCalledWith(
        'wallet-1',
        expect.objectContaining({
          type: 'ORDER_MISMATCH',
          level: 'warning',
        })
      );
    });

    it('should not emit risk alert when no issues found', async () => {
      const wallet = createTestWallet();

      mockExecutionsData = [];

      await service.syncWallet(wallet);

      expect(mockEmitRiskAlert).not.toHaveBeenCalled();
    });

    it('should handle null websocket service gracefully', async () => {
      const wallet = createTestWallet();
      const orphanOrder = createAlgoOrder({ algoId: '999' });

      mockGetWebSocketService.mockReturnValue(null);
      mockExecutionsData = [];
      mockGetOpenAlgoOrders.mockResolvedValue([orphanOrder]);

      const result = await service.syncWallet(wallet);

      expect(result.orphanOrders).toHaveLength(1);
      expect(mockEmitRiskAlert).not.toHaveBeenCalled();
    });

    it('should handle errors during sync and mark synced as false', async () => {
      const wallet = createTestWallet();
      mockCreateBinanceFuturesClient.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const result = await service.syncWallet(wallet);

      expect(result.synced).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('orphan order auto-cancellation', () => {
    it('should cancel orphan orders without exchange positions when autoCancelOrphans enabled', async () => {
      const wallet = createTestWallet();
      const orphanOrder = createAlgoOrder({ algoId: '999', symbol: 'ETHUSDT' });

      mockWalletsData = [wallet];
      mockExecutionsData = [];
      mockGetOpenAlgoOrders.mockResolvedValue([orphanOrder]);

      await service.start({ autoCancelOrphans: true });

      expect(mockCancelProtectionOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          wallet,
          symbol: 'ETHUSDT',
          marketType: 'FUTURES',
          algoId: '999',
        })
      );
    });

    it('should increment cancelledOrphans count on successful cancellation', async () => {
      const wallet = createTestWallet();
      const orphan1 = createAlgoOrder({ algoId: '999', symbol: 'ETHUSDT' });
      const orphan2 = createAlgoOrder({ algoId: '888', symbol: 'SOLUSDT' });

      mockWalletsData = [wallet];
      mockExecutionsData = [];
      mockGetOpenAlgoOrders.mockResolvedValue([orphan1, orphan2]);

      await service.start({ autoCancelOrphans: true });
      const results = await service.syncAllWallets();

      expect(results[0]?.cancelledOrphans).toBe(2);
    });

    it('should NOT cancel orphan orders that have exchange positions', async () => {
      const wallet = createTestWallet();
      const orphanOrder = createAlgoOrder({ algoId: '999', symbol: 'BTCUSDT' });

      mockWalletsData = [wallet];
      mockExecutionsData = [];
      mockGetOpenAlgoOrders.mockResolvedValue([orphanOrder]);
      mockGetPositions.mockResolvedValue([{ symbol: 'BTCUSDT', positionAmt: '1.0' }]);

      await service.start({ autoCancelOrphans: true });
      const results = await service.syncAllWallets();

      expect(mockCancelProtectionOrder).not.toHaveBeenCalled();
      expect(results[0]?.cancelledOrphans).toBe(0);
      expect(results[0]?.orphanOrders).toHaveLength(1);
    });

    it('should not cancel orphan orders when autoCancelOrphans is disabled', async () => {
      const wallet = createTestWallet();
      const orphanOrder = createAlgoOrder({ algoId: '999', symbol: 'ETHUSDT' });

      mockWalletsData = [wallet];
      mockExecutionsData = [];
      mockGetOpenAlgoOrders.mockResolvedValue([orphanOrder]);

      await service.start({ autoCancelOrphans: false });
      const results = await service.syncAllWallets();

      expect(mockCancelProtectionOrder).not.toHaveBeenCalled();
      expect(results[0]?.orphanOrders).toHaveLength(1);
    });

    it('should handle cancellation errors gracefully', async () => {
      const wallet = createTestWallet();
      const orphanOrder = createAlgoOrder({ algoId: '999', symbol: 'ETHUSDT' });

      mockWalletsData = [wallet];
      mockExecutionsData = [];
      mockGetOpenAlgoOrders.mockResolvedValue([orphanOrder]);
      mockCancelProtectionOrder.mockRejectedValue(new Error('Cancel failed'));

      await service.start({ autoCancelOrphans: true });
      const results = await service.syncAllWallets();

      expect(results[0]?.cancelledOrphans).toBe(0);
      expect(results[0]?.orphanOrders).toHaveLength(1);
    });
  });

  describe('mismatch auto-fixing', () => {
    it('should auto-fix SL by syncing from exchange when alternative SL exists', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLossAlgoId: '100',
        takeProfitAlgoId: null,
      });
      const alternativeSl = createAlgoOrder({
        algoId: '150',
        type: 'STOP_MARKET',
        triggerPrice: '44500',
      });

      mockWalletsData = [wallet];
      mockExecutionsData = [execution];
      mockGetOpenAlgoOrders.mockResolvedValue([alternativeSl]);

      await service.start({ autoFixMismatches: true });
      const results = await service.syncAllWallets();

      expect(mockSyncProtectionOrderIdFromExchange).toHaveBeenCalledWith(
        'exec-1',
        'stopLoss',
        '150',
        44500
      );
      expect(results[0]?.fixedOrders).toHaveLength(1);
      expect(results[0]?.fixedOrders[0]?.field).toBe('stopLoss');
      expect(results[0]?.fixedOrders[0]?.newAlgoId).toBe('150');
    });

    it('should auto-fix TP by syncing from exchange when alternative TP exists', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLossAlgoId: null,
        takeProfitAlgoId: '200',
      });
      const alternativeTp = createAlgoOrder({
        algoId: '250',
        type: 'TAKE_PROFIT_MARKET',
        triggerPrice: '56000',
      });

      mockWalletsData = [wallet];
      mockExecutionsData = [execution];
      mockGetOpenAlgoOrders.mockResolvedValue([alternativeTp]);

      await service.start({ autoFixMismatches: true });
      const results = await service.syncAllWallets();

      expect(mockSyncProtectionOrderIdFromExchange).toHaveBeenCalledWith(
        'exec-1',
        'takeProfit',
        '250',
        56000
      );
      expect(results[0]?.fixedOrders).toHaveLength(1);
      expect(results[0]?.fixedOrders[0]?.field).toBe('takeProfit');
    });

    it('should clear stale SL order ID when no matching SL on exchange', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLossAlgoId: '100',
        takeProfitAlgoId: null,
      });

      mockWalletsData = [wallet];
      mockExecutionsData = [execution];

      await service.start({ autoFixMismatches: true });
      const results = await service.syncAllWallets();

      expect(mockClearProtectionOrderIds).toHaveBeenCalledWith('exec-1', 'stopLoss');
      expect(results[0]?.fixedOrders).toHaveLength(1);
      expect(results[0]?.fixedOrders[0]?.newAlgoId).toBe('');
    });

    it('should clear stale TP order ID when no matching TP on exchange', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLossAlgoId: null,
        takeProfitAlgoId: '200',
      });

      mockWalletsData = [wallet];
      mockExecutionsData = [execution];

      await service.start({ autoFixMismatches: true });
      const results = await service.syncAllWallets();

      expect(mockClearProtectionOrderIds).toHaveBeenCalledWith('exec-1', 'takeProfit');
      expect(results[0]?.fixedOrders).toHaveLength(1);
      expect(results[0]?.fixedOrders[0]?.newAlgoId).toBe('');
    });

    it('should auto-fix SL trigger price mismatch', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLoss: '45000',
        stopLossAlgoId: '100',
        takeProfitAlgoId: null,
      });
      const slOrder = createAlgoOrder({ algoId: '100', type: 'STOP_MARKET', triggerPrice: '44000' });

      mockWalletsData = [wallet];
      mockExecutionsData = [execution];
      mockGetOpenAlgoOrders.mockResolvedValue([slOrder]);

      await service.start({ autoFixMismatches: true });
      const results = await service.syncAllWallets();

      expect(mockSyncProtectionOrderIdFromExchange).toHaveBeenCalledWith(
        'exec-1',
        'stopLoss',
        '100',
        44000
      );
      expect(results[0]?.fixedOrders).toHaveLength(1);
    });

    it('should auto-fix TP trigger price mismatch', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLossAlgoId: null,
        takeProfit: '55000',
        takeProfitAlgoId: '200',
      });
      const tpOrder = createAlgoOrder({
        algoId: '200',
        type: 'TAKE_PROFIT_MARKET',
        triggerPrice: '56000',
      });

      mockWalletsData = [wallet];
      mockExecutionsData = [execution];
      mockGetOpenAlgoOrders.mockResolvedValue([tpOrder]);

      await service.start({ autoFixMismatches: true });
      const results = await service.syncAllWallets();

      expect(mockSyncProtectionOrderIdFromExchange).toHaveBeenCalledWith(
        'exec-1',
        'takeProfit',
        '200',
        56000
      );
      expect(results[0]?.fixedOrders).toHaveLength(1);
    });

    it('should record mismatch when auto-fix of SL sync fails', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLossAlgoId: '100',
        takeProfitAlgoId: null,
      });
      const alternativeSl = createAlgoOrder({
        algoId: '150',
        type: 'STOP_MARKET',
        triggerPrice: '44500',
      });

      mockWalletsData = [wallet];
      mockExecutionsData = [execution];
      mockGetOpenAlgoOrders.mockResolvedValue([alternativeSl]);
      mockSyncProtectionOrderIdFromExchange.mockRejectedValue(new Error('DB update failed'));

      await service.start({ autoFixMismatches: true });
      const results = await service.syncAllWallets();

      expect(results[0]?.fixedOrders).toHaveLength(0);
      expect(results[0]?.mismatchedOrders).toHaveLength(1);
      expect(results[0]?.mismatchedOrders[0]?.field).toBe('stopLoss');
    });

    it('should record mismatch when auto-fix of TP sync fails', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLossAlgoId: null,
        takeProfitAlgoId: '200',
      });
      const alternativeTp = createAlgoOrder({
        algoId: '250',
        type: 'TAKE_PROFIT_MARKET',
        triggerPrice: '56000',
      });

      mockWalletsData = [wallet];
      mockExecutionsData = [execution];
      mockGetOpenAlgoOrders.mockResolvedValue([alternativeTp]);
      mockSyncProtectionOrderIdFromExchange.mockRejectedValue(new Error('DB update failed'));

      await service.start({ autoFixMismatches: true });
      const results = await service.syncAllWallets();

      expect(results[0]?.fixedOrders).toHaveLength(0);
      expect(results[0]?.mismatchedOrders).toHaveLength(1);
      expect(results[0]?.mismatchedOrders[0]?.field).toBe('takeProfit');
    });

    it('should record mismatch when clearing stale SL fails', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLossAlgoId: '100',
        takeProfitAlgoId: null,
      });

      mockWalletsData = [wallet];
      mockExecutionsData = [execution];
      mockClearProtectionOrderIds.mockRejectedValue(new Error('Clear failed'));

      await service.start({ autoFixMismatches: true });
      const results = await service.syncAllWallets();

      expect(results[0]?.fixedOrders).toHaveLength(0);
      expect(results[0]?.mismatchedOrders).toHaveLength(1);
    });

    it('should record mismatch when clearing stale TP fails', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLossAlgoId: null,
        takeProfitAlgoId: '200',
      });

      mockWalletsData = [wallet];
      mockExecutionsData = [execution];
      mockClearProtectionOrderIds.mockRejectedValue(new Error('Clear failed'));

      await service.start({ autoFixMismatches: true });
      const results = await service.syncAllWallets();

      expect(results[0]?.fixedOrders).toHaveLength(0);
      expect(results[0]?.mismatchedOrders).toHaveLength(1);
      expect(results[0]?.mismatchedOrders[0]?.field).toBe('takeProfit');
    });

    it('should record mismatch when auto-fix of SL trigger price fails', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLoss: '45000',
        stopLossAlgoId: '100',
        takeProfitAlgoId: null,
      });
      const slOrder = createAlgoOrder({ algoId: '100', type: 'STOP_MARKET', triggerPrice: '44000' });

      mockWalletsData = [wallet];
      mockExecutionsData = [execution];
      mockGetOpenAlgoOrders.mockResolvedValue([slOrder]);
      mockSyncProtectionOrderIdFromExchange.mockRejectedValue(new Error('Sync failed'));

      await service.start({ autoFixMismatches: true });
      const results = await service.syncAllWallets();

      expect(results[0]?.fixedOrders).toHaveLength(0);
      expect(results[0]?.mismatchedOrders).toHaveLength(1);
      expect(results[0]?.mismatchedOrders[0]?.exchangeTriggerPrice).toBe('44000');
    });

    it('should record mismatch when auto-fix of TP trigger price fails', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLossAlgoId: null,
        takeProfit: '55000',
        takeProfitAlgoId: '200',
      });
      const tpOrder = createAlgoOrder({
        algoId: '200',
        type: 'TAKE_PROFIT_MARKET',
        triggerPrice: '56000',
      });

      mockWalletsData = [wallet];
      mockExecutionsData = [execution];
      mockGetOpenAlgoOrders.mockResolvedValue([tpOrder]);
      mockSyncProtectionOrderIdFromExchange.mockRejectedValue(new Error('Sync failed'));

      await service.start({ autoFixMismatches: true });
      const results = await service.syncAllWallets();

      expect(results[0]?.fixedOrders).toHaveLength(0);
      expect(results[0]?.mismatchedOrders).toHaveLength(1);
      expect(results[0]?.mismatchedOrders[0]?.exchangeTriggerPrice).toBe('56000');
    });
  });

  describe('runOnce()', () => {
    it('should sync all wallets once and return results', async () => {
      mockWalletsData = [];
      const results = await service.runOnce();
      expect(results).toEqual([]);
    });

    it('should temporarily override autoCancelOrphans', async () => {
      const wallet = createTestWallet();
      const orphanOrder = createAlgoOrder({ algoId: '999', symbol: 'ETHUSDT' });

      mockWalletsData = [wallet];
      mockExecutionsData = [];
      mockGetOpenAlgoOrders.mockResolvedValue([orphanOrder]);

      await service.runOnce({ autoCancelOrphans: true });

      expect(mockCancelProtectionOrder).toHaveBeenCalled();

      vi.clearAllMocks();
      mockGetOpenAlgoOrders.mockResolvedValue([orphanOrder]);
      mockGetPositions.mockResolvedValue([]);
      mockCreateBinanceFuturesClient.mockReturnValue({});
      mockIsPaperWallet.mockReturnValue(false);
      mockGetWebSocketService.mockReturnValue({ emitRiskAlert: mockEmitRiskAlert });

      await service.syncAllWallets();

      expect(mockCancelProtectionOrder).not.toHaveBeenCalled();
    });

    it('should temporarily override autoFixMismatches', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLossAlgoId: '100',
        takeProfitAlgoId: null,
      });

      mockWalletsData = [wallet];
      mockExecutionsData = [execution];

      await service.runOnce({ autoFixMismatches: true });

      expect(mockClearProtectionOrderIds).toHaveBeenCalled();

      vi.clearAllMocks();
      mockGetOpenAlgoOrders.mockResolvedValue([]);
      mockGetPositions.mockResolvedValue([]);
      mockCreateBinanceFuturesClient.mockReturnValue({});
      mockIsPaperWallet.mockReturnValue(false);
      mockGetWebSocketService.mockReturnValue({ emitRiskAlert: mockEmitRiskAlert });
      mockClearProtectionOrderIds.mockResolvedValue(undefined);

      await service.syncAllWallets();

      expect(mockClearProtectionOrderIds).not.toHaveBeenCalled();
    });

    it('should restore previous options after runOnce completes', async () => {
      mockWalletsData = [];
      await service.start({ autoCancelOrphans: true, autoFixMismatches: true });

      const wallet = createTestWallet();
      const orphanOrder = createAlgoOrder({ algoId: '999', symbol: 'ETHUSDT' });
      const execution = createTestExecution({
        stopLossAlgoId: '100',
        takeProfitAlgoId: null,
      });

      mockWalletsData = [wallet];
      mockExecutionsData = [execution];
      mockGetOpenAlgoOrders.mockResolvedValue([orphanOrder]);

      await service.runOnce({ autoCancelOrphans: false, autoFixMismatches: false });

      expect(mockCancelProtectionOrder).not.toHaveBeenCalled();
      expect(mockClearProtectionOrderIds).not.toHaveBeenCalled();

      vi.clearAllMocks();
      mockGetOpenAlgoOrders.mockResolvedValue([orphanOrder]);
      mockGetPositions.mockResolvedValue([]);
      mockCreateBinanceFuturesClient.mockReturnValue({});
      mockIsPaperWallet.mockReturnValue(false);
      mockGetWebSocketService.mockReturnValue({ emitRiskAlert: mockEmitRiskAlert });
      mockCancelProtectionOrder.mockResolvedValue(true);
      mockClearProtectionOrderIds.mockResolvedValue(undefined);

      await service.syncAllWallets();

      expect(mockClearProtectionOrderIds).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle execution with null stopLoss value in mismatch detection', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLoss: null,
        stopLossAlgoId: '100',
        takeProfitAlgoId: null,
      });

      mockExecutionsData = [execution];

      const result = await service.syncWallet(wallet);

      expect(result.mismatchedOrders).toHaveLength(1);
      expect(result.mismatchedOrders[0]?.dbValue).toBeNull();
    });

    it('should handle execution with null takeProfit value in mismatch detection', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        takeProfit: null,
        takeProfitAlgoId: '200',
        stopLossAlgoId: null,
      });

      mockExecutionsData = [execution];

      const result = await service.syncWallet(wallet);

      expect(result.mismatchedOrders).toHaveLength(1);
      expect(result.mismatchedOrders[0]?.dbValue).toBeNull();
    });

    it('should handle multiple executions with different symbols', async () => {
      const wallet = createTestWallet();
      const exec1 = createTestExecution({
        id: 'exec-1',
        symbol: 'BTCUSDT',
        stopLossAlgoId: '100',
        takeProfitAlgoId: null,
      });
      const exec2 = createTestExecution({
        id: 'exec-2',
        symbol: 'ETHUSDT',
        stopLoss: '3000',
        stopLossAlgoId: '300',
        takeProfitAlgoId: null,
      });
      const slBtc = createAlgoOrder({ algoId: '100', symbol: 'BTCUSDT', type: 'STOP_MARKET', triggerPrice: '45000' });
      const slEth = createAlgoOrder({ algoId: '300', symbol: 'ETHUSDT', type: 'STOP_MARKET', triggerPrice: '3000' });

      mockExecutionsData = [exec1, exec2];
      mockGetOpenAlgoOrders.mockResolvedValue([slBtc, slEth]);

      const result = await service.syncWallet(wallet);

      expect(result.orphanOrders).toHaveLength(0);
      expect(result.mismatchedOrders).toHaveLength(0);
    });

    it('should handle positions with zero positionAmt as no position', async () => {
      const wallet = createTestWallet();
      const orphanOrder = createAlgoOrder({ algoId: '999', symbol: 'BTCUSDT' });

      mockExecutionsData = [];
      mockGetOpenAlgoOrders.mockResolvedValue([orphanOrder]);
      mockGetPositions.mockResolvedValue([
        { symbol: 'BTCUSDT', positionAmt: '0' },
      ]);

      const result = await service.syncWallet(wallet);

      expect(result.orphanOrders[0]?.hasPositionOnExchange).toBe(false);
    });

    it('should skip positions without stopLossAlgoId or takeProfitAlgoId', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLossAlgoId: null,
        takeProfitAlgoId: null,
      });

      mockExecutionsData = [execution];

      const result = await service.syncWallet(wallet);

      expect(result.mismatchedOrders).toHaveLength(0);
      expect(result.fixedOrders).toHaveLength(0);
    });

    it('should handle triggerPrice with empty string', async () => {
      const wallet = createTestWallet();
      const orphanOrder = createAlgoOrder({
        algoId: '999',
        symbol: 'ETHUSDT',
        triggerPrice: '',
      });

      mockExecutionsData = [];
      mockGetOpenAlgoOrders.mockResolvedValue([orphanOrder]);

      const result = await service.syncWallet(wallet);

      expect(result.orphanOrders[0]?.triggerPrice).toBe('');
    });

    it('should handle both SL and TP mismatches for the same execution', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLoss: '45000',
        stopLossAlgoId: '100',
        takeProfit: '55000',
        takeProfitAlgoId: '200',
      });

      mockExecutionsData = [execution];

      const result = await service.syncWallet(wallet);

      expect(result.mismatchedOrders).toHaveLength(2);
      const fields = result.mismatchedOrders.map(m => m.field);
      expect(fields).toContain('stopLoss');
      expect(fields).toContain('takeProfit');
    });

    it('should populate orphan order details correctly', async () => {
      const wallet = createTestWallet();
      const orphanOrder = createAlgoOrder({
        algoId: '777',
        symbol: 'DOGEUSDT',
        type: 'TAKE_PROFIT_MARKET',
        side: 'BUY',
        triggerPrice: '0.15',
        quantity: '1000',
      });

      mockExecutionsData = [];
      mockGetOpenAlgoOrders.mockResolvedValue([orphanOrder]);

      const result = await service.syncWallet(wallet);

      expect(result.orphanOrders[0]).toEqual(expect.objectContaining({
        algoId: '777',
        symbol: 'DOGEUSDT',
        type: 'TAKE_PROFIT_MARKET',
        side: 'BUY',
        triggerPrice: '0.15',
        quantity: '1000',
        hasPositionOnExchange: false,
      }));
    });

    it('should handle undefined triggerPrice on algo order', async () => {
      const wallet = createTestWallet();
      const orphanOrder = createAlgoOrder({
        algoId: '999',
        symbol: 'ETHUSDT',
        triggerPrice: undefined,
      });

      mockExecutionsData = [];
      mockGetOpenAlgoOrders.mockResolvedValue([orphanOrder]);

      const result = await service.syncWallet(wallet);

      expect(result.orphanOrders[0]?.triggerPrice).toBe('');
    });

    it('should not report TP mismatch when trigger prices match', async () => {
      const wallet = createTestWallet();
      const execution = createTestExecution({
        stopLossAlgoId: null,
        takeProfit: '55000',
        takeProfitAlgoId: '200',
      });
      const tpOrder = createAlgoOrder({
        algoId: '200',
        type: 'TAKE_PROFIT_MARKET',
        triggerPrice: '55000',
      });

      mockExecutionsData = [execution];
      mockGetOpenAlgoOrders.mockResolvedValue([tpOrder]);

      const result = await service.syncWallet(wallet);

      expect(result.mismatchedOrders).toHaveLength(0);
    });
  });

  describe('reconcileOrdersTable() — race-aware status resolution', () => {
    // 2026-05-08 user report: every order created on the chart was
    // being marked EXPIRED ~30s after submission. Cause: the periodic
    // reconcile fetched `binanceOpenOrders` BEFORE the user submitted,
    // so the fresh order didn't appear in `liveIds` and was treated
    // as stale. The pre-fix code marked any non-FILLED, non-CANCELED
    // status as EXPIRED — which falsely caught NEW (still-live) orders.
    beforeEach(() => {
      mockUpdateSetCalls = [];
    });

    it('does NOT mark stale-snapshot orders as EXPIRED when Binance still says NEW', async () => {
      const wallet = createTestWallet();
      const getOrderMock = vi.fn().mockResolvedValue({ status: 'NEW' });
      mockCreateBinanceFuturesClient.mockReturnValue({ getOrder: getOrderMock });
      mockOrdersData = [{ orderId: '999', symbol: 'BTCUSDT' }];

      await service.syncWallet(wallet);

      expect(getOrderMock).toHaveBeenCalledWith({ symbol: 'BTCUSDT', orderId: 999 });
      const expiredWrites = mockUpdateSetCalls.filter((v) => v.status === 'EXPIRED');
      expect(expiredWrites).toHaveLength(0);
    });

    it('does NOT mark stale-snapshot orders as EXPIRED when Binance says PARTIALLY_FILLED', async () => {
      const wallet = createTestWallet();
      const getOrderMock = vi.fn().mockResolvedValue({ status: 'PARTIALLY_FILLED' });
      mockCreateBinanceFuturesClient.mockReturnValue({ getOrder: getOrderMock });
      mockOrdersData = [{ orderId: '888', symbol: 'BTCUSDT' }];

      await service.syncWallet(wallet);

      const expiredWrites = mockUpdateSetCalls.filter((v) => v.status === 'EXPIRED');
      expect(expiredWrites).toHaveLength(0);
    });

    it('still marks orders as EXPIRED when Binance confirms EXPIRED', async () => {
      const wallet = createTestWallet();
      const getOrderMock = vi.fn().mockResolvedValue({ status: 'EXPIRED' });
      mockCreateBinanceFuturesClient.mockReturnValue({ getOrder: getOrderMock });
      mockOrdersData = [{ orderId: '777', symbol: 'BTCUSDT' }];

      await service.syncWallet(wallet);

      const expiredWrites = mockUpdateSetCalls.filter((v) => v.status === 'EXPIRED');
      expect(expiredWrites.length).toBeGreaterThan(0);
    });

    it('marks order as FILLED when Binance confirms FILLED (recovers lost user-stream event)', async () => {
      const wallet = createTestWallet();
      const getOrderMock = vi.fn().mockResolvedValue({
        status: 'FILLED',
        avgPrice: '79826.30',
        executedQty: '0.01',
      });
      mockCreateBinanceFuturesClient.mockReturnValue({ getOrder: getOrderMock });
      mockOrdersData = [{ orderId: '555', symbol: 'BTCUSDT' }];

      await service.syncWallet(wallet);

      const filledWrites = mockUpdateSetCalls.filter((v) => v.status === 'FILLED');
      expect(filledWrites.length).toBeGreaterThan(0);
    });
  });
});
