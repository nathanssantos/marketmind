import type { CMOResult } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS, INDICATOR_LINE_WIDTHS } from '@shared/constants';
import { useCallback } from 'react';
import { applyPanelClip, drawPanelBackground, drawPanelValueTag, drawZoneFill, drawZoneLines } from './utils/oscillatorRendering';

interface UseCMORendererProps {
  manager: CanvasManager | null;
  cmoData: CMOResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useCMORenderer = ({
  manager,
  cmoData,
  colors,
  enabled = true,
}: UseCMORendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !cmoData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const panelInfo = manager.getPanelInfo('cmo');

    if (!ctx || !dimensions || !panelInfo) return;

    const { y: panelY, height: panelHeight } = panelInfo;
    const { chartWidth } = dimensions;

    ctx.save();
    drawPanelBackground({ ctx, panelY, panelHeight, chartWidth });
    applyPanelClip({ ctx, panelY, panelHeight, chartWidth });

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const valueToY = (value: number): number => {
      const normalizedValue = (value + 100) / 200;
      return panelY + panelHeight - normalizedValue * panelHeight;
    };

    const overboughtY = valueToY(50);
    const oversoldY = valueToY(-50);
    const zeroY = valueToY(0);

    drawZoneFill({ ctx, chartWidth, panelY, panelHeight, topY: overboughtY, bottomY: oversoldY });
    drawZoneLines({ ctx, chartWidth, levels: [{ y: overboughtY }, { y: oversoldY }, { y: zeroY }] });

    ctx.strokeStyle = colors.cmo?.line ?? INDICATOR_COLORS.CMO_LINE;
    ctx.lineWidth = INDICATOR_LINE_WIDTHS.PANEL;
    ctx.beginPath();

    let isFirstPoint = true;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = cmoData.values[i];
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

    drawPanelValueTag(ctx, cmoData.values, visibleStartIndex, visibleEndIndex, valueToY, chartWidth, colors.cmo?.line ?? INDICATOR_COLORS.CMO_LINE);
  }, [manager, cmoData, enabled, colors]);

  return { render };
};
