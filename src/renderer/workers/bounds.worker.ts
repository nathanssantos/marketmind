import type { Candle } from '@shared/types';

export interface BoundsWorkerRequest {
  type: 'calculateBounds';
  candles: Candle[];
  viewportStart: number;
  viewportEnd: number;
}

export interface BoundsWorkerResponse {
  type: 'boundsResult';
  minPrice: number;
  maxPrice: number;
  minVolume: number;
  maxVolume: number;
}

const calculateBounds = (
  candles: Candle[],
  viewportStart: number,
  viewportEnd: number
): Omit<BoundsWorkerResponse, 'type'> => {
  const visibleStart = Math.floor(viewportStart);
  const visibleEnd = Math.min(Math.ceil(viewportEnd), candles.length);
  const visibleCandles = candles.slice(visibleStart, visibleEnd);

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

  for (let i = 0; i < visibleCandles.length; i++) {
    const candle = visibleCandles[i];
    if (!candle) continue;

    if (candle.high > maxPrice) maxPrice = candle.high;
    if (candle.low < minPrice) minPrice = candle.low;
    if (candle.volume > maxVolume) maxVolume = candle.volume;
    if (candle.volume < minVolume) minVolume = candle.volume;
  }

  return {
    minPrice: minPrice === Infinity ? 0 : minPrice,
    maxPrice: maxPrice === -Infinity ? 0 : maxPrice,
    minVolume: minVolume === Infinity ? 0 : minVolume,
    maxVolume: maxVolume === -Infinity ? 0 : maxVolume,
  };
};

self.onmessage = (event: MessageEvent<BoundsWorkerRequest>) => {
  const { type, candles, viewportStart, viewportEnd } = event.data;

  if (type !== 'calculateBounds') return;

  const result = calculateBounds(candles, viewportStart, viewportEnd);

  const response: BoundsWorkerResponse = {
    type: 'boundsResult',
    ...result,
  };

  self.postMessage(response);
};

export {};
