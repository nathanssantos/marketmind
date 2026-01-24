import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { ChartColors } from '@renderer/hooks/useChartColors';

export interface BackgroundLayerProps {
  manager: CanvasManager | null;
  colors: ChartColors;
  showGrid: boolean;
  symbol?: string;
  marketType?: string;
  timeframe?: string;
}

export interface BackgroundLayerResult {
  render: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => void;
  shouldRerender: (prev: BackgroundLayerProps, next: BackgroundLayerProps) => boolean;
}

export const createBackgroundLayer = ({
  manager,
  colors,
  showGrid,
  symbol,
  marketType,
  timeframe,
}: BackgroundLayerProps): BackgroundLayerResult => {
  const renderGrid = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void => {
    if (!manager || !showGrid) return;

    const dimensions = manager.getDimensions();
    if (!dimensions) return;

    ctx.save();
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 0.5;

    const verticalLines = 10;
    const horizontalLines = 8;

    const xStep = dimensions.chartWidth / verticalLines;
    for (let i = 0; i <= verticalLines; i++) {
      const x = Math.round(i * xStep) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, dimensions.chartHeight);
      ctx.stroke();
    }

    const yStep = dimensions.chartHeight / horizontalLines;
    for (let i = 0; i <= horizontalLines; i++) {
      const y = Math.round(i * yStep) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(dimensions.chartWidth, y);
      ctx.stroke();
    }

    ctx.restore();
  };

  const renderWatermark = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void => {
    if (!manager || !symbol) return;

    const dimensions = manager.getDimensions();
    if (!dimensions) return;

    ctx.save();
    ctx.fillStyle = colors.watermark;
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.05;

    const text = `${symbol}${marketType ? ` ${marketType}` : ''}${timeframe ? ` ${timeframe}` : ''}`;
    ctx.fillText(text, dimensions.chartWidth / 2, dimensions.chartHeight / 2);
    ctx.restore();
  };

  const render = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void => {
    renderWatermark(ctx);
    renderGrid(ctx);
  };

  const shouldRerender = (prev: BackgroundLayerProps, next: BackgroundLayerProps): boolean => {
    return (
      prev.showGrid !== next.showGrid ||
      prev.symbol !== next.symbol ||
      prev.marketType !== next.marketType ||
      prev.timeframe !== next.timeframe ||
      prev.colors.grid !== next.colors.grid ||
      prev.colors.watermark !== next.colors.watermark
    );
  };

  return {
    render,
    shouldRerender,
  };
};
