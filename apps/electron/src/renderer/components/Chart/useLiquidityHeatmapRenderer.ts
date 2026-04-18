import { HEATMAP_BUCKET_DURATION_MS } from '@marketmind/types';
import type { LiquidityHeatmapBucket, LiquidityHeatmapSnapshot } from '@marketmind/types';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

import type { MutableRefObject } from 'react';
import { useCallback } from 'react';
import { getLiquidityLUTs, type LiquidityColorMode } from './liquidityLUTs';

interface UseLiquidityHeatmapRendererProps {
  manager: CanvasManager | null;
  heatmapDataRef: MutableRefObject<LiquidityHeatmapSnapshot | null>;
  enabled?: boolean;
  liquidationMarkersEnabled?: boolean;
  colorMode?: LiquidityColorMode;
}

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
  liquidationMarkersEnabled = false,
  colorMode = 'colored',
}: UseLiquidityHeatmapRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || (!enabled && !liquidationMarkersEnabled)) return;
    const data = heatmapDataRef.current;
    if (!data) return;
    const hasHeatmapData = enabled && data.buckets.length > 0 && data.maxQuantity > 0;
    const { bid: BID_LUT, ask: ASK_LUT } = getLiquidityLUTs(colorMode);

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const klines = manager.getKlines();

    if (!ctx || !dimensions || !klines || klines.length === 0) return;

    const { chartWidth, chartHeight } = dimensions;
    const startIdx = Math.max(0, Math.floor(viewport.start));
    const endIdx = Math.min(klines.length, Math.ceil(viewport.end));
    if (startIdx >= endIdx) return;

    const visibleRange = viewport.end - viewport.start;
    if (visibleRange <= 0) return;
    const colWidth = Math.max(1, chartWidth / visibleRange);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();

    if (hasHeatmapData) {
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
          searchStart
        );
        searchStart = nextSearchStart;

        paintLevels(ctx, bids, BID_LUT, manager, x, colWidth, cellHeight, chartHeight, invMax);
        paintLevels(ctx, asks, ASK_LUT, manager, x, colWidth, cellHeight, chartHeight, invMax);
      }
    }

    if (liquidationMarkersEnabled && data.liquidations && data.liquidations.length > 0) {
      const markerSize = 3.5;
      for (const liq of data.liquidations) {
        const y = manager.priceToY(liq.price);
        if (y < 0 || y > chartHeight) continue;

        let liqX = -1;
        for (let i = startIdx; i < endIdx; i++) {
          if (klines[i]!.openTime <= liq.time && liq.time < klines[i]!.closeTime) {
            liqX = manager.indexToX(i) + colWidth / 2;
            break;
          }
        }
        if (liqX < 0) {
          if (liq.time >= klines[endIdx - 1]!.openTime) liqX = manager.indexToX(endIdx - 1) + colWidth / 2;
          else continue;
        }

        ctx.fillStyle = liq.side === 'SELL' ? 'rgba(255, 60, 60, 0.9)' : 'rgba(60, 255, 120, 0.9)';
        ctx.beginPath();
        ctx.arc(liqX, y, markerSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (liquidationMarkersEnabled && data.estimatedLevels && data.estimatedLevels.length > 0) {
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1;
      for (const level of data.estimatedLevels) {
        const y = manager.priceToY(level.price);
        if (y < 0 || y > chartHeight) continue;

        ctx.strokeStyle = level.side === 'LONG'
          ? 'rgba(255, 80, 80, 0.4)'
          : 'rgba(80, 255, 140, 0.4)';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartWidth, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [manager, heatmapDataRef, enabled, liquidationMarkersEnabled, colorMode]);

  return { render };
};
