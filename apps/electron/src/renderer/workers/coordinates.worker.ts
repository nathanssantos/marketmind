interface CoordinateRequest {
  type: 'batchPriceToY' | 'batchIndexToX';
  data: number[];
  bounds?: { minPrice: number; maxPrice: number };
  dimensions?: { chartHeight: number; chartWidth: number };
  viewport?: { start: number; end: number };
  paddingTop?: number;
  paddingBottom?: number;
  rightMargin?: number;
}

const batchPriceToY = (
  prices: number[],
  minPrice: number,
  maxPrice: number,
  chartHeight: number,
  paddingTop: number,
  paddingBottom: number
): number[] => {
  const priceRange = maxPrice - minPrice;
  const availableHeight = chartHeight - paddingTop - paddingBottom;

  if (priceRange === 0) {
    const centerY = chartHeight / 2;
    return prices.map(() => centerY);
  }

  return prices.map((price) => {
    const ratio = (price - minPrice) / priceRange;
    return chartHeight - paddingBottom - ratio * availableHeight;
  });
};

const batchIndexToX = (
  indices: number[],
  viewportStart: number,
  viewportEnd: number,
  chartWidth: number,
  rightMargin: number
): number[] => {
  const effectiveWidth = chartWidth - rightMargin;
  const visibleRange = viewportEnd - viewportStart;

  if (visibleRange === 0) return indices.map(() => 0);

  return indices.map((index) => {
    const ratio = (index - viewportStart) / visibleRange;
    return ratio * effectiveWidth;
  });
};

self.onmessage = (e: MessageEvent<CoordinateRequest>) => {
  const { type, data, bounds, dimensions, viewport, paddingTop = 0, paddingBottom = 0, rightMargin = 0 } = e.data;

  let results: number[] = [];

  if (type === 'batchPriceToY' && bounds && dimensions) {
    results = batchPriceToY(data, bounds.minPrice, bounds.maxPrice, dimensions.chartHeight, paddingTop, paddingBottom);
  } else if (type === 'batchIndexToX' && viewport && dimensions) {
    results = batchIndexToX(data, viewport.start, viewport.end, dimensions.chartWidth, rightMargin);
  }

  self.postMessage({ results });
};
