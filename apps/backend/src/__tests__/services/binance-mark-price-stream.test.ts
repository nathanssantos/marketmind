import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockEmit = vi.fn();
vi.mock('../../services/websocket', () => ({
  getWebSocketService: () => ({ emitMarkPriceUpdate: mockEmit }),
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
    subscribeMarkPrice(_symbol: string, _market: string, _speed: number): Promise<void> {
      return Promise.resolve();
    }
    emitMessage(data: unknown): void {
      const list = this.handlers.get('message') ?? [];
      for (const h of list) h(data);
    }
  }
  return { WebsocketClient: FakeWebsocketClient };
});

import { BinanceMarkPriceStreamService } from '../../services/binance-mark-price-stream';

describe('BinanceMarkPriceStreamService', () => {
  let service: BinanceMarkPriceStreamService;

  beforeEach(() => {
    mockEmit.mockClear();
    service = new BinanceMarkPriceStreamService();
    service.start();
  });

  afterEach(() => {
    service.stop();
  });

  it('parses a markPriceUpdate payload (Binance "beautified" form) into a MarkPriceUpdate and caches it', () => {
    const observer = vi.fn();
    service.onMarkPriceUpdate(observer);

    // Simulate the WS push. Cast to any because we're injecting via the
    // private client created in start().
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeClient = (service as any).client as { emitMessage: (d: unknown) => void };

    fakeClient.emitMessage({
      eventType: 'markPriceUpdate',
      eventTime: 1_700_000_000_000,
      symbol: 'BTCUSDT',
      markPrice: '79826.30',
      indexPrice: '79800.10',
      estimatedSettlePrice: '79850.00',
      fundingRate: '0.0001',
      nextFundingTime: 1_700_001_000_000,
    });

    expect(observer).toHaveBeenCalledTimes(1);
    const update = observer.mock.calls[0]![0];
    expect(update.symbol).toBe('BTCUSDT');
    expect(update.markPrice).toBe(79826.30);
    expect(update.fundingRate).toBe(0.0001);
    expect(update.nextFundingTime).toBe(1_700_001_000_000);

    // Cache is populated with the same values.
    const cached = service.getCached('BTCUSDT');
    expect(cached).toBeTruthy();
    expect(cached!.markPrice).toBe(79826.30);
  });

  it('parses a markPriceUpdate payload in raw form (e/p/r/T fields)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeClient = (service as any).client as { emitMessage: (d: unknown) => void };

    fakeClient.emitMessage({
      e: 'markPriceUpdate',
      E: 1_700_000_000_000,
      s: 'ETHUSDT',
      p: '4500.50',
      i: '4498.00',
      P: '4501.00',
      r: '-0.0002',
      T: 1_700_002_000_000,
    });

    const cached = service.getCached('ETHUSDT');
    expect(cached).toBeTruthy();
    expect(cached!.markPrice).toBe(4500.50);
    expect(cached!.fundingRate).toBe(-0.0002);
  });

  it('emits the update via the WebSocket service to the per-symbol room', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeClient = (service as any).client as { emitMessage: (d: unknown) => void };

    fakeClient.emitMessage({
      eventType: 'markPriceUpdate',
      eventTime: 1_700_000_000_000,
      symbol: 'SOLUSDT',
      markPrice: '150.0',
      indexPrice: '149.0',
      estimatedSettlePrice: '150.5',
      fundingRate: '0',
      nextFundingTime: 1_700_001_000_000,
    });

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith('SOLUSDT', expect.objectContaining({
      symbol: 'SOLUSDT',
      markPrice: 150.0,
    }));
  });

  it('ignores non-markPriceUpdate events', () => {
    const observer = vi.fn();
    service.onMarkPriceUpdate(observer);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeClient = (service as any).client as { emitMessage: (d: unknown) => void };

    fakeClient.emitMessage({ eventType: 'kline', symbol: 'BTCUSDT' });
    fakeClient.emitMessage({ e: 'aggTrade', s: 'BTCUSDT' });

    expect(observer).not.toHaveBeenCalled();
  });

  it('rejects messages with non-positive markPrice (defensive)', () => {
    const observer = vi.fn();
    service.onMarkPriceUpdate(observer);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeClient = (service as any).client as { emitMessage: (d: unknown) => void };

    fakeClient.emitMessage({
      eventType: 'markPriceUpdate',
      symbol: 'BTCUSDT',
      markPrice: '0',
    });

    expect(observer).not.toHaveBeenCalled();
    expect(service.getCached('BTCUSDT')).toBeNull();
  });

  it('returns null from getCached for unknown symbols', () => {
    expect(service.getCached('UNKNOWN')).toBeNull();
  });

  it('returns null from getCached when value is older than maxAgeMs', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeClient = (service as any).client as { emitMessage: (d: unknown) => void };

    fakeClient.emitMessage({
      eventType: 'markPriceUpdate',
      eventTime: Date.now(),
      symbol: 'BTCUSDT',
      markPrice: '79826.30',
      indexPrice: '79800',
      estimatedSettlePrice: '79850',
      fundingRate: '0.0001',
      nextFundingTime: Date.now() + 60_000,
    });

    // Just inserted — fresh.
    expect(service.getCached('BTCUSDT', 1_000)).toBeTruthy();

    // Force the receivedAt to look stale.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache = (service as any).cache as Map<string, { receivedAt: number }>;
    const entry = cache.get('BTCUSDT')!;
    entry.receivedAt = Date.now() - 60_000;

    expect(service.getCached('BTCUSDT', 10_000)).toBeNull();
  });

  it('subscribes the requested symbol once (idempotent)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeClient = (service as any).client as { subscribeMarkPrice: ReturnType<typeof vi.fn> };
    const spy = vi.spyOn(fakeClient, 'subscribeMarkPrice');

    service.subscribe('BTCUSDT');
    service.subscribe('BTCUSDT');
    service.subscribe('BTCUSDT');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(service.getSubscribedSymbols()).toEqual(['btcusdt']);
  });
});
