import type { SimplifiedKline } from '@/renderer/utils/klineOptimizer';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export interface OptimizedKlineData {
  detailed: Kline[];
  simplified: SimplifiedKline[];
  timestampInfo: {
    first: number;
    last: number;
    total: number;
    timeframe: string;
  };
}

export const useKlineOptimizerWorker = (
  klines: Kline[],
  enabled: boolean = true,
  detailedCount?: number,
): OptimizedKlineData | null => {
  const message = useMemo(
    () => klines.length > 0
      ? { type: 'optimizeKlines', klines, ...(detailedCount !== undefined && { detailedCount }) }
      : null,
    [klines, detailedCount],
  );

  return useWorkerComputation<OptimizedKlineData>(
    'klineOptimizer',
    () => new Worker(new URL('../workers/klineOptimizer.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
