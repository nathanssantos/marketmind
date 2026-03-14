import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG, OSCILLATOR_CONFIG } from '@shared/constants';
import { useCallback } from 'react';
import { getOscillatorSetup } from './hooks/useOscillatorSetup';
import {
  applyPanelClip,
  drawPanelBackground,
  drawZoneLines,
} from './utils/oscillatorRendering';

interface UseCVDRendererProps {
  manager: CanvasManager | null;
  cvdValues: (number | null)[];
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useCVDRenderer = ({
  manager,
  cvdValues,
  colors,
  enabled = true,
}: UseCVDRendererProps) => {
  const render = useCallback((): void => {
    const setup = getOscillatorSetup(manager, enabled && cvdValues.length > 0, 'cvd');
    if (!setup) return;

    const { ctx, chartWidth, panelTop, panelHeight, visibleStart, visibleEnd, indexToX } = setup;

    ctx.save();
    applyPanelClip({ ctx, panelY: panelTop, panelHeight, chartWidth });
    drawPanelBackground({ ctx, panelY: panelTop, panelHeight, chartWidth });

    let min = Infinity;
    let max = -Infinity;
    for (let i = visibleStart; i < visibleEnd && i < cvdValues.length; i++) {
      const v = cvdValues[i] ?? null;
      if (v === null) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }

    if (min === Infinity || max === -Infinity || min === max) {
      ctx.restore();
      return;
    }

    const padding = CHART_CONFIG.PANEL_PADDING;
    const drawHeight = panelHeight - padding * 2;
    const range = max - min;

    const valueToY = (v: number) => panelTop + padding + drawHeight - ((v - min) / range) * drawHeight;

    const zeroY = min <= 0 && max >= 0 ? valueToY(0) : null;
    if (zeroY !== null) {
      drawZoneLines({ ctx, chartWidth, levels: [{ y: zeroY }] });
    }

    ctx.beginPath();
    ctx.strokeStyle = colors.rsi?.line ?? '#2196F3';
    ctx.lineWidth = OSCILLATOR_CONFIG.LINE_WIDTH;

    let started = false;
    for (let i = visibleStart; i < visibleEnd && i < cvdValues.length; i++) {
      const v = cvdValues[i] ?? null;
      if (v === null) continue;
      const x = indexToX(i);
      const y = valueToY(v as number);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    ctx.restore();
  }, [manager, cvdValues, enabled, colors]);

  return { render };
};
