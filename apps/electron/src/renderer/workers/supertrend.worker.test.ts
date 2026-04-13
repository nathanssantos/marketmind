import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockComputeSupertrend = vi.fn(() => Promise.resolve({ value: [100, 101], trend: ['up', 'up'] }));

vi.mock('./pineWorkerService', () => ({
  computeSupertrend: mockComputeSupertrend,
}));

describe('supertrend.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should calculate Supertrend via PineTS', async () => {
    await import('./supertrend.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: mockKlines, period: 10, multiplier: 3 } } as MessageEvent);
    expect(mockComputeSupertrend).toHaveBeenCalledWith(mockKlines, 10, 3);
  });

  it('should post null when klines empty', async () => {
    vi.resetModules();
    await import('./supertrend.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: [], period: 10, multiplier: 3 } } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith(null);
  });
});
