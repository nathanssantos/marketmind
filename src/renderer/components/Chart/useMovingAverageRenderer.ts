import { calculateMovingAverage } from '@/renderer/utils/movingAverages';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import { useCallback, useMemo } from 'react';

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
  hoveredMAIndex?: number | undefined;
}

export interface UseMovingAverageRendererReturn {
  render: () => void;
}

export const useMovingAverageRenderer = ({
  manager,
  movingAverages = [],
  rightMargin,
  hoveredMAIndex,
}: UseMovingAverageRendererProps): UseMovingAverageRendererReturn => {
  const candles = useMemo(() => manager?.getCandles() ?? [], [manager]);
  
  const render = useCallback((): void => {
    if (!manager || movingAverages.length === 0) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const bounds = manager.getBounds();

    if (!ctx || !dimensions || !bounds || !candles) return;

    const { chartWidth } = dimensions;
    const startIndex = Math.max(0, Math.floor(viewport.start));
    const endIndex = Math.min(candles.length, Math.ceil(viewport.end));
    const effectiveWidth = chartWidth - (rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);
    
    const visibleRange = viewport.end - viewport.start;
    const widthPerCandle = effectiveWidth / visibleRange;
    const { candleWidth } = viewport;
    const candleCenterOffset = (widthPerCandle - candleWidth) / 2 + candleWidth / 2;

    ctx.save();

    movingAverages.forEach((ma, index) => {
      if (ma.visible === false) return;

      const values = calculateMovingAverage(candles, ma.period, ma.type);
      const isHovered = hoveredMAIndex === index;

      ctx.strokeStyle = ma.color;
      ctx.lineWidth = isHovered ? (ma.lineWidth || 1.5) + 1 : (ma.lineWidth || 1.5);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      if (isHovered) {
        ctx.shadowColor = ma.color;
        ctx.shadowBlur = 8;
      }

      ctx.beginPath();

      let hasMovedTo = false;

      for (let i = startIndex; i < endIndex; i++) {
        const value = values[i];
        if (value === null || value === undefined) continue;

        const x = manager.indexToX(i) + candleCenterOffset;
        const y = manager.priceToY(value);

        const isVisible = x >= -10 && x <= effectiveWidth + 10;

        if (isVisible) {
          if (!hasMovedTo) {
            ctx.moveTo(x, y);
            hasMovedTo = true;
          } else {
            ctx.lineTo(x, y);
          }
        } else if (hasMovedTo) {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      
      if (isHovered) {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
    });

    ctx.restore();
  }, [manager, movingAverages, rightMargin, hoveredMAIndex, candles]);

  return { render };
};
