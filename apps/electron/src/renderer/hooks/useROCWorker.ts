import type { ROCResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useROCWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  period = 12,
): ROCResult | null => {
  const message = useMemo(
    () => klines && klines.length > 0 ? { klines, period } : null,
    [klines, period],
  );

  return useWorkerComputation<ROCResult>(
    'roc',
    () => new Worker(new URL('../workers/roc.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
