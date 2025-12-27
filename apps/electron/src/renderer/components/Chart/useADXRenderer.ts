import type { ADXResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback } from 'react';

interface UseADXRendererProps {
  manager: CanvasManager | null;
  adxData: ADXResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useADXRenderer = ({
  manager,
  adxData,
  colors,
  enabled = true,
}: UseADXRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !adxData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const panelInfo = manager.getPanelInfo('adx');

    if (!ctx || !dimensions || !panelInfo) return;

    const { y: panelY, height: panelHeight } = panelInfo;
    const { chartWidth } = dimensions;
    const effectiveWidth = chartWidth - 72;
    const klineWidth = effectiveWidth / (viewport.end - viewport.start);

    ctx.save();

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const valueToY = (value: number): number => {
      const normalizedValue = value / 100;
      return panelY + panelHeight - normalizedValue * panelHeight;
    };

    const indexToX = (index: number): number =>
      (index - viewport.start) * klineWidth + klineWidth / 2;

    ctx.strokeStyle = colors.adx?.threshold ?? 'rgba(128, 128, 128, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const thresholdY = valueToY(25);
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(effectiveWidth, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);

    const drawLine = (values: (number | null)[], color: string, lineWidth: number): void => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      let isFirstPoint = true;

      for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
        const value = values[i];
        if (value === null || value === undefined) continue;

        const x = indexToX(i);
        const y = valueToY(value);

        if (isFirstPoint) {
          ctx.moveTo(x, y);
          isFirstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    };

    drawLine(adxData.plusDI, colors.adx?.plusDI ?? '#26a69a', 1);
    drawLine(adxData.minusDI, colors.adx?.minusDI ?? '#ef5350', 1);
    drawLine(adxData.adx, colors.adx?.adxLine ?? '#7c4dff', 2);

    ctx.restore();
  }, [manager, adxData, enabled, colors]);

  return { render };
};
