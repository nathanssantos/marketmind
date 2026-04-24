import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockOn = vi.fn();
const mockCloseAll = vi.fn();
const mockSubscribeTrades = vi.fn();

vi.mock('binance', () => ({
  WebsocketClient: class MockWebsocketClient {
    on = mockOn;
    closeAll = mockCloseAll;
    subscribeTrades = mockSubscribeTrades;
  },
}));

vi.mock('../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() },
}));

const emitKlineUpdate = vi.fn();
vi.mock('../../services/websocket', () => ({
  getWebSocketService: vi.fn(() => ({ emitKlineUpdate })),
}));

import { KlineSynthesisService } from '../../services/kline-synthesis';

const ONE_MINUTE = 60_000;

const makeTradeMessage = (symbol: string, price: string, qty: string, timestamp: number) => ({
  e: 'trade',
  s: symbol,
  p: price,
  q: qty,
  T: timestamp,
});

describe('KlineSynthesisService', () => {
  let service: KlineSynthesisService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new KlineSynthesisService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  describe('lifecycle', () => {
    it('starts a WS client on first enable', () => {
      service.enable('BTCUSDT', '1m', 'FUTURES');
      expect(mockOn).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockSubscribeTrades).toHaveBeenCalledWith('BTCUSDT', 'usdm');
    });

    it('does not double-subscribe the same symbol across intervals', () => {
      service.enable('BTCUSDT', '1m', 'FUTURES');
      service.enable('BTCUSDT', '5m', 'FUTURES');
      expect(mockSubscribeTrades).toHaveBeenCalledTimes(1);
    });

    it('isActive reflects current enabled state', () => {
      expect(service.isActive('BTCUSDT', '1m', 'FUTURES')).toBe(false);
      service.enable('BTCUSDT', '1m', 'FUTURES');
      expect(service.isActive('BTCUSDT', '1m', 'FUTURES')).toBe(true);
      service.disable('BTCUSDT', '1m', 'FUTURES');
      expect(service.isActive('BTCUSDT', '1m', 'FUTURES')).toBe(false);
    });

    it('stop clears state and closes client', () => {
      service.enable('BTCUSDT', '1m', 'FUTURES');
      service.stop();
      expect(mockCloseAll).toHaveBeenCalled();
      expect(service.getActiveCount()).toBe(0);
    });
  });

  describe('trade bucketing and OHLCV accumulation', () => {
    it('aligns openTime to the interval boundary', () => {
      service.enable('BTCUSDT', '1m', 'FUTURES');
      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1] as (d: unknown) => void;

      const tradeAt = 1700000037_123;
      messageHandler(makeTradeMessage('BTCUSDT', '50000', '1', tradeAt));

      vi.advanceTimersByTime(250);

      const call = emitKlineUpdate.mock.calls[emitKlineUpdate.mock.calls.length - 1]?.[0];
      expect(call).toBeDefined();
      const expectedOpen = Math.floor(tradeAt / ONE_MINUTE) * ONE_MINUTE;
      expect(call.openTime).toBe(expectedOpen);
      expect(call.closeTime).toBe(expectedOpen + ONE_MINUTE - 1);
    });

    it('accumulates OHLCV across multiple trades in the same bucket', () => {
      service.enable('BTCUSDT', '1m', 'FUTURES');
      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1] as (d: unknown) => void;

      const baseTs = 1700000010_000;
      messageHandler(makeTradeMessage('BTCUSDT', '100', '1', baseTs));
      messageHandler(makeTradeMessage('BTCUSDT', '120', '2', baseTs + 5_000));
      messageHandler(makeTradeMessage('BTCUSDT', '90', '3', baseTs + 10_000));
      messageHandler(makeTradeMessage('BTCUSDT', '110', '4', baseTs + 15_000));

      vi.advanceTimersByTime(250);

      const call = emitKlineUpdate.mock.calls[emitKlineUpdate.mock.calls.length - 1]?.[0];
      expect(call).toBeDefined();
      expect(parseFloat(call.open)).toBe(100);
      expect(parseFloat(call.high)).toBe(120);
      expect(parseFloat(call.low)).toBe(90);
      expect(parseFloat(call.close)).toBe(110);
      expect(parseFloat(call.volume)).toBe(10);
      expect(call.isClosed).toBe(false);
    });

    it('emits isClosed=true for previous bucket when a new bucket begins', () => {
      service.enable('BTCUSDT', '1m', 'FUTURES');
      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1] as (d: unknown) => void;

      const firstBucketTs = 1700000010_000;
      const secondBucketTs = firstBucketTs + ONE_MINUTE + 5_000;

      messageHandler(makeTradeMessage('BTCUSDT', '100', '1', firstBucketTs));
      messageHandler(makeTradeMessage('BTCUSDT', '200', '2', secondBucketTs));

      const closedEmits = emitKlineUpdate.mock.calls.filter((c) => c[0].isClosed === true);
      expect(closedEmits.length).toBeGreaterThan(0);
      const closedCall = closedEmits[closedEmits.length - 1]?.[0];
      expect(closedCall.openTime).toBe(Math.floor(firstBucketTs / ONE_MINUTE) * ONE_MINUTE);
      expect(parseFloat(closedCall.open)).toBe(100);
    });

    it('ignores trades for symbols that are not enabled', () => {
      service.enable('BTCUSDT', '1m', 'FUTURES');
      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1] as (d: unknown) => void;

      messageHandler(makeTradeMessage('ETHUSDT', '3000', '1', 1700000010_000));
      vi.advanceTimersByTime(250);

      expect(emitKlineUpdate).not.toHaveBeenCalled();
    });

    it('supports multiple intervals for the same symbol', () => {
      service.enable('BTCUSDT', '1m', 'FUTURES');
      service.enable('BTCUSDT', '5m', 'FUTURES');
      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1] as (d: unknown) => void;

      messageHandler(makeTradeMessage('BTCUSDT', '100', '1', 1700000010_000));
      vi.advanceTimersByTime(250);

      const intervals = new Set(emitKlineUpdate.mock.calls.map((c) => c[0].interval));
      expect(intervals.has('1m')).toBe(true);
      expect(intervals.has('5m')).toBe(true);
    });

    it('stops emitting for a disabled combo', () => {
      service.enable('BTCUSDT', '1m', 'FUTURES');
      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1] as (d: unknown) => void;

      messageHandler(makeTradeMessage('BTCUSDT', '100', '1', 1700000010_000));
      vi.advanceTimersByTime(250);
      const initialCalls = emitKlineUpdate.mock.calls.length;

      service.disable('BTCUSDT', '1m', 'FUTURES');
      emitKlineUpdate.mockClear();

      messageHandler(makeTradeMessage('BTCUSDT', '105', '1', 1700000020_000));
      vi.advanceTimersByTime(500);

      expect(emitKlineUpdate).not.toHaveBeenCalled();
      expect(initialCalls).toBeGreaterThan(0);
    });
  });

  describe('throttle', () => {
    it('does not emit more than once per EMIT_THROTTLE_MS for an active bucket', () => {
      service.enable('BTCUSDT', '1m', 'FUTURES');
      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1] as (d: unknown) => void;

      const baseTs = 1700000010_000;
      for (let i = 0; i < 10; i++) {
        messageHandler(makeTradeMessage('BTCUSDT', String(100 + i), '0.1', baseTs + i * 10));
      }

      vi.advanceTimersByTime(250);
      const emittedCount = emitKlineUpdate.mock.calls.length;
      expect(emittedCount).toBeLessThanOrEqual(2);
    });
  });

  describe('malformed input', () => {
    it('ignores non-trade messages', () => {
      service.enable('BTCUSDT', '1m', 'FUTURES');
      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1] as (d: unknown) => void;

      expect(() => messageHandler({ e: 'kline', k: {} })).not.toThrow();
      expect(() => messageHandler(null)).not.toThrow();
      expect(() => messageHandler('not an object')).not.toThrow();
      vi.advanceTimersByTime(250);
      expect(emitKlineUpdate).not.toHaveBeenCalled();
    });

    it('ignores trades with invalid price or quantity', () => {
      service.enable('BTCUSDT', '1m', 'FUTURES');
      const messageHandler = mockOn.mock.calls.find((c) => c[0] === 'message')?.[1] as (d: unknown) => void;

      messageHandler({ e: 'trade', s: 'BTCUSDT', p: 'abc', q: '1', T: 1700000000000 });
      messageHandler({ e: 'trade', s: 'BTCUSDT', p: '100', q: 'xyz', T: 1700000000000 });
      messageHandler({ e: 'trade', s: 'BTCUSDT', p: '0', q: '1', T: 1700000000000 });
      messageHandler({ e: 'trade', s: 'BTCUSDT', p: '-10', q: '1', T: 1700000000000 });

      vi.advanceTimersByTime(250);
      expect(emitKlineUpdate).not.toHaveBeenCalled();
    });
  });
});
