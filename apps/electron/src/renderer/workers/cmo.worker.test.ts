import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockComputeSingle = vi.fn(() => Promise.resolve([25, -15, 35]));

vi.mock('./pineWorkerService', () => ({
  computeSingle: mockComputeSingle,
}));

describe('cmo.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [
    { openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' },
    { openTime: 2000, closeTime: 3000, open: '102', high: '108', low: '100', close: '105', volume: '1100', quoteVolume: '115500', trades: 110, takerBuyBaseVolume: '550', takerBuyQuoteVolume: '57750' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockComputeSingle.mockResolvedValue([25, -15, 35]);
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = {
      postMessage: mockPostMessage,
      onmessage: null,
    };
  });

  it('should calculate CMO with default period and post result', async () => {
    await import('./cmo.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: mockKlines } } as MessageEvent);
    expect(mockComputeSingle).toHaveBeenCalledWith('cmo', mockKlines, { period: 14 });
    expect(mockPostMessage).toHaveBeenCalled();
  });

  it('should use custom period when provided', async () => {
    vi.resetModules();
    await import('./cmo.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: mockKlines, period: 20 } } as MessageEvent);
    expect(mockComputeSingle).toHaveBeenCalledWith('cmo', mockKlines, { period: 20 });
  });

  it('should post null when klines are empty', async () => {
    vi.resetModules();
    await import('./cmo.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: [] } } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith(null);
  });
});
