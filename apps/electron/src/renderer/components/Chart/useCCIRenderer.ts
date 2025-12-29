import type { CCIResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback } from 'react';

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
    const effectiveWidth = chartWidth - 72;
    const klineWidth = effectiveWidth / (viewport.end - viewport.start);

    ctx.save();

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

    ctx.fillStyle = 'rgba(128, 128, 128, 0.08)';
    ctx.fillRect(0, overboughtY, effectiveWidth, oversoldY - overboughtY);

    ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);

    ctx.beginPath();
    ctx.moveTo(0, overboughtY);
    ctx.lineTo(effectiveWidth, overboughtY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, oversoldY);
    ctx.lineTo(effectiveWidth, oversoldY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(effectiveWidth, zeroY);
    ctx.stroke();

    ctx.setLineDash([]);

    ctx.strokeStyle = colors.cci?.line ?? '#ff9800';
    ctx.lineWidth = 1.5;
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
