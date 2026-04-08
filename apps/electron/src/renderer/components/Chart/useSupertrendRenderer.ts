import type { SupertrendResult } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS, INDICATOR_LINE_WIDTHS } from '@shared/constants';
import { useCallback } from 'react';

interface UseSupertrendRendererProps {
  manager: CanvasManager | null;
  supertrendData: SupertrendResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useSupertrendRenderer = ({
  manager,
  supertrendData,
  colors,
  enabled = true,
}: UseSupertrendRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !supertrendData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();

    if (!ctx || !dimensions) return;

    const { chartWidth, chartHeight } = dimensions;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const priceToY = (price: number): number => manager.priceToY(price);

    const upColor = colors.supertrend?.up ?? INDICATOR_COLORS.SUPERTREND_UP;
    const downColor = colors.supertrend?.down ?? INDICATOR_COLORS.SUPERTREND_DOWN;

    ctx.lineWidth = INDICATOR_LINE_WIDTHS.SUPERTREND;

    let currentTrend: 'up' | 'down' | null = null;
    let segmentStart: number | null = null;

    for (let i = visibleStartIndex; i <= visibleEndIndex; i++) {
      const value = supertrendData.value[i];
      const trend = supertrendData.trend[i];

      if (value === null || value === undefined || trend === null || trend === undefined) {
        if (segmentStart !== null) {
          ctx.stroke();
          segmentStart = null;
          currentTrend = null;
        }
        continue;
      }

      const x = manager.indexToCenterX(i);
      const y = priceToY(value);

      if (currentTrend !== trend) {
        if (segmentStart !== null) {
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.strokeStyle = trend === 'up' ? upColor : downColor;
        ctx.moveTo(x, y);
        currentTrend = trend;
        segmentStart = i;
      } else {
        ctx.lineTo(x, y);
      }
    }

    if (segmentStart !== null) {
      ctx.stroke();
    }

    ctx.restore();
  }, [manager, supertrendData, enabled, colors]);

  return { render };
};
