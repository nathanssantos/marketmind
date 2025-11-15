import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawGrid, drawLine, drawText } from '@renderer/utils/canvas/drawingUtils';
import { formatPrice, formatTimestamp } from '@renderer/utils/formatters';
import { CHART_CONFIG } from '@shared/constants';
import type { ChartColors } from '@shared/types';
import { useCallback, useEffect } from 'react';

export interface UseGridRendererProps {
  manager: CanvasManager | null;
  colors: ChartColors;
  enabled?: boolean;
  horizontalLines?: number;
  verticalLines?: number;
  gridLineWidth?: number;
  paddingRight?: number;
  rightMargin?: number;
}

export interface UseGridRendererReturn {
  render: () => void;
}

export const useGridRenderer = ({
  manager,
  colors,
  enabled = true,
  horizontalLines = 5,
  verticalLines = 10,
  gridLineWidth,
  paddingRight,
  rightMargin,
}: UseGridRendererProps): UseGridRendererReturn => {
  const render = useCallback((): void => {
    if (!manager || !enabled) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const bounds = manager.getBounds();
    const viewport = manager.getViewport();

    if (!ctx || !dimensions || !bounds) return;

    const { width, chartHeight } = dimensions;
    const { minPrice, maxPrice } = bounds;
    const candles = manager.getVisibleCandles();

    drawGrid(
      ctx,
      width,
      chartHeight,
      horizontalLines,
      verticalLines,
      colors.grid,
      gridLineWidth ?? CHART_CONFIG.GRID_LINE_WIDTH,
    );

    const labelColor = CHART_CONFIG.AXIS_LABEL_COLOR_DARK;

    const priceRange = maxPrice - minPrice;
    const priceStep = priceRange / (horizontalLines + 1);

    for (let i = 0; i <= horizontalLines + 1; i++) {
      const price = minPrice + i * priceStep;
      const y = manager.priceToY(price);

      if (y >= 0 && y <= chartHeight) {
        const effectivePaddingRight = paddingRight ?? CHART_CONFIG.CANVAS_PADDING_RIGHT;
        drawText(
          ctx,
          formatPrice(price),
          width - effectivePaddingRight + 10,
          y - 6,
          labelColor,
          CHART_CONFIG.AXIS_LABEL_FONT,
          'left',
          'top',
        );

        drawLine(
          ctx,
          width - effectivePaddingRight,
          y,
          width - effectivePaddingRight + 5,
          y,
          labelColor,
          1,
        );
      }
    }

    if (candles.length > 0) {
      const visibleIndices = Math.floor(viewport.end - viewport.start);
      const step = Math.max(1, Math.floor(visibleIndices / verticalLines));

      for (let i = 0; i < candles.length; i += step) {
        const candle = candles[i];
        if (!candle) continue;

        const index = Math.floor(viewport.start) + i;
        const x = manager.indexToX(index);
        const chartRightBoundary = width - (paddingRight ?? CHART_CONFIG.CANVAS_PADDING_RIGHT);

        if (x >= 0 && x <= chartRightBoundary - (rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN)) {
          const timeLabel = formatTimestamp(candle.timestamp);
          
          drawText(
            ctx,
            timeLabel,
            x,
            chartHeight + 8,
            labelColor,
            CHART_CONFIG.AXIS_LABEL_FONT,
            'center',
            'top',
          );

          drawLine(
            ctx,
            x,
            chartHeight,
            x,
            chartHeight + 5,
            labelColor,
            1,
          );
        }
      }
    }

    const chartRightBoundary = width - (paddingRight ?? CHART_CONFIG.CANVAS_PADDING_RIGHT);

    drawLine(
      ctx,
      chartRightBoundary,
      0,
      chartRightBoundary,
      chartHeight,
      labelColor,
      2,
    );

    drawLine(
      ctx,
      0,
      chartHeight,
      chartRightBoundary,
      chartHeight,
      labelColor,
      2,
    );
  }, [manager, colors, enabled, horizontalLines, verticalLines, gridLineWidth, paddingRight, rightMargin, manager?.getCandles()]);

  useEffect(() => {
    render();
  }, [render]);

  return { render };
};
