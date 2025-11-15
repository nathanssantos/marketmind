import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { ChartColors } from '@shared/types';
import { useCallback, useEffect } from 'react';
import { CHART_CONFIG } from '@shared/constants/chartConfig';

export interface UseLineChartRendererProps {
  manager: CanvasManager | null;
  colors: ChartColors;
  enabled?: boolean;
  rightMargin?: number;
}

export interface UseLineChartRendererReturn {
  render: () => void;
}

export const useLineChartRenderer = ({
  manager,
  colors,
  enabled = true,
  rightMargin,
}: UseLineChartRendererProps): UseLineChartRendererReturn => {
  const render = useCallback((): void => {
    if (!manager || !enabled) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();

    if (!ctx || !dimensions) return;

    const visibleCandles = manager.getVisibleCandles();
    const { chartWidth, chartHeight } = dimensions;
    const effectiveWidth = chartWidth - (rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);

    if (visibleCandles.length === 0) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, effectiveWidth, chartHeight);
    ctx.clip();

    ctx.strokeStyle = colors.bullish;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();

    visibleCandles.forEach((candle, index) => {
      const actualIndex = Math.floor(viewport.start) + index;
      const x = manager.indexToX(actualIndex);
      const y = manager.priceToY(candle.close);

      if (x < 0 || x > effectiveWidth) return;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Optional: Fill area below line
    if (visibleCandles.length > 0) {
      const firstIndex = Math.floor(viewport.start);
      const lastIndex = firstIndex + visibleCandles.length - 1;
      const firstX = manager.indexToX(firstIndex);
      const lastX = manager.indexToX(lastIndex);

      ctx.fillStyle = `${colors.bullish}22`;
      ctx.lineTo(lastX, chartHeight);
      ctx.lineTo(firstX, chartHeight);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }, [manager, colors, enabled, rightMargin]);

  useEffect(() => {
    render();
  }, [render]);

  return { render };
};
