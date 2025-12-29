import type { KlingerResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback } from 'react';

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
    const effectiveWidth = chartWidth - 72;
    const klineWidth = effectiveWidth / (viewport.end - viewport.start);

    ctx.save();

    const visibleStartIndex = Math.floor(viewport.start);
    const visibleEndIndex = Math.ceil(viewport.end);

    const visibleKVO = klingerData.kvo.slice(visibleStartIndex, visibleEndIndex).filter((v): v is number => v !== null);
    const visibleSignal = klingerData.signal.slice(visibleStartIndex, visibleEndIndex).filter((v): v is number => v !== null);

    if (visibleKVO.length === 0) {
      ctx.restore();
      return;
    }

    const allValues = [...visibleKVO, ...visibleSignal];
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue || 1;
    const padding = range * 0.1;

    const valueToY = (value: number): number => {
      const normalizedValue = (value - (minValue - padding)) / (range + padding * 2);
      return panelY + panelHeight - normalizedValue * panelHeight;
    };

    const indexToX = (index: number): number =>
      (index - viewport.start) * klineWidth + klineWidth / 2;

    const zeroY = valueToY(0);
    ctx.strokeStyle = colors.klinger?.zeroLine ?? 'rgba(128, 128, 128, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(effectiveWidth, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    const drawLine = (values: (number | null)[], color: string, lineWidth: number): void => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      let isFirstPoint = true;

      for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
        const value = values[i];
        if (value === null || value === undefined) continue;

        const x = indexToX(i);
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

    drawLine(klingerData.kvo, colors.klinger?.kvoLine ?? '#2962ff', 1.5);
    drawLine(klingerData.signal, colors.klinger?.signalLine ?? '#ff6d00', 1.5);

    ctx.restore();
  }, [manager, klingerData, enabled, colors]);

  return { render };
};
