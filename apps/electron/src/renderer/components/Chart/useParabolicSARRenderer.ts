import type { ParabolicSARResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS } from '@shared/constants';
import { useCallback } from 'react';

interface UseParabolicSARRendererProps {
  manager: CanvasManager | null;
  parabolicSarData: ParabolicSARResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useParabolicSARRenderer = ({
  manager,
  parabolicSarData,
  colors,
  enabled = true,
}: UseParabolicSARRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !parabolicSarData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();

    if (!ctx || !dimensions) return;

    const { chartWidth } = dimensions;
    const effectiveWidth = chartWidth - 72;
    const klineWidth = effectiveWidth / (viewport.end - viewport.start);

    ctx.save();

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const priceToY = (price: number): number => manager.priceToY(price);

    const indexToX = (index: number): number =>
      (index - viewport.start) * klineWidth + klineWidth / 2;

    const dotRadius = Math.max(2, Math.min(4, klineWidth * 0.15));

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const sarValue = parabolicSarData.sar[i];
      const trend = parabolicSarData.trend[i];

      if (sarValue === null || sarValue === undefined || trend === null) continue;

      const x = indexToX(i);
      const y = priceToY(sarValue);

      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);

      const color =
        trend === 'up'
          ? colors.parabolicSar?.bullish ?? INDICATOR_COLORS.PARABOLIC_SAR_BULLISH
          : colors.parabolicSar?.bearish ?? INDICATOR_COLORS.PARABOLIC_SAR_BEARISH;

      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.restore();
  }, [manager, parabolicSarData, enabled, colors]);

  return { render };
};
