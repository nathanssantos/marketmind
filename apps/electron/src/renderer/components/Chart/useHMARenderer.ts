import type { HMAResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS } from '@shared/constants';
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
    const effectiveWidth = chartWidth - 72;
    const klineWidth = effectiveWidth / (viewport.end - viewport.start);

    ctx.save();

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const indexToX = (index: number): number =>
      (index - viewport.start) * klineWidth + klineWidth / 2;

    ctx.strokeStyle = colors.hma?.line ?? INDICATOR_COLORS.HMA_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();

    let isFirstPoint = true;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = hmaData.values[i];
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
  }, [manager, hmaData, enabled, colors]);

  return { render };
};
