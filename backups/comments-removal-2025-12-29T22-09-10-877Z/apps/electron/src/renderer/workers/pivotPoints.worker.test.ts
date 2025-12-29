import { analyzePivots } from '@marketmind/indicators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@marketmind/indicators', () => ({
  analyzePivots: vi.fn(() => ({ pivots: [], supports: [], resistances: [] })),
}));

describe('pivotPoints.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should analyze pivots with default lookback', async () => {
    await import('./pivotPoints.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines } } as MessageEvent);
    expect(analyzePivots).toHaveBeenCalledWith(mockKlines, { lookback: 5 });
  });

  it('should use custom lookback', async () => {
    vi.resetModules();
    await import('./pivotPoints.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines, lookback: 10 } } as MessageEvent);
    expect(analyzePivots).toHaveBeenCalledWith(mockKlines, { lookback: 10 });
  });
});
