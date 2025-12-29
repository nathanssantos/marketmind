import type { DonchianResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback } from 'react';

interface UseDonchianRendererProps {
  manager: CanvasManager | null;
  donchianData: DonchianResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useDonchianRenderer = ({
  manager,
  donchianData,
  colors,
  enabled = true,
}: UseDonchianRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !donchianData) return;

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

    const drawLine = (values: (number | null)[], color: string, lineWidth: number): void => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      let isFirstPoint = true;

      for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
        const value = values[i];
        if (value === null || value === undefined) continue;

        const x = indexToX(i);
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
          points.push({ x: indexToX(i), upper: priceToY(u), lower: priceToY(l) });
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

    fillBetween(donchianData.upper, donchianData.lower, colors.donchian?.fill ?? 'rgba(0, 150, 136, 0.1)');
    drawLine(donchianData.upper, colors.donchian?.upper ?? '#009688', 1);
    drawLine(donchianData.middle, colors.donchian?.middle ?? '#009688', 1.5);
    drawLine(donchianData.lower, colors.donchian?.lower ?? '#009688', 1);

    ctx.restore();
  }, [manager, donchianData, enabled, colors]);

  return { render };
};
