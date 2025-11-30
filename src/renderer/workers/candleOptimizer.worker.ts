import type { Kline } from '@shared/types';
import {
    optimizeCandles,
    type OptimizationResult,
    type SimplifiedCandle,
} from '../utils/candleOptimization';

export interface OptimizerWorkerRequest {
  type: 'optimizeCandles';
  candles: Kline[];
  detailedCount?: number;
}

export interface OptimizerWorkerResponse extends OptimizationResult {
  type: 'optimizedResult';
}

self.onmessage = (event: MessageEvent<OptimizerWorkerRequest>) => {
  const { type, candles, detailedCount } = event.data;

  if (type !== 'optimizeCandles') return;

  const result = optimizeCandles(candles, detailedCount);

  const response: OptimizerWorkerResponse = {
    type: 'optimizedResult',
    ...result,
  };

  self.postMessage(response);
};

export { };
export type { SimplifiedCandle };

