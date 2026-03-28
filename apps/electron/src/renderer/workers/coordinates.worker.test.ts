import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('coordinates.worker', () => {
  const mockPostMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = {
      postMessage: mockPostMessage,
      onmessage: null,
    };
  });

  it('should convert prices to Y coordinates', async () => {
    await import('./coordinates.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({
      data: {
        type: 'batchPriceToY',
        data: [100, 110, 120],
        bounds: { minPrice: 100, maxPrice: 120 },
        dimensions: { chartHeight: 400, chartWidth: 800 },
        paddingTop: 10,
        paddingBottom: 10,
      },
    } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({ results: expect.any(Array) }));
  });

  it('should convert indices to X coordinates', async () => {
    vi.resetModules();
    await import('./coordinates.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({
      data: {
        type: 'batchIndexToX',
        data: [0, 5, 10],
        viewport: { start: 0, end: 20 },
        dimensions: { chartHeight: 400, chartWidth: 800 },
        rightMargin: 50,
      },
    } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({ results: expect.any(Array) }));
  });

  it('should handle zero price range', async () => {
    vi.resetModules();
    await import('./coordinates.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({
      data: {
        type: 'batchPriceToY',
        data: [100, 100, 100],
        bounds: { minPrice: 100, maxPrice: 100 },
        dimensions: { chartHeight: 400, chartWidth: 800 },
      },
    } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith({
      results: [200, 200, 200],
    });
  });
});
