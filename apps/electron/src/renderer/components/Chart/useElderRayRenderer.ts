import type { ElderRayResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback } from 'react';

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
    const effectiveWidth = chartWidth - 72;
    const klineWidth = effectiveWidth / (viewport.end - viewport.start);

    ctx.save();

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

    const indexToX = (index: number): number =>
      (index - viewport.start) * klineWidth + klineWidth / 2;

    const zeroY = valueToY(0);

    const barWidth = Math.max(1, klineWidth * 0.3);
    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const bullValue = elderRayData.bullPower[i];
      const bearValue = elderRayData.bearPower[i];
      const x = indexToX(i);

      if (bullValue !== null && bullValue !== undefined) {
        const y = valueToY(bullValue);
        const height = Math.abs(y - zeroY);
        ctx.fillStyle = colors.elderRay?.bullPower ?? '#26a69a';
        ctx.fillRect(x - barWidth - 1, bullValue >= 0 ? y : zeroY, barWidth, height);
      }

      if (bearValue !== null && bearValue !== undefined) {
        const y = valueToY(bearValue);
        const height = Math.abs(y - zeroY);
        ctx.fillStyle = colors.elderRay?.bearPower ?? '#ef5350';
        ctx.fillRect(x + 1, bearValue >= 0 ? y : zeroY, barWidth, height);
      }
    }

    ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(effectiveWidth, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }, [manager, elderRayData, enabled, colors]);

  return { render };
};
