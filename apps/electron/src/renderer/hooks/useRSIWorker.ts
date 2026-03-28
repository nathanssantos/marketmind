import type { RSIResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useRSIWorker = (klines: Kline[], period: number = 2, enabled: boolean = false) => {
  const message = useMemo(
    () => klines.length > 0 ? { klines, period } : null,
    [klines, period],
  );

  return useWorkerComputation<RSIResult>(
    `rsi-${period}`,
    () => new Worker(new URL('../workers/rsi.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
