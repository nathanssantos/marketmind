import type { Candle } from '@shared/types';
import { calculateBounds as calculate } from '../utils/boundsCalculation';

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

self.onmessage = (event: MessageEvent<BoundsWorkerRequest>) => {
  const { type, candles, viewportStart, viewportEnd } = event.data;

  if (type !== 'calculateBounds') return;

  const result = calculate(candles, viewportStart, viewportEnd);

  const response: BoundsWorkerResponse = {
    type: 'boundsResult',
    ...result,
  };

  self.postMessage(response);
};

export { };

