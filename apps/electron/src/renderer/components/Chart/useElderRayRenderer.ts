import type { ElderRayResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { INDICATOR_COLORS } from '@shared/constants';
import { useCallback } from 'react';
import { applyPanelClip, drawPanelBackground, drawPanelValueTag, drawZoneLines } from './utils/oscillatorRendering';

interface UseElderRayRendererProps {
  manager: CanvasManager | null;
  elderRayData: ElderRayResult | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

export const useElderRayRenderer = ({
  manager,
  elderRayData,
  colors,
  enabled = true,
}: UseElderRayRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled || !elderRayData) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const panelInfo = manager.getPanelInfo('elderRay');

    if (!ctx || !dimensions || !panelInfo) return;

    const { y: panelY, height: panelHeight } = panelInfo;
    const { chartWidth } = dimensions;
    const widthPerKline = chartWidth / (viewport.end - viewport.start);

    ctx.save();
    drawPanelBackground({ ctx, panelY, panelHeight, chartWidth });
    applyPanelClip({ ctx, panelY, panelHeight, chartWidth });

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const visibleBull = elderRayData.bullPower.slice(visibleStartIndex, visibleEndIndex).filter((v): v is number => v !== null);
    const visibleBear = elderRayData.bearPower.slice(visibleStartIndex, visibleEndIndex).filter((v): v is number => v !== null);

    if (visibleBull.length === 0 && visibleBear.length === 0) {
      ctx.restore();
      return;
    }

    const allValues = [...visibleBull, ...visibleBear];
    const minValue = Math.min(0, ...allValues);
    const maxValue = Math.max(0, ...allValues);
    const range = maxValue - minValue || 1;
    const padding = range * 0.1;

    const valueToY = (value: number): number => {
      const normalizedValue = (value - (minValue - padding)) / (range + padding * 2);
      return panelY + panelHeight - normalizedValue * panelHeight;
    };

    const zeroY = valueToY(0);

    const barWidth = Math.max(1, widthPerKline * 0.3);
    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const bullValue = elderRayData.bullPower[i];
      const bearValue = elderRayData.bearPower[i];
      const x = manager.indexToCenterX(i);

      if (bullValue !== null && bullValue !== undefined) {
        const y = valueToY(bullValue);
        const height = Math.abs(y - zeroY);
        ctx.fillStyle = colors.elderRay?.bullPower ?? INDICATOR_COLORS.ELDER_BULL;
        ctx.fillRect(x - barWidth - 1, bullValue >= 0 ? y : zeroY, barWidth, height);
      }

      if (bearValue !== null && bearValue !== undefined) {
        const y = valueToY(bearValue);
        const height = Math.abs(y - zeroY);
        ctx.fillStyle = colors.elderRay?.bearPower ?? INDICATOR_COLORS.ELDER_BEAR;
        ctx.fillRect(x + 1, bearValue >= 0 ? y : zeroY, barWidth, height);
      }
    }

    drawZoneLines({ ctx, chartWidth, levels: [{ y: zeroY }] });

    ctx.restore();

    drawPanelValueTag(ctx, elderRayData.bearPower, visibleStartIndex, visibleEndIndex, valueToY, chartWidth, colors.elderRay?.bearPower ?? INDICATOR_COLORS.ELDER_BEAR);
    drawPanelValueTag(ctx, elderRayData.bullPower, visibleStartIndex, visibleEndIndex, valueToY, chartWidth, colors.elderRay?.bullPower ?? INDICATOR_COLORS.ELDER_BULL);
  }, [manager, elderRayData, enabled, colors]);

  return { render };
};
