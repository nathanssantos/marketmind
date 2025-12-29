import type { AroonResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback } from 'react';
import { drawPanelBackground, drawZoneFill, drawZoneLines } from './utils/oscillatorRendering';

interface UseAroonRendererProps {
  manager: CanvasManager | null;
  aroonData: AroonResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useAroonRenderer = ({
  manager,
  aroonData,
  colors,
  enabled = true,
}: UseAroonRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !aroonData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const panelInfo = manager.getPanelInfo('aroon');

    if (!ctx || !dimensions || !panelInfo) return;

    const { y: panelY, height: panelHeight } = panelInfo;
    const { chartWidth } = dimensions;
    const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;
    const klineWidth = effectiveWidth / (viewport.end - viewport.start);

    ctx.save();
    drawPanelBackground({ ctx, panelY, panelHeight, chartWidth });

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const valueToY = (value: number): number => {
      const normalizedValue = value / 100;
      return panelY + panelHeight - normalizedValue * panelHeight;
    };

    const indexToX = (index: number): number =>
      (index - viewport.start) * klineWidth + klineWidth / 2;

    const top70Y = valueToY(70);
    const bot30Y = valueToY(30);
    const midY = valueToY(50);

    drawZoneFill({ ctx, chartWidth, panelY, panelHeight, topY: top70Y, bottomY: bot30Y });
    drawZoneLines({ ctx, chartWidth, levels: [{ y: top70Y }, { y: bot30Y }, { y: midY }] });

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

    drawLine(aroonData.aroonUp, colors.aroon?.upLine ?? '#26a69a', 1);
    drawLine(aroonData.aroonDown, colors.aroon?.downLine ?? '#ef5350', 1);

    ctx.restore();
  }, [manager, aroonData, enabled, colors]);

  return { render };
};
