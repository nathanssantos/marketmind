import type { Candle, VolumeCluster } from '@shared/types';
import { calculateSMA } from '../movingAverages';

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
  candles: Candle[],
  period = DEFAULT_VOLUME_PERIOD,
  spikeThreshold = DEFAULT_SPIKE_THRESHOLD,
): VolumeAnalysis => {
  const volumeCandles = candles.map((c) => ({
    timestamp: c.timestamp,
    open: c.volume,
    high: c.volume,
    low: c.volume,
    close: c.volume,
    volume: c.volume,
  }));
  
  const average = calculateSMA(volumeCandles, period);

  const spikes: number[] = [];
  const isAboveAverage: boolean[] = [];
  const relativeVolume: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const avg = average[i];

    if (!candle || avg === null || avg === undefined) {
      isAboveAverage.push(false);
      relativeVolume.push(1);
      continue;
    }

    const volume = candle.volume;
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
  candles: Candle[],
  threshold = DEFAULT_PRICE_TOLERANCE,
): VolumeCluster[] => {
  const clusters: Map<number, { volume: number; count: number }> = new Map();

  for (const candle of candles) {
    const priceLevel = Math.round(candle.close / threshold) * threshold;

    const existing = clusters.get(priceLevel) ?? { volume: 0, count: 0 };
    clusters.set(priceLevel, {
      volume: existing.volume + candle.volume,
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
  candles: Candle[],
  period: number = DEFAULT_VOLUME_PERIOD,
): VolumeMovingAverage => {
  if (period <= 0 || candles.length === 0) {
    return { values: [], period };
  }

  const values: (number | null)[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      values.push(null);
      continue;
    }

    let sum = 0;
    for (let j = 0; j < period; j++) {
      const candle = candles[i - j];
      if (!candle) continue;
      sum += candle.volume;
    }

    values.push(sum / period);
  }

  return { values, period };
};
