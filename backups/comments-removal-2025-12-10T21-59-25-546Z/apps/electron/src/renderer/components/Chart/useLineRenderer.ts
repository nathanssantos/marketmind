import type { Bounds, Dimensions } from '@/renderer/utils/canvas/coordinateSystem';
import { priceToY } from '@/renderer/utils/canvas/coordinateSystem';
import type { Kline, Viewport } from '@marketmind/types';
import { getKlineClose } from '@shared/utils';
import { useCallback } from 'react';

const DEFAULT_LINE_COLOR = '#2196f3';

interface LineRendererConfig {
  klines: Kline[];
  viewport: Viewport;
  canvas: HTMLCanvasElement;
  bounds: Bounds;
  dimensions: Dimensions;
  color?: string;
  lineWidth?: number;
  showArea?: boolean;
}

export const useLineRenderer = () => {
  const renderLine = useCallback((config: LineRendererConfig) => {
    const {
      klines,
      viewport,
      canvas,
      bounds,
      dimensions,
      color = DEFAULT_LINE_COLOR,
      lineWidth = 2,
      showArea = true,
    } = config;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const klineWidth = dimensions.width / (viewport.end - viewport.start);

    const startIndex = Math.max(0, Math.floor(viewport.start));
    const endIndex = Math.min(klines.length, Math.ceil(viewport.end));
    const visibleKlines = klines.slice(startIndex, endIndex);

    if (visibleKlines.length === 0) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();

    visibleKlines.forEach((kline, i) => {
      const x = (startIndex + i - viewport.start) * klineWidth + klineWidth / 2;
      const y = priceToY(getKlineClose(kline), bounds, dimensions, 10, 10);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    if (showArea) {
      const lastX = (endIndex - 1 - viewport.start) * klineWidth + klineWidth / 2;
      const firstX = (startIndex - viewport.start) * klineWidth + klineWidth / 2;

      ctx.fillStyle = `${color}33`;
      ctx.lineTo(lastX, dimensions.chartHeight);
      ctx.lineTo(firstX, dimensions.chartHeight);
      ctx.closePath();
      ctx.fill();
    }
  }, []);

  return { renderLine };
};
