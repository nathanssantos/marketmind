import type { Kline } from '@marketmind/types';
import { calculateBounds as calculate } from '../utils/boundsCalculation';

export interface BoundsWorkerRequest {
  type: 'calculateBounds';
  klines: Kline[];
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
  const { type, klines, viewportStart, viewportEnd } = event.data;

  if (type !== 'calculateBounds') return;

  const result = calculate(klines, viewportStart, viewportEnd);

  const response: BoundsWorkerResponse = {
    type: 'boundsResult',
    ...result,
  };

  self.postMessage(response);
};

export { };

