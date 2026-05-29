import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = new Map<string, (arg: unknown) => void>();
const mockOn = vi.fn((event: string, cb: (arg: unknown) => void) => { handlers.set(event, cb); });
const mockCloseAll = vi.fn();

vi.mock('binance', () => ({
  WebsocketClient: class {
    on = mockOn;
    closeAll = mockCloseAll;
  },
}));

vi.mock('../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() },
}));
vi.mock('../../utils/errors', () => ({ serializeError: (e: unknown) => e }));
vi.mock('../../services/binance-client', () => ({ silentWsLogger: {} }));

import { BinanceWebSocketStreamBase } from '../../services/binance-ws-stream-base';

class TestStream extends BinanceWebSocketStreamBase {
  protected readonly label = 'Test';
  messages: unknown[] = [];
  reconnectCount = 0;
  startHookCount = 0;
  stopHookCount = 0;
  protected handleMessage(data: unknown): void { this.messages.push(data); }
  protected onReconnected(): void { this.reconnectCount++; }
  protected override onStart(): void { this.startHookCount++; }
  protected override onStop(): void { this.stopHookCount++; }
}

describe('BinanceWebSocketStreamBase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('start wires message/error/reconnected handlers and runs onStart once', () => {
    const s = new TestStream();
    s.start();
    expect(handlers.has('message')).toBe(true);
    expect(handlers.has('error')).toBe(true);
    expect(handlers.has('reconnected')).toBe(true);
    expect(s.startHookCount).toBe(1);
  });

  it('start is idempotent — second call does not re-wire', () => {
    const s = new TestStream();
    s.start();
    mockOn.mockClear();
    s.start();
    expect(mockOn).not.toHaveBeenCalled();
    expect(s.startHookCount).toBe(1);
  });

  it('routes messages to handleMessage', () => {
    const s = new TestStream();
    s.start();
    handlers.get('message')!({ e: 'x' });
    expect(s.messages).toEqual([{ e: 'x' }]);
  });

  it('dedupes a reconnect burst into a single onReconnected', () => {
    const s = new TestStream();
    s.start();
    const reconnect = handlers.get('reconnected')!;
    reconnect(undefined);
    reconnect(undefined);
    reconnect(undefined);
    expect(s.reconnectCount).toBe(1);
    // After the dedupe window, a fresh reconnect fires again.
    vi.advanceTimersByTime(2000);
    reconnect(undefined);
    expect(s.reconnectCount).toBe(2);
  });

  it('stop runs onStop, closes the client, and allows a clean restart', () => {
    const s = new TestStream();
    s.start();
    s.stop();
    expect(s.stopHookCount).toBe(1);
    expect(mockCloseAll).toHaveBeenCalledWith(true);
    // restart works (client was nulled)
    mockOn.mockClear();
    s.start();
    expect(mockOn).toHaveBeenCalled();
  });

  it('stop is a no-op when never started', () => {
    const s = new TestStream();
    expect(() => s.stop()).not.toThrow();
    expect(s.stopHookCount).toBe(0);
  });
});
