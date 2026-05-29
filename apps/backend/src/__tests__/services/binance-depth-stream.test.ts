import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/websocket', () => ({
  getWebSocketService: () => ({ emitDepthUpdate: vi.fn() }),
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
    subscribeDiffBookDepth(_s: string, _n: number, _m: string): Promise<void> { return Promise.resolve(); }
    emitMessage(data: unknown): void {
      for (const h of this.handlers.get('message') ?? []) h(data);
    }
  }
  return { WebsocketClient: FakeWebsocketClient };
});

import { BinanceDepthStreamService } from '../../services/binance-depth-stream';

// Minimal REST client stub for the snapshot path (not exercised here).
const fakeRest = { getOrderBook: vi.fn().mockResolvedValue({ lastUpdateId: 1, bids: [], asks: [] }) };

const client = (s: BinanceDepthStreamService) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).client as { emitMessage: (d: unknown) => void; subscribeDiffBookDepth: (a: string, b: number, c: string) => Promise<void> };

describe('BinanceDepthStreamService', () => {
  let service: BinanceDepthStreamService;
  beforeEach(() => {
    service = new BinanceDepthStreamService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service.start(fakeRest as any);
  });
  afterEach(() => service.stop());

  it('subscribes once per symbol (idempotent, lowercased)', () => {
    const spy = vi.spyOn(client(service), 'subscribeDiffBookDepth');
    service.subscribe('BTCUSDT');
    service.subscribe('btcusdt');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(service.getSubscribedSymbols()).toContain('btcusdt');
  });

  it('does not throw on a non-depth message', () => {
    expect(() => client(service).emitMessage({ e: 'aggTrade', s: 'BTCUSDT' })).not.toThrow();
  });

  it('does not emit for a diff before any snapshot is seeded', () => {
    const observer = vi.fn();
    service.onDepthUpdate(observer);
    client(service).emitMessage({ e: 'depthUpdate', s: 'BTCUSDT', U: 1, u: 5, b: [['100', '1']], a: [['101', '1']] });
    // No snapshot → the diff can't be applied yet → no emit.
    expect(observer).not.toHaveBeenCalled();
  });
});
