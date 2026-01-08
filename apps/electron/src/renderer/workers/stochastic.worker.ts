import { calculateStochastic } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

export interface StochasticWorkerRequest {
  type: 'calculateStochastic';
  klines: Kline[];
  kPeriod: number;
  kSmoothing: number;
  dPeriod: number;
}

export interface StochasticWorkerResponse {
  type: 'stochasticResult';
  k: (number | null)[];
  d: (number | null)[];
}

self.onmessage = (event: MessageEvent<StochasticWorkerRequest>) => {
  const { type, klines, kPeriod, kSmoothing, dPeriod } = event.data;

  if (type !== 'calculateStochastic') return;

  const result = calculateStochastic(klines, kPeriod, kSmoothing, dPeriod);

  const response: StochasticWorkerResponse = {
    type: 'stochasticResult',
    ...result,
  };

  self.postMessage(response);
};

export { };
