import type { Kline } from '@marketmind/types';
import { calculateStochastic } from '@marketmind/indicators';

export interface StochasticWorkerRequest {
  type: 'calculateStochastic';
  klines: Kline[];
  kPeriod: number;
  dPeriod: number;
}

export interface StochasticWorkerResponse {
  type: 'stochasticResult';
  k: (number | null)[];
  d: (number | null)[];
}

self.onmessage = (event: MessageEvent<StochasticWorkerRequest>) => {
  const { type, klines, kPeriod, dPeriod } = event.data;

  if (type !== 'calculateStochastic') return;

  const result = calculateStochastic(klines, kPeriod, dPeriod);

  const response: StochasticWorkerResponse = {
    type: 'stochasticResult',
    ...result,
  };

  self.postMessage(response);
};

export { };
