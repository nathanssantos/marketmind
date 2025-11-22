import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawCandle } from '@renderer/utils/canvas/drawingUtils';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback } from 'react';

export interface UseCandlestickRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  rightMargin?: number;
  candleWickWidth?: number;
  hoveredCandleIndex?: number;
}

export interface UseCandlestickRendererReturn {
  render: () => void;
}

export const useCandlestickRenderer = ({
  manager,
  colors,
  enabled = true,
  rightMargin,
  candleWickWidth,
  hoveredCandleIndex,
}: UseCandlestickRendererProps): UseCandlestickRendererReturn => {
  const render = useCallback((): void => {
    if (!manager || !enabled) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();

    if (!ctx || !dimensions) return;

    const visibleCandles = manager.getVisibleCandles();
    const { candleWidth } = viewport;
    const { chartWidth } = dimensions;
    const effectiveWidth = chartWidth - (rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);
    
    const visibleRange = viewport.end - viewport.start;
    const widthPerCandle = effectiveWidth / visibleRange;

    ctx.save();

    visibleCandles.forEach((candle, index) => {
      const actualIndex = Math.floor(viewport.start) + index;
      const x = manager.indexToX(actualIndex);

      if (x + candleWidth < 0 || x > effectiveWidth) return;

      const candleX = x + (widthPerCandle - candleWidth) / 2;

      const openY = manager.priceToY(candle.open);
      const closeY = manager.priceToY(candle.close);
      const highY = manager.priceToY(candle.high);
      const lowY = manager.priceToY(candle.low);

      const isHovered = hoveredCandleIndex === actualIndex;

      drawCandle(
        ctx,
        candleX,
        openY,
        closeY,
        highY,
        lowY,
        candleWidth,
        candleWickWidth ?? CHART_CONFIG.CANDLE_WICK_WIDTH,
        colors.bullish,
        colors.bearish,
        isHovered,
      );
    });

    ctx.restore();
  }, [manager, colors, enabled, rightMargin, candleWickWidth, hoveredCandleIndex]);

  return { render };
};
