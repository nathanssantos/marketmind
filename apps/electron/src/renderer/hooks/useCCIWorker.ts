import type { CCIResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useCCIWorker = (
  klines: Kline[],
  enabled: boolean = true,
  period: number = 20
): CCIResult | null => {
  const message = useMemo(
    () => klines.length > 0 ? { klines, period } : null,
    [klines, period],
  );

  return useWorkerComputation<CCIResult>(
    'cci',
    () => new Worker(new URL('../workers/cci.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
