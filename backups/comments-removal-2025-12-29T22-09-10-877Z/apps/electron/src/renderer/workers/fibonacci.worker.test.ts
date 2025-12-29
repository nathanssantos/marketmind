import { calculateAutoFibonacci } from '@marketmind/indicators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@marketmind/indicators', () => ({
  calculateAutoFibonacci: vi.fn(() => ({ levels: [100, 123.6, 138.2, 150, 161.8] })),
}));

describe('fibonacci.worker', () => {
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

  it('should calculate Fibonacci with default lookback and post result', async () => {
    await import('./fibonacci.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines } } as MessageEvent);
    expect(calculateAutoFibonacci).toHaveBeenCalledWith(mockKlines, 50);
    expect(mockPostMessage).toHaveBeenCalled();
  });

  it('should use custom lookback when provided', async () => {
    vi.resetModules();
    await import('./fibonacci.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines, lookback: 100 } } as MessageEvent);
    expect(calculateAutoFibonacci).toHaveBeenCalledWith(mockKlines, 100);
  });
});
