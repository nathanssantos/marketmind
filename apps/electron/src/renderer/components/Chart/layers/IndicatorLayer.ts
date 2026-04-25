import { calculateMovingAverage } from '../../../lib/indicators';
import type { Kline, Viewport } from '@marketmind/types';

export interface MovingAverageLayerConfig {
  period: number;
  color: string;
  lineWidth?: number;
  type?: 'SMA' | 'EMA';
}

export const createMovingAverageRenderer = (
  klines: Kline[],
  configs: MovingAverageLayerConfig[]
) => {
  const maData = configs.map((config) => {
    const values = calculateMovingAverage(klines, config.period, config.type ?? 'SMA');
    return { ...config, values };
  });

  return (ctx: CanvasRenderingContext2D, viewport: Viewport) => {
    if (klines.length === 0) return;

    const { width, height, priceMin, priceMax, start, end } = viewport;

    const visibleStart = Math.max(0, Math.floor(start));
    const visibleEnd = Math.min(klines.length, Math.ceil(end));

    ctx.save();

    maData.forEach(({ color, lineWidth = 2, values }) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      let started = false;

      for (let i = visibleStart; i < visibleEnd; i++) {
        const value = values[i];
        if (value === null || value === undefined) continue;

        const x = ((i - start) / (end - start)) * width;
        const y = height - ((value - priceMin) / (priceMax - priceMin)) * height;

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }

      if (started) {
        ctx.stroke();
      }
    });

    ctx.restore();
  };
};

export interface IndicatorLayerConfig {
  movingAverages?: MovingAverageLayerConfig[];
}

export const createIndicatorRenderer = (
  klines: Kline[],
  config: IndicatorLayerConfig = {}
) => {
  const renderers: Array<(ctx: CanvasRenderingContext2D, viewport: Viewport) => void> = [];

  if (config.movingAverages && config.movingAverages.length > 0) {
    renderers.push(createMovingAverageRenderer(klines, config.movingAverages));
  }

  return (ctx: CanvasRenderingContext2D, viewport: Viewport) => {
    renderers.forEach((renderer) => renderer(ctx, viewport));
  };
};
