import type { Candle } from '@shared/types';
import { calculateMovingAverages, type MAConfig, type MAResult } from '../utils/movingAveragesCalculation';

export interface WorkerRequest {
  type: 'calculate';
  candles: Candle[];
  configs: MAConfig[];
}

export interface WorkerResponse {
  type: 'result';
  results: MAResult[];
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { type, candles, configs } = event.data;

  if (type !== 'calculate') return;

  const results = calculateMovingAverages(candles, configs);

  const response: WorkerResponse = {
    type: 'result',
    results,
  };

  self.postMessage(response);
};

export { };

