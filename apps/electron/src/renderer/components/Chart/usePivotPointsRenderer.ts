import type { PivotAnalysis } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback } from 'react';

interface UsePivotPointsRendererProps {
  manager: CanvasManager | null;
  pivotData: PivotAnalysis | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const usePivotPointsRenderer = ({
  manager,
  pivotData,
  colors,
  enabled = true,
}: UsePivotPointsRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !pivotData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();

    if (!ctx || !dimensions) return;

    const { chartWidth, chartHeight } = dimensions;
    const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;

    ctx.save();

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    for (const pivot of pivotData.pivots) {
      if (pivot.index < visibleStartIndex || pivot.index > visibleEndIndex) continue;

      const x = manager.indexToX(pivot.index);
      const y = manager.priceToY(pivot.price);

      if (y < 0 || y > chartHeight) continue;

      const isHigh = pivot.type === 'high';
      const strengthColor = pivot.strength === 'strong' ? 1 : pivot.strength === 'medium' ? 0.7 : 0.4;

      ctx.beginPath();
      ctx.arc(x + 3, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = isHigh
        ? (colors.pivotPoints?.resistance ?? `rgba(239, 68, 68, ${strengthColor})`)
        : (colors.pivotPoints?.support ?? `rgba(34, 197, 94, ${strengthColor})`);
      ctx.fill();

      ctx.strokeStyle = isHigh
        ? (colors.pivotPoints?.resistance ?? 'rgba(239, 68, 68, 0.5)')
        : (colors.pivotPoints?.support ?? 'rgba(34, 197, 94, 0.5)');
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x + 3, y);
      ctx.lineTo(effectiveWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [manager, pivotData, enabled, colors]);

  return { render };
};
