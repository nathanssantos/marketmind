export const HEATMAP_MAX_BUCKETS = 500;
export const HEATMAP_BUCKET_DURATION_MS = 60_000;

export interface LiquidityHeatmapBucket {
  time: number;
  bids: Record<string, number>;
  asks: Record<string, number>;
}

export interface LiquidityHeatmapLiquidation {
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  time: number;
}

export interface EstimatedLiquidationLevel {
  price: number;
  side: 'LONG' | 'SHORT';
  leverage: number;
}

export interface LiquidityHeatmapSnapshot {
  symbol: string;
  priceBinSize: number;
  buckets: LiquidityHeatmapBucket[];
  maxQuantity: number;
  liquidations: LiquidityHeatmapLiquidation[];
  estimatedLevels: EstimatedLiquidationLevel[];
}
