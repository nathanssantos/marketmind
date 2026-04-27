import { describe, expect, it } from 'vitest';
import {
  buildTrackedOrderIds,
  classifyExchangeOrders,
  type ExchangeAlgoRow,
  type ExchangeOrderRow,
  type ExecutionWithOrderIds,
} from './orphanOrdersClassifier';

const exec = (overrides: Partial<ExecutionWithOrderIds> = {}): ExecutionWithOrderIds => ({ ...overrides });

const order = (overrides: Partial<ExchangeOrderRow> = {}): ExchangeOrderRow => ({
  orderId: overrides.orderId ?? `oid-${Math.random().toString(36).slice(2, 8)}`,
  symbol: 'BTCUSDT',
  side: 'BUY',
  type: 'LIMIT',
  price: '50000',
  origQty: '0.1',
  time: Date.parse('2026-04-26T10:00:00Z'),
  ...overrides,
});

const algo = (overrides: Partial<ExchangeAlgoRow> = {}): ExchangeAlgoRow => ({
  algoId: overrides.algoId ?? `aid-${Math.random().toString(36).slice(2, 8)}`,
  symbol: 'BTCUSDT',
  side: 'SELL',
  type: 'STOP_MARKET',
  triggerPrice: '49000',
  quantity: '0.1',
  createTime: Date.parse('2026-04-26T10:00:00Z'),
  ...overrides,
});

describe('buildTrackedOrderIds', () => {
  it('flattens all 6 order-id columns into one Set', () => {
    const ids = buildTrackedOrderIds([
      exec({
        entryOrderId: 'e1',
        stopLossOrderId: 'sl1',
        stopLossAlgoId: 'sla1',
        takeProfitOrderId: 'tp1',
        takeProfitAlgoId: 'tpa1',
        trailingStopAlgoId: 'tsa1',
      }),
    ]);
    expect(ids).toEqual(new Set(['e1', 'sl1', 'sla1', 'tp1', 'tpa1', 'tsa1']));
  });

  it('skips null/undefined/empty values', () => {
    const ids = buildTrackedOrderIds([
      exec({ entryOrderId: 'e1', stopLossOrderId: null, takeProfitOrderId: undefined, trailingStopAlgoId: '' }),
    ]);
    expect(ids).toEqual(new Set(['e1']));
  });

  it('merges ids across multiple executions, deduping', () => {
    const ids = buildTrackedOrderIds([
      exec({ entryOrderId: 'e1', stopLossAlgoId: 'shared' }),
      exec({ entryOrderId: 'e2', takeProfitAlgoId: 'shared' }),
    ]);
    expect(ids).toEqual(new Set(['e1', 'e2', 'shared']));
  });

  it('returns empty set for empty input', () => {
    expect(buildTrackedOrderIds([])).toEqual(new Set());
  });
});

describe('classifyExchangeOrders — regular open orders', () => {
  it('skips an order whose id is in an execution (already linked)', () => {
    const out = classifyExchangeOrders(
      [exec({ entryOrderId: '111' })],
      [order({ orderId: '111' })],
      [],
      [],
    );
    expect(out.orphanOrders).toEqual([]);
    expect(out.trackedOrders).toEqual([]);
  });

  it('classifies as TRACKED when in DB but no execution links to it (manual order)', () => {
    const out = classifyExchangeOrders(
      [],
      [order({ orderId: '222', symbol: 'ETHUSDT', side: 'BUY', type: 'LIMIT', price: '3000', origQty: '1' })],
      [],
      ['222'],
    );
    expect(out.trackedOrders).toHaveLength(1);
    expect(out.orphanOrders).toEqual([]);
    expect(out.trackedOrders[0]).toMatchObject({
      id: 'exchange-order-222',
      exchangeOrderId: '222',
      isAlgo: false,
      symbol: 'ETHUSDT',
      side: 'BUY',
      type: 'LIMIT',
      price: '3000',
      quantity: '1',
    });
  });

  it('classifies as ORPHAN when in neither executions nor DB (cleanup target)', () => {
    const out = classifyExchangeOrders(
      [],
      [order({ orderId: '333' })],
      [],
      [],
    );
    expect(out.orphanOrders).toHaveLength(1);
    expect(out.trackedOrders).toEqual([]);
    expect(out.orphanOrders[0]?.exchangeOrderId).toBe('333');
  });

  it('handles createdAt: number timestamp → Date, missing → null', () => {
    const ts = Date.parse('2026-04-26T10:00:00Z');
    const out = classifyExchangeOrders(
      [],
      [
        order({ orderId: 'a', time: ts }),
        order({ orderId: 'b', time: null }),
      ],
      [],
      [],
    );
    expect(out.orphanOrders[0]?.createdAt?.toISOString()).toBe('2026-04-26T10:00:00.000Z');
    expect(out.orphanOrders[1]?.createdAt).toBeNull();
  });
});

describe('classifyExchangeOrders — algo orders (STOP_MARKET / TAKE_PROFIT_MARKET)', () => {
  it('classifies as TRACKED with isAlgo=true', () => {
    const out = classifyExchangeOrders(
      [],
      [],
      [algo({ algoId: 'aaa', triggerPrice: '49000' })],
      ['aaa'],
    );
    expect(out.trackedOrders).toHaveLength(1);
    expect(out.trackedOrders[0]?.isAlgo).toBe(true);
    expect(out.trackedOrders[0]?.id).toBe('exchange-algo-aaa');
    expect(out.trackedOrders[0]?.price).toBe('49000');
  });

  it('classifies as ORPHAN when neither execution nor DB knows it', () => {
    const out = classifyExchangeOrders([], [], [algo({ algoId: 'bbb' })], []);
    expect(out.orphanOrders).toHaveLength(1);
    expect(out.orphanOrders[0]?.isAlgo).toBe(true);
  });

  it('skips algo whose algoId matches a tracked execution column (e.g. stopLossAlgoId)', () => {
    const out = classifyExchangeOrders(
      [exec({ stopLossAlgoId: 'tracked' })],
      [],
      [algo({ algoId: 'tracked' })],
      [],
    );
    expect(out.orphanOrders).toEqual([]);
    expect(out.trackedOrders).toEqual([]);
  });

  it('uses "0" fallback for missing triggerPrice / quantity', () => {
    const out = classifyExchangeOrders(
      [],
      [],
      [algo({ algoId: 'x', triggerPrice: undefined, quantity: undefined })],
      [],
    );
    expect(out.orphanOrders[0]?.price).toBe('0');
    expect(out.orphanOrders[0]?.quantity).toBe('0');
  });
});

describe('classifyExchangeOrders — mixed buckets', () => {
  it('an execution-linked SL algo, a tracked manual entry, and an orphan algo all coexist correctly', () => {
    const out = classifyExchangeOrders(
      [exec({ entryOrderId: 'e1', stopLossAlgoId: 'sl1' })],
      [
        order({ orderId: 'e1' }), // execution-linked entry → skip
        order({ orderId: 'manual1', side: 'BUY' }), // manual entry tracked in DB
        order({ orderId: 'leftover1' }), // not in DB or execution → orphan
      ],
      [
        algo({ algoId: 'sl1' }), // execution-linked SL → skip
        algo({ algoId: 'unknownAlgo' }), // orphan algo
      ],
      ['manual1'],
    );

    expect(out.orphanOrders.map((o) => o.exchangeOrderId).sort()).toEqual(['leftover1', 'unknownAlgo']);
    expect(out.trackedOrders.map((o) => o.exchangeOrderId)).toEqual(['manual1']);
    expect(out.orphanOrders.find((o) => o.exchangeOrderId === 'unknownAlgo')?.isAlgo).toBe(true);
    expect(out.orphanOrders.find((o) => o.exchangeOrderId === 'leftover1')?.isAlgo).toBe(false);
  });

  it('empty inputs everywhere → empty buckets', () => {
    const out = classifyExchangeOrders([], [], [], []);
    expect(out).toEqual({ orphanOrders: [], trackedOrders: [] });
  });
});
