import { HEATMAP_BUCKET_DURATION_MS } from '@marketmind/types';
import type { LiquidityHeatmapBucket, LiquidityHeatmapSnapshot } from '@marketmind/types';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG } from '@shared/constants';
import type { MutableRefObject } from 'react';
import { useCallback } from 'react';

interface UseLiquidityHeatmapRendererProps {
  manager: CanvasManager | null;
  heatmapDataRef: MutableRefObject<LiquidityHeatmapSnapshot | null>;
  enabled?: boolean;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function buildLUT(
  stops: Array<{ r: [number, number]; g: [number, number]; b: [number, number]; a: [number, number] }>
): string[] {
  const lut: string[] = [];
  const segCount = stops.length;
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const segIdx = Math.min(segCount - 1, (t * segCount) | 0);
    const segT = t * segCount - segIdx;
    const s = stops[segIdx]!;
    const r = lerp(s.r[0], s.r[1], segT) | 0;
    const g = lerp(s.g[0], s.g[1], segT) | 0;
    const b = lerp(s.b[0], s.b[1], segT) | 0;
    const a = lerp(s.a[0], s.a[1], segT);
    lut.push(`rgba(${r},${g},${b},${a.toFixed(2)})`);
  }
  return lut;
}

const BID_LUT = buildLUT([
  { r: [20, 30], g: [80, 160], b: [60, 80], a: [0.3, 0.45] },
  { r: [30, 50], g: [160, 220], b: [80, 100], a: [0.45, 0.6] },
  { r: [50, 100], g: [220, 255], b: [100, 120], a: [0.6, 0.75] },
  { r: [100, 200], g: [255, 255], b: [120, 180], a: [0.75, 0.9] },
]);

const ASK_LUT = buildLUT([
  { r: [120, 180], g: [30, 40], b: [40, 50], a: [0.3, 0.45] },
  { r: [180, 230], g: [40, 60], b: [50, 60], a: [0.45, 0.6] },
  { r: [230, 255], g: [60, 100], b: [60, 50], a: [0.6, 0.75] },
  { r: [255, 255], g: [100, 200], b: [50, 120], a: [0.75, 0.9] },
]);

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
  searchStart: number
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
  ctx: CanvasRenderingContext2D,
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
    ctx.fillStyle = lut[intensity]!;
    ctx.fillRect(x, y - cellHeight / 2, colWidth, cellHeight);
  }
}

export const useLiquidityHeatmapRenderer = ({
  manager,
  heatmapDataRef,
  enabled = true,
}: UseLiquidityHeatmapRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled) return;
    const data = heatmapDataRef.current;
    if (!data || data.buckets.length === 0 || data.maxQuantity <= 0) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const klines = manager.getKlines();

    if (!ctx || !dimensions || !klines || klines.length === 0) return;

    const { chartWidth, chartHeight } = dimensions;
    const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;
    const startIdx = Math.max(0, Math.floor(viewport.start));
    const endIdx = Math.min(klines.length, Math.ceil(viewport.end));
    if (startIdx >= endIdx) return;

    const visibleRange = viewport.end - viewport.start;
    if (visibleRange <= 0) return;
    const colWidth = Math.max(1, chartWidth / visibleRange);

    const binSize = data.priceBinSize;
    const refPrice = Number(klines[startIdx]!.close);
    const cellHeight = Math.max(2, Math.abs(manager.priceToY(refPrice) - manager.priceToY(refPrice + binSize)));
    const invMax = 255 / data.maxQuantity;

    const lastKlineX = manager.indexToX(Math.min(klines.length - 1, endIdx - 1)) + colWidth;
    const clipRight = Math.min(effectiveWidth, lastKlineX);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, clipRight, chartHeight);
    ctx.clip();

    let searchStart = 0;

    for (let i = startIdx; i < endIdx; i++) {
      const kline = klines[i]!;
      const x = manager.indexToX(i);
      if (x + colWidth <= 0 || x >= clipRight) continue;

      const { bids, asks, nextSearchStart } = findBucketsForKline(
        data.buckets,
        kline.openTime,
        kline.closeTime,
        searchStart
      );
      searchStart = nextSearchStart;

      paintLevels(ctx, bids, BID_LUT, manager, x, colWidth, cellHeight, chartHeight, invMax);
      paintLevels(ctx, asks, ASK_LUT, manager, x, colWidth, cellHeight, chartHeight, invMax);
    }

    ctx.restore();
  }, [manager, heatmapDataRef, enabled]);

  return { render };
};
