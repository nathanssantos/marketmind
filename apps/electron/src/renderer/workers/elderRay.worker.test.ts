import { calculateElderRay } from '../lib/indicators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/indicators', () => ({
  calculateElderRay: vi.fn(() => ({ bullPower: [5, 8], bearPower: [-3, -5] })),
}));

describe('elderRay.worker', () => {
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

  it('should calculate Elder Ray with default period and post result', async () => {
    await import('./elderRay.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines } } as MessageEvent);
    expect(calculateElderRay).toHaveBeenCalledWith(mockKlines, 13);
    expect(mockPostMessage).toHaveBeenCalled();
  });

  it('should use custom period when provided', async () => {
    vi.resetModules();
    await import('./elderRay.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines, period: 21 } } as MessageEvent);
    expect(calculateElderRay).toHaveBeenCalledWith(mockKlines, 21);
  });

  it('should post null when klines are empty', async () => {
    vi.resetModules();
    await import('./elderRay.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: [] } } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith(null);
  });
});
