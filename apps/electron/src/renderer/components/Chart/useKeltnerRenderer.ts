import type { KeltnerResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS, INDICATOR_LINE_WIDTHS } from '@shared/constants';
import { useCallback } from 'react';

interface UseKeltnerRendererProps {
  manager: CanvasManager | null;
  keltnerData: KeltnerResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useKeltnerRenderer = ({
  manager,
  keltnerData,
  colors,
  enabled = true,
}: UseKeltnerRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !keltnerData) return;

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

    const drawLine = (values: (number | null)[], color: string, lineWidth: number): void => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      let isFirstPoint = true;

      for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
        const value = values[i];
        if (value === null || value === undefined) continue;

        const x = manager.indexToCenterX(i);
        const y = priceToY(value);

        if (isFirstPoint) {
          ctx.moveTo(x, y);
          isFirstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    };

    const fillBetween = (
      upper: (number | null)[],
      lower: (number | null)[],
      fillColor: string
    ): void => {
      ctx.fillStyle = fillColor;
      ctx.beginPath();

      const points: { x: number; upper: number; lower: number }[] = [];

      for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
        const u = upper[i];
        const l = lower[i];
        if (u !== null && u !== undefined && l !== null && l !== undefined) {
          points.push({ x: manager.indexToCenterX(i), upper: priceToY(u), lower: priceToY(l) });
        }
      }

      if (points.length < 2) return;

      const firstPoint = points[0]!;
      ctx.moveTo(firstPoint.x, firstPoint.upper);
      for (let i = 1; i < points.length; i++) {
        const pt = points[i]!;
        ctx.lineTo(pt.x, pt.upper);
      }
      for (let i = points.length - 1; i >= 0; i--) {
        const pt = points[i]!;
        ctx.lineTo(pt.x, pt.lower);
      }
      ctx.closePath();
      ctx.fill();
    };

    fillBetween(keltnerData.upper, keltnerData.lower, colors.keltner?.fill ?? INDICATOR_COLORS.KELTNER_FILL);
    drawLine(keltnerData.upper, colors.keltner?.upper ?? INDICATOR_COLORS.KELTNER_LINE, INDICATOR_LINE_WIDTHS.OVERLAY);
    drawLine(keltnerData.middle, colors.keltner?.middle ?? INDICATOR_COLORS.KELTNER_LINE, INDICATOR_LINE_WIDTHS.OVERLAY_MIDDLE);
    drawLine(keltnerData.lower, colors.keltner?.lower ?? INDICATOR_COLORS.KELTNER_LINE, INDICATOR_LINE_WIDTHS.OVERLAY);

    ctx.restore();
  }, [manager, keltnerData, enabled, colors]);

  return { render };
};
