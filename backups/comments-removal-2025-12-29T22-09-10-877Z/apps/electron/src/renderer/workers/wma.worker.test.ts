import { calculateWMA } from '@marketmind/indicators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@marketmind/indicators', () => ({
  calculateWMA: vi.fn(() => ({ wma: [100, 101, 102] })),
}));

describe('wma.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should calculate WMA with default period', async () => {
    await import('./wma.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines } } as MessageEvent);
    expect(calculateWMA).toHaveBeenCalledWith(mockKlines, 20);
  });

  it('should use custom period', async () => {
    vi.resetModules();
    await import('./wma.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines, period: 14 } } as MessageEvent);
    expect(calculateWMA).toHaveBeenCalledWith(mockKlines, 14);
  });
});
