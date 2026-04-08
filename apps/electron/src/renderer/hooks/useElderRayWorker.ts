import type { ElderRayResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useElderRayWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  period = 13,
): ElderRayResult | null => {
  const message = useMemo(
    () => klines && klines.length > 0 ? { klines, period } : null,
    [klines, period],
  );

  return useWorkerComputation<ElderRayResult>(
    'elderRay',
    () => new Worker(new URL('../workers/elderRay.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
