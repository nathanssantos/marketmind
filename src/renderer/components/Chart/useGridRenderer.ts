import type { ChartColors } from '@shared/types';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback, useEffect } from 'react';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawGrid, drawLine, drawText } from '@renderer/utils/canvas/drawingUtils';
import { formatPrice, formatTimestamp } from '@renderer/utils/formatters';

export interface UseGridRendererProps {
  manager: CanvasManager | null;
  colors: ChartColors;
  enabled?: boolean;
  horizontalLines?: number;
  verticalLines?: number;
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
      CHART_CONFIG.GRID_LINE_WIDTH,
    );

    const labelColor = CHART_CONFIG.AXIS_LABEL_COLOR_DARK;

    const priceRange = maxPrice - minPrice;
    const priceStep = priceRange / (horizontalLines + 1);

    for (let i = 0; i <= horizontalLines + 1; i++) {
      const price = minPrice + i * priceStep;
      const y = manager.priceToY(price);

      if (y >= 0 && y <= chartHeight) {
        drawText(
          ctx,
          formatPrice(price),
          width - CHART_CONFIG.CANVAS_PADDING_RIGHT + 10,
          y - 6,
          labelColor,
          CHART_CONFIG.AXIS_LABEL_FONT,
          'left',
          'top',
        );

        drawLine(
          ctx,
          width - CHART_CONFIG.CANVAS_PADDING_RIGHT,
          y,
          width - CHART_CONFIG.CANVAS_PADDING_RIGHT + 5,
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

        if (x >= 0 && x <= width - CHART_CONFIG.CANVAS_PADDING_RIGHT) {
          const timeLabel = formatTimestamp(candle.timestamp);
          
          drawText(
            ctx,
            timeLabel,
            x,
            chartHeight + 10,
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

    drawLine(
      ctx,
      width - CHART_CONFIG.CANVAS_PADDING_RIGHT,
      0,
      width - CHART_CONFIG.CANVAS_PADDING_RIGHT,
      chartHeight,
      labelColor,
      2,
    );

    drawLine(
      ctx,
      0,
      chartHeight,
      width - CHART_CONFIG.CANVAS_PADDING_RIGHT,
      chartHeight,
      labelColor,
      2,
    );
  }, [manager, colors, enabled, horizontalLines, verticalLines]);

  useEffect(() => {
    render();
  }, [render]);

  return { render };
};
