import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawGrid, drawLine, drawText } from '@renderer/utils/canvas/drawingUtils';
import { formatPrice, formatTimestamp } from '@renderer/utils/formatters';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback, useEffect } from 'react';

export interface UseGridRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
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

    const labelColor = colors.axisLabel;
    const effectivePaddingRight = paddingRight ?? CHART_CONFIG.CANVAS_PADDING_RIGHT;
    const chartRightBoundary = width - effectivePaddingRight;

    ctx.save();
    ctx.fillStyle = colors.background;
    ctx.fillRect(chartRightBoundary, 0, effectivePaddingRight, chartHeight);
    ctx.fillRect(0, chartHeight, chartRightBoundary, effectivePaddingRight);
    ctx.restore();

    const priceRange = maxPrice - minPrice;
    const priceStep = priceRange / (horizontalLines + 1);

    for (let i = 0; i <= horizontalLines + 1; i++) {
      const price = minPrice + i * priceStep;
      const y = manager.priceToY(price);

      if (y >= 0 && y <= chartHeight) {
        drawText(
          ctx,
          formatPrice(price),
          chartRightBoundary + 10,
          y - 6,
          labelColor,
          CHART_CONFIG.AXIS_LABEL_FONT,
          'left',
          'top',
        );

        drawLine(
          ctx,
          chartRightBoundary,
          y,
          chartRightBoundary + 5,
          y,
          colors.axisLine,
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
            colors.axisLine,
            1,
          );
        }
      }
    }

    drawLine(
      ctx,
      chartRightBoundary,
      0,
      chartRightBoundary,
      chartHeight,
      colors.axisLine,
      2,
    );

    drawLine(
      ctx,
      0,
      chartHeight,
      chartRightBoundary,
      chartHeight,
      colors.axisLine,
      2,
    );
  }, [manager, colors, enabled, horizontalLines, verticalLines, gridLineWidth, paddingRight, rightMargin, manager?.getCandles()]);

  useEffect(() => {
    render();
  }, [render]);

  return { render };
};
