import type { TSIResult } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS } from '@shared/constants';
import { useCallback } from 'react';
import { applyPanelClip, drawPanelBackground, drawPanelValueTag, drawZoneLines } from './utils/oscillatorRendering';

interface UseTSIRendererProps {
  manager: CanvasManager | null;
  tsiData: TSIResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useTSIRenderer = ({
  manager,
  tsiData,
  colors,
  enabled = true,
}: UseTSIRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !tsiData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const panelInfo = manager.getPanelInfo('tsi');

    if (!ctx || !dimensions || !panelInfo) return;

    const { y: panelY, height: panelHeight } = panelInfo;
    const { chartWidth } = dimensions;

    ctx.save();
    drawPanelBackground({ ctx, panelY, panelHeight, chartWidth });
    applyPanelClip({ ctx, panelY, panelHeight, chartWidth });

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const visibleTSI = tsiData.tsi.slice(visibleStartIndex, visibleEndIndex).filter((v): v is number => v !== null);
    const visibleSignal = tsiData.signal.slice(visibleStartIndex, visibleEndIndex).filter((v): v is number => v !== null);

    if (visibleTSI.length === 0) {
      ctx.restore();
      return;
    }

    const allValues = [...visibleTSI, ...visibleSignal];
    const minValue = Math.min(-25, ...allValues);
    const maxValue = Math.max(25, ...allValues);
    const range = maxValue - minValue;

    const valueToY = (value: number): number => {
      const normalizedValue = (value - minValue) / range;
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

    drawLine(tsiData.tsi, colors.tsi?.tsiLine ?? INDICATOR_COLORS.TSI_LINE, 1);
    drawLine(tsiData.signal, colors.tsi?.signalLine ?? INDICATOR_COLORS.TSI_SIGNAL, 1);

    ctx.restore();

    drawPanelValueTag(ctx, tsiData.signal, visibleStartIndex, visibleEndIndex, valueToY, chartWidth, colors.tsi?.signalLine ?? INDICATOR_COLORS.TSI_SIGNAL);
    drawPanelValueTag(ctx, tsiData.tsi, visibleStartIndex, visibleEndIndex, valueToY, chartWidth, colors.tsi?.tsiLine ?? INDICATOR_COLORS.TSI_LINE);
  }, [manager, tsiData, enabled, colors]);

  return { render };
};
