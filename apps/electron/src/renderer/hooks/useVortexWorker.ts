import type { VortexResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useVortexWorker = (
  klines: Kline[] | null,
  enabled: boolean,
  period = 14,
): VortexResult | null => {
  const message = useMemo(
    () => klines && klines.length > 0 ? { klines, period } : null,
    [klines, period],
  );

  return useWorkerComputation<VortexResult>(
    'vortex',
    () => new Worker(new URL('../workers/vortex.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
