export const HEATMAP_MAX_BUCKETS = 500;
export const HEATMAP_BUCKET_DURATION_MS = 60_000;

export interface LiquidityHeatmapBucket {
  time: number;
  bids: Record<string, number>;
  asks: Record<string, number>;
}

export interface LiquidityHeatmapSnapshot {
  symbol: string;
  priceBinSize: number;
  buckets: LiquidityHeatmapBucket[];
  maxQuantity: number;
}
