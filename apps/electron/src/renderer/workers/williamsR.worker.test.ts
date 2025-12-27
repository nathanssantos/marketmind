import { calculateWilliamsR } from '@marketmind/indicators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@marketmind/indicators', () => ({
  calculateWilliamsR: vi.fn(() => ({ williamsR: [-20, -50, -80] })),
}));

describe('williamsR.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should calculate Williams %R', async () => {
    await import('./williamsR.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines, period: 14 } } as MessageEvent);
    expect(calculateWilliamsR).toHaveBeenCalledWith(mockKlines, 14);
  });

  it('should post null when klines empty', async () => {
    vi.resetModules();
    await import('./williamsR.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: [], period: 14 } } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith(null);
  });
});
