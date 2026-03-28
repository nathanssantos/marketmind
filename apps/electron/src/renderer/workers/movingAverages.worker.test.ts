import { calculateMovingAverages } from '@marketmind/indicators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@marketmind/indicators', () => ({
  calculateMovingAverages: vi.fn(() => [{ type: 'SMA', period: 20, values: [100, 101, 102] }]),
}));

describe('movingAverages.worker', () => {
  const mockPostMessage = vi.fn();
  const mockKlines = [{ openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' }];
  const mockConfigs = [{ type: 'SMA' as const, period: 20, source: 'close' as const }];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = { postMessage: mockPostMessage, onmessage: null };
  });

  it('should calculate moving averages', async () => {
    await import('./movingAverages.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: mockKlines, configs: mockConfigs } } as MessageEvent);
    expect(calculateMovingAverages).toHaveBeenCalledWith(mockKlines, mockConfigs);
    expect(mockPostMessage).toHaveBeenCalledWith([{ type: 'SMA', period: 20, values: [100, 101, 102] }]);
  });

  it('should post null for empty klines', async () => {
    vi.resetModules();
    await import('./movingAverages.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { klines: [], configs: mockConfigs } } as MessageEvent);
    expect(calculateMovingAverages).not.toHaveBeenCalled();
    expect(mockPostMessage).toHaveBeenCalledWith(null);
  });
});
