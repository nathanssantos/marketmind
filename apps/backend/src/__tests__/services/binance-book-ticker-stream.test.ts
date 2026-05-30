import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockEmit = vi.fn();
vi.mock('../../services/websocket', () => ({
  getWebSocketService: () => ({ emitBookTickerUpdate: mockEmit }),
}));
vi.mock('../../services/binance-client', () => ({
  silentWsLogger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, trace: () => {}, silly: () => {} },
}));
vi.mock('binance', () => {
  class FakeWebsocketClient {
    private handlers = new Map<string, ((data: unknown) => void)[]>();
    on(event: string, handler: (data: unknown) => void): void {
      const list = this.handlers.get(event) ?? [];
      list.push(handler);
      this.handlers.set(event, list);
    }
    closeAll(): void {}
    subscribeSymbolBookTicker(_s: string, _m: string): Promise<void> { return Promise.resolve(); }
    emitMessage(data: unknown): void {
      for (const h of this.handlers.get('message') ?? []) h(data);
    }
  }
  return { WebsocketClient: FakeWebsocketClient };
});

import { BinanceBookTickerStreamService } from '../../services/binance-book-ticker-stream';

const client = (s: BinanceBookTickerStreamService) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).client as { emitMessage: (d: unknown) => void; subscribeSymbolBookTicker: (a: string, b: string) => Promise<void> };

describe('BinanceBookTickerStreamService', () => {
  let service: BinanceBookTickerStreamService;
  beforeEach(() => {
    mockEmit.mockClear();
    service = new BinanceBookTickerStreamService();
    service.start();
  });
  afterEach(() => service.stop());

  it('parses a bookTicker (raw b/B/a/A) into bid/ask + derived microprice & spread', () => {
    const observer = vi.fn();
    service.onBookTickerUpdate(observer);

    client(service).emitMessage({ e: 'bookTicker', s: 'BTCUSDT', b: '100', B: '2', a: '102', A: '3' });

    expect(observer).toHaveBeenCalledTimes(1);
    const u = observer.mock.calls[0]![0];
    expect(u.bidPrice).toBe(100);
    expect(u.askPrice).toBe(102);
    expect(u.spread).toBeCloseTo(2);
    // microprice = (bid*askQty + ask*bidQty)/(bidQty+askQty) = (100*3+102*2)/5 = 100.8
    expect(u.microprice).toBeCloseTo(100.8);
  });

  it('emits to the per-symbol room', () => {
    client(service).emitMessage({ eventType: 'bookTicker', symbol: 'ETHUSDT', bestBidPrice: '50', bestBidQuantity: '1', bestAskPrice: '51', bestAskQuantity: '1' });
    expect(mockEmit).toHaveBeenCalledWith('ETHUSDT', expect.objectContaining({ bidPrice: 50, askPrice: 51 }));
  });

  it('ignores non-bookTicker events and non-positive prices', () => {
    const observer = vi.fn();
    service.onBookTickerUpdate(observer);
    client(service).emitMessage({ e: 'aggTrade', s: 'BTCUSDT' });
    client(service).emitMessage({ e: 'bookTicker', s: 'BTCUSDT', b: '0', a: '0' });
    expect(observer).not.toHaveBeenCalled();
  });

  it('subscribes a symbol once (idempotent, lowercased)', () => {
    const spy = vi.spyOn(client(service), 'subscribeSymbolBookTicker');
    service.subscribe('BTCUSDT');
    service.subscribe('btcusdt');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(service.getSubscribedSymbols()).toEqual(['btcusdt']);
  });
});
