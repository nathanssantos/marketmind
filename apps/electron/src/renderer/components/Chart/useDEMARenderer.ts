import type { DEMAResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS } from '@shared/constants';
import { useCallback } from 'react';

interface UseDEMARendererProps {
  manager: CanvasManager | null;
  demaData: DEMAResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useDEMARenderer = ({
  manager,
  demaData,
  colors,
  enabled = true,
}: UseDEMARendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !demaData) return;

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

    ctx.strokeStyle = colors.dema?.line ?? INDICATOR_COLORS.DEMA_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();

    let isFirstPoint = true;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = demaData.values[i];
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
  }, [manager, demaData, enabled, colors]);

  return { render };
};
