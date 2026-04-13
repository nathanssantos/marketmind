import { calculateIchimoku } from '../lib/indicators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/indicators', () => ({
  calculateIchimoku: vi.fn(() => ({ tenkan: [100], kijun: [98], chikou: [101], senkouA: [99], senkouB: [97] })),
}));

describe('ichimoku.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should calculate Ichimoku', async () => {
    await import('./ichimoku.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines, tenkan: 9, kijun: 26, senkou: 52 } } as MessageEvent);
    expect(calculateIchimoku).toHaveBeenCalledWith(mockKlines, 9, 26, 52);
  });

  it('should post null when klines empty', async () => {
    vi.resetModules();
    await import('./ichimoku.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: [], tenkan: 9, kijun: 26, senkou: 52 } } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith(null);
  });
});
