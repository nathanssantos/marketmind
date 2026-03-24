import type { RefObject } from 'react';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG, INDICATOR_COLORS, OSCILLATOR_CONFIG } from '@shared/constants';
import { SCALPING_DEFAULTS } from '@marketmind/types';
import { useCallback } from 'react';
import { getOscillatorSetup } from './hooks/useOscillatorSetup';
import {
  applyPanelClip,
  drawPanelBackground,
  drawZoneLines,
  drawZoneFill,
} from './utils/oscillatorRendering';

interface UseImbalanceRendererProps {
  manager: CanvasManager | null;
  imbalanceValuesRef: RefObject<(number | null)[]>;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useImbalanceRenderer = ({
  manager,
  imbalanceValuesRef,
  colors,
  enabled = true,
}: UseImbalanceRendererProps) => {
  const render = useCallback((): void => {
    const imbalanceValues = imbalanceValuesRef.current;
    const setup = getOscillatorSetup(manager, enabled && imbalanceValues.length > 0, 'bookImbalance');
    if (!setup) return;

    const { ctx, chartWidth, panelTop, panelHeight, visibleStart, visibleEnd, indexToX } = setup;

    ctx.save();
    applyPanelClip({ ctx, panelY: panelTop, panelHeight, chartWidth });
    drawPanelBackground({ ctx, panelY: panelTop, panelHeight, chartWidth });

    const padding = CHART_CONFIG.PANEL_PADDING;
    const drawHeight = panelHeight - padding * 2;

    const valueToY = (v: number) => panelTop + padding + drawHeight / 2 - (v * drawHeight) / 2;

    const zeroY = valueToY(0);
    const bullishY = valueToY(SCALPING_DEFAULTS.IMBALANCE_THRESHOLD);
    const bearishY = valueToY(-SCALPING_DEFAULTS.IMBALANCE_THRESHOLD);

    drawZoneFill({ ctx, chartWidth, panelY: panelTop, panelHeight, topY: bullishY, bottomY: bearishY });
    drawZoneLines({ ctx, chartWidth, levels: [{ y: zeroY }, { y: bullishY }, { y: bearishY }] });

    ctx.beginPath();
    ctx.strokeStyle = colors.scalping?.imbalanceLine ?? INDICATOR_COLORS.IMBALANCE_LINE;
    ctx.lineWidth = OSCILLATOR_CONFIG.LINE_WIDTH;

    let started = false;
    for (let i = visibleStart; i < visibleEnd && i < imbalanceValues.length; i++) {
      const v = imbalanceValues[i] ?? null;
      if (v === null) continue;
      const clamped = Math.max(-1, Math.min(1, v));
      const x = indexToX(i);
      const y = valueToY(clamped);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    ctx.restore();
  }, [manager, imbalanceValuesRef, enabled, colors]);

  return { render };
};
