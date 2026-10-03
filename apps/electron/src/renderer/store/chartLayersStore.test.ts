import { describe, expect, it } from 'vitest';
import { isLayerAvailable } from './chartLayersStore';

describe('isLayerAvailable', () => {
  it('keeps the futures-only heatmap layer for futures charts only', () => {
    expect(isLayerAvailable('heatmap', 'FUTURES')).toBe(true);
    expect(isLayerAvailable('heatmap', 'SPOT')).toBe(false);
    expect(isLayerAvailable('heatmap', undefined)).toBe(false);
  });

  it('keeps every other layer on any market', () => {
    for (const layer of ['drawings', 'indicators', 'orderLines', 'setupMarkers', 'candlePatterns'] as const) {
      expect(isLayerAvailable(layer, 'SPOT')).toBe(true);
      expect(isLayerAvailable(layer, 'FUTURES')).toBe(true);
    }
  });
});
