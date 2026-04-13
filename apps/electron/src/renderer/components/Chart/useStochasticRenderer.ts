import type { StochasticResult } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG, OSCILLATOR_CONFIG } from '@shared/constants';
import { useCallback } from 'react';
import { getOscillatorSetup } from './hooks/useOscillatorSetup';
import {
  applyPanelClip,
  createNormalizedValueToY,
  drawLineOnPanel,
  drawPanelBackground,
  drawPanelValueTag,
  drawZoneFill,
  drawZoneLines,
} from './utils/oscillatorRendering';

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
    const setup = getOscillatorSetup(manager, enabled && !!stochasticData, 'stochastic');
    if (!setup) return;

    const { ctx, chartWidth, panelTop, panelHeight, visibleStart, visibleEnd, indexToX } = setup;
    const valueToY = createNormalizedValueToY(panelTop, panelHeight, CHART_CONFIG.PANEL_PADDING);

    ctx.save();
    applyPanelClip({ ctx, panelY: panelTop, panelHeight, chartWidth });
    drawPanelBackground({ ctx, panelY: panelTop, panelHeight, chartWidth });

    const overboughtY = valueToY(overboughtLevel);
    const oversoldY = valueToY(oversoldLevel);
    const midY = valueToY(50);

    drawZoneFill({ ctx, chartWidth, panelY: panelTop, panelHeight, topY: overboughtY, bottomY: oversoldY });
    drawZoneLines({ ctx, chartWidth, levels: [{ y: overboughtY }, { y: oversoldY }, { y: midY }] });

    drawLineOnPanel(
      ctx,
      stochasticData!.k,
      visibleStart,
      visibleEnd,
      indexToX,
      valueToY,
      colors.stochastic.k,
      OSCILLATOR_CONFIG.LINE_WIDTH,
    );
    drawLineOnPanel(
      ctx,
      stochasticData!.d,
      visibleStart,
      visibleEnd,
      indexToX,
      valueToY,
      colors.stochastic.d,
      OSCILLATOR_CONFIG.LINE_WIDTH,
    );

    ctx.restore();

    drawPanelValueTag(ctx, stochasticData!.d, visibleStart, visibleEnd, valueToY, chartWidth, colors.stochastic.d);
    drawPanelValueTag(ctx, stochasticData!.k, visibleStart, visibleEnd, valueToY, chartWidth, colors.stochastic.k);
  }, [manager, stochasticData, enabled, overboughtLevel, oversoldLevel, colors]);

  return { render };
};
