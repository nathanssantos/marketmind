import type { MACDResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback } from 'react';
import { drawPanelBackground, drawZoneLines } from './utils/oscillatorRendering';

interface UseMACDRendererProps {
  manager: CanvasManager | null;
  macdData: MACDResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useMACDRenderer = ({
  manager,
  macdData,
  colors,
  enabled = true,
}: UseMACDRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !macdData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const panelInfo = manager.getPanelInfo('macd');

    if (!ctx || !dimensions || !panelInfo) return;

    const { y: panelY, height: panelHeight } = panelInfo;
    const { chartWidth } = dimensions;
    const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;
    const klineWidth = effectiveWidth / (viewport.end - viewport.start);

    ctx.save();
    drawPanelBackground({ ctx, panelY, panelHeight, chartWidth });

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.min(Math.ceil(viewport.end), macdData.macd.length);

    let minValue = Infinity;
    let maxValue = -Infinity;
    let hasValidValue = false;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const macdVal = macdData.macd[i];
      const signalVal = macdData.signal[i];
      const histVal = macdData.histogram[i];

      if (macdVal !== undefined && !isNaN(macdVal)) {
        hasValidValue = true;
        if (macdVal < minValue) minValue = macdVal;
        if (macdVal > maxValue) maxValue = macdVal;
      }
      if (signalVal !== undefined && !isNaN(signalVal)) {
        if (signalVal < minValue) minValue = signalVal;
        if (signalVal > maxValue) maxValue = signalVal;
      }
      if (histVal !== undefined && !isNaN(histVal)) {
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

    const indexToX = (index: number): number =>
      (index - viewport.start) * klineWidth + klineWidth / 2;

    const zeroY = valueToY(0);

    const barWidth = Math.max(1, klineWidth * 0.6);
    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const value = macdData.histogram[i];
      if (value === null || value === undefined) continue;

      const x = indexToX(i);
      const y = valueToY(value);
      const height = Math.abs(y - zeroY);

      ctx.fillStyle = value >= 0
        ? (colors.macd?.histogramPositive ?? '#26a69a')
        : (colors.macd?.histogramNegative ?? '#ef5350');

      ctx.fillRect(x - barWidth / 2, value >= 0 ? y : zeroY, barWidth, height);
    }

    const drawLine = (values: number[], color: string, lineWidth: number): void => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      let isFirstPoint = true;

      for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
        const value = values[i];
        if (value === undefined || isNaN(value)) continue;

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

    drawLine(macdData.macd, colors.macd?.macdLine ?? '#2962ff', 1);
    drawLine(macdData.signal, colors.macd?.signalLine ?? '#ff6d00', 1);

    drawZoneLines({ ctx, chartWidth, levels: [{ y: zeroY }] });

    ctx.restore();
  }, [manager, macdData, enabled, colors]);

  return { render };
};
