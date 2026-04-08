import type { KlingerResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useKlingerWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  fastPeriod = 34,
  slowPeriod = 55,
  signalPeriod = 13,
): KlingerResult | null => {
  const message = useMemo(
    () => klines && klines.length > 0 ? { klines, fastPeriod, slowPeriod, signalPeriod } : null,
    [klines, fastPeriod, slowPeriod, signalPeriod],
  );

  return useWorkerComputation<KlingerResult>(
    'klinger',
    () => new Worker(new URL('../workers/klinger.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
