import type { FVGResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback } from 'react';

interface UseFVGRendererProps {
  manager: CanvasManager | null;
  fvgData: FVGResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useFVGRenderer = ({
  manager,
  fvgData,
  colors,
  enabled = true,
}: UseFVGRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !fvgData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();

    if (!ctx || !dimensions) return;

    const { chartWidth, chartHeight } = dimensions;
    const effectiveWidth = chartWidth - 72;

    ctx.save();

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    for (const gap of fvgData.gaps) {
      if (gap.filled) continue;
      if (gap.index < visibleStartIndex || gap.index > visibleEndIndex + 50) continue;

      const startX = manager.indexToX(gap.index);
      const topY = manager.priceToY(gap.high);
      const bottomY = manager.priceToY(gap.low);
      const height = Math.abs(bottomY - topY);

      if (topY > chartHeight || bottomY < 0) continue;

      const isBullish = gap.type === 'bullish';
      ctx.fillStyle = isBullish
        ? (colors.fvg?.bullish ?? 'rgba(34, 197, 94, 0.15)')
        : (colors.fvg?.bearish ?? 'rgba(239, 68, 68, 0.15)');

      ctx.fillRect(startX, Math.min(topY, bottomY), effectiveWidth - startX, height);

      ctx.strokeStyle = isBullish
        ? (colors.fvg?.bullishBorder ?? 'rgba(34, 197, 94, 0.4)')
        : (colors.fvg?.bearishBorder ?? 'rgba(239, 68, 68, 0.4)');
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(startX, topY);
      ctx.lineTo(effectiveWidth, topY);
      ctx.moveTo(startX, bottomY);
      ctx.lineTo(effectiveWidth, bottomY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [manager, fvgData, enabled, colors]);

  return { render };
};
