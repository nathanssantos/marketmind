import { calculateLiquidityLevels } from '@marketmind/indicators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@marketmind/indicators', () => ({
  calculateLiquidityLevels: vi.fn(() => []),
}));

describe('liquidityLevels.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should calculate liquidity levels with default lookback', async () => {
    await import('./liquidityLevels.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines } } as MessageEvent);
    expect(calculateLiquidityLevels).toHaveBeenCalledWith([105], [95], [102], { lookback: 50 });
  });

  it('should use custom lookback', async () => {
    vi.resetModules();
    await import('./liquidityLevels.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines, lookback: 100 } } as MessageEvent);
    expect(calculateLiquidityLevels).toHaveBeenCalledWith([105], [95], [102], { lookback: 100 });
  });
});
