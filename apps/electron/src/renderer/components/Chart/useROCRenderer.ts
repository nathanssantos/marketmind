import type { ROCResult } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS, INDICATOR_LINE_WIDTHS } from '@shared/constants';
import { useCallback } from 'react';
import { applyPanelClip, drawPanelBackground, drawPanelValueTag, drawZoneLines } from './utils/oscillatorRendering';

interface UseROCRendererProps {
  manager: CanvasManager | null;
  rocData: ROCResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useROCRenderer = ({
  manager,
  rocData,
  colors,
  enabled = true,
}: UseROCRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !rocData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const panelInfo = manager.getPanelInfo('roc');

    if (!ctx || !dimensions || !panelInfo) return;

    const { y: panelY, height: panelHeight } = panelInfo;
    const { chartWidth } = dimensions;

    ctx.save();
    drawPanelBackground({ ctx, panelY, panelHeight, chartWidth });
    applyPanelClip({ ctx, panelY, panelHeight, chartWidth });

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const visibleValues = rocData.values.slice(visibleStartIndex, visibleEndIndex).filter((v): v is number => v !== null);
    if (visibleValues.length === 0) {
      ctx.restore();
      return;
    }

    const minValue = Math.min(0, ...visibleValues);
    const maxValue = Math.max(0, ...visibleValues);
    const range = maxValue - minValue || 1;
    const padding = range * 0.1;

    const flipped = manager.isFlipped();
    const valueToY = (value: number): number => {
      const normalizedValue = (value - (minValue - padding)) / (range + padding * 2);
      return flipped
        ? panelY + normalizedValue * panelHeight
        : panelY + panelHeight - normalizedValue * panelHeight;
    };

    const zeroY = valueToY(0);
    drawZoneLines({ ctx, chartWidth, levels: [{ y: zeroY }] });

    ctx.strokeStyle = colors.roc?.line ?? INDICATOR_COLORS.ROC_LINE;
    ctx.lineWidth = INDICATOR_LINE_WIDTHS.PANEL;
    ctx.beginPath();

    let isFirstPoint = true;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = rocData.values[i];
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

    drawPanelValueTag(ctx, rocData.values, visibleStartIndex, visibleEndIndex, valueToY, chartWidth, colors.roc?.line ?? INDICATOR_COLORS.ROC_LINE);
  }, [manager, rocData, enabled, colors]);

  return { render };
};
