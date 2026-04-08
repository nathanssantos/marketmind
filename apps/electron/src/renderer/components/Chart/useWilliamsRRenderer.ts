import type { WilliamsRResult } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS, INDICATOR_LINE_WIDTHS } from '@shared/constants';
import { useCallback } from 'react';
import { drawPanelBackground, drawPanelValueTag, drawZoneFill, drawZoneLines } from './utils/oscillatorRendering';

interface UseWilliamsRRendererProps {
  manager: CanvasManager | null;
  williamsRData: WilliamsRResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useWilliamsRRenderer = ({
  manager,
  williamsRData,
  colors,
  enabled = true,
}: UseWilliamsRRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !williamsRData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const panelInfo = manager.getPanelInfo('williamsR');

    if (!ctx || !dimensions || !panelInfo) return;

    const { y: panelY, height: panelHeight } = panelInfo;
    const { chartWidth } = dimensions;

    ctx.save();
    drawPanelBackground({ ctx, panelY, panelHeight, chartWidth });

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const valueToY = (value: number): number => {
      const normalizedValue = (value + 100) / 100;
      return panelY + panelHeight - normalizedValue * panelHeight;
    };

    const oversoldY = valueToY(-80);
    const overboughtY = valueToY(-20);
    const midY = valueToY(-50);

    drawZoneFill({ ctx, chartWidth, panelY, panelHeight, topY: overboughtY, bottomY: oversoldY });
    drawZoneLines({ ctx, chartWidth, levels: [{ y: overboughtY }, { y: oversoldY }, { y: midY }] });

    ctx.strokeStyle = colors.williamsR?.line ?? INDICATOR_COLORS.WILLIAMS_R_LINE;
    ctx.lineWidth = INDICATOR_LINE_WIDTHS.PANEL;
    ctx.beginPath();

    let isFirstPoint = true;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = williamsRData[i];
      if (value === null || value === undefined) continue;

      const x = manager.indexToCenterX(i);
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

    drawPanelValueTag(ctx, williamsRData as (number | null)[], visibleStartIndex, visibleEndIndex, valueToY, chartWidth, colors.williamsR?.line ?? INDICATOR_COLORS.WILLIAMS_R_LINE);
  }, [manager, williamsRData, enabled, colors]);

  return { render };
};
