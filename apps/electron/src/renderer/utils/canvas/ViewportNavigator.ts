import type { Kline, Viewport } from '@marketmind/types';
import { CHART_CONFIG } from '@shared/constants';
import { clampViewport, type Bounds, type Dimensions } from './coordinateSystem';

export interface ViewportState {
  viewport: Viewport;
  priceOffset: number;
  priceScale: number;
}

export const zoomViewport = (
  state: ViewportState,
  dimensions: Dimensions,
  klines: Kline[],
  delta: number,
  centerX?: number
): Viewport => {
  const { viewport } = state;
  const zoomFactor = 1 + delta * 0.1;
  const range = viewport.end - viewport.start;
  const newRange = range / zoomFactor;

  let newStart: number;
  let newEnd: number;

  if (centerX !== undefined) {
    const visibleRange = viewport.end - viewport.start;
    const widthPerKline = dimensions.chartWidth / visibleRange;
    const relativeIndex = centerX / widthPerKline;
    const centerIndex = viewport.start + relativeIndex;
    const centerRatio = (centerIndex - viewport.start) / range;

    newStart = centerIndex - newRange * centerRatio;
    newEnd = centerIndex + newRange * (1 - centerRatio);
  } else {
    const center = (viewport.start + viewport.end) / 2;
    newStart = center - newRange / 2;
    newEnd = center + newRange / 2;
  }

  return clampViewport({ ...viewport, start: newStart, end: newEnd }, klines.length);
};

export const panViewport = (
  viewport: Viewport,
  dimensions: Dimensions,
  klines: Kline[],
  deltaX: number
): Viewport => {
  const range = viewport.end - viewport.start;
  const indexDelta = (deltaX / dimensions.chartWidth) * range;

  return clampViewport(
    { ...viewport, start: viewport.start - indexDelta, end: viewport.end - indexDelta },
    klines.length
  );
};

export const panVerticalOffset = (
  currentOffset: number,
  deltaY: number,
  chartHeight: number,
  baseBounds: Bounds | null,
  priceScale: number = 1
): number => {
  // CRITICAL: `baseBounds` must be the LOCKED `rawBaseBounds` from
  // CanvasManager — not bounds re-derived from the current viewport.
  // The chart's Y-axis is locked at the last refit (initial load /
  // symbol swap / `>>` reset / vertical zoom reset); horizontal pan
  // does not move it. If we recomputed bounds from the post-pan
  // viewport here, the visible-range basis would diverge from what
  // the chart is actually drawing, and the resulting priceDelta
  // would scale `deltaY` by `currentRange / lockedRange` — the
  // "pan moves faster than the mouse after vertical zoom" bug.
  if (!baseBounds) return currentOffset;

  const visibleRange = (baseBounds.maxPrice - baseBounds.minPrice) * priceScale;
  const priceDelta = (deltaY / chartHeight) * visibleRange;
  return currentOffset + priceDelta;
};

export const zoomVerticalScale = (
  currentScale: number,
  deltaY: number,
  chartHeight: number
): number => {
  const zoomFactor = 1 + (deltaY / chartHeight) * 2;
  const newScale = currentScale * zoomFactor;
  return Math.max(0.1, Math.min(10, newScale));
};

export const calculateKlineWidth = (viewport: Viewport, chartWidth: number): number => {
  const visibleRange = viewport.end - viewport.start;
  const widthPerKline = chartWidth / visibleRange;
  const klineWidthRatio = 0.8;
  const calculatedWidth = widthPerKline * klineWidthRatio;
  return Math.max(CHART_CONFIG.MIN_KLINE_WIDTH, calculatedWidth);
};

export const getMaxViewportEnd = (klines: Kline[], viewport: Viewport): number => {
  const visibleRange = viewport.end - viewport.start;
  const maxFuture = Math.max(
    CHART_CONFIG.MIN_FUTURE_KLINES,
    Math.floor(visibleRange * CHART_CONFIG.FUTURE_VIEWPORT_EXTENSION),
  );
  return klines.length + maxFuture;
};

export const calculateInitialView = (
  klines: Kline[],
  currentViewport: Viewport
): Viewport => {
  const initialKlineCount = Math.min(CHART_CONFIG.INITIAL_KLINES_VISIBLE, klines.length);
  const futureSpace = Math.max(
    CHART_CONFIG.MIN_FUTURE_KLINES,
    Math.floor(initialKlineCount * CHART_CONFIG.INITIAL_FUTURE_EXTENSION),
  );

  return {
    ...currentViewport,
    start: Math.max(0, klines.length - initialKlineCount),
    end: klines.length + futureSpace,
  };
};

export const applyBoundsTransform = (
  baseBounds: Bounds,
  priceOffset: number,
  priceScale: number
): Bounds => {
  const center = (baseBounds.minPrice + baseBounds.maxPrice) / 2;
  const range = (baseBounds.maxPrice - baseBounds.minPrice) * priceScale;

  return {
    ...baseBounds,
    minPrice: center - range / 2 + priceOffset,
    maxPrice: center + range / 2 + priceOffset,
  };
};
