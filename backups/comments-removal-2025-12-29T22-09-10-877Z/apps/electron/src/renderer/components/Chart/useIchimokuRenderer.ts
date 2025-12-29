import type { IchimokuResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback } from 'react';

interface UseIchimokuRendererProps {
  manager: CanvasManager | null;
  ichimokuData: IchimokuResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useIchimokuRenderer = ({
  manager,
  ichimokuData,
  colors,
  enabled = true,
}: UseIchimokuRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !ichimokuData) return;

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

    const fillCloud = (): void => {
      const senkouAColor = colors.ichimoku?.senkouAFill ?? 'rgba(38, 166, 154, 0.2)';
      const senkouBColor = colors.ichimoku?.senkouBFill ?? 'rgba(239, 83, 80, 0.2)';

      for (let i = visibleStartIndex; i < visibleEndIndex - 1; i++) {
        const senkouA1 = ichimokuData.senkouA[i];
        const senkouB1 = ichimokuData.senkouB[i];
        const senkouA2 = ichimokuData.senkouA[i + 1];
        const senkouB2 = ichimokuData.senkouB[i + 1];

        if (
          senkouA1 === null || senkouA1 === undefined ||
          senkouB1 === null || senkouB1 === undefined ||
          senkouA2 === null || senkouA2 === undefined ||
          senkouB2 === null || senkouB2 === undefined
        ) continue;

        const x1 = indexToX(i);
        const x2 = indexToX(i + 1);
        const ya1 = priceToY(senkouA1);
        const yb1 = priceToY(senkouB1);
        const ya2 = priceToY(senkouA2);
        const yb2 = priceToY(senkouB2);

        ctx.beginPath();
        ctx.moveTo(x1, ya1);
        ctx.lineTo(x2, ya2);
        ctx.lineTo(x2, yb2);
        ctx.lineTo(x1, yb1);
        ctx.closePath();

        ctx.fillStyle = senkouA1 >= senkouB1 ? senkouAColor : senkouBColor;
        ctx.fill();
      }
    };

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

    fillCloud();
    drawLine(ichimokuData.tenkan, colors.ichimoku?.tenkan ?? '#2962ff', 1);
    drawLine(ichimokuData.kijun, colors.ichimoku?.kijun ?? '#b71c1c', 1);
    drawLine(ichimokuData.chikou, colors.ichimoku?.chikou ?? '#7c4dff', 1);

    ctx.restore();
  }, [manager, ichimokuData, enabled, colors]);

  return { render };
};
