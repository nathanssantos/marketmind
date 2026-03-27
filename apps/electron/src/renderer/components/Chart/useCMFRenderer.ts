import type { CMFResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS, INDICATOR_PANEL_HEIGHTS } from '@shared/constants';
import { useCallback } from 'react';
import { drawPanelBackground, drawPanelValueTag, drawZoneLines } from './utils/oscillatorRendering';

interface UseCMFRendererProps {
  manager: CanvasManager | null;
  cmfData: CMFResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

const PANEL_ID = 'cmf';
const PANEL_HEIGHT = INDICATOR_PANEL_HEIGHTS.STANDARD;

export const useCMFRenderer = ({
  manager,
  cmfData,
  colors,
  enabled = true,
}: UseCMFRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !cmfData || cmfData.values.length === 0) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();

    if (!ctx || !dimensions) return;

    const { chartWidth } = dimensions;
    const panelTop = manager.getPanelTop(PANEL_ID);
    const widthPerKline = chartWidth / (viewport.end - viewport.start);
    const padding = 4;
    const innerHeight = PANEL_HEIGHT - padding * 2;

    ctx.save();
    drawPanelBackground({ ctx, panelY: panelTop, panelHeight: PANEL_HEIGHT, chartWidth });

    const minValue = -1;
    const maxValue = 1;
    const range = maxValue - minValue;

    const valueToY = (value: number): number => {
      const clamped = Math.max(minValue, Math.min(maxValue, value));
      const normalized = (clamped - minValue) / range;
      return panelTop + padding + innerHeight - normalized * innerHeight;
    };

    const zeroY = valueToY(0);
    drawZoneLines({ ctx, chartWidth, levels: [{ y: zeroY }] });

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);
    const barWidth = widthPerKline * 0.6;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = cmfData.values[i];
      if (value === null || value === undefined) continue;

      const x = manager.indexToCenterX(i) - barWidth / 2;
      const y = valueToY(value);

      ctx.fillStyle = value >= 0 ? (colors.cmf?.positive ?? INDICATOR_COLORS.CMF_POSITIVE) : (colors.cmf?.negative ?? INDICATOR_COLORS.CMF_NEGATIVE);

      const barHeight = Math.abs(y - zeroY);
      const barY = value >= 0 ? y : zeroY;

      ctx.fillRect(x, barY, barWidth, barHeight);
    }

    ctx.restore();

    drawPanelValueTag(ctx, cmfData.values, visibleStartIndex, visibleEndIndex, valueToY, chartWidth, colors.cmf?.positive ?? INDICATOR_COLORS.CMF_POSITIVE);
  }, [manager, cmfData, enabled, colors]);

  return { render, panelId: PANEL_ID, panelHeight: PANEL_HEIGHT };
};
