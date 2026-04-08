import { calculateDonchian } from '../lib/indicators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/indicators', () => ({
  calculateDonchian: vi.fn(() => ({ upper: [110, 112], lower: [95, 97], middle: [102.5, 104.5] })),
}));

describe('donchian.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [
    { openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' },
    { openTime: 2000, closeTime: 3000, open: '102', high: '108', low: '100', close: '105', volume: '1100', quoteVolume: '115500', trades: 110, takerBuyBaseVolume: '550', takerBuyQuoteVolume: '57750' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = {
      postMessage: mockPostMessage,
      onmessage: null,
    };
  });

  it('should calculate Donchian with default period and post result', async () => {
    await import('./donchian.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines } } as MessageEvent);
    expect(calculateDonchian).toHaveBeenCalledWith(mockKlines, 20);
    expect(mockPostMessage).toHaveBeenCalled();
  });

  it('should use custom period when provided', async () => {
    vi.resetModules();
    await import('./donchian.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines, period: 14 } } as MessageEvent);
    expect(calculateDonchian).toHaveBeenCalledWith(mockKlines, 14);
  });
});
