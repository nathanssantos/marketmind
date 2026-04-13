import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockComputeSingle = vi.fn(() => Promise.resolve([100, 101, 102]));

vi.mock('./pineWorkerService', () => ({
  computeSingle: mockComputeSingle,
}));

describe('hma.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [
    { openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockComputeSingle.mockResolvedValue([100, 101, 102]);
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = {
      postMessage: mockPostMessage,
      onmessage: null,
    };
  });

  it('should calculate HMA with default period', async () => {
    await import('./hma.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: mockKlines } } as MessageEvent);
    expect(mockComputeSingle).toHaveBeenCalledWith('hma', mockKlines, { period: 20 });
  });

  it('should use custom period', async () => {
    vi.resetModules();
    await import('./hma.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: mockKlines, period: 14 } } as MessageEvent);
    expect(mockComputeSingle).toHaveBeenCalledWith('hma', mockKlines, { period: 14 });
  });
});
