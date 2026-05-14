import { describe, expect, it } from 'vitest';
import {
  markPendingExecCancelledByOrderId,
  mergeOrderCancelled,
  mergeOrderCreated,
  mergeOrderUpdate,
  mergePositionClosed,
  mergePositionUpdate,
  mergeWalletBalanceUpdate,
  isOpenOrder,
} from './socketCacheMerge';

interface Exec {
  id: string;
  status?: string | null;
  quantity?: string;
  entryPrice?: string;
  pnl?: string;
  entryOrderId?: string | number | null;
}

interface Ord {
  id?: string;
  orderId?: string;
  status?: string;
  price?: string;
}

describe('mergePositionUpdate', () => {
  const base: Exec[] = [
    { id: 'a', status: 'pending', quantity: '0' },
    { id: 'b', status: 'open', quantity: '1' },
  ];

  it('returns empty array when prev is undefined', () => {
    expect(mergePositionUpdate(undefined, { id: 'x', status: 'open' })).toEqual([]);
  });

  it('returns same reference when payload has no id', () => {
    const next = mergePositionUpdate(base, { status: 'open' } as Partial<Exec> & { id?: string });
    expect(next).toBe(base);
  });

  it('returns same reference when id not found', () => {
    const next = mergePositionUpdate(base, { id: 'z', status: 'open' });
    expect(next).toBe(base);
  });

  it('returns same reference when patch matches existing values (no spurious render)', () => {
    const next = mergePositionUpdate(base, { id: 'b', status: 'open' });
    expect(next).toBe(base);
  });

  it('patches the matched execution and returns a new array', () => {
    const next = mergePositionUpdate(base, { id: 'a', status: 'open', quantity: '0.5' });
    expect(next).not.toBe(base);
    expect(next[0]).toEqual({ id: 'a', status: 'open', quantity: '0.5' });
    expect(next[1]).toBe(base[1]);
  });

  it('preserves untouched fields', () => {
    const next = mergePositionUpdate(base, { id: 'b', pnl: '12.34' });
    expect(next[1]).toEqual({ id: 'b', status: 'open', quantity: '1', pnl: '12.34' });
  });

  it('handles partial-fill quantity patch (the most common live event)', () => {
    const pending: Exec[] = [{ id: 'a', status: 'pending', quantity: '0' }];
    const next = mergePositionUpdate(pending, { id: 'a', quantity: '0.25' });
    expect(next[0]?.quantity).toBe('0.25');
    expect(next[0]?.status).toBe('pending');
  });
});

describe('markPendingExecCancelledByOrderId', () => {
  const base: Exec[] = [
    { id: 'p1', status: 'pending', entryOrderId: '111' },
    { id: 'p2', status: 'pending', entryOrderId: '222' },
    { id: 'o1', status: 'open', entryOrderId: '111' },
  ];

  it('returns empty array when prev is undefined', () => {
    expect(markPendingExecCancelledByOrderId(undefined, '111')).toEqual([]);
  });

  it('returns same reference when orderId is null/undefined/empty', () => {
    expect(markPendingExecCancelledByOrderId(base, null)).toBe(base);
    expect(markPendingExecCancelledByOrderId(base, undefined)).toBe(base);
    expect(markPendingExecCancelledByOrderId(base, '')).toBe(base);
  });

  it('flips pending exec with matching entryOrderId to cancelled', () => {
    const next = markPendingExecCancelledByOrderId(base, '111');
    expect(next).not.toBe(base);
    expect(next[0]?.status).toBe('cancelled');
    expect(next[1]).toBe(base[1]);
    expect(next[2]).toBe(base[2]);
  });

  it('does not touch open execs even if entryOrderId matches', () => {
    const next = markPendingExecCancelledByOrderId(base, '111');
    expect(next[2]?.status).toBe('open');
  });

  it('returns same reference when no pending exec matches', () => {
    const next = markPendingExecCancelledByOrderId(base, '999');
    expect(next).toBe(base);
  });

  it('compares orderId as string (numeric input still matches)', () => {
    const next = markPendingExecCancelledByOrderId(base, 111);
    expect(next[0]?.status).toBe('cancelled');
  });
});

describe('mergePositionClosed', () => {
  const base: Exec[] = [
    { id: 'a', status: 'open', quantity: '1' },
    { id: 'b', status: 'closed', pnl: '5' },
  ];

  it('returns same reference when id not found', () => {
    const next = mergePositionClosed(base, { positionId: 'z' });
    expect(next).toBe(base);
  });

  it('returns same reference when already closed (idempotent)', () => {
    const next = mergePositionClosed(base, { positionId: 'b' });
    expect(next).toBe(base);
  });

  it('marks open execution as closed and merges pnl', () => {
    const next = mergePositionClosed(base, { positionId: 'a', pnl: 12.5, pnlPercent: 1.2, exitReason: 'STOP_LOSS' });
    expect(next[0]).toEqual({
      id: 'a',
      status: 'closed',
      quantity: '1',
      pnl: '12.5',
      pnlPercent: '1.2',
      exitReason: 'STOP_LOSS',
    });
  });

  it('omits pnl/pnlPercent when not provided', () => {
    const next = mergePositionClosed(base, { positionId: 'a' });
    expect(next[0]?.status).toBe('closed');
    expect(next[0]?.pnl).toBeUndefined();
  });
});

describe('mergeOrderCreated', () => {
  const base: Ord[] = [{ orderId: '1', status: 'NEW' }];

  it('returns single-item array when prev is undefined', () => {
    const order = { orderId: '2', status: 'NEW' as const };
    expect(mergeOrderCreated(undefined, order)).toEqual([order]);
  });

  it('inserts new order at head', () => {
    const next = mergeOrderCreated(base, { orderId: '2', status: 'NEW' });
    expect(next.map((o) => o.orderId)).toEqual(['2', '1']);
  });

  it('idempotent — duplicate orderId is dropped', () => {
    const next = mergeOrderCreated(base, { orderId: '1', status: 'NEW' });
    expect(next).toBe(base);
  });

  it('falls back to id when orderId missing', () => {
    const local: Ord[] = [{ id: 'paper-1', status: 'NEW' }];
    const next = mergeOrderCreated(local, { id: 'paper-2', status: 'NEW' });
    expect(next).toHaveLength(2);
  });

  it('returns prev when payload has no key at all', () => {
    const next = mergeOrderCreated(base, { status: 'NEW' });
    expect(next).toBe(base);
  });
});

describe('mergeOrderUpdate', () => {
  const base: Ord[] = [
    { orderId: '1', status: 'NEW', price: '100' },
    { orderId: '2', status: 'NEW', price: '200' },
  ];

  it('returns same reference when not found', () => {
    expect(mergeOrderUpdate(base, { orderId: 'z', status: 'FILLED' })).toBe(base);
  });

  it('returns same reference when patch matches existing', () => {
    expect(mergeOrderUpdate(base, { orderId: '1', status: 'NEW' })).toBe(base);
  });

  it('patches matched order', () => {
    const next = mergeOrderUpdate(base, { orderId: '1', status: 'FILLED', price: '101' });
    expect(next[0]).toEqual({ orderId: '1', status: 'FILLED', price: '101' });
    expect(next[1]).toBe(base[1]);
  });
});

describe('mergeOrderCancelled', () => {
  const base: Ord[] = [
    { orderId: '1', status: 'NEW' },
    { orderId: '2', status: 'NEW' },
  ];

  it('removes order by orderId', () => {
    const next = mergeOrderCancelled(base, '1');
    expect(next.map((o) => o.orderId)).toEqual(['2']);
  });

  it('returns same reference when orderId not found', () => {
    expect(mergeOrderCancelled(base, 'z')).toBe(base);
  });

  it('handles undefined cache', () => {
    expect(mergeOrderCancelled(undefined, '1')).toEqual([]);
  });
});

describe('isOpenOrder', () => {
  it('NEW is open', () => expect(isOpenOrder({ status: 'NEW' })).toBe(true));
  it('PARTIALLY_FILLED is open', () => expect(isOpenOrder({ status: 'PARTIALLY_FILLED' })).toBe(true));
  it('FILLED is not open', () => expect(isOpenOrder({ status: 'FILLED' })).toBe(false));
  it('CANCELED is not open', () => expect(isOpenOrder({ status: 'CANCELED' })).toBe(false));
  it('undefined status is not open', () => expect(isOpenOrder({})).toBe(false));
});

describe('mergeWalletBalanceUpdate', () => {
  interface Wallet {
    id: string;
    currentBalance?: string | null;
    totalWalletBalance?: string | null;
  }
  const base: Wallet[] = [
    { id: 'w1', currentBalance: '5000.00', totalWalletBalance: '5000.00' },
    { id: 'w2', currentBalance: '1000.00', totalWalletBalance: '1000.00' },
  ];

  it('returns prev unchanged when prev is undefined', () => {
    expect(mergeWalletBalanceUpdate(undefined, 'w1', { balances: [{ a: 'USDT', wb: '6000' }] })).toBeUndefined();
  });

  it('patches the matching wallet currentBalance from USDT wb', () => {
    const next = mergeWalletBalanceUpdate(base, 'w1', { balances: [{ a: 'USDT', wb: '5500.50' }] });
    expect(next).not.toBe(base);
    expect(next![0]!.currentBalance).toBe('5500.50');
    expect(next![0]!.totalWalletBalance).toBe('5500.50');
    // Other wallets unaffected.
    expect(next![1]).toBe(base[1]);
  });

  it('falls back to cw (cross wallet) when wb missing', () => {
    const next = mergeWalletBalanceUpdate(base, 'w1', { balances: [{ a: 'USDT', wb: '', cw: '5500.50' }] });
    expect(next![0]!.currentBalance).toBe('5500.50');
  });

  it('accepts a flat patch with currentBalance/totalWalletBalance (paper synthesizer path)', () => {
    const next = mergeWalletBalanceUpdate(base, 'w1', { currentBalance: '4250.00' });
    expect(next![0]!.currentBalance).toBe('4250.00');
  });

  it('returns same reference when balance unchanged', () => {
    const next = mergeWalletBalanceUpdate(base, 'w1', { balances: [{ a: 'USDT', wb: '5000.00' }] });
    expect(next).toBe(base);
  });

  it('returns same reference when wallet not in cache', () => {
    const next = mergeWalletBalanceUpdate(base, 'unknown', { balances: [{ a: 'USDT', wb: '99' }] });
    expect(next).toBe(base);
  });

  it('returns same reference when payload has no usable balance', () => {
    const next = mergeWalletBalanceUpdate(base, 'w1', { balances: [{ a: 'BNB', wb: '5' }] });
    expect(next).toBe(base);
  });

  it('preserves untouched fields on the wallet (extensible WalletLike)', () => {
    interface ExtWallet extends Wallet {
      name: string;
      exchange: string;
    }
    const ext: ExtWallet[] = [
      { id: 'w1', name: 'Live', exchange: 'BINANCE', currentBalance: '5000', totalWalletBalance: '5000' },
    ];
    const next = mergeWalletBalanceUpdate(ext, 'w1', { balances: [{ a: 'USDT', wb: '5500' }] });
    expect(next![0]!.name).toBe('Live');
    expect(next![0]!.exchange).toBe('BINANCE');
    expect(next![0]!.currentBalance).toBe('5500');
  });
});
