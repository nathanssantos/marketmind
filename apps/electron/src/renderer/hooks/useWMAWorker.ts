import type { WMAResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useWMAWorker = (
  klines: Kline[],
  enabled: boolean = true,
  period: number = 20,
): WMAResult | null => {
  const message = useMemo(
    () => klines.length > 0 ? { klines, period } : null,
    [klines, period],
  );

  return useWorkerComputation<WMAResult>(
    'wma',
    () => new Worker(new URL('../workers/wma.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
