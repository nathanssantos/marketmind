import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockComputeSingle = vi.fn(() => Promise.resolve([50, 55, 60]));

vi.mock('./pineWorkerService', () => ({
  computeSingle: mockComputeSingle,
}));

describe('mfi.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    mockComputeSingle.mockResolvedValue([50, 55, 60]);
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should calculate MFI with default period', async () => {
    await import('./mfi.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: mockKlines } } as MessageEvent);
    expect(mockComputeSingle).toHaveBeenCalledWith('mfi', mockKlines, { period: 14 });
  });

  it('should use custom period', async () => {
    vi.resetModules();
    await import('./mfi.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: mockKlines, period: 20 } } as MessageEvent);
    expect(mockComputeSingle).toHaveBeenCalledWith('mfi', mockKlines, { period: 20 });
  });

  it('should post null when klines empty', async () => {
    vi.resetModules();
    await import('./mfi.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: [] } } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith(null);
  });
});
