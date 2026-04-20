import type { Kline } from '@marketmind/types';
import { INDICATOR_COLORS } from '@shared/constants';
import type { GenericRenderer } from './types';
import { getInstanceParam } from './types';

const DEFAULT_OPACITY = 0.3;
const DEFAULT_POC_OPACITY = 0.6;
const DEFAULT_VALUE_AREA_PERCENT = 70;
const DEFAULT_NUM_BUCKETS = 100;
const DEFAULT_MAX_BAR_WIDTH = 120;

interface VolumeLevel {
  price: number;
  volume: number;
  buyVolume: number;
}

interface VolumeProfileResult {
  levels: VolumeLevel[];
  poc: number;
}

const buildProfile = (
  klines: Kline[],
  start: number,
  end: number,
  numBuckets: number,
): VolumeProfileResult | null => {
  if (end <= start) return null;
  const list = klines;

  let priceMin = Infinity;
  let priceMax = -Infinity;
  for (let i = start; i < end; i++) {
    const k = list[i];
    if (!k) continue;
    const high = parseFloat(k.high);
    const low = parseFloat(k.low);
    if (low < priceMin) priceMin = low;
    if (high > priceMax) priceMax = high;
  }

  const range = priceMax - priceMin;
  if (range <= 0) return null;

  const bucketSize = range / numBuckets;
  const buckets = new Array<number>(numBuckets).fill(0);
  const buyBuckets = new Array<number>(numBuckets).fill(0);

  for (let i = start; i < end; i++) {
    const k = list[i];
    if (!k) continue;
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
    const highBucket = Math.min(numBuckets - 1, Math.floor((high - priceMin) / bucketSize));

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
  const levels: VolumeLevel[] = [];

  for (let i = 0; i < numBuckets; i++) {
    const v = buckets[i] ?? 0;
    if (v <= 0) continue;
    if (v > maxVol) {
      maxVol = v;
      pocIndex = i;
    }
    levels.push({
      price: priceMin + (i + 0.5) * bucketSize,
      volume: v,
      buyVolume: buyBuckets[i] ?? 0,
    });
  }

  if (levels.length === 0) return null;
  return { levels, poc: priceMin + (pocIndex + 0.5) * bucketSize };
};

export const renderVolumeProfile: GenericRenderer = (ctx, input) => {
  const { manager, colors } = ctx;
  const dimensions = manager.getDimensions();
  const canvasCtx = manager.getContext();
  if (!canvasCtx || !dimensions) return;

  const klines = manager.getKlines();
  if (!klines.length) return;

  const viewport = manager.getViewport();
  const start = Math.max(0, Math.floor(viewport.start));
  const end = Math.min(klines.length, Math.ceil(viewport.end) + 1);

  const numBuckets =
    (getInstanceParam<number>(input.instance, input.definition, 'numBuckets') ?? DEFAULT_NUM_BUCKETS);
  const maxBarWidth =
    (getInstanceParam<number>(input.instance, input.definition, 'maxBarWidth') ?? DEFAULT_MAX_BAR_WIDTH);
  const opacity =
    (getInstanceParam<number>(input.instance, input.definition, 'opacity') ?? DEFAULT_OPACITY * 100) / 100;
  const valueAreaPercent =
    (getInstanceParam<number>(input.instance, input.definition, 'valueAreaPercent') ?? DEFAULT_VALUE_AREA_PERCENT);
  void valueAreaPercent;

  const profile = buildProfile(klines, start, end, numBuckets);
  if (!profile || profile.levels.length === 0) return;

  const { chartWidth, chartHeight } = dimensions;
  const maxVolume = Math.max(...profile.levels.map((l) => l.volume));
  if (maxVolume <= 0) return;

  const priceLevels = profile.levels.map((l) => l.price).sort((a, b) => a - b);
  const bucketPriceSize = priceLevels.length > 1
    ? (priceLevels[priceLevels.length - 1]! - priceLevels[0]!) / priceLevels.length
    : 1;
  const y1 = manager.priceToY(0);
  const y2 = manager.priceToY(bucketPriceSize);
  const barHeight = Math.max(1, Math.abs(y1 - y2) * 0.9);

  canvasCtx.save();
  canvasCtx.beginPath();
  canvasCtx.rect(0, 0, chartWidth, chartHeight);
  canvasCtx.clip();

  for (const level of profile.levels) {
    const y = manager.priceToY(level.price);
    if (y < -barHeight || y > chartHeight + barHeight) continue;

    const barWidth = (level.volume / maxVolume) * maxBarWidth;
    const x = chartWidth - barWidth;
    const isPOC = level.price === profile.poc;
    const buyRatio = level.volume > 0 ? level.buyVolume / level.volume : 0.5;
    const buyWidth = barWidth * buyRatio;
    const sellWidth = barWidth - buyWidth;

    canvasCtx.globalAlpha = isPOC ? DEFAULT_POC_OPACITY : opacity;

    canvasCtx.fillStyle = colors.bullish;
    canvasCtx.fillRect(x, y - barHeight / 2, buyWidth, barHeight);

    canvasCtx.fillStyle = colors.bearish;
    canvasCtx.fillRect(x + buyWidth, y - barHeight / 2, sellWidth, barHeight);

    if (isPOC) {
      canvasCtx.strokeStyle = colors.scalping?.pocLine ?? INDICATOR_COLORS.POC_LINE;
      canvasCtx.lineWidth = 1;
      canvasCtx.setLineDash([4, 2]);
      canvasCtx.beginPath();
      canvasCtx.moveTo(0, y);
      canvasCtx.lineTo(chartWidth, y);
      canvasCtx.stroke();
      canvasCtx.setLineDash([]);
    }
  }

  canvasCtx.globalAlpha = 1;
  canvasCtx.restore();
};
