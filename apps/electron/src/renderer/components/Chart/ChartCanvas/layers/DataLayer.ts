import type { Kline, Viewport } from '@marketmind/types';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { ChartColors } from '@renderer/hooks/useChartColors';
import type { VirtualizedKlinesResult } from '../useVirtualizedKlines';

export interface DataLayerProps {
  manager: CanvasManager | null;
  colors: ChartColors;
  klines: Kline[];
  virtualizedData?: VirtualizedKlinesResult;
  viewport: Viewport;
  chartType: 'kline' | 'line';
  showVolume: boolean;
  highlightedCandles?: Set<number>;
}

export interface DataLayerResult {
  render: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => void;
  shouldRerender: (prev: DataLayerProps, next: DataLayerProps) => boolean;
}

export const createDataLayer = ({
  manager,
  colors,
  klines,
  virtualizedData,
  viewport,
  chartType,
  showVolume,
  highlightedCandles,
}: DataLayerProps): DataLayerResult => {
  const getVisibleKlines = (): Kline[] => {
    if (virtualizedData) {
      return virtualizedData.visibleKlines;
    }
    const start = Math.max(0, Math.floor(viewport.start));
    const end = Math.min(klines.length, Math.ceil(viewport.end));
    return klines.slice(start, end);
  };

  const getStartIndex = (): number => {
    if (virtualizedData) {
      return virtualizedData.startIndex;
    }
    return Math.max(0, Math.floor(viewport.start));
  };

  const renderVolume = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void => {
    if (!manager || !showVolume) return;

    const dimensions = manager.getDimensions();
    if (!dimensions) return;

    const visible = getVisibleKlines();
    const startIdx = getStartIndex();
    const bounds = manager.getBounds();
    if (!bounds || bounds.maxVolume <= 0) return;

    const volumeHeight = dimensions.chartHeight * 0.15;
    const volumeTop = dimensions.chartHeight - volumeHeight;

    ctx.save();
    ctx.globalAlpha = 0.4;

    visible.forEach((kline, i) => {
      const globalIndex = startIdx + i;
      const x = manager.indexToX(globalIndex);
      const barWidth = Math.max(1, viewport.klineWidth * 0.8);
      const barHeight = (kline.volume / bounds.maxVolume) * volumeHeight;
      const isBullish = kline.close >= kline.open;

      ctx.fillStyle = isBullish ? colors.bullish : colors.bearish;
      ctx.fillRect(
        x - barWidth / 2,
        volumeTop + volumeHeight - barHeight,
        barWidth,
        barHeight
      );
    });

    ctx.restore();
  };

  const renderKlines = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void => {
    if (!manager) return;

    const dimensions = manager.getDimensions();
    if (!dimensions) return;

    const visible = getVisibleKlines();
    const startIdx = getStartIndex();

    ctx.save();

    visible.forEach((kline, i) => {
      const globalIndex = startIdx + i;
      const x = manager.indexToX(globalIndex);
      const openY = manager.priceToY(kline.open);
      const closeY = manager.priceToY(kline.close);
      const highY = manager.priceToY(kline.high);
      const lowY = manager.priceToY(kline.low);

      const isBullish = kline.close >= kline.open;
      const isHighlighted = highlightedCandles?.has(globalIndex);

      if (isHighlighted) {
        ctx.fillStyle = colors.highlighted;
        ctx.strokeStyle = colors.highlighted;
      } else {
        ctx.fillStyle = isBullish ? colors.bullish : colors.bearish;
        ctx.strokeStyle = isBullish ? colors.bullish : colors.bearish;
      }

      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      const bodyWidth = Math.max(1, viewport.klineWidth * 0.8);
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1, Math.abs(closeY - openY));

      if (isBullish) {
        ctx.strokeRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
      } else {
        ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
      }
    });

    ctx.restore();
  };

  const renderLineChart = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void => {
    if (!manager) return;

    const visible = getVisibleKlines();
    const startIdx = getStartIndex();

    if (visible.length < 2) return;

    ctx.save();
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    ctx.beginPath();
    visible.forEach((kline, i) => {
      const globalIndex = startIdx + i;
      const x = manager.indexToX(globalIndex);
      const y = manager.priceToY(kline.close);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    const gradient = ctx.createLinearGradient(0, 0, 0, manager.getDimensions()?.chartHeight ?? 0);
    gradient.addColorStop(0, `${colors.line}40`);
    gradient.addColorStop(1, `${colors.line}05`);

    ctx.fillStyle = gradient;
    ctx.lineTo(manager.indexToX(startIdx + visible.length - 1), manager.getDimensions()?.chartHeight ?? 0);
    ctx.lineTo(manager.indexToX(startIdx), manager.getDimensions()?.chartHeight ?? 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  const render = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void => {
    renderVolume(ctx);
    if (chartType === 'kline') {
      renderKlines(ctx);
    } else {
      renderLineChart(ctx);
    }
  };

  const shouldRerender = (prev: DataLayerProps, next: DataLayerProps): boolean => {
    return (
      prev.klines !== next.klines ||
      prev.viewport.start !== next.viewport.start ||
      prev.viewport.end !== next.viewport.end ||
      prev.viewport.klineWidth !== next.viewport.klineWidth ||
      prev.chartType !== next.chartType ||
      prev.showVolume !== next.showVolume ||
      prev.highlightedCandles !== next.highlightedCandles
    );
  };

  return {
    render,
    shouldRerender,
  };
};
