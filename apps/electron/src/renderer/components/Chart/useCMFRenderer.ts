import type { CMFResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG, INDICATOR_PANEL_HEIGHTS } from '@shared/constants';
import { useCallback } from 'react';

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
    const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;
    const klineWidth = effectiveWidth / (viewport.end - viewport.start);
    const padding = 4;
    const innerHeight = PANEL_HEIGHT - padding * 2;

    ctx.save();

    ctx.fillStyle = 'rgba(128, 128, 128, 0.02)';
    ctx.fillRect(0, panelTop, chartWidth, PANEL_HEIGHT);

    const minValue = -1;
    const maxValue = 1;
    const range = maxValue - minValue;

    const valueToY = (value: number): number => {
      const clamped = Math.max(minValue, Math.min(maxValue, value));
      const normalized = (clamped - minValue) / range;
      return panelTop + padding + innerHeight - normalized * innerHeight;
    };

    const zeroY = valueToY(0);
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(chartWidth, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);
    const barWidth = klineWidth * 0.6;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = cmfData.values[i];
      if (value === null || value === undefined) continue;

      const x = (i - viewport.start) * klineWidth + (klineWidth - barWidth) / 2;
      const y = valueToY(value);

      ctx.fillStyle = value >= 0 ? (colors.cmf?.positive ?? '#4caf50') : (colors.cmf?.negative ?? '#f44336');

      const barHeight = Math.abs(y - zeroY);
      const barY = value >= 0 ? y : zeroY;

      ctx.fillRect(x, barY, barWidth, barHeight);
    }

    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(128, 128, 128, 0.6)';
    ctx.textAlign = 'left';

    const labels = [
      { value: 0.5, y: valueToY(0.5) },
      { value: 0, y: zeroY },
      { value: -0.5, y: valueToY(-0.5) },
    ];

    for (const label of labels) {
      ctx.fillText(label.value.toFixed(1), 4, label.y + 3);
    }

    ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
    ctx.textAlign = 'right';
    ctx.fillText('CMF', chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN - 4, panelTop + padding + 10);

    ctx.restore();
  }, [manager, cmfData, enabled, colors]);

  return { render, panelId: PANEL_ID, panelHeight: PANEL_HEIGHT };
};
