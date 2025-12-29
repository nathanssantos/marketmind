import { calculateOBV } from '@marketmind/indicators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@marketmind/indicators', () => ({
  calculateOBV: vi.fn(() => ({ obv: [1000, 2000, 3000], sma: [1500, 2000, 2500] })),
}));

describe('obv.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should calculate OBV without SMA', async () => {
    await import('./obv.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines } } as MessageEvent);
    expect(calculateOBV).toHaveBeenCalledWith(mockKlines, undefined);
  });

  it('should calculate OBV with SMA period', async () => {
    vi.resetModules();
    await import('./obv.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines, smaPeriod: 20 } } as MessageEvent);
    expect(calculateOBV).toHaveBeenCalledWith(mockKlines, 20);
  });
});
