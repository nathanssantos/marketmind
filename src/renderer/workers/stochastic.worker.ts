import type { Candle } from '@shared/types';
import { calculateStochastic } from '../utils/stochastic';

export interface StochasticWorkerRequest {
  type: 'calculateStochastic';
  candles: Candle[];
  kPeriod: number;
  dPeriod: number;
}

export interface StochasticWorkerResponse {
  type: 'stochasticResult';
  k: (number | null)[];
  d: (number | null)[];
}

self.onmessage = (event: MessageEvent<StochasticWorkerRequest>) => {
  const { type, candles, kPeriod, dPeriod } = event.data;

  if (type !== 'calculateStochastic') return;

  const result = calculateStochastic(candles, kPeriod, dPeriod);

  const response: StochasticWorkerResponse = {
    type: 'stochasticResult',
    ...result,
  };

  self.postMessage(response);
};

export { };
