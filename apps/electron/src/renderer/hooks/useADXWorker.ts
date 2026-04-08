import type { ADXResult } from '@marketmind/types';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useADXWorker = (
  klines: Kline[],
  enabled: boolean = true,
  period: number = 14
): ADXResult | null => {
  const message = useMemo(
    () => klines.length > 0 ? { klines, period } : null,
    [klines, period],
  );

  return useWorkerComputation<ADXResult>(
    'adx',
    () => new Worker(new URL('../workers/adx.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
