import type { Viewport } from '@marketmind/types';

export interface GridLayerConfig {
  showHorizontalLines?: boolean;
  showVerticalLines?: boolean;
  lineColor?: string;
  lineWidth?: number;
  lineDash?: number[];
  priceSteps?: number;
  timeSteps?: number;
}

export const createGridRenderer = (
  klines: unknown[],
  config: GridLayerConfig = {},
  theme: { grid: string; text: string }
) => {
  const {
    showHorizontalLines = true,
    showVerticalLines = true,
    lineColor = theme.grid,
    lineWidth = 1,
    lineDash = [2, 2],
    priceSteps = 5,
    timeSteps = 10,
  } = config;

  return (ctx: CanvasRenderingContext2D, viewport: Viewport) => {
    if (!showHorizontalLines && !showVerticalLines) return;

    const { width, height, priceMin, priceMax } = viewport;

    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(lineDash);

    if (showHorizontalLines) {
      const priceStep = (priceMax - priceMin) / priceSteps;

      for (let i = 0; i <= priceSteps; i++) {
        const price = priceMin + i * priceStep;
        const y = height - ((price - priceMin) / (priceMax - priceMin)) * height;

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    if (showVerticalLines && klines.length > 0) {
      const visibleKlines = Math.ceil(viewport.end - viewport.start);
      const step = Math.max(1, Math.floor(visibleKlines / timeSteps));

      for (let i = Math.floor(viewport.start); i < viewport.end; i += step) {
        if (i < 0 || i >= klines.length) continue;

        const x = ((i - viewport.start) / (viewport.end - viewport.start)) * width;

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    ctx.restore();
  };
};
