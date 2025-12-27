import type { TEMAResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
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

    const { chartWidth, chartHeight } = dimensions;
    const effectiveWidth = chartWidth - 72;
    const klineWidth = effectiveWidth / (viewport.end - viewport.start);

    ctx.save();

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const indexToX = (index: number): number =>
      (index - viewport.start) * klineWidth + klineWidth / 2;

    ctx.strokeStyle = colors.tema?.line ?? '#e91e63';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    let isFirstPoint = true;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = temaData.values[i];
      if (value === null || value === undefined) continue;

      const x = indexToX(i);
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
