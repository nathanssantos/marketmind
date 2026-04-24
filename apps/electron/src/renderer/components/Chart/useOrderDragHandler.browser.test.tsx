import { act, renderHook } from '@testing-library/react';
import type { Order, OrderSide, OrderStatus } from '@marketmind/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useOrderDragHandler } from './useOrderDragHandler';

const waitTwoFrames = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

interface OrderOverrides {
  id?: string;
  side?: OrderSide;
  status?: OrderStatus;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  symbol?: string;
  closedAt?: Date;
}

const makeOrder = (overrides: OrderOverrides = {}): Order => ({
  symbol: overrides.symbol ?? 'BTCUSDT',
  orderId: overrides.id ?? 'order-1',
  orderListId: '-1',
  clientOrderId: `client-${overrides.id ?? 'order-1'}`,
  price: String(overrides.entryPrice ?? 50000),
  origQty: '1',
  executedQty: '0',
  cummulativeQuoteQty: '0',
  status: overrides.status ?? 'FILLED',
  timeInForce: 'GTC',
  type: 'LIMIT',
  side: overrides.side ?? 'BUY',
  time: 0,
  updateTime: 0,
  isWorking: true,
  origQuoteOrderQty: '0',
  id: overrides.id ?? 'order-1',
  entryPrice: overrides.entryPrice ?? 50000,
  stopLoss: overrides.stopLoss,
  takeProfit: overrides.takeProfit,
  orderDirection: (overrides.side ?? 'BUY') === 'BUY' ? 'long' : 'short',
  closedAt: overrides.closedAt,
});

interface HarnessOptions {
  orders?: Order[];
  enabled?: boolean;
  slDragEnabled?: boolean;
  tpDragEnabled?: boolean;
  slTightenOnly?: boolean;
  getOrderAtPosition?: (x: number, y: number) => Order | null;
}

const renderDragHook = (opts: HarnessOptions = {}) => {
  const updateOrder = vi.fn();
  const markDirty = vi.fn();
  const priceToY = vi.fn((price: number) => price);
  const yToPrice = vi.fn((y: number) => y);

  const config = {
    orders: opts.orders ?? [],
    updateOrder,
    priceToY,
    yToPrice,
    enabled: opts.enabled ?? true,
    slDragEnabled: opts.slDragEnabled,
    tpDragEnabled: opts.tpDragEnabled,
    slTightenOnly: opts.slTightenOnly,
    getOrderAtPosition: opts.getOrderAtPosition ?? (() => null),
    markDirty,
  };

  const hook = renderHook(() => useOrderDragHandler(config));
  return { hook, updateOrder, markDirty, priceToY, yToPrice };
};

describe('useOrderDragHandler', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('initial state is idle', () => {
    const { hook } = renderDragHook();
    expect(hook.result.current.isDragging).toBe(false);
    expect(hook.result.current.draggedOrder).toBeNull();
    expect(hook.result.current.dragType).toBeNull();
    expect(hook.result.current.previewPrice).toBeNull();
  });

  test('handleMouseDown starts entry drag on a pending order', () => {
    const pending = makeOrder({ id: 'p1', status: 'NEW' });
    const { hook, markDirty } = renderDragHook({
      orders: [pending],
      getOrderAtPosition: () => pending,
    });

    let started = false;
    act(() => {
      started = hook.result.current.handleMouseDown(100, 200);
    });

    expect(started).toBe(true);
    expect(hook.result.current.isDragging).toBe(true);
    expect(hook.result.current.dragType).toBe('entry');
    expect(hook.result.current.draggedOrder?.id).toBe('p1');
    expect(markDirty).toHaveBeenCalledWith('overlays');
  });

  test('handleMouseDown returns false for non-pending order', () => {
    const filled = makeOrder({ id: 'f1', status: 'FILLED' });
    const { hook } = renderDragHook({
      orders: [filled],
      getOrderAtPosition: () => filled,
    });

    let started = true;
    act(() => {
      started = hook.result.current.handleMouseDown(100, 200);
    });
    expect(started).toBe(false);
    expect(hook.result.current.isDragging).toBe(false);
  });

  test('handleMouseDown returns false when disabled', () => {
    const pending = makeOrder({ id: 'p1', status: 'NEW' });
    const { hook } = renderDragHook({
      orders: [pending],
      enabled: false,
      getOrderAtPosition: () => pending,
    });

    let started = true;
    act(() => {
      started = hook.result.current.handleMouseDown(100, 200);
    });
    expect(started).toBe(false);
    expect(hook.result.current.isDragging).toBe(false);
  });

  test('handleSLTPMouseDown starts SL drag on active order', () => {
    const active = makeOrder({ id: 'a1', status: 'FILLED', stopLoss: 49000 });
    const { hook } = renderDragHook({ orders: [active] });

    let started = false;
    act(() => {
      started = hook.result.current.handleSLTPMouseDown(10, 250, {
        orderId: 'a1',
        type: 'stopLoss',
        price: 49000,
      });
    });
    expect(started).toBe(true);
    expect(hook.result.current.dragType).toBe('stopLoss');
  });

  test('handleSLTPMouseDown consumes but does not start when slDragEnabled=false', () => {
    const active = makeOrder({ id: 'a1', status: 'FILLED', stopLoss: 49000 });
    const { hook } = renderDragHook({ orders: [active], slDragEnabled: false });

    let consumed = false;
    act(() => {
      consumed = hook.result.current.handleSLTPMouseDown(10, 250, {
        orderId: 'a1',
        type: 'stopLoss',
        price: 49000,
      });
    });
    expect(consumed).toBe(true);
    expect(hook.result.current.isDragging).toBe(false);
  });

  test('handleSLTPMouseDown consumes but does not start when tpDragEnabled=false', () => {
    const active = makeOrder({ id: 'a1', status: 'FILLED', takeProfit: 52000 });
    const { hook } = renderDragHook({ orders: [active], tpDragEnabled: false });

    let consumed = false;
    act(() => {
      consumed = hook.result.current.handleSLTPMouseDown(10, 250, {
        orderId: 'a1',
        type: 'takeProfit',
        price: 52000,
      });
    });
    expect(consumed).toBe(true);
    expect(hook.result.current.isDragging).toBe(false);
  });

  test('handleMouseMove updates previewPrice via rAF', async () => {
    const pending = makeOrder({ id: 'p1', status: 'NEW' });
    const { hook } = renderDragHook({
      orders: [pending],
      getOrderAtPosition: () => pending,
    });

    act(() => {
      hook.result.current.handleMouseDown(100, 200);
    });

    act(() => {
      hook.result.current.handleMouseMove(250);
    });

    await waitTwoFrames();
    expect(hook.result.current.getPreviewPrice()).toBe(250);
  });

  test('handleMouseUp on entry drag commits new entry price', async () => {
    const pending = makeOrder({ id: 'p1', status: 'NEW', entryPrice: 50000 });
    const { hook, updateOrder } = renderDragHook({
      orders: [pending],
      getOrderAtPosition: () => pending,
    });

    act(() => {
      hook.result.current.handleMouseDown(100, 200);
    });
    act(() => {
      hook.result.current.handleMouseMove(180);
    });
    await waitTwoFrames();
    act(() => {
      hook.result.current.handleMouseUp();
    });

    expect(updateOrder).toHaveBeenCalledTimes(1);
    expect(updateOrder).toHaveBeenCalledWith('p1', { entryPrice: 180 });
    expect(hook.result.current.isDragging).toBe(false);
  });

  test('TP long drag rejects previewPrice below entry price', async () => {
    const active = makeOrder({ id: 'a1', status: 'FILLED', entryPrice: 50000, takeProfit: 52000 });
    const { hook, updateOrder } = renderDragHook({ orders: [active] });

    act(() => {
      hook.result.current.handleSLTPMouseDown(10, 250, {
        orderId: 'a1',
        type: 'takeProfit',
        price: 52000,
      });
    });
    act(() => {
      hook.result.current.handleMouseMove(499);
    });
    await waitTwoFrames();
    act(() => {
      hook.result.current.handleMouseUp();
    });

    expect(updateOrder).not.toHaveBeenCalled();
  });

  test('TP long drag accepts previewPrice above entry price', async () => {
    const active = makeOrder({ id: 'a1', status: 'FILLED', entryPrice: 50000, takeProfit: 52000 });
    const { hook, updateOrder } = renderDragHook({ orders: [active] });

    act(() => {
      hook.result.current.handleSLTPMouseDown(10, 250, {
        orderId: 'a1',
        type: 'takeProfit',
        price: 52000,
      });
    });
    act(() => {
      hook.result.current.handleMouseMove(53000);
    });
    await waitTwoFrames();
    act(() => {
      hook.result.current.handleMouseUp();
    });

    expect(updateOrder).toHaveBeenCalledTimes(1);
    expect(updateOrder).toHaveBeenCalledWith('a1', { takeProfit: 53000 });
  });

  test('TP short drag rejects previewPrice above entry price', async () => {
    const active = makeOrder({
      id: 's1',
      status: 'FILLED',
      side: 'SELL',
      entryPrice: 50000,
      takeProfit: 48000,
    });
    const { hook, updateOrder } = renderDragHook({ orders: [active] });

    act(() => {
      hook.result.current.handleSLTPMouseDown(10, 250, {
        orderId: 's1',
        type: 'takeProfit',
        price: 48000,
      });
    });
    act(() => {
      hook.result.current.handleMouseMove(51000);
    });
    await waitTwoFrames();
    act(() => {
      hook.result.current.handleMouseUp();
    });

    expect(updateOrder).not.toHaveBeenCalled();
  });

  test('SL drag with slTightenOnly clamps loose drag back to initial (long)', async () => {
    const active = makeOrder({
      id: 'l1',
      status: 'FILLED',
      entryPrice: 50000,
      stopLoss: 49000,
    });
    const { hook, updateOrder } = renderDragHook({
      orders: [active],
      slTightenOnly: true,
    });

    act(() => {
      hook.result.current.handleSLTPMouseDown(10, 49000, {
        orderId: 'l1',
        type: 'stopLoss',
        price: 49000,
      });
    });
    act(() => {
      hook.result.current.handleMouseMove(48500);
    });
    await waitTwoFrames();
    act(() => {
      hook.result.current.handleMouseUp();
    });

    // Loose drag is clamped to initial — SL never moves below its starting value for a long.
    expect(updateOrder).toHaveBeenCalledTimes(1);
    expect(updateOrder).toHaveBeenCalledWith('l1', { stopLoss: 49000 });
  });

  test('SL drag with slTightenOnly accepts tightening move (long)', async () => {
    const active = makeOrder({
      id: 'l1',
      status: 'FILLED',
      entryPrice: 50000,
      stopLoss: 49000,
    });
    const { hook, updateOrder } = renderDragHook({
      orders: [active],
      slTightenOnly: true,
    });

    act(() => {
      hook.result.current.handleSLTPMouseDown(10, 250, {
        orderId: 'l1',
        type: 'stopLoss',
        price: 49000,
      });
    });
    act(() => {
      hook.result.current.handleMouseMove(49500);
    });
    await waitTwoFrames();
    act(() => {
      hook.result.current.handleMouseUp();
    });

    expect(updateOrder).toHaveBeenCalledTimes(1);
    expect(updateOrder).toHaveBeenCalledWith('l1', { stopLoss: 49500 });
  });

  test('SL update propagates to all related active long orders', async () => {
    const a1 = makeOrder({ id: 'a1', status: 'FILLED', entryPrice: 50000, stopLoss: 49000 });
    const a2 = makeOrder({ id: 'a2', status: 'FILLED', entryPrice: 50500, stopLoss: 49000 });
    const unrelated = makeOrder({
      id: 'u1',
      status: 'FILLED',
      side: 'SELL',
      entryPrice: 50000,
      stopLoss: 51000,
    });
    const { hook, updateOrder } = renderDragHook({ orders: [a1, a2, unrelated] });

    act(() => {
      hook.result.current.handleSLTPMouseDown(10, 250, {
        orderId: 'a1',
        type: 'stopLoss',
        price: 49000,
      });
    });
    act(() => {
      hook.result.current.handleMouseMove(49200);
    });
    await waitTwoFrames();
    act(() => {
      hook.result.current.handleMouseUp();
    });

    expect(updateOrder).toHaveBeenCalledTimes(2);
    const calledIds = updateOrder.mock.calls.map((c) => c[0]);
    expect(calledIds).toEqual(expect.arrayContaining(['a1', 'a2']));
    expect(calledIds).not.toContain('u1');
  });

  test('cancelDrag resets all state', () => {
    const pending = makeOrder({ id: 'p1', status: 'NEW' });
    const { hook, markDirty } = renderDragHook({
      orders: [pending],
      getOrderAtPosition: () => pending,
    });

    act(() => {
      hook.result.current.handleMouseDown(100, 200);
    });
    expect(hook.result.current.isDragging).toBe(true);

    markDirty.mockClear();
    act(() => {
      hook.result.current.cancelDrag();
    });

    expect(hook.result.current.isDragging).toBe(false);
    expect(hook.result.current.dragType).toBeNull();
    expect(hook.result.current.getPreviewPrice()).toBeNull();
    expect(markDirty).toHaveBeenCalledWith('overlays');
  });

  test('handleMouseUp with no active drag is a no-op', () => {
    const { hook, updateOrder } = renderDragHook();
    act(() => {
      hook.result.current.handleMouseUp();
    });
    expect(updateOrder).not.toHaveBeenCalled();
    expect(hook.result.current.isDragging).toBe(false);
  });

  test('rAF coalesces consecutive handleMouseMove calls to last value', async () => {
    const pending = makeOrder({ id: 'p1', status: 'NEW' });
    const { hook } = renderDragHook({
      orders: [pending],
      getOrderAtPosition: () => pending,
    });

    act(() => {
      hook.result.current.handleMouseDown(100, 200);
    });

    act(() => {
      hook.result.current.handleMouseMove(100);
      hook.result.current.handleMouseMove(150);
      hook.result.current.handleMouseMove(200);
    });

    await waitTwoFrames();
    expect(hook.result.current.getPreviewPrice()).toBe(200);
  });

  test('unmount during drag cancels rAF without throwing', async () => {
    const pending = makeOrder({ id: 'p1', status: 'NEW' });
    const { hook } = renderDragHook({
      orders: [pending],
      getOrderAtPosition: () => pending,
    });

    act(() => {
      hook.result.current.handleMouseDown(100, 200);
    });
    act(() => {
      hook.result.current.handleMouseMove(250);
    });

    expect(() => hook.unmount()).not.toThrow();
    await waitTwoFrames();
  });
});
