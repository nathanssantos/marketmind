import { describe, expect, it } from 'vitest';
import { buildExchangeMoveRequest } from '../exchangeMoveBuilder';

const exec = (overrides: Partial<Parameters<typeof buildExchangeMoveRequest>[0]> = {}) =>
  ({
    symbol: 'BTCUSDT',
    side: 'LONG' as const,
    quantity: '0.5',
    marketType: 'FUTURES' as const,
    entryOrderType: 'LIMIT' as const,
    ...overrides,
  } as Parameters<typeof buildExchangeMoveRequest>[0]);

describe('buildExchangeMoveRequest — regular LIMIT order', () => {
  it('LONG LIMIT: BUY at the new price (price field, not stopPrice)', () => {
    const out = buildExchangeMoveRequest(exec({ side: 'LONG', entryOrderType: 'LIMIT' }), '50000', false, 1234);
    expect(out.newOrderRequest).toEqual({
      side: 'BUY',
      type: 'LIMIT',
      quantity: '0.5',
      price: '50000',
      reduceOnly: true,
    });
    expect(out.newOrderRequest).not.toHaveProperty('stopPrice');
  });

  it('SHORT LIMIT: SELL at the new price', () => {
    const out = buildExchangeMoveRequest(exec({ side: 'SHORT' }), '60000', false);
    expect(out.newOrderRequest.side).toBe('SELL');
    expect(out.newOrderRequest.type).toBe('LIMIT');
    expect(out.newOrderRequest.price).toBe('60000');
  });
});

describe('buildExchangeMoveRequest — algo (STOP_MARKET / TAKE_PROFIT_MARKET)', () => {
  it('preserves STOP_MARKET when the original is STOP_MARKET', () => {
    const out = buildExchangeMoveRequest(exec({ entryOrderType: 'STOP_MARKET' }), '49000', true);
    expect(out.newOrderRequest.type).toBe('STOP_MARKET');
  });

  it('preserves TAKE_PROFIT_MARKET when the original is TAKE_PROFIT_MARKET', () => {
    const out = buildExchangeMoveRequest(exec({ entryOrderType: 'TAKE_PROFIT_MARKET' }), '52000', true);
    expect(out.newOrderRequest.type).toBe('TAKE_PROFIT_MARKET');
  });

  it('falls back to STOP_MARKET if the algo entryOrderType is missing', () => {
    const out = buildExchangeMoveRequest(exec({ entryOrderType: undefined }), '49000', true);
    expect(out.newOrderRequest.type).toBe('STOP_MARKET');
  });

  it('algo: trigger price goes in stopPrice (NOT price)', () => {
    const out = buildExchangeMoveRequest(exec({ entryOrderType: 'STOP_MARKET' }), '49000', true);
    expect(out.newOrderRequest.stopPrice).toBe('49000');
    expect(out.newOrderRequest).not.toHaveProperty('price');
  });
});

describe('buildExchangeMoveRequest — optimistic execution shape', () => {
  it('builds an optimistic exec with the new entry price + pending status', () => {
    const out = buildExchangeMoveRequest(exec({ symbol: 'ETHUSDT', side: 'SHORT', quantity: '2', marketType: 'SPOT' }), '3100', false, 7777);
    expect(out.optimisticExecution).toMatchObject({
      id: 'opt-exchange-7777',
      symbol: 'ETHUSDT',
      side: 'SHORT',
      entryPrice: '3100',
      quantity: '2',
      stopLoss: null,
      takeProfit: null,
      status: 'pending',
      setupType: null,
      marketType: 'SPOT',
    });
    expect(out.optimisticExecution.entryOrderType).toBe('LIMIT');
  });

  it('marketType defaults to FUTURES when missing', () => {
    const out = buildExchangeMoveRequest(exec({ marketType: undefined }), '50000', false);
    expect(out.optimisticExecution.marketType).toBe('FUTURES');
  });

  it('opt id includes the seed (deterministic for tests)', () => {
    const out = buildExchangeMoveRequest(exec(), '50000', false, 999);
    expect(out.optimisticExecution.id).toBe('opt-exchange-999');
  });

  it('reduceOnly is always true for moves (the old order was already in-market)', () => {
    const out = buildExchangeMoveRequest(exec(), '50000', false);
    expect(out.newOrderRequest.reduceOnly).toBe(true);
  });
});
