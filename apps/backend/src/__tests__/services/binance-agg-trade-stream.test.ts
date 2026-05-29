import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockEmit = vi.fn();
vi.mock('../../services/websocket', () => ({
  getWebSocketService: () => ({ emitAggTradeUpdate: mockEmit }),
}));
vi.mock('../../services/binance-client', () => ({
  silentWsLogger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, trace: () => {}, silly: () => {} },
}));
// DB is only touched by the flush timer; stub it so nothing hits Postgres.
vi.mock('../../db', () => ({ db: { insert: () => ({ values: () => Promise.resolve() }) } }));
vi.mock('../../db/schema', () => ({ aggTrades: {} }));
vi.mock('binance', () => {
  class FakeWebsocketClient {
    private handlers = new Map<string, ((data: unknown) => void)[]>();
    on(event: string, handler: (data: unknown) => void): void {
      const list = this.handlers.get(event) ?? [];
      list.push(handler);
      this.handlers.set(event, list);
    }
    closeAll(): void {}
    subscribeAggregateTrades(_s: string, _m: string): Promise<void> { return Promise.resolve(); }
    emitMessage(data: unknown): void {
      for (const h of this.handlers.get('message') ?? []) h(data);
    }
  }
  return { WebsocketClient: FakeWebsocketClient };
});

import { BinanceAggTradeStreamService } from '../../services/binance-agg-trade-stream';

const client = (s: BinanceAggTradeStreamService) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).client as { emitMessage: (d: unknown) => void; subscribeAggregateTrades: (a: string, b: string) => Promise<void> };

describe('BinanceAggTradeStreamService', () => {
  let service: BinanceAggTradeStreamService;
  beforeEach(() => {
    mockEmit.mockClear();
    service = new BinanceAggTradeStreamService();
    service.start();
  });
  afterEach(() => service.stop());

  it('parses an aggTrade (raw p/q/a/m/T) into a trade', () => {
    const observer = vi.fn();
    service.onAggTradeUpdate(observer);

    client(service).emitMessage({ e: 'aggTrade', s: 'BTCUSDT', p: '79000.5', q: '0.25', a: 42, m: true, T: 1_700_000_000_000 });

    expect(observer).toHaveBeenCalledTimes(1);
    const t = observer.mock.calls[0]![0];
    expect(t.symbol).toBe('BTCUSDT');
    expect(t.price).toBe(79000.5);
    expect(t.quantity).toBe(0.25);
    expect(t.tradeId).toBe(42);
    expect(t.isBuyerMaker).toBe(true);
  });

  it('emits the trade via the WebSocket service', () => {
    client(service).emitMessage({ eventType: 'aggTrade', symbol: 'ETHUSDT', price: '4500', quantity: '1', aggregateTradeId: 7, isBuyerMaker: false, tradeTime: Date.now() });
    expect(mockEmit).toHaveBeenCalledWith('ETHUSDT', expect.objectContaining({ price: 4500 }), expect.any(Boolean));
  });

  it('ignores non-aggTrade events', () => {
    const observer = vi.fn();
    service.onAggTradeUpdate(observer);
    client(service).emitMessage({ e: 'bookTicker', s: 'BTCUSDT' });
    expect(observer).not.toHaveBeenCalled();
  });

  it('subscribes once per symbol (idempotent)', () => {
    const spy = vi.spyOn(client(service), 'subscribeAggregateTrades');
    service.subscribe('BTCUSDT');
    service.subscribe('BTCUSDT');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
