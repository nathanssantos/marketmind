import { calculateParabolicSAR } from '../lib/indicators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/indicators', () => ({
  calculateParabolicSAR: vi.fn(() => ({ sar: [100, 101, 102], trend: ['up', 'up', 'down'] })),
}));

describe('parabolicSar.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should calculate Parabolic SAR with defaults', async () => {
    await import('./parabolicSar.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines } } as MessageEvent);
    expect(calculateParabolicSAR).toHaveBeenCalledWith(mockKlines, 0.02, 0.02, 0.2);
  });

  it('should use custom params', async () => {
    vi.resetModules();
    await import('./parabolicSar.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines, afStart: 0.01, afIncrement: 0.01, afMax: 0.1 } } as MessageEvent);
    expect(calculateParabolicSAR).toHaveBeenCalledWith(mockKlines, 0.01, 0.01, 0.1);
  });
});
