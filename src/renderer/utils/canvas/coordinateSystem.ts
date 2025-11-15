import type { Candle, Viewport } from '@shared/types';

export interface Bounds {
  minPrice: number;
  maxPrice: number;
  minVolume: number;
  maxVolume: number;
}

export interface Dimensions {
  width: number;
  height: number;
  chartHeight: number;
  volumeHeight: number;
  chartWidth: number;
}

export const calculateBounds = (candles: Candle[], viewport: Viewport): Bounds => {
  const visibleStart = Math.floor(viewport.start);
  const visibleEnd = Math.min(Math.ceil(viewport.end), candles.length);
  const visibleCandles = candles.slice(visibleStart, visibleEnd);

  if (visibleCandles.length === 0) {
    return {
      minPrice: 0,
      maxPrice: 0,
      minVolume: 0,
      maxVolume: 0,
    };
  }

  const prices = visibleCandles.flatMap((c) => [c.high, c.low]);
  const volumes = visibleCandles.map((c) => c.volume);

  return {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    minVolume: Math.min(...volumes),
    maxVolume: Math.max(...volumes),
  };
};

export const priceToY = (
  price: number,
  bounds: Bounds,
  dimensions: Dimensions,
  paddingTop: number,
  paddingBottom: number,
): number => {
  const { minPrice, maxPrice } = bounds;
  const { chartHeight } = dimensions;
  const priceRange = maxPrice - minPrice;

  if (priceRange === 0) return chartHeight / 2;

  const availableHeight = chartHeight - paddingTop - paddingBottom;
  const ratio = (price - minPrice) / priceRange;
  return chartHeight - paddingBottom - ratio * availableHeight;
};

export const yToPrice = (
  y: number,
  bounds: Bounds,
  dimensions: Dimensions,
  paddingTop: number,
  paddingBottom: number,
): number => {
  const { minPrice, maxPrice } = bounds;
  const { chartHeight } = dimensions;
  const priceRange = maxPrice - minPrice;

  if (priceRange === 0) return minPrice;

  const availableHeight = chartHeight - paddingTop - paddingBottom;
  const ratio = (chartHeight - paddingBottom - y) / availableHeight;
  return minPrice + ratio * priceRange;
};

export const volumeToHeight = (
  volume: number,
  bounds: Bounds,
  dimensions: Dimensions,
): number => {
  const { maxVolume } = bounds;
  const { volumeHeight } = dimensions;

  if (maxVolume === 0) return 0;

  return (volume / maxVolume) * volumeHeight;
};

export const indexToX = (
  index: number,
  viewport: Viewport,
  chartWidth: number,
): number => {
  const visibleRange = viewport.end - viewport.start;
  const ratio = (index - viewport.start) / visibleRange;
  return ratio * chartWidth;
};

export const xToIndex = (
  x: number,
  viewport: Viewport,
  chartWidth: number,
): number => {
  const visibleRange = viewport.end - viewport.start;
  const ratio = x / chartWidth;
  return viewport.start + ratio * visibleRange;
};

export const clampViewport = (
  viewport: Viewport,
  candleCount: number,
  minCandlesVisible: number = 10,
): Viewport => {
  let { start, end } = viewport;
  const visibleCount = end - start;

  if (visibleCount < minCandlesVisible) {
    const center = (start + end) / 2;
    start = center - minCandlesVisible / 2;
    end = center + minCandlesVisible / 2;
  }

  if (start < 0) {
    end -= start;
    start = 0;
  }

  if (end > candleCount) {
    start -= end - candleCount;
    end = candleCount;
  }

  if (start < 0) {
    start = 0;
  }

  return {
    ...viewport,
    start: Math.max(0, start),
    end: Math.min(candleCount, end),
  };
};
