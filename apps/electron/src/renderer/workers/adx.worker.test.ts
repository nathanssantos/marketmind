import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockComputeMulti = vi.fn(() => Promise.resolve({ adx: [25, 30], plusDI: [20, 25], minusDI: [15, 20] }));

vi.mock('./pineWorkerService', () => ({
  computeMulti: mockComputeMulti,
}));

describe('adx.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [
    { openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' },
    { openTime: 2000, closeTime: 3000, open: '102', high: '108', low: '100', close: '105', volume: '1100', quoteVolume: '115500', trades: 110, takerBuyBaseVolume: '550', takerBuyQuoteVolume: '57750' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockComputeMulti.mockResolvedValue({ adx: [25, 30], plusDI: [20, 25], minusDI: [15, 20] });
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = {
      postMessage: mockPostMessage,
      onmessage: null,
    };
  });

  it('should calculate ADX and post result', async () => {
    await import('./adx.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: mockKlines, period: 14 } } as MessageEvent);
    expect(mockComputeMulti).toHaveBeenCalledWith('dmi', mockKlines, { period: 14 });
    expect(mockPostMessage).toHaveBeenCalled();
  });

  it('should post null when klines are empty', async () => {
    vi.resetModules();
    await import('./adx.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: [], period: 14 } } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith(null);
  });

  it('should post null when klines are undefined', async () => {
    vi.resetModules();
    await import('./adx.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => Promise<void> } }).self.onmessage;
    await handler({ data: { klines: undefined, period: 14 } } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith(null);
  });
});
