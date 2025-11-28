import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback } from 'react';
import type { StochasticResult } from '../../utils/stochastic';

interface UseStochasticRendererProps {
  manager: CanvasManager | null;
  stochasticData: StochasticResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  overboughtLevel?: number;
  oversoldLevel?: number;
}

export const useStochasticRenderer = ({
  manager,
  stochasticData,
  colors,
  enabled = true,
  overboughtLevel = 80,
  oversoldLevel = 20,
}: UseStochasticRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !stochasticData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();

    if (!ctx || !dimensions) return;

    const { chartWidth, height } = dimensions;
    const panelHeight = CHART_CONFIG.STOCHASTIC_PANEL_HEIGHT;
    const panelTop = height - panelHeight;
    const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;

    ctx.save();

    const padding = 4;
    const innerHeight = panelHeight - padding * 2;
    const candleWidth = effectiveWidth / (viewport.end - viewport.start);

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const visibleK = stochasticData.k.slice(visibleStartIndex, visibleEndIndex);
    const visibleD = stochasticData.d.slice(visibleStartIndex, visibleEndIndex);

    const valueToY = (value: number): number => {
      return panelTop + padding + innerHeight - ((value / 100) * innerHeight);
    };

    ctx.fillStyle = 'rgba(128, 128, 128, 0.05)';
    ctx.fillRect(0, panelTop, effectiveWidth, panelHeight);

    ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, panelTop);
    ctx.lineTo(effectiveWidth, panelTop);
    ctx.stroke();

    ctx.strokeStyle = colors.stochastic.zone;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);

    const overboughtY = valueToY(overboughtLevel);
    ctx.beginPath();
    ctx.moveTo(0, overboughtY);
    ctx.lineTo(effectiveWidth, overboughtY);
    ctx.stroke();

    const oversoldY = valueToY(oversoldLevel);
    ctx.beginPath();
    ctx.moveTo(0, oversoldY);
    ctx.lineTo(effectiveWidth, oversoldY);
    ctx.stroke();

    const midY = valueToY(50);
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(effectiveWidth, midY);
    ctx.stroke();

    ctx.setLineDash([]);

    const drawLine = (values: (number | null)[], color: string, lineWidth: number): void => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      let isFirstPoint = true;

      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (value === null || value === undefined) continue;

        const globalIndex = visibleStartIndex + i;
        const x = (globalIndex - viewport.start) * candleWidth + candleWidth / 2;
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

    drawLine(visibleK, colors.stochastic.k, 2.5);
    drawLine(visibleD, colors.stochastic.d, 1.5);

    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(128, 128, 128, 0.6)';
    ctx.textAlign = 'left';
    ctx.fillText('0', 4, panelTop + panelHeight - 4);
    ctx.fillText('50', 4, midY + 3);
    ctx.fillText('100', 4, panelTop + padding + 10);

    ctx.restore();
  }, [manager, stochasticData, enabled, overboughtLevel, oversoldLevel, colors]);

  return { render };
};
