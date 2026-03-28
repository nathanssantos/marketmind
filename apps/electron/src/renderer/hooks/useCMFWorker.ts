import type { CMFResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

interface CMFParams {
  period?: number;
}

export const useCMFWorker = (
  klines: Kline[],
  enabled: boolean = false,
  params: CMFParams = {}
) => {
  const { period = 20 } = params;

  const message = useMemo(
    () => klines.length > 0 ? { klines, period } : null,
    [klines, period],
  );

  return useWorkerComputation<CMFResult>(
    'cmf',
    () => new Worker(new URL('../workers/cmf.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
