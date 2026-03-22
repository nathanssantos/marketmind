import { describe, expect, it, vi } from 'vitest';
import {
  createOptimisticEntry,
  mapExecutionToOrder,
  getOrderQuantity,
  submitEntryOrder,
} from '../chartOrderHelpers';
import type { BackendExecution } from '../../useOrderLinesRenderer';

vi.mock('@shared/utils', () => ({
  roundTradingPrice: (price: number) => price.toFixed(2),
  roundTradingQty: (qty: number) => qty.toFixed(4),
}));

describe('createOptimisticEntry', () => {
  it('creates an optimistic execution and returns its id', () => {
    const setOptimisticExecutions = vi.fn();
    const orderLoadingMapRef = { current: new Map<string, number>() };
    const manager = { markDirty: vi.fn() } as never;

    const id = createOptimisticEntry({
      symbol: 'BTCUSDT',
      side: 'LONG',
      price: 50000.123,
      marketType: 'FUTURES',
      getOrderQuantity: () => '0.001',
      setOptimisticExecutions,
      orderLoadingMapRef,
      manager,
    });

    expect(id).toMatch(/^opt-\d+$/);
    expect(setOptimisticExecutions).toHaveBeenCalledOnce();
    expect(orderLoadingMapRef.current.has(id)).toBe(true);
    expect(manager.markDirty).toHaveBeenCalledWith('overlays');
  });

  it('appends to existing executions via the setter callback', () => {
    const setOptimisticExecutions = vi.fn();
    const orderLoadingMapRef = { current: new Map<string, number>() };

    createOptimisticEntry({
      symbol: 'ETHUSDT',
      side: 'SHORT',
      price: 3000,
      marketType: 'SPOT',
      getOrderQuantity: () => '1.5',
      setOptimisticExecutions,
      orderLoadingMapRef,
      manager: null,
    });

    const updater = setOptimisticExecutions.mock.calls[0][0];
    const result = updater([]);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('ETHUSDT');
    expect(result[0].side).toBe('SHORT');
    expect(result[0].status).toBe('pending');
    expect(result[0].marketType).toBe('SPOT');
  });

  it('handles null manager gracefully', () => {
    const setOptimisticExecutions = vi.fn();
    const orderLoadingMapRef = { current: new Map<string, number>() };

    expect(() =>
      createOptimisticEntry({
        symbol: 'BTCUSDT',
        side: 'LONG',
        price: 50000,
        marketType: 'FUTURES',
        getOrderQuantity: () => '0.001',
        setOptimisticExecutions,
        orderLoadingMapRef,
        manager: null,
      }),
    ).not.toThrow();
  });
});

describe('mapExecutionToOrder', () => {
  const baseExec: BackendExecution = {
    id: 'exec-1',
    symbol: 'BTCUSDT',
    side: 'LONG',
    entryPrice: '50000.50',
    quantity: '0.1',
    stopLoss: '48000',
    takeProfit: '55000',
    status: 'open',
    setupType: 'breakout-retest',
  };

  it('maps a LONG open execution to a BUY FILLED order', () => {
    const order = mapExecutionToOrder(baseExec, 'wallet-1');
    expect(order.id).toBe('exec-1');
    expect(order.side).toBe('BUY');
    expect(order.status).toBe('FILLED');
    expect(order.entryPrice).toBe(50000.5);
    expect(order.stopLoss).toBe(48000);
    expect(order.takeProfit).toBe(55000);
    expect(order.isAutoTrade).toBe(true);
    expect(order.walletId).toBe('wallet-1');
    expect(order.orderDirection).toBe('long');
    expect(order.isPendingLimitOrder).toBe(false);
  });

  it('maps a SHORT pending execution to a SELL NEW order', () => {
    const exec: BackendExecution = { ...baseExec, side: 'SHORT', status: 'pending', setupType: null };
    const order = mapExecutionToOrder(exec, 'wallet-2');
    expect(order.side).toBe('SELL');
    expect(order.status).toBe('NEW');
    expect(order.executedQty).toBe('0');
    expect(order.isAutoTrade).toBe(false);
    expect(order.orderDirection).toBe('short');
    expect(order.isPendingLimitOrder).toBe(true);
  });

  it('handles null stopLoss and takeProfit', () => {
    const exec: BackendExecution = { ...baseExec, stopLoss: null, takeProfit: null };
    const order = mapExecutionToOrder(exec, 'wallet-1');
    expect(order.stopLoss).toBeUndefined();
    expect(order.takeProfit).toBeUndefined();
  });

  it('uses entryOrderType when available', () => {
    const exec: BackendExecution = { ...baseExec, entryOrderType: 'STOP_MARKET' };
    const order = mapExecutionToOrder(exec, 'wallet-1');
    expect(order.type).toBe('STOP_MARKET');
  });

  it('defaults to LIMIT type for pending when no entryOrderType', () => {
    const exec: BackendExecution = { ...baseExec, status: 'pending', entryOrderType: undefined };
    const order = mapExecutionToOrder(exec, 'wallet-1');
    expect(order.type).toBe('LIMIT');
  });

  it('defaults to MARKET type for non-pending when no entryOrderType', () => {
    const exec: BackendExecution = { ...baseExec, status: 'open', entryOrderType: undefined };
    const order = mapExecutionToOrder(exec, 'wallet-1');
    expect(order.type).toBe('MARKET');
  });
});

describe('getOrderQuantity', () => {
  it('calculates quantity from balance and percentage', () => {
    const result = getOrderQuantity(50000, '10000', 10);
    expect(result).toBe('0.0200');
  });

  it('returns 1 when balance is zero', () => {
    const result = getOrderQuantity(50000, '0', 10);
    expect(result).toBe('1.0000');
  });

  it('returns 1 when price is zero', () => {
    const result = getOrderQuantity(0, '10000', 10);
    expect(result).toBe('1.0000');
  });

  it('returns 1 when balance is undefined', () => {
    const result = getOrderQuantity(50000, undefined, 10);
    expect(result).toBe('1.0000');
  });

  it('handles 100% position size', () => {
    const result = getOrderQuantity(50000, '50000', 100);
    expect(result).toBe('1.0000');
  });
});

describe('submitEntryOrder', () => {
  it('submits a LIMIT order when BUY price is below market', async () => {
    const addBackendOrder = vi.fn().mockResolvedValue(undefined);

    await submitEntryOrder({
      backendWalletId: 'w1',
      symbol: 'BTCUSDT',
      side: 'BUY',
      price: 49000,
      marketPrice: 50000,
      quantity: '0.1',
      reduceOnly: false,
      addBackendOrder,
    });

    expect(addBackendOrder).toHaveBeenCalledWith({
      walletId: 'w1',
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'LIMIT',
      price: '49000.00',
      stopPrice: undefined,
      quantity: '0.1',
      reduceOnly: false,
    });
  });

  it('submits a STOP_MARKET order when BUY price is above market', async () => {
    const addBackendOrder = vi.fn().mockResolvedValue(undefined);

    await submitEntryOrder({
      backendWalletId: 'w1',
      symbol: 'BTCUSDT',
      side: 'BUY',
      price: 51000,
      marketPrice: 50000,
      quantity: '0.1',
      reduceOnly: false,
      addBackendOrder,
    });

    expect(addBackendOrder).toHaveBeenCalledWith({
      walletId: 'w1',
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'STOP_MARKET',
      price: undefined,
      stopPrice: '51000.00',
      quantity: '0.1',
      reduceOnly: false,
    });
  });

  it('submits a STOP_MARKET order when SELL price is below market', async () => {
    const addBackendOrder = vi.fn().mockResolvedValue(undefined);

    await submitEntryOrder({
      backendWalletId: 'w1',
      symbol: 'BTCUSDT',
      side: 'SELL',
      price: 49000,
      marketPrice: 50000,
      quantity: '0.1',
      reduceOnly: true,
      addBackendOrder,
    });

    expect(addBackendOrder).toHaveBeenCalledWith({
      walletId: 'w1',
      symbol: 'BTCUSDT',
      side: 'SELL',
      type: 'STOP_MARKET',
      price: undefined,
      stopPrice: '49000.00',
      quantity: '0.1',
      reduceOnly: true,
    });
  });

  it('submits a LIMIT order when SELL price is above market', async () => {
    const addBackendOrder = vi.fn().mockResolvedValue(undefined);

    await submitEntryOrder({
      backendWalletId: 'w1',
      symbol: 'BTCUSDT',
      side: 'SELL',
      price: 51000,
      marketPrice: 50000,
      quantity: '0.1',
      reduceOnly: false,
      addBackendOrder,
    });

    expect(addBackendOrder).toHaveBeenCalledWith({
      walletId: 'w1',
      symbol: 'BTCUSDT',
      side: 'SELL',
      type: 'LIMIT',
      price: '51000.00',
      stopPrice: undefined,
      quantity: '0.1',
      reduceOnly: false,
    });
  });

  it('uses LIMIT when marketPrice is zero', async () => {
    const addBackendOrder = vi.fn().mockResolvedValue(undefined);

    await submitEntryOrder({
      backendWalletId: 'w1',
      symbol: 'BTCUSDT',
      side: 'BUY',
      price: 50000,
      marketPrice: 0,
      quantity: '0.1',
      reduceOnly: false,
      addBackendOrder,
    });

    expect(addBackendOrder).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LIMIT' }),
    );
  });
});
