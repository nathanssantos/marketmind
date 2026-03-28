import type { CMOResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useCMOWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  period = 14,
): CMOResult | null => {
  const message = useMemo(
    () => klines && klines.length > 0 ? { klines, period } : null,
    [klines, period],
  );

  return useWorkerComputation<CMOResult>(
    'cmo',
    () => new Worker(new URL('../workers/cmo.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
