import type { AroonResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useAroonWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  period = 25,
): AroonResult | null => {
  const message = useMemo(
    () => klines && klines.length > 0 ? { klines, period } : null,
    [klines, period],
  );

  return useWorkerComputation<AroonResult>(
    'aroon',
    () => new Worker(new URL('../workers/aroon.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
