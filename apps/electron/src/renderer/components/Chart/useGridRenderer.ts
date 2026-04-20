import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawGrid } from '@renderer/utils/canvas/drawingUtils';
import { formatChartPrice } from '@renderer/utils/formatters';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback, useMemo } from 'react';
import { createTimeScaleRenderer } from './renderers/TimeScaleRenderer';

export interface UseGridRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  horizontalLines?: number;
  verticalLines?: number;
  gridLineWidth?: number;
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
}: UseGridRendererProps): UseGridRendererReturn => {
  const timeScaleRenderer = useMemo(
    () =>
      createTimeScaleRenderer({
        labelColor: colors.axisLabel,
        axisLineColor: colors.axisLine,
      }),
    [colors.axisLabel, colors.axisLine],
  );

  const render = useCallback((): void => {
    if (!manager) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const bounds = manager.getBounds();

    if (!ctx || !dimensions || !bounds) return;

    const { width, chartHeight, height, chartWidth } = dimensions;
    const { minPrice, maxPrice } = bounds;

    const totalHeight = chartHeight + manager.getTotalPanelHeight();
    const chartRightBoundary = chartWidth;

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

    ctx.save();
    ctx.fillStyle = colors.background;
    ctx.fillRect(chartRightBoundary, 0, CHART_CONFIG.CANVAS_PADDING_RIGHT, totalHeight);
    ctx.fillRect(0, totalHeight, chartRightBoundary, CHART_CONFIG.CANVAS_PADDING_BOTTOM);
    ctx.restore();

    const priceRange = maxPrice - minPrice;
    const priceStep = priceRange / (horizontalLines + 1);

    interface LabelTick { label: string; y: number }
    const ticks: LabelTick[] = [];
    for (let i = 0; i <= horizontalLines + 1; i++) {
      const price = minPrice + i * priceStep;
      const y = manager.priceToY(price);
      if (y >= 0 && y <= chartHeight) {
        ticks.push({ label: formatChartPrice(price), y });
      }
    }

    if (ticks.length > 0) {
      ctx.save();
      ctx.strokeStyle = colors.axisLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const t of ticks) {
        ctx.moveTo(chartRightBoundary, t.y);
        ctx.lineTo(chartRightBoundary + 5, t.y);
      }
      ctx.stroke();

      ctx.fillStyle = colors.axisLabel;
      ctx.font = CHART_CONFIG.AXIS_LABEL_FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (const t of ticks) {
        ctx.fillText(t.label, chartRightBoundary + 8, t.y + 1);
      }
      ctx.restore();
    }

    timeScaleRenderer(ctx, manager, height, chartWidth);

    ctx.save();
    ctx.strokeStyle = colors.axisLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(chartRightBoundary, 0);
    ctx.lineTo(chartRightBoundary, totalHeight);
    ctx.moveTo(0, totalHeight);
    ctx.lineTo(chartRightBoundary, totalHeight);
    ctx.stroke();
    ctx.restore();
  }, [manager, colors, enabled, horizontalLines, verticalLines, gridLineWidth, timeScaleRenderer]);

  return { render };
};
