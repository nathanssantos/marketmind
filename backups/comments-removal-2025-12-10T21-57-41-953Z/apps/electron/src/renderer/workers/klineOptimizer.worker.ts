import type { Kline } from '@marketmind/types';
import {
    optimizeKlines,
    type OptimizationResult,
    type SimplifiedKline,
} from '../utils/klineOptimization';

export interface OptimizerWorkerRequest {
  type: 'optimizeKlines';
  klines: Kline[];
  detailedCount?: number;
}

export interface OptimizerWorkerResponse extends OptimizationResult {
  type: 'optimizedResult';
}

self.onmessage = (event: MessageEvent<OptimizerWorkerRequest>) => {
  const { type, klines, detailedCount } = event.data;

  if (type !== 'optimizeKlines') return;

  const result = optimizeKlines(klines, detailedCount);

  const response: OptimizerWorkerResponse = {
    type: 'optimizedResult',
    ...result,
  };

  self.postMessage(response);
};

export { };
export type { SimplifiedKline };

