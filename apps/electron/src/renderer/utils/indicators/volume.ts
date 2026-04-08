import { calculateSMA } from '../../lib/indicators';
import type { Kline, VolumeCluster } from '@marketmind/types';
import { getKlineClose, getKlineVolume } from '@shared/utils';

const DEFAULT_VOLUME_PERIOD = 20;
const DEFAULT_SPIKE_THRESHOLD = 1.5;
const DEFAULT_PRICE_TOLERANCE = 0.02;

const TIMEFRAME_TO_VOLUME_MA_PERIOD: Record<string, number> = {
  '1m': 20,
  '3m': 20,
  '5m': 20,
  '15m': 20,
  '30m': 20,
  '1h': 20,
  '2h': 20,
  '4h': 20,
  '6h': 20,
  '8h': 20,
  '12h': 20,
  '1d': 20,
  '3d': 14,
  '1w': 10,
  '1M': 10,
  '1y': 5,
};

export interface VolumeAnalysis {
  average: number[];
  spikes: number[];
  isAboveAverage: boolean[];
  relativeVolume: number[];
}

export interface VolumeMovingAverage {
  values: (number | null)[];
  period: number;
}

export const analyzeVolume = (
  klines: Kline[],
  period = DEFAULT_VOLUME_PERIOD,
  spikeThreshold = DEFAULT_SPIKE_THRESHOLD,
): VolumeAnalysis => {
  const volumeKlines = klines.map((c) => ({
    openTime: c.openTime,
    closeTime: c.closeTime,
    open: c.volume,
    high: c.volume,
    low: c.volume,
    close: c.volume,
    volume: c.volume,
    quoteVolume: '0',
    trades: 0,
    takerBuyBaseVolume: '0',
    takerBuyQuoteVolume: '0',
  }));
  
  const average = calculateSMA(volumeKlines, period);

  const spikes: number[] = [];
  const isAboveAverage: boolean[] = [];
  const relativeVolume: number[] = [];

  for (let i = 0; i < klines.length; i++) {
    const kline = klines[i];
    const avg = average[i];

    if (!kline || avg === null || avg === undefined) {
      isAboveAverage.push(false);
      relativeVolume.push(1);
      continue;
    }

    const volume = getKlineVolume(kline);
    const relative = avg > 0 ? volume / avg : 1;
    relativeVolume.push(relative);

    const above = volume > avg;
    isAboveAverage.push(above);

    if (volume > avg * spikeThreshold) {
      spikes.push(i);
    }
  }

  return {
    average: average.map(v => v ?? 0),
    spikes,
    isAboveAverage,
    relativeVolume,
  };
};

export const detectVolumeClusters = (
  klines: Kline[],
  threshold = DEFAULT_PRICE_TOLERANCE,
): VolumeCluster[] => {
  const clusters: Map<number, { volume: number; count: number }> = new Map();

  for (const kline of klines) {
    const priceLevel = Math.round(getKlineClose(kline) / threshold) * threshold;

    const existing = clusters.get(priceLevel) ?? { volume: 0, count: 0 };
    clusters.set(priceLevel, {
      volume: existing.volume + getKlineVolume(kline),
      count: existing.count + 1,
    });
  }

  return Array.from(clusters.entries())
    .map(([price, data]) => ({
      price,
      totalVolume: data.volume,
      avgVolume: data.volume / data.count,
      count: data.count,
    }))
    .sort((a, b) => b.totalVolume - a.totalVolume);
};

export const getVolumeMAPeriod = (timeframe: string): number => {
  return TIMEFRAME_TO_VOLUME_MA_PERIOD[timeframe] ?? DEFAULT_VOLUME_PERIOD;
};

export const calculateVolumeMA = (
  klines: Kline[],
  period: number = DEFAULT_VOLUME_PERIOD,
): VolumeMovingAverage => {
  if (klines.length === 0 || period <= 0) {
    return { values: [], period };
  }

  const volumeKlines = klines.map((c) => ({
    openTime: c.openTime,
    closeTime: c.closeTime,
    open: c.volume,
    high: c.volume,
    low: c.volume,
    close: c.volume,
    volume: c.volume,
    quoteVolume: '0',
    trades: 0,
    takerBuyBaseVolume: '0',
    takerBuyQuoteVolume: '0',
  }));

  const values = calculateSMA(volumeKlines, period);

  return { values, period };
};
