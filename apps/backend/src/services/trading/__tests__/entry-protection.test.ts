import { beforeEach, describe, expect, it, vi } from 'vitest';

const createStopLossOrder = vi.fn();
const createTakeProfitOrder = vi.fn();
const submitAlgoOrder = vi.fn();
const insertValues = vi.fn().mockResolvedValue(undefined);

vi.mock('../../protection-orders', () => ({
  createStopLossOrder: (...args: unknown[]) => createStopLossOrder(...args),
  createTakeProfitOrder: (...args: unknown[]) => createTakeProfitOrder(...args),
}));
vi.mock('../../../exchange', () => ({
  getFuturesClient: () => ({ submitAlgoOrder: (...args: unknown[]) => submitAlgoOrder(...args) }),
}));
vi.mock('../../../db', () => ({
  db: { insert: () => ({ values: (...args: unknown[]) => insertValues(...args) }) },
}));
vi.mock('../../../db/schema', () => ({ orders: {} }));
vi.mock('../../min-notional-filter', () => ({
  getMinNotionalFilterService: () => ({
    getSymbolFilters: async () => new Map([['BTCUSDT', { tickSize: 0.1, stepSize: 0.001 }]]),
  }),
}));
vi.mock('../../logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { placeEntryProtection } from '../entry-protection';

const wallet = { id: 'w1' } as never;
const base = { wallet, userId: 'u1', symbol: 'BTCUSDT', side: 'LONG' as const, quantity: 0.1, marketType: 'FUTURES' as const };

describe('placeEntryProtection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createStopLossOrder.mockResolvedValue({ algoId: 'sl-1', isAlgoOrder: true });
    createTakeProfitOrder.mockResolvedValue({ algoId: 'tp-1', isAlgoOrder: true });
    submitAlgoOrder.mockImplementation(async (params: { type: string; triggerPrice: string; quantity: string; symbol: string; side: string }) => ({
      algoId: `${params.type}-id`, symbol: params.symbol, side: params.side, type: params.type,
      triggerPrice: params.triggerPrice, quantity: params.quantity, createTime: 1, updateTime: 1,
    }));
  });

  it('does nothing without SL or TP', async () => {
    const result = await placeEntryProtection({ ...base, protectionMode: 'OCO' });

    expect(result.errors).toEqual([]);
    expect(createStopLossOrder).not.toHaveBeenCalled();
    expect(submitAlgoOrder).not.toHaveBeenCalled();
  });

  it('in OCO mode places attached protection and returns the ids for the position', async () => {
    const result = await placeEntryProtection({ ...base, stopLoss: '49000', takeProfit: '52000', protectionMode: 'OCO' });

    expect(createStopLossOrder).toHaveBeenCalledWith(expect.objectContaining({ triggerPrice: 49_000, side: 'LONG', quantity: 0.1 }));
    expect(createTakeProfitOrder).toHaveBeenCalledWith(expect.objectContaining({ triggerPrice: 52_000 }));
    expect(result).toMatchObject({ stopLossAlgoId: 'sl-1', stopLossIsAlgo: true, takeProfitAlgoId: 'tp-1', takeProfitIsAlgo: true, errors: [] });
    expect(submitAlgoOrder).not.toHaveBeenCalled();
  });

  it('in INDEPENDENT mode submits two reduce-only algo orders on the close side and records them as orders', async () => {
    const result = await placeEntryProtection({ ...base, stopLoss: '49000', takeProfit: '52000', protectionMode: 'INDEPENDENT' });

    expect(submitAlgoOrder).toHaveBeenCalledTimes(2);
    expect(submitAlgoOrder).toHaveBeenCalledWith(expect.objectContaining({ side: 'SELL', type: 'STOP_MARKET', triggerPrice: '49000', quantity: '0.1', reduceOnly: true }));
    expect(submitAlgoOrder).toHaveBeenCalledWith(expect.objectContaining({ side: 'SELL', type: 'TAKE_PROFIT_MARKET', triggerPrice: '52000', reduceOnly: true }));
    expect(insertValues).toHaveBeenCalledTimes(2);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'STOP_MARKET-id', reduceOnly: true, status: 'NEW' }));
    expect(result.stopLossAlgoId).toBeNull();
    expect(result.errors).toEqual([]);
  });

  it('reports a failed leg and still places the other one', async () => {
    createStopLossOrder.mockRejectedValue(new Error('Order would immediately trigger'));

    const result = await placeEntryProtection({ ...base, stopLoss: '49000', takeProfit: '52000', protectionMode: 'OCO' });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Stop loss was not placed');
    expect(result.stopLossAlgoId).toBeNull();
    expect(result.takeProfitAlgoId).toBe('tp-1');
  });
});
