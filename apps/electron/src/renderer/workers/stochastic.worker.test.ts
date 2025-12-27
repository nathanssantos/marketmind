import { calculateStochastic } from '@marketmind/indicators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@marketmind/indicators', () => ({
  calculateStochastic: vi.fn(() => ({ k: [50, 55], d: [45, 50] })),
}));

describe('stochastic.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should calculate Stochastic', async () => {
    await import('./stochastic.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { type: 'calculateStochastic', klines: mockKlines, kPeriod: 14, dPeriod: 3 } } as MessageEvent);
    expect(calculateStochastic).toHaveBeenCalledWith(mockKlines, 14, 3);
    expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'stochasticResult' }));
  });

  it('should ignore wrong type', async () => {
    vi.resetModules();
    await import('./stochastic.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { type: 'wrongType', klines: mockKlines, kPeriod: 14, dPeriod: 3 } } as MessageEvent);
    expect(calculateStochastic).not.toHaveBeenCalled();
  });
});
