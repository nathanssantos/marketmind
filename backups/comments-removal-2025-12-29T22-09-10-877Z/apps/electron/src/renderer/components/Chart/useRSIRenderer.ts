import type { RSIResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback } from 'react';
import { drawPanelBackground, drawZoneFill, drawZoneLines } from './utils/oscillatorRendering';

interface UseRSIRendererProps {
  manager: CanvasManager | null;
  rsiData: RSIResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  overboughtLevel?: number;
  oversoldLevel?: number;
}

export const useRSIRenderer = ({
  manager,
  rsiData,
  colors,
  enabled = true,
  overboughtLevel = 95,
  oversoldLevel = 5,
}: UseRSIRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !rsiData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();

    if (!ctx || !dimensions) return;

    const { chartWidth, chartHeight } = dimensions;
    const panelHeight = CHART_CONFIG.RSI_PANEL_HEIGHT;
    const panelTop = chartHeight;
    const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;

    ctx.save();

    const padding = 4;
    const innerHeight = panelHeight - padding * 2;
    const klineWidth = effectiveWidth / (viewport.end - viewport.start);

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const visibleRSI = rsiData.values.slice(visibleStartIndex, visibleEndIndex);

    const valueToY = (value: number): number => {
      return panelTop + padding + innerHeight - ((value / 100) * innerHeight);
    };

    drawPanelBackground({ ctx, panelY: panelTop, panelHeight, chartWidth });

    const overboughtY = valueToY(overboughtLevel);
    const oversoldY = valueToY(oversoldLevel);
    const midY = valueToY(50);

    drawZoneFill({ ctx, chartWidth, panelY: panelTop, panelHeight, topY: overboughtY, bottomY: oversoldY });
    drawZoneLines({ ctx, chartWidth, levels: [{ y: overboughtY }, { y: oversoldY }, { y: midY }] });

    ctx.strokeStyle = colors.rsi.line;
    ctx.lineWidth = 1;
    ctx.beginPath();

    let isFirstPoint = true;

    for (let i = 0; i < visibleRSI.length; i++) {
      const value = visibleRSI[i];
      if (value === null || value === undefined) continue;

      const globalIndex = visibleStartIndex + i;
      const x = (globalIndex - viewport.start) * klineWidth + klineWidth / 2;
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
  }, [manager, rsiData, enabled, overboughtLevel, oversoldLevel, colors]);

  return { render };
};
