import type { PPOResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const usePPOWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): PPOResult | null => {
  const message = useMemo(
    () => klines && klines.length > 0 ? { klines, fastPeriod, slowPeriod, signalPeriod } : null,
    [klines, fastPeriod, slowPeriod, signalPeriod],
  );

  return useWorkerComputation<PPOResult>(
    'ppo',
    () => new Worker(new URL('../workers/ppo.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
