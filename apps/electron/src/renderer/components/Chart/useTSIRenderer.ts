import type { TSIResult } from '@marketmind/indicators';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback } from 'react';

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
    const effectiveWidth = chartWidth - 72;
    const klineWidth = effectiveWidth / (viewport.end - viewport.start);

    ctx.save();

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

    const indexToX = (index: number): number =>
      (index - viewport.start) * klineWidth + klineWidth / 2;

    const zeroY = valueToY(0);
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
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

    drawLine(tsiData.tsi, colors.tsi?.tsiLine ?? '#2962ff', 1.5);
    drawLine(tsiData.signal, colors.tsi?.signalLine ?? '#ff6d00', 1.5);

    ctx.restore();
  }, [manager, tsiData, enabled, colors]);

  return { render };
};
