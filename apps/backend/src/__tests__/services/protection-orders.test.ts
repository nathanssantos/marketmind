import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Wallet } from '../../db/schema';

const mockCancelAlgoOrder = vi.fn();
const mockCancelOrder = vi.fn();
const mockSubmitAlgoOrder = vi.fn();
const mockGetOpenAlgoOrders = vi.fn();
const mockSubmitSpotOrder = vi.fn();
const mockCancelSpotOrder = vi.fn();

vi.mock('../../exchange', () => ({
  getFuturesClient: vi.fn(() => ({
    cancelAlgoOrder: mockCancelAlgoOrder,
    cancelOrder: mockCancelOrder,
    submitAlgoOrder: mockSubmitAlgoOrder,
    getOpenAlgoOrders: mockGetOpenAlgoOrders,
  })),
  getSpotClient: vi.fn(() => ({
    submitOrder: mockSubmitSpotOrder,
    cancelOrder: mockCancelSpotOrder,
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

vi.mock('../../utils/errors', () => ({
  serializeError: vi.fn((e: unknown) => (e instanceof Error ? e.message : String(e))),
}));

vi.mock('../../utils/formatters', () => ({
  formatPriceForBinance: vi.fn((price: number) => String(price)),
  formatQuantityForBinance: vi.fn((qty: number) => String(qty)),
}));

vi.mock('../../services/min-notional-filter', () => ({
  getMinNotionalFilterService: vi.fn(() => ({
    getSymbolFilters: vi.fn(() => Promise.resolve(new Map([
      ['BTCUSDT', { stepSize: 0.001, tickSize: 0.01 }],
    ]))),
  })),
}));

import {
  cancelProtectionOrder,
  createStopLossOrder,
  createTakeProfitOrder,
  updateStopLossOrder,
  updateTakeProfitOrder,
  cancelAllOpenProtectionOrdersOnExchange,
  cancelAllProtectionOrders,
  type ProtectionOrderParams,
  type UpdateProtectionOrderParams,
} from '../../services/protection-orders';
import { logger } from '../../services/logger';

const MOCK_ALGO_ID = 12345;
const MOCK_ORDER_ID = 67890;
const NEW_ALGO_ID = 99999;
const TRIGGER_PRICE = 50000;
const QUANTITY = 0.1;

const createMockWallet = (overrides: Partial<Wallet> = {}): Wallet => ({
  id: 'wallet-1',
  userId: 'user-1',
  name: 'Test Wallet',
  apiKeyEncrypted: 'enc-key',
  apiSecretEncrypted: 'enc-secret',
  walletType: 'live',
  marketType: 'FUTURES',
  initialBalance: null,
  currentBalance: null,
  totalDeposits: null,
  totalWithdrawals: null,
  lastTransferSyncAt: null,
  currency: 'USDT',
  exchange: 'BINANCE',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createBaseParams = (overrides: Partial<ProtectionOrderParams> = {}): ProtectionOrderParams => ({
  wallet: createMockWallet(),
  symbol: 'BTCUSDT',
  side: 'LONG',
  quantity: QUANTITY,
  triggerPrice: TRIGGER_PRICE,
  marketType: 'FUTURES',
  ...overrides,
});

const createUpdateParams = (overrides: Partial<UpdateProtectionOrderParams> = {}): UpdateProtectionOrderParams => ({
  ...createBaseParams(),
  currentAlgoId: MOCK_ALGO_ID,
  currentOrderId: null,
  ...overrides,
});

describe('protection-orders', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('updateStopLossOrder', () => {
    it('should cancel on first try and create new SL', async () => {
      mockCancelAlgoOrder.mockResolvedValueOnce(undefined);
      mockSubmitAlgoOrder.mockResolvedValueOnce({ algoId: NEW_ALGO_ID });

      const result = await updateStopLossOrder(createUpdateParams());

      expect(mockCancelAlgoOrder).toHaveBeenCalledTimes(1);
      expect(mockCancelAlgoOrder).toHaveBeenCalledWith(MOCK_ALGO_ID);
      expect(mockSubmitAlgoOrder).toHaveBeenCalledTimes(1);
      expect(result.algoId).toBe(NEW_ALGO_ID);
      expect(result.isAlgoOrder).toBe(true);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should retry cancel once on first failure, then create new SL', async () => {
      mockCancelAlgoOrder
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(undefined);
      mockSubmitAlgoOrder.mockResolvedValueOnce({ algoId: NEW_ALGO_ID });

      const result = await updateStopLossOrder(createUpdateParams());

      expect(mockCancelAlgoOrder).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'BTCUSDT', algoId: MOCK_ALGO_ID }),
        expect.stringContaining('retrying once'),
      );
      expect(result.algoId).toBe(NEW_ALGO_ID);
      expect(result.isAlgoOrder).toBe(true);
    });

    it('should create new SL even when both cancel attempts fail', async () => {
      mockCancelAlgoOrder
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'));
      mockSubmitAlgoOrder.mockResolvedValueOnce({ algoId: NEW_ALGO_ID });

      const result = await updateStopLossOrder(createUpdateParams());

      expect(mockCancelAlgoOrder).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'BTCUSDT', algoId: MOCK_ALGO_ID }),
        expect.stringContaining('ghost risk'),
      );
      expect(result.algoId).toBe(NEW_ALGO_ID);
      expect(result.isAlgoOrder).toBe(true);
    });

    it('should skip retry when no currentAlgoId or currentOrderId', async () => {
      mockSubmitAlgoOrder.mockResolvedValueOnce({ algoId: NEW_ALGO_ID });

      const result = await updateStopLossOrder(createUpdateParams({
        currentAlgoId: null,
        currentOrderId: null,
      }));

      expect(mockCancelAlgoOrder).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(result.algoId).toBe(NEW_ALGO_ID);
    });

    it('should treat already-cancelled orders as successful cancel (no retry)', async () => {
      mockCancelAlgoOrder.mockRejectedValueOnce(new Error('Unknown order'));
      mockSubmitAlgoOrder.mockResolvedValueOnce({ algoId: NEW_ALGO_ID });

      const result = await updateStopLossOrder(createUpdateParams());

      expect(mockCancelAlgoOrder).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('retrying once'),
      );
      expect(result.algoId).toBe(NEW_ALGO_ID);
    });
  });

  describe('updateTakeProfitOrder', () => {
    it('should cancel on first try and create new TP', async () => {
      mockCancelAlgoOrder.mockResolvedValueOnce(undefined);
      mockSubmitAlgoOrder.mockResolvedValueOnce({ algoId: NEW_ALGO_ID });

      const result = await updateTakeProfitOrder(createUpdateParams());

      expect(mockCancelAlgoOrder).toHaveBeenCalledTimes(1);
      expect(mockSubmitAlgoOrder).toHaveBeenCalledTimes(1);
      expect(result.algoId).toBe(NEW_ALGO_ID);
      expect(result.isAlgoOrder).toBe(true);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should retry cancel once on first failure, then create new TP', async () => {
      mockCancelAlgoOrder
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(undefined);
      mockSubmitAlgoOrder.mockResolvedValueOnce({ algoId: NEW_ALGO_ID });

      const result = await updateTakeProfitOrder(createUpdateParams());

      expect(mockCancelAlgoOrder).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'BTCUSDT', algoId: MOCK_ALGO_ID }),
        expect.stringContaining('retrying once'),
      );
      expect(result.algoId).toBe(NEW_ALGO_ID);
    });

    it('should create new TP even when both cancel attempts fail', async () => {
      mockCancelAlgoOrder
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'));
      mockSubmitAlgoOrder.mockResolvedValueOnce({ algoId: NEW_ALGO_ID });

      const result = await updateTakeProfitOrder(createUpdateParams());

      expect(mockCancelAlgoOrder).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'BTCUSDT', algoId: MOCK_ALGO_ID }),
        expect.stringContaining('ghost risk'),
      );
      expect(result.algoId).toBe(NEW_ALGO_ID);
    });

    it('should skip retry when no currentAlgoId or currentOrderId', async () => {
      mockSubmitAlgoOrder.mockResolvedValueOnce({ algoId: NEW_ALGO_ID });

      const result = await updateTakeProfitOrder(createUpdateParams({
        currentAlgoId: null,
        currentOrderId: null,
      }));

      expect(mockCancelAlgoOrder).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(result.algoId).toBe(NEW_ALGO_ID);
    });

    it('should treat already-cancelled orders as successful cancel (no retry)', async () => {
      mockCancelAlgoOrder.mockRejectedValueOnce(new Error('Order does not exist'));
      mockSubmitAlgoOrder.mockResolvedValueOnce({ algoId: NEW_ALGO_ID });

      const result = await updateTakeProfitOrder(createUpdateParams());

      expect(mockCancelAlgoOrder).toHaveBeenCalledTimes(1);
      expect(result.algoId).toBe(NEW_ALGO_ID);
    });
  });

  describe('cancelAllOpenProtectionOrdersOnExchange', () => {
    const baseParams = {
      wallet: createMockWallet(),
      symbol: 'BTCUSDT',
      marketType: 'FUTURES' as const,
    };

    it('should only cancel reduceOnly algo orders (SL/TP), not entry orders', async () => {
      const algoOrders = [
        { algoId: 111, reduceOnly: true },
        { algoId: 222, reduceOnly: false },
        { algoId: 333, reduceOnly: true },
      ];
      mockGetOpenAlgoOrders.mockResolvedValueOnce(algoOrders);
      mockCancelAlgoOrder.mockResolvedValue(undefined);

      await cancelAllOpenProtectionOrdersOnExchange(baseParams);

      expect(mockGetOpenAlgoOrders).toHaveBeenCalledWith('BTCUSDT');
      expect(mockCancelAlgoOrder).toHaveBeenCalledTimes(2);
      expect(mockCancelAlgoOrder).toHaveBeenCalledWith(111);
      expect(mockCancelAlgoOrder).toHaveBeenCalledWith(333);
      expect(mockCancelAlgoOrder).not.toHaveBeenCalledWith(222);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'BTCUSDT', cancelled: 2, total: 3 }),
        expect.stringContaining('Cancelled reduceOnly algo orders'),
      );
    });

    it('should return early when no open algo orders exist', async () => {
      mockGetOpenAlgoOrders.mockResolvedValueOnce([]);

      await cancelAllOpenProtectionOrdersOnExchange(baseParams);

      expect(mockGetOpenAlgoOrders).toHaveBeenCalledWith('BTCUSDT');
      expect(mockCancelAlgoOrder).not.toHaveBeenCalled();
    });

    it('should handle individual cancel failures gracefully via Promise.allSettled', async () => {
      const algoOrders = [
        { algoId: 111, reduceOnly: true },
        { algoId: 222, reduceOnly: true },
      ];
      mockGetOpenAlgoOrders.mockResolvedValueOnce(algoOrders);
      mockCancelAlgoOrder
        .mockRejectedValueOnce(new Error('Unknown order'))
        .mockResolvedValueOnce(undefined);

      await cancelAllOpenProtectionOrdersOnExchange(baseParams);

      expect(mockCancelAlgoOrder).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'BTCUSDT', cancelled: 2, total: 2 }),
        expect.stringContaining('Cancelled reduceOnly algo orders'),
      );
    });

    it('should handle getOpenAlgoOrders failure gracefully', async () => {
      mockGetOpenAlgoOrders.mockRejectedValueOnce(new Error('API error'));

      await cancelAllOpenProtectionOrdersOnExchange(baseParams);

      expect(mockCancelAlgoOrder).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'BTCUSDT' }),
        expect.stringContaining('Failed to fetch/cancel'),
      );
    });

    it('should skip for non-FUTURES market type', async () => {
      await cancelAllOpenProtectionOrdersOnExchange({
        ...baseParams,
        marketType: 'SPOT',
      });

      expect(mockGetOpenAlgoOrders).not.toHaveBeenCalled();
      expect(mockCancelAlgoOrder).not.toHaveBeenCalled();
    });
  });

  describe('cancelProtectionOrder', () => {
    it('should cancel futures algo order successfully', async () => {
      mockCancelAlgoOrder.mockResolvedValueOnce(undefined);

      const result = await cancelProtectionOrder({
        wallet: createMockWallet(),
        symbol: 'BTCUSDT',
        marketType: 'FUTURES',
        algoId: MOCK_ALGO_ID,
        orderId: null,
      });

      expect(result).toBe(true);
      expect(mockCancelAlgoOrder).toHaveBeenCalledWith(MOCK_ALGO_ID);
    });

    it('should return true when algo order already cancelled', async () => {
      mockCancelAlgoOrder.mockRejectedValueOnce(new Error('Unknown order'));

      const result = await cancelProtectionOrder({
        wallet: createMockWallet(),
        symbol: 'BTCUSDT',
        marketType: 'FUTURES',
        algoId: MOCK_ALGO_ID,
        orderId: null,
      });

      expect(result).toBe(true);
    });

    it('should return false when cancel fails with non-known error', async () => {
      mockCancelAlgoOrder.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await cancelProtectionOrder({
        wallet: createMockWallet(),
        symbol: 'BTCUSDT',
        marketType: 'FUTURES',
        algoId: MOCK_ALGO_ID,
        orderId: null,
      });

      expect(result).toBe(false);
    });

    it('should cancel futures regular order by orderId', async () => {
      mockCancelOrder.mockResolvedValueOnce(undefined);

      const result = await cancelProtectionOrder({
        wallet: createMockWallet(),
        symbol: 'BTCUSDT',
        marketType: 'FUTURES',
        algoId: null,
        orderId: MOCK_ORDER_ID,
      });

      expect(result).toBe(true);
      expect(mockCancelOrder).toHaveBeenCalledWith('BTCUSDT', MOCK_ORDER_ID);
    });

    it('should return false for FUTURES with no algoId or orderId', async () => {
      const result = await cancelProtectionOrder({
        wallet: createMockWallet(),
        symbol: 'BTCUSDT',
        marketType: 'FUTURES',
        algoId: null,
        orderId: null,
      });

      expect(result).toBe(false);
    });

    it('should cancel spot order by orderId', async () => {
      mockCancelSpotOrder.mockResolvedValueOnce(undefined);

      const result = await cancelProtectionOrder({
        wallet: createMockWallet(),
        symbol: 'BTCUSDT',
        marketType: 'SPOT',
        algoId: null,
        orderId: MOCK_ORDER_ID,
      });

      expect(result).toBe(true);
      expect(mockCancelSpotOrder).toHaveBeenCalledWith('BTCUSDT', MOCK_ORDER_ID);
    });

    it('should return false for SPOT with no orderId', async () => {
      const result = await cancelProtectionOrder({
        wallet: createMockWallet(),
        symbol: 'BTCUSDT',
        marketType: 'SPOT',
        algoId: null,
        orderId: null,
      });

      expect(result).toBe(false);
    });
  });

  describe('createStopLossOrder', () => {
    it('should create futures SL algo order for LONG position', async () => {
      mockSubmitAlgoOrder.mockResolvedValueOnce({ algoId: NEW_ALGO_ID });

      const result = await createStopLossOrder(createBaseParams());

      expect(mockSubmitAlgoOrder).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'BTCUSDT',
        side: 'SELL',
        type: 'STOP_MARKET',
        reduceOnly: true,
      }));
      expect(result.algoId).toBe(NEW_ALGO_ID);
      expect(result.isAlgoOrder).toBe(true);
    });

    it('should create futures SL algo order for SHORT position', async () => {
      mockSubmitAlgoOrder.mockResolvedValueOnce({ algoId: NEW_ALGO_ID });

      const result = await createStopLossOrder(createBaseParams({ side: 'SHORT' }));

      expect(mockSubmitAlgoOrder).toHaveBeenCalledWith(expect.objectContaining({
        side: 'BUY',
        type: 'STOP_MARKET',
      }));
      expect(result.algoId).toBe(NEW_ALGO_ID);
    });

    it('should create spot SL order', async () => {
      mockSubmitSpotOrder.mockResolvedValueOnce({ orderId: MOCK_ORDER_ID });

      const result = await createStopLossOrder(createBaseParams({ marketType: 'SPOT' }));

      expect(mockSubmitSpotOrder).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'BTCUSDT',
        side: 'SELL',
        type: 'STOP_LOSS_LIMIT',
        timeInForce: 'GTC',
      }));
      expect(result.orderId).toBe(MOCK_ORDER_ID);
      expect(result.isAlgoOrder).toBe(false);
    });
  });

  describe('createTakeProfitOrder', () => {
    it('should create futures TP algo order for LONG position', async () => {
      mockSubmitAlgoOrder.mockResolvedValueOnce({ algoId: NEW_ALGO_ID });

      const result = await createTakeProfitOrder(createBaseParams());

      expect(mockSubmitAlgoOrder).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'BTCUSDT',
        side: 'SELL',
        type: 'TAKE_PROFIT_MARKET',
        reduceOnly: true,
      }));
      expect(result.algoId).toBe(NEW_ALGO_ID);
      expect(result.isAlgoOrder).toBe(true);
    });

    it('should create spot TP order', async () => {
      mockSubmitSpotOrder.mockResolvedValueOnce({ orderId: MOCK_ORDER_ID });

      const result = await createTakeProfitOrder(createBaseParams({ marketType: 'SPOT' }));

      expect(mockSubmitSpotOrder).toHaveBeenCalledWith(expect.objectContaining({
        type: 'TAKE_PROFIT_LIMIT',
      }));
      expect(result.orderId).toBe(MOCK_ORDER_ID);
      expect(result.isAlgoOrder).toBe(false);
    });
  });

  describe('cancelAllProtectionOrders', () => {
    it('should cancel both SL and TP orders in parallel', async () => {
      mockCancelAlgoOrder.mockResolvedValue(undefined);

      await cancelAllProtectionOrders({
        wallet: createMockWallet(),
        symbol: 'BTCUSDT',
        marketType: 'FUTURES',
        stopLossAlgoId: 111,
        stopLossOrderId: null,
        takeProfitAlgoId: 222,
        takeProfitOrderId: null,
      });

      expect(mockCancelAlgoOrder).toHaveBeenCalledWith(111);
      expect(mockCancelAlgoOrder).toHaveBeenCalledWith(222);
    });
  });
});
