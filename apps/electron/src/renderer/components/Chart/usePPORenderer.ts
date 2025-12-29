import type { PPOResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback } from 'react';
import { drawPanelBackground, drawZoneLines } from './utils/oscillatorRendering';

interface UsePPORendererProps {
  manager: CanvasManager | null;
  ppoData: PPOResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const usePPORenderer = ({
  manager,
  ppoData,
  colors,
  enabled = true,
}: UsePPORendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !ppoData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const panelInfo = manager.getPanelInfo('ppo');

    if (!ctx || !dimensions || !panelInfo) return;

    const { y: panelY, height: panelHeight } = panelInfo;
    const { chartWidth } = dimensions;
    const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;
    const klineWidth = effectiveWidth / (viewport.end - viewport.start);

    ctx.save();
    drawPanelBackground({ ctx, panelY, panelHeight, chartWidth });

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const visiblePPO = ppoData.ppo.slice(visibleStartIndex, visibleEndIndex).filter((v): v is number => v !== null);
    const visibleSignal = ppoData.signal.slice(visibleStartIndex, visibleEndIndex).filter((v): v is number => v !== null);
    const visibleHistogram = ppoData.histogram.slice(visibleStartIndex, visibleEndIndex).filter((v): v is number => v !== null);

    if (visiblePPO.length === 0) {
      ctx.restore();
      return;
    }

    const allValues = [...visiblePPO, ...visibleSignal, ...visibleHistogram];
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
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
    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = ppoData.histogram[i];
      if (value === null || value === undefined) continue;

      const x = indexToX(i);
      const y = valueToY(value);
      const height = Math.abs(y - zeroY);

      ctx.fillStyle = value >= 0
        ? (colors.ppo?.histogramPositive ?? '#26a69a')
        : (colors.ppo?.histogramNegative ?? '#ef5350');

      ctx.fillRect(x - barWidth / 2, value >= 0 ? y : zeroY, barWidth, height);
    }

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

    drawLine(ppoData.ppo, colors.ppo?.ppoLine ?? '#2962ff', 1);
    drawLine(ppoData.signal, colors.ppo?.signalLine ?? '#ff6d00', 1);

    drawZoneLines({ ctx, chartWidth, levels: [{ y: zeroY }] });

    ctx.restore();
  }, [manager, ppoData, enabled, colors]);

  return { render };
};
