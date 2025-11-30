import type { Kline } from '@shared/types';
import { getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';

export interface Bounds {
  minPrice: number;
  maxPrice: number;
  minVolume: number;
  maxVolume: number;
}

export const calculateBounds = (
  klines: Kline[],
  viewportStart: number,
  viewportEnd: number
): Bounds => {
  if (!klines || klines.length === 0) {
    return {
      minPrice: 0,
      maxPrice: 0,
      minVolume: 0,
      maxVolume: 0,
    };
  }

  const start = Math.max(0, Math.floor(viewportStart));
  const end = Math.min(klines.length, Math.ceil(viewportEnd));
  const visibleKlines = klines.slice(start, end);

  if (visibleKlines.length === 0) {
    return {
      minPrice: 0,
      maxPrice: 0,
      minVolume: 0,
      maxVolume: 0,
    };
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let minVolume = Infinity;
  let maxVolume = -Infinity;

  for (const kline of visibleKlines) {
    minPrice = Math.min(minPrice, getKlineLow(kline));
    maxPrice = Math.max(maxPrice, getKlineHigh(kline));
    minVolume = Math.min(minVolume, getKlineVolume(kline));
    maxVolume = Math.max(maxVolume, getKlineVolume(kline));
  }

  return {
    minPrice,
    maxPrice,
    minVolume,
    maxVolume,
  };
};
