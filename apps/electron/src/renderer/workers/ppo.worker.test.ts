import { calculatePPO } from '../lib/indicators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/indicators', () => ({
  calculatePPO: vi.fn(() => ({ ppo: [0.5], signal: [0.3], histogram: [0.2] })),
}));

describe('ppo.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should calculate PPO with defaults', async () => {
    await import('./ppo.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines } } as MessageEvent);
    expect(calculatePPO).toHaveBeenCalledWith(mockKlines, 12, 26, 9);
  });

  it('should use custom params', async () => {
    vi.resetModules();
    await import('./ppo.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines, fastPeriod: 8, slowPeriod: 17, signalPeriod: 5 } } as MessageEvent);
    expect(calculatePPO).toHaveBeenCalledWith(mockKlines, 8, 17, 5);
  });

  it('should post null when klines empty', async () => {
    vi.resetModules();
    await import('./ppo.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: [] } } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith(null);
  });
});
