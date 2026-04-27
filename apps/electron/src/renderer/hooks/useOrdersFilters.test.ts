import type { Order } from '@marketmind/types';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { filterOrders, sortOrders, useOrdersFilters } from './useOrdersFilters';

const baseTime = new Date('2026-04-26T10:00:00Z').getTime();

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  symbol: 'BTCUSDT',
  orderId: overrides.orderId ?? `o-${Math.random().toString(36).slice(2, 6)}`,
  orderListId: '0',
  clientOrderId: '',
  price: '50000',
  origQty: '0.1',
  executedQty: '0',
  cummulativeQuoteQty: '0',
  status: 'NEW',
  timeInForce: 'GTC',
  type: 'LIMIT',
  side: 'BUY',
  time: baseTime,
  updateTime: baseTime,
  isWorking: true,
  origQuoteOrderQty: '0',
  id: overrides.orderId ?? overrides.id ?? `o-${Math.random().toString(36).slice(2, 6)}`,
  walletId: 'w1',
  orderDirection: 'long',
  entryPrice: 50_000,
  quantity: 0.1,
  createdAt: new Date(baseTime),
  marketType: 'FUTURES',
  ...overrides,
});

describe('filterOrders', () => {
  const orders = [
    makeOrder({ id: 'a', status: 'NEW', type: 'LIMIT' }), // pending
    makeOrder({ id: 'b', status: 'NEW', type: 'STOP_MARKET' }), // pending
    makeOrder({ id: 'c', status: 'PARTIALLY_FILLED', type: 'LIMIT' }), // active
    makeOrder({ id: 'd', status: 'FILLED', type: 'MARKET' }),
    makeOrder({ id: 'e', status: 'FILLED', closedAt: new Date() }),
    makeOrder({ id: 'f', status: 'CANCELED' }),
    makeOrder({ id: 'g', status: 'REJECTED' }),
    makeOrder({ id: 'h', status: 'EXPIRED' }),
    makeOrder({ id: 'i', status: 'EXPIRED_IN_MATCH' }),
  ];

  it('"all" returns every order', () => {
    expect(filterOrders(orders, 'all')).toHaveLength(orders.length);
  });

  it('"filled" returns only FILLED status (regardless of closedAt)', () => {
    const out = filterOrders(orders, 'filled');
    expect(out.map((o) => o.id).sort()).toEqual(['d', 'e']);
  });

  it('"closed" returns only orders with a closedAt timestamp', () => {
    const out = filterOrders(orders, 'closed');
    expect(out.map((o) => o.id)).toEqual(['e']);
  });

  it('"cancelled" includes both CANCELED and REJECTED', () => {
    const out = filterOrders(orders, 'cancelled');
    expect(out.map((o) => o.id).sort()).toEqual(['f', 'g']);
  });

  it('"expired" includes EXPIRED and EXPIRED_IN_MATCH', () => {
    const out = filterOrders(orders, 'expired');
    expect(out.map((o) => o.id).sort()).toEqual(['h', 'i']);
  });

  it('"pending" delegates to isOrderPending — matches NEW + algo types', () => {
    const out = filterOrders(orders, 'pending');
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((o) => o.status === 'NEW' || o.status === 'PARTIALLY_FILLED')).toBe(true);
  });

  it('"active" delegates to isOrderActive — includes PARTIALLY_FILLED', () => {
    const out = filterOrders(orders, 'active');
    expect(out.some((o) => o.id === 'c')).toBe(true);
  });
});

describe('sortOrders', () => {
  const t1 = baseTime;
  const t2 = baseTime + 60_000;
  const t3 = baseTime + 120_000;

  const orders = [
    makeOrder({ id: 'a', symbol: 'BTCUSDT', updateTime: t1, time: t1, quantity: 1, entryPrice: 50_000, pnl: 100 }),
    makeOrder({ id: 'b', symbol: 'AAVEUSDT', updateTime: t3, time: t3, quantity: 5, entryPrice: 100, pnl: -50 }),
    makeOrder({ id: 'c', symbol: 'XRPUSDT', updateTime: t2, time: t2, quantity: 1000, entryPrice: 0.5, pnl: 25 }),
  ];

  it('newest puts the latest updateTime first', () => {
    expect(sortOrders(orders, 'newest').map((o) => o.id)).toEqual(['b', 'c', 'a']);
  });

  it('oldest puts the earliest updateTime first', () => {
    expect(sortOrders(orders, 'oldest').map((o) => o.id)).toEqual(['a', 'c', 'b']);
  });

  it('symbol-asc sorts alphabetically', () => {
    expect(sortOrders(orders, 'symbol-asc').map((o) => o.symbol)).toEqual(['AAVEUSDT', 'BTCUSDT', 'XRPUSDT']);
  });

  it('symbol-desc sorts reverse alphabetically', () => {
    expect(sortOrders(orders, 'symbol-desc').map((o) => o.symbol)).toEqual(['XRPUSDT', 'BTCUSDT', 'AAVEUSDT']);
  });

  it('quantity-desc orders by quantity descending', () => {
    expect(sortOrders(orders, 'quantity-desc').map((o) => o.quantity)).toEqual([1000, 5, 1]);
  });

  it('quantity-asc orders by quantity ascending', () => {
    expect(sortOrders(orders, 'quantity-asc').map((o) => o.quantity)).toEqual([1, 5, 1000]);
  });

  it('pnl-desc orders by pnl descending (parses string pnl)', () => {
    const stringy = orders.map((o) => ({ ...o, pnl: String(o.pnl) }));
    expect(sortOrders(stringy, 'pnl-desc').map((o) => parseFloat(String(o.pnl)))).toEqual([100, 25, -50]);
  });

  it('pnl-asc orders by pnl ascending', () => {
    expect(sortOrders(orders, 'pnl-asc').map((o) => o.pnl)).toEqual([-50, 25, 100]);
  });

  it('price-desc orders by entry price descending', () => {
    expect(sortOrders(orders, 'price-desc').map((o) => o.entryPrice)).toEqual([50_000, 100, 0.5]);
  });

  it('price-asc orders by entry price ascending', () => {
    expect(sortOrders(orders, 'price-asc').map((o) => o.entryPrice)).toEqual([0.5, 100, 50_000]);
  });

  it('falls back to updateTime when updateTime is 0 (uses time)', () => {
    const out = sortOrders(
      [
        makeOrder({ id: 'x', time: t3, updateTime: 0 }),
        makeOrder({ id: 'y', time: t1, updateTime: 0 }),
      ],
      'newest',
    );
    expect(out.map((o) => o.id)).toEqual(['x', 'y']);
  });

  it('does not mutate the input array', () => {
    const original = [...orders];
    sortOrders(orders, 'pnl-desc');
    expect(orders).toEqual(original);
  });
});

describe('useOrdersFilters hook', () => {
  it('composes filter then sort and exposes the result', () => {
    const orders = [
      makeOrder({ id: 'a', status: 'NEW', updateTime: baseTime, time: baseTime }),
      makeOrder({ id: 'b', status: 'FILLED', updateTime: baseTime + 5000, time: baseTime + 5000 }),
      makeOrder({ id: 'c', status: 'CANCELED', updateTime: baseTime + 10_000, time: baseTime + 10_000 }),
    ];
    const { result } = renderHook(() => useOrdersFilters(orders, 'cancelled', 'newest'));
    expect(result.current.map((o) => o.id)).toEqual(['c']);
  });

  it('memoizes — same inputs return the same array reference', () => {
    const orders = [makeOrder({ id: 'a', status: 'NEW' })];
    const { result, rerender } = renderHook(
      ({ orders, filter, sort }: { orders: Order[]; filter: 'all'; sort: 'newest' }) =>
        useOrdersFilters(orders, filter, sort),
      { initialProps: { orders, filter: 'all' as const, sort: 'newest' as const } },
    );
    const first = result.current;
    rerender({ orders, filter: 'all', sort: 'newest' });
    expect(result.current).toBe(first);
  });
});
