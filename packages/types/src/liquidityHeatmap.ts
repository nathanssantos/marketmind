export interface LiquidityHeatmapBucket {
  time: number;
  bids: Record<number, number>;
  asks: Record<number, number>;
}

export interface LiquidityHeatmapSnapshot {
  symbol: string;
  priceBinSize: number;
  buckets: LiquidityHeatmapBucket[];
  maxQuantity: number;
}
