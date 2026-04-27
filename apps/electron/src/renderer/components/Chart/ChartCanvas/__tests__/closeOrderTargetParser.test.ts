import { describe, expect, it } from 'vitest';
import { encodeSltpTarget, parseCloseTarget } from '../closeOrderTargetParser';

describe('parseCloseTarget', () => {
  it('null → modal-clear (used to dismiss the modal without acting)', () => {
    expect(parseCloseTarget(null)).toEqual({ kind: 'modal-clear' });
  });

  it('empty string → modal-clear (defensive — a falsy id is the same as null)', () => {
    expect(parseCloseTarget('')).toEqual({ kind: 'modal-clear' });
  });

  it('"ts-disable" → ts-disable (sentinel for trailing-stop X button)', () => {
    expect(parseCloseTarget('ts-disable')).toEqual({ kind: 'ts-disable' });
  });

  describe('sltp encoding', () => {
    it('parses single-execution stopLoss', () => {
      expect(parseCloseTarget('sltp:stopLoss:exec-1')).toEqual({
        kind: 'sltp',
        sltpType: 'stopLoss',
        executionIds: ['exec-1'],
      });
    });

    it('parses multi-execution takeProfit (one position with multiple entries)', () => {
      expect(parseCloseTarget('sltp:takeProfit:exec-1,exec-2,exec-3')).toEqual({
        kind: 'sltp',
        sltpType: 'takeProfit',
        executionIds: ['exec-1', 'exec-2', 'exec-3'],
      });
    });

    it('filters empty execution ids from a trailing comma', () => {
      expect(parseCloseTarget('sltp:stopLoss:exec-1,,exec-2,')).toEqual({
        kind: 'sltp',
        sltpType: 'stopLoss',
        executionIds: ['exec-1', 'exec-2'],
      });
    });

    it('handles a UUID execution id with hyphens (no false-split on internal dashes)', () => {
      expect(parseCloseTarget('sltp:stopLoss:abc-123-def-456')).toEqual({
        kind: 'sltp',
        sltpType: 'stopLoss',
        executionIds: ['abc-123-def-456'],
      });
    });

    it('handles a malformed sltp string (only one colon) without throwing', () => {
      expect(parseCloseTarget('sltp:stopLoss')).toEqual({
        kind: 'sltp',
        sltpType: 'stopLoss',
        executionIds: [],
      });
    });
  });

  describe('exchange encoding', () => {
    it('parses an exchange-order- prefix as a regular (non-algo) order', () => {
      expect(parseCloseTarget('exchange-order-12345')).toEqual({
        kind: 'exchange',
        isAlgo: false,
        exchangeOrderId: '12345',
        rawId: 'exchange-order-12345',
      });
    });

    it('parses an exchange-algo- prefix as an algo (STOP_MARKET / TAKE_PROFIT_MARKET)', () => {
      expect(parseCloseTarget('exchange-algo-67890')).toEqual({
        kind: 'exchange',
        isAlgo: true,
        exchangeOrderId: '67890',
        rawId: 'exchange-algo-67890',
      });
    });

    it('handles a Binance order id with internal dashes (UUID-style)', () => {
      expect(parseCloseTarget('exchange-order-uuid-1-2-3')).toMatchObject({
        kind: 'exchange',
        isAlgo: false,
        exchangeOrderId: 'uuid-1-2-3',
      });
    });
  });

  describe('execution id (default)', () => {
    it('parses an arbitrary id as an execution id', () => {
      expect(parseCloseTarget('exec-abc-123')).toEqual({
        kind: 'execution',
        executionId: 'exec-abc-123',
      });
    });

    it('does not match exchange- without the order/algo subprefix as execution', () => {
      // 'exchange-' alone matches the exchange branch — exchangeOrderId becomes ''
      expect(parseCloseTarget('exchange-order-')).toEqual({
        kind: 'exchange',
        isAlgo: false,
        exchangeOrderId: '',
        rawId: 'exchange-order-',
      });
    });
  });
});

describe('encodeSltpTarget (round-trip with parseCloseTarget)', () => {
  it('encodes a single execution', () => {
    const encoded = encodeSltpTarget('stopLoss', ['exec-1']);
    expect(encoded).toBe('sltp:stopLoss:exec-1');
    expect(parseCloseTarget(encoded)).toMatchObject({
      kind: 'sltp',
      sltpType: 'stopLoss',
      executionIds: ['exec-1'],
    });
  });

  it('encodes multiple executions joined by commas', () => {
    const encoded = encodeSltpTarget('takeProfit', ['a', 'b', 'c']);
    expect(encoded).toBe('sltp:takeProfit:a,b,c');
    expect(parseCloseTarget(encoded)).toMatchObject({
      kind: 'sltp',
      sltpType: 'takeProfit',
      executionIds: ['a', 'b', 'c'],
    });
  });

  it('handles empty list', () => {
    expect(encodeSltpTarget('stopLoss', [])).toBe('sltp:stopLoss:');
  });
});
