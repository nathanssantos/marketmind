import type { RSIResult } from '@marketmind/types';
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

interface UseRSIRendererProps {
  manager: CanvasManager | null;
  rsiData: RSIResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  overboughtLevel?: number;
  oversoldLevel?: number;
  panelId?: string;
}

export const useRSIRenderer = ({
  manager,
  rsiData,
  colors,
  enabled = true,
  overboughtLevel = 90,
  oversoldLevel = 10,
  panelId = 'rsi',
}: UseRSIRendererProps) => {
  const render = useCallback((): void => {
    const setup = getOscillatorSetup(manager, enabled && !!rsiData, panelId);
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

    drawPanelValueTag(ctx, rsiData!.values, visibleStart, visibleEnd, valueToY, chartWidth, colors.rsi.line);
  }, [manager, rsiData, enabled, overboughtLevel, oversoldLevel, colors, panelId]);

  return { render };
};
