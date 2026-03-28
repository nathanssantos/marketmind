import type { TEMAResult } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { useMemo } from 'react';
import { useWorkerComputation } from './useWorkerComputation';

export const useTEMAWorker = (
  klines: Kline[],
  enabled: boolean = true,
  period: number = 21,
): TEMAResult | null => {
  const message = useMemo(
    () => klines.length > 0 ? { klines, period } : null,
    [klines, period],
  );

  return useWorkerComputation<TEMAResult>(
    'tema',
    () => new Worker(new URL('../workers/tema.worker.ts', import.meta.url), { type: 'module' }),
    message,
    enabled,
  );
};
