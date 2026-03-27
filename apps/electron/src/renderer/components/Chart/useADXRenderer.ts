import type { ADXResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS } from '@shared/constants';
import { useCallback } from 'react';
import { drawPanelBackground, drawPanelValueTag, drawZoneLines } from './utils/oscillatorRendering';

interface UseADXRendererProps {
  manager: CanvasManager | null;
  adxData: ADXResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useADXRenderer = ({
  manager,
  adxData,
  colors,
  enabled = true,
}: UseADXRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !adxData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const panelInfo = manager.getPanelInfo('adx');

    if (!ctx || !dimensions || !panelInfo) return;

    const { y: panelY, height: panelHeight } = panelInfo;
    const { chartWidth } = dimensions;

    ctx.save();
    drawPanelBackground({ ctx, panelY, panelHeight, chartWidth });

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const valueToY = (value: number): number => {
      const normalizedValue = value / 100;
      return panelY + panelHeight - normalizedValue * panelHeight;
    };

    const thresholdY = valueToY(25);
    drawZoneLines({ ctx, chartWidth, levels: [{ y: thresholdY }] });

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

    drawLine(adxData.plusDI, colors.adx?.plusDI ?? INDICATOR_COLORS.ADX_PLUS_DI, 1);
    drawLine(adxData.minusDI, colors.adx?.minusDI ?? INDICATOR_COLORS.ADX_MINUS_DI, 1);
    drawLine(adxData.adx, colors.adx?.adxLine ?? INDICATOR_COLORS.ADX_LINE, 1);

    ctx.restore();

    drawPanelValueTag(ctx, adxData.plusDI, visibleStartIndex, visibleEndIndex, valueToY, chartWidth, colors.adx?.plusDI ?? INDICATOR_COLORS.ADX_PLUS_DI);
    drawPanelValueTag(ctx, adxData.minusDI, visibleStartIndex, visibleEndIndex, valueToY, chartWidth, colors.adx?.minusDI ?? INDICATOR_COLORS.ADX_MINUS_DI);
    drawPanelValueTag(ctx, adxData.adx, visibleStartIndex, visibleEndIndex, valueToY, chartWidth, colors.adx?.adxLine ?? INDICATOR_COLORS.ADX_LINE);
  }, [manager, adxData, enabled, colors]);

  return { render };
};
