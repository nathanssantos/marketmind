import type { ChartColors } from '@shared/types';
import { useCallback, useEffect } from 'react';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawRect } from '@renderer/utils/canvas/drawingUtils';

export interface UseVolumeRendererProps {
  manager: CanvasManager | null;
  colors: ChartColors;
  enabled?: boolean;
}

export interface UseVolumeRendererReturn {
  render: () => void;
}

export const useVolumeRenderer = ({
  manager,
  colors,
  enabled = true,
}: UseVolumeRendererProps): UseVolumeRendererReturn => {
  const render = useCallback((): void => {
    if (!manager || !enabled) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();

    if (!ctx || !dimensions) return;

    const visibleCandles = manager.getVisibleCandles();
    const { chartHeight, height } = dimensions;
    const { candleWidth } = viewport;
    const volumeY = chartHeight;

    visibleCandles.forEach((candle, index) => {
      const actualIndex = Math.floor(viewport.start) + index;
      const x = manager.indexToX(actualIndex);
      const volumeHeight = manager.volumeToHeight(candle.volume);

      const isBullish = candle.close >= candle.open;
      const color = isBullish ? colors.bullish : colors.bearish;

      drawRect(ctx, x, volumeY + (height - chartHeight - volumeHeight), candleWidth, volumeHeight, color);
    });
  }, [manager, colors, enabled]);

  useEffect(() => {
    render();
  }, [render]);

  return { render };
};
