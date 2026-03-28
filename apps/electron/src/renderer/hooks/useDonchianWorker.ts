import type { DonchianResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

interface DonchianParams {
  period?: number;
}

export const useDonchianWorker = (
  klines: Kline[],
  enabled: boolean = false,
  params: DonchianParams = {}
) => {
  const { period = 20 } = params;

  const message = useMemo(
    () => klines.length > 0 ? { klines, period } : null,
    [klines, period],
  );

  return useWorkerComputation<DonchianResult>(
    'donchian',
    () => new Worker(new URL('../workers/donchian.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
