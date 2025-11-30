import type { Kline } from '@shared/types';
import { calculateMovingAverages, type MAConfig, type MAResult } from '../utils/movingAverages';

export interface MAWorkerRequest {
  type: 'calculate';
  klines: Kline[];
  configs: MAConfig[];
}

export interface WorkerResponse {
  type: 'result';
  results: MAResult[];
}

self.onmessage = (event: MessageEvent<MAWorkerRequest>) => {
  const { type, klines, configs } = event.data;

  if (type !== 'calculate') return;

  const results = calculateMovingAverages(klines, configs);

  const response: WorkerResponse = {
    type: 'result',
    results,
  };

  self.postMessage(response);
};

export { };

