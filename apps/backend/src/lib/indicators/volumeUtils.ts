import type { Kline } from '@marketmind/types';
import { getKlineVolume } from '@marketmind/types';

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
