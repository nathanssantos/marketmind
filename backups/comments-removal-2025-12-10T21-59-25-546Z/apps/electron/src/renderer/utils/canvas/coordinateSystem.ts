import { CHART_CONFIG } from '@shared/constants';
import type { Kline, Viewport } from '@marketmind/types';
import { getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';

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

export const calculateBounds = (klines: Kline[], viewport: Viewport): Bounds => {
  const visibleStart = Math.floor(viewport.start);
  const visibleEnd = Math.min(Math.ceil(viewport.end), klines.length);
  const visibleKlines = klines.slice(visibleStart, visibleEnd);

  if (visibleKlines.length === 0) {
    return {
      minPrice: 0,
      maxPrice: 0,
      minVolume: 0,
      maxVolume: 0,
    };
  }

  const prices = visibleKlines.flatMap((c) => [getKlineHigh(c), getKlineLow(c)]);
  const volumes = visibleKlines.map((c) => getKlineVolume(c));

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
  const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;
  const visibleRange = viewport.end - viewport.start;
  const ratio = (index - viewport.start) / visibleRange;
  return ratio * effectiveWidth;
};

export const xToIndex = (
  x: number,
  viewport: Viewport,
  chartWidth: number,
): number => {
  const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;
  const visibleRange = viewport.end - viewport.start;
  const ratio = x / effectiveWidth;
  return viewport.start + ratio * visibleRange;
};

export const clampViewport = (
  viewport: Viewport,
  klineCount: number,
  minKlinesVisible: number = 10,
): Viewport => {
  let { start, end } = viewport;
  const visibleCount = end - start;

  if (visibleCount < minKlinesVisible) {
    const center = (start + end) / 2;
    start = center - minKlinesVisible / 2;
    end = center + minKlinesVisible / 2;
  }

  if (start < 0) {
    end -= start;
    start = 0;
  }

  if (end > klineCount) {
    start -= end - klineCount;
    end = klineCount;
  }

  if (start < 0) {
    start = 0;
  }

  return {
    ...viewport,
    start: Math.max(0, start),
    end: Math.min(klineCount, end),
  };
};
