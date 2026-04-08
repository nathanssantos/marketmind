import type { DEMAResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useDEMAWorker = (
  klines: Kline[],
  enabled: boolean = true,
  period: number = 21,
): DEMAResult | null => {
  const message = useMemo(
    () => klines.length > 0 ? { klines, period } : null,
    [klines, period],
  );

  return useWorkerComputation<DEMAResult>(
    'dema',
    () => new Worker(new URL('../workers/dema.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
