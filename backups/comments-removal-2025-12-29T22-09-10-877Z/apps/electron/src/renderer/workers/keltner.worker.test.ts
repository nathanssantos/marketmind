import { calculateKeltner } from '@marketmind/indicators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@marketmind/indicators', () => ({
  calculateKeltner: vi.fn(() => ({ upper: [110], middle: [105], lower: [100] })),
}));

describe('keltner.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should calculate Keltner with defaults', async () => {
    await import('./keltner.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines } } as MessageEvent);
    expect(calculateKeltner).toHaveBeenCalledWith(mockKlines, 20, 10, 2);
  });

  it('should use custom params', async () => {
    vi.resetModules();
    await import('./keltner.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines, emaPeriod: 14, atrPeriod: 7, multiplier: 1.5 } } as MessageEvent);
    expect(calculateKeltner).toHaveBeenCalledWith(mockKlines, 14, 7, 1.5);
  });
});
