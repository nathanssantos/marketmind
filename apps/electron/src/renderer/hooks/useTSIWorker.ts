import type { TSIResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useTSIWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  longPeriod = 25,
  shortPeriod = 13,
  signalPeriod = 13,
): TSIResult | null => {
  const message = useMemo(
    () => klines && klines.length > 0 ? { klines, longPeriod, shortPeriod, signalPeriod } : null,
    [klines, longPeriod, shortPeriod, signalPeriod],
  );

  return useWorkerComputation<TSIResult>(
    'tsi',
    () => new Worker(new URL('../workers/tsi.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
