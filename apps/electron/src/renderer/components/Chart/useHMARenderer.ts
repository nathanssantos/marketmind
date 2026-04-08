import type { HMAResult } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS, INDICATOR_LINE_WIDTHS } from '@shared/constants';
import { useCallback } from 'react';

interface UseHMARendererProps {
  manager: CanvasManager | null;
  hmaData: HMAResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useHMARenderer = ({
  manager,
  hmaData,
  colors,
  enabled = true,
}: UseHMARendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !hmaData) return;

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

    ctx.strokeStyle = colors.hma?.line ?? INDICATOR_COLORS.HMA_LINE;
    ctx.lineWidth = INDICATOR_LINE_WIDTHS.OVERLAY;
    ctx.beginPath();

    let isFirstPoint = true;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = hmaData.values[i];
      if (value === null || value === undefined) continue;

      const x = manager.indexToCenterX(i);
      const y = manager.priceToY(value);

      if (y < 0 || y > chartHeight) continue;

      if (isFirstPoint) {
        ctx.moveTo(x, y);
        isFirstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
    ctx.restore();
  }, [manager, hmaData, enabled, colors]);

  return { render };
};
