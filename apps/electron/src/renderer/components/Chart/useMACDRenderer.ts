import type { MACDResult } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS, OSCILLATOR_CONFIG } from '@shared/constants';
import { useCallback } from 'react';
import { getOscillatorSetup } from './hooks/useOscillatorSetup';
import {
  createDynamicValueToY,
  drawHistogramBars,
  drawLineOnPanel,
  drawPanelBackground,
  drawPanelValueTag,
  drawZoneLines,
} from './utils/oscillatorRendering';

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
    const setup = getOscillatorSetup(manager, enabled && !!macdData, 'macd');
    if (!setup) return;

    const { ctx, chartWidth, panelTop, panelHeight, visibleStart, visibleEnd, klineWidth, indexToX } = setup;

    ctx.save();
    drawPanelBackground({ ctx, panelY: panelTop, panelHeight, chartWidth });

    const visibleEndClamped = Math.min(visibleEnd, macdData!.macd.length);

    let minValue = Infinity;
    let maxValue = -Infinity;
    let hasValidValue = false;

    for (let i = visibleStart; i < visibleEndClamped; i++) {
      const macdVal = macdData!.macd[i];
      const signalVal = macdData!.signal[i];
      const histVal = macdData!.histogram[i];

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
    const valueToY = createDynamicValueToY(panelTop, panelHeight, 0, minValue - padding, maxValue + padding);
    const zeroY = valueToY(0);
    const barWidth = Math.max(1, klineWidth * OSCILLATOR_CONFIG.BAR_WIDTH_RATIO);

    drawHistogramBars(
      ctx,
      macdData!.histogram,
      visibleStart,
      visibleEndClamped,
      indexToX,
      valueToY,
      zeroY,
      colors.macd?.histogramPositive ?? INDICATOR_COLORS.MACD_HISTOGRAM_POSITIVE,
      colors.macd?.histogramNegative ?? INDICATOR_COLORS.MACD_HISTOGRAM_NEGATIVE,
      barWidth,
    );

    drawLineOnPanel(
      ctx,
      macdData!.macd,
      visibleStart,
      visibleEndClamped,
      indexToX,
      valueToY,
      colors.macd?.macdLine ?? INDICATOR_COLORS.MACD_LINE,
      OSCILLATOR_CONFIG.LINE_WIDTH,
    );
    drawLineOnPanel(
      ctx,
      macdData!.signal,
      visibleStart,
      visibleEndClamped,
      indexToX,
      valueToY,
      colors.macd?.signalLine ?? INDICATOR_COLORS.MACD_SIGNAL,
      OSCILLATOR_CONFIG.LINE_WIDTH,
    );

    drawZoneLines({ ctx, chartWidth, levels: [{ y: zeroY }] });

    ctx.restore();

    drawPanelValueTag(ctx, macdData!.signal, visibleStart, visibleEndClamped, valueToY, chartWidth, colors.macd?.signalLine ?? INDICATOR_COLORS.MACD_SIGNAL);
    drawPanelValueTag(ctx, macdData!.macd, visibleStart, visibleEndClamped, valueToY, chartWidth, colors.macd?.macdLine ?? INDICATOR_COLORS.MACD_LINE);
  }, [manager, macdData, enabled, colors]);

  return { render };
};
