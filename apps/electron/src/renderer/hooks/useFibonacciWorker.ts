import type { FibonacciResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useFibonacciWorker = (
  klines: Kline[],
  enabled: boolean = true,
  lookback: number = 50,
): FibonacciResult | null => {
  const message = useMemo(
    () => klines.length > 0 ? { klines, lookback } : null,
    [klines, lookback],
  );

  return useWorkerComputation<FibonacciResult>(
    'fibonacci',
    () => new Worker(new URL('../workers/fibonacci.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
