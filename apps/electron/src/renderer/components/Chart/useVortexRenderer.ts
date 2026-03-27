import type { VortexResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS } from '@shared/constants';
import { useCallback } from 'react';
import { applyPanelClip, drawPanelBackground, drawPanelValueTag, drawZoneLines } from './utils/oscillatorRendering';

interface UseVortexRendererProps {
  manager: CanvasManager | null;
  vortexData: VortexResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useVortexRenderer = ({
  manager,
  vortexData,
  colors,
  enabled = true,
}: UseVortexRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !vortexData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const panelInfo = manager.getPanelInfo('vortex');

    if (!ctx || !dimensions || !panelInfo) return;

    const { y: panelY, height: panelHeight } = panelInfo;
    const { chartWidth } = dimensions;

    ctx.save();
    drawPanelBackground({ ctx, panelY, panelHeight, chartWidth });
    applyPanelClip({ ctx, panelY, panelHeight, chartWidth });

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const visibleVIPlus = vortexData.viPlus.slice(visibleStartIndex, visibleEndIndex).filter((v): v is number => v !== null);
    const visibleVIMinus = vortexData.viMinus.slice(visibleStartIndex, visibleEndIndex).filter((v): v is number => v !== null);

    if (visibleVIPlus.length === 0 && visibleVIMinus.length === 0) {
      ctx.restore();
      return;
    }

    const allValues = [...visibleVIPlus, ...visibleVIMinus];
    const minValue = Math.min(0.5, ...allValues);
    const maxValue = Math.max(1.5, ...allValues);
    const range = maxValue - minValue;

    const valueToY = (value: number): number => {
      const normalizedValue = (value - minValue) / range;
      return panelY + panelHeight - normalizedValue * panelHeight;
    };

    const oneY = valueToY(1);
    drawZoneLines({ ctx, chartWidth, levels: [{ y: oneY }] });

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

    drawLine(vortexData.viPlus, colors.vortex?.viPlusLine ?? INDICATOR_COLORS.VORTEX_PLUS, 1);
    drawLine(vortexData.viMinus, colors.vortex?.viMinusLine ?? INDICATOR_COLORS.VORTEX_MINUS, 1);

    ctx.restore();

    drawPanelValueTag(ctx, vortexData.viMinus, visibleStartIndex, visibleEndIndex, valueToY, chartWidth, colors.vortex?.viMinusLine ?? INDICATOR_COLORS.VORTEX_MINUS);
    drawPanelValueTag(ctx, vortexData.viPlus, visibleStartIndex, visibleEndIndex, valueToY, chartWidth, colors.vortex?.viPlusLine ?? INDICATOR_COLORS.VORTEX_PLUS);
  }, [manager, vortexData, enabled, colors]);

  return { render };
};
