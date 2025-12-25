import type { Kline } from '@marketmind/types';

const getKlineVolume = (kline: Kline): number => {
  const vol = kline.volume;
  if (typeof vol === 'number') return vol;
  if (typeof vol === 'string') return parseFloat(vol);
  return 0;
};

export interface VolumeAnalysis {
  average: number;
  current: number;
  ratio: number;
  isSpike: boolean;
}

export const calculateAverageVolume = (
  klines: Kline[],
  currentIndex: number,
  period: number
): number => {
  if (klines.length === 0 || period <= 0) return 0;

  const start = Math.max(0, currentIndex - period + 1);
  const slice = klines.slice(start, currentIndex + 1);

  if (slice.length === 0) return 0;

  const sum = slice.reduce((acc, k) => acc + getKlineVolume(k), 0);
  return sum / slice.length;
};

export const calculateVolumeRatio = (
  klines: Kline[],
  currentIndex: number,
  period: number = 20
): number => {
  if (currentIndex < 0 || currentIndex >= klines.length) return 0;

  const current = klines[currentIndex];
  if (!current) return 0;

  const currentVolume = getKlineVolume(current);
  const avgVolume = calculateAverageVolume(klines, currentIndex - 1, period);

  if (avgVolume === 0) return 0;
  return currentVolume / avgVolume;
};

export const isVolumeSpike = (
  klines: Kline[],
  currentIndex: number,
  period: number = 20,
  threshold: number = 1.5
): boolean => {
  const ratio = calculateVolumeRatio(klines, currentIndex, period);
  return ratio >= threshold;
};

export const isVolumeConfirmed = (
  klines: Kline[],
  currentIndex: number,
  period: number = 20,
  multiplier: number = 1.0
): boolean => {
  if (currentIndex < 0 || currentIndex >= klines.length) return false;

  const current = klines[currentIndex];
  if (!current) return false;

  const currentVolume = getKlineVolume(current);
  const avgVolume = calculateAverageVolume(klines, currentIndex, period);

  return currentVolume >= avgVolume * multiplier;
};

export const analyzeVolume = (
  klines: Kline[],
  currentIndex: number,
  period: number = 20,
  spikeThreshold: number = 1.5
): VolumeAnalysis => {
  if (currentIndex < 0 || currentIndex >= klines.length) {
    return { average: 0, current: 0, ratio: 0, isSpike: false };
  }

  const current = klines[currentIndex];
  if (!current) {
    return { average: 0, current: 0, ratio: 0, isSpike: false };
  }

  const currentVolume = getKlineVolume(current);
  const avgVolume = calculateAverageVolume(klines, currentIndex - 1, period);
  const ratio = avgVolume > 0 ? currentVolume / avgVolume : 0;

  return {
    average: avgVolume,
    current: currentVolume,
    ratio,
    isSpike: ratio >= spikeThreshold,
  };
};
