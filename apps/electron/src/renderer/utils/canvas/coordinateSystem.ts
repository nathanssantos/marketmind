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
