import type { StochRSIResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG, INDICATOR_PANEL_HEIGHTS } from '@shared/constants';
import { useCallback } from 'react';

interface UseStochRSIRendererProps {
  manager: CanvasManager | null;
  stochRsiData: StochRSIResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

const PANEL_ID = 'stochRsi';
const PANEL_HEIGHT = INDICATOR_PANEL_HEIGHTS.STANDARD;

export const useStochRSIRenderer = ({
  manager,
  stochRsiData,
  colors,
  enabled = true,
}: UseStochRSIRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !stochRsiData) return;

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

    const minValue = 0;
    const maxValue = 100;
    const range = maxValue - minValue;

    const valueToY = (value: number): number => {
      const normalized = (value - minValue) / range;
      return panelTop + padding + innerHeight - normalized * innerHeight;
    };

    const indexToX = (index: number): number =>
      (index - viewport.start) * klineWidth + klineWidth / 2;

    const overboughtY = valueToY(80);
    const oversoldY = valueToY(20);
    const midY = valueToY(50);

    ctx.fillStyle = 'rgba(128, 128, 128, 0.08)';
    ctx.fillRect(0, overboughtY, chartWidth, oversoldY - overboughtY);

    ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);

    ctx.beginPath();
    ctx.moveTo(0, overboughtY);
    ctx.lineTo(chartWidth, overboughtY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, oversoldY);
    ctx.lineTo(chartWidth, oversoldY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(chartWidth, midY);
    ctx.stroke();

    ctx.setLineDash([]);

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const drawLine = (values: (number | null)[], color: string, lineWidth: number): void => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      let isFirstPoint = true;

      for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
        const value = values[i];
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
    };

    drawLine(stochRsiData.k, colors.stochRsi?.k ?? '#2196f3', 1);
    drawLine(stochRsiData.d, colors.stochRsi?.d ?? '#ff9800', 1);

    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(128, 128, 128, 0.6)';
    ctx.textAlign = 'left';

    const labels = [
      { value: 80, y: overboughtY },
      { value: 50, y: valueToY(50) },
      { value: 20, y: oversoldY },
    ];

    for (const label of labels) {
      ctx.fillText(String(label.value), 4, label.y + 3);
    }

    ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
    ctx.textAlign = 'right';
    ctx.fillText('StochRSI', chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN - 4, panelTop + padding + 10);

    ctx.restore();
  }, [manager, stochRsiData, enabled, colors]);

  return { render, panelId: PANEL_ID, panelHeight: PANEL_HEIGHT };
};
