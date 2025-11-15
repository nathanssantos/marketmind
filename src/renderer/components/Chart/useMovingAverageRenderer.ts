import { useCallback } from 'react';
import type { Candle, Viewport } from '@shared/types';
import type { Bounds, Dimensions } from '@/renderer/utils/canvas/coordinateSystem';
import { priceToY } from '@/renderer/utils/canvas/coordinateSystem';
import { calculateMovingAverage } from '@/renderer/utils/movingAverages';

export interface MovingAverageConfig {
  period: number;
  type: 'SMA' | 'EMA';
  color: string;
  lineWidth?: number;
  visible?: boolean;
}

interface MovingAverageRendererConfig {
  candles: Candle[];
  viewport: Viewport;
  canvas: HTMLCanvasElement;
  bounds: Bounds;
  dimensions: Dimensions;
  movingAverages: MovingAverageConfig[];
}

export const useMovingAverageRenderer = () => {
  const renderMovingAverages = useCallback((config: MovingAverageRendererConfig) => {
    const { candles, viewport, canvas, bounds, dimensions, movingAverages } = config;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const candleWidth = dimensions.width / (viewport.end - viewport.start);
    const startIndex = Math.max(0, Math.floor(viewport.start));
    const endIndex = Math.min(candles.length, Math.ceil(viewport.end));

    movingAverages.forEach((ma) => {
      if (!ma.visible) return;

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

        const x = (i - viewport.start) * candleWidth + candleWidth / 2;
        const y = priceToY(value, bounds, dimensions, 10, 10);

        if (!hasMovedTo) {
          ctx.moveTo(x, y);
          hasMovedTo = true;
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    });
  }, []);

  return { renderMovingAverages };
};
