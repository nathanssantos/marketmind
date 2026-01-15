import type { RSIResult } from '@marketmind/indicators';
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
  drawZoneFill,
  drawZoneLines,
} from './utils/oscillatorRendering';

interface UseRSIRendererProps {
  manager: CanvasManager | null;
  rsiData: RSIResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  overboughtLevel?: number;
  oversoldLevel?: number;
}

export const useRSIRenderer = ({
  manager,
  rsiData,
  colors,
  enabled = true,
  overboughtLevel = 95,
  oversoldLevel = 5,
}: UseRSIRendererProps) => {
  const render = useCallback((): void => {
    const setup = getOscillatorSetup(manager, enabled && !!rsiData, 'rsi');
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
      rsiData!.values,
      visibleStart,
      visibleEnd,
      indexToX,
      valueToY,
      colors.rsi.line,
      OSCILLATOR_CONFIG.LINE_WIDTH,
    );

    ctx.restore();
  }, [manager, rsiData, enabled, overboughtLevel, oversoldLevel, colors]);

  return { render };
};
