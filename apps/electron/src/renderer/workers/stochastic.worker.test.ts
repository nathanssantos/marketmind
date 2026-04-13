import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockComputeMulti = vi.fn(() => Promise.resolve({ k: [50, 55], d: [45, 50] }));

vi.mock('./pineWorkerService', () => ({
  computeMulti: mockComputeMulti,
}));

describe('stochastic.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    mockComputeMulti.mockResolvedValue({ k: [50, 55], d: [45, 50] });
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should calculate Stochastic', async () => {
    await import('./stochastic.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: mockKlines, kPeriod: 14, kSmoothing: 3, dPeriod: 3 } } as MessageEvent);
    expect(mockComputeMulti).toHaveBeenCalledWith('stoch', mockKlines, { period: 14, smoothK: 3 });
    expect(mockPostMessage).toHaveBeenCalled();
  });

  it('should post null for empty klines', async () => {
    vi.resetModules();
    await import('./stochastic.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: [], kPeriod: 14, kSmoothing: 3, dPeriod: 3 } } as MessageEvent);
    expect(mockComputeMulti).not.toHaveBeenCalled();
    expect(mockPostMessage).toHaveBeenCalledWith(null);
  });
});
