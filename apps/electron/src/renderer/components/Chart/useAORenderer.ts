import type { AOResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback } from 'react';

interface UseAORendererProps {
  manager: CanvasManager | null;
  aoData: AOResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useAORenderer = ({
  manager,
  aoData,
  colors,
  enabled = true,
}: UseAORendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !aoData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const panelInfo = manager.getPanelInfo('ao');

    if (!ctx || !dimensions || !panelInfo) return;

    const { y: panelY, height: panelHeight } = panelInfo;
    const { chartWidth } = dimensions;
    const effectiveWidth = chartWidth - 72;
    const klineWidth = effectiveWidth / (viewport.end - viewport.start);

    ctx.save();

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const visibleValues = aoData.values.slice(visibleStartIndex, visibleEndIndex).filter((v): v is number => v !== null);
    if (visibleValues.length === 0) {
      ctx.restore();
      return;
    }

    const minValue = Math.min(0, ...visibleValues);
    const maxValue = Math.max(0, ...visibleValues);
    const range = maxValue - minValue || 1;
    const padding = range * 0.1;

    const valueToY = (value: number): number => {
      const normalizedValue = (value - (minValue - padding)) / (range + padding * 2);
      return panelY + panelHeight - normalizedValue * panelHeight;
    };

    const indexToX = (index: number): number =>
      (index - viewport.start) * klineWidth + klineWidth / 2;

    const zeroY = valueToY(0);

    const barWidth = Math.max(1, klineWidth * 0.6);
    let prevValue: number | null = null;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = aoData.values[i];
      if (value === null || value === undefined) {
        prevValue = null;
        continue;
      }

      const x = indexToX(i);
      const y = valueToY(value);
      const height = Math.abs(y - zeroY);

      const isGrowing = prevValue !== null ? value > prevValue : value >= 0;
      ctx.fillStyle = isGrowing
        ? (colors.ao?.positive ?? '#26a69a')
        : (colors.ao?.negative ?? '#ef5350');

      ctx.fillRect(x - barWidth / 2, value >= 0 ? y : zeroY, barWidth, height);
      prevValue = value;
    }

    ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(effectiveWidth, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }, [manager, aoData, enabled, colors]);

  return { render };
};
