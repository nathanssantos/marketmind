import { calculateUltimateOscillator } from '../lib/indicators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/indicators', () => ({
  calculateUltimateOscillator: vi.fn(() => [50, 55, 60]),
}));

describe('ultimateOsc.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should calculate Ultimate Oscillator with defaults', async () => {
    await import('./ultimateOsc.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines } } as MessageEvent);
    expect(calculateUltimateOscillator).toHaveBeenCalledWith(mockKlines, 7, 14, 28);
  });

  it('should use custom params', async () => {
    vi.resetModules();
    await import('./ultimateOsc.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines, shortPeriod: 5, midPeriod: 10, longPeriod: 20 } } as MessageEvent);
    expect(calculateUltimateOscillator).toHaveBeenCalledWith(mockKlines, 5, 10, 20);
  });

  it('should post null when klines empty', async () => {
    vi.resetModules();
    await import('./ultimateOsc.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: [] } } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith(null);
  });
});
