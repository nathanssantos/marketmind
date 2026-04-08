import type { SupertrendResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useSupertrendWorker = (
  klines: Kline[],
  enabled: boolean = true,
  period: number = 10,
  multiplier: number = 3
): SupertrendResult | null => {
  const message = useMemo(
    () => klines.length > 0 ? { klines, period, multiplier } : null,
    [klines, period, multiplier],
  );

  return useWorkerComputation<SupertrendResult>(
    'supertrend',
    () => new Worker(new URL('../workers/supertrend.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
