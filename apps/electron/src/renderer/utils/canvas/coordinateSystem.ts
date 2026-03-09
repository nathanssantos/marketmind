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

  if (visibleStart >= visibleEnd) {
    return {
      minPrice: 0,
      maxPrice: 0,
      minVolume: 0,
      maxVolume: 0,
    };
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let minVolume = Infinity;
  let maxVolume = -Infinity;

  for (let i = visibleStart; i < visibleEnd; i++) {
    const kline = klines[i];
    if (!kline) continue;

    const high = getKlineHigh(kline);
    const low = getKlineLow(kline);
    const volume = getKlineVolume(kline);

    if (high > maxPrice) maxPrice = high;
    if (low < minPrice) minPrice = low;
    if (volume > maxVolume) maxVolume = volume;
    if (volume < minVolume) minVolume = volume;
  }

  if (minPrice === Infinity) minPrice = 0;
  if (maxPrice === -Infinity) maxPrice = 0;
  if (minVolume === Infinity) minVolume = 0;
  if (maxVolume === -Infinity) maxVolume = 0;

  const priceRange = maxPrice - minPrice;
  const padding = CHART_CONFIG.PRICE_RANGE_PADDING;

  return {
    minPrice: minPrice - priceRange * padding,
    maxPrice: maxPrice + priceRange * padding,
    minVolume,
    maxVolume,
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

export interface ClampViewportOptions {
  minKlinesVisible?: number;
  futureExtension?: number;
}

export const indexToX = (
  index: number,
  viewport: Viewport,
  chartWidth: number,
): number => {
  const visibleRange = viewport.end - viewport.start;
  if (visibleRange === 0) return 0;
  const ratio = (index - viewport.start) / visibleRange;
  return ratio * chartWidth;
};

export const xToIndex = (
  x: number,
  viewport: Viewport,
  chartWidth: number,
): number => {
  const visibleRange = viewport.end - viewport.start;
  if (visibleRange === 0) return viewport.start;
  const ratio = x / chartWidth;
  return viewport.start + ratio * visibleRange;
};

export const clampViewport = (
  viewport: Viewport,
  klineCount: number,
  options: ClampViewportOptions = {},
): Viewport => {
  const {
    minKlinesVisible = CHART_CONFIG.MIN_VISIBLE_KLINES,
    futureExtension = CHART_CONFIG.FUTURE_VIEWPORT_EXTENSION,
  } = options;

  let { start, end } = viewport;
  const visibleCount = end - start;

  if (visibleCount < minKlinesVisible) {
    const center = (start + end) / 2;
    start = center - minKlinesVisible / 2;
    end = center + minKlinesVisible / 2;
  }

  const maxFuture = futureExtension === 0
    ? 0
    : Math.max(CHART_CONFIG.MIN_FUTURE_KLINES, Math.floor(visibleCount * futureExtension));
  const maxEnd = klineCount + maxFuture;

  if (start < 0) {
    end -= start;
    start = 0;
  }

  if (end > maxEnd) {
    start -= end - maxEnd;
    end = maxEnd;
  }

  if (start < 0) {
    start = 0;
  }

  return {
    ...viewport,
    start: Math.max(0, start),
    end: Math.min(maxEnd, end),
  };
};
