import type { AOResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useAOWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  fastPeriod = 5,
  slowPeriod = 34,
): AOResult | null => {
  const message = useMemo(
    () => klines && klines.length > 0 ? { klines, fastPeriod, slowPeriod } : null,
    [klines, fastPeriod, slowPeriod],
  );

  return useWorkerComputation<AOResult>(
    'ao',
    () => new Worker(new URL('../workers/ao.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
