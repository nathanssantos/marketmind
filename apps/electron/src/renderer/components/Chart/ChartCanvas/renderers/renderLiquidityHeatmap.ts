import { HEATMAP_BUCKET_DURATION_MS, type LiquidityHeatmapBucket } from '@marketmind/types';
import { getLiquidityLUTs } from '@renderer/components/Chart/liquidityLUTs';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { GenericRenderer } from './types';

interface MergedLevels {
  bids: Map<number, number>;
  asks: Map<number, number>;
  nextSearchStart: number;
}

const mergeRecordIntoMap = (rec: Record<string, number>, target: Map<number, number>): void => {
  for (const key in rec) {
    const price = Number(key);
    const qty = rec[key]!;
    const existing = target.get(price) ?? 0;
    if (qty > existing) target.set(price, qty);
  }
};

function findBucketsForKline(
  buckets: LiquidityHeatmapBucket[],
  openTime: number,
  closeTime: number,
  searchStart: number,
): MergedLevels {
  const bids = new Map<number, number>();
  const asks = new Map<number, number>();
  let nextStart = searchStart;

  for (let i = searchStart; i < buckets.length; i++) {
    const bt = buckets[i]!.time;
    if (bt >= closeTime) break;
    if (bt + HEATMAP_BUCKET_DURATION_MS <= openTime) {
      nextStart = i + 1;
      continue;
    }
    nextStart = i;
    const bucket = buckets[i]!;
    mergeRecordIntoMap(bucket.bids, bids);
    mergeRecordIntoMap(bucket.asks, asks);
  }

  return { bids, asks, nextSearchStart: nextStart };
}

function paintLevels(
  canvasCtx: CanvasRenderingContext2D,
  levels: Map<number, number>,
  lut: string[],
  manager: CanvasManager,
  x: number,
  colWidth: number,
  cellHeight: number,
  chartHeight: number,
  invMax: number,
): void {
  for (const [price, qty] of levels) {
    const intensity = Math.min(255, (qty * invMax) | 0);
    if (intensity < 3) continue;
    const y = manager.priceToY(price);
    if (y + cellHeight < 0 || y > chartHeight) continue;
    canvasCtx.fillStyle = lut[intensity]!;
    canvasCtx.fillRect(x, y - cellHeight / 2, colWidth, cellHeight);
  }
}

export const renderLiquidityHeatmap: GenericRenderer = (ctx) => {
  const { manager, external } = ctx;
  const data = external?.liquidityHeatmap;
  if (!data || data.buckets.length === 0 || data.maxQuantity <= 0) return;

  const colorMode = external?.liquidityColorMode ?? 'colored';
  const { bid: BID_LUT, ask: ASK_LUT } = getLiquidityLUTs(colorMode);

  const canvasCtx = manager.getContext();
  const dimensions = manager.getDimensions();
  const viewport = manager.getViewport();
  const klines = manager.getKlines();
  if (!canvasCtx || !dimensions || !klines || klines.length === 0) return;

  const { chartWidth, chartHeight } = dimensions;
  const startIdx = Math.max(0, Math.floor(viewport.start));
  const endIdx = Math.min(klines.length, Math.ceil(viewport.end));
  if (startIdx >= endIdx) return;

  const visibleRange = viewport.end - viewport.start;
  if (visibleRange <= 0) return;
  const colWidth = Math.max(1, chartWidth / visibleRange);

  canvasCtx.save();
  canvasCtx.beginPath();
  canvasCtx.rect(0, 0, chartWidth, chartHeight);
  canvasCtx.clip();

  const binSize = data.priceBinSize;
  const refPrice = Number(klines[startIdx]!.close);
  const cellHeight = Math.max(2, Math.abs(manager.priceToY(refPrice) - manager.priceToY(refPrice + binSize)));
  const invMax = 255 / data.maxQuantity;

  let searchStart = 0;

  for (let i = startIdx; i < endIdx; i++) {
    const kline = klines[i]!;
    const x = manager.indexToX(i);
    if (x + colWidth <= 0 || x >= chartWidth) continue;

    const { bids, asks, nextSearchStart } = findBucketsForKline(
      data.buckets,
      kline.openTime,
      kline.closeTime,
      searchStart,
    );
    searchStart = nextSearchStart;

    paintLevels(canvasCtx, bids, BID_LUT, manager, x, colWidth, cellHeight, chartHeight, invMax);
    paintLevels(canvasCtx, asks, ASK_LUT, manager, x, colWidth, cellHeight, chartHeight, invMax);
  }

  canvasCtx.restore();
};
