import { calculateMovingAverage } from '@/renderer/utils/movingAverages';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import { useCallback } from 'react';

export interface MovingAverageConfig {
  period: number;
  type: 'SMA' | 'EMA';
  color: string;
  lineWidth?: number;
  visible?: boolean;
}

export interface UseMovingAverageRendererProps {
  manager: CanvasManager | null;
  movingAverages?: MovingAverageConfig[];
  rightMargin?: number;
}

export interface UseMovingAverageRendererReturn {
  render: () => void;
}

export const useMovingAverageRenderer = ({
  manager,
  movingAverages = [],
  rightMargin,
}: UseMovingAverageRendererProps): UseMovingAverageRendererReturn => {
  const render = useCallback((): void => {
    if (!manager || movingAverages.length === 0) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const bounds = manager.getBounds();
    const candles = manager.getCandles();

    if (!ctx || !dimensions || !bounds || !candles) return;

    const { chartWidth, chartHeight } = dimensions;
    const startIndex = Math.max(0, Math.floor(viewport.start));
    const endIndex = Math.min(candles.length, Math.ceil(viewport.end));
    const effectiveWidth = chartWidth - (rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, effectiveWidth, chartHeight);
    ctx.clip();

    movingAverages.forEach((ma) => {
      if (ma.visible === false) return;

      const values = calculateMovingAverage(candles, ma.period, ma.type);

      ctx.strokeStyle = ma.color;
      ctx.lineWidth = ma.lineWidth || 1.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();

      let hasMovedTo = false;

      for (let i = startIndex; i < endIndex; i++) {
        const value = values[i];
        if (value === null || value === undefined) continue;

        const x = manager.indexToX(i);
        const y = manager.priceToY(value);

        if (x < 0 || x > effectiveWidth) continue;

        if (!hasMovedTo) {
          ctx.moveTo(x, y);
          hasMovedTo = true;
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    });

    ctx.restore();
  }, [manager, movingAverages, rightMargin, manager?.getCandles()]);

  return { render };
};
