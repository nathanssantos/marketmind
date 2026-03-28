import type { HMAResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useHMAWorker = (
  klines: Kline[],
  enabled: boolean = true,
  period: number = 20,
): HMAResult | null => {
  const message = useMemo(
    () => klines.length > 0 ? { klines, period } : null,
    [klines, period],
  );

  return useWorkerComputation<HMAResult>(
    'hma',
    () => new Worker(new URL('../workers/hma.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
