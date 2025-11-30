import type { Kline } from '@shared/types';
import { getKlineClose, getKlineOpen, getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';

export interface Bounds {
  minPrice: number;
  maxPrice: number;
  minVolume: number;
  maxVolume: number;
}

export const calculateBounds = (
  candles: Kline[],
  viewportStart: number,
  viewportEnd: number
): Bounds => {
  if (!candles || candles.length === 0) {
    return {
      minPrice: 0,
      maxPrice: 0,
      minVolume: 0,
      maxVolume: 0,
    };
  }

  const start = Math.max(0, Math.floor(viewportStart));
  const end = Math.min(candles.length, Math.ceil(viewportEnd));
  const visibleCandles = candles.slice(start, end);

  if (visibleCandles.length === 0) {
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

  for (const candle of visibleCandles) {
    minPrice = Math.min(minPrice, getKlineLow(candle));
    maxPrice = Math.max(maxPrice, getKlineHigh(candle));
    minVolume = Math.min(minVolume, getKlineVolume(candle));
    maxVolume = Math.max(maxVolume, getKlineVolume(candle));
  }

  return {
    minPrice,
    maxPrice,
    minVolume,
    maxVolume,
  };
};
