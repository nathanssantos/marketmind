import type { ChartColors } from '@shared/types';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback, useEffect } from 'react';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawCandle } from '@renderer/utils/canvas/drawingUtils';

export interface UseCandlestickRendererProps {
  manager: CanvasManager | null;
  colors: ChartColors;
  enabled?: boolean;
}

export interface UseCandlestickRendererReturn {
  render: () => void;
}

export const useCandlestickRenderer = ({
  manager,
  colors,
  enabled = true,
}: UseCandlestickRendererProps): UseCandlestickRendererReturn => {
  const render = useCallback((): void => {
    if (!manager || !enabled) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();

    if (!ctx || !dimensions) return;

    const visibleCandles = manager.getVisibleCandles();
    const { candleWidth } = viewport;

    visibleCandles.forEach((candle, index) => {
      const actualIndex = Math.floor(viewport.start) + index;
      const x = manager.indexToX(actualIndex);

      const openY = manager.priceToY(candle.open);
      const closeY = manager.priceToY(candle.close);
      const highY = manager.priceToY(candle.high);
      const lowY = manager.priceToY(candle.low);

      drawCandle(
        ctx,
        x,
        openY,
        closeY,
        highY,
        lowY,
        candleWidth,
        CHART_CONFIG.CANDLE_WICK_WIDTH,
        colors.bullish,
        colors.bearish,
      );
    });
  }, [manager, colors, enabled]);

  useEffect(() => {
    render();
  }, [render]);

  return { render };
};
