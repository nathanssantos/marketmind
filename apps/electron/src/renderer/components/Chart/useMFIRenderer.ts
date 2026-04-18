import type { MFIResult } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS, INDICATOR_LINE_WIDTHS } from '@shared/constants';
import { useCallback } from 'react';
import { applyPanelClip, drawPanelBackground, drawPanelValueTag, drawZoneFill, drawZoneLines } from './utils/oscillatorRendering';

interface UseMFIRendererProps {
  manager: CanvasManager | null;
  mfiData: MFIResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useMFIRenderer = ({
  manager,
  mfiData,
  colors,
  enabled = true,
}: UseMFIRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !mfiData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const panelInfo = manager.getPanelInfo('mfi');

    if (!ctx || !dimensions || !panelInfo) return;

    const { y: panelY, height: panelHeight } = panelInfo;
    const { chartWidth } = dimensions;

    ctx.save();
    drawPanelBackground({ ctx, panelY, panelHeight, chartWidth });
    applyPanelClip({ ctx, panelY, panelHeight, chartWidth });

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const flipped = manager.isFlipped();
    const valueToY = (value: number): number => {
      const normalizedValue = value / 100;
      return flipped
        ? panelY + normalizedValue * panelHeight
        : panelY + panelHeight - normalizedValue * panelHeight;
    };

    const overboughtY = valueToY(80);
    const oversoldY = valueToY(20);
    const midY = valueToY(50);

    drawZoneFill({ ctx, chartWidth, panelY, panelHeight, topY: overboughtY, bottomY: oversoldY });
    drawZoneLines({ ctx, chartWidth, levels: [{ y: overboughtY }, { y: oversoldY }, { y: midY }] });

    ctx.strokeStyle = colors.mfi?.line ?? INDICATOR_COLORS.MFI_LINE;
    ctx.lineWidth = INDICATOR_LINE_WIDTHS.PANEL;
    ctx.beginPath();

    let isFirstPoint = true;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = mfiData[i];
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

    drawPanelValueTag(ctx, mfiData as (number | null)[], visibleStartIndex, visibleEndIndex, valueToY, chartWidth, colors.mfi?.line ?? INDICATOR_COLORS.MFI_LINE);
  }, [manager, mfiData, enabled, colors]);

  return { render };
};
