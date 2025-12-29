import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/boundsCalculation', () => ({
  calculateBounds: vi.fn(() => ({ minPrice: 95, maxPrice: 110, minVolume: 1000, maxVolume: 1500 })),
}));

describe('bounds.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [
    { openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' },
    { openTime: 2000, closeTime: 3000, open: '102', high: '110', low: '100', close: '105', volume: '1500', quoteVolume: '157500', trades: 150, takerBuyBaseVolume: '750', takerBuyQuoteVolume: '78750' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = {
      postMessage: mockPostMessage,
      onmessage: null,
    };
  });

  it('should calculate bounds and post result', async () => {
    await import('./bounds.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { type: 'calculateBounds', klines: mockKlines, viewportStart: 0, viewportEnd: 2 } } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'boundsResult',
      minPrice: 95,
      maxPrice: 110,
      minVolume: 1000,
      maxVolume: 1500,
    });
  });

  it('should ignore messages with wrong type', async () => {
    vi.resetModules();
    await import('./bounds.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { type: 'wrongType', klines: mockKlines, viewportStart: 0, viewportEnd: 2 } } as MessageEvent);
    expect(mockPostMessage).not.toHaveBeenCalled();
  });
});
