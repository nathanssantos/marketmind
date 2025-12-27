import type { UltimateOscillatorResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback } from 'react';

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

    const zoneColor = colors.ultimateOsc?.zone ?? 'rgba(103, 58, 183, 0.1)';
    ctx.fillStyle = zoneColor;
    const overboughtY = valueToY(70);
    const oversoldY = valueToY(30);
    ctx.fillRect(0, overboughtY, effectiveWidth, panelY - overboughtY + panelHeight);
    ctx.fillRect(0, panelY, effectiveWidth, oversoldY - panelY);

    ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, overboughtY);
    ctx.lineTo(effectiveWidth, overboughtY);
    ctx.moveTo(0, oversoldY);
    ctx.lineTo(effectiveWidth, oversoldY);
    ctx.moveTo(0, valueToY(50));
    ctx.lineTo(effectiveWidth, valueToY(50));
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = colors.ultimateOsc?.line ?? '#673ab7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    let isFirstPoint = true;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = ultimateOscData.values[i];
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
  }, [manager, ultimateOscData, enabled, colors]);

  return { render };
};
