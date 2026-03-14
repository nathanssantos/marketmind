import type { UltimateOscillatorResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback } from 'react';
import { drawPanelBackground, drawZoneFill, drawZoneLines } from './utils/oscillatorRendering';

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

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const valueToY = (value: number): number => {
      const normalizedValue = value / 100;
      return panelY + panelHeight - normalizedValue * panelHeight;
    };

    const overboughtY = valueToY(70);
    const oversoldY = valueToY(30);
    const midY = valueToY(50);

    drawZoneFill({ ctx, chartWidth, panelY, panelHeight, topY: overboughtY, bottomY: oversoldY });
    drawZoneLines({ ctx, chartWidth, levels: [{ y: overboughtY }, { y: oversoldY }, { y: midY }] });

    ctx.strokeStyle = colors.ultimateOsc?.line ?? '#673ab7';
    ctx.lineWidth = 1;
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
  }, [manager, ultimateOscData, enabled, colors]);

  return { render };
};
