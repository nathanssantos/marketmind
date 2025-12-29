import { calculateStochRSI } from '@marketmind/indicators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@marketmind/indicators', () => ({
  calculateStochRSI: vi.fn(() => ({ k: [50, 55], d: [45, 50] })),
}));

describe('stochRsi.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should calculate StochRSI with defaults', async () => {
    await import('./stochRsi.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines } } as MessageEvent);
    expect(calculateStochRSI).toHaveBeenCalledWith(mockKlines, 14, 14, 3, 3);
  });

  it('should use custom params', async () => {
    vi.resetModules();
    await import('./stochRsi.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines, rsiPeriod: 10, stochPeriod: 10, kSmooth: 5, dSmooth: 5 } } as MessageEvent);
    expect(calculateStochRSI).toHaveBeenCalledWith(mockKlines, 10, 10, 5, 5);
  });
});
