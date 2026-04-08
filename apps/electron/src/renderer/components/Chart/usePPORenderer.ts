import type { PPOResult } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS } from '@shared/constants';
import { useCallback } from 'react';
import { applyPanelClip, drawPanelBackground, drawPanelValueTag, drawZoneLines } from './utils/oscillatorRendering';

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
    const widthPerKline = chartWidth / (viewport.end - viewport.start);

    ctx.save();
    drawPanelBackground({ ctx, panelY, panelHeight, chartWidth });
    applyPanelClip({ ctx, panelY, panelHeight, chartWidth });

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.min(Math.ceil(viewport.end), ppoData.ppo.length);

    let minValue = Infinity;
    let maxValue = -Infinity;
    let hasValidValue = false;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const ppoVal = ppoData.ppo[i];
      const signalVal = ppoData.signal[i];
      const histVal = ppoData.histogram[i];

      if (ppoVal !== null && ppoVal !== undefined) {
        hasValidValue = true;
        if (ppoVal < minValue) minValue = ppoVal;
        if (ppoVal > maxValue) maxValue = ppoVal;
      }
      if (signalVal !== null && signalVal !== undefined) {
        if (signalVal < minValue) minValue = signalVal;
        if (signalVal > maxValue) maxValue = signalVal;
      }
      if (histVal !== null && histVal !== undefined) {
        if (histVal < minValue) minValue = histVal;
        if (histVal > maxValue) maxValue = histVal;
      }
    }

    if (!hasValidValue) {
      ctx.restore();
      return;
    }

    const range = maxValue - minValue || 1;
    const padding = range * 0.1;

    const valueToY = (value: number): number => {
      const normalizedValue = (value - (minValue - padding)) / (range + padding * 2);
      return panelY + panelHeight - normalizedValue * panelHeight;
    };

    const zeroY = valueToY(0);

    const barWidth = Math.max(1, widthPerKline * 0.6);
    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = ppoData.histogram[i];
      if (value === null || value === undefined) continue;

      const x = manager.indexToCenterX(i);
      const y = valueToY(value);
      const height = Math.abs(y - zeroY);

      ctx.fillStyle = value >= 0
        ? (colors.ppo?.histogramPositive ?? INDICATOR_COLORS.PPO_HISTOGRAM_POSITIVE)
        : (colors.ppo?.histogramNegative ?? INDICATOR_COLORS.PPO_HISTOGRAM_NEGATIVE);

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
    };

    drawLine(ppoData.ppo, colors.ppo?.ppoLine ?? INDICATOR_COLORS.PPO_LINE, 1);
    drawLine(ppoData.signal, colors.ppo?.signalLine ?? INDICATOR_COLORS.PPO_SIGNAL, 1);

    drawZoneLines({ ctx, chartWidth, levels: [{ y: zeroY }] });

    ctx.restore();

    drawPanelValueTag(ctx, ppoData.signal, visibleStartIndex, visibleEndIndex, valueToY, chartWidth, colors.ppo?.signalLine ?? INDICATOR_COLORS.PPO_SIGNAL);
    drawPanelValueTag(ctx, ppoData.ppo, visibleStartIndex, visibleEndIndex, valueToY, chartWidth, colors.ppo?.ppoLine ?? INDICATOR_COLORS.PPO_LINE);
  }, [manager, ppoData, enabled, colors]);

  return { render };
};
