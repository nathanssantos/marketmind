import type { Candle, VolumeCluster } from '@shared/types';

const DEFAULT_VOLUME_PERIOD = 20;
const DEFAULT_SPIKE_THRESHOLD = 1.5;
const DEFAULT_PRICE_TOLERANCE = 0.02;

export interface VolumeAnalysis {
  average: number[];
  spikes: number[];
  isAboveAverage: boolean[];
  relativeVolume: number[];
}

const calculateSMA = (data: number[], period: number): number[] => {
  const sma: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        const value = data[i - j];
        if (value !== undefined) sum += value;
      }
      sma.push(sum / period);
    }
  }

  return sma;
};

export const analyzeVolume = (
  candles: Candle[],
  period = DEFAULT_VOLUME_PERIOD,
  spikeThreshold = DEFAULT_SPIKE_THRESHOLD,
): VolumeAnalysis => {
  const volumes = candles.map((c) => c.volume);
  const average = calculateSMA(volumes, period);

  const spikes: number[] = [];
  const isAboveAverage: boolean[] = [];
  const relativeVolume: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const avg = average[i];

    if (!candle || avg === undefined || isNaN(avg)) {
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
    average,
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
