import type { StochRSIResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG, INDICATOR_COLORS, INDICATOR_PANEL_HEIGHTS, OSCILLATOR_CONFIG } from '@shared/constants';
import { useCallback } from 'react';
import { getOscillatorSetup } from './hooks/useOscillatorSetup';
import {
  createNormalizedValueToY,
  drawLineOnPanel,
  drawPanelBackground,
  drawPanelValueTag,
  drawZoneFill,
  drawZoneLines,
} from './utils/oscillatorRendering';

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
    const setup = getOscillatorSetup(manager, enabled && !!stochRsiData, PANEL_ID);
    if (!setup) return;

    const { ctx, chartWidth, panelTop, panelHeight, visibleStart, visibleEnd, indexToX } = setup;
    const valueToY = createNormalizedValueToY(panelTop, panelHeight, CHART_CONFIG.PANEL_PADDING);

    ctx.save();
    drawPanelBackground({ ctx, panelY: panelTop, panelHeight, chartWidth });

    const overboughtY = valueToY(80);
    const oversoldY = valueToY(20);
    const midY = valueToY(50);

    drawZoneFill({ ctx, chartWidth, panelY: panelTop, panelHeight, topY: overboughtY, bottomY: oversoldY });
    drawZoneLines({ ctx, chartWidth, levels: [{ y: overboughtY }, { y: oversoldY }, { y: midY }] });

    drawLineOnPanel(
      ctx,
      stochRsiData!.k,
      visibleStart,
      visibleEnd,
      indexToX,
      valueToY,
      colors.stochRsi?.k ?? INDICATOR_COLORS.STOCH_RSI_K,
      OSCILLATOR_CONFIG.LINE_WIDTH,
    );
    drawLineOnPanel(
      ctx,
      stochRsiData!.d,
      visibleStart,
      visibleEnd,
      indexToX,
      valueToY,
      colors.stochRsi?.d ?? INDICATOR_COLORS.STOCH_RSI_D,
      OSCILLATOR_CONFIG.LINE_WIDTH,
    );

    ctx.restore();

    drawPanelValueTag(ctx, stochRsiData!.d, visibleStart, visibleEnd, valueToY, chartWidth, colors.stochRsi?.d ?? INDICATOR_COLORS.STOCH_RSI_D);
    drawPanelValueTag(ctx, stochRsiData!.k, visibleStart, visibleEnd, valueToY, chartWidth, colors.stochRsi?.k ?? INDICATOR_COLORS.STOCH_RSI_K);
  }, [manager, stochRsiData, enabled, colors]);

  return { render, panelId: PANEL_ID, panelHeight: PANEL_HEIGHT };
};
