import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/klineOptimization', () => ({
  optimizeKlines: vi.fn(() => ({ detailed: [], simplified: [], totalCount: 0 })),
}));

describe('klineOptimizer.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should optimize klines', async () => {
    await import('./klineOptimizer.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines } } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith({ detailed: [], simplified: [], totalCount: 0 });
  });

  it('should post null for empty klines', async () => {
    vi.resetModules();
    await import('./klineOptimizer.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: [] } } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith(null);
  });
});
