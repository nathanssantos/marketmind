import type { KlingerResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS } from '@shared/constants';
import { useCallback } from 'react';
import { applyPanelClip, drawPanelBackground, drawZoneLines } from './utils/oscillatorRendering';

interface UseKlingerRendererProps {
  manager: CanvasManager | null;
  klingerData: KlingerResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useKlingerRenderer = ({
  manager,
  klingerData,
  colors,
  enabled = true,
}: UseKlingerRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !klingerData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const panelInfo = manager.getPanelInfo('klinger');

    if (!ctx || !dimensions || !panelInfo) return;

    const { y: panelY, height: panelHeight } = panelInfo;
    const { chartWidth } = dimensions;

    ctx.save();
    drawPanelBackground({ ctx, panelY, panelHeight, chartWidth });
    applyPanelClip({ ctx, panelY, panelHeight, chartWidth });

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.min(Math.ceil(viewport.end), klingerData.kvo.length);

    let minValue = Infinity;
    let maxValue = -Infinity;
    let hasValidValue = false;

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const kvoVal = klingerData.kvo[i];
      const signalVal = klingerData.signal[i];

      if (kvoVal !== null && kvoVal !== undefined) {
        hasValidValue = true;
        if (kvoVal < minValue) minValue = kvoVal;
        if (kvoVal > maxValue) maxValue = kvoVal;
      }
      if (signalVal !== null && signalVal !== undefined) {
        if (signalVal < minValue) minValue = signalVal;
        if (signalVal > maxValue) maxValue = signalVal;
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
    drawZoneLines({ ctx, chartWidth, levels: [{ y: zeroY }] });

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

    drawLine(klingerData.kvo, colors.klinger?.kvoLine ?? INDICATOR_COLORS.KLINGER_LINE, 1);
    drawLine(klingerData.signal, colors.klinger?.signalLine ?? INDICATOR_COLORS.KLINGER_SIGNAL, 1);

    ctx.restore();
  }, [manager, klingerData, enabled, colors]);

  return { render };
};
