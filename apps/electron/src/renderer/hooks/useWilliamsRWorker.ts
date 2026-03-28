import type { WilliamsRResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useWilliamsRWorker = (
  klines: Kline[],
  enabled: boolean = true,
  period: number = 14
): WilliamsRResult | null => {
  const message = useMemo(
    () => klines.length > 0 ? { klines, period } : null,
    [klines, period],
  );

  return useWorkerComputation<WilliamsRResult>(
    'williamsR',
    () => new Worker(new URL('../workers/williamsR.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
