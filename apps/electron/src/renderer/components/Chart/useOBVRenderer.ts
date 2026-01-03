import type { OBVResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG, INDICATOR_PANEL_HEIGHTS } from '@shared/constants';
import { useCallback } from 'react';

interface UseOBVRendererProps {
  manager: CanvasManager | null;
  obvData: OBVResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

const PANEL_ID = 'obv';
const PANEL_HEIGHT = INDICATOR_PANEL_HEIGHTS.STANDARD;

export const useOBVRenderer = ({
  manager,
  obvData,
  colors,
  enabled = true,
}: UseOBVRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !obvData || obvData.values.length === 0) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();

    if (!ctx || !dimensions) return;

    const { chartWidth } = dimensions;
    const panelTop = manager.getPanelTop(PANEL_ID);
    const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;
    const klineWidth = effectiveWidth / (viewport.end - viewport.start);
    const padding = 4;
    const innerHeight = PANEL_HEIGHT - padding * 2;

    ctx.save();

    ctx.fillStyle = 'rgba(128, 128, 128, 0.02)';
    ctx.fillRect(0, panelTop, chartWidth, PANEL_HEIGHT);

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.min(Math.ceil(viewport.end), obvData.values.length);

    if (visibleStartIndex >= visibleEndIndex) {
      ctx.restore();
      return;
    }

    let minValue = Infinity;
    let maxValue = -Infinity;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const val = obvData.values[i];
      if (val === undefined) continue;
      if (val < minValue) minValue = val;
      if (val > maxValue) maxValue = val;
    }

    if (minValue === Infinity) {
      ctx.restore();
      return;
    }

    const range = maxValue - minValue || 1;

    const valueToY = (value: number): number => {
      const normalized = (value - minValue) / range;
      return panelTop + padding + innerHeight - normalized * innerHeight;
    };

    const indexToX = (index: number): number =>
      (index - viewport.start) * klineWidth + klineWidth / 2;

    ctx.strokeStyle = colors.obv?.line ?? '#2196f3';
    ctx.lineWidth = 2;
    ctx.beginPath();

    let isFirstPoint = true;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = obvData.values[i];
      if (value === undefined) continue;

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

    if (obvData.sma && obvData.sma.length > 0) {
      ctx.strokeStyle = colors.obv?.sma ?? '#ff9800';
      ctx.lineWidth = 1;
      ctx.beginPath();

      isFirstPoint = true;

      for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
        const value = obvData.sma[i];
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
    }

    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
    ctx.textAlign = 'right';
    ctx.fillText('OBV', chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN - 4, panelTop + padding + 10);

    ctx.restore();
  }, [manager, obvData, enabled, colors]);

  return { render, panelId: PANEL_ID, panelHeight: PANEL_HEIGHT };
};
