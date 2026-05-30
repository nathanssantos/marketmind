import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    subscribeAllLiquidationOrders(_m: string): Promise<void> { return Promise.resolve(); }
    emitMessage(data: unknown): void {
      for (const h of this.handlers.get('message') ?? []) h(data);
    }
  }
  return { WebsocketClient: FakeWebsocketClient };
});

import { BinanceLiquidationStreamService } from '../../services/binance-liquidation-stream';

const client = (s: BinanceLiquidationStreamService) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).client as { emitMessage: (d: unknown) => void };

describe('BinanceLiquidationStreamService', () => {
  let service: BinanceLiquidationStreamService;
  beforeEach(() => {
    service = new BinanceLiquidationStreamService();
    service.start();
  });
  afterEach(() => service.stop());

  it('parses a forceOrder (raw o.{S,ap,l}) into a liquidation event', () => {
    const observer = vi.fn();
    service.onLiquidation(observer);

    client(service).emitMessage({
      e: 'forceOrder',
      E: 1_700_000_000_000,
      o: { s: 'BTCUSDT', S: 'SELL', ap: '79000', l: '1.5' },
    });

    expect(observer).toHaveBeenCalledTimes(1);
    const ev = observer.mock.calls[0]![0];
    // symbol is carried on the internal `_symbol` field of the event.
    expect(ev._symbol).toBe('BTCUSDT');
    expect(ev.side).toBe('SELL');
    expect(ev.price).toBe(79000);
    expect(ev.quantity).toBe(1.5);
  });

  it('ignores non-forceOrder events and malformed orders', () => {
    const observer = vi.fn();
    service.onLiquidation(observer);
    client(service).emitMessage({ e: 'aggTrade', s: 'BTCUSDT' });
    client(service).emitMessage({ e: 'forceOrder' });
    expect(observer).not.toHaveBeenCalled();
  });
});
