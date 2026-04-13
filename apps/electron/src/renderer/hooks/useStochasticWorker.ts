import type { StochasticResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useStochasticWorker = (
  klines: Kline[],
  enabled: boolean = false,
  kPeriod: number = 14,
  kSmoothing: number = 3,
  dPeriod: number = 3,
): StochasticResult | null => {
  const message = useMemo(
    () => klines.length > 0 ? { type: 'calculateStochastic', klines, kPeriod, kSmoothing, dPeriod } : null,
    [klines, kPeriod, kSmoothing, dPeriod],
  );

  return useWorkerComputation<StochasticResult>(
    'stochastic',
    () => new Worker(new URL('../workers/stochastic.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
