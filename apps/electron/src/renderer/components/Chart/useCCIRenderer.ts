import type { CCIResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG, INDICATOR_COLORS } from '@shared/constants';
import { useCallback } from 'react';
import { drawPanelBackground, drawZoneFill, drawZoneLines } from './utils/oscillatorRendering';

interface UseCCIRendererProps {
  manager: CanvasManager | null;
  cciData: CCIResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useCCIRenderer = ({
  manager,
  cciData,
  colors,
  enabled = true,
}: UseCCIRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !cciData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const panelInfo = manager.getPanelInfo('cci');

    if (!ctx || !dimensions || !panelInfo) return;

    const { y: panelY, height: panelHeight } = panelInfo;
    const { chartWidth } = dimensions;
    const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;
    const klineWidth = effectiveWidth / (viewport.end - viewport.start);

    ctx.save();
    drawPanelBackground({ ctx, panelY, panelHeight, chartWidth });

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const visibleValues = cciData.slice(visibleStartIndex, visibleEndIndex).filter((v): v is number => v !== null);
    if (visibleValues.length === 0) {
      ctx.restore();
      return;
    }

    const minValue = Math.min(-200, ...visibleValues);
    const maxValue = Math.max(200, ...visibleValues);
    const range = maxValue - minValue;

    const valueToY = (value: number): number => {
      const normalizedValue = (value - minValue) / range;
      return panelY + panelHeight - normalizedValue * panelHeight;
    };

    const indexToX = (index: number): number =>
      (index - viewport.start) * klineWidth + klineWidth / 2;

    const oversoldY = valueToY(-100);
    const overboughtY = valueToY(100);
    const zeroY = valueToY(0);

    drawZoneFill({ ctx, chartWidth, panelY, panelHeight, topY: overboughtY, bottomY: oversoldY });
    drawZoneLines({ ctx, chartWidth, levels: [{ y: overboughtY }, { y: oversoldY }, { y: zeroY }] });

    ctx.strokeStyle = colors.cci?.line ?? INDICATOR_COLORS.CCI_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();

    let isFirstPoint = true;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = cciData[i];
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
    ctx.restore();
  }, [manager, cciData, enabled, colors]);

  return { render };
};
