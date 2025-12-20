import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawGrid, drawLine, drawText } from '@renderer/utils/canvas/drawingUtils';
import { formatPrice, formatTimestamp } from '@renderer/utils/formatters';
import { CHART_CONFIG } from '@shared/constants';

import { useCallback } from 'react';

export interface UseGridRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  horizontalLines?: number;
  verticalLines?: number;
  gridLineWidth?: number;
  paddingRight?: number;
  rightMargin?: number;
  timeframe?: string;
}

export interface UseGridRendererReturn {
  render: () => void;
}

export const useGridRenderer = ({
  manager,
  colors,
  enabled = true,
  horizontalLines = 10,
  verticalLines = 10,
  gridLineWidth,
  paddingRight,
  rightMargin,
  timeframe,
}: UseGridRendererProps): UseGridRendererReturn => {
  const render = useCallback((): void => {
    if (!manager) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const bounds = manager.getBounds();
    const viewport = manager.getViewport();

    if (!ctx || !dimensions || !bounds) return;

    const { width, chartHeight, height } = dimensions;
    const { minPrice, maxPrice } = bounds;
    const klines = manager.getVisibleKlines();

    const stochasticHeight = manager.getStochasticPanelHeight();
    const rsiHeight = manager.getRSIPanelHeight();
    const totalHeight = chartHeight + stochasticHeight + rsiHeight;

    if (enabled) {
      drawGrid(
        ctx,
        width,
        totalHeight,
        horizontalLines,
        verticalLines,
        colors.grid,
        gridLineWidth ?? CHART_CONFIG.GRID_LINE_WIDTH,
      );
    }

    const labelColor = colors.axisLabel;
    const effectivePaddingRight = paddingRight ?? CHART_CONFIG.CANVAS_PADDING_RIGHT;
    const chartRightBoundary = width - effectivePaddingRight;

    ctx.save();
    ctx.fillStyle = colors.background;
    ctx.fillRect(chartRightBoundary, 0, effectivePaddingRight, totalHeight);
    ctx.fillRect(0, totalHeight, chartRightBoundary, CHART_CONFIG.CANVAS_PADDING_BOTTOM);
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
          y + 1,
          labelColor,
          CHART_CONFIG.AXIS_LABEL_FONT,
          'left',
          'middle',
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

    if (klines.length > 0) {
      const visibleIndices = Math.floor(viewport.end - viewport.start);
      const step = Math.max(1, Math.floor(visibleIndices / verticalLines));
      const timeAxisY = height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;

      let previousTimestamp: number | undefined;
      
      for (let i = 0; i < klines.length; i += step) {
        const kline = klines[i];
        if (!kline) continue;

        const index = Math.floor(viewport.start) + i;
        const x = manager.indexToX(index);

        if (x >= 0 && x <= chartRightBoundary - (rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN)) {
          const timeLabel = formatTimestamp(kline.openTime, timeframe, previousTimestamp);
          previousTimestamp = kline.openTime;
          
          drawText(
            ctx,
            timeLabel,
            x,
            timeAxisY + 10,
            labelColor,
            CHART_CONFIG.AXIS_LABEL_FONT,
            'center',
            'top',
          );

          drawLine(
            ctx,
            x,
            timeAxisY,
            x,
            timeAxisY + 5,
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
      totalHeight,
      colors.axisLine,
      2,
    );

    drawLine(
      ctx,
      0,
      totalHeight,
      chartRightBoundary,
      totalHeight,
      colors.axisLine,
      2,
    );
  }, [manager, colors, enabled, horizontalLines, verticalLines, gridLineWidth, paddingRight, rightMargin, timeframe]);

  return { render };
};
