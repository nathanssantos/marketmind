import type { AOResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS } from '@shared/constants';
import { useCallback } from 'react';
import { applyPanelClip, drawPanelBackground, drawZoneLines } from './utils/oscillatorRendering';

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
    const widthPerKline = chartWidth / (viewport.end - viewport.start);

    ctx.save();
    drawPanelBackground({ ctx, panelY, panelHeight, chartWidth });
    applyPanelClip({ ctx, panelY, panelHeight, chartWidth });

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

    const zeroY = valueToY(0);

    const barWidth = Math.max(1, widthPerKline * 0.6);
    let prevValue: number | null = null;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = aoData.values[i];
      if (value === null || value === undefined) {
        prevValue = null;
        continue;
      }

      const x = manager.indexToCenterX(i);
      const y = valueToY(value);
      const height = Math.abs(y - zeroY);

      const isGrowing = prevValue !== null ? value > prevValue : value >= 0;
      ctx.fillStyle = isGrowing
        ? (colors.ao?.positive ?? INDICATOR_COLORS.AO_POSITIVE)
        : (colors.ao?.negative ?? INDICATOR_COLORS.AO_NEGATIVE);

      ctx.fillRect(x - barWidth / 2, value >= 0 ? y : zeroY, barWidth, height);
      prevValue = value;
    }

    drawZoneLines({ ctx, chartWidth, levels: [{ y: zeroY }] });

    ctx.restore();
  }, [manager, aoData, enabled, colors]);

  return { render };
};
