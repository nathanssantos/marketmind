import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { Kline, VolumeProfile, VolumeProfileLevel } from '@marketmind/types';
import { INDICATOR_COLORS } from '@shared/constants';
import { useCallback } from 'react';

interface UseVolumeProfileRendererProps {
  manager: CanvasManager | null;
  volumeProfile: VolumeProfile | null;
  colors: ChartThemeColors;
  enabled?: boolean;
}

const MAX_BAR_WIDTH = 120;
const OPACITY = 0.3;
const POC_OPACITY = 0.6;
const VALUE_AREA_PERCENT = 0.7;
const NUM_BUCKETS = 100;

const buildProfileFromKlines = (klines: Kline[], startIdx: number, endIdx: number, viewportPriceMin: number, viewportPriceMax: number): VolumeProfile | null => {
  const start = Math.max(0, Math.floor(startIdx));
  const end = Math.min(klines.length, Math.ceil(endIdx) + 1);
  if (end <= start) return null;

  const priceMin = viewportPriceMin;
  const priceMax = viewportPriceMax;
  const range = priceMax - priceMin;
  if (range <= 0) return null;

  const bucketSize = range / NUM_BUCKETS;
  const buckets = Array.from<number>({ length: NUM_BUCKETS }).fill(0);
  const buyBuckets = Array.from<number>({ length: NUM_BUCKETS }).fill(0);

  for (let i = start; i < end; i++) {
    const k = klines[i]!;
    const open = parseFloat(k.open);
    const close = parseFloat(k.close);
    const high = parseFloat(k.high);
    const low = parseFloat(k.low);
    const vol = parseFloat(k.volume);
    const takerBuyVol = parseFloat(k.takerBuyBaseVolume);
    const klineRange = high - low;
    if (klineRange <= 0 || vol <= 0) continue;

    const bodyBottom = Math.min(open, close);
    const bodyTop = Math.max(open, close);
    const buyRatio = vol > 0 ? takerBuyVol / vol : 0.5;

    const lowBucket = Math.max(0, Math.floor((low - priceMin) / bucketSize));
    const highBucket = Math.min(NUM_BUCKETS - 1, Math.floor((high - priceMin) / bucketSize));

    for (let b = lowBucket; b <= highBucket; b++) {
      const bucketMidPrice = priceMin + (b + 0.5) * bucketSize;
      const isInBody = bucketMidPrice >= bodyBottom && bucketMidPrice <= bodyTop;
      const weight = isInBody ? 2 : 1;
      const totalWeight = (highBucket - lowBucket + 1) + (isInBody ? 1 : 0);
      const volShare = (vol * weight) / totalWeight;
      buckets[b] = (buckets[b] ?? 0) + volShare;
      buyBuckets[b] = (buyBuckets[b] ?? 0) + volShare * buyRatio;
    }
  }

  let maxVol = 0;
  let pocIndex = 0;
  const levels: VolumeProfileLevel[] = [];

  for (let i = 0; i < NUM_BUCKETS; i++) {
    const vol = buckets[i] ?? 0;
    const buyVol = buyBuckets[i] ?? 0;
    if (vol <= 0) continue;
    if (vol > maxVol) {
      maxVol = vol;
      pocIndex = i;
    }
    levels.push({
      price: priceMin + (i + 0.5) * bucketSize,
      volume: vol,
      buyVolume: buyVol,
      sellVolume: vol - buyVol,
    });
  }

  if (levels.length === 0) return null;

  const poc = priceMin + (pocIndex + 0.5) * bucketSize;
  const totalVolume = levels.reduce((sum, l) => sum + l.volume, 0);
  const targetVolume = totalVolume * VALUE_AREA_PERCENT;

  const sorted = [...levels].sort((a, b) => b.volume - a.volume);
  let accumulated = 0;
  let vaHigh = poc;
  let vaLow = poc;
  for (const level of sorted) {
    accumulated += level.volume;
    if (level.price > vaHigh) vaHigh = level.price;
    if (level.price < vaLow) vaLow = level.price;
    if (accumulated >= targetVolume) break;
  }

  return { levels, poc, valueAreaHigh: vaHigh, valueAreaLow: vaLow };
};

export const useVolumeProfileRenderer = ({
  manager,
  volumeProfile: externalProfile,
  colors,
  enabled = true,
}: UseVolumeProfileRendererProps) => {
  const render = useCallback((): void => {
    if (!manager || !enabled) return;

    const klines = manager.getKlines();
    const viewport = manager.getViewport();

    const profile = externalProfile ?? (klines && klines.length > 0
      ? buildProfileFromKlines(klines, viewport.start, viewport.end, viewport.priceMin, viewport.priceMax)
      : null);

    if (!profile || profile.levels.length === 0) return;

    const ctx = manager.getContext();
    if (!ctx) return;

    const dims = manager.getDimensions();
    if (!dims) return;

    const chartWidth = dims.chartWidth;
    const chartHeight = dims.chartHeight;

    const maxVolume = Math.max(...profile.levels.map((l) => l.volume));
    if (maxVolume <= 0) return;

    const priceLevels = profile.levels.map((l) => l.price).sort((a, b) => a - b);
    const bucketPriceSize = priceLevels.length > 1
      ? (priceLevels[priceLevels.length - 1]! - priceLevels[0]!) / priceLevels.length
      : 1;
    const y1 = manager.priceToY(0);
    const y2 = manager.priceToY(bucketPriceSize);
    const barHeight = Math.max(1, Math.abs(y1 - y2) * 0.9);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();

    for (const level of profile.levels) {
      const y = manager.priceToY(level.price);
      if (y < -barHeight || y > chartHeight + barHeight) continue;

      const barWidth = (level.volume / maxVolume) * MAX_BAR_WIDTH;
      const x = chartWidth - barWidth;

      const isPOC = level.price === profile.poc;
      const buyRatio = level.volume > 0 ? level.buyVolume / level.volume : 0.5;

      const buyWidth = barWidth * buyRatio;
      const sellWidth = barWidth - buyWidth;

      ctx.globalAlpha = isPOC ? POC_OPACITY : OPACITY;

      ctx.fillStyle = colors.bullish;
      ctx.fillRect(x, y - barHeight / 2, buyWidth, barHeight);

      ctx.fillStyle = colors.bearish;
      ctx.fillRect(x + buyWidth, y - barHeight / 2, sellWidth, barHeight);

      if (isPOC) {
        ctx.strokeStyle = colors.scalping?.pocLine ?? INDICATOR_COLORS.POC_LINE;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartWidth, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }, [manager, externalProfile, enabled, colors]);

  return { render };
};
