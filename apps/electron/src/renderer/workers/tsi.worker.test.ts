import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockComputeTSI = vi.fn(() => Promise.resolve({ tsi: [0.5, 0.6], signal: [0.4, 0.5] }));

vi.mock('./pineWorkerService', () => ({
  computeTSI: mockComputeTSI,
}));

describe('tsi.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    mockComputeTSI.mockResolvedValue({ tsi: [0.5, 0.6], signal: [0.4, 0.5] });
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should calculate TSI with defaults', async () => {
    await import('./tsi.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: mockKlines } } as MessageEvent);
    expect(mockComputeTSI).toHaveBeenCalledWith(mockKlines, 25, 13, 13);
  });

  it('should use custom params', async () => {
    vi.resetModules();
    await import('./tsi.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: mockKlines, longPeriod: 20, shortPeriod: 10, signalPeriod: 10 } } as MessageEvent);
    expect(mockComputeTSI).toHaveBeenCalledWith(mockKlines, 20, 10, 10);
  });

  it('should post null when klines empty', async () => {
    vi.resetModules();
    await import('./tsi.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: [] } } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith(null);
  });
});
