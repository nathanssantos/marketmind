import { calculateMACD } from '@marketmind/indicators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@marketmind/indicators', () => ({
  calculateMACD: vi.fn(() => ({ macd: [0.5], signal: [0.3], histogram: [0.2] })),
}));

describe('macd.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should calculate MACD', async () => {
    await import('./macd.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines, fast: 12, slow: 26, signal: 9 } } as MessageEvent);
    expect(calculateMACD).toHaveBeenCalledWith(mockKlines, 12, 26, 9);
  });

  it('should post null when klines empty', async () => {
    vi.resetModules();
    await import('./macd.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: [], fast: 12, slow: 26, signal: 9 } } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith(null);
  });
});
