import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TradingSetup } from '@marketmind/types';

vi.mock('../../../constants', () => ({
  EXIT_REASON: { SL_CREATION_FAILED: 'sl_creation_failed' },
  PROTECTION_ORDER_RETRY: { MAX_ATTEMPTS: 3, INITIAL_DELAY_MS: 100, MAX_DELAY_MS: 2000, BACKOFF_MULTIPLIER: 2 },
  RISK_ALERT_LEVELS: { WARNING: 'warning', CRITICAL: 'critical' },
  RISK_ALERT_TYPES: { ORDER_REJECTED: 'ORDER_REJECTED', UNPROTECTED_POSITION: 'UNPROTECTED_POSITION' },
  AUTO_TRADING_RETRY: { MAX_RETRIES: 3, INITIAL_DELAY_MS: 1000, MAX_DELAY_MS: 10000, BACKOFF_MULTIPLIER: 2 },
}));

vi.mock('../../../db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'exec-1' }]),
        onConflictDoNothing: vi.fn(),
      })),
    })),
  },
}));

vi.mock('../../../db/schema', () => ({
  tradeExecutions: {},
}));

vi.mock('../../../utils/errors', () => ({
  serializeError: vi.fn((e: unknown) => String(e)),
}));

vi.mock('../../../utils/retry', () => ({
  withRetrySafe: vi.fn(),
}));

vi.mock('../../auto-trading', () => ({
  autoTradingService: {
    createStopLossOrder: vi.fn(),
    createTakeProfitOrder: vi.fn(),
    closePosition: vi.fn(),
  },
}));

vi.mock('../../oco-orders', () => ({
  ocoOrderService: { createExitOCO: vi.fn() },
}));

vi.mock('../../websocket', () => ({
  getWebSocketService: vi.fn(),
}));

vi.mock('../utils', () => ({ log: vi.fn() }));

import { ProtectionOrderHandler } from '../protection-order-handler';
import { withRetrySafe } from '../../../utils/retry';
import { autoTradingService } from '../../auto-trading';
import { ocoOrderService } from '../../oco-orders';
import { getWebSocketService } from '../../websocket';
import { db } from '../../../db';
import type { ActiveWatcher } from '../types';

const mockWithRetrySafe = vi.mocked(withRetrySafe);
const mockAutoTradingService = vi.mocked(autoTradingService);
const mockOcoOrderService = vi.mocked(ocoOrderService);
const mockGetWebSocketService = vi.mocked(getWebSocketService);
const mockDb = vi.mocked(db);

const createWatcher = (overrides: Partial<ActiveWatcher> = {}): ActiveWatcher => ({
  walletId: 'w1',
  userId: 'u1',
  symbol: 'BTCUSDT',
  interval: '1h',
  marketType: 'FUTURES',
  exchange: 'BINANCE',
  enabledStrategies: ['setup_9_1'],
  isManual: false,
  lastProcessedTime: Date.now(),
  intervalId: setInterval(() => {}, 999999),
  ...overrides,
});

const createSetup = (overrides: Partial<TradingSetup> = {}): TradingSetup => ({
  type: 'setup_9_1',
  direction: 'LONG',
  entryPrice: 50000,
  stopLoss: 49000,
  takeProfit: 52000,
  confidence: 0.8,
  riskRewardRatio: 2,
  ...overrides,
} as TradingSetup);

const createWallet = () => ({
  id: 'w1',
  walletType: 'live' as const,
  exchange: 'BINANCE',
} as Parameters<typeof autoTradingService.createStopLossOrder>[0]);

const mockWsService = {
  emitRiskAlert: vi.fn(),
};

describe('ProtectionOrderHandler', () => {
  let handler: ProtectionOrderHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new ProtectionOrderHandler();
    mockGetWebSocketService.mockReturnValue(mockWsService as ReturnType<typeof getWebSocketService>);
  });

  describe('placeProtectionOrders - FUTURES market', () => {
    it('should place separate SL and TP orders when both succeed with regular orders', async () => {
      const watcher = createWatcher({ marketType: 'FUTURES' });
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: true, result: { orderId: 101, isAlgoOrder: false } })
        .mockResolvedValueOnce({ success: true, result: { orderId: 201, isAlgoOrder: false } });

      const result = await handler.placeProtectionOrders(watcher, setup, 52000, wallet, 0.1);

      expect(result.stopLossOrderId).toBe(101);
      expect(result.takeProfitOrderId).toBe(201);
      expect(result.stopLossAlgoId).toBeNull();
      expect(result.takeProfitAlgoId).toBeNull();
      expect(result.stopLossIsAlgo).toBe(false);
      expect(result.takeProfitIsAlgo).toBe(false);
      expect(result.orderListId).toBeNull();
      expect(mockWsService.emitRiskAlert).not.toHaveBeenCalled();
    });

    it('should place separate SL and TP orders when both succeed with algo orders', async () => {
      const watcher = createWatcher({ marketType: 'FUTURES' });
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: true, result: { algoId: 301, isAlgoOrder: true } })
        .mockResolvedValueOnce({ success: true, result: { algoId: 401, isAlgoOrder: true } });

      const result = await handler.placeProtectionOrders(watcher, setup, 52000, wallet, 0.1);

      expect(result.stopLossOrderId).toBeNull();
      expect(result.takeProfitOrderId).toBeNull();
      expect(result.stopLossAlgoId).toBe(301);
      expect(result.takeProfitAlgoId).toBe(401);
      expect(result.stopLossIsAlgo).toBe(true);
      expect(result.takeProfitIsAlgo).toBe(true);
      expect(mockWsService.emitRiskAlert).not.toHaveBeenCalled();
    });

    it('should handle mixed order types - SL regular and TP algo', async () => {
      const watcher = createWatcher({ marketType: 'FUTURES' });
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: true, result: { orderId: 101, isAlgoOrder: false } })
        .mockResolvedValueOnce({ success: true, result: { algoId: 401, isAlgoOrder: true } });

      const result = await handler.placeProtectionOrders(watcher, setup, 52000, wallet, 0.1);

      expect(result.stopLossOrderId).toBe(101);
      expect(result.stopLossIsAlgo).toBe(false);
      expect(result.takeProfitAlgoId).toBe(401);
      expect(result.takeProfitIsAlgo).toBe(true);
      expect(mockWsService.emitRiskAlert).not.toHaveBeenCalled();
    });

    it('should emit incomplete protection alert when SL fails and TP succeeds', async () => {
      const watcher = createWatcher({ marketType: 'FUTURES' });
      const setup = createSetup({ direction: 'SHORT' });
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: false, lastError: new Error('SL placement failed') })
        .mockResolvedValueOnce({ success: true, result: { orderId: 201, isAlgoOrder: false } });

      const result = await handler.placeProtectionOrders(watcher, setup, 48000, wallet, 0.1);

      expect(result.stopLossOrderId).toBeNull();
      expect(result.stopLossAlgoId).toBeNull();
      expect(result.takeProfitOrderId).toBe(201);
      expect(mockWsService.emitRiskAlert).toHaveBeenCalledOnce();
      expect(mockWsService.emitRiskAlert).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({
          type: 'ORDER_REJECTED',
          level: 'critical',
          symbol: 'BTCUSDT',
          data: expect.objectContaining({
            reason: 'incomplete_protection_orders',
            hasSL: false,
            hasTP: true,
          }),
        })
      );
    });

    it('should emit incomplete protection alert when SL succeeds and TP fails', async () => {
      const watcher = createWatcher({ marketType: 'FUTURES' });
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: true, result: { orderId: 101, isAlgoOrder: false } })
        .mockResolvedValueOnce({ success: false, lastError: new Error('TP placement failed') });

      const result = await handler.placeProtectionOrders(watcher, setup, 52000, wallet, 0.1);

      expect(result.stopLossOrderId).toBe(101);
      expect(result.takeProfitOrderId).toBeNull();
      expect(mockWsService.emitRiskAlert).toHaveBeenCalledOnce();
      expect(mockWsService.emitRiskAlert).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({
          data: expect.objectContaining({
            hasSL: true,
            hasTP: false,
          }),
        })
      );
    });

    it('should emit incomplete protection alert when both SL and TP fail', async () => {
      const watcher = createWatcher({ marketType: 'FUTURES' });
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: false, lastError: new Error('SL failed') })
        .mockResolvedValueOnce({ success: false, lastError: new Error('TP failed') });

      const result = await handler.placeProtectionOrders(watcher, setup, 52000, wallet, 0.1);

      expect(result.stopLossOrderId).toBeNull();
      expect(result.takeProfitOrderId).toBeNull();
      expect(result.stopLossAlgoId).toBeNull();
      expect(result.takeProfitAlgoId).toBeNull();
      expect(mockWsService.emitRiskAlert).toHaveBeenCalledOnce();
      expect(mockWsService.emitRiskAlert).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({
          data: expect.objectContaining({
            hasSL: false,
            hasTP: false,
          }),
        })
      );
    });

    it('should call withRetrySafe with correct retry options for FUTURES SL', async () => {
      const watcher = createWatcher({ marketType: 'FUTURES' });
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: true, result: { orderId: 101, isAlgoOrder: false } })
        .mockResolvedValueOnce({ success: true, result: { orderId: 201, isAlgoOrder: false } });

      await handler.placeProtectionOrders(watcher, setup, 52000, wallet, 0.5);

      expect(mockWithRetrySafe).toHaveBeenCalledTimes(2);
      expect(mockWithRetrySafe).toHaveBeenNthCalledWith(1, expect.any(Function), { maxRetries: 3, initialDelayMs: 100 });
      expect(mockWithRetrySafe).toHaveBeenNthCalledWith(2, expect.any(Function), { maxRetries: 3, initialDelayMs: 100 });
    });

    it('should not emit alert when SL algo order succeeds even though regular orderId is null', async () => {
      const watcher = createWatcher({ marketType: 'FUTURES' });
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: true, result: { algoId: 301, isAlgoOrder: true } })
        .mockResolvedValueOnce({ success: true, result: { orderId: 201, isAlgoOrder: false } });

      const result = await handler.placeProtectionOrders(watcher, setup, 52000, wallet, 0.1);

      expect(result.stopLossOrderId).toBeNull();
      expect(result.stopLossAlgoId).toBe(301);
      expect(mockWsService.emitRiskAlert).not.toHaveBeenCalled();
    });

    it('should handle no websocket service gracefully for incomplete protection alert', async () => {
      mockGetWebSocketService.mockReturnValue(null as ReturnType<typeof getWebSocketService>);
      const watcher = createWatcher({ marketType: 'FUTURES' });
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: false, lastError: new Error('SL failed') })
        .mockResolvedValueOnce({ success: false, lastError: new Error('TP failed') });

      const result = await handler.placeProtectionOrders(watcher, setup, 52000, wallet, 0.1);

      expect(result.stopLossOrderId).toBeNull();
      expect(result.takeProfitOrderId).toBeNull();
      expect(mockWsService.emitRiskAlert).not.toHaveBeenCalled();
    });
  });

  describe('placeProtectionOrders - Non-FUTURES (SPOT) market', () => {
    it('should place OCO order successfully and return correct IDs', async () => {
      const watcher = createWatcher({ marketType: 'SPOT' });
      const setup = createSetup();
      const wallet = createWallet();

      mockOcoOrderService.createExitOCO.mockResolvedValueOnce({
        orderListId: 500,
        stopLossOrderId: 501,
        takeProfitOrderId: 502,
      });

      const result = await handler.placeProtectionOrders(watcher, setup, 52000, wallet, 0.1);

      expect(result.orderListId).toBe(500);
      expect(result.stopLossOrderId).toBe(501);
      expect(result.takeProfitOrderId).toBe(502);
      expect(result.stopLossAlgoId).toBeNull();
      expect(result.takeProfitAlgoId).toBeNull();
      expect(result.stopLossIsAlgo).toBe(false);
      expect(result.takeProfitIsAlgo).toBe(false);
      expect(mockOcoOrderService.createExitOCO).toHaveBeenCalledWith(
        wallet, 'BTCUSDT', 0.1, 49000, 52000, 'LONG'
      );
    });

    it('should call OCO with correct direction for SHORT setup', async () => {
      const watcher = createWatcher({ marketType: 'SPOT' });
      const setup = createSetup({ direction: 'SHORT', stopLoss: 51000, takeProfit: 48000 });
      const wallet = createWallet();

      mockOcoOrderService.createExitOCO.mockResolvedValueOnce({
        orderListId: 600,
        stopLossOrderId: 601,
        takeProfitOrderId: 602,
      });

      await handler.placeProtectionOrders(watcher, setup, 48000, wallet, 0.2);

      expect(mockOcoOrderService.createExitOCO).toHaveBeenCalledWith(
        wallet, 'BTCUSDT', 0.2, 51000, 48000, 'SHORT'
      );
    });

    it('should fall back to separate orders when OCO returns null', async () => {
      const watcher = createWatcher({ marketType: 'SPOT' });
      const setup = createSetup();
      const wallet = createWallet();

      mockOcoOrderService.createExitOCO.mockResolvedValueOnce(null);

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: true, result: { orderId: 701, isAlgoOrder: false } })
        .mockResolvedValueOnce({ success: true, result: { orderId: 801, isAlgoOrder: false } });

      const result = await handler.placeProtectionOrders(watcher, setup, 52000, wallet, 0.1);

      expect(result.orderListId).toBeNull();
      expect(result.stopLossOrderId).toBe(701);
      expect(result.takeProfitOrderId).toBe(801);
      expect(mockWithRetrySafe).toHaveBeenCalledTimes(2);
    });

    it('should fall back to separate orders when OCO throws an error', async () => {
      const watcher = createWatcher({ marketType: 'SPOT' });
      const setup = createSetup();
      const wallet = createWallet();

      mockOcoOrderService.createExitOCO.mockRejectedValueOnce(new Error('OCO API error'));

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: true, result: { algoId: 901, isAlgoOrder: true } })
        .mockResolvedValueOnce({ success: true, result: { orderId: 1001, isAlgoOrder: false } });

      const result = await handler.placeProtectionOrders(watcher, setup, 52000, wallet, 0.1);

      expect(result.orderListId).toBeNull();
      expect(result.stopLossAlgoId).toBe(901);
      expect(result.stopLossIsAlgo).toBe(true);
      expect(result.takeProfitOrderId).toBe(1001);
      expect(result.takeProfitIsAlgo).toBe(false);
    });

    it('should not call fallback when OCO succeeds with valid orderListId', async () => {
      const watcher = createWatcher({ marketType: 'SPOT' });
      const setup = createSetup();
      const wallet = createWallet();

      mockOcoOrderService.createExitOCO.mockResolvedValueOnce({
        orderListId: 123,
        stopLossOrderId: 124,
        takeProfitOrderId: 125,
      });

      await handler.placeProtectionOrders(watcher, setup, 52000, wallet, 0.1);

      expect(mockWithRetrySafe).not.toHaveBeenCalled();
    });

    it('should handle fallback where both SL and TP fail after OCO throws', async () => {
      const watcher = createWatcher({ marketType: 'SPOT' });
      const setup = createSetup();
      const wallet = createWallet();

      mockOcoOrderService.createExitOCO.mockRejectedValueOnce(new Error('OCO error'));

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: false, lastError: new Error('SL fallback failed') })
        .mockResolvedValueOnce({ success: false, lastError: new Error('TP fallback failed') });

      const result = await handler.placeProtectionOrders(watcher, setup, 52000, wallet, 0.1);

      expect(result.stopLossOrderId).toBeNull();
      expect(result.takeProfitOrderId).toBeNull();
      expect(result.stopLossAlgoId).toBeNull();
      expect(result.takeProfitAlgoId).toBeNull();
      expect(result.orderListId).toBeNull();
    });
  });

  describe('placeFallbackProtectionOrders', () => {
    it('should place both SL and TP as regular orders', async () => {
      const watcher = createWatcher();
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: true, result: { orderId: 1100, isAlgoOrder: false } })
        .mockResolvedValueOnce({ success: true, result: { orderId: 1200, isAlgoOrder: false } });

      const result = await handler.placeFallbackProtectionOrders(wallet, watcher, setup, 52000, 0.5);

      expect(result.stopLossOrderId).toBe(1100);
      expect(result.takeProfitOrderId).toBe(1200);
      expect(result.stopLossIsAlgo).toBe(false);
      expect(result.takeProfitIsAlgo).toBe(false);
      expect(result.stopLossAlgoId).toBeNull();
      expect(result.takeProfitAlgoId).toBeNull();
    });

    it('should place both SL and TP as algo orders', async () => {
      const watcher = createWatcher();
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: true, result: { algoId: 1300, isAlgoOrder: true } })
        .mockResolvedValueOnce({ success: true, result: { algoId: 1400, isAlgoOrder: true } });

      const result = await handler.placeFallbackProtectionOrders(wallet, watcher, setup, 52000, 0.5);

      expect(result.stopLossOrderId).toBeNull();
      expect(result.takeProfitOrderId).toBeNull();
      expect(result.stopLossAlgoId).toBe(1300);
      expect(result.takeProfitAlgoId).toBe(1400);
      expect(result.stopLossIsAlgo).toBe(true);
      expect(result.takeProfitIsAlgo).toBe(true);
    });

    it('should handle SL success and TP failure', async () => {
      const watcher = createWatcher();
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: true, result: { orderId: 1500, isAlgoOrder: false } })
        .mockResolvedValueOnce({ success: false, lastError: new Error('TP failed') });

      const result = await handler.placeFallbackProtectionOrders(wallet, watcher, setup, 52000, 0.5);

      expect(result.stopLossOrderId).toBe(1500);
      expect(result.takeProfitOrderId).toBeNull();
      expect(result.takeProfitAlgoId).toBeNull();
    });

    it('should handle SL failure and TP success', async () => {
      const watcher = createWatcher();
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: false, lastError: new Error('SL failed') })
        .mockResolvedValueOnce({ success: true, result: { orderId: 1600, isAlgoOrder: false } });

      const result = await handler.placeFallbackProtectionOrders(wallet, watcher, setup, 52000, 0.5);

      expect(result.stopLossOrderId).toBeNull();
      expect(result.stopLossAlgoId).toBeNull();
      expect(result.takeProfitOrderId).toBe(1600);
    });

    it('should handle both SL and TP failure', async () => {
      const watcher = createWatcher();
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: false, lastError: new Error('SL failed') })
        .mockResolvedValueOnce({ success: false, lastError: new Error('TP failed') });

      const result = await handler.placeFallbackProtectionOrders(wallet, watcher, setup, 52000, 0.5);

      expect(result.stopLossOrderId).toBeNull();
      expect(result.takeProfitOrderId).toBeNull();
      expect(result.stopLossAlgoId).toBeNull();
      expect(result.takeProfitAlgoId).toBeNull();
      expect(result.stopLossIsAlgo).toBe(false);
      expect(result.takeProfitIsAlgo).toBe(false);
    });

    it('should pass correct arguments to withRetrySafe for SL and TP', async () => {
      const watcher = createWatcher({ symbol: 'ETHUSDT', marketType: 'SPOT' });
      const setup = createSetup({ direction: 'SHORT', stopLoss: 3200 });
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: true, result: { orderId: 10, isAlgoOrder: false } })
        .mockResolvedValueOnce({ success: true, result: { orderId: 20, isAlgoOrder: false } });

      await handler.placeFallbackProtectionOrders(wallet, watcher, setup, 2800, 1.5);

      expect(mockWithRetrySafe).toHaveBeenCalledTimes(2);

      const slFn = mockWithRetrySafe.mock.calls[0]![0];
      const tpFn = mockWithRetrySafe.mock.calls[1]![0];

      await slFn();
      expect(mockAutoTradingService.createStopLossOrder).toHaveBeenCalledWith(
        wallet, 'ETHUSDT', 1.5, 3200, 'SHORT', 'SPOT'
      );

      await tpFn();
      expect(mockAutoTradingService.createTakeProfitOrder).toHaveBeenCalledWith(
        wallet, 'ETHUSDT', 1.5, 2800, 'SHORT', 'SPOT'
      );
    });
  });

  describe('placeSingleStopLoss', () => {
    it('should return regular order ID on success', async () => {
      const watcher = createWatcher();
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe.mockResolvedValueOnce({
        success: true,
        result: { orderId: 2001, isAlgoOrder: false },
      });

      const result = await handler.placeSingleStopLoss(wallet, watcher, setup, 0.3);

      expect(result.stopLossOrderId).toBe(2001);
      expect(result.stopLossAlgoId).toBeNull();
      expect(result.stopLossIsAlgo).toBe(false);
    });

    it('should return algo order ID on success with algo order', async () => {
      const watcher = createWatcher();
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe.mockResolvedValueOnce({
        success: true,
        result: { algoId: 2002, isAlgoOrder: true },
      });

      const result = await handler.placeSingleStopLoss(wallet, watcher, setup, 0.3);

      expect(result.stopLossOrderId).toBeNull();
      expect(result.stopLossAlgoId).toBe(2002);
      expect(result.stopLossIsAlgo).toBe(true);
    });

    it('should return all null on failure', async () => {
      const watcher = createWatcher();
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe.mockResolvedValueOnce({
        success: false,
        lastError: new Error('SL creation timeout'),
      });

      const result = await handler.placeSingleStopLoss(wallet, watcher, setup, 0.3);

      expect(result.stopLossOrderId).toBeNull();
      expect(result.stopLossAlgoId).toBeNull();
      expect(result.stopLossIsAlgo).toBe(false);
    });

    it('should call withRetrySafe with correct arguments', async () => {
      const watcher = createWatcher({ symbol: 'SOLUSDT', marketType: 'FUTURES' });
      const setup = createSetup({ direction: 'SHORT', stopLoss: 180 });
      const wallet = createWallet();

      mockWithRetrySafe.mockResolvedValueOnce({
        success: true,
        result: { orderId: 2003, isAlgoOrder: false },
      });

      await handler.placeSingleStopLoss(wallet, watcher, setup, 10);

      expect(mockWithRetrySafe).toHaveBeenCalledOnce();
      expect(mockWithRetrySafe).toHaveBeenCalledWith(expect.any(Function), { maxRetries: 3, initialDelayMs: 100 });

      const slFn = mockWithRetrySafe.mock.calls[0]![0];
      await slFn();
      expect(mockAutoTradingService.createStopLossOrder).toHaveBeenCalledWith(
        wallet, 'SOLUSDT', 10, 180, 'SHORT', 'FUTURES'
      );
    });
  });

  describe('handleFailedProtection', () => {
    const defaultArgs = () => ({
      watcher: createWatcher(),
      setup: createSetup(),
      effectiveTakeProfit: 52000 as number | undefined,
      wallet: createWallet(),
      actualEntryPrice: 50000,
      actualQuantity: 0.1,
      executionId: 'exec-123',
      setupId: 'setup-456',
      entryOrderId: 789,
    });

    it('should close position and return shouldReturn true on successful compensation', async () => {
      const args = defaultArgs();
      mockAutoTradingService.closePosition.mockResolvedValueOnce({
        orderId: 3001,
        avgPrice: 49950,
      });

      const result = await handler.handleFailedProtection(
        args.watcher, args.setup, args.effectiveTakeProfit, args.wallet,
        args.actualEntryPrice, args.actualQuantity, args.executionId,
        args.setupId, args.entryOrderId
      );

      expect(result.shouldReturn).toBe(true);
      expect(mockAutoTradingService.closePosition).toHaveBeenCalledWith(
        args.wallet, 'BTCUSDT', 0.1, 'SELL', 'FUTURES'
      );
    });

    it('should close position with BUY side for SHORT direction', async () => {
      const args = defaultArgs();
      args.setup = createSetup({ direction: 'SHORT' });
      mockAutoTradingService.closePosition.mockResolvedValueOnce({
        orderId: 3002,
        avgPrice: 50100,
      });

      await handler.handleFailedProtection(
        args.watcher, args.setup, args.effectiveTakeProfit, args.wallet,
        args.actualEntryPrice, args.actualQuantity, args.executionId,
        args.setupId, args.entryOrderId
      );

      expect(mockAutoTradingService.closePosition).toHaveBeenCalledWith(
        args.wallet, 'BTCUSDT', 0.1, 'BUY', 'FUTURES'
      );
    });

    it('should emit WARNING risk alert on successful compensation', async () => {
      const args = defaultArgs();
      mockAutoTradingService.closePosition.mockResolvedValueOnce({
        orderId: 3003,
        avgPrice: 49800,
      });

      await handler.handleFailedProtection(
        args.watcher, args.setup, args.effectiveTakeProfit, args.wallet,
        args.actualEntryPrice, args.actualQuantity, args.executionId,
        args.setupId, args.entryOrderId
      );

      expect(mockWsService.emitRiskAlert).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({
          type: 'ORDER_REJECTED',
          level: 'warning',
          symbol: 'BTCUSDT',
          data: expect.objectContaining({
            reason: 'sl_creation_failed_compensation',
            side: 'LONG',
            entryPrice: '50000',
            exitPrice: '49800',
          }),
        })
      );
    });

    it('should insert trade execution record on successful compensation', async () => {
      const args = defaultArgs();
      mockAutoTradingService.closePosition.mockResolvedValueOnce({
        orderId: 3004,
        avgPrice: 49900,
      });

      await handler.handleFailedProtection(
        args.watcher, args.setup, args.effectiveTakeProfit, args.wallet,
        args.actualEntryPrice, args.actualQuantity, args.executionId,
        args.setupId, args.entryOrderId
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should return shouldReturn false when closePosition returns null', async () => {
      const args = defaultArgs();
      mockAutoTradingService.closePosition.mockResolvedValueOnce(null);

      const result = await handler.handleFailedProtection(
        args.watcher, args.setup, args.effectiveTakeProfit, args.wallet,
        args.actualEntryPrice, args.actualQuantity, args.executionId,
        args.setupId, args.entryOrderId
      );

      expect(result.shouldReturn).toBe(false);
    });

    it('should emit CRITICAL unprotected position alert when closePosition returns null', async () => {
      const args = defaultArgs();
      mockAutoTradingService.closePosition.mockResolvedValueOnce(null);

      await handler.handleFailedProtection(
        args.watcher, args.setup, args.effectiveTakeProfit, args.wallet,
        args.actualEntryPrice, args.actualQuantity, args.executionId,
        args.setupId, args.entryOrderId
      );

      expect(mockWsService.emitRiskAlert).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({
          type: 'UNPROTECTED_POSITION',
          level: 'critical',
          symbol: 'BTCUSDT',
          data: expect.objectContaining({
            reason: 'sl_creation_failed_compensation_failed',
            side: 'LONG',
            quantity: '0.1',
            entryPrice: '50000',
            marketType: 'FUTURES',
            executionId: 'exec-123',
          }),
        })
      );
    });

    it('should return shouldReturn false when closePosition throws an error', async () => {
      const args = defaultArgs();
      mockAutoTradingService.closePosition.mockRejectedValueOnce(new Error('Exchange unavailable'));

      const result = await handler.handleFailedProtection(
        args.watcher, args.setup, args.effectiveTakeProfit, args.wallet,
        args.actualEntryPrice, args.actualQuantity, args.executionId,
        args.setupId, args.entryOrderId
      );

      expect(result.shouldReturn).toBe(false);
    });

    it('should emit CRITICAL alert when closePosition throws an error', async () => {
      const args = defaultArgs();
      mockAutoTradingService.closePosition.mockRejectedValueOnce(new Error('Exchange unavailable'));

      await handler.handleFailedProtection(
        args.watcher, args.setup, args.effectiveTakeProfit, args.wallet,
        args.actualEntryPrice, args.actualQuantity, args.executionId,
        args.setupId, args.entryOrderId
      );

      expect(mockWsService.emitRiskAlert).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({
          type: 'UNPROTECTED_POSITION',
          level: 'critical',
          message: expect.stringContaining('MANUAL INTERVENTION REQUIRED'),
        })
      );
    });

    it('should handle undefined effectiveTakeProfit in trade execution record', async () => {
      const args = defaultArgs();
      args.effectiveTakeProfit = undefined;
      mockAutoTradingService.closePosition.mockResolvedValueOnce({
        orderId: 3005,
        avgPrice: 49850,
      });

      const result = await handler.handleFailedProtection(
        args.watcher, args.setup, args.effectiveTakeProfit, args.wallet,
        args.actualEntryPrice, args.actualQuantity, args.executionId,
        args.setupId, args.entryOrderId
      );

      expect(result.shouldReturn).toBe(true);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('emitIncompleteProtectionAlert (via placeProtectionOrders)', () => {
    it('should include stopLossAlgoId and takeProfitAlgoId in alert data', async () => {
      const watcher = createWatcher({ marketType: 'FUTURES' });
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: true, result: { algoId: 5001, isAlgoOrder: true } })
        .mockResolvedValueOnce({ success: false, lastError: new Error('TP failed') });

      await handler.placeProtectionOrders(watcher, setup, 52000, wallet, 0.1);

      expect(mockWsService.emitRiskAlert).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({
          data: expect.objectContaining({
            stopLossAlgoId: 5001,
            takeProfitAlgoId: null,
            hasSL: true,
            hasTP: false,
          }),
        })
      );
    });

    it('should include setup direction in the alert message', async () => {
      const watcher = createWatcher({ marketType: 'FUTURES', symbol: 'ETHUSDT' });
      const setup = createSetup({ direction: 'SHORT' });
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: false, lastError: new Error('SL failed') })
        .mockResolvedValueOnce({ success: true, result: { orderId: 5002, isAlgoOrder: false } });

      await handler.placeProtectionOrders(watcher, setup, 48000, wallet, 1.0);

      expect(mockWsService.emitRiskAlert).toHaveBeenCalledWith(
        watcher.walletId,
        expect.objectContaining({
          symbol: 'ETHUSDT',
          message: expect.stringContaining('SHORT'),
          data: expect.objectContaining({ side: 'SHORT' }),
        })
      );
    });

    it('should include SL MISSING and TP OK in message when SL fails', async () => {
      const watcher = createWatcher({ marketType: 'FUTURES' });
      const setup = createSetup();
      const wallet = createWallet();

      mockWithRetrySafe
        .mockResolvedValueOnce({ success: false, lastError: new Error('SL failed') })
        .mockResolvedValueOnce({ success: true, result: { orderId: 5003, isAlgoOrder: false } });

      await handler.placeProtectionOrders(watcher, setup, 52000, wallet, 0.1);

      expect(mockWsService.emitRiskAlert).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({
          message: expect.stringContaining('SL: MISSING'),
        })
      );
      expect(mockWsService.emitRiskAlert).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({
          message: expect.stringContaining('TP: OK'),
        })
      );
    });
  });

  describe('exported singleton', () => {
    it('should export a protectionOrderHandler instance', async () => {
      const { protectionOrderHandler } = await import('../protection-order-handler');
      expect(protectionOrderHandler).toBeInstanceOf(ProtectionOrderHandler);
    });
  });
});
