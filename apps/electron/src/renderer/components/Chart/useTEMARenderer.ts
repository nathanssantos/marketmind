import type { TEMAResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS } from '@shared/constants';
import { useCallback } from 'react';

interface UseTEMARendererProps {
  manager: CanvasManager | null;
  temaData: TEMAResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useTEMARenderer = ({
  manager,
  temaData,
  colors,
  enabled = true,
}: UseTEMARendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !temaData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();

    if (!ctx || !dimensions) return;

    const { chartHeight } = dimensions;

    ctx.save();

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    ctx.strokeStyle = colors.tema?.line ?? INDICATOR_COLORS.TEMA_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();

    let isFirstPoint = true;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = temaData.values[i];
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
  }, [manager, temaData, enabled, colors]);

  return { render };
};
