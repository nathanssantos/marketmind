import type { UltimateOscillatorResult } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS, INDICATOR_LINE_WIDTHS } from '@shared/constants';
import { useCallback } from 'react';
import { applyPanelClip, drawPanelBackground, drawPanelValueTag, drawZoneFill, drawZoneLines } from './utils/oscillatorRendering';

interface UseUltimateOscRendererProps {
  manager: CanvasManager | null;
  ultimateOscData: UltimateOscillatorResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useUltimateOscRenderer = ({
  manager,
  ultimateOscData,
  colors,
  enabled = true,
}: UseUltimateOscRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !ultimateOscData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const panelInfo = manager.getPanelInfo('ultimateOsc');

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

    const overboughtY = valueToY(70);
    const oversoldY = valueToY(30);
    const midY = valueToY(50);

    drawZoneFill({ ctx, chartWidth, panelY, panelHeight, topY: overboughtY, bottomY: oversoldY });
    drawZoneLines({ ctx, chartWidth, levels: [{ y: overboughtY }, { y: oversoldY }, { y: midY }] });

    ctx.strokeStyle = colors.ultimateOsc?.line ?? INDICATOR_COLORS.ULTIMATE_OSC_LINE;
    ctx.lineWidth = INDICATOR_LINE_WIDTHS.PANEL;
    ctx.beginPath();

    let isFirstPoint = true;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = ultimateOscData.values[i];
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

    drawPanelValueTag(ctx, ultimateOscData.values, visibleStartIndex, visibleEndIndex, valueToY, chartWidth, colors.ultimateOsc?.line ?? INDICATOR_COLORS.ULTIMATE_OSC_LINE);
  }, [manager, ultimateOscData, enabled, colors]);

  return { render };
};
