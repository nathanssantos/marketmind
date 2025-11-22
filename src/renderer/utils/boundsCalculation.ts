import type { Candle } from '@shared/types';

export interface Bounds {
  minPrice: number;
  maxPrice: number;
  minVolume: number;
  maxVolume: number;
}

export const calculateBounds = (
  candles: Candle[],
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
    minPrice = Math.min(minPrice, candle.low);
    maxPrice = Math.max(maxPrice, candle.high);
    minVolume = Math.min(minVolume, candle.volume);
    maxVolume = Math.max(maxVolume, candle.volume);
  }

  return {
    minPrice,
    maxPrice,
    minVolume,
    maxVolume,
  };
};
